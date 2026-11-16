// "Test connection" for a custom OpenAI-compatible endpoint (src/ai/customTest.ts) against a fake fetch: every branch
// of testCustomEndpoint, and that a line is green only for what a request showed. The owner's case: a Cloudflare
// Workers AI address with a wrong path, where every request answers 400 "No route for that URI".
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { testCustomEndpoint, type Check } from '../../src/ai/customTest.ts';

const ACCOUNT = '0123456789abcdef0123456789abcdef';
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run`;
const KEY = 'test-key-value-0001';
const OWNER_BODY = '{"success":false,"errors":[{"code":7000,"message":"No route for that URI"}],"messages":[],"result":null}';

type Reply = { status: number; body: string; contentType?: string } | 'network';
type Route = (req: { url: string; method: string; body: any }) => Reply;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function fakeFetch(route: Route) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const r = route({ url, method: init.method ?? 'GET', body });
    if (r === 'network') throw new TypeError('Network request failed');
    return new Response(r.body, { status: r.status, headers: { 'content-type': r.contentType ?? 'application/json' } });
  }) as typeof fetch;
}

const sse = (chunks: unknown[]) => chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';
const toolCall = JSON.stringify({
  choices: [
    {
      index: 0,
      finish_reason: 'tool_calls',
      message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'ping', arguments: '{}' } }] },
    },
  ],
});
const plainReply = JSON.stringify({ choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'OK' } }] });
const streamReply = sse([
  { choices: [{ index: 0, delta: { role: 'assistant', content: 'OK' } }] },
  { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
]);
const modelList = (ids: string[]) => JSON.stringify({ object: 'list', data: ids.map((id) => ({ id })) });

/** A working server, with parts replaced. */
function server(overrides: { models?: Reply; tools?: Reply; stream?: Reply; images?: Reply } = {}): Route {
  return ({ url, method, body }) => {
    if (method === 'GET' && url.endsWith('/models')) return overrides.models ?? { status: 200, body: modelList(['m1']) };
    if (body?.tools) return overrides.tools ?? { status: 200, body: toolCall };
    if (body?.stream) return overrides.stream ?? { status: 200, body: streamReply, contentType: 'text/event-stream' };
    if (Array.isArray(body?.messages?.[0]?.content)) return overrides.images ?? { status: 200, body: plainReply };
    return { status: 500, body: 'unexpected' };
  };
}

async function run(route: Route, opts: { base?: string; key?: string; model?: string; headers?: { name: string; value: string }[] } = {}) {
  fakeFetch(route);
  const progress: Check[][] = [];
  const checks = await testCustomEndpoint(
    opts.base ?? 'https://llm.example.com/v1',
    opts.key ?? KEY,
    opts.headers ?? [],
    opts.model ?? 'm1',
    new AbortController().signal,
    (c) => progress.push(c),
  );
  assert.deepEqual(progress.at(-1), checks, 'the last progress report is the result');
  return checks;
}

const states = (checks: Check[]) => checks.map((c) => `${c.key}:${c.state}${c.reason ? `/${c.reason}` : ''}`);
const line = (checks: Check[], key: Check['key']) => checks.find((c) => c.key === key);

test("the owner's Cloudflare address with a wrong path: an address problem, nothing green beyond reachable", async () => {
  const checks = await run(() => ({ status: 400, body: OWNER_BODY }), { base: BASE, model: 'claude-sonnet' });
  assert.deepEqual(states(checks), ['reach:ok', 'auth:skip', 'model:skip', 'address:fail']);
  const detail = line(checks, 'address')!.detail!;
  assert.match(detail, /^400: No route for that URI\n/);
  assert.ok(detail.includes(`${BASE}/chat/completions`), 'says where the request went');
  assert.ok(!checks.some((c) => c.key === 'tools'), 'not reported as missing tool calling');
});

test('working server: every line green', async () => {
  const checks = await run(server());
  assert.deepEqual(states(checks), ['reach:ok', 'auth:ok', 'model:ok', 'tools:ok', 'stream:ok', 'images:ok']);
});

test('no key: accepted, with the note that no key was sent', async () => {
  const checks = await run(server(), { key: '' });
  assert.equal(line(checks, 'auth')!.state, 'ok');
  assert.match(line(checks, 'auth')!.detail!, /No key was sent/);
});

test('no answer at all: not reachable, nothing else', async () => {
  const checks = await run(() => 'network');
  assert.deepEqual(states(checks), ['reach:fail']);
  assert.match(checks[0].detail!, /Network request failed/);
});

test('401 on the model list: not accepted', async () => {
  const checks = await run(server({ models: { status: 401, body: '{"error":{"message":"Invalid API key test-key-value-0001"}}' } }));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:fail']);
  assert.ok(!checks[1].detail!.includes(KEY), 'the key is never shown back');
});

test('403 on the chat request: not accepted', async () => {
  const checks = await run(server({ models: { status: 404, body: 'Not Found', contentType: 'text/plain' }, tools: { status: 403, body: '{"error":"forbidden"}' } }));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:fail']);
});

test('404 on chat without a model message: an address problem, with the /v1 hint when the path has no version', async () => {
  const checks = await run(() => ({ status: 404, body: '<!DOCTYPE html><html><body>Not Found</body></html>', contentType: 'text/html' }), {
    base: 'https://llm.example.com',
  });
  assert.deepEqual(states(checks), ['reach:ok', 'auth:skip', 'model:skip', 'address:fail']);
  assert.match(line(checks, 'address')!.detail!, /^404: a web page instead of an API answer/);
  assert.match(line(checks, 'address')!.detail!, /\/v1/);
});

test('405 on chat: an address problem', async () => {
  const checks = await run(server({ models: { status: 405, body: '' }, tools: { status: 405, body: '{"detail":"Method Not Allowed"}' } }));
  assert.equal(line(checks, 'address')!.state, 'fail');
});

test('200 with a web page (a site answering every path): an address problem, not tool calling', async () => {
  const checks = await run(() => ({ status: 200, body: '<!doctype html><html><head><title>Welcome</title></head></html>', contentType: 'text/html' }));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:skip', 'model:skip', 'address:fail']);
});

test('model listed but the path is wrong: model found (from the list), key accepted (the list answered)', async () => {
  const checks = await run(server({ tools: { status: 400, body: OWNER_BODY } }));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:ok', 'model:ok', 'address:fail']);
});

test('model not found (OpenAI wording, 404): model fails, not an address problem', async () => {
  const checks = await run(
    server({ tools: { status: 404, body: '{"error":{"message":"The model `m9` does not exist or you do not have access to it.","code":"model_not_found"}}' } }),
    { model: 'm9' },
  );
  assert.deepEqual(states(checks), ['reach:ok', 'auth:ok', 'model:fail']);
  assert.match(line(checks, 'model')!.detail!, /isn't in|doesn't include/);
});

test('model not found (Ollama wording) without a list', async () => {
  const checks = await run(server({ models: { status: 404, body: '404 page not found', contentType: 'text/plain' }, tools: { status: 404, body: '{"error":"model \'m9\' not found"}' } }), {
    model: 'm9',
  });
  assert.deepEqual(states(checks), ['reach:ok', 'auth:ok', 'model:fail']);
  assert.equal(line(checks, 'model')!.detail, "404: model 'm9' not found");
});

test('tools refused by the server: no tool calling', async () => {
  const checks = await run(server({ tools: { status: 400, body: '{"error":{"message":"registry.ollama.ai/library/m1 does not support tools"}}' } }));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:ok', 'model:ok', 'tools:fail']);
});

test('OpenRouter: no endpoint supports tool use (404): no tool calling, model not checked', async () => {
  const checks = await run(server({ models: { status: 500, body: '' }, tools: { status: 404, body: '{"error":{"message":"No endpoints found that support tool use."}}' } }));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:ok', 'model:skip', 'tools:fail']);
});

test('200 without the tool call: tool calling uncertain, the rest still checked', async () => {
  const checks = await run(server({ tools: { status: 200, body: plainReply } }));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:ok', 'model:ok', 'tools:warn', 'stream:ok', 'images:ok']);
});

test('200 and answering, but not in the list: model warns', async () => {
  const checks = await run(server(), { model: 'other' });
  assert.equal(line(checks, 'model')!.state, 'warn');
});

test('200 JSON that is not a chat reply: its own line', async () => {
  const checks = await run(server({ models: { status: 404, body: '' }, tools: { status: 200, body: '{"result":{"response":"hi"},"success":true}' } }));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:skip', 'model:skip', 'chat:fail/badResponse']);
});

test('429: rate limited, key and model not checked', async () => {
  const checks = await run(server({ models: { status: 404, body: '' }, tools: { status: 429, body: '{"error":{"message":"Rate limit reached"}}' } }));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:skip', 'model:skip', 'chat:fail/rateLimit']);
  assert.equal(line(checks, 'chat')!.detail, '429: Rate limit reached');
});

test('500/502: server error', async () => {
  for (const status of [500, 502]) {
    const checks = await run(server({ models: { status: 404, body: '' }, tools: { status, body: '<html><body>Bad gateway</body></html>', contentType: 'text/html' } }));
    assert.deepEqual(states(checks), ['reach:ok', 'auth:skip', 'model:skip', 'chat:fail/server']);
  }
});

test('400 with an OpenAI-style message: refused request with the message, the key counts as checked', async () => {
  const checks = await run(server({ models: { status: 404, body: '' }, tools: { status: 400, body: '{"error":{"message":"max_tokens is too large"}}' } }));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:ok', 'model:skip', 'chat:fail/badRequest']);
  assert.equal(line(checks, 'chat')!.detail, '400: max_tokens is too large');
});

test('the chat request gets no answer after the list did: its own line', async () => {
  const route = server();
  const checks = await run((req) => (req.body?.tools ? 'network' : route(req)));
  assert.deepEqual(states(checks), ['reach:ok', 'auth:ok', 'model:ok', 'chat:fail/network']);
});

test('stream and images failing: warnings with the server message, never green', async () => {
  const checks = await run(
    server({
      stream: { status: 400, body: '{"error":{"message":"stream not supported"}}' },
      images: { status: 400, body: '{"errors":[{"message":"image input not supported"}],"success":false}' },
    }),
  );
  assert.deepEqual(states(checks), ['reach:ok', 'auth:ok', 'model:ok', 'tools:ok', 'stream:warn', 'images:warn']);
  assert.match(line(checks, 'stream')!.detail!, /^400: stream not supported Replies will come without streaming\.$/);
  assert.equal(line(checks, 'images')!.detail, '400: image input not supported');
});

test('extra header values echoed by a server are never shown', async () => {
  const checks = await run(server({ tools: { status: 400, body: '{"error":{"message":"bad header cf-aig-authorization: Bearer gw-secret-1234 / x-team: team-secret-99"}}' } }), {
    headers: [{ name: 'x-team', value: 'team-secret-99' }],
  });
  const detail = line(checks, 'chat')!.detail!;
  assert.ok(!detail.includes('gw-secret-1234') && !detail.includes('team-secret-99'), detail);
});
