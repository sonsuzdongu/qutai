/**
 * Token usage as each provider reports it, brought to one shape that can be priced (cost.ts). Pure and without
 * dependencies (types only), so it can be tested outside the app against the providers' documented payloads
 * (scripts/cost-tests/). Field names and their meaning, as read on 16 Nov 2026:
 *
 * - Anthropic Messages (platform.claude.com/docs/en/api/messages, …/build-with-claude/streaming): `usage` with
 *   `input_tokens` (prompt tokens not read from or written to the cache: the three add up to the whole prompt),
 *   `cache_creation_input_tokens` (split by TTL in `cache_creation.ephemeral_5m_input_tokens` and
 *   `ephemeral_1h_input_tokens`), `cache_read_input_tokens`, `output_tokens` (thinking included:
 *   `output_tokens_details.thinking_tokens` is "always ≤ output_tokens") and `server_tool_use.web_search_requests`.
 *   Streamed: `message_start` carries `message.usage`, `message_delta` a `usage` whose counts are cumulative.
 * - OpenAI Responses (developers.openai.com/api/docs/api-reference/responses/object, …/guides/prompt-caching,
 *   …/guides/reasoning): `input_tokens` with `input_tokens_details.cached_tokens` and `cache_write_tokens` (both
 *   parts of input_tokens; writes split by TTL in `cache_write_tokens_details.ttl_30m_tokens` / `ttl_12h_tokens`),
 *   `output_tokens` with `output_tokens_details.reasoning_tokens` (part of output, billed as output). Web search is
 *   billed per call: one `web_search_call` output item each. Streamed: the final response in `response.completed`.
 * - Gemini Interactions (aistudio.google.com/api-reference/interactions-api, …/docs/thinking): `usage` with
 *   `total_input_tokens`, `total_cached_tokens` ("the cached part of the prompt"), `total_output_tokens`,
 *   `total_thought_tokens` (reported apart from output; "response pricing is the sum of output tokens and
 *   thinking tokens"), `total_tool_use_tokens` and `grounding_tool_count` [{ type, count }]. Streamed: the
 *   interaction in `interaction.completed`.
 * - Chat Completions (OpenAI's chat object; OpenRouter's usage-accounting and streaming pages): `prompt_tokens`
 *   with `prompt_tokens_details.cached_tokens` / `cache_write_tokens`, `completion_tokens` with
 *   `completion_tokens_details.reasoning_tokens`. OpenRouter adds `cost` (credits), `is_byok`,
 *   `cost_details.upstream_inference_cost` and `server_tool_use_details.web_search_requests`, and always sends usage
 *   (in a stream, in the last chunk before [DONE]). Other compatible servers send it in a stream only when asked
 *   with `stream_options: { include_usage: true }`, if at all.
 */

import type { ProviderId } from './types';

/**
 * One request's tokens by how they are priced. Every count is a whole number of tokens; `input` is the part of the
 * prompt billed at the full input price (cache reads and writes are counted apart).
 */
export type Usage = {
  input: number;
  cacheRead: number;
  /** Cache writes with the short lifetime (Anthropic 5 minutes, OpenAI 30 minutes), or of unstated lifetime. */
  cacheWrite: number;
  /** Cache writes with the long lifetime (Anthropic 1 hour, OpenAI 12 hours). */
  cacheWriteLong: number;
  /** Everything generated and billed at the output price, thinking included. */
  output: number;
  /** The thinking / reasoning part of `output` (shown, not priced again). */
  thinking: number;
  /** Web searches the provider ran (and bills per search). */
  searches: number;
  /**
   * What the provider itself said the request cost, in nano-dollars (OpenRouter's `cost`). Preferred over a price
   * from the table.
   */
  reportedNanos?: number;
};

export const EMPTY_USAGE: Usage = {
  input: 0,
  cacheRead: 0,
  cacheWrite: 0,
  cacheWriteLong: 0,
  output: 0,
  thinking: 0,
  searches: 0,
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
/** A token count: a finite, non-negative whole number, anything else 0. */
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});

/** Tokens of the whole prompt (what prompt-size price tiers are measured on). */
export function promptTokens(u: Usage): number {
  return u.input + u.cacheRead + u.cacheWrite + u.cacheWriteLong;
}

/** Every token the request counted: the prompt and what was generated. */
export function totalTokens(u: Usage): number {
  return promptTokens(u) + u.output;
}

export function addUsage(a: Usage, b: Usage): Usage {
  const reported =
    a.reportedNanos !== undefined || b.reportedNanos !== undefined
      ? (a.reportedNanos ?? 0) + (b.reportedNanos ?? 0)
      : undefined;
  return {
    input: a.input + b.input,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cacheWriteLong: a.cacheWriteLong + b.cacheWriteLong,
    output: a.output + b.output,
    thinking: a.thinking + b.thinking,
    searches: a.searches + b.searches,
    ...(reported !== undefined ? { reportedNanos: reported } : {}),
  };
}

/** Anthropic's `usage` object (a response's, or a stream's merged one). Null when there is none. */
export function anthropicUsage(raw: unknown): Usage | null {
  if (!isObj(raw)) return null;
  const creation = obj(raw.cache_creation);
  const short = count(creation.ephemeral_5m_input_tokens);
  const long = count(creation.ephemeral_1h_input_tokens);
  const written = count(raw.cache_creation_input_tokens);
  // Without the TTL split, writes are counted at the 5-minute price (the default lifetime).
  const split = 'ephemeral_5m_input_tokens' in creation || 'ephemeral_1h_input_tokens' in creation;
  return {
    input: count(raw.input_tokens),
    cacheRead: count(raw.cache_read_input_tokens),
    cacheWrite: split ? short : written,
    cacheWriteLong: split ? long : 0,
    output: count(raw.output_tokens),
    thinking: count(obj(raw.output_tokens_details).thinking_tokens),
    searches: count(obj(raw.server_tool_use).web_search_requests),
  };
}

/**
 * A stream's usage: `message_start`'s, overwritten field by field by each `message_delta`'s (cumulative counts).
 * Returns the merged raw object for anthropicUsage.
 */
export function mergeAnthropicStreamUsage(current: Obj | undefined, next: unknown): Obj | undefined {
  if (!isObj(next)) return current;
  return { ...(current ?? {}), ...next };
}

/** OpenAI Responses: the response's `usage` and its output items (web searches are billed per call). */
export function openaiUsage(raw: unknown, output: unknown): Usage | null {
  if (!isObj(raw)) return null;
  const details = obj(raw.input_tokens_details);
  const writes = obj(details.cache_write_tokens_details);
  const all = count(raw.input_tokens);
  const cached = count(details.cached_tokens);
  const written = count(details.cache_write_tokens);
  const long = count(writes.ttl_12h_tokens);
  // The TTL split adds up to cache_write_tokens; without it, writes are counted at the 30-minute price.
  const short = 'ttl_30m_tokens' in writes ? count(writes.ttl_30m_tokens) : Math.max(0, written - long);
  const searches = Array.isArray(output) ? output.filter((item) => isObj(item) && item.type === 'web_search_call').length : 0;
  return {
    input: Math.max(0, all - cached - written),
    cacheRead: cached,
    cacheWrite: short,
    cacheWriteLong: long,
    output: count(raw.output_tokens),
    thinking: count(obj(raw.output_tokens_details).reasoning_tokens),
    searches,
  };
}

/**
 * Gemini Interactions: `usage`. Thinking is reported apart from output and billed like it, so it is added to output
 * here. Tool-use prompt tokens are counted as input (the docs say they are billed, not at which price; the input
 * price is the one for prompt tokens).
 */
export function geminiUsage(raw: unknown): Usage | null {
  if (!isObj(raw)) return null;
  const input = count(raw.total_input_tokens);
  const cached = Math.min(input, count(raw.total_cached_tokens));
  const thought = count(raw.total_thought_tokens);
  const searches = (Array.isArray(raw.grounding_tool_count) ? raw.grounding_tool_count : [])
    .filter((g) => isObj(g) && g.type === 'google_search')
    .reduce<number>((sum, g) => sum + count((g as Obj).count), 0);
  return {
    input: input - cached + count(raw.total_tool_use_tokens),
    cacheRead: cached,
    cacheWrite: 0,
    cacheWriteLong: 0,
    output: count(raw.total_output_tokens) + thought,
    thinking: thought,
    searches,
  };
}

/**
 * A dollar amount the provider reported, as whole nano-dollars. OpenRouter states `cost` in credits; its credits are
 * bought in US dollars one for one, so a credit is taken as a dollar.
 */
function nanos(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 1e9) : undefined;
}

/**
 * Chat Completions `usage` (OpenRouter and OpenAI-compatible servers). Only OpenRouter's `cost` is trusted as a
 * price; with the user's own provider key behind OpenRouter (`is_byok`), the provider's charge is added to it.
 */
export function chatUsage(raw: unknown, provider: ProviderId): Usage | null {
  if (!isObj(raw)) return null;
  const prompt = obj(raw.prompt_tokens_details);
  const all = count(raw.prompt_tokens);
  const cached = count(prompt.cached_tokens);
  const written = count(prompt.cache_write_tokens);
  const usage: Usage = {
    input: Math.max(0, all - cached - written),
    cacheRead: cached,
    cacheWrite: written,
    cacheWriteLong: 0,
    output: count(raw.completion_tokens),
    thinking: count(obj(raw.completion_tokens_details).reasoning_tokens),
    searches: count(obj(raw.server_tool_use_details).web_search_requests),
  };
  if (provider !== 'openrouter') return usage;
  const cost = nanos(raw.cost);
  if (cost === undefined) return usage;
  const upstream = raw.is_byok === true ? (nanos(obj(raw.cost_details).upstream_inference_cost) ?? 0) : 0;
  return { ...usage, reportedNanos: cost + upstream };
}
