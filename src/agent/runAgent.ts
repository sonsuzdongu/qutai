import { getProvider } from '../ai/providers';
import type { ProviderId, ToolResult, Turn } from '../ai/types';
import { t } from '../i18n';
import { getBackgroundCount, isForeground, waitForForeground } from '../utils/foreground';
import { describeToolCall, executeTool, ToolContext } from './executeTool';
import { SYSTEM_PROMPT } from './systemPrompt';
import { memoryPrompt } from './memory';
import { MEMORY_TOOLS, TOOLS } from './tools';
import type { AgentEvent } from './types';

const MAX_STEPS = 40;
const KEEP_FULL_RESULTS = 2;
const KEEP_IMAGES = 1;
const COMPACT_THRESHOLD = 1500;
const SAFE_TO_RETRY = new Set(['read_page', 'view_screenshot', 'list_tabs', 'scroll', 'scroll_to', 'wait']);

export type AgentOptions = ToolContext & {
  provider: ProviderId;
  apiKey: string;
  model: string;
  /** Conversation history; new turns are appended in place. */
  turns: Turn[];
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

  for (let step = 0; step < MAX_STEPS; step++) {
    await pauseWhileBackgrounded();
    if (signal.aborted) return;

    const reply = await provider.call({
      apiKey: opts.apiKey,
      model: opts.model,
      system: await systemPrompt(opts),
      tools: opts.memory ? [...TOOLS, ...MEMORY_TOOLS] : TOOLS,
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
    if (reply.text) onEvent({ type: 'text', text: reply.text });

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
      if (reply.stop === 'max_tokens') onEvent({ type: 'error', text: t('chat.maxTokens') });
      if (reply.stop === 'refusal') onEvent({ type: 'error', text: t('chat.refusal') });
      return;
    }

    const results: ToolResult[] = [];
    for (const call of reply.toolCalls) {
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
      results.push({
        callId: call.id,
        name: call.name,
        content: result.content,
        isError: result.isError,
        images: result.images,
      });
    }
    turns.push({ role: 'tool_results', results });
  }

  onEvent({ type: 'error', text: t('chat.stepLimit', { max: MAX_STEPS }) });
}

/** The base prompt plus what is remembered about the user, re-read every step since the agent may change it. */
async function systemPrompt(opts: AgentOptions): Promise<string> {
  if (!opts.memory) return SYSTEM_PROMPT;
  const memories = await opts.memory.list().catch(() => []);
  return SYSTEM_PROMPT + memoryPrompt(memories, !opts.privacy?.touchedIncognito);
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
