export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type TextBlock = { type: 'text'; text: string };
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
export type ToolResultBlock = {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
// Thinking and other blocks are passed back to the API unchanged.
export type OtherBlock = { type: string; [key: string]: unknown };

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | OtherBlock;

export type Message = {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
};

export type ApiResponse = {
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'refusal' | 'pause_turn' | string;
};

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'action'; text: string }
  | { type: 'info'; text: string }
  | { type: 'error'; text: string };
