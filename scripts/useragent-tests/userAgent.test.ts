// The " qutai.<build>" ending of every User-Agent Qutai sends (src/net/userAgentToken.ts) and its agreement with the
// version rule (docs/versioning.md). Run: npm run test:useragent
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  appUserAgent,
  qutaiToken,
  withoutQutaiToken,
  withQutaiToken,
  withUserAgentInit,
} from '../../src/net/userAgentToken.ts';
import { buildNumber } from '../version/rule.mjs';

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';

test('the token is qutai.<build> for a plain build number, nothing otherwise', () => {
  assert.equal(qutaiToken('103'), 'qutai.103');
  assert.equal(qutaiToken(103), 'qutai.103');
  assert.equal(qutaiToken(' 10200 '), 'qutai.10200');
  assert.equal(qutaiToken('0103'), 'qutai.103');
  for (const bad of ['–', '', null, undefined, '1.0', 'abc', '0', 0, '-3']) assert.equal(qutaiToken(bad), null, String(bad));
});

test("the token comes from app.json's build numbers, which follow the version rule and agree on both platforms", () => {
  const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')).expo;
  const rule = buildNumber(app.version);
  assert.equal(String(app.ios.buildNumber), String(rule), 'iOS buildNumber follows the rule');
  assert.equal(app.android.versionCode, rule, 'Android versionCode follows the rule');
  assert.equal(qutaiToken(app.ios.buildNumber), qutaiToken(app.android.versionCode));
  assert.equal(qutaiToken(app.ios.buildNumber), `qutai.${rule}`);
  assert.equal(qutaiToken(String(buildNumber('0.1.3'))), 'qutai.103');
});

test('the token is appended once, at the end after a space, keeping the rest of the string', () => {
  assert.equal(withQutaiToken(ANDROID_CHROME, 'qutai.103'), `${ANDROID_CHROME} qutai.103`);
  assert.equal(withQutaiToken(IOS, 'qutai.103'), `${IOS} qutai.103`);
  // An old build's token (a saved string, the WebView's own string with its application name) is replaced, not kept.
  assert.equal(withQutaiToken(`${ANDROID_CHROME} qutai.101`, 'qutai.103'), `${ANDROID_CHROME} qutai.103`);
  assert.equal(withQutaiToken(`${ANDROID_CHROME} qutai.103 qutai.103`, 'qutai.103'), `${ANDROID_CHROME} qutai.103`);
  // No readable build: the string as it was.
  assert.equal(withQutaiToken(ANDROID_CHROME, null), ANDROID_CHROME);
});

test('the token is removed without touching anything else', () => {
  const wv = 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.7444.0 Mobile Safari/537.36';
  assert.equal(withoutQutaiToken(`${wv} qutai.103`), wv);
  assert.equal(withoutQutaiToken(wv), wv);
  // Only a whole token: something that merely contains the letters stays.
  assert.equal(withoutQutaiToken('Foo myqutai.103x Bar'), 'Foo myqutai.103x Bar');
});

test("the app's own requests say Qutai/<version> (<platform>) qutai.<build>", () => {
  assert.equal(appUserAgent('0.1.3', 'ios', 'qutai.103'), 'Qutai/0.1.3 (iOS) qutai.103');
  assert.equal(appUserAgent('0.1.3', 'android', 'qutai.103'), 'Qutai/0.1.3 (Android) qutai.103');
  assert.equal(appUserAgent('–', 'ios', null), 'Qutai/0 (iOS)');
});

test("fetch gets the app's User-Agent unless the call set its own", () => {
  const ua = 'Qutai/0.1.3 (iOS) qutai.103';
  assert.deepEqual(withUserAgentInit('https://x.test', undefined, ua), { headers: { 'User-Agent': ua } });
  assert.deepEqual(withUserAgentInit('https://x.test', { method: 'POST', headers: { Accept: 'a' } }, ua), {
    method: 'POST',
    headers: { Accept: 'a', 'User-Agent': ua },
  });
  const own = { headers: { 'user-agent': 'Tab UA qutai.103' } };
  assert.equal(withUserAgentInit('https://x.test', own, ua), own);
  const arr = withUserAgentInit('https://x.test', { headers: [['Accept', 'a']] as [string, string][] }, ua);
  assert.deepEqual(arr?.headers, [['Accept', 'a'], ['User-Agent', ua]]);
  const h = new Headers({ Accept: 'a' });
  const fromHeaders = withUserAgentInit('https://x.test', { headers: h }, ua);
  assert.deepEqual(fromHeaders?.headers, { accept: 'a', 'User-Agent': ua });
  assert.equal(withUserAgentInit('https://x.test', { headers: new Headers({ 'User-Agent': 'own' }) }, ua)?.headers instanceof Headers, true);
  // A URL object is an address like a string; a Request keeps its own headers.
  assert.deepEqual(withUserAgentInit(new URL('https://x.test'), undefined, ua), { headers: { 'User-Agent': ua } });
  const request = new Request('https://x.test');
  assert.equal(withUserAgentInit(request, undefined, ua), undefined);
});
