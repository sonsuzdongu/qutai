import { getProvider } from '../ai/providers';
import type { ProviderId, ToolResult, Turn } from '../ai/types';
import { t } from '../i18n';
import { getBackgroundCount, isForeground, waitForForeground } from '../utils/foreground';
import { describeToolCall, executeTool, ToolContext } from './executeTool';
import { SYSTEM_PROMPT } from './systemPrompt';
import { memoryPrompt } from './memory';
import { MEMORY_TOOLS, TOOLS } from './tools';
import type { AgentEvent, Source } from './types';

const MAX_STEPS = 40;
/** Research reads many pages, so it may take more steps. */
const MAX_RESEARCH_STEPS = 80;
const KEEP_FULL_RESULTS = 2;
const KEEP_IMAGES = 1;
const COMPACT_THRESHOLD = 1500;
/** Tools whose result shows the agent the page's content, which makes the page a source. */
const READING_TOOLS = new Set(['read_page', 'view_screenshot']);
const MAX_SOURCES = 10;
const SAFE_TO_RETRY = new Set(['read_page', 'read_tab', 'view_screenshot', 'list_tabs', 'scroll', 'scroll_to', 'wait']);

export type AgentOptions = ToolContext & {
  provider: ProviderId;
  apiKey: string;
  model: string;
  /** Conversation history; new turns are appended in place. */
  turns: Turn[];
  /** Deep research: a thorough, sourced report with more steps and searches. */
  research?: boolean;
  /** Stream replies as they are written (text_delta events). */
  stream?: boolean;
  /** Let the model search the web with the provider's own search tool (billed by the provider). */
  webSearch?: boolean;
  signal: AbortSignal;
  onEvent: (event: AgentEvent) => void;
};

export async function runAgent(opts: AgentOptions): Promise<void> {
  const { turns, signal, onEvent } = opts;
  const provider = getProvider(opts.provider);

  const pauseWhileBackgrounded = async () => {
    if (isForeground()) return;
    onEvent({ type: 'info', text: t('chat.paused') });
    await waitForForeground(signal);
    if (!signal.aborted) onEvent({ type: 'info', text: t('chat.resumed') });
  };

  const sources: Source[] = [];
  const addSource = (source: Source) => {
    if (!/^https?:\/\//i.test(source.url) || sources.length >= MAX_SOURCES) return;
    const key = source.url.split('#')[0];
    if (!sources.some((s) => s.url.split('#')[0] === key)) sources.push(source);
  };
  const noteSource = () => {
    const tab = opts.browser.getTab(opts.agentTab.id);
    if (tab) addSource({ url: tab.url, title: tab.title, incognito: tab.incognito });
  };
  let searchWidget: string | undefined;
  const flushSources = () => {
    if (sources.length || searchWidget) onEvent({ type: 'sources', sources: sources.splice(0), searchWidget });
    searchWidget = undefined;
  };

  const maxSteps = opts.research ? MAX_RESEARCH_STEPS : MAX_STEPS;
  for (let step = 0; step < maxSteps; step++) {
    await pauseWhileBackgrounded();
    if (signal.aborted) return;

    let streamed = false;
    const reply = await provider.call({
      apiKey: opts.apiKey,
      model: opts.model,
      system: await systemPrompt(opts),
      tools: opts.memory ? [...TOOLS, ...MEMORY_TOOLS] : TOOLS,
      webSearch: !!opts.webSearch,
      research: opts.research,
      onText: opts.stream
        ? (delta) => {
            streamed = true;
            onEvent({ type: 'text_delta', text: delta });
          }
        : undefined,
      turns: compactHistory(turns),
      signal,
    });
    turns.push({
      role: 'assistant',
      text: reply.text,
      toolCalls: reply.toolCalls,
      raw: reply.raw,
      rawProvider: provider.id,
      rawModel: opts.model,
    });
    if (reply.searchWidget) searchWidget = reply.searchWidget;
    reply.searches.forEach((query) => onEvent({ type: 'action', text: t('action.webSearch', { query }) }));
    // Pages found by web search open in the conversation's own mode.
    reply.citations.forEach((c) =>
      addSource({ url: c.url, title: c.title, incognito: !!opts.privacy?.touchedIncognito }),
    );
    // After streaming, the final text replaces what was shown (an empty one removes it).
    if (reply.text || streamed) onEvent({ type: 'text', text: reply.text });
    // A long web search was paused by the provider; sending the reply back continues it.
    if (reply.stop === 'pause') continue;

    if (reply.stop !== 'tool_use') {
      // A reply cut off mid-call can still contain tool calls; every call needs a result before the next request.
      if (reply.toolCalls.length > 0) {
        turns.push({
          role: 'tool_results',
          results: reply.toolCalls.map((c) => ({
            callId: c.id,
            name: c.name,
            content: 'Not executed: the response was cut off.',
            isError: true,
          })),
        });
      }
      flushSources();
      if (reply.stop === 'max_tokens') onEvent({ type: 'error', text: t('chat.maxTokens') });
      if (reply.stop === 'refusal') onEvent({ type: 'error', text: t('chat.refusal') });
      return;
    }

    const results: ToolResult[] = [];
    let waitingForUser = false;
    for (const call of reply.toolCalls) {
      if (waitingForUser) {
        results.push({
          callId: call.id,
          name: call.name,
          content: "Not executed: waiting for the user's answer.",
          isError: true,
        });
        continue;
      }
      if (call.name === 'ask_user') {
        const choices = parseChoices(call.input);
        if (!choices) {
          results.push({
            callId: call.id,
            name: call.name,
            content: 'Give a question and 2 to 8 options.',
            isError: true,
          });
          continue;
        }
        flushSources();
        onEvent({ type: 'choices', text: choices.question, options: choices.options });
        results.push({
          callId: call.id,
          name: call.name,
          content: 'The options are shown to the user as buttons. Their answer will arrive as the next user message.',
          isError: false,
        });
        waitingForUser = true;
        continue;
      }
      if (signal.aborted) {
        results.push({ callId: call.id, name: call.name, content: 'Stopped by the user.', isError: true });
        continue;
      }
      await pauseWhileBackgrounded();
      onEvent({ type: 'action', text: describeToolCall(call.name, call.input) });
      const backgroundsBefore = getBackgroundCount();
      let result = await executeTool(call.name, call.input, opts);
      // The WebView freezes in the background, so a failure there is retried once after resuming.
      // Only read-only tools: a frozen click may still run on resume, and repeating it would act twice.
      const backgrounded = getBackgroundCount() !== backgroundsBefore;
      if (result.isError && backgrounded && SAFE_TO_RETRY.has(call.name) && !signal.aborted) {
        await pauseWhileBackgrounded();
        result = await executeTool(call.name, call.input, opts);
      }
      if (result.isError) onEvent({ type: 'error', text: result.content.slice(0, 200) });
      else if (READING_TOOLS.has(call.name)) noteSource();
      else if (call.name === 'read_tab') {
        const read = opts.browser.getTab(String(call.input.tab_id ?? ''));
        if (read) addSource({ url: read.url, title: read.title, incognito: read.incognito });
      }
      results.push({
        callId: call.id,
        name: call.name,
        content: result.content,
        isError: result.isError,
        images: result.images,
      });
    }
    turns.push({ role: 'tool_results', results });
    // The run ends with the question; the user's answer starts the next one.
    if (waitingForUser) return;
  }

  onEvent({ type: 'error', text: t('chat.stepLimit', { max: maxSteps }) });
}

const MAX_CHOICES = 8;

/** Validates ask_user input: a question and 2–8 distinct, non-empty options. */
export function parseChoices(input: Record<string, unknown>): { question: string; options: string[] } | null {
  const question = typeof input.question === 'string' ? input.question.trim() : '';
  const raw = Array.isArray(input.options) ? input.options : [];
  const options = [...new Set(raw.map((o) => (typeof o === 'string' ? o.trim().slice(0, 120) : '')).filter(Boolean))];
  if (!question || options.length < 2) return null;
  return { question: question.slice(0, 500), options: options.slice(0, MAX_CHOICES) };
}

const WEB_SEARCH_PROMPT = `

Web search:
- You can search the web with your built-in web search. Use it for facts, news, prices and other current information, or to find which site to open. It is faster than navigating to a search engine page.
- Use the browser tools instead when the user asks about the page they are on, or when you need to act on a site (log in, fill in, click, buy).
- Cite the pages you used; they are shown to the user as sources.`;

const RESEARCH_PROMPT = `

Deep research mode: the user wants a thorough, well-sourced report. Work like a careful researcher:
1. Break the question into 3 to 6 sub-questions and mention them briefly.
2. Search with several different queries (other languages too when useful). Open the most relevant primary sources with open_tab and read them with read_page or read_tab instead of relying on search snippets. Close the tabs you opened when you are done.
3. Check important facts in at least two independent sources; point out disagreements and how recent each source is.
4. Write the report in Markdown: a short summary first, then a section per sub-question, a comparison table when it helps, and caveats or open questions. Cite sources inline as [1], [2] and list them at the end as numbered links.
Take as many steps as you need, but stop searching once new sources add nothing. Write in the user's language; this report may be long.`;

/** The base prompt plus what is remembered about the user, re-read every step since the agent may change it. */
async function systemPrompt(opts: AgentOptions): Promise<string> {
  const search = (opts.webSearch ? WEB_SEARCH_PROMPT : '') + (opts.research ? RESEARCH_PROMPT : '');
  if (!opts.memory) return SYSTEM_PROMPT + search;
  const memories = await opts.memory.list().catch(() => []);
  return SYSTEM_PROMPT + search + memoryPrompt(memories, !opts.privacy?.touchedIncognito);
}

/**
 * Page snapshots are large. Keep only the most recent ones in full so long
 * sessions don't blow up cost and latency. With OpenAI this changes the
 * history prefix, so the API may drop older reasoning; that trade-off is accepted.
 */
export function compactHistory(turns: Turn[]): Turn[] {
  let kept = 0;
  let keptImages = 0;
  const out: Turn[] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn.role !== 'tool_results') {
      out.unshift(turn);
      continue;
    }
    const results = [...turn.results].reverse().map((original) => {
      let r = original;
      // Screenshots cost far more than text, so only the latest ones are kept.
      if (r.images?.length) {
        if (keptImages < KEEP_IMAGES) keptImages++;
        else r = { ...r, images: undefined, content: `${r.content}\n[Older screenshot removed]` };
      }
      if (r.content.length <= COMPACT_THRESHOLD) return r;
      if (kept < KEEP_FULL_RESULTS) {
        kept++;
        return r;
      }
      return { ...r, content: `${r.content.slice(0, 300)}\n[Older page snapshot removed]` };
    });
    out.unshift({ role: 'tool_results', results: results.reverse() });
  }
  return out;
}
