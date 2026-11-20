// The cookie list's parsing (src/content/cookieInfo.ts): Android's Set-Cookie lines and plain header, iOS's records,
// which cookies apply to an address, first/third party, and the expired cookie that deletes one on Android.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cookieApplies,
  cookieMetadata,
  cookieRows,
  dedupeCookies,
  expiringCookie,
  fromIosCookie,
  parseCookieInfoLine,
  parsePlainCookieHeader,
} from '../../src/content/cookieInfo.ts';

test('Android getCookieInfo lines: attributes, host-only vs domain cookies, Max-Age', () => {
  const c = parseCookieInfoLine('SID=abc=def; domain=.Example.com; path=/app; expires=Wed, 21 Oct 2037 07:28:00 GMT; secure; httponly; samesite=strict', 'https://www.example.com/x');
  assert.deepEqual(c, {
    name: 'SID',
    value: 'abc=def',
    domain: 'example.com',
    hostOnly: false,
    path: '/app',
    expires: Date.parse('Wed, 21 Oct 2037 07:28:00 GMT'),
    secure: true,
    httpOnly: true,
    sameSite: 'Strict',
  });
  const host = parseCookieInfoLine('a=1', 'https://shop.example.com/');
  assert.equal(host?.domain, 'shop.example.com');
  assert.equal(host?.hostOnly, true);
  assert.equal(host?.expires, null, 'session');
  assert.equal(parseCookieInfoLine('b=2; Domain=shop.example.com', 'https://shop.example.com/')?.hostOnly, true);
  const max = parseCookieInfoLine('m=1; Max-Age=60', 'https://example.com/', );
  assert.ok(max && max.expires! > Date.now() && max.expires! <= Date.now() + 61_000);
  assert.equal(parseCookieInfoLine('', 'https://example.com/'), null);
});

test('Android plain header (old WebView): names and values, everything else unknown', () => {
  const list = parsePlainCookieHeader('a=1; b=two=2; c', 'http://localhost:8791/p');
  assert.deepEqual(
    list.map((c) => [c.name, c.value, c.domain, c.httpOnly, c.limited]),
    [
      ['a', '1', 'localhost', null, true],
      ['b', 'two=2', 'localhost', null, true],
      ['', 'c', 'localhost', null, true],
    ],
  );
});

test('iOS records', () => {
  assert.deepEqual(fromIosCookie({ name: 'x', value: 'v', domain: '.example.com', path: '/', expires: 5, secure: true, httpOnly: true, sameSite: 'lax' }), {
    name: 'x',
    value: 'v',
    domain: 'example.com',
    hostOnly: false,
    path: '/',
    expires: 5,
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
  });
  assert.equal(fromIosCookie({ name: 'x', domain: 'example.com' })?.hostOnly, true);
  assert.equal(fromIosCookie({ name: 5, domain: 'x' }), null);
});

test('which cookies apply to an address: domain, path and Secure', () => {
  const domain = parseCookieInfoLine('a=1; Domain=.example.com; Path=/', 'https://example.com/')!;
  const hostOnly = parseCookieInfoLine('b=1; Path=/shop', 'https://example.com/')!;
  const secure = parseCookieInfoLine('c=1; Secure', 'https://localhost/')!;
  assert.ok(cookieApplies(domain, 'https://m.example.com/x'));
  assert.ok(!cookieApplies(domain, 'https://badexample.com/'));
  assert.ok(!cookieApplies(hostOnly, 'https://m.example.com/shop'));
  assert.ok(cookieApplies(hostOnly, 'https://example.com/shop/cart'));
  assert.ok(!cookieApplies(hostOnly, 'https://example.com/shopping'));
  assert.ok(cookieApplies(secure, 'http://localhost:8791/'), 'localhost counts as secure');
  const secureRemote = parseCookieInfoLine('d=1; Secure', 'https://example.com/')!;
  assert.ok(!cookieApplies(secureRemote, 'http://example.com/'));
});

test('first or third party by registrable domain; handles in a stable order; duplicates once', () => {
  const cookies = dedupeCookies([
    parseCookieInfoLine('z=1; Domain=.ads.example.net', 'https://ads.example.net/')!,
    parseCookieInfoLine('a=1; Domain=.example.com', 'https://example.com/')!,
    parseCookieInfoLine('a=1; Domain=.example.com', 'https://example.com/')!,
    parseCookieInfoLine('b=1', 'https://cdn.example.com/')!,
  ]);
  const { list, keys } = cookieMetadata(cookies, 'www.example.com');
  assert.deepEqual(
    list.map((c) => [c.handle, c.name, c.domain, c.party]),
    [
      ['c1', 'b', 'cdn.example.com', 'first'],
      ['c2', 'a', 'example.com', 'first'],
      ['c3', 'z', 'ads.example.net', 'third'],
    ],
  );
  assert.deepEqual(keys.get('c3'), { name: 'z', domain: 'ads.example.net', hostOnly: false, path: '/', secure: false });
});

test('Android delete: an expired cookie with the same name, path, domain and Secure flag', () => {
  assert.deepEqual(expiringCookie({ name: 'SID', domain: 'example.com', hostOnly: false, path: '/app', secure: true }, 'https://example.com/'), {
    url: 'https://example.com/app',
    line: 'SID=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/app; Domain=.example.com; Secure',
  });
  assert.deepEqual(expiringCookie({ name: 'a', domain: 'localhost', hostOnly: true, path: '/', secure: false }, 'http://localhost:8791/'), {
    url: 'http://localhost/',
    line: 'a=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/',
  });
});

test('the cookies screen as list rows: a heading per domain, then its cookies, the last one closing the card (UI-32)', () => {
  const meta = (name: string, domain: string, party: 'first' | 'third') =>
    ({ name, domain, path: '/', party, secure: false }) as unknown as Parameters<typeof cookieRows>[0][number];
  const rows = cookieRows([meta('a', 'example.com', 'first'), meta('b', 'ads.net', 'third'), meta('c', 'example.com', 'first')]);
  assert.deepEqual(
    rows.map((r) => (r.kind === 'domain' ? `${r.domain}${r.first ? '*' : ''}` : `${r.meta.name}${r.last ? '.' : ''}`)),
    ['example.com*', 'a', 'c.', 'ads.net', 'b.'],
  );
});
