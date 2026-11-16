// Reading servers' error answers (src/ai/serverError.ts) and the message the chat shows at task time (http.ts,
// chatCompletions.ts): the server's short message instead of "API error 400" alone, never a key.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { custom } from '../../src/ai/custom.ts';
import { ApiError, getJson } from '../../src/ai/http.ts';
import { classifyFailure, redact, serverMessage } from '../../src/ai/serverError.ts';
import type { ModelRequest } from '../../src/ai/types.ts';

const OWNER_BODY = '{"success":false,"errors":[{"code":7000,"message":"No route for that URI"}],"messages":[],"result":null}';

test('messages from every error shape', () => {
  assert.equal(serverMessage(OWNER_BODY), 'No route for that URI');
  assert.equal(serverMessage('{"error":{"message":"Invalid model"}}'), 'Invalid model');
  assert.equal(serverMessage('{"error":"plain"}'), 'plain');
  assert.equal(serverMessage('[{"error":{"message":"gemini says"}}]'), 'gemini says');
  assert.equal(serverMessage('{"detail":"Not Found"}'), 'Not Found');
  assert.equal(serverMessage('{"detail":[{"msg":"field required"},{"msg":"bad"}]}'), 'field required; bad');
  assert.equal(serverMessage('{"message":"nope"}'), 'nope');
  assert.equal(serverMessage('  some\n  plain   text '), 'some plain text');
  assert.equal(serverMessage('<!DOCTYPE html><html>…</html>'), '');
  assert.equal(serverMessage('{"ok":true}'), '');
  assert.equal(serverMessage('x'.repeat(500)).length, 200);
});

test('credentials are removed from messages', () => {
  assert.equal(redact('Invalid key sk-abcdefghijklmnop'), 'Invalid key …');
  assert.equal(redact('Authorization: Bearer abc.def.ghi'), 'Authorization: Bearer …');
  assert.equal(redact('got my-own-secret-value back', ['my-own-secret-value']), 'got … back');
  assert.equal(redact('key AIzaSyA1234567890abcdefghijklmnop'), 'key …');
  assert.equal(serverMessage('{"error":{"message":"Incorrect API key provided: sk-proj-abcdefghijkl"}}'), 'Incorrect API key provided: …');
});

test('classification', () => {
  assert.equal(classifyFailure(400, OWNER_BODY), 'path');
  assert.equal(classifyFailure(404, '{"error":{"message":"Not found"}}'), 'path');
  assert.equal(classifyFailure(404, '404 page not found'), 'path');
  assert.equal(classifyFailure(405, ''), 'path');
  assert.equal(classifyFailure(400, '<html><body>Bad Request</body></html>'), 'path');
  assert.equal(classifyFailure(400, 'Cannot POST /v1/chat/completions'), 'path');
  assert.equal(classifyFailure(400, '{"success":false,"errors":[{"code":10000,"message":"Something else"}]}'), 'path');
  assert.equal(classifyFailure(404, '{"error":{"message":"The model `x` does not exist"}}'), 'model');
  assert.equal(classifyFailure(400, '{"error":"model \'x\' not found, try pulling it first"}'), 'model');
  assert.equal(classifyFailure(400, '{"error":{"message":"x does not support tools"}}'), 'tools');
  assert.equal(classifyFailure(404, '{"error":{"message":"No endpoints found that support tool use."}}'), 'tools');
  assert.equal(classifyFailure(400, '{"error":{"message":"\\"auto\\" tool choice requires --enable-auto-tool-choice"}}'), 'tools');
  assert.equal(classifyFailure(401, OWNER_BODY), 'auth');
  assert.equal(classifyFailure(403, ''), 'auth');
  assert.equal(classifyFailure(429, ''), 'rateLimit');
  assert.equal(classifyFailure(500, ''), 'server');
  assert.equal(classifyFailure(503, '<html></html>'), 'server');
  assert.equal(classifyFailure(400, '{"error":{"message":"max_tokens is too large"}}'), 'badRequest');
  assert.equal(classifyFailure(422, '{"error":{"message":"messages: field required"}}'), 'badRequest');
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const answer = (status: number, body: string) => {
  globalThis.fetch = (async () => new Response(body, { status })) as typeof fetch;
};

test("the chat's error carries the server's short message and the failure kind", async () => {
  answer(400, OWNER_BODY);
  await assert.rejects(getJson('https://api.example.com/v1/models', {}), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.message, 'API error 400: No route for that URI');
    assert.equal(e.kind, 'path');
    return true;
  });
  answer(400, '{"error":{"message":"bad","code":"invalid_request"}}');
  await assert.rejects(getJson('https://api.example.com/v1/models', {}), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.message, 'API error 400: bad');
    assert.equal(e.code, 'invalid_request');
    return true;
  });
});

function request(): ModelRequest {
  return {
    apiKey: 'test-key-value-0001',
    model: 'claude-sonnet',
    system: 's',
    tools: [],
    webSearch: false,
    turns: [{ role: 'user', text: 'hi' }],
    signal: new AbortController().signal,
    endpoint: 'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/run',
    audit: { conversation: 'c', incognito: false, host: null },
  } as unknown as ModelRequest;
}

test('a custom endpoint with a wrong path: the chat says so, with the server message, never "API error 400" alone', async () => {
  answer(400, OWNER_BODY);
  await assert.rejects(custom.call(request()), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.match(e.message, /^API error 400: No route for that URI\. Nothing at the custom endpoint's address answers \/chat\/completions/);
    assert.ok(!e.message.includes('test-key-value-0001'));
    return true;
  });
});

test('a custom endpoint refusing tools still says the model cannot use tools', async () => {
  answer(400, '{"error":{"message":"m does not support tools"}}');
  await assert.rejects(custom.call(request()), /can't use Qutai's tools/);
});
