export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

/** A page the agent read while answering. */
export type Source = { url: string; title: string; incognito: boolean };

export type AgentEvent =
  | { type: 'text'; text: string }
  /** A piece of the reply being streamed; the complete text follows as a 'text' event. */
  | { type: 'text_delta'; text: string }
  | { type: 'action'; text: string }
  | { type: 'info'; text: string }
  | { type: 'error'; text: string }
  /** The agent asks the user to pick one of these options; the run ends until they answer. */
  | { type: 'choices'; text: string; options: string[] }
  /** Pages read during this task, sent once before the run ends. */
  | { type: 'sources'; sources: Source[] };
