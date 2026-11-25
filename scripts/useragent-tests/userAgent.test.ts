// The " qutai.<build>" ending of the User-Agent sent to Qutai's server and nowhere else (src/net/userAgentToken.ts,
// DATA-23), and its agreement with the version rule (docs/versioning.md). Run: npm run test:useragent
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  appUserAgent,
  initForRequest,
  isQutaiServer,
  originOf,
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
  assert.equal(withQutaiToken('Qutai/0.1.3 (iOS)', 'qutai.103'), 'Qutai/0.1.3 (iOS) qutai.103');
  assert.equal(withQutaiToken('Qutai/0.1.3 (iOS) qutai.101', 'qutai.103'), 'Qutai/0.1.3 (iOS) qutai.103');
  assert.equal(withQutaiToken('Qutai/0.1.3 (iOS) qutai.103 qutai.103', 'qutai.103'), 'Qutai/0.1.3 (iOS) qutai.103');
  // No readable build: the string as it was.
  assert.equal(withQutaiToken('Qutai/0.1.3 (iOS)', null), 'Qutai/0.1.3 (iOS)');
});

test('a web view string saved by the 19-20 Nov builds loses the token (Android learned string)', () => {
  assert.equal(withoutQutaiToken(`${ANDROID_CHROME} qutai.103`), ANDROID_CHROME);
  assert.equal(withoutQutaiToken(`${IOS} qutai.103`), IOS);
});

test('the token is removed without touching anything else', () => {
  const wv = 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.7444.0 Mobile Safari/537.36';
  assert.equal(withoutQutaiToken(`${wv} qutai.103`), wv);
  assert.equal(withoutQutaiToken(wv), wv);
  // Only a whole token: something that merely contains the letters stays.
  assert.equal(withoutQutaiToken('Foo myqutai.103x Bar'), 'Foo myqutai.103x Bar');
});

test("requests to Qutai's server say Qutai/<version> (<platform>) qutai.<build>", () => {
  assert.equal(appUserAgent('0.1.3', 'ios', 'qutai.103'), 'Qutai/0.1.3 (iOS) qutai.103');
  assert.equal(appUserAgent('0.1.3', 'android', 'qutai.103'), 'Qutai/0.1.3 (Android) qutai.103');
  assert.equal(appUserAgent('–', 'ios', null), 'Qutai/0 (iOS)');
});

const SERVER = 'https://api.qutai.example/';
const UA = 'Qutai/0.1.3 (iOS) qutai.103';

test("only the Qutai server's origin counts as Qutai's server", () => {
  assert.equal(originOf('https://API.qutai.example/v1/'), 'https://api.qutai.example');
  assert.equal(originOf('ftp://api.qutai.example'), null);
  assert.equal(originOf(null), null);
  assert.equal(originOf('not a url'), null);
  for (const yes of ['https://api.qutai.example/config', 'https://api.qutai.example:443/v1/relay', new URL('https://api.qutai.example/backup')]) {
    assert.equal(isQutaiServer(yes, SERVER), true, String(yes));
  }
  for (const no of [
    'https://example.com/',
    'https://evil.api.qutai.example/config', // a subdomain
    'https://api.qutai.example.evil.com/config', // a lookalike host
    'http://api.qutai.example/config', // another scheme
    'https://api.qutai.example:8443/config', // another port
    'https://user@evil.com/?https://api.qutai.example',
    '/relative',
    '',
  ]) {
    assert.equal(isQutaiServer(no, SERVER), false, no);
  }
  // No server address in this build: nothing is Qutai's.
  assert.equal(isQutaiServer('https://api.qutai.example/config', null), false);
  assert.equal(isQutaiServer('https://api.qutai.example/config', ''), false);
});

test("the token goes to Qutai's server and to nothing else", () => {
  // Qutai's server: accounts, credits relay, backup, config, purchases.
  for (const path of ['auth/session', 'v1/relay', 'backup', 'config', 'purchases/sync']) {
    const init = initForRequest(`https://api.qutai.example/${path}`, { method: 'POST' }, SERVER, UA);
    assert.deepEqual(init, { method: 'POST', headers: { 'User-Agent': UA } }, path);
  }
  const local = initForRequest('http://localhost:8787/config', undefined, 'http://localhost:8787', UA);
  assert.deepEqual(local, { headers: { 'User-Agent': UA } });

  // Everything else: the init exactly as the caller gave it (the same object, or undefined), no User-Agent added.
  const third = [
    'https://www.wikipedia.org/', // a website (favicons, link checks, PDFs)
    'https://api.anthropic.com/v1/messages', // an AI provider with the user's own key
    'https://api.openai.com/v1/chat/completions',
    'https://openrouter.ai/api/v1/chat/completions',
    'https://suggestqueries.google.com/complete/search?q=x', // a search engine's suggestions
    'https://duckduckgo.com/ac/?q=x',
    'https://easylist.to/easylist/easylist.txt', // a filter list
    'https://cdn.example.net/after-redirect', // where a redirect would lead
  ];
  for (const url of third) {
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
    assert.equal(initForRequest(url, init, SERVER, UA), init, url);
    assert.equal(initForRequest(url, undefined, SERVER, UA), undefined, url);
    assert.equal(initForRequest(new URL(url), undefined, SERVER, UA), undefined, url);
  }
  // A Request object for a third party is left alone too.
  assert.equal(initForRequest(new Request('https://api.anthropic.com/v1/messages'), undefined, SERVER, UA), undefined);
  // Without a server address no request gets the token.
  assert.equal(initForRequest('https://api.qutai.example/config', undefined, null, UA), undefined);
});

test("a redirect target is decided by its own origin, not the first request's", () => {
  // Each hop the app itself starts (e.g. following a Location it read) goes through the same decision.
  assert.equal(initForRequest('https://downloads.example.org/file.zip', undefined, SERVER, UA), undefined);
  assert.deepEqual(initForRequest('https://api.qutai.example/config', undefined, SERVER, UA), { headers: { 'User-Agent': UA } });
});

test("fetch to Qutai's server gets the app's User-Agent unless the call set its own", () => {
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

test('no web view, download or image save adds the token (the sources say so)', () => {
  const root = new URL('../../', import.meta.url).pathname;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx?|kt|swift)$/.test(name)) files.push(path);
    }
  };
  walk(join(root, 'src'));
  walk(join(root, 'modules'));
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = file.slice(root.length);
    // The only applicationNameForUserAgent is Safari's own ending (DATA-33, src/browser/safariUserAgent.ts), which
    // carries no Qutai string (checked in safariUserAgent.test.ts).
    for (const use of text.match(/applicationNameForUserAgent=\{[^}]*\}/g) ?? []) {
      assert.equal(use, 'applicationNameForUserAgent={SAFARI_APPLICATION_NAME}', `${rel}: ${use}`);
    }
    assert.ok(
      !/applicationNameForUserAgent(?!=\{SAFARI_APPLICATION_NAME\})/.test(text) ||
        rel === 'src/browser/desktopMode.ts' ||
        rel === 'src/browser/safariUserAgent.ts',
      `${rel} sets applicationNameForUserAgent to something other than Safari's ending`,
    );
    assert.ok(!/userAgentSuffix/.test(text), `${rel} passes a userAgentSuffix`);
    if (!rel.startsWith('src/net/')) {
      assert.ok(!/QUTAI_SERVER_USER_AGENT|withQutaiToken|appUserAgent\(/.test(text), `${rel} uses the server User-Agent outside src/net`);
    }
  }
});
