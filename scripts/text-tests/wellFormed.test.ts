// Text that reaches a model is well-formed UTF-16 (src/utils/wellFormed.ts). The bug (16 Nov 2026, Qutai Credits,
// Anthropic): a Trendyol search page was read, a product link's label was cut at 80 code units between the two halves
// of an emoji, and every later request of the conversation failed with "The request body is not valid JSON:
// unexpected end of hex escape". These tests show the cause on the real adapters, then the fix at each cut and at the
// one place every request body is serialised (src/ai/http.ts for own keys, src/credits/client.ts for the relay).
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { callAnthropic } from '../../src/ai/anthropic.ts';
import { custom } from '../../src/ai/custom.ts';
import { callGemini } from '../../src/ai/gemini.ts';
import { callOpenAI } from '../../src/ai/openai.ts';
import { openrouter } from '../../src/ai/openrouter.ts';
import type { ModelRequest, Turn } from '../../src/ai/types.ts';
import { directWire } from '../../src/ai/wire.ts';
import { cleanCustomInstructions } from '../../src/agent/systemPrompt.ts';
import { PAGE_SCRIPT } from '../../src/browser/pageScript.ts';
import { pageScriptPart } from '../test-support/pageScriptPart.mjs';
import { MAX_SELECTION_CHARS, parseSelection, SELECTION_SCRIPT } from '../../src/browser/selection.ts';
import { createCreditsProvider } from '../../src/credits/provider.ts';
import { formatPdfText } from '../../src/pdf/format.ts';
import { cutText, isWellFormed, pairBoundary, sliceText, wellFormed, wellFormedJson, wellFormedJsonText } from '../../src/utils/wellFormed.ts';
import { CONFIG, error, fakeServer } from '../credits-tests/fake.ts';

/**
 * What a strict parser (serde_json, as the provider's error message shows) says about a JSON text's string escapes:
 * null when every `\uD800`–`\uDFFF` escape is part of a pair, otherwise serde's own message. Node's JSON.parse
 * accepts lone surrogates, so it can't show the failure.
 */
function strictJsonProblem(json: string): string | null {
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdfff) {
      const pair = c <= 0xdbff && json.charCodeAt(i + 1) >= 0xdc00 && json.charCodeAt(i + 1) <= 0xdfff;
      if (!pair) return 'lone surrogate in the text (sent as U+FFFD bytes or refused)';
      i++;
      continue;
    }
    if (json[i] !== '\\') continue;
    const next = json[i + 1];
    if (next !== 'u') {
      i++;
      continue;
    }
    const n = parseInt(json.slice(i + 2, i + 6), 16);
    if (n >= 0xdc00 && n <= 0xdfff) return `lone leading surrogate in hex escape at column ${i + 6}`;
    if (n >= 0xd800 && n <= 0xdbff) {
      const low = json.slice(i + 6, i + 8) === '\\u' ? parseInt(json.slice(i + 8, i + 12), 16) : NaN;
      if (!(low >= 0xdc00 && low <= 0xdfff)) return `unexpected end of hex escape at column ${i + 7}`;
      i += 11;
      continue;
    }
    i += 5;
  }
  return null;
}

// A Trendyol-like product title with the emoji at code units 79–80: elementLabel's old `clean(t).slice(0, 80)`
// kept only its first half.
const TITLE = 'Erkek Terlik Ev Terliği Kaymaz Taban Rahat Yumuşak Pamuklu Kışlık Sıcak Tutann 🩴 Ortopedik';
const OLD_LABEL = TITLE.slice(0, 80);
const LONE_HIGH = '\ud83e';
const LONE_LOW = '\udd74';

test('the cause: an 80-unit cut keeps half the emoji, and JSON.stringify writes it as an escape a strict parser refuses', () => {
  assert.equal(OLD_LABEL.charCodeAt(79), 0xd83e);
  assert.equal(isWellFormed(OLD_LABEL), false);
  const json = JSON.stringify({ text: `- link "${OLD_LABEL}" [ref=12]` });
  assert.match(json, /Tutann \\ud83e\\" \[ref=12\]/);
  assert.match(strictJsonProblem(json) ?? '', /^unexpected end of hex escape/);
  // A whole emoji is written as itself and is fine.
  assert.equal(strictJsonProblem(JSON.stringify({ text: TITLE })), null);
});

test('wellFormed: lone halves become U+FFFD, pairs and plain text are untouched (same string)', () => {
  const plain = 'Türkçe metin, no surrogates';
  assert.equal(wellFormed(plain), plain);
  assert.equal(wellFormed(TITLE), TITLE);
  assert.equal(wellFormed(`a${LONE_HIGH}`), 'a�');
  assert.equal(wellFormed(`${LONE_LOW}a`), '�a');
  assert.equal(wellFormed(`${LONE_LOW}${LONE_HIGH}`), '��');
  assert.equal(wellFormed(`${LONE_HIGH}${LONE_HIGH}\udd74`), '�🥴');
  assert.equal(wellFormed(`${LONE_LOW}${LONE_LOW}`), '��');
  assert.equal(isWellFormed('🩴'), true);
  assert.equal(isWellFormed(LONE_LOW), false);
});

test('wellFormed: the regex fallback (engines without String.prototype.toWellFormed) gives the native result', () => {
  const proto = String.prototype as { toWellFormed?: () => string };
  const native = proto.toWellFormed;
  const samples = [`x${LONE_HIGH}`, `${LONE_LOW}y`, `🩴${LONE_HIGH}🩴${LONE_LOW}`, TITLE, ''];
  const expected = native ? samples.map((s) => native.call(s)) : null;
  const fallback = (s: string) => s.replace(/[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g, (m) => (m.length === 2 ? m : '�'));
  if (expected) assert.deepEqual(samples.map(fallback), expected);
  assert.deepEqual(samples.map(fallback), samples.map(wellFormed));
});

test('cutText / sliceText / pairBoundary never split a pair', () => {
  assert.equal(cutText(TITLE, 80), TITLE.slice(0, 79));
  assert.equal(cutText(TITLE, 81), TITLE.slice(0, 81));
  assert.equal(cutText(TITLE, 500), TITLE);
  assert.equal(cutText('🩴', 1), '');
  assert.equal(cutText('abc', 0), '');
  for (let n = 0; n <= TITLE.length + 1; n++) assert.ok(isWellFormed(cutText(TITLE, n)), `cut at ${n}`);
  assert.equal(pairBoundary('a🩴b', 2), 1);
  assert.equal(pairBoundary('a🩴b', 3), 3);
  // Paging: consecutive slices on adjusted boundaries give the whole text back, each piece well-formed.
  const text = '🩴'.repeat(7) + 'x';
  let joined = '';
  for (let at = 0; at < text.length; ) {
    const end = pairBoundary(text, Math.min(text.length, at + 3));
    const piece = sliceText(text, at, end);
    assert.ok(isWellFormed(piece));
    joined += piece;
    at = end;
  }
  assert.equal(joined, text);
});

test('wellFormedJson: lone surrogates escaped or raw come out as \\ufffd; everything else byte for byte', () => {
  const value = {
    a: `${OLD_LABEL}`,
    b: `${LONE_LOW} at the start`,
    c: 'a literal backslash-u: \\ud83e stays text',
    d: '🩴 whole',
    e: ['  and   and \u0000'],
  };
  const json = wellFormedJson(value);
  assert.equal(strictJsonProblem(json), null);
  const back = JSON.parse(json);
  assert.equal(back.a, `${TITLE.slice(0, 79)}�`);
  assert.equal(back.b, '� at the start');
  assert.equal(back.c, value.c);
  assert.equal(back.d, value.d);
  assert.deepEqual(back.e, value.e);
  // Well-formed input: exactly JSON.stringify (provider output replayed as received is not touched).
  const raw = { content: [{ type: 'thinking', thinking: 'çok 🩴', signature: 'c2lnbmF0dXJl\\u' }] };
  assert.equal(wellFormedJson(raw), JSON.stringify(raw));
  // An engine whose JSON.stringify leaves a lone surrogate raw (pre-ES2019): fixed too.
  assert.equal(wellFormedJsonText(`{"t":"x${LONE_HIGH}"}`), '{"t":"x�"}');
  // An escaped pair written by another writer is kept.
  assert.equal(wellFormedJsonText('{"t":"\\ud83e\\udd74"}'), '{"t":"\\ud83e\\udd74"}');
  assert.equal(wellFormedJsonText('{"t":"\\ud83e\\ud83e"}'), '{"t":"\\ufffd\\ufffd"}');
  assert.equal(wellFormedJsonText('{"t":"\\\\ud83e"}'), '{"t":"\\\\ud83e"}');
});

test('wellFormedJson is cheap on a large well-formed conversation (one regex test, no rewrite)', () => {
  const big = { messages: Array.from({ length: 200 }, (_, i) => ({ role: 'user', content: `${TITLE} ${i} `.repeat(50) })) };
  const plain = JSON.stringify(big);
  for (let i = 0; i < 20; i++) assert.equal(wellFormedJson(big), plain);
  // Compared with JSON.stringify of the same body in the same moment, best of five rounds: a wall-clock limit failed
  // once on a busy machine (20 Nov 2026) at 100 times its usual margin. About 1.7 times JSON.stringify on a laptop.
  const per = (f: () => unknown) => {
    let best = Infinity;
    for (let round = 0; round < 5; round++) {
      const start = performance.now();
      for (let i = 0; i < 20; i++) f();
      best = Math.min(best, (performance.now() - start) / 20);
    }
    return best;
  };
  const checked = per(() => wellFormedJson(big));
  const stringify = per(() => JSON.stringify(big));
  assert.ok(checked < stringify * 10 + 1, `${checked.toFixed(2)} ms against ${stringify.toFixed(2)} ms for JSON.stringify`);
});

// ---------- The injected page script (it can't import the helper: its own copy is checked here) ----------

/** The page script's text helpers, evaluated as the WebView would. */
function pageHelpers(): { wf(s: unknown): string; cut(s: unknown, n: number): string; clean(s: unknown): string; pairBoundary(s: string, n: number): number } {
  const helpers = pageScriptPart(PAGE_SCRIPT, '  var PAIR_OR_LONE', '  function getRef(');
  return new Function(`${helpers}; return { wf: wf, cut: cut, clean: clean, pairBoundary: pairBoundary };`)();
}

test('page script: cut, clean and wf behave like the app’s helper (labels, values, read-aloud text)', () => {
  const page = pageHelpers();
  // elementLabel: `cut(clean(t), 80)` on the Trendyol title.
  assert.equal(page.cut(page.clean(TITLE), 80), TITLE.slice(0, 79));
  for (let n = 0; n <= TITLE.length + 1; n++) assert.equal(page.cut(TITLE, n), cutText(TITLE, n));
  for (const s of [`x${LONE_HIGH}`, `${LONE_LOW}y`, TITLE, `🩴${LONE_HIGH}`]) assert.equal(page.wf(s), wellFormed(s));
  // A page whose own text holds half an emoji, NUL and other control characters.
  assert.equal(page.clean(`  Fiyat\u0000 ${LONE_HIGH}\u0007 499 TL \n`), 'Fiyat � 499 TL');
  assert.equal(page.clean(null), '');
});

test('page script: readSource pages on pair boundaries, the pieces join to the whole source', () => {
  const source = pageScriptPart(PAGE_SCRIPT, '  function readSource(', '  function fireMouse(');
  const helpers = pageScriptPart(PAGE_SCRIPT, '  var PAIR_OR_LONE', '  function getRef(');
  // 20 000 units per page: put an emoji across the first boundary.
  const html = `<html><body>${'a'.repeat(20000 - '<html><body>'.length - 1)}🩴${'b'.repeat(30)}</body></html>`;
  const document = { doctype: null, documentElement: { outerHTML: html }, title: 'T' };
  const readSource = new Function(
    'document',
    'location',
    `var MAX_CHARS = 20000;\n${helpers}\n${source}\nreturn readSource;`,
  )(document, { href: 'https://example.test/' });
  const first = readSource(0);
  assert.equal(first.truncated, true);
  assert.equal(first.nextOffset, 20000 - 1);
  assert.ok(isWellFormed(first.content));
  const second = readSource(first.nextOffset);
  assert.ok(isWellFormed(second.content));
  assert.equal(first.content + second.content, html);
  // An offset in the middle of a pair (an older nextOffset, or the model's own) starts on the pair.
  assert.equal(readSource(20000).content.slice(0, 2), '🩴');
});

test('selection: the in-page cut and the app’s parse keep the selection well-formed', () => {
  const text = 'x'.repeat(MAX_SELECTION_CHARS - 1) + '🩴 and more';
  const posted: string[] = [];
  const listeners: Record<string, () => void> = {};
  const fake = {
    window: { getSelection: () => ({ toString: () => text }), ReactNativeWebView: { postMessage: (m: string) => posted.push(m) } },
    document: { addEventListener: (name: string, fn: () => void) => (listeners[name] = fn) },
    setTimeout: (fn: () => void) => fn(),
    clearTimeout: () => {},
  };
  new Function('window', 'document', 'setTimeout', 'clearTimeout', SELECTION_SCRIPT)(fake.window, fake.document, fake.setTimeout, fake.clearTimeout);
  listeners.selectionchange();
  const got = parseSelection(posted[0]);
  assert.equal(got, 'x'.repeat(MAX_SELECTION_CHARS - 1));
  // A message from an older page script with half an emoji in it: U+FFFD, never a lone surrogate.
  assert.equal(parseSelection(JSON.stringify({ __qutaiSelection: true, text: `abc${LONE_HIGH}` })), 'abc�');
});

test('other cuts that reach the model: custom instructions, PDF pages', () => {
  const instructions = 'y'.repeat(499) + '🩴';
  assert.ok(isWellFormed(cleanCustomInstructions(instructions)));
  assert.equal(cleanCustomInstructions(instructions), 'y'.repeat(499));
  const pdf = formatPdfText(
    { name: 'a.pdf', origin: 'https://example.test/a.pdf', pages: 1, info: {}, read: [{ page: 1, text: '🩴'.repeat(15000) }], from: 1, to: 1 } as never,
    1001,
  );
  assert.ok(isWellFormed(pdf), 'PDF text cut on a pair boundary');
});

// ---------- The choke point: every adapter's wire and the relay ----------

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Records every body sent and answers 400, so each adapter throws after one request (400 is not retried). */
function captureFetch(): string[] {
  const bodies: string[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(String(init.body));
    return new Response(JSON.stringify({ error: { type: 'invalid_request_error', message: 'stop here' } }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return bodies;
}

/** A conversation as an older version stored it: half an emoji in a tool result, the user's text and a tool input. */
function brokenHistory(): Turn[] {
  const stored: Turn[] = [
    { role: 'user', text: `Trendyol'da terlik bul ${LONE_LOW}` },
    { role: 'assistant', text: '', toolCalls: [{ id: 'call_1', name: 'read_page', input: { note: `x${LONE_HIGH}` } }], raw: null, rawProvider: 'anthropic', rawModel: 'other' },
    { role: 'tool_results', results: [{ callId: 'call_1', name: 'read_page', content: `- link "${OLD_LABEL}" [ref=12]` }] },
  ];
  // Saved and loaded again the way chat history is kept (JSON in the database): the lone halves survive.
  const loaded = JSON.parse(JSON.stringify(stored)) as Turn[];
  assert.equal(isWellFormed((loaded[2] as { results: { content: string }[] }).results[0].content), false);
  return loaded;
}

function request(model: string, extra: Partial<ModelRequest> = {}): ModelRequest {
  return {
    apiKey: 'test-key',
    model,
    system: `System ${LONE_HIGH}`,
    tools: [],
    turns: brokenHistory(),
    signal: new AbortController().signal,
    audit: { conversation: 'c', incognito: false, host: null },
    ...extra,
  } as ModelRequest;
}

function assertSentWellFormed(bodies: string[], label: string) {
  assert.ok(bodies.length > 0, `${label}: a request was sent`);
  for (const body of bodies) {
    assert.equal(strictJsonProblem(body), null, `${label}: strict JSON`);
    assert.match(body, /Tutann \\ufffd|Tutann �/, `${label}: the cut label is sent with U+FFFD`);
  }
}

test('before the fix, the same conversation through plain JSON.stringify is what the provider refused', () => {
  const body = JSON.stringify({ messages: brokenHistory() });
  assert.match(strictJsonProblem(body) ?? '', /hex escape/);
});

for (const [label, run] of [
  ['Anthropic', (r: ModelRequest) => callAnthropic(r, directWire('anthropic'))],
  ['Anthropic streamed', (r: ModelRequest) => callAnthropic({ ...r, onText: () => {} }, directWire('anthropic'))],
  ['OpenAI', (r: ModelRequest) => callOpenAI(r, directWire('openai'))],
  ['Gemini', (r: ModelRequest) => callGemini(r, directWire('gemini'))],
  ['OpenRouter', (r: ModelRequest) => openrouter.call(r)],
  ['Custom endpoint', (r: ModelRequest) => custom.call({ ...r, endpoint: 'https://llm.example.test/v1' })],
] as const) {
  test(`choke point, own key: ${label} sends a stored broken conversation as strict JSON`, async () => {
    const bodies = captureFetch();
    await assert.rejects(run(request(label.startsWith('Gemini') ? 'gemini-3.5-flash' : 'model-x')));
    assertSentWellFormed(bodies, label);
  });
}

test('choke point, Qutai Credits relay: Anthropic and OpenAI inputs, context and custom instructions as strict JSON', async () => {
  for (const model of ['claude-sonnet-5-5', 'gpt-5.6-terra']) {
    const raw: string[] = [];
    const server = fakeServer();
    const client = server.client({
      fetch: async (url, init) => {
        if (init?.body) raw.push(String(init.body));
        return url.endsWith('/relay')
          ? error('upstream_rejected', 422, { upstream: { status: 400, message: 'stop here' } })
          : new Response('{}', { status: 404 });
      },
    });
    const p = createCreditsProvider({ client: () => client, config: async () => CONFIG, appVersion: '1.2.0' });
    await assert.rejects(
      p.call(
        request(model, {
          onText: () => {},
          webSearch: false,
          agent: { step: 1, memory: `Memory: ${LONE_LOW}`, customInstructions: `Kısa yaz ${LONE_HIGH}`, memoryTools: true },
        }),
      ),
    );
    assertSentWellFormed(raw, `relay ${model}`);
    const sent = JSON.parse(raw[0]);
    assert.equal(sent.context.customInstructions, 'Kısa yaz \ufffd');
    assert.equal(sent.context.memory, 'Memory: \ufffd');
  }
});
