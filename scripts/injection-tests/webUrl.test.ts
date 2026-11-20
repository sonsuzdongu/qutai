// One URL module for every security decision and every host shown (SITE-25, 20 Nov 2026 code review;
// src/utils/webUrl.ts): hostile addresses are read as the WebView reads them. Each case runs with Node's URL and with
// whatwg-url-minimum, the URL Expo installs in the app, and the old host helpers now give the same answer.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { URL as ExpoURL } from 'whatwg-url-minimum';
import { decide, siteKey as policySiteKey } from '../../src/agent/sitePolicy';
import { siteOf as outboundSite } from '../../src/agent/outbound';
import { hostOf as openingHost } from '../../src/browser/pendingNavigation';
import { splitUrl } from '../../src/content/siteRules';
import { siteOf as downloadSite } from '../../src/device/download';
import { parseWebUrl, registrableSite, shownHost, siteKey, siteKeyOfHost } from '../../src/utils/webUrl';

/** address → [siteKey, registrableSite] as the WebView would load it; null: not a web address. */
const CASES: [string, string | null, string | null][] = [
  // userinfo and backslashes: the host is what the WebView connects to, never the name shown before "@".
  ['https://evil.example\\@named.example/', 'evil.example', 'evil.example'],
  ['https://named.example@evil.example/', 'evil.example', 'evil.example'],
  ['https://named.example:pw@evil.example:8443/x', 'evil.example:8443', 'evil.example'],
  ['https:\\\\evil.example\\path', 'evil.example', 'evil.example'],
  ['https:evil.example/', 'evil.example', 'evil.example'],
  // case, trailing dots, ports, www
  ['HTTPS://WWW.Shop.EXAMPLE.com.tr./a?b', 'shop.example.com.tr', 'example.com.tr'],
  ['https://evil.example./', 'evil.example', 'evil.example'],
  ['https://example.com:443/', 'example.com', 'example.com'],
  ['http://example.com:80/', 'example.com', 'example.com'],
  ['http://example.com:443/', 'example.com:443', 'example.com'],
  ['http://192.168.1.2:3000/app', '192.168.1.2:3000', '192.168.1.2'],
  // IDN, punycode and full-width letters
  ['https://bücher.de/', 'xn--bcher-kva.de', 'xn--bcher-kva.de'],
  ['https://xn--bcher-kva.de/', 'xn--bcher-kva.de', 'xn--bcher-kva.de'],
  ['https://ＥＸＡＭＰＬＥ.com/', 'example.com', 'example.com'],
  ['https://%65vil.example/', 'evil.example', 'evil.example'],
  ['https://exa\tmple.com/', 'example.com', 'example.com'],
  // IPv4 shorthands and IPv6 literals
  ['http://0x7f.1/', '127.0.0.1', '127.0.0.1'],
  ['http://2130706433/', '127.0.0.1', '127.0.0.1'],
  ['http://[::1]:8080/', '[::1]:8080', '[::1]'],
  ['http://[0:0::1]/', '[::1]', '[::1]'],
  // no site
  ['data:text/html,<b>hi</b>', null, null],
  ['blob:https://example.com/0d4c', null, null],
  ['javascript:alert(document.cookie)', null, null],
  ['file:///etc/passwd', null, null],
  ['example.com', null, null],
  ['//evil.example/', null, null],
  ['https://a.com:65536/', null, null],
  ['', null, null],
];

function withUrl<T>(U: typeof URL, fn: () => T): T {
  const saved = globalThis.URL;
  globalThis.URL = U;
  try {
    return fn();
  } finally {
    globalThis.URL = saved;
  }
}

test('hostile addresses give the site the WebView would load, with both URL parsers', () => {
  for (const U of [URL, ExpoURL as unknown as typeof URL]) {
    withUrl(U, () => {
      for (const [address, key, site] of CASES) {
        assert.equal(siteKey(address), key, `${U === URL ? 'node' : 'expo'} siteKey ${JSON.stringify(address)}`);
        assert.equal(registrableSite(address), site, `${U === URL ? 'node' : 'expo'} site ${JSON.stringify(address)}`);
      }
    });
  }
});

test('every former host helper now answers the same', () => {
  for (const [address, key, site] of CASES) {
    assert.equal(policySiteKey(address), key, address);
    assert.equal(outboundSite(address), site, address);
    assert.equal(openingHost(address), key, address);
    assert.equal(shownHost(address), key, address);
    assert.equal(downloadSite(address), key ?? '', address);
    // Site rules (hiding, styles, kept scripts) don't apply to IPv6 literals, as before.
    const split = splitUrl(address);
    assert.equal(split?.host ?? null, key?.startsWith('[') ? null : key, `splitUrl ${address}`);
  }
  assert.deepEqual(splitUrl('https://Shop.example/a/b?c=1#frag'), { host: 'shop.example', path: '/a/b?c=1' });
  assert.equal(parseWebUrl('https://named.example@evil.example/')?.host, 'evil.example');
});

test('a blocked site stays blocked whatever spelling the model writes', () => {
  const levels: Record<string, 'blocked'> = { 'evil.example': 'blocked', 'xn--bcher-kva.de': 'blocked', '127.0.0.1': 'blocked' };
  for (const address of [
    'https://evil.example\\@named.example/',
    'https://named.example@evil.example/',
    'https://EVIL.example./',
    'https://evil.example:443/',
    'https://bücher.de/',
    'http://0x7f.1/',
  ]) {
    const host = siteKey(address);
    const level = (host && levels[host]) || 'default';
    assert.equal(decide('navigate', host, level, false).kind, 'refuse', address);
  }
});

test('stored keys are read as the key the site has now', () => {
  assert.equal(siteKeyOfHost('Bücher.de'), 'xn--bcher-kva.de');
  assert.equal(siteKeyOfHost('example.com.'), 'example.com');
  assert.equal(siteKeyOfHost('192.168.1.2:3000'), '192.168.1.2:3000');
  assert.equal(siteKeyOfHost('a@b.com'), null);
  assert.equal(siteKeyOfHost('a.com/x'), null);
});
