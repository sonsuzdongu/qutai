// The key of a certificate exception ("host:port") is read with the app's one URL parser (utils/webUrl.ts, SITE-25),
// so it names the host the WebView loads, also for addresses a hand-written pattern reads differently.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { certificateKey } from '../../src/browser/certificateExceptions.ts';

test('certificateKey: host and port as the WebView reads the address', () => {
  assert.equal(certificateKey('https://Example.com/path'), 'example.com:443');
  assert.equal(certificateKey('https://example.com.:8443/'), 'example.com:8443');
  assert.equal(certificateKey('https://user:pw@example.com/'), 'example.com:443');
  assert.equal(certificateKey('https://[::1]:8443/'), '::1:8443');
  assert.equal(certificateKey('https://bücher.example/'), 'xn--bcher-kva.example:443');
  // A backslash is a slash to the WebView: the host is "a", not "b".
  assert.equal(certificateKey('https://a\\@b/'), 'a:443');
  assert.equal(certificateKey('http://example.com/'), null);
  assert.equal(certificateKey('not an address'), null);
});
