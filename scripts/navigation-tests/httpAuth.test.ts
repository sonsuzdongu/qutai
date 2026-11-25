// A site's request for a user name and password (src/browser/httpAuth.ts): what the app accepts from the WebView's
// event, what the dialog says, and the per-tab queue (one at a time, only while the tab is on screen).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cleanRealm,
  HttpAuthQueue,
  httpAuthDialogParts,
  isInsecureAuth,
  MAX_REALM_CHARS,
  parseHttpAuthRequest,
} from '../../src/browser/httpAuth';

const req = (o: Record<string, unknown> = {}) => ({ id: 'h1', host: 'Router.Local', realm: 'Admin', url: 'http://router.local/', ...o });

test('an event with an id and a host is a request (host lower-cased)', () => {
  assert.deepEqual(parseHttpAuthRequest(req()), { id: 'h1', host: 'router.local', realm: 'Admin', url: 'http://router.local/' });
  assert.equal(parseHttpAuthRequest(req({ host: '192.168.1.1:8080' }))?.host, '192.168.1.1:8080');
});

test('no id, no host, or a host with odd characters is not', () => {
  assert.equal(parseHttpAuthRequest(req({ id: '' })), null);
  assert.equal(parseHttpAuthRequest(req({ host: '' })), null);
  assert.equal(parseHttpAuthRequest(req({ host: 'evil.com/ bank.com' })), null);
  assert.equal(parseHttpAuthRequest(req({ id: 3 })), null);
});

test("the realm is the site's text: no control or direction characters, one line, cut", () => {
  assert.equal(cleanRealm('Admin\narea‮gnp.exe'), 'Admin area gnp.exe');
  const long = cleanRealm('x'.repeat(500));
  assert.equal(long.length, MAX_REALM_CHARS);
  assert.ok(long.endsWith('…'));
});

test('the dialog names the host, quotes the realm, warns on http and says nothing is kept', () => {
  const parts = httpAuthDialogParts(parseHttpAuthRequest(req())!);
  assert.deepEqual(parts.title, { key: 'httpAuth.title', host: 'router.local' });
  assert.deepEqual(
    parts.lines.map((l) => l.key),
    ['httpAuth.body', 'httpAuth.realm', 'httpAuth.insecure', 'httpAuth.note'],
  );
  const secure = httpAuthDialogParts(parseHttpAuthRequest(req({ url: 'https://intranet.example/', realm: '' }))!);
  assert.deepEqual(secure.lines.map((l) => l.key), ['httpAuth.body', 'httpAuth.note']);
  assert.equal(isInsecureAuth(parseHttpAuthRequest(req({ url: 'HTTP://x/' }))!), true);
});

test('the queue asks one request at a time, only while the tab is on screen', () => {
  const q = new HttpAuthQueue();
  const a = parseHttpAuthRequest(req({ id: 'a' }))!;
  const b = parseHttpAuthRequest(req({ id: 'b' }))!;
  q.add(a);
  q.add(b);
  q.add(a);
  assert.equal(q.size, 2);
  assert.equal(q.next(false), null, 'a tab in the background waits');
  assert.equal(q.next(true), a);
  assert.equal(q.next(true), null, 'one dialog at a time');
  q.done('a');
  assert.equal(q.next(true), b);
  assert.deepEqual(q.drain(), [b]);
  assert.equal(q.size, 0);
});
