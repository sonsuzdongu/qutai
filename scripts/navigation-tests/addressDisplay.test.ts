// The address bar's address while not editing (src/browser/addressDisplay.ts): the registrable domain emphasised,
// the rest subdued, and the IDN rule against look-alike hosts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressDisplay, displayHost, punycodeDecode } from '../../src/browser/addressDisplay';

const parts = (url: string) => {
  const d = addressDisplay(url);
  return [d.kind, d.before, d.domain, d.after];
};

test('https: no scheme, no www, the registrable domain apart from subdomains and path', () => {
  assert.deepEqual(parts('https://www.google.com/search?q=x'), ['web', '', 'google.com', '/search?q=x']);
  assert.deepEqual(parts('https://mail.shop.example.com.tr/a#b'), ['web', 'mail.shop.', 'example.com.tr', '/a#b']);
  assert.deepEqual(parts('https://example.com/'), ['web', '', 'example.com', '']);
  assert.deepEqual(parts('http://localhost:8823/slow'), ['web', '', 'localhost', ':8823/slow']);
});

test('the shown host is the one the WebView loads (backslash, userinfo, trailing dot, case)', () => {
  assert.equal(addressDisplay('https://evil.example\\@bank.example/').domain, 'evil.example');
  assert.equal(addressDisplay('https://bank.example@evil.example/').domain, 'evil.example');
  assert.equal(addressDisplay('https://WWW.Example.COM./x').domain, 'example.com');
  assert.deepEqual(parts('https://login.bank.example.evil.com/'), ['web', 'login.bank.example.', 'evil.com', '']);
});

test('a very long host keeps its registrable domain whole (the bar cuts the subdomains from the left)', () => {
  const d = addressDisplay(`https://${'a'.repeat(60)}.b.c.example.co.uk/x`);
  assert.equal(d.domain, 'example.co.uk');
  assert.ok(d.before.endsWith('.b.c.'));
});

test('IP addresses, IPv6, ports, files, internal pages and data addresses', () => {
  assert.deepEqual(parts('https://192.168.1.1:8443/admin'), ['ip', '', '192.168.1.1', ':8443/admin']);
  assert.deepEqual(parts('http://0x7f.1/'), ['ip', '', '127.0.0.1', '']);
  assert.deepEqual(parts('http://[::1]:3000/'), ['ip', '', '[::1]', ':3000']);
  assert.deepEqual(parts('file:///sdcard/Download/a.pdf'), ['file', '', 'file', ' /sdcard/Download/a.pdf']);
  assert.deepEqual(parts('about:blank'), ['internal', '', 'about:blank', '']);
  // A data: or blob: page could write a site's name in its own address: only the scheme is shown.
  assert.deepEqual(parts('data:text/html,<h1>https://bank.example</h1>'), ['other', '', 'data:', '']);
  assert.deepEqual(parts('blob:https://bank.example/uuid'), ['other', '', 'blob:', '']);
});

test('IDN: Unicode only for safe single-script labels; look-alikes and mixed scripts stay punycode', () => {
  assert.equal(punycodeDecode('bcher-kva'), 'bücher');
  assert.equal(displayHost('xn--bcher-kva.de'), 'bücher.de', 'Latin with diacritics');
  assert.equal(displayHost('xn--e1afmkfd.xn--p1ai'), 'пример.рф', 'Cyrillic under a Cyrillic TLD');
  assert.equal(displayHost('xn--wgv71a119e.jp'), '日本語.jp', 'Han');
  // "аррӏе" in Cyrillic letters that look Latin, under .com: a whole-script look-alike of apple.com.
  assert.equal(displayHost('xn--80ak6aa92e.com'), 'xn--80ak6aa92e.com');
  // Latin "pple" with a Cyrillic "а": mixed scripts in one label.
  assert.equal(displayHost('xn--pple-43d.com'), 'xn--pple-43d.com');
  // Not valid punycode: shown as is.
  assert.equal(displayHost('xn--zz-.com'), 'xn--zz-.com');
  // One unsafe label makes the whole host punycode.
  assert.equal(displayHost('xn--bcher-kva.xn--80ak6aa92e.com'), 'xn--bcher-kva.xn--80ak6aa92e.com');
});
