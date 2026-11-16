import { AnswerCost, createAnswerMeter, failedRequestCost } from '../ai/cost';
import type { CustomHeader } from '../ai/customHeaders';
import { getProvider } from '../ai/providers';
import { RelayError } from '../credits/errors';
import { continueAfterPause } from '../credits/pause';
import type { RelayPause } from '../credits/types';
import { droppedImageNote, KEEP_IMAGE_MESSAGES, MAX_SENT_IMAGES } from '../chat/attachments';
import type { ProviderId, ToolResult, Turn } from '../ai/types';
import { t } from '../i18n';
import {
  forbidBackground,
  getBackgroundPauseCount,
  isRunningInBackground,
  noteBackgroundProgress,
  pauseForUser,
  PauseNeed,
  setBackgroundStep,
  takeNeedsForeground,
  whileWaitingForUser,
} from '../device/backgroundTask';
import { getBackgroundCount, isForeground, waitForForeground } from '../utils/foreground';
import type { AlwaysAllowKind } from './alwaysAllow';
import { withAttachedImages } from './attachedImages';
import { backgroundBlocker, describeToolCall, executeTool, ToolContext } from './executeTool';
import { toolIcon, WEB_SEARCH_ICON } from './toolIcons';
import {
  customInstructionsPrompt,
  LAST_STEP_PROMPT,
  RESEARCH_PROMPT,
  SYSTEM_PROMPT,
  WEB_SEARCH_PROMPT,
} from './systemPrompt';
import { memoryPrompt } from './memory';
import { siteKey } from './sitePolicy';
import { stepLine } from './stepLine';
import { MEMORY_TOOLS, TOOLS } from './tools';
import type { AgentEvent, Source } from './types';
import { cutText } from '../utils/wellFormed';

const MAX_STEPS = 40;
// The prompt parts live in systemPrompt.ts (exported to the agent profile for Qutai Credits); re-exported here for
// the screens that show them.
export { LAST_STEP_PROMPT, RESEARCH_PROMPT, WEB_SEARCH_PROMPT };
/** view_screenshot's result for a model without image input. */
export const NO_IMAGE_INPUT =
  "This model can't take images, so no screenshot was taken. Use read_page to see the page's text, links and " +
  'form fields instead, and do not call view_screenshot again in this task.';
/** view_attachment's result for a model without image input. */
export const NO_IMAGE_INPUT_ATTACHMENT =
  "This model can't take images, so the attachment can't be shown. Tell the user to switch to a model that takes " +
  'images (the model under the panel title) if they want you to look at it.';
/** Research reads many pages, so it may take more steps. */
const MAX_RESEARCH_STEPS = 80;
const KEEP_FULL_RESULTS = 2;
const KEEP_IMAGES = 1;
const COMPACT_THRESHOLD = 1500;
/** Tools whose result shows the agent the page's content, which makes the page a source. */
const READING_TOOLS = new Set(['read_page', 'read_source', 'view_screenshot']);
const MAX_SOURCES = 10;
const SAFE_TO_RETRY = new Set([
  'read_page',
  'read_source',
  'read_tab',
  'view_screenshot',
  'view_attachment',
  'read_pdf',
  'list_tabs',
  'scroll',
  'scroll_to',
  'wait',
]);

export type AgentOptions = ToolContext & {
  provider: ProviderId;
  apiKey: string;
  model: string;
  /** Base URL for the custom endpoint. */
  endpoint?: string;
  /** The custom endpoint's extra headers. */
  extraHeaders?: CustomHeader[];
  /** The model takes image input; when false, view_screenshot returns a tool error instead of a screenshot. */
  imageInput?: boolean;
  /** The model's output limit, when the provider's catalogue gives it. */
  maxOutputTokens?: number;
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
  /** The user's custom instructions from settings; '' or absent for none. */
  customInstructions?: string;
  /**
   * Whether the user allowed a kind of confirmation for good ("Don't ask again", agent/alwaysAllow.ts); read at each
   * confirmation, since Settings can change it during a task. Such a confirmation is skipped, without pausing.
   */
  alwaysAllowed?: (kind: AlwaysAllowKind) => boolean;
  /**
   * Qutai Credits: the server's limits for one message (steps; research steps) and for the memory section. The
   * server adds the last-step note on its own last step, so the loop must end exactly there.
   */
  serverLimits?: { maxSteps?: number; maxResearchSteps?: number; maxMemoryChars?: number; maxImages?: number };
  /** For the "What was sent to the AI" log; read before each request, since both can change during a task. */
  audit: { conversation: () => string; incognito: () => boolean };
  /**
   * When the task ends (however it ends): the tokens and approximate cost of all its requests, or null when none
   * went out (ai/cost.ts).
   */
  onCost?: (cost: AnswerCost | null) => void;
};

/** Runs one task: the agent's steps, then the cost of all its requests. */
export async function runAgent(opts: AgentOptions): Promise<void> {
  const meter = createAnswerMeter(opts.provider, opts.model);
  try {
    await runSteps(opts, meter);
  } finally {
    opts.onCost?.(meter.result());
  }
}

async function runSteps(opts: AgentOptions, meter: ReturnType<typeof createAnswerMeter>): Promise<void> {
  const { turns, signal, onEvent } = opts;
  const provider = getProvider(opts.provider);

  /**
   * Out of the foreground the task waits for the user to come back, unless it may go on in the background
   * ("Keep working in the background", Android) and the next step (`need` says what it needs otherwise) can run
   * there. A step that needs the user pauses the background run with a notification saying so.
   */
  const pauseWhileBackgrounded = async (need?: PauseNeed) => {
    if (isForeground()) return;
    // Incognito conversations never go on in the background, and nothing from them goes in a notification.
    if (opts.audit.incognito()) forbidBackground();
    const background = isRunningInBackground();
    if (background && !need) return;
    if (background) await pauseForUser(need!);
    onEvent({ type: 'info', icon: 'pause', text: t(background ? 'chat.pausedNeedsYou' : 'chat.paused') });
    await waitForForeground(signal);
    if (!signal.aborted) onEvent({ type: 'info', icon: 'play', text: t('chat.resumed') });
  };
  // A confirmation shown while the app is away would wait unseen: it waits for the user to come back, and leaving
  // while it is open pauses the background run with a notification. Never answered for the user.
  const confirm = opts.confirm;
  const confirmPersonal = opts.confirmPersonal;
  const confirmHidden = opts.confirmHidden;
  const ctx: AgentOptions = {
    ...opts,
    confirm: confirm
      ? async (description, host, kind) => {
          if (kind && opts.alwaysAllowed?.(kind)) return true;
          await pauseWhileBackgrounded('confirm');
          return whileWaitingForUser(() => confirm(description, host, kind));
        }
      : undefined,
    // The personal-information question pauses a background run the same way.
    confirmPersonal: confirmPersonal
      ? async (host, kinds, incognito) => {
          await pauseWhileBackgrounded('confirm');
          return whileWaitingForUser(() => confirmPersonal(host, kinds, incognito));
        }
      : undefined,
    // So does the question before a hidden memory is typed.
    confirmHidden: confirmHidden
      ? async (host, what, field, incognito) => {
          await pauseWhileBackgrounded('confirm');
          return whileWaitingForUser(() => confirmHidden(host, what, field, incognito));
        }
      : undefined,
    // "Allow once" lasts until this task (this message) ends.
    personalGrants: { allowed: new Set(), declined: new Set() },
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

  // The site each tool result came from, for the "What was sent to the AI" log.
  const resultHosts = new Map<string, string>();
  const noteResultHost = (callId: string, url: string | undefined) => {
    const host = url ? siteKey(url) : null;
    if (host) resultHosts.set(callId, host);
  };

  const serverSteps = opts.research ? opts.serverLimits?.maxResearchSteps : opts.serverLimits?.maxSteps;
  const maxSteps = serverSteps ?? (opts.research ? MAX_RESEARCH_STEPS : MAX_STEPS);
  // Qutai Credits: the continuation of the answer that paused in the last step, sent with this one.
  let continuation: RelayPause | null = null;
  const pauseEnds = () => {
    flushSources();
    onEvent({ type: 'info', icon: 'pause', text: t('credits.pauseStopped') });
  };
  for (let step = 0; step < maxSteps; step++) {
    await pauseWhileBackgrounded();
    if (signal.aborted) return;
    // The continuation ran out while the task waited (in the background, for the user): it can't go on.
    if (continuation && continuation.expiresAt <= Date.now()) return pauseEnds();

    let streamed = false;
    setBackgroundStep(t('background.thinking'));
    const prompt = await systemPrompt(opts);
    const sendTurns = await withAttachedImages(compactHistory(turns, opts.serverLimits?.maxImages));
    let reply: Awaited<ReturnType<typeof provider.call>>;
    try {
      reply = await provider.call({
        apiKey: opts.apiKey,
        model: opts.model,
        system: prompt.text + (step === maxSteps - 1 ? LAST_STEP_PROMPT : ''),
        tools: opts.memory ? [...TOOLS, ...MEMORY_TOOLS] : TOOLS,
        webSearch: !!opts.webSearch,
        research: opts.research,
        onText: opts.stream
          ? (delta) => {
              streamed = true;
              noteBackgroundProgress();
              onEvent({ type: 'text_delta', text: delta });
            }
          : undefined,
        turns: sendTurns,
        agent: {
          step,
          ...(prompt.memory ? { memory: prompt.memory.text } : {}),
          ...(opts.customInstructions?.trim() ? { customInstructions: opts.customInstructions } : {}),
          memoryTools: !!opts.memory,
          ...(continuation ? { continuation: continuation.continuation } : {}),
        },
        maxOutputTokens: opts.maxOutputTokens,
        endpoint: opts.endpoint,
        extraHeaders: opts.extraHeaders,
        signal,
        audit: {
          conversation: opts.audit.conversation(),
          incognito: opts.audit.incognito(),
          host: siteKey(opts.browser.getTab(opts.agentTab.id)?.url ?? ''),
          resultHosts,
          memory: prompt.memory,
        },
      });
    } catch (e) {
      // A failed request may still have been billed; its usage is unknown (Qutai Credits says what it charged).
      meter.add(failedRequestCost(e));
      // The server didn't take the continuation (expired, or the turn or options differ): the task ends as it did
      // before continuations, with the note on how to go on.
      if (continuation && e instanceof RelayError && e.kind === 'continuation_invalid' && !signal.aborted) return pauseEnds();
      throw e;
    }
    continuation = null;
    meter.add(reply.cost);
    noteBackgroundProgress();
    const pausedOnCredits = reply.stop === 'pause' && opts.provider === 'qutai';
    turns.push({
      role: 'assistant',
      text: reply.text,
      toolCalls: reply.toolCalls,
      raw: reply.raw,
      rawProvider: provider.id,
      // Qutai Credits: the model that really served it (on a tier, the server picks it), so its raw output goes back
      // only to that model.
      rawModel: reply.served?.model || opts.model,
      ...(reply.streamed ? { streamed: true } : {}),
      ...(reply.served ? { served: reply.served } : {}),
      ...(pausedOnCredits ? { paused: true } : {}),
    });
    if (reply.notice) onEvent({ type: 'info', text: reply.notice });
    if (reply.searchWidget) searchWidget = reply.searchWidget;
    reply.searches.forEach((query) =>
      onEvent({ type: 'action', icon: WEB_SEARCH_ICON, text: t('action.webSearch', { query }), tool: 'web_search' }),
    );
    // Pages found by web search open in the conversation's own mode.
    reply.citations.forEach((c) =>
      addSource({ url: c.url, title: c.title, incognito: !!opts.privacy?.touchedIncognito }),
    );
    // After streaming, the final text replaces what was shown (an empty one removes it).
    if (reply.text || streamed) onEvent({ type: 'text', text: reply.text });
    // A long web search was paused by the provider; sending the reply back continues it. Qutai's relay takes a request
    // that ends with the model's own turn only with the continuation it signed for that turn: the next step sends it.
    // Without one (or past the step limit, or expired) the task stops here and says how to go on.
    if (pausedOnCredits) {
      continuation = continueAfterPause(reply.continuation, step, maxSteps, Date.now());
      if (continuation) continue;
      return pauseEnds();
    }
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
      await pauseWhileBackgrounded(isForeground() ? undefined : (backgroundBlocker(call.name, call.input, ctx) ?? undefined));
      if (signal.aborted) {
        results.push({ callId: call.id, name: call.name, content: 'Stopped by the user.', isError: true });
        continue;
      }
      const action = describeToolCall(call.name, call.input);
      onEvent({ type: 'action', icon: toolIcon(call.name, call.input), text: action, tool: call.name });
      setBackgroundStep(action);
      const backgroundsBefore = getBackgroundCount();
      const pausesBefore = getBackgroundPauseCount();
      takeNeedsForeground();
      const run = (): ReturnType<typeof executeTool> =>
        (call.name === 'view_screenshot' || call.name === 'view_attachment') && opts.imageInput === false
          ? Promise.resolve({
              content: call.name === 'view_attachment' ? NO_IMAGE_INPUT_ATTACHMENT : NO_IMAGE_INPUT,
              isError: true,
            })
          : executeTool(call.name, call.input, ctx);
      let result = await run();
      noteBackgroundProgress();
      // Touched an incognito tab: from now on the task never goes on in the background.
      if (opts.audit.incognito()) forbidBackground();
      if (takeNeedsForeground() && !signal.aborted) {
        // The app went to the background during the step and its tab had no live WebView: nothing ran on the page,
        // so the step runs again once the user is back.
        await pauseWhileBackgrounded('tab');
        if (!signal.aborted) result = await run();
      } else {
        // The WebView freezes in the background (or the background run paused), so a failure there is retried once
        // after resuming. Only read-only tools: a frozen click may still run on resume, and repeating it would act
        // twice.
        const interrupted =
          getBackgroundCount() !== backgroundsBefore || getBackgroundPauseCount() !== pausesBefore;
        if (result.isError && interrupted && SAFE_TO_RETRY.has(call.name) && !signal.aborted) {
          await pauseWhileBackgrounded();
          result = await run();
        }
      }
      // A tab the task reads stays awake while it runs (tab sleeping, memory warnings).
      if (call.name === 'read_tab') opts.browser.keepAwakeForTask(String(call.input.tab_id ?? ''));
      if (call.name === 'read_tab') noteResultHost(call.id, opts.browser.getTab(String(call.input.tab_id ?? ''))?.url);
      else noteResultHost(call.id, opts.browser.getTab(opts.agentTab.id)?.url);
      // The model reads result.content; the user sees a line in the app's language (agent/stepLine.ts).
      const line = stepLine(result);
      if (line) onEvent(line);
      if (!result.isError && READING_TOOLS.has(call.name)) noteSource();
      else if (!result.isError && call.name === 'read_tab') {
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
  const options = [...new Set(raw.map((o) => (typeof o === 'string' ? cutText(o.trim(), 120) : '')).filter(Boolean))];
  if (!question || options.length < 2) return null;
  return { question: cutText(question, 500), options: options.slice(0, MAX_CHOICES) };
}



/**
 * The base prompt plus what is remembered about the user, re-read every step since the agent may change it.
 * The memory section is also returned on its own for the "What was sent to the AI" log.
 */
async function systemPrompt(opts: AgentOptions): Promise<{ text: string; memory?: { text: string; count: number } }> {
  const search = (opts.webSearch ? WEB_SEARCH_PROMPT : '') + (opts.research ? RESEARCH_PROMPT : '');
  // Last, so everything it could conflict with comes before it (its wording puts it below the safety rules).
  const custom = customInstructionsPrompt(opts.customInstructions ?? '');
  if (!opts.memory) return { text: SYSTEM_PROMPT + search + custom };
  const memories = await opts.memory.list().catch(() => []);
  const section = memoryPrompt(memories, !opts.privacy?.touchedIncognito, opts.serverLimits?.maxMemoryChars);
  const count = section.split('\n- [').length - 1;
  return { text: SYSTEM_PROMPT + search + section + custom, memory: { text: section, count } };
}

/**
 * Page snapshots are large. Keep only the most recent ones in full so long
 * sessions don't blow up cost and latency. With OpenAI this changes the
 * history prefix, so the API may drop older reasoning; that trade-off is accepted.
 *
 * Images the user attached stay with the KEEP_IMAGE_MESSAGES most recent user messages (MAX_SENT_IMAGES at most);
 * older ones are taken off the turn and named in its text instead, so the model can still refer to them by id.
 */
export function compactHistory(turns: Turn[], maxImages?: number): Turn[] {
  // A server's limit on images per request (Qutai Credits' maxImages) leaves room for the latest screenshot.
  const userImageCap = maxImages ? Math.max(0, Math.min(MAX_SENT_IMAGES, maxImages - KEEP_IMAGES)) : MAX_SENT_IMAGES;
  let kept = 0;
  let keptImages = 0;
  let userMessages = 0;
  let userImages = 0;
  const out: Turn[] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn.role === 'user') {
      const images = turn.attachments?.filter((a) => a.kind === 'image') ?? [];
      const recent = userMessages++ < KEEP_IMAGE_MESSAGES;
      if (images.length && recent && userImages + images.length <= userImageCap) {
        userImages += images.length;
        out.unshift(turn);
      } else if (images.length) {
        const others = turn.attachments!.filter((a) => a.kind !== 'image');
        const notes = images.map(droppedImageNote).join('\n');
        const compacted = { ...turn, text: `${turn.text}\n${notes}` };
        if (others.length) compacted.attachments = others;
        else delete compacted.attachments;
        out.unshift(compacted);
      } else {
        out.unshift(turn);
      }
      continue;
    }
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
      return { ...r, content: `${cutText(r.content, 300)}\n[Older page snapshot removed]` };
    });
    out.unshift({ role: 'tool_results', results: results.reverse() });
  }
  return out;
}
