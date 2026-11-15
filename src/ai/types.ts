import type { CustomHeader } from './customHeaders';
import type { ToolDefinition } from '../agent/types';
import type { AttachmentInfo } from '../chat/attachments';

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'custom';

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
  | {
      role: 'user';
      text: string;
      /** Files the user attached (manifest only; saved with the history). */
      attachments?: AttachmentInfo[];
      /**
       * The attached images' model copies, set only on the copy of the history a request is built from
       * (runAgent's prepareTurns), never on the saved turns. Adapters send these with the message.
       */
      images?: ToolImage[];
    }
  | {
      role: 'assistant';
      text: string;
      toolCalls: ToolCall[];
      raw: unknown;
      rawProvider: ProviderId;
      rawModel: string;
      /** Rebuilt from a stream (Gemini): if the provider rejects its raw output, it is resent as text and tool calls. */
      streamed?: boolean;
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
  /** Google's search suggestions widget (HTML), which must be shown with answers grounded in Google Search. */
  searchWidget?: string;
  /** The reply came from a stream whose raw output was rebuilt from its events. */
  streamed?: boolean;
  /** A one-line note for the user about how the request went (e.g. streaming was switched off). */
  notice?: string;
};

export type ModelRequest = {
  apiKey: string;
  model: string;
  system: string;
  tools: ToolDefinition[];
  /** Let the model search the web with the provider's built-in search tool. */
  webSearch: boolean;
  /** Deep research: allows more searches and more search context per request. */
  research?: boolean;
  turns: Turn[];
  signal: AbortSignal;
  /** When set, the reply is streamed and text arrives here piece by piece (providers that support it). */
  onText?: (delta: string) => void;
  /** Context for the "What was sent to the AI" log; every request is recorded (see providers.ts). */
  audit: RequestAudit;
  /** The model's output limit when known (OpenRouter's catalogue); providers with a fixed list set their own. */
  maxOutputTokens?: number;
  /** Base URL of a provider whose address the user sets (the custom endpoint), already checked. */
  endpoint?: string;
  /** The custom endpoint's extra headers (values may be secrets: never logged or recorded). */
  extraHeaders?: CustomHeader[];
};

export type RequestAudit = {
  /** Key of the conversation the request belongs to. */
  conversation: string;
  /** Incognito, or touched an incognito tab: the log keeps it in memory only. */
  incognito: boolean;
  /** Site of the tab the assistant works in (host only). */
  host: string | null;
  /** Site each tool result was read from (host only), by call id. */
  resultHosts?: ReadonlyMap<string, string>;
  /** The memory section of the system prompt and how many memories it lists. */
  memory?: { text: string; count: number };
};

export type ModelTag = 'recommended' | 'fastest' | 'strongest';

export type Provider = {
  id: ProviderId;
  label: string;
  /** For the provider switch, where space is short. */
  shortLabel?: string;
  keyPlaceholder: string;
  keyUrl: string;
  /** The curated choices; with `catalog`, the full list comes from the provider (see openrouterModels.ts). */
  models: { id: string; name: string; tag?: ModelTag }[];
  defaultModel: string;
  /** The user sets the server's address (and the key is optional). */
  needsEndpoint?: boolean;
  /** Models are picked from the provider's own catalogue, fetched with the user's key. */
  catalog?: boolean;
  /** The `webSearch` option uses the provider's built-in web search; without it, searches go through the browser. */
  webSearch: boolean;
  call: (req: ModelRequest) => Promise<ModelReply>;
};

/** Raw output can only be replayed to the provider and model family that produced it. */
export function canReplay(turn: Extract<Turn, { role: 'assistant' }>, provider: ProviderId, model: string) {
  return turn.rawProvider === provider && turn.rawModel === model && turn.raw != null;
}
