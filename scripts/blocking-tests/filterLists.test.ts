// Filter lists reduced to domains (src/content/filterLists.ts): which rules are used and which skipped, merging
// lists with exceptions winning, the reference matcher, hosts (IDN, public suffixes) and the native formats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  androidBlockerFile,
  contentRuleLists,
  hashText,
  isBlocked,
  isPublicSuffix,
  ListParser,
  MAX_LINE_LENGTH,
  mergeLists,
  normalizeHost,
  parentDomain,
  parseList,
  parseListInBatches,
  punycodeEncode,
  registrableDomain,
} from '../../src/content/filterLists.ts';

test('Adblock Plus domain rules: blocks, third-party blocks, unconditional exceptions; the rest is skipped', () => {
  const list = parseList(
    [
      '[Adblock Plus 2.0]',
      '! Title: test',
      '||ads.example.com^',
      '||track.example.net^$third-party',
      '||px.example.org^$3p,important',
      '@@||cdn.example.com^',
      '@@||cond.example.com^$domain=a.com', // conditional exception: skipped
      '||imgs.example.com^$image', // other option: skipped
      '||example.com/path', // a path: skipped
      'example.com##.banner', // cosmetic: skipped
      '##.ad', // cosmetic: skipped
      'plain.example.com', // a bare domain in ABP syntax is a substring rule: skipped
    ].join('\n'),
  );
  assert.deepEqual(list.block, ['ads.example.com']);
  assert.deepEqual(list.blockThirdParty, ['px.example.org', 'track.example.net']);
  assert.deepEqual(list.allow, ['cdn.example.com']);
  assert.deepEqual(list.stats, { rules: 10, used: 4, skipped: 6 });
});

test('hosts files and domains-only lists: local names and comments ignored; CRLF and a byte-order mark tolerated', () => {
  const list = parseList(
    '﻿# hosts\r\n127.0.0.1 localhost\r\n0.0.0.0 ads.example.com tracker.example.com # trailing\r\n::1 ip6-localhost\r\nbare.example.org\r\n',
  );
  assert.deepEqual(list.block, ['ads.example.com', 'bare.example.org', 'tracker.example.com']);
  assert.deepEqual(list.stats, { rules: 4, used: 2, skipped: 2 });
});

test('subdomains of a blocked domain are dropped; third-party rules under a full block too', () => {
  const list = parseList('||example.com^\n||a.example.com^\n||b.example.com^$third-party\n||x.y.other.com^$3p\n||y.other.com^$3p\n');
  assert.deepEqual(list.block, ['example.com']);
  assert.deepEqual(list.blockThirdParty, ['y.other.com']);
});

test('over-long lines and public suffixes are skipped, never blocking a whole country', () => {
  const list = parseList(`||${'a'.repeat(MAX_LINE_LENGTH)}.com^\n||com.tr^\n0.0.0.0 co.uk\n`);
  assert.deepEqual(list.block, []);
  assert.equal(list.stats.skipped, 3);
});

test('parsing in batches gives the same result and pauses between batches', async () => {
  const text = Array.from({ length: 25 }, (_, i) => `||host${i}.example.com^`).join('\n');
  let pauses = 0;
  const batched = await parseListInBatches(text, async () => void pauses++, 10);
  assert.deepEqual(batched, parseList(text));
  assert.equal(pauses, 2);
});

test('the parser can be fed line by line', () => {
  const p = new ListParser();
  p.line('||one.example.com^');
  p.text('||two.example.com^\r\n||three.example.com^');
  assert.equal(p.finish().block.length, 3);
});

test('merging: an exception from any list wins; only exceptions under something blocked are kept', () => {
  const merged = mergeLists([
    { block: ['example.com', 'ads.net'], blockThirdParty: ['t.org'], allow: [] },
    { block: ['sub.example.com'], blockThirdParty: ['ads.net', 'x.t.org'], allow: ['cdn.example.com', 'unrelated.io', 'ads.net'] },
  ]);
  assert.deepEqual(merged.block, ['example.com']);
  assert.deepEqual(merged.blockThirdParty, ['t.org']);
  assert.deepEqual(merged.allow, ['cdn.example.com']);
});

test('the matcher: subdomains, exceptions, third-party only across sites', () => {
  const sets = { block: new Set(['ads.com']), blockThirdParty: new Set(['track.net']), allow: new Set(['ok.ads.com']) };
  assert.equal(isBlocked('x.ads.com', 'news.org', sets), true);
  assert.equal(isBlocked('ok.ads.com', 'news.org', sets), false);
  assert.equal(isBlocked('a.ok.ads.com', null, sets), false);
  assert.equal(isBlocked('pixel.track.net', 'news.org', sets), true);
  assert.equal(isBlocked('pixel.track.net', 'www.track.net', sets), false, 'first party');
  assert.equal(isBlocked('pixel.track.net', null, sets), true, 'no page: counted as third party');
  assert.equal(isBlocked('fine.org', 'news.org', sets), false);
});

test('hosts: lower case, no trailing dot, IDN to punycode, IPs kept; junk and single labels refused', () => {
  assert.equal(normalizeHost(' Ads.Example.COM. '), 'ads.example.com');
  assert.equal(normalizeHost('10.0.0.1'), '10.0.0.1');
  assert.equal(normalizeHost('bücher.de'), 'xn--bcher-kva.de');
  assert.equal(normalizeHost('localhost'), null);
  assert.equal(normalizeHost('bad_host-.com'), null);
  assert.equal(normalizeHost('1.2.3'), null, 'a partial IP address');
  assert.equal(normalizeHost('com.tr'), null);
  assert.equal(normalizeHost(`${'a'.repeat(250)}.com`), null);
  assert.equal(punycodeEncode('münchen'), 'mnchen-3ya');
  assert.equal(punycodeEncode('日本'), 'wgv71a');
});

test('sites: the registrable domain, with country second levels and Turkish ones', () => {
  assert.equal(registrableDomain('a.b.example.com'), 'example.com');
  assert.equal(registrableDomain('www.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(registrableDomain('x.ankara.bel.tr'), 'ankara.bel.tr');
  assert.equal(registrableDomain('192.168.1.1'), '192.168.1.1');
  assert.equal(isPublicSuffix('com'), true);
  assert.equal(isPublicSuffix('gov.br'), true);
  assert.equal(isPublicSuffix('bel.de'), false);
  assert.equal(parentDomain('a.b.example.com'), 'b.example.com');
  assert.equal(parentDomain('example.com'), null);
});

test('Android file: a header line then one entry per domain', () => {
  assert.equal(
    androidBlockerFile({ block: ['a.com'], blockThirdParty: ['t.com'], allow: ['ok.a.com'] }),
    'qutai-content-blocker 1\nb a.com\nt t.com\ne ok.a.com\n',
  );
});

test('iOS rule lists: split under the limit, each with its own exceptions and the top-level page rule last', () => {
  const compiled = { block: ['a.com', 'b.com', 'c.com'], blockThirdParty: ['t.com'], allow: ['ok.a.com', 'ok.c.com'] };
  const lists = contentRuleLists(compiled, 6).map((s) => JSON.parse(s));
  assert.equal(lists.length, 2);
  for (const rules of lists) {
    assert.ok(rules.length <= 6);
    assert.deepEqual(rules.at(-1).trigger['load-context'], ['top-frame']);
  }
  const first = lists[0];
  assert.equal(first[0].action.type, 'block');
  assert.match(first[0].trigger['url-filter'], /a\\\.com\[:\/\]$/);
  assert.ok(first.some((r: { action: { type: string }; trigger: { 'url-filter': string } }) => r.action.type === 'ignore-previous-rules' && r.trigger['url-filter'].includes('ok\\.a\\.com')));
  const third = lists[1].find((r: { trigger: { 'load-type'?: string[] } }) => r.trigger['load-type']);
  assert.deepEqual(third.trigger['load-type'], ['third-party']);
  // The filter matches the domain and its subdomains, any scheme, not a longer name.
  const filter = new RegExp(first[0].trigger['url-filter']);
  assert.equal(filter.test('https://x.a.com/p'), true);
  assert.equal(filter.test('wss://a.com:443'), true);
  assert.equal(filter.test('https://nota.com/'), false);
});

test('hashText is stable and short', () => {
  assert.equal(hashText(''), '811c9dc5');
  assert.equal(hashText('abc'), hashText('abc'));
  assert.notEqual(hashText('abc'), hashText('abd'));
  assert.match(hashText('anything'), /^[0-9a-f]{8}$/);
});
