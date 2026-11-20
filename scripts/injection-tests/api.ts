/**
 * The measurement's only way to the model (README.md in this folder): the app's own request code
 * (src/ai/anthropic.ts over src/ai/http.ts) calls `fetch`, and this wrapper, for requests to Anthropic only,
 * - puts in the key at the last moment (the app is given a placeholder, so the key is in no turn, log or result),
 * - gives the request the shape Qutai's relay sends for Qutai Credits (backend/apps/api/src/providers/anthropic.ts:
 *   API version 2026-10-21, the allowed model's output limit, no effort setting),
 * - refuses to send once the spending cap is reached, and adds each answer's reported usage to the ledger, priced
 *   with the app's own price table (src/ai/prices.ts, src/ai/cost.ts).
 *
 * The key is read from the owner's local server settings (backend/apps/api/.dev.vars) into memory only. It is never
 * printed, logged or written; any error text that passes through here has it replaced by "[key]".
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { priceRequest } from '../../src/ai/cost';
import { anthropicUsage, type Usage } from '../../src/ai/usage';
import { OBEDIENT, obedientReply } from './obedient';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEV_VARS = join(ROOT, 'backend', 'apps', 'api', '.dev.vars');
const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
/** The relay's shape (backend seed allowed_models): its API version and output limit. */
export const RELAY_VERSION = '2026-10-21';
export const RELAY_MAX_TOKENS = 16000;
/** What the app's code is given instead of the key. */
export const PLACEHOLDER_KEY = 'harness-placeholder';

export class BudgetError extends Error {}
export class NoKeyError extends Error {}

/** The key, from the local server's settings; null when there is none. Never returned to callers outside this file. */
function readKey(): string | null {
  if (process.env.QUTAI_INJECTION_KEY_FILE === 'none') return null;
  try {
    const text = readFileSync(DEV_VARS, 'utf8');
    const m = /^ANTHROPIC_API_KEY\s*=\s*"?([^"\r\n]+)"?\s*$/m.exec(text);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

export type Ledger = {
  /** US dollars spent by every measuring run so far (all invocations), from reported usage. */
  spent: number;
  requests: number;
  byModel: Record<string, { usd: number; requests: number; input: number; cacheRead: number; cacheWrite: number; output: number }>;
};

export class Meter {
  ledger: Ledger;
  constructor(
    private file: string,
    readonly cap: number,
  ) {
    this.ledger = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { spent: 0, requests: 0, byModel: {} };
  }
  add(model: string, usage: Usage) {
    const nanos = priceRequest('anthropic', model, usage, Date.now()).nanos ?? 0;
    const usd = nanos / 1e9;
    this.ledger.spent += usd;
    this.ledger.requests++;
    const m = (this.ledger.byModel[model] ??= { usd: 0, requests: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 });
    m.usd += usd;
    m.requests++;
    m.input += usage.input;
    m.cacheRead += usage.cacheRead;
    m.cacheWrite += usage.cacheWrite + usage.cacheWriteLong;
    m.output += usage.output;
    this.save();
  }
  save() {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.ledger, null, 2) + '\n');
  }
  /** Refuses a request that could take the total over the cap (its worst case: the prompt now plus a long answer). */
  check(model: string, promptChars: number) {
    const worst = model.includes('haiku') ? (promptChars / 3) * 0.5e-6 + 4000 * 2.5e-6 : (promptChars / 3) * 2.5e-6 + 4000 * 10e-6;
    if (this.ledger.spent + worst > this.cap) {
      throw new BudgetError(`Spending cap reached: $${this.ledger.spent.toFixed(4)} of $${this.cap.toFixed(2)} spent.`);
    }
  }
}

/**
 * Installs the wrapper. Throws NoKeyError when there is no key. Requests to anything but Anthropic's Messages API
 * are refused: the app's code must not reach any other server from the harness.
 */
export function installModelAccess(meter: Meter, needKey = true): void {
  const key = readKey() ?? '';
  if (!key && needKey) throw new NoKeyError('No ANTHROPIC_API_KEY in backend/apps/api/.dev.vars');
  const redact = (s: string) => (key ? s.split(key).join('[key]') : s);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(ANTHROPIC)) throw new Error(`The harness refuses requests outside the model API (${url.slice(0, 80)}).`);
    const body = JSON.parse(String(init?.body ?? '{}'));
    const model = String(body.model);
    // The scripted obedient model answers here; nothing leaves the machine and nothing is billed.
    if (model === OBEDIENT) return new Response(JSON.stringify(obedientReply(body)), { status: 200, headers: { 'content-type': 'application/json' } });
    if (!key) throw new NoKeyError('No key for the model API.');
    body.max_tokens = RELAY_MAX_TOKENS;
    const headers = { ...(init?.headers as Record<string, string>) };
    if (headers['x-api-key'] !== PLACEHOLDER_KEY) throw new Error('Unexpected key in a request.');
    headers['x-api-key'] = key;
    headers['anthropic-version'] = RELAY_VERSION;
    const payload = JSON.stringify(body);
    meter.check(model, payload.length);
    let res: globalThis.Response;
    try {
      res = await realFetch(url, { ...init, headers, body: payload });
    } catch (e) {
      throw new Error(redact(e instanceof Error ? e.message : String(e)));
    }
    if (!res.ok) {
      const text = redact(await res.text());
      return new Response(text, { status: res.status, headers: res.headers });
    }
    const text = await res.text();
    try {
      const usage = anthropicUsage(JSON.parse(text).usage);
      if (usage) meter.add(model, usage);
    } catch {}
    return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

/** Whether a key is there (without reading it into anything but a boolean). */
export function keyAvailable(): boolean {
  return readKey() !== null;
}
