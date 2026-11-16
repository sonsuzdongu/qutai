/**
 * List prices of the models in the app's lists, for the approximate cost shown under answers and in "What was sent
 * to the AI" (cost.ts). Read by hand from each provider's pricing page; standard tier, no batch, priority, fast mode
 * or regional surcharge. The provider's invoice is what counts: discounts, free allowances, taxes and anything
 * else the app can't know are not in here.
 *
 * Units: micro-dollars (millionths of a US dollar) per million tokens, so every price is a whole number
 * ($2.50 = 2_500_000); searches in micro-dollars per search ($10 per 1,000 = 10_000).
 *
 * To update (README.md › Approximate cost): read the provider's pricing page, change or add rows, set `read` on
 * each row you checked and PRICES_AS_OF to the date you read them, and run `npm run test:cost`. A model missing
 * here has no price, and the app shows its tokens only. Never guess a price.
 */

import type { ProviderId } from './types';

/** The date the table was last checked against the pricing pages (shown as "prices as of"). */
export const PRICES_AS_OF = '2026-11-16';

export type PriceRow = {
  provider: ProviderId;
  model: string;
  /** This row applies to requests whose prompt is over this many tokens (0: from the first token). */
  above?: number;
  /** From this date on (UTC, inclusive); earlier requests use the row before it. */
  from?: string;
  /** Up to and including this date (UTC); a later row takes over the next day. */
  until?: string;
  input: number;
  output: number;
  cacheRead: number;
  /** Absent: the provider has no such charge (Gemini's implicit caching has no write price). */
  cacheWrite?: number;
  cacheWriteLong?: number;
  /** Per web search the provider runs. */
  search?: number;
  /** Where the price was read, and when. */
  source: string;
  read: string;
};

const ANTHROPIC = 'https://platform.claude.com/docs/en/about-claude/pricing';
const OPENAI = 'https://developers.openai.com/api/docs/pricing';
const GEMINI = 'https://aistudio.google.com/docs/pricing';

const M = 1_000_000;
/** Dollars per million tokens to micro-dollars per million tokens, exactly ($0.125 → 125_000). */
const usd = (dollars: string): number => {
  const [whole, fraction = ''] = dollars.split('.');
  return Number(whole) * M + Number((fraction + '000000').slice(0, 6));
};

export const PRICES: PriceRow[] = [
  // Anthropic. Columns on the page: base input, 5-minute cache write, 1-hour cache write, cache hit, output.
  // Thinking is part of output_tokens. Web search: $10 per 1,000 searches. Only Claude Haiku 5.5 has a prompt-size
  // tier: over 100,000 tokens, counting cache reads and writes, the whole request is priced higher.
  {
    provider: 'anthropic', model: 'claude-opus-5-5',
    input: usd('4'), cacheWrite: usd('5'), cacheWriteLong: usd('8'), cacheRead: usd('0.20'), output: usd('20'),
    search: 10_000, source: ANTHROPIC, read: '2026-11-16',
  },
  {
    provider: 'anthropic', model: 'claude-sonnet-5-5',
    input: usd('2'), cacheWrite: usd('2.50'), cacheWriteLong: usd('4'), cacheRead: usd('0.10'), output: usd('10'),
    search: 10_000, source: ANTHROPIC, read: '2026-11-16',
  },
  {
    provider: 'anthropic', model: 'claude-haiku-5-5',
    input: usd('0.10'), cacheWrite: usd('0.125'), cacheWriteLong: usd('0.20'), cacheRead: usd('0.01'), output: usd('0.50'),
    search: 10_000, source: ANTHROPIC, read: '2026-11-16',
  },
  {
    provider: 'anthropic', model: 'claude-haiku-5-5', above: 100_000,
    input: usd('0.50'), cacheWrite: usd('0.625'), cacheWriteLong: usd('1'), cacheRead: usd('0.05'), output: usd('2.50'),
    search: 10_000, source: ANTHROPIC, read: '2026-11-16',
  },

  // OpenAI. Short context: up to 272K input tokens; over that the whole request is priced at the long-context rows
  // (model pages: "for the full request"). Cache writes: 30 minutes (short) and 12 hours (long). Reasoning is billed
  // as output. Web search: $10 per 1,000 calls; its search content tokens are counted in the usage.
  {
    provider: 'openai', model: 'gpt-5.6-terra',
    input: usd('2'), cacheRead: usd('0.20'), cacheWrite: usd('2.50'), cacheWriteLong: usd('5'), output: usd('12'),
    search: 10_000, source: OPENAI, read: '2026-11-16',
  },
  {
    provider: 'openai', model: 'gpt-5.6-terra', above: 272_000,
    input: usd('4'), cacheRead: usd('0.40'), cacheWrite: usd('5'), cacheWriteLong: usd('10'), output: usd('18'),
    search: 10_000, source: OPENAI, read: '2026-11-16',
  },
  {
    provider: 'openai', model: 'gpt-5.6-luna',
    input: usd('0.20'), cacheRead: usd('0.02'), cacheWrite: usd('0.25'), cacheWriteLong: usd('0.50'), output: usd('1.20'),
    search: 10_000, source: OPENAI, read: '2026-11-16',
  },
  {
    provider: 'openai', model: 'gpt-5.6-luna', above: 272_000,
    input: usd('0.40'), cacheRead: usd('0.04'), cacheWrite: usd('0.50'), cacheWriteLong: usd('1'), output: usd('1.80'),
    search: 10_000, source: OPENAI, read: '2026-11-16',
  },
  {
    provider: 'openai', model: 'gpt-6-astra',
    input: usd('10'), cacheRead: usd('1'), cacheWrite: usd('12.50'), cacheWriteLong: usd('25'), output: usd('50'),
    search: 10_000, source: OPENAI, read: '2026-11-16',
  },
  {
    provider: 'openai', model: 'gpt-6-astra', above: 272_000,
    input: usd('20'), cacheRead: usd('2'), cacheWrite: usd('25'), cacheWriteLong: usd('50'), output: usd('75'),
    search: 10_000, source: OPENAI, read: '2026-11-16',
  },

  // Gemini. Output price includes thinking. Implicit caching only (no write price). Grounding with Google Search:
  // $14 per 1,000 queries after 5,000 free a month shared across models; the free allowance is not deducted.
  // Announced increases: Gemini 4 Carbon from 1 Dec 2026, Gemini 3.8 Flash from 1 Jan 2027.
  {
    provider: 'gemini', model: 'gemini-4-hydrogen',
    input: usd('1.50'), cacheRead: usd('0.075'), output: usd('7.50'),
    search: 14_000, source: GEMINI, read: '2026-11-16',
  },
  {
    provider: 'gemini', model: 'gemini-4-carbon', until: '2026-11-30',
    input: usd('2'), cacheRead: usd('0.10'), output: usd('10'),
    search: 14_000, source: GEMINI, read: '2026-11-16',
  },
  {
    provider: 'gemini', model: 'gemini-4-carbon', from: '2026-12-01',
    input: usd('4'), cacheRead: usd('0.20'), output: usd('20'),
    search: 14_000, source: GEMINI, read: '2026-11-16',
  },
  {
    provider: 'gemini', model: 'gemini-3.8-flash', until: '2026-12-31',
    input: usd('0.75'), cacheRead: usd('0.075'), output: usd('3.75'),
    search: 14_000, source: GEMINI, read: '2026-11-16',
  },
  {
    provider: 'gemini', model: 'gemini-3.8-flash', from: '2027-01-01',
    input: usd('1.50'), cacheRead: usd('0.15'), output: usd('7.50'),
    search: 14_000, source: GEMINI, read: '2026-11-16',
  },
];

const DAY = 86_400_000;
const dayStart = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * The row that prices a request to this model with a prompt of `prompt` tokens sent at `at` (ms), or null when the
 * table has no price for it. OpenRouter and the custom endpoint are never in the table.
 */
export function findPrice(provider: ProviderId, model: string, prompt: number, at: number, table = PRICES): PriceRow | null {
  let best: PriceRow | null = null;
  for (const row of table) {
    if (row.provider !== provider || row.model !== model) continue;
    if (row.from && at < dayStart(row.from)) continue;
    if (row.until && at >= dayStart(row.until) + DAY) continue;
    if (prompt <= (row.above ?? 0) && (row.above ?? 0) > 0) continue;
    if (!best || (row.above ?? 0) > (best.above ?? 0)) best = row;
  }
  return best;
}
