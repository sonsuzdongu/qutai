// Web Share for pages (src/browser/webShare.ts): the app side's check of the page's message, what the share sheet
// gets, and the page script's own rules (user activation, one share at a time, http(s) only, no files).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseShareMessage, shareContent, shareDoneScript, SHARE_LIMITS, webShareScript } from '../../src/browser/webShare';

const N = 'abc123';
const msg = (o: Record<string, unknown>) => JSON.stringify({ __qutaiShare: N, id: '1', ...o });

test('a well-formed request from this tab is accepted', () => {
  assert.deepEqual(parseShareMessage(msg({ title: ' T ', text: 'hi', url: 'https://example.com/a b' }), N), {
    id: '1',
    title: 'T',
    text: 'hi',
    url: 'https://example.com/a%20b',
  });
});

test('another nonce, a bad id, or nothing to share is refused', () => {
  assert.equal(parseShareMessage(msg({ text: 'x' }), 'other'), null);
  assert.equal(parseShareMessage(JSON.stringify({ __qutaiShare: N, id: 'x', text: 'x' }), N), null);
  assert.equal(parseShareMessage(msg({}), N), null);
  assert.equal(parseShareMessage('{"__qutaiShare": broken', N), null);
  assert.equal(parseShareMessage('{"other":1}', N), null);
});

test('only http(s) addresses, and not overly long ones', () => {
  assert.equal(parseShareMessage(msg({ url: 'javascript:alert(1)' }), N), null);
  assert.equal(parseShareMessage(msg({ url: 'intent://x#Intent;end' }), N), null);
  assert.equal(parseShareMessage(msg({ url: 'file:///etc/passwd' }), N), null);
  assert.equal(parseShareMessage(msg({ url: `https://e.com/${'a'.repeat(SHARE_LIMITS.url)}` }), N), null);
  assert.equal(parseShareMessage(msg({ url: 'http://e.com' }), N)?.url, 'http://e.com/');
});

test('long text is cut', () => {
  assert.equal(parseShareMessage(msg({ text: 'a'.repeat(SHARE_LIMITS.text + 50) }), N)?.text.length, SHARE_LIMITS.text);
});

test('the share sheet gets the text and the address together (Android reads only the message)', () => {
  assert.deepEqual(shareContent({ id: '1', title: 'T', text: 'see', url: 'https://e.com/' }), { title: 'T', message: 'see\nhttps://e.com/' });
  assert.deepEqual(shareContent({ id: '1', title: 'Only', text: '', url: '' }), { title: 'Only', message: 'Only' });
});

// The page script in a fake main frame.
function page(opts: { active?: boolean; top?: boolean; hasShare?: boolean } = {}) {
  const posted: string[] = [];
  const navProto: Record<string, unknown> = {};
  if (opts.hasShare) navProto.share = () => 'webkit';
  const navigator = Object.create(navProto);
  navigator.userActivation = { isActive: opts.active ?? true };
  const win: Record<string, unknown> = {
    navigator,
    Promise,
    DOMException,
    ReactNativeWebView: { postMessage: (m: string) => posted.push(m) },
    Reflect,
  };
  win.top = opts.top === false ? {} : win;
  new Function('window', 'document', 'URL', 'JSON', 'Object', 'String', 'TypeError', 'Error', webShareScript(N))(
    win,
    { baseURI: 'https://site.example/page' },
    URL,
    JSON,
    Object,
    String,
    TypeError,
    Error,
  );
  return { navigator, posted, win };
}

test('share posts the request and resolves when the app says it was shared', async () => {
  const p = page();
  const done = p.navigator.share({ title: 'T', url: '/x' });
  assert.equal(p.posted.length, 1);
  const sent = parseShareMessage(p.posted[0], N);
  assert.equal(sent?.url, 'https://site.example/x');
  // Only one at a time.
  await assert.rejects(p.navigator.share({ text: 'again' }), { name: 'InvalidStateError' });
  new Function('window', shareDoneScript(N, sent!.id, true))(p.win);
  assert.equal(await done, undefined);
});

test('a cancelled share rejects with AbortError', async () => {
  const p = page();
  const done = p.navigator.share({ text: 'x' });
  new Function('window', shareDoneScript(N, '1', false))(p.win);
  await assert.rejects(done, { name: 'AbortError' });
});

test('no user activation, bad addresses and files are refused in the page', async () => {
  await assert.rejects(page({ active: false }).navigator.share({ text: 'x' }), { name: 'NotAllowedError' });
  const p = page();
  await assert.rejects(p.navigator.share({ url: 'javascript:1' }), TypeError);
  await assert.rejects(p.navigator.share({}), TypeError);
  assert.equal(p.navigator.canShare({ files: [{}] }), false);
  assert.equal(p.navigator.canShare({ url: 'https://e.com' }), true);
  assert.equal(p.posted.length, 0);
});

test('frames and pages that already have navigator.share are left alone', () => {
  assert.equal('share' in page({ top: false }).navigator, false);
  assert.equal(page({ hasShare: true }).navigator.share(), 'webkit');
});
