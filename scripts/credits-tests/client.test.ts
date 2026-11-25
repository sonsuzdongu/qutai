// The credits client (src/credits/client.ts): relay requests, the stream with the server's own events, refusals,
// waiting, token renewal, `GET /config` and `GET /credits`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareVersions, parseConfig, parseCredits, parseSettlement } from '../../src/credits/client.ts';
import { nothingSent, RelayError, relayErrorMessage, type RelayErrorKind } from '../../src/credits/errors.ts';
import { setLanguage } from '../../src/i18n/index.ts';
import { en } from '../../src/i18n/en.ts';
import { tr } from '../../src/i18n/tr.ts';
import type { RelayRequest } from '../../src/credits/types.ts';
import { error, fakeServer, json, settlement, sse } from './fake.ts';

const BODY: RelayRequest = {
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  profile: 'a'.repeat(64),
  step: 0,
  stream: true,
  options: { memoryTools: true },
  context: { customInstructions: 'Be brief' },
  input: [{ role: 'user', content: 'hi' }],
};
const signal = () => new AbortController().signal;

test('a streamed request: headers, body, the provider’s events handed on, the settlement kept apart', async () => {
  const server = fakeServer({
    relay: [sse([['message_start', { type: 'message_start' }], ['content_block_delta', { type: 'content_block_delta', delta: { text: 'Hello' } }], settlement(1234, 8_765_000)])],
  });
  const seen: unknown[] = [];
  const charge = await server.client().relayStream(BODY, signal(), (e) => seen.push(e.data));
  assert.deepEqual(charge, { charged: 1234, balance: 8_765_000 });
  assert.equal(seen.length, 2, 'only the provider’s events reach the adapter');
  assert.deepEqual(server.events.balances, [8_765_000]);
  const [req] = server.relayRequests();
  assert.equal(req.method, 'POST');
  assert.equal(req.headers.authorization, 'Bearer token-1');
  assert.equal(req.headers['x-qutai-app-version'], '1.2.0');
  assert.equal(req.headers.accept, 'text/event-stream');
  assert.ok(!('x-api-key' in req.headers) && !('x-goog-api-key' in req.headers));
  assert.deepEqual(Object.keys(req.body).sort(), ['context', 'input', 'model', 'options', 'profile', 'provider', 'step', 'stream']);
  assert.equal(req.body.stream, true);
});

test('a stream the server reports as cut: the charge comes with the error', async () => {
  const server = fakeServer({
    relay: [sse([['message_start', { type: 'message_start' }], ['qutai.error', { type: 'qutai.error', code: 'upstream_timeout' }], settlement(500, 100, 'upstream_timeout')])],
  });
  await assert.rejects(server.client().relayStream(BODY, signal(), () => {}), (e: unknown) => {
    assert.ok(e instanceof RelayError);
    assert.equal(e.kind, 'upstream_timeout');
    assert.equal(e.charged, 500);
    assert.equal(e.final, false, 'like a broken stream: Gemini may try again without streaming');
    return true;
  });
  assert.deepEqual(server.events.balances, [100]);
});

test('an adapter that gives up mid-stream: its own error, with the charge, after the settlement was read', async () => {
  const server = fakeServer({ relay: [sse([['error', { type: 'error' }], ['x', { type: 'later' }], settlement(42)])] });
  let calls = 0;
  const boom = new Error('Overloaded');
  await assert.rejects(
    server.client().relayStream(BODY, signal(), () => {
      calls++;
      throw boom;
    }),
    (e: unknown) => e === boom && (e as { qutaiCharged?: number }).qutaiCharged === 42,
  );
  assert.equal(calls, 1, 'nothing more is handed to the adapter once it failed');
});

test('a stream that ends without the settlement is a lost connection', async () => {
  const server = fakeServer({ relay: [sse([['message_start', { type: 'message_start' }]])] });
  await assert.rejects(server.client().relayStream(BODY, signal(), () => {}), (e: unknown) => e instanceof RelayError && e.kind === 'stream_lost');
});

test('not streamed: the provider’s JSON, the charge and balance from the headers', async () => {
  const server = fakeServer({ relay: [json({ content: [] }, 200, { 'X-Qutai-Charged': '77', 'X-Qutai-Balance': '1000' })] });
  const r = await server.client().relayJson(BODY, signal());
  assert.deepEqual(r, { json: { content: [] }, charge: { charged: 77, balance: 1000 } });
  assert.equal(server.relayRequests()[0].body.stream, false);
});

const REFUSALS: [string, number, RelayErrorKind, Record<string, string>?][] = [
  ['unauthorized', 401, 'not_signed_in'],
  ['insufficient_credits', 402, 'insufficient_credits'],
  ['task_active', 409, 'task_active', { 'Retry-After': '120' }],
  ['rate_limited', 429, 'rate_limited', { 'Retry-After': '60' }],
  ['model_not_allowed', 400, 'model_not_allowed'],
  ['payload_too_large', 413, 'payload_too_large'],
  ['step_limit', 400, 'step_limit'],
  ['account_suspended', 403, 'account_suspended'],
  ['maintenance', 503, 'maintenance'],
  ['unavailable', 503, 'unavailable', { 'Retry-After': '300' }],
  ['upgrade_required', 426, 'upgrade_required'],
  ['profile_unknown', 409, 'profile_unknown'],
  ['bad_request', 400, 'bad_request'],
  ['upstream_unavailable', 503, 'upstream_unavailable', { 'Retry-After': '60' }],
  ['upstream_error', 502, 'upstream_error'],
  ['upstream_timeout', 504, 'upstream_timeout'],
  ['internal', 500, 'unknown'],
];

for (const [code, status, kind, headers] of REFUSALS) {
  test(`refusal ${code} → ${kind}, nothing charged`, async () => {
    // task_active is asked again for up to 70 s first (a fresh answer each time).
    const server = fakeServer({ relay: Array.from({ length: code === 'task_active' ? 12 : 1 }, () => error(code, status, {}, headers)) });
    if (code === 'unauthorized') server.expireToken(true);
    await assert.rejects(server.client().relayStream(BODY, signal(), () => {}), (e: unknown) => {
      assert.ok(e instanceof RelayError);
      assert.equal(e.kind, kind);
      assert.equal(e.charged, 0);
      assert.equal(nothingSent(e), !['upstream_error', 'upstream_timeout'].includes(kind));
      return true;
    });
    if (code === 'account_suspended') assert.equal(server.events.suspended, 1);
  });
}

test('every kind has its own message, in English and Turkish', () => {
  const kinds: RelayErrorKind[] = [
    'not_signed_in', 'insufficient_credits', 'task_active', 'rate_limited', 'model_not_allowed', 'payload_too_large',
    'step_limit', 'account_suspended', 'maintenance', 'unavailable', 'upgrade_required', 'profile_unknown', 'bad_request',
    'upstream_unavailable', 'upstream_error', 'upstream_timeout', 'upstream_rejected', 'network', 'timeout', 'stream_lost',
    'bad_response', 'not_accepted', 'unknown',
  ];
  try {
    for (const lang of ['en', 'tr'] as const) {
      setLanguage(lang);
      const dict: Record<string, string> = lang === 'en' ? en : tr;
      for (const kind of kinds) {
        const message = relayErrorMessage(kind);
        assert.ok(message.length > 20 && Object.values(dict).includes(message), `${lang} ${kind}`);
        assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(message), 'no emoji');
      }
      assert.match(relayErrorMessage('rate_limited', { retryAfter: 30 }), /30/);
      assert.match(relayErrorMessage('maintenance', { detail: 'Back at 10' }), /Back at 10/);
    }
    setLanguage('en');
    assert.match(new RelayError('insufficient_credits', 402).message, /Buy credits/);
  } finally {
    setLanguage('en');
  }
});

test('the relay’s own short waits are waited out, then the request goes through', async () => {
  const server = fakeServer({ relay: [error('task_active', 409, {}, { 'Retry-After': '2' }), error('rate_limited', 429, {}, { 'Retry-After': '1' }), sse([settlement(9)])] });
  const waits: number[] = [];
  const charge = await server.client({ sleep: async (ms) => void waits.push(ms) }).relayStream(BODY, signal(), () => {});
  assert.equal(charge.charged, 9);
  assert.deepEqual(waits, [2000, 1000]);
  assert.equal(server.relayRequests().length, 3);
});

test('a long wait isn’t waited out: the user is told', async () => {
  const server = fakeServer({ relay: [error('rate_limited', 429, {}, { 'Retry-After': '120' })] });
  await assert.rejects(server.client().relayStream(BODY, signal(), () => {}), (e: unknown) => e instanceof RelayError && e.kind === 'rate_limited');
  assert.equal(server.relayRequests().length, 1);
});

test('task_active: asked again every few seconds for up to 70 s (a stopped step settling, a lapsed 60 s lease)', async () => {
  const busy = () => error('task_active', 409, {}, { 'Retry-After': '45' });
  const freed = fakeServer({ relay: [busy(), busy(), busy(), sse([settlement(4)])] });
  const waits: number[] = [];
  const charge = await freed.client({ sleep: async (ms) => void waits.push(ms) }).relayStream(BODY, signal(), () => {});
  assert.equal(charge.charged, 4);
  assert.deepEqual(waits, [10_000, 10_000, 10_000]);

  // A task really running elsewhere: after 70 s in all, the user is told.
  const taken = fakeServer({ relay: Array.from({ length: 12 }, busy) });
  const waited: number[] = [];
  await assert.rejects(
    taken.client({ sleep: async (ms) => void waited.push(ms) }).relayStream(BODY, signal(), () => {}),
    (e: unknown) => e instanceof RelayError && e.kind === 'task_active',
  );
  assert.equal(waited.reduce((a, b) => a + b, 0), 70_000);
  assert.equal(taken.relayRequests().length, 8);
});

test('an expired access token is renewed once and the request repeated', async () => {
  const server = fakeServer({ relay: [sse([settlement(1)])] });
  server.expireToken();
  await server.client().relayStream(BODY, signal(), () => {});
  assert.equal(server.events.renewed, 1);
  assert.deepEqual(server.relayRequests().map((r) => r.headers.authorization), ['Bearer token-1', 'Bearer token-2']);
});

test('a renewed token refused too: the session is over', async () => {
  const server = fakeServer({ relay: [sse([settlement(1)])] });
  server.expireToken(true);
  await assert.rejects(server.client().relayStream(BODY, signal(), () => {}), (e: unknown) => e instanceof RelayError && e.kind === 'not_signed_in');
  assert.equal(server.events.ended, 1);
});

test('signed out: nothing is sent', async () => {
  const server = fakeServer();
  const client = server.client({ tokens: { get: () => Promise.reject(new Error('signed out')), renew: () => Promise.reject(new Error()), suspended() {}, ended() {} } });
  await assert.rejects(client.relayStream(BODY, signal(), () => {}), (e: unknown) => e instanceof RelayError && e.kind === 'not_signed_in');
  assert.equal(server.requests.length, 0);
});

test('no answer at all: tried again, then "can’t be reached"', async () => {
  let calls = 0;
  const server = fakeServer();
  const client = server.client({
    fetch: async () => {
      calls++;
      throw new TypeError('Network request failed');
    },
  });
  await assert.rejects(client.relayStream(BODY, signal(), () => {}), (e: unknown) => e instanceof RelayError && e.kind === 'network');
  assert.equal(calls, 3);
});

test('a re-send after the connection was cut sends the identical body, step key included (the server charges it once)', async () => {
  const bodies: string[] = [];
  const client = fakeServer().client({
    fetch: async (_url, init) => {
      bodies.push(String(init?.body));
      throw new TypeError('Network request failed');
    },
  });
  await assert.rejects(client.relayStream({ ...BODY, stepKey: 'step-0123456789abcdef' }, signal(), () => {}));
  assert.equal(bodies.length, 3);
  assert.ok(bodies.every((b) => b === bodies[0]));
  assert.equal(JSON.parse(bodies[0]!).stepKey, 'step-0123456789abcdef');
});

test('stopping aborts the request as it is', async () => {
  const controller = new AbortController();
  const server = fakeServer();
  const client = server.client({
    fetch: (_url, init) =>
      new Promise((_, reject) => {
        const abort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        if (init?.signal?.aborted) abort();
        init?.signal?.addEventListener('abort', abort);
      }),
  });
  const run = client.relayStream(BODY, controller.signal, () => {});
  controller.abort();
  await assert.rejects(run, (e: unknown) => (e as Error).name === 'AbortError');
});

test('GET /config and GET /credits are read and checked', async () => {
  const server = fakeServer();
  const client = server.client();
  const config = await client.config();
  assert.equal(config.models.length, 3);
  assert.equal(config.limits.maxSteps, 40);
  const credits = await client.credits(100);
  assert.equal(credits.balance, 5_000_000);
  assert.deepEqual(server.events.balances, [5_000_000]);
  assert.equal(server.requests.find((r) => r.path.startsWith('/credits'))!.path, '/credits?limit=100');
  assert.equal(server.requests.find((r) => r.path === '/config')!.headers.authorization, undefined, 'config needs no account');
});

test('parsers keep only well-formed data', () => {
  const config = parseConfig({ models: [{ provider: 'anthropic', model: '' }, { provider: 'x', model: 'y', prices: [{}] }], limits: { a: -1, b: 2 }, maintenance: { enabled: true, message: ' ' } });
  assert.equal(config.models.length, 1);
  assert.deepEqual(config.limits, { b: 2 });
  assert.deepEqual(config.maintenance, { enabled: true, message: null });
  // Fake purchases were removed (21 Nov 2026, BUY-21): an old server's `purchases: { mode: 'fake' }` changes nothing.
  assert.equal('purchases' in parseConfig({ purchases: { mode: 'fake' } }), false);
  assert.throws(() => parseCredits({ balance: 1.5 }), RelayError);
  assert.deepEqual(parseCredits({ balance: -3, entries: [{ id: 'a', kind: 'bogus', amount: 1, at: 1 }, { id: 'b', kind: 'settle', amount: 2, at: 3 }] }).entries, [
    { id: 'b', kind: 'settle', amount: 2, at: 3 },
  ]);
  assert.equal(parseSettlement({ charged: -1 }), null);
  assert.deepEqual(parseSettlement({ charged: 3, balance: null, outcome: 'client_closed' }), { type: 'qutai.settlement', charged: 3, balance: null, outcome: 'client_closed' });
  assert.equal(compareVersions('1.10.0', '1.9'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('0.9.9', '1.0.0'), -1);
});
