export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'action'; text: string }
  | { type: 'info'; text: string }
  | { type: 'error'; text: string };
