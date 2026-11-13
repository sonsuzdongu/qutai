import type { ToolDefinition } from '../agent/types';

export type ProviderId = 'anthropic' | 'openai' | 'gemini';

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

export type ToolImage = { mediaType: 'image/jpeg' | 'image/png'; data: string };

export type ToolResult = {
  callId: string;
  name: string;
  content: string;
  isError: boolean;
  /** Base64 images returned alongside the text, e.g. page screenshots. */
  images?: ToolImage[];
};

/**
 * Provider-neutral conversation history. Assistant turns also keep the
 * provider's raw output (thinking blocks, encrypted reasoning, thought
 * signatures), which must be sent back unchanged to the same provider.
 */
export type Turn =
  | { role: 'user'; text: string }
  | {
      role: 'assistant';
      text: string;
      toolCalls: ToolCall[];
      raw: unknown;
      rawProvider: ProviderId;
      rawModel: string;
    }
  | { role: 'tool_results'; results: ToolResult[] };

/** 'pause': the provider paused a long server-side step (web search); send the reply back to continue. */
export type StopReason = 'tool_use' | 'end' | 'max_tokens' | 'refusal' | 'pause';

/** A web page the answer cites, from the provider's own web search. */
export type Citation = { url: string; title: string };

export type ModelReply = {
  text: string;
  toolCalls: ToolCall[];
  stop: StopReason;
  raw: unknown;
  /** Pages cited from the provider's web search. */
  citations: Citation[];
  /** Queries the provider searched the web for during this reply. */
  searches: string[];
};

export type ModelRequest = {
  apiKey: string;
  model: string;
  system: string;
  tools: ToolDefinition[];
  /** Let the model search the web with the provider's built-in search tool. */
  webSearch: boolean;
  turns: Turn[];
  signal: AbortSignal;
};

export type ModelTag = 'recommended' | 'fastest' | 'strongest';

export type Provider = {
  id: ProviderId;
  label: string;
  keyPlaceholder: string;
  keyUrl: string;
  models: { id: string; name: string; tag?: ModelTag }[];
  defaultModel: string;
  call: (req: ModelRequest) => Promise<ModelReply>;
};

/** Raw output can only be replayed to the provider and model family that produced it. */
export function canReplay(turn: Extract<Turn, { role: 'assistant' }>, provider: ProviderId, model: string) {
  return turn.rawProvider === provider && turn.rawModel === model && turn.raw != null;
}
