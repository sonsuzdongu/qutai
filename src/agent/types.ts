import type { IconName } from '../ui/Icon';
import type { OptionCard } from '../chat/optionCards';

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
  /** icon: shown before the text in the chat (decorative; the text says the same). */
  /** tool: the tool's name (or 'web_search'), for the finished task's step summary (chat/stepSummary.ts). */
  | { type: 'action'; text: string; icon: IconName; tool?: string }
  | { type: 'info'; text: string; icon?: IconName }
  /** details: the raw text behind the plain sentence, shown on demand. */
  | { type: 'error'; text: string; details?: string }
  /** The agent asks the user to pick one of these options; the run ends until they answer. */
  | { type: 'choices'; text: string; options: string[] }
  /**
   * Options shown as cards (show_options), already checked (chat/optionCards.ts). incognito: the conversation touched
   * an incognito tab, so the pictures wait for "Show images" (UI-26).
   */
  | { type: 'options'; cards: OptionCard[]; incognito: boolean }
  /** Pages read during this task, sent once before the run ends. */
  | { type: 'sources'; sources: Source[]; searchWidget?: string };
