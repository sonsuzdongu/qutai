// Safari's user-agent ending for iOS, iPadOS and the iOS app on a Mac, and desktop-site mode built from real versions
// (src/browser/safariUserAgent.ts, DATA-33). Run: npm run test:useragent
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chromeMajor,
  desktopUserAgent,
  safariApplicationName,
  safariVersion,
} from '../../src/browser/safariUserAgent.ts';

test("Safari's version follows the system's major and minor", () => {
  assert.equal(safariVersion('26.1'), '26.1');
  assert.equal(safariVersion('26'), '26.0');
  assert.equal(safariVersion('18.6.2'), '18.6');
  assert.equal(safariVersion(17), '17.0');
  for (const bad of ['', null, undefined, 'abc', '0']) assert.equal(safariVersion(bad), null, String(bad));
});

test("each device gets the ending Safari itself sends there", () => {
  assert.equal(safariApplicationName('26.1', 'phone'), 'Version/26.1 Mobile/15E148 Safari/604.1');
  assert.equal(safariApplicationName('26.0', 'pad'), 'Version/26.0 Safari/605.1.15');
  assert.equal(safariApplicationName('27.0', 'mac'), 'Version/27.0 Safari/605.1.15');
  assert.equal(safariApplicationName(null, 'phone'), null);
});

test('the ending never names Qutai (DATA-23)', () => {
  for (const device of ['phone', 'pad', 'mac'] as const) {
    assert.ok(!/qutai/i.test(safariApplicationName('26.1', device) ?? ''), device);
  }
  assert.ok(!/qutai/i.test(desktopUserAgent('ios', { osVersion: '26.1' })));
  assert.ok(!/qutai/i.test(desktopUserAgent('android', { learnedUserAgent: 'x Chrome/142.0.0.0 qutai.130' })));
});

test('desktop-site mode uses the system Safari version on iOS', () => {
  assert.equal(
    desktopUserAgent('ios', { osVersion: '26.1' }),
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15',
  );
  // An unreadable version falls back instead of breaking the string.
  assert.match(desktopUserAgent('ios', { osVersion: '' }), /Version\/\d+\.\d+ Safari\/605\.1\.15$/);
});

test("desktop-site mode uses the WebView engine's Chrome version on Android", () => {
  const learned = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
  assert.equal(chromeMajor(learned), 142);
  assert.equal(
    desktopUserAgent('android', { learnedUserAgent: learned }),
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  );
  // Not learned yet: a fallback until the first page tells Qutai the engine version.
  assert.match(desktopUserAgent('android', {}), /Chrome\/\d+\.0\.0\.0 Safari\/537\.36$/);
});

test("a Mac's Safari version: three ahead of macOS 11-15, the same number from macOS 26 on", () => {
  assert.equal(safariVersion('15.6', 'mac'), '18.6');
  assert.equal(safariVersion('14.0', 'mac'), '17.0');
  assert.equal(safariVersion('27.0.1', 'mac'), '27.0');
  assert.equal(safariVersion('26.1', 'mac'), '26.1');
  assert.equal(safariApplicationName('15.6', 'mac'), 'Version/18.6 Safari/605.1.15');
  // iPhone and iPad follow the OS number.
  assert.equal(safariVersion('18.6', 'pad'), '18.6');
  assert.equal(safariVersion('18.6'), '18.6');
});
