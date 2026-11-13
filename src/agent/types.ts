export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'action'; text: string }
  | { type: 'info'; text: string }
  | { type: 'error'; text: string }
  /** The agent asks the user to pick one of these options; the run ends until they answer. */
  | { type: 'choices'; text: string; options: string[] };
