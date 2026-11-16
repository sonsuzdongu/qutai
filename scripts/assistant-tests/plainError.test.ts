// Errors that end an assistant task are one plain sentence in the chat (src/ai/plainError.ts); the raw text stays
// as details. Seen on the phone (16 Nov 2026): "API error 400: request body is not valid JSON: unexpected end of hex
// escape at line 1 column 58060" as the chat's message.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../../src/ai/http.ts';
import { classifyStatus, plainError } from '../../src/ai/plainError.ts';
import { RelayError } from '../../src/credits/errors.ts';
import { setLanguage, t } from '../../src/i18n/index.ts';
import { en } from '../../src/i18n/en.ts';
import { tr } from '../../src/i18n/tr.ts';

const raw = (status: number, message: string) => new ApiError(`${t('error.api', { status })}: ${message}`, status);

test('the error seen on the phone is a plain sentence with the raw text as details', () => {
  setLanguage('en');
  const message = 'request body is not valid JSON: unexpected end of hex escape at line 1 column 58060';
  const shown = plainError(raw(400, message), { credits: true });
  assert.equal(shown.kind, 'rejected');
  assert.equal(shown.message, en['error.plain.rejected']);
  assert.ok(!shown.message.includes('API error'));
  assert.equal(shown.details, `API error 400: ${message}`);
});

test('each class by status and message', () => {
  const cases: [number, string, string, boolean?][] = [
    [401, 'invalid x-api-key', 'auth'],
    [403, 'Forbidden', 'auth'],
    [400, 'API key not valid. Please pass a valid API key.', 'auth'],
    [401, 'invalid x-api-key', 'unavailable', true],
    [429, 'Rate limit reached for requests', 'rateLimit'],
    [429, 'You exceeded your current quota, please check your plan and billing details.', 'credits'],
    [402, 'Payment Required', 'credits'],
    [400, 'Your credit balance is too low to access the Anthropic API.', 'credits'],
    [529, 'Overloaded', 'overloaded'],
    [503, 'The model is overloaded. Please try again later.', 'overloaded'],
    [504, 'Gateway Timeout', 'timeout'],
    [408, 'Request Timeout', 'timeout'],
    [500, 'Internal server error', 'unavailable'],
    [502, 'Bad gateway', 'unavailable'],
    [400, 'messages: text content blocks must be non-empty', 'rejected'],
    [413, 'Request too large', 'rejected'],
  ];
  for (const [status, message, kind, credits] of cases) {
    assert.equal(classifyStatus(status, message, credits), kind, `${status} ${message}`);
    assert.equal(plainError(raw(status, message), { credits }).kind, kind, `${status} ${message}`);
  }
});

test('no answer at all: network and timeout', () => {
  assert.equal(plainError(new TypeError('Network request failed')).kind, 'network');
  assert.equal(plainError(new TypeError('Failed to fetch')).kind, 'network');
  const timeout = new Error('The operation timed out.');
  timeout.name = 'TimeoutError';
  assert.equal(plainError(timeout).kind, 'timeout');
  assert.equal(plainError(new Error('Request timed out')).kind, 'timeout');
});

test('anything else is "unknown", with its text as details', () => {
  const shown = plainError(new Error('Stream error'));
  assert.equal(shown.kind, 'unknown');
  assert.equal(shown.message, en['error.plain.unknown']);
  assert.equal(shown.details, 'Stream error');
  assert.equal(plainError('weird').details, 'weird');
  assert.equal(plainError(undefined).details, undefined);
});

test("the adapters' own sentences and Qutai Credits' refusals stay as they are", () => {
  const own = new ApiError(t('error.noToolSupport'), 400);
  assert.equal(plainError(own).message, t('error.noToolSupport'));
  const credits = new RelayError('insufficient_credits', 402, { requestId: 'req_1' });
  const shown = plainError(credits, { credits: true });
  assert.equal(shown.kind, 'credits');
  assert.equal(shown.message, credits.message);
  assert.match(shown.details ?? '', /insufficient_credits.*402.*req_1/);
  assert.equal(plainError(new RelayError('network', 0)).kind, 'network');
  assert.equal(plainError(new RelayError('upstream_unavailable', 503)).kind, 'overloaded');
  assert.equal(plainError(new RelayError('upstream_timeout', 200)).kind, 'timeout');
});

test('every class has a Turkish sentence that addresses the user as "siz"', () => {
  const kinds = ['network', 'timeout', 'auth', 'rateLimit', 'overloaded', 'rejected', 'credits', 'unavailable', 'unknown'];
  for (const kind of kinds) {
    const key = `error.plain.${kind}` as keyof typeof tr;
    assert.ok(en[key], `en ${key}`);
    assert.ok(tr[key] && tr[key] !== en[key], `tr ${key}`);
    assert.doesNotMatch(tr[key], /\b(dene|kontrol et|bekle)\b[.!]/, `tr ${key} uses "siz"`);
  }
  setLanguage('tr');
  assert.equal(plainError(new TypeError('Network request failed')).message, tr['error.plain.network']);
  setLanguage('en');
});
