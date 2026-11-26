// Android's Chrome-style User-Agent (src/browser/userAgent.ts, DATA-34): made from the WebView's own string, and a
// web page can't write anything of its own into it. Run: npm run test:useragent
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.QUTAI_TEST_OS = 'android';
const { canonicalChromeUserAgent, handleUserAgentMessage, reportedUserAgent } = await import('../../src/browser/userAgent.ts');

const WEBVIEW =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.7444.102 Mobile Safari/537.36';
const CHROME = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';

test("a WebView's string becomes Chrome's reduced one: no model, no wv, no Version/4.0", () => {
  assert.equal(canonicalChromeUserAgent(WEBVIEW), CHROME);
  assert.equal(canonicalChromeUserAgent(`${WEBVIEW} qutai.130`), CHROME);
  assert.equal(canonicalChromeUserAgent(WEBVIEW.replace(' Mobile', '')), CHROME.replace(' Mobile', ''));
  // userAgentData's version is taken when it is the same or newer, never an older or absurd one.
  assert.equal(canonicalChromeUserAgent(WEBVIEW, 143), CHROME.replace('142', '143'));
  assert.equal(canonicalChromeUserAgent(WEBVIEW, 90), CHROME);
  assert.equal(canonicalChromeUserAgent(WEBVIEW, 1e9), null);
  assert.equal(canonicalChromeUserAgent(WEBVIEW, 142.5), CHROME);
});

test('nothing but the exact WebView shape is taken, so no text of the sender survives', () => {
  for (const forged of [
    'tracker-id-12345; wv)',
    WEBVIEW.replace('Mobile Safari/537.36', 'Mobile Safari/537.36 uid=abc123'),
    WEBVIEW.replace('Mozilla/5.0', 'uid-abc123 Mozilla/5.0'),
    WEBVIEW.replace('(KHTML, like Gecko)', '(KHTML, like Gecko) uid/abc123'),
    WEBVIEW.replace('Pixel 8', 'Pixel 8) uid (x'),
    WEBVIEW.replace('Chrome/142', 'Chrome/7'),
    CHROME,
    '',
  ]) {
    assert.equal(canonicalChromeUserAgent(forged), null, forged);
  }
  // The device part may be anything a phone maker wrote; none of it is kept.
  const odd = canonicalChromeUserAgent(WEBVIEW.replace('Pixel 8 Build/UQ1A.240205.002', 'uid-abc123'));
  assert.equal(odd, CHROME);
});

test('a build without the native getter: the first report is taken, then only a slightly newer version', () => {
  assert.equal(reportedUserAgent(null, WEBVIEW), CHROME);
  assert.equal(reportedUserAgent(null, 'tracker-id-12345; wv)'), null);
  assert.equal(reportedUserAgent(CHROME, WEBVIEW), null, 'nothing new');
  assert.equal(reportedUserAgent(CHROME, WEBVIEW, 143), CHROME.replace('142', '143'));
  assert.equal(reportedUserAgent(CHROME, WEBVIEW.replace('142.0.7444.102', '143.0.1.2')), CHROME.replace('142', '143'));
  assert.equal(reportedUserAgent(CHROME, WEBVIEW.replace('142.', '141.')), null, 'never back');
  assert.equal(reportedUserAgent(CHROME, WEBVIEW, 999), null, 'never far ahead');
  assert.equal(reportedUserAgent(CHROME, WEBVIEW.replace(' Mobile', ''), 143), null, 'a phone stays a phone');
});

test('the message is recognised and swallowed whatever it says; other messages are left alone', () => {
  assert.equal(handleUserAgentMessage('{"other":1}'), false);
  assert.equal(handleUserAgentMessage('not json __qutaiUA'), false);
  assert.equal(handleUserAgentMessage(JSON.stringify({ __qutaiUA: true, ua: 'tracker-id-12345; wv)', major: 5 })), true);
  assert.equal(handleUserAgentMessage(JSON.stringify({ __qutaiUA: true, ua: WEBVIEW, major: 142 })), true);
});
