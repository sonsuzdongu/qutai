import type { ToolDefinition } from '../agent/types';

export type ProviderId = 'anthropic' | 'openai' | 'gemini';

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

export type ToolResult = { callId: string; name: string; content: string; isError: boolean };

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

export type StopReason = 'tool_use' | 'end' | 'max_tokens' | 'refusal';

export type ModelReply = {
  text: string;
  toolCalls: ToolCall[];
  stop: StopReason;
  raw: unknown;
};

export type ModelRequest = {
  apiKey: string;
  model: string;
  system: string;
  tools: ToolDefinition[];
  turns: Turn[];
  signal: AbortSignal;
};

export type Provider = {
  id: ProviderId;
  label: string;
  keyPlaceholder: string;
  keyUrl: string;
  models: { id: string; label: string }[];
  defaultModel: string;
  call: (req: ModelRequest) => Promise<ModelReply>;
};

/** Raw output can only be replayed to the provider and model family that produced it. */
export function canReplay(turn: Extract<Turn, { role: 'assistant' }>, provider: ProviderId, model: string) {
  return turn.rawProvider === provider && turn.rawModel === model && turn.raw != null;
}
