import { createSseDecoder, type SseEvent } from '../ai/sse';
import type { DeviceProof } from '../account/deviceProof';
import { RelayError, type RelayErrorKind } from './errors';
import { TIER_ID } from './tiers';
import { wellFormedJson } from '../utils/wellFormed';
import {
  isRelayProvider,
  type CreditsResponse,
  type PublicConfig,
  type RelayPause,
  type RelayRequest,
  type RelayServed,
  type RelaySettlementEvent,
  type RelayStreamErrorEvent,
  type Tier,
  type UpstreamError,
} from './types';
import type { VerifyAnswer, VerifyPurchaseRequest, VerifyPurchaseResponse } from '../purchases/types';

/**
 * The HTTP client for Qutai Credits (pro mode only): `GET /config`, `GET /credits` and `POST /relay`
 * (backend/README.md › Relay). No React Native imports, so `scripts/credits-tests/` runs it in Node against a fake
 * server and the local one. Nothing here logs: requests carry the conversation and the access token.
 *
 * What the relay answers with, and what this client makes of it:
 * - a stream: the provider's own events, handed on unchanged, then `qutai.error` (the provider's stream was cut)
 *   and always last `qutai.settlement` (what was charged, the new balance); both are kept from the adapters;
 * - not streamed: the provider's JSON, with the charge and balance in `X-Qutai-Charged` / `X-Qutai-Balance`;
 * - an error: `{ error: { code, message, requestId, upstream?, tier? } }` (refusals are never charged);
 * - always: `X-Qutai-Provider` / `X-Qutai-Model` (and on the tier form `X-Qutai-Tier` / `X-Qutai-Route`) before the
 *   body. They are read before a single event or byte goes to the adapter: an answer in another provider's format
 *   than the one the request was built in is never handed to the adapter's parser (it is read to its end for the
 *   charge and refused as `bad_response`);
 * - a paused Anthropic answer: `qutai.paused` `{ continuation, expiresAt }` before the settlement (streamed), or the
 *   `X-Qutai-Continuation` / `X-Qutai-Continuation-Expires` headers (JSON).
 */

/** The account's tokens, from the signed-in session (src/account/session.ts). */
export interface TokenSource {
  /** A valid access token; rejects when signed out. */
  get(): Promise<string>;
  /** A new access token after the server refused `stale` (one refresh at a time); rejects when the session is over. */
  renew(stale: string): Promise<string>;
  /** The server said the account is suspended. */
  suspended(): void;
  /** The server refused a renewed token too: the session is over. */
  ended(): void;
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface CreditsClientOptions {
  baseUrl: string;
  tokens: TokenSource;
  /** The app's version, sent as `X-Qutai-App-Version` (the server refuses versions below its minimum). */
  appVersion: string;
  fetch?: Fetch;
  /** A new balance from a settlement (micro-credits). */
  onBalance?: (balance: number) => void;
  /** Waits before a retry; abortable. Tests pass a fast one. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Before retrying a request cut off by the network: waits until the app is in the foreground again. */
  beforeRetry?: (signal: AbortSignal) => Promise<void>;
  /** Device verification headers for `POST /relay` (pro builds; src/account/deviceCheck.ts), fresh for every attempt. */
  deviceProof?: DeviceProof | null;
}

/** What one relay request cost, from its settlement, and what served it. */
export interface Charge {
  /** Micro-credits charged (0 when the request was refused or the settlement didn't say). */
  charged: number;
  balance: number | null;
  /** From the answer's headers; absent when the server sent none (an older server). */
  served?: RelayServed;
  /** The answer paused (Anthropic `pause_turn`) and may be continued with this. */
  paused?: RelayPause;
}

export const APP_VERSION_HEADER = 'X-Qutai-App-Version';
const CONFIG_TIMEOUT_MS = 10_000;
const CREDITS_TIMEOUT_MS = 15_000;
/** The server gives the provider 30 s. */
const INTRO_TIMEOUT_MS = 40_000;
/** The server waits up to 10 s for RevenueCat. */
const VERIFY_TIMEOUT_MS = 20_000;
/** Refusals worth waiting for (our own previous step still settling, a short rate limit, a busy provider). */
const WAITABLE: ReadonlySet<RelayErrorKind> = new Set(['task_active', 'rate_limited', 'upstream_unavailable']);
const MAX_WAIT_SECONDS = 20;
const MAX_WAITS = 2;
const MAX_NETWORK_RETRIES = 2;

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done);
  });

export function createCreditsClient(options: CreditsClientOptions) {
  const base = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl: Fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? defaultSleep;

  async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await run(controller.signal);
    } catch (e) {
      if (e instanceof RelayError) throw e;
      throw new RelayError(controller.signal.aborted ? 'timeout' : 'network', 0);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * `GET /config` (no account needed). The server lets it be cached a minute, and the platform's HTTP cache honours
   * that: `fresh` (the server said a tier is unknown or moved) asks past any cached copy.
   */
  async function config(fresh = false): Promise<PublicConfig> {
    return withTimeout(CONFIG_TIMEOUT_MS, async (signal) => {
      const res = await fetchImpl(`${base}/config`, {
        headers: { Accept: 'application/json', ...(fresh ? { 'Cache-Control': 'no-cache' } : {}) },
        ...(fresh ? { cache: 'no-store' as const } : {}),
        signal,
      });
      if (!res.ok) throw await errorFrom(res);
      return parseConfig(await readJson(res));
    });
  }

  /**
   * An authenticated request: the access token, one renewal and retry when the server refuses it, the session
   * ended when it refuses the renewed one too.
   */
  async function authorized(send: (token: string) => Promise<Response>): Promise<Response> {
    let token: string;
    try {
      token = await options.tokens.get();
    } catch {
      throw new RelayError('not_signed_in', 0);
    }
    let res = await send(token);
    if (res.status === 401) {
      try {
        token = await options.tokens.renew(token);
      } catch {
        throw new RelayError('not_signed_in', 401);
      }
      res = await send(token);
      if (res.status === 401) {
        options.tokens.ended();
        throw new RelayError('not_signed_in', 401);
      }
    }
    if (res.status === 403) {
      const error = await errorFrom(res);
      if (error.kind === 'account_suspended') options.tokens.suspended();
      throw error;
    }
    return res;
  }

  /** `GET /credits`: balance, a running task, the latest ledger entries (newest first). */
  async function credits(limit = 50): Promise<CreditsResponse> {
    return withTimeout(CREDITS_TIMEOUT_MS, async (signal) => {
      const res = await authorized((token) =>
        fetchImpl(`${base}/credits?limit=${limit}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          signal,
        }),
      );
      if (!res.ok) throw await errorFrom(res);
      const parsed = parseCredits(await readJson(res));
      options.onBalance?.(parsed.balance);
      return parsed;
    });
  }

  /** Sends the relay request until an answer that isn't worth waiting out: an OK response or a final error. */
  async function post(body: RelayRequest, signal: AbortSignal): Promise<Response> {
    // The relay parses this and serialises it again for the provider, so a lone surrogate would come out as an escape
    // the provider refuses (400, "unexpected end of hex escape"): replaced here (utils/wellFormed.ts).
    const payload = wellFormedJson(body);
    let waits = 0;
    let networkRetries = 0;
    for (;;) {
      if (signal.aborted) throw abortError();
      let res: Response;
      try {
        res = await authorized(async (token) =>
          fetchImpl(`${base}/relay`, {
            method: 'POST',
            headers: {
              ...(options.deviceProof ? await options.deviceProof.headers('POST', '/relay', true) : {}),
              'Content-Type': 'application/json',
              Accept: body.stream ? 'text/event-stream' : 'application/json',
              Authorization: `Bearer ${token}`,
              [APP_VERSION_HEADER]: options.appVersion,
            },
            body: payload,
            signal,
          }),
        );
      } catch (e) {
        if (e instanceof RelayError) throw e;
        if (signal.aborted) throw e;
        // No answer at all: nothing was reserved or charged, so trying again is safe.
        if (networkRetries++ >= MAX_NETWORK_RETRIES) throw new RelayError('network', 0);
        await options.beforeRetry?.(signal);
        await sleep(1000 * 2 ** networkRetries, signal);
        if (signal.aborted) throw abortError();
        continue;
      }
      if (res.ok) {
        options.deviceProof?.observe(res.status, res.headers, null);
        return res;
      }
      const error = await errorFrom(res);
      options.deviceProof?.observe(res.status, res.headers, error.reason ?? null);
      if (WAITABLE.has(error.kind) && waits < MAX_WAITS && (error.retryAfter ?? 5) <= MAX_WAIT_SECONDS) {
        waits++;
        await sleep((error.retryAfter ?? 5) * 1000, signal);
        if (signal.aborted) throw abortError();
        continue;
      }
      throw error;
    }
  }

  /**
   * A streamed relay request: the provider's events go to `onEvent` as they arrive; resolves with the charge once
   * the server's settlement came. A stream the server reports as cut (`qutai.error`) or that ends without its
   * settlement rejects with a RelayError carrying whatever was charged.
   */
  async function relayStream(body: RelayRequest, signal: AbortSignal, onEvent: (event: SseEvent) => void): Promise<Charge> {
    const res = await post({ ...body, stream: true }, signal);
    if (!res.body) throw new RelayError('bad_response', res.status);
    const served = servedFrom(res.headers);
    const reader = res.body.getReader();
    const decoder = createSseDecoder();
    let settlement: RelaySettlementEvent | null = null;
    let cut: RelayStreamErrorEvent | null = null;
    let paused: RelayPause | null = null;
    // An adapter that gives up on the provider's events (its own `error` event, a malformed stream) throws from
    // onEvent: nothing more is handed to it, but the stream is read to its end for the settlement, which follows
    // at once, so the charge is known. An answer in another format than the request's is never handed to it at all.
    let adapterError: { error: unknown } | null =
      served && served.provider !== body.provider ? { error: new RelayError('bad_response', 200) } : null;
    const handle = (event: SseEvent) => {
      const kind = event.event.startsWith('qutai.') ? event.event : qutaiType(event.data);
      if (kind === 'qutai.settlement') settlement = parseSettlement(event.data);
      else if (kind === 'qutai.error') cut = parseStreamError(event.data);
      else if (kind === 'qutai.paused') paused = parsePause(event.data);
      else if (!kind && !adapterError) {
        try {
          onEvent(event);
        } catch (error) {
          adapterError = { error };
        }
      }
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of decoder.push(value)) handle(event);
      }
      decoder.end().forEach(handle);
    } catch (e) {
      if (signal.aborted) throw e;
      // The connection to the server broke: what was charged is settled on the server; the balance is re-read.
      throw new RelayError('stream_lost', 0);
    }
    const s = settlement as RelaySettlementEvent | null;
    const pause = paused as RelayPause | null;
    const charge: Charge = {
      charged: s?.charged ?? 0,
      balance: s?.balance ?? null,
      ...(served ? { served } : {}),
      ...(pause ? { paused: pause } : {}),
    };
    if (charge.balance !== null) options.onBalance?.(charge.balance);
    const failed = adapterError as { error: unknown } | null;
    // The answer was in another format than the request's (refused before any event reached the adapter).
    if (failed?.error instanceof RelayError) throw new RelayError(failed.error.kind, 200, { charged: charge.charged });
    if (failed) throw attachCharge(failed.error, charge.charged);
    const brokenOff = cut as RelayStreamErrorEvent | null;
    if (brokenOff) throw new RelayError(brokenOff.code, 200, { charged: charge.charged });
    if (!s) throw new RelayError('stream_lost', 200);
    return charge;
  }

  /** A relay request answered with the provider's JSON (no streaming). */
  async function relayJson<T>(body: RelayRequest, signal: AbortSignal): Promise<{ json: T; charge: Charge }> {
    const res = await post({ ...body, stream: false }, signal);
    const charged = wholeHeader(res.headers.get('X-Qutai-Charged')) ?? 0;
    const balance = wholeHeader(res.headers.get('X-Qutai-Balance'));
    if (balance !== null) options.onBalance?.(balance);
    const served = servedFrom(res.headers);
    const continuation = res.headers.get('X-Qutai-Continuation');
    const expiresAt = wholeHeader(res.headers.get('X-Qutai-Continuation-Expires'));
    const paused = continuation && expiresAt !== null ? { continuation, expiresAt } : null;
    let json: T;
    try {
      json = (await res.json()) as T;
    } catch {
      throw new RelayError('bad_response', res.status, { charged });
    }
    // Another provider's answer than the request was built for: never read by this request's parser.
    if (served && served.provider !== body.provider) throw new RelayError('bad_response', res.status, { charged });
    return { json, charge: { charged, balance, ...(served ? { served } : {}), ...(paused ? { paused } : {}) } };
  }

  /**
   * `POST /purchases/verify` (backend/README.md › Purchases): reports a store purchase. Never throws for the server's
   * answers: the purchase flow (src/purchases/flow.ts) decides what each one means; no answer at all is `network`.
   */
  async function verifyPurchase(request: VerifyPurchaseRequest): Promise<VerifyAnswer> {
    const body = { store: request.store, transactionId: request.transactionId };
    try {
      return await withTimeout(VERIFY_TIMEOUT_MS, async (signal) => {
        const res = await authorized((token) =>
          fetchImpl(`${base}/purchases/verify`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              [APP_VERSION_HEADER]: options.appVersion,
            },
            body: JSON.stringify(body),
            signal,
          }),
        );
        if (!res.ok) return verifyError(res);
        const response = parseVerify(await readJson(res));
        if (response.balance !== null) options.onBalance?.(response.balance);
        return { ok: true, response } as const;
      });
    } catch (e) {
      if (e instanceof RelayError) {
        const code = e.kind === 'not_signed_in' ? 'not_signed_in' : e.kind === 'account_suspended' ? 'account_suspended' : e.kind;
        return { ok: false, status: e.status, code, ...(e.retryAfter ? { retryAfter: e.retryAfter } : {}) };
      }
      return { ok: false, status: 0, code: 'network' };
    }
  }

  /**
   * `POST /relay/intro`: the free introduction (backend README › Relay › Introduction). The server owns the
   * instructions; this sends only the user's words. Resolves with the server's answer as received (the caller reads it
   * as strictly as a model's answer); rejects with a RelayError on any refusal, or the abort error when `signal` ends.
   */
  async function intro(body: IntroRequestBody, signal: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const stop = () => controller.abort();
    signal.addEventListener('abort', stop);
    const timer = setTimeout(stop, INTRO_TIMEOUT_MS);
    try {
      const res = await authorized(async (token) =>
        fetchImpl(`${base}/relay/intro`, {
          method: 'POST',
          headers: {
            ...(options.deviceProof ? await options.deviceProof.headers('POST', '/relay/intro', true) : {}),
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            [APP_VERSION_HEADER]: options.appVersion,
          },
          body: wellFormedJson(body),
          signal: controller.signal,
        }),
      );
      if (!res.ok) {
        const error = await errorFrom(res);
        options.deviceProof?.observe(res.status, res.headers, error.reason ?? null);
        throw error;
      }
      options.deviceProof?.observe(res.status, res.headers, null);
      return await readJson(res);
    } catch (e) {
      if (signal.aborted) throw abortError();
      if (e instanceof RelayError) throw e;
      throw new RelayError(controller.signal.aborted ? 'timeout' : 'network', 0);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
    }
  }

  return { config, credits, relayStream, relayJson, verifyPurchase, intro };
}

/** `POST /relay/intro` body: the user's words only (backend packages/shared/src/intro.ts). */
export type IntroRequestBody =
  | { round: 'introduction'; language: string; text: string }
  | { round: 'answers'; language: string; answers: { about: string; text: string }[] };

/** A refusal of `POST /purchases/verify`, with the server's own code (`purchase_not_found`, `purchase_rejected`…). */
async function verifyError(res: Response): Promise<VerifyAnswer> {
  const retry = res.headers.get('Retry-After');
  const retryAfter = retry && /^\d{1,5}$/.test(retry) ? Number(retry) : undefined;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {}
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const code = typeof error.code === 'string' ? error.code : 'unknown';
  return { ok: false, status: res.status, code, ...(retryAfter ? { retryAfter } : {}) };
}

export function parseVerify(value: unknown): VerifyPurchaseResponse {
  const statuses = ['credited', 'refunded', 'revoked', 'held'];
  if (
    !isRecord(value) ||
    (value.store !== 'apple' && value.store !== 'google') ||
    typeof value.transactionId !== 'string' ||
    typeof value.status !== 'string' ||
    !statuses.includes(value.status) ||
    whole(value.credits) === null
  ) {
    throw new RelayError('bad_response', 200);
  }
  return {
    store: value.store,
    transactionId: value.transactionId,
    productId: typeof value.productId === 'string' ? value.productId : '',
    status: value.status as VerifyPurchaseResponse['status'],
    credits: whole(value.credits) as number,
    balance: whole(value.balance),
    replayed: value.replayed === true,
  };
}

export type CreditsClient = ReturnType<typeof createCreditsClient>;

/** Marks an error (one an adapter threw) with what its request was charged; read back by provider.ts chargedBy. */
function attachCharge(e: unknown, charged: number): unknown {
  if (e && typeof e === 'object' && !(e instanceof RelayError)) {
    try {
      Object.defineProperty(e, 'qutaiCharged', { value: charged, configurable: true });
    } catch {}
  }
  return e;
}

function abortError(): Error {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

function qutaiType(data: unknown): string | null {
  const type = isRecord(data) ? data.type : undefined;
  return typeof type === 'string' && type.startsWith('qutai.') ? type : null;
}

/** The error answer as a RelayError (a server code it doesn't know, or no readable body: by status). */
export async function errorFrom(res: Response): Promise<RelayError> {
  const retry = res.headers.get('Retry-After');
  const retryAfter = retry && /^\d{1,5}$/.test(retry) ? Number(retry) : undefined;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {}
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const code = typeof error.code === 'string' ? error.code : '';
  const upstream = isRecord(error.upstream) ? parseUpstream(error.upstream) : undefined;
  const tier = isRecord(error.tier) ? error.tier : {};
  const movedTo = isRelayProvider(tier.provider) ? tier.provider : undefined;
  return new RelayError(RelayError.kindFor(code, res.status), res.status, {
    retryAfter,
    upstream,
    ...(movedTo ? { movedTo } : {}),
    ...(typeof error.reason === 'string' && /^[a-z_]{1,40}$/.test(error.reason) ? { reason: error.reason } : {}),
    requestId: typeof error.requestId === 'string' ? error.requestId : (res.headers.get('X-Request-Id') ?? undefined),
  });
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new RelayError('bad_response', res.status);
  }
}

function parseUpstream(u: Record<string, unknown>): UpstreamError {
  const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 500) : undefined);
  return {
    status: typeof u.status === 'number' ? u.status : 0,
    ...(text(u.type) ? { type: text(u.type) } : {}),
    ...(text(u.code) ? { code: text(u.code) } : {}),
    ...(text(u.message) ? { message: text(u.message) } : {}),
  };
}

function wholeHeader(value: string | null): number | null {
  if (value === null || !/^-?\d{1,16}$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);

export function parseSettlement(data: unknown): RelaySettlementEvent | null {
  if (!isRecord(data)) return null;
  const charged = whole(data.charged);
  if (charged === null || charged < 0) return null;
  const outcome = ['completed', 'upstream_error', 'upstream_timeout', 'client_closed'].includes(String(data.outcome))
    ? (data.outcome as RelaySettlementEvent['outcome'])
    : 'completed';
  return { type: 'qutai.settlement', charged, balance: whole(data.balance), outcome };
}

/** `qutai.paused` `{ type, continuation, expiresAt }`; null when malformed (the task then stops with the pause note). */
export function parsePause(data: unknown): RelayPause | null {
  if (!isRecord(data) || typeof data.continuation !== 'string' || !data.continuation) return null;
  const expiresAt = whole(data.expiresAt);
  return expiresAt === null ? null : { continuation: data.continuation, expiresAt };
}

/** The answer's `X-Qutai-*` headers: what really served it. Null when the server named no provider it can parse. */
export function servedFrom(headers: Headers): RelayServed | null {
  const provider = headers.get('X-Qutai-Provider');
  if (!isRelayProvider(provider)) return null;
  const model = headers.get('X-Qutai-Model') ?? '';
  const tier = headers.get('X-Qutai-Tier');
  const route = headers.get('X-Qutai-Route');
  return {
    provider,
    model: model.slice(0, 200),
    ...(tier ? { tier: tier.slice(0, 64) } : {}),
    ...(route ? { route: route.slice(0, 2000) } : {}),
  };
}

function parseStreamError(data: unknown): RelayStreamErrorEvent {
  const code = isRecord(data) && data.code === 'upstream_timeout' ? 'upstream_timeout' : 'upstream_error';
  return { type: 'qutai.error', code };
}

/** `GET /config`, keeping only what is well formed (a model without a provider or id is dropped). */
function parsePrices(list: unknown) {
  return Array.isArray(list)
    ? list.flatMap((p) => {
        if (!isRecord(p)) return [];
        const n = (k: string) => whole(p[k]) ?? 0;
        return [
          {
            aboveInputTokens: n('aboveInputTokens'),
            inputPerMTok: n('inputPerMTok'),
            outputPerMTok: n('outputPerMTok'),
            cacheReadPerMTok: n('cacheReadPerMTok'),
            cacheWritePerMTok: n('cacheWritePerMTok'),
            thinkingPerMTok: n('thinkingPerMTok'),
            perSearch: n('perSearch'),
          },
        ];
      })
    : [];
}

function parseLimits(value: unknown): Record<string, number> {
  const limits: Record<string, number> = {};
  if (isRecord(value)) {
    for (const [k, v] of Object.entries(value)) {
      const n = whole(v);
      if (n !== null && n > 0) limits[k] = n;
    }
  }
  return limits;
}

/**
 * `/config` › `tiers`: well-formed ones only (a known format, a valid id, no duplicates), sorted by `order`; exactly
 * one default (the server's, else the first).
 */
export function parseTiers(value: unknown, topLimits: Record<string, number>): Tier[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tiers = value.flatMap((t, i): Tier[] => {
    if (!isRecord(t) || typeof t.id !== 'string' || !TIER_ID.test(t.id) || seen.has(t.id) || !isRelayProvider(t.format)) return [];
    seen.add(t.id);
    const served = isRecord(t.servedBy) && typeof t.servedBy.provider === 'string' && typeof t.servedBy.model === 'string'
      ? { provider: t.servedBy.provider.slice(0, 40), model: t.servedBy.model.slice(0, 200) }
      : null;
    const approx = whole(t.approxCreditsPerStep);
    return [
      {
        id: t.id,
        order: whole(t.order) ?? i,
        default: t.default === true,
        format: t.format,
        maxOutputTokens: whole(t.maxOutputTokens) ?? 0,
        webSearch: t.webSearch === true,
        limits: { ...topLimits, ...parseLimits(t.limits) },
        approxCreditsPerStep: approx !== null && approx >= 0 ? approx : null,
        prices: parsePrices(t.prices),
        servedBy: served,
      },
    ];
  });
  tiers.sort((a, b) => a.order - b.order);
  const def = tiers.find((t) => t.default) ?? tiers[0];
  return tiers.map((t) => ({ ...t, default: t === def }));
}

export function parseConfig(value: unknown): PublicConfig {
  if (!isRecord(value)) throw new RelayError('bad_response', 200);
  const models = Array.isArray(value.models)
    ? value.models.flatMap((m) => {
        if (!isRecord(m) || typeof m.provider !== 'string' || typeof m.model !== 'string' || !m.model) return [];
        const prices = parsePrices(m.prices);
        return [
          {
            provider: m.provider,
            model: m.model,
            maxOutputTokens: whole(m.maxOutputTokens) ?? 0,
            webSearch: m.webSearch === true,
            prices,
          },
        ];
      })
    : [];
  const limits = parseLimits(value.limits);
  const maintenance = isRecord(value.maintenance) ? value.maintenance : {};
  const packs = Array.isArray(value.packs)
    ? value.packs.flatMap((p) =>
        isRecord(p) && (p.store === 'apple' || p.store === 'google') && typeof p.productId === 'string' && whole(p.credits) !== null
          ? [{ store: p.store as 'apple' | 'google', productId: p.productId, credits: whole(p.credits) as number }]
          : [],
      )
    : [];
  return {
    packs,
    models,
    tiers: parseTiers(value.tiers, limits),
    // An older server has no such field and takes only the direct form.
    directModels: value.directModels !== false,
    limits,
    minAppVersion: typeof value.minAppVersion === 'string' ? value.minAppVersion : null,
    maintenance: {
      enabled: maintenance.enabled === true,
      message: typeof maintenance.message === 'string' && maintenance.message.trim() ? maintenance.message.slice(0, 300) : null,
    },
    // Sign-in methods beyond the native ones (Android's Sign in with Apple button). Only an explicit `true` turns one on;
    // an older server without `auth` leaves it absent.
    ...(isRecord(value.auth) ? { auth: { appleWeb: value.auth.appleWeb === true } } : {}),
    // Server backup: only with both numbers (an older server has no `backups`; the app then hides the section).
    ...(isRecord(value.backups) && whole(value.backups.maxBytes) !== null && whole(value.backups.keep) !== null
      ? { backups: { maxBytes: whole(value.backups.maxBytes) as number, keep: whole(value.backups.keep) as number } }
      : {}),
  };
}

const KINDS = ['purchase', 'grant', 'reserve', 'settle', 'refund', 'revoke'] as const;

export function parseCredits(value: unknown): CreditsResponse {
  if (!isRecord(value) || whole(value.balance) === null) throw new RelayError('bad_response', 200);
  const task = isRecord(value.activeTask) ? value.activeTask : null;
  return {
    balance: whole(value.balance) as number,
    activeTask:
      task && typeof task.reservationId === 'string'
        ? {
            reservationId: task.reservationId,
            reserved: whole(task.reserved) ?? 0,
            startedAt: whole(task.startedAt) ?? 0,
            expiresAt: whole(task.expiresAt) ?? 0,
          }
        : null,
    entries: Array.isArray(value.entries)
      ? value.entries.flatMap((e) =>
          isRecord(e) && typeof e.id === 'string' && KINDS.includes(e.kind as never) && whole(e.amount) !== null && whole(e.at) !== null
            ? [{ id: e.id, kind: e.kind as (typeof KINDS)[number], amount: whole(e.amount) as number, at: whole(e.at) as number }]
            : [],
        )
      : [],
  };
}

/** Compares dotted versions ("1.4.0" < "1.10"); missing parts count as 0, anything not a number as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((p) => parseInt(p, 10) || 0);
  const pb = b.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
