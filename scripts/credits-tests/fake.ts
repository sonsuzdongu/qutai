// A fake of Qutai's server for the credits tests: `GET /config`, `GET /credits`, `POST /relay` and `POST /purchases/verify`, with answers the
// test sets (shapes as in backend/README.md › Relay). Every request is recorded with its headers and body.
import { createCreditsClient, type CreditsClientOptions } from '../../src/credits/client.ts';
import type { PublicConfig } from '../../src/credits/types.ts';

export type Recorded = { method: string; path: string; headers: Record<string, string>; body: any };
export type Answer = Response | ((req: Recorded) => Response | Promise<Response>);

export const CONFIG: PublicConfig = {
  packs: [],
  models: [
    { provider: 'anthropic', model: 'claude-sonnet-5-5', maxOutputTokens: 16000, webSearch: true, prices: [price()] },
    { provider: 'openai', model: 'gpt-5.6-terra', maxOutputTokens: 32000, webSearch: false, prices: [price()] },
    { provider: 'gemini', model: 'gemini-3.8-flash', maxOutputTokens: 32000, webSearch: true, prices: [price()] },
  ],
  // An older server: no tiers, the direct form (what parseConfig makes of a /config without `tiers`).
  tiers: [],
  directModels: true,
  limits: { maxRequestBytes: 8000000, maxImages: 8, maxSteps: 40, maxResearchSteps: 80, maxMemoryChars: 8000, maxCustomInstructionsChars: 500 },
  minAppVersion: '1.0.0',
  maintenance: { enabled: false, message: null },
};

function price() {
  return { aboveInputTokens: 0, inputPerMTok: 260_000_000, outputPerMTok: 1_300_000_000, cacheReadPerMTok: 0, cacheWritePerMTok: 0, thinkingPerMTok: 0, perSearch: 0 };
}

/** A server-sent events body from (event name, data) pairs, sent in pieces of `chunk` bytes. */
export function sse(events: [string | null, unknown][], chunk = 7): Response {
  const text = events.map(([event, data]) => `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunk) controller.enqueue(bytes.slice(i, i + chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export function error(code: string, status: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return json({ error: { code, message: 'x', requestId: 'req-1', ...extra } }, status, headers);
}

export const settlement = (charged: number, balance: number | null = 9_000_000, outcome = 'completed') =>
  ['qutai.settlement', { type: 'qutai.settlement', charged, balance, outcome }] as [string, unknown];

/** A fake server; `relay` answers are taken in order (the last one repeats). */
export function fakeServer(opts: { relay?: Answer[]; config?: PublicConfig; credits?: Answer; verify?: Answer[]; organise?: Answer } = {}) {
  const requests: Recorded[] = [];
  const relay = [...(opts.relay ?? [])];
  const verify = [...(opts.verify ?? [])];
  let tokenNo = 1;
  const valid = new Set(['token-1']);
  const events = { renewed: 0, suspended: 0, ended: 0, balances: [] as number[] };

  const fetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(input);
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k] = v));
    const rec: Recorded = { method: init.method ?? 'GET', path: url.pathname + url.search, headers, body: init.body ? JSON.parse(String(init.body)) : undefined };
    requests.push(rec);
    if (url.pathname === '/config') return json(opts.config ?? CONFIG);
    const token = headers.authorization?.replace(/^Bearer /, '');
    if (!token || !valid.has(token)) return error('unauthorized', 401);
    if (url.pathname.startsWith('/credits')) {
      const a = opts.credits ?? json({ balance: 5_000_000, activeTask: null, entries: [{ id: 'e1', kind: 'grant', amount: 5_000_000, at: 1 }] });
      return typeof a === 'function' ? a(rec) : a;
    }
    if (url.pathname === '/relay') {
      const a = relay.length > 1 ? relay.shift()! : relay[0];
      if (!a) return error('unavailable', 503);
      return typeof a === 'function' ? a(rec) : a;
    }
    // Absent: an older server without the route (404 below).
    if (url.pathname === '/relay/organise-memory' && opts.organise) return typeof opts.organise === 'function' ? opts.organise(rec) : opts.organise;
    if (url.pathname === '/purchases/verify') {
      const a = verify.length > 1 ? verify.shift()! : verify[0];
      if (!a) return error('unavailable', 503);
      return typeof a === 'function' ? a(rec) : a;
    }
    return error('not_found', 404);
  };

  const client = (extra: Partial<CreditsClientOptions> = {}) =>
    createCreditsClient({
      baseUrl: 'https://api.example.test/',
      appVersion: '1.2.0',
      fetch,
      sleep: async () => {},
      tokens: {
        get: async () => `token-${tokenNo}`,
        renew: async () => {
          events.renewed++;
          tokenNo++;
          return `token-${tokenNo}`;
        },
        suspended: () => events.suspended++,
        ended: () => events.ended++,
      },
      onBalance: (b) => events.balances.push(b),
      ...extra,
    });

  return {
    requests,
    events,
    client,
    /** Makes the current token stale (the next request gets 401 until renewed); `alsoNext`: the renewed one too. */
    expireToken(alsoNext = false) {
      valid.clear();
      if (!alsoNext) valid.add(`token-${tokenNo + 1}`);
    },
    relayRequests: () => requests.filter((r) => r.path === '/relay'),
  };
}
