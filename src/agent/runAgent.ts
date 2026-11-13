import { getBackgroundCount, isForeground, waitForForeground } from '../utils/foreground';
import { sleep } from '../utils/sleep';
import { describeToolCall, executeTool, ToolContext } from './executeTool';
import { SYSTEM_PROMPT } from './systemPrompt';
import { TOOLS } from './tools';
import type { AgentEvent, ApiResponse, ContentBlock, Message, ToolResultBlock, ToolUseBlock } from './types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_STEPS = 40;
const KEEP_FULL_RESULTS = 2;
const COMPACT_THRESHOLD = 1500;
const SAFE_TO_RETRY = new Set(['read_page', 'list_tabs', 'scroll', 'scroll_to', 'wait']);

export type AgentOptions = ToolContext & {
  apiKey: string;
  model: string;
  /** Conversation history; new messages are appended in place. */
  messages: Message[];
  signal: AbortSignal;
  onEvent: (event: AgentEvent) => void;
};

export async function runAgent(opts: AgentOptions): Promise<void> {
  const { messages, signal, onEvent } = opts;

  const pauseWhileBackgrounded = async () => {
    if (isForeground()) return;
    onEvent({ type: 'info', text: '⏸ Uygulama arka planda, görev duraklatıldı' });
    await waitForForeground(signal);
    if (!signal.aborted) onEvent({ type: 'info', text: '▶️ Devam ediliyor' });
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    await pauseWhileBackgrounded();
    if (signal.aborted) return;

    const response = await callClaude(opts.apiKey, opts.model, compactHistory(messages), signal);
    messages.push({ role: 'assistant', content: response.content });

    for (const block of response.content) {
      if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
        onEvent({ type: 'text', text: block.text.trim() });
      }
    }

    if (response.stop_reason === 'max_tokens') {
      onEvent({ type: 'error', text: 'Yanıt uzunluk sınırına ulaştı.' });
      return;
    }
    if (response.stop_reason === 'refusal') {
      onEvent({ type: 'error', text: 'Claude bu isteği yerine getirmeyi reddetti.' });
      return;
    }
    if (response.stop_reason !== 'tool_use') return;

    const toolUses = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
    const results: ToolResultBlock[] = [];
    for (const use of toolUses) {
      if (signal.aborted) {
        // Every tool_use needs a matching tool_result, even when we stop early.
        results.push({ type: 'tool_result', tool_use_id: use.id, content: 'Stopped by the user.', is_error: true });
        continue;
      }
      await pauseWhileBackgrounded();
      onEvent({ type: 'action', text: describeToolCall(use.name, use.input) });
      const backgroundsBefore = getBackgroundCount();
      let result = await executeTool(use.name, use.input, opts);
      // The WebView freezes in the background, so a failure there is retried once after resuming.
      // Only read-only tools: a frozen click may still run on resume, and repeating it would act twice.
      const backgrounded = getBackgroundCount() !== backgroundsBefore;
      if (result.isError && backgrounded && SAFE_TO_RETRY.has(use.name) && !signal.aborted) {
        await pauseWhileBackgrounded();
        result = await executeTool(use.name, use.input, opts);
      }
      if (result.isError) onEvent({ type: 'error', text: result.content.slice(0, 200) });
      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: result.content,
        is_error: result.isError || undefined,
      });
    }
    messages.push({ role: 'user', content: results });
  }

  onEvent({ type: 'error', text: `Adım sınırına (${MAX_STEPS}) ulaşıldı. Devam etmek için tekrar yazabilirsiniz.` });
}

async function callClaude(
  apiKey: string,
  model: string,
  messages: Message[],
  signal: AbortSignal,
): Promise<ApiResponse> {
  const body = JSON.stringify({
    model,
    max_tokens: 8192,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: TOOLS,
    messages,
  });

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body,
        signal,
      });
    } catch (e) {
      // Requests are often cut off when the OS suspends the app; retry once we are back.
      if (signal.aborted || attempt >= 3) throw e;
      await waitForForeground(signal);
      await sleep(1000 * 2 ** attempt);
      continue;
    }

    if (res.ok) return (await res.json()) as ApiResponse;

    const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
    if (retryable && attempt < 3) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }

    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message ?? '';
    } catch {}
    throw new Error(`API hatası ${res.status}${detail ? `: ${detail}` : ''}`);
  }
}

/**
 * Page snapshots are large. Keep only the most recent ones in full so long
 * sessions don't blow up cost and latency.
 */
function compactHistory(messages: Message[]): Message[] {
  let kept = 0;
  const out: Message[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user' || typeof msg.content === 'string') {
      out.unshift(msg);
      continue;
    }
    const content = msg.content.map((block): ContentBlock => {
      if (block.type !== 'tool_result') return block;
      const result = block as ToolResultBlock;
      if (result.content.length <= COMPACT_THRESHOLD) return result;
      if (kept < KEEP_FULL_RESULTS) {
        kept++;
        return result;
      }
      return { ...result, content: `${result.content.slice(0, 300)}\n[Older page snapshot removed]` };
    });
    out.unshift({ ...msg, content });
  }
  return out;
}
