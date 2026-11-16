/**
 * Approximate cost of AI requests in own-key mode: a request's usage (usage.ts) times the list price (prices.ts),
 * summed over the requests of one answer. Pure and without dependencies (types only; tested in scripts/cost-tests/).
 *
 * Money is kept as whole nano-dollars (billionths of a dollar) and multiplied with BigInt, so no floating-point
 * rounding creeps in: tokens × micro-dollars per million tokens is an exact number of pico-dollars, rounded once
 * to nano-dollars per request.
 *
 * Seam for pro mode: requests that go through Qutai's server will carry the server's own charge for the request
 * (`source: 'server'`, set by the code that reads the server's settlement event, not written yet). A charge the
 * adapter already set is kept as it is by providers.ts; only own-key requests are priced from the table here.
 */

import { findPrice, PRICES, PRICES_AS_OF, type PriceRow } from './prices';
import type { ProviderId } from './types';
import { addUsage, EMPTY_USAGE, promptTokens, type Usage } from './usage';

/** Where a figure comes from: the app's list prices, the provider's own report (OpenRouter), or Qutai's server. */
export type CostSource = 'list' | 'provider' | 'server';

/** One request: its usage and, when known, its cost. */
export type RequestCost = {
  usage: Usage;
  /** Nano-dollars; absent when the price isn't known (tokens are shown alone). */
  nanos?: number;
  source?: CostSource;
  /** The date of the price table used (list prices only). */
  pricesAsOf?: string;
  /**
   * Qutai Credits: the micro-credits Qutai's server charged for the request (its settlement), with `source: 'server'`.
   * Such a request never has a dollar figure.
   */
  credits?: number;
};

/**
 * One answer (all the requests of one task) as stored with the conversation and shown under the answer: numbers and
 * ids only, no content.
 */
export type AnswerCost = {
  provider: ProviderId;
  model: string;
  /** Requests the task made, and how many of them reported their usage. */
  requests: number;
  reported: number;
  usage: Usage;
  /** Nano-dollars, only when every request that reported usage could be priced. */
  nanos?: number;
  source?: CostSource;
  pricesAsOf?: string;
  /** Qutai Credits: micro-credits charged for all the task's requests (never shown as dollars). */
  credits?: number;
};

/** Pico-dollars of `tokens` at `microsPerMTok` (exact). */
const pico = (tokens: number, microsPerMTok: number | undefined): bigint =>
  BigInt(tokens) * BigInt(microsPerMTok ?? 0);

/** Nano-dollars of a usage at a price row, or null when the row lacks a price for a kind of token that was used. */
export function costAt(usage: Usage, row: PriceRow): number | null {
  if ((usage.cacheWrite && row.cacheWrite === undefined) || (usage.cacheWriteLong && row.cacheWriteLong === undefined))
    return null;
  if (usage.searches && row.search === undefined) return null;
  const total =
    pico(usage.input, row.input) +
    pico(usage.cacheRead, row.cacheRead) +
    pico(usage.cacheWrite, row.cacheWrite) +
    pico(usage.cacheWriteLong, row.cacheWriteLong) +
    pico(usage.output, row.output);
  // Round half up to nano-dollars (1,000 pico-dollars); searches are whole micro-dollars.
  const nanos = (total + 500n) / 1000n + BigInt(usage.searches) * BigInt(row.search ?? 0) * 1000n;
  return Number(nanos);
}

/**
 * Prices one request: the provider's reported cost when there is one, else the list price for its model, prompt size
 * and date, else tokens only.
 */
export function priceRequest(
  provider: ProviderId,
  model: string,
  usage: Usage,
  at: number,
  table: PriceRow[] = PRICES,
  asOf: string = PRICES_AS_OF,
): RequestCost {
  if (usage.reportedNanos !== undefined) return { usage, nanos: usage.reportedNanos, source: 'provider' };
  const row = findPrice(provider, model, promptTokens(usage), at, table);
  const nanos = row ? costAt(usage, row) : null;
  return nanos === null ? { usage } : { usage, nanos, source: 'list', pricesAsOf: asOf };
}

/** Adds up the requests of one answer. */
export function createAnswerMeter(provider: ProviderId, model: string) {
  let requests = 0;
  let reported = 0;
  let usage = EMPTY_USAGE;
  let nanos: number | null = 0;
  const sources = new Set<CostSource>();
  let asOf: string | undefined;
  let credits: number | undefined;
  return {
    /** A request went out; `cost` is undefined when it didn't report usage (or failed). */
    add(cost: RequestCost | undefined) {
      requests++;
      if (!cost) return;
      reported++;
      usage = addUsage(usage, cost.usage);
      if (cost.nanos === undefined || nanos === null) nanos = null;
      else nanos += cost.nanos;
      if (cost.source) sources.add(cost.source);
      asOf ??= cost.pricesAsOf;
      if (cost.credits !== undefined) credits = (credits ?? 0) + cost.credits;
    },
    get requests() {
      return requests;
    },
    /** The answer's figures, or null when no request went out. */
    result(): AnswerCost | null {
      if (!requests) return null;
      const { reportedNanos: _, ...counts } = usage;
      const priced = nanos !== null && reported > 0;
      const source: CostSource | undefined = sources.has('server') ? 'server' : sources.has('list') ? 'list' : sources.has('provider') ? 'provider' : undefined;
      return {
        provider,
        model,
        requests,
        reported,
        usage: counts,
        ...(priced ? { nanos: nanos as number, ...(source ? { source } : {}), ...(asOf ? { pricesAsOf: asOf } : {}) } : {}),
        ...(credits !== undefined && !priced ? { credits, source: 'server' as const } : {}),
      };
    },
  };
}

/**
 * Adds answers up (a conversation's or a day's total); priced only when every one of them is, in dollars or in
 * Qutai Credits (never a mix: a total of both would be neither).
 */
export function sumCosts(list: { nanos?: number; credits?: number; usage: Usage }[]): { nanos?: number; credits?: number; tokens: number } {
  let nanos: number | undefined = 0;
  let credits: number | undefined = 0;
  let tokens = 0;
  for (const c of list) {
    tokens += promptTokens(c.usage) + c.usage.output;
    nanos = nanos === undefined || c.nanos === undefined ? undefined : nanos + c.nanos;
    credits = credits === undefined || c.credits === undefined ? undefined : credits + c.credits;
  }
  return {
    ...(list.length && nanos !== undefined ? { nanos } : {}),
    ...(list.length && credits !== undefined ? { credits } : {}),
    tokens,
  };
}

/** What a request that failed was still charged (Qutai Credits: a stream cut short), or undefined. */
export function failedRequestCost(e: unknown): RequestCost | undefined {
  const cost = e && typeof e === 'object' ? (e as { requestCost?: unknown }).requestCost : undefined;
  return cost && typeof cost === 'object' ? (cost as RequestCost) : undefined;
}

/**
 * Nano-dollars as text, rounded to a sensible number of decimals: "$1.24", "$0.012", "$0.0034", or "< $0.0001".
 * Built from whole numbers (no floating point); `decimal` is the language's decimal separator.
 */
export function formatUsd(nanos: number, decimal = '.'): string {
  if (nanos <= 0) return '$0';
  if (nanos < 100_000) return `< $0${decimal}0001`;
  const digits = nanos >= 1_000_000_000 ? 2 : nanos >= 10_000_000 ? 3 : 4;
  const step = 10 ** (9 - digits);
  const units = Math.floor((nanos + step / 2) / step);
  const scale = 10 ** digits;
  const whole = Math.floor(units / scale);
  const fraction = String(units % scale).padStart(digits, '0');
  return `$${whole}${decimal}${fraction}`;
}

// Reading figures back (the log's database column, saved conversations, backups): numbers only, anything else dropped.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const whole = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : undefined;
const SOURCES: CostSource[] = ['list', 'provider', 'server'];
const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'openrouter', 'custom', 'qutai'];

export function parseUsage(v: unknown): Usage | undefined {
  if (!isObj(v)) return undefined;
  const out = { ...EMPTY_USAGE };
  for (const key of Object.keys(EMPTY_USAGE) as (keyof typeof EMPTY_USAGE)[]) out[key] = whole(v[key]) ?? 0;
  return out;
}

/** The cost fields shared by a request and an answer: dollars, or Qutai's credits (never both). */
function parseFigure(v: Obj) {
  const nanos = whole(v.nanos);
  const source = SOURCES.find((s) => s === v.source);
  const asOf = typeof v.pricesAsOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.pricesAsOf) ? v.pricesAsOf : undefined;
  const credits = nanos === undefined && source === 'server' ? whole(v.credits) : undefined;
  if (credits !== undefined) return { credits, source };
  return {
    ...(nanos !== undefined ? { nanos } : {}),
    ...(nanos !== undefined && source ? { source } : {}),
    ...(nanos !== undefined && asOf ? { pricesAsOf: asOf } : {}),
  };
}

export function parseRequestCost(v: unknown): RequestCost | undefined {
  const usage = isObj(v) ? parseUsage(v.usage) : undefined;
  return usage ? { usage, ...parseFigure(v as Obj) } : undefined;
}

export function parseAnswerCost(v: unknown): AnswerCost | undefined {
  if (!isObj(v)) return undefined;
  const usage = parseUsage(v.usage);
  const provider = PROVIDERS.find((p) => p === v.provider);
  const model = typeof v.model === 'string' ? v.model.slice(0, 200) : undefined;
  const requests = whole(v.requests);
  const reported = whole(v.reported);
  if (!usage || !provider || model === undefined || requests === undefined || reported === undefined) return undefined;
  return { provider, model, requests, reported: Math.min(reported, requests), usage, ...parseFigure(v) };
}
