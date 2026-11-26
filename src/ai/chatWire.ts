/**
 * The OpenAI Chat Completions wire format, as OpenRouter and "OpenAI-compatible" servers speak it: request
 * messages built from the provider-neutral turns, the request body, a stream accumulator that rebuilds the
 * assistant message from its chunks, and the reply. Pure and without dependencies (types only), so it can be
 * exercised outside the app against documentation examples; chatCompletions.ts does the network side.
 *
 * - Messages and tools: OpenAI's Chat Completions reference (openai-openapi, ChatCompletionRequest*Message).
 *   A `tool` message carries text only ("For tool messages, only type `text` is supported"), so images a tool
 *   returned (screenshots) follow the tool messages as one user message with `image_url` parts (base64 data
 *   URLs), the usual pattern for this format. Images the user attached go in the user message the same way.
 * - Streaming: `choices[0].delta` with `content`, and `tool_calls` whose `function.arguments` arrive as string
 *   fragments keyed by `index` (the `id` and name come with the first fragment); `finish_reason` at the end;
 *   OpenRouter adds `reasoning_details` deltas, a final usage chunk, and reports errors mid-stream as a chunk
 *   with a top-level `error` and `finish_reason: "error"` (https://openrouter.ai/docs/api_reference/streaming).
 * - Reasoning: OpenRouter returns `reasoning_details` with the assistant message and asks for them back
 *   unmodified, in order, with the tool calls they led to (https://openrouter.ai/docs/use-cases/reasoning-tokens,
 *   "Preserving reasoning"). They are kept in the turn's raw message and replayed only to the same provider and
 *   model; anywhere else the turn is rebuilt from its text and tool calls.
 */

import type { ToolDefinition } from '../agent/types';
import { chatUsage } from './usage';
// Types marked as such, so Node can run this file with its type stripping (scripts/cost-tests/).
import { canReplay, type Citation, type ModelReply, type ProviderId, type StopReason, type ToolCall, type Turn } from './types';

type Obj = Record<string, unknown>;

export type ChatToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };

export type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ChatContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: ChatToolCall[]; reasoning_details?: Obj[] }
  | { role: 'tool'; tool_call_id: string; content: string };

/** The assistant message as kept in a turn's raw output (only what is sent back). */
export type RawChatMessage = Extract<ChatMessage, { role: 'assistant' }>;

export type ChatUsage = { prompt_tokens?: number; completion_tokens?: number; [key: string]: unknown };

/** What a request or a stream comes down to. */
export type ChatResult = {
  message: RawChatMessage & { annotations?: Obj[]; refusal?: string | null };
  finishReason: string | null;
  usage?: ChatUsage;
};

/** The provider reported an error inside a 200 response or stream; `status` is its HTTP-style code. */
export class ChatStreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ChatStreamError';
  }
}

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

function pushUser(messages: ChatMessage[], content: string | ChatContentPart[]) {
  const last = messages[messages.length - 1];
  if (last?.role !== 'user') {
    messages.push({ role: 'user', content });
    return;
  }
  // Two user messages in a row (an interrupted run, images after tool results): merged, since some
  // compatible servers' chat templates expect alternating roles.
  if (typeof last.content === 'string' && typeof content === 'string') {
    last.content = `${last.content}\n\n${content}`;
    return;
  }
  const parts = (c: string | ChatContentPart[]): ChatContentPart[] => (typeof c === 'string' ? [{ type: 'text', text: c }] : c);
  last.content = [...parts(last.content), ...parts(content)];
}

/** Turns to Chat Completions messages; raw assistant messages are replayed to the provider and model that wrote them. */
export function toChatMessages(system: string, turns: Turn[], provider: ProviderId, model: string): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: system }];
  for (const turn of turns) {
    if (turn.role === 'user') {
      pushUser(
        messages,
        turn.images?.length
          ? [
              { type: 'text', text: turn.text },
              ...turn.images.map(
                (img): ChatContentPart => ({ type: 'image_url', image_url: { url: `data:${img.mediaType};base64,${img.data}` } }),
              ),
            ]
          : turn.text,
      );
    } else if (turn.role === 'tool_results') {
      const images: ChatContentPart[] = [];
      for (const r of turn.results) {
        messages.push({ role: 'tool', tool_call_id: r.callId, content: r.isError ? `[error] ${r.content}` : r.content });
        if (r.images?.length) {
          images.push({ type: 'text', text: `Image returned by ${r.name} (call ${r.callId}):` });
          r.images.forEach((img) =>
            images.push({ type: 'image_url', image_url: { url: `data:${img.mediaType};base64,${img.data}` } }),
          );
        }
      }
      if (images.length) pushUser(messages, images);
    } else if (canReplay(turn, provider, model) && isObj(turn.raw)) {
      // reasoning_details go back unmodified, with the content and tool calls they came with.
      const raw = turn.raw as RawChatMessage;
      messages.push({
        role: 'assistant',
        content: raw.content ?? null,
        ...(raw.tool_calls?.length ? { tool_calls: raw.tool_calls } : {}),
        ...(raw.reasoning_details?.length ? { reasoning_details: raw.reasoning_details } : {}),
      });
    } else {
      messages.push(rebuiltAssistant(turn));
    }
  }
  return messages;
}

function rebuiltAssistant(turn: Extract<Turn, { role: 'assistant' }>): RawChatMessage {
  return {
    role: 'assistant',
    content: turn.text || null,
    ...(turn.toolCalls.length
      ? {
          tool_calls: turn.toolCalls.map((c) => ({
            id: c.id,
            type: 'function' as const,
            function: { name: c.name, arguments: JSON.stringify(c.input) },
          })),
        }
      : {}),
  };
}

/** Whether a request would replay any reasoning details (they are what a provider may reject). */
export function replaysReasoning(turns: Turn[], provider: ProviderId, model: string): boolean {
  return turns.some(
    (turn) =>
      turn.role === 'assistant' &&
      canReplay(turn, provider, model) &&
      isObj(turn.raw) &&
      Array.isArray((turn.raw as RawChatMessage).reasoning_details) &&
      ((turn.raw as RawChatMessage).reasoning_details?.length ?? 0) > 0,
  );
}

export type ChatBodyOptions = {
  model: string;
  system: string;
  tools: ToolDefinition[];
  turns: Turn[];
  provider: ProviderId;
  stream: boolean;
  /** Output limit, and the field it goes in ('max_tokens' is the one most compatible servers know). */
  maxTokens?: { field: 'max_tokens' | 'max_completion_tokens'; value: number };
  /** Ask for the usage chunk at the end of a stream (OpenAI's `stream_options.include_usage`). */
  streamUsage?: boolean;
};

export function buildChatBody(o: ChatBodyOptions): Obj {
  return {
    model: o.model,
    messages: toChatMessages(o.system, o.turns, o.provider, o.model),
    // tool_choice is left out: "auto" is the default, and some compatible servers (Ollama) reject the field.
    // An empty list is left out: OpenAI's schema requires at least one tool when the field is present.
    ...(o.tools.length
      ? {
          tools: o.tools.map((t) => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.input_schema },
          })),
        }
      : {}),
    ...(o.maxTokens ? { [o.maxTokens.field]: o.maxTokens.value } : {}),
    ...(o.stream ? { stream: true } : {}),
    ...(o.stream && o.streamUsage ? { stream_options: { include_usage: true } } : {}),
  };
}

/**
 * Merges streamed reasoning details: entries with the same `index` are pieces of one detail, whose text,
 * summary, encrypted data and signature arrive in order and are concatenated; other fields are taken from the
 * first piece that has them. Entries without an index are separate details.
 */
function mergeReasoning(into: Obj[], pieces: unknown[]) {
  for (const piece of pieces) {
    if (!isObj(piece)) continue;
    const index = typeof piece.index === 'number' ? piece.index : undefined;
    const existing = index === undefined ? undefined : into.find((d) => d.index === index);
    if (!existing) {
      into.push({ ...piece });
      continue;
    }
    for (const [key, value] of Object.entries(piece)) {
      if (value == null) continue;
      if ((key === 'text' || key === 'summary' || key === 'data' || key === 'signature') && typeof value === 'string')
        existing[key] = typeof existing[key] === 'string' ? existing[key] + value : value;
      else if (existing[key] == null) existing[key] = value;
    }
  }
}

/**
 * Rebuilds the assistant message from stream chunks. `push` returns the text the chunk adds (to show as it
 * arrives) and throws ChatStreamError for an error chunk; `finish` returns the result once the stream ended.
 */
export function createChatAccumulator() {
  let content = '';
  let refusal = '';
  const calls: { id: string; name: string; arguments: string }[] = [];
  const reasoning: Obj[] = [];
  const annotations: Obj[] = [];
  let finishReason: string | null = null;
  let usage: ChatUsage | undefined;
  let chunks = 0;

  return {
    push(chunk: unknown): string {
      if (!isObj(chunk)) return '';
      chunks++;
      if (isObj(chunk.error)) {
        const e = chunk.error;
        throw new ChatStreamError(
          typeof e.message === 'string' ? e.message : 'Stream error',
          typeof e.code === 'number' ? e.code : undefined,
        );
      }
      if (isObj(chunk.usage)) usage = chunk.usage as ChatUsage;
      const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
      if (!isObj(choice)) return '';
      if (typeof choice.finish_reason === 'string') finishReason = choice.finish_reason;
      const delta = isObj(choice.delta) ? choice.delta : {};
      if (Array.isArray(delta.reasoning_details)) mergeReasoning(reasoning, delta.reasoning_details);
      if (Array.isArray(delta.annotations)) annotations.push(...delta.annotations.filter(isObj));
      if (typeof delta.refusal === 'string') refusal += delta.refusal;
      if (Array.isArray(delta.tool_calls)) {
        for (const d of delta.tool_calls) {
          if (!isObj(d)) continue;
          const index = typeof d.index === 'number' ? d.index : calls.length;
          const call = (calls[index] ??= { id: '', name: '', arguments: '' });
          if (typeof d.id === 'string' && d.id) call.id = d.id;
          const fn = isObj(d.function) ? d.function : {};
          if (typeof fn.name === 'string' && fn.name && !call.name) call.name = fn.name;
          if (typeof fn.arguments === 'string') call.arguments += fn.arguments;
        }
      }
      if (typeof delta.content === 'string' && delta.content) {
        content += delta.content;
        return delta.content;
      }
      return '';
    },
    finish(): ChatResult {
      if (chunks === 0) throw new ChatStreamError('The response ended unexpectedly');
      const toolCalls = calls.filter(Boolean).map((c, i) => ({
        id: c.id || `call_${i}_${chunks}`,
        type: 'function' as const,
        function: { name: c.name, arguments: c.arguments },
      }));
      return {
        message: {
          role: 'assistant',
          content: content || null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
          ...(reasoning.length ? { reasoning_details: reasoning } : {}),
          ...(annotations.length ? { annotations } : {}),
          ...(refusal ? { refusal } : {}),
        },
        finishReason,
        usage,
      };
    },
  };
}

/** A non-streamed response body to the same result a stream ends in. */
export function fromChatResponse(res: unknown): ChatResult {
  if (!isObj(res)) throw new ChatStreamError('The response was empty');
  if (isObj(res.error)) {
    const e = res.error;
    throw new ChatStreamError(
      typeof e.message === 'string' ? e.message : 'The request failed',
      typeof e.code === 'number' ? e.code : undefined,
    );
  }
  const choice = Array.isArray(res.choices) ? res.choices[0] : undefined;
  if (!isObj(choice) || !isObj(choice.message)) throw new ChatStreamError('The response had no message');
  const m = choice.message;
  let content: string | null = null;
  if (typeof m.content === 'string') content = m.content;
  else if (Array.isArray(m.content))
    content = m.content
      .map((p) => (isObj(p) && typeof p.text === 'string' ? p.text : ''))
      .join('') || null;
  const toolCalls = (Array.isArray(m.tool_calls) ? m.tool_calls : []).filter(isObj).map((c, i) => {
    const fn = isObj(c.function) ? c.function : {};
    const args = fn.arguments;
    return {
      id: typeof c.id === 'string' && c.id ? c.id : `call_${i}`,
      type: 'function' as const,
      function: {
        name: typeof fn.name === 'string' ? fn.name : '',
        // Some servers send the arguments as an object rather than JSON text.
        arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}),
      },
    };
  });
  const reasoning = Array.isArray(m.reasoning_details) ? m.reasoning_details.filter(isObj) : [];
  const annotations = Array.isArray(m.annotations) ? m.annotations.filter(isObj) : [];
  return {
    message: {
      role: 'assistant',
      content,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      ...(reasoning.length ? { reasoning_details: reasoning } : {}),
      ...(annotations.length ? { annotations } : {}),
      ...(typeof m.refusal === 'string' && m.refusal ? { refusal: m.refusal } : {}),
    },
    finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : null,
    usage: isObj(res.usage) ? (res.usage as ChatUsage) : undefined,
  };
}

/** A tool call's arguments; null when the text is not JSON, i.e. the reply was cut off in the middle of the call. */
function parseArguments(raw: string): Record<string, unknown> | null {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return isObj(parsed) ? parsed : {};
  } catch {
    return null;
  }
}

/**
 * The result to the app's reply; the raw output is the assistant message without annotations or refusal. `provider`
 * decides how the usage is read (only OpenRouter's reported cost is used).
 */
export function toChatReply(result: ChatResult, provider: ProviderId = 'custom'): ModelReply {
  const { message, finishReason } = result;
  if (finishReason === 'error') throw new ChatStreamError('The provider reported an error');
  // Half a call's arguments means the reply was cut off (a length limit the server didn't report, a stream that broke
  // without an error): no call of that reply is run with empty input; runAgent answers each "Not executed".
  let cutOff = false;
  const toolCalls: ToolCall[] = (message.tool_calls ?? []).map((c) => {
    const input = parseArguments(c.function.arguments);
    if (!input) cutOff = true;
    return { id: c.id, name: c.function.name, input: input ?? {} };
  });
  const citations: Citation[] = [];
  for (const a of message.annotations ?? []) {
    if (a.type !== 'url_citation') continue;
    // OpenAI and OpenRouter nest the fields under url_citation.
    const c = isObj(a.url_citation) ? a.url_citation : a;
    if (typeof c.url === 'string') citations.push({ url: c.url, title: typeof c.title === 'string' ? c.title : '' });
  }
  let stop: StopReason = toolCalls.length > 0 ? 'tool_use' : 'end';
  if (finishReason === 'length' || cutOff) stop = 'max_tokens';
  if (finishReason === 'content_filter' || message.refusal) stop = 'refusal';
  const raw: RawChatMessage = {
    role: 'assistant',
    content: message.content,
    ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
    ...(message.reasoning_details ? { reasoning_details: message.reasoning_details } : {}),
  };
  const usage = chatUsage(result.usage, provider);
  return {
    text: (message.content ?? '').trim() || (message.refusal ?? '').trim(),
    toolCalls,
    stop,
    raw,
    citations,
    searches: [],
    ...(usage ? { usage } : {}),
  };
}
