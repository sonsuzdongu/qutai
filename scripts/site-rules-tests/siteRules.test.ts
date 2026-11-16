// Site rules (src/content/siteRules.ts): the user's own hiding and domain rules, which the assistant writes when
// asked to hide the empty boxes ads leave on a page ("hide this gap and write a rule for it").
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  blockedDomains,
  checkBlockDomain,
  formatScope,
  hideLine,
  judgeMeasure,
  matchesScope,
  pageRules,
  parseRuleLine,
  parseScope,
  scopeForUrl,
  selectorProblem,
  selectorsFor,
  siteHost,
  siteRulesScript,
  type PageRule,
  type ScopeKind,
  type SiteRule,
} from '../../src/content/siteRules.ts';

const rule = (line: string, extra: Partial<SiteRule> = {}): SiteRule => ({
  id: line,
  line,
  enabled: true,
  createdAt: 0,
  source: 'assistant',
  site: 'example.com',
  ...extra,
});

test('scopes are written and read back in their four forms', () => {
  const url = 'https://www.Example.com:443/entry/123?x=1#top';
  const expected: Record<ScopeKind, string> = {
    page: 'https://example.com/entry/123?x=1',
    path: 'example.com/entry/*',
    site: 'example.com',
    subdomains: '*.example.com',
  };
  for (const [kind, text] of Object.entries(expected) as [ScopeKind, string][]) {
    const scope = scopeForUrl(url, kind);
    assert.ok(scope);
    assert.equal(formatScope(scope), text);
    assert.deepEqual(parseScope(text), scope, text);
  }
});

test('rule lines: hiding and domain rules round-trip; anything else is refused', () => {
  const line = hideLine(parseScope('*.example.com')!, '#ad-top');
  assert.equal(line, '*.example.com###ad-top');
  assert.deepEqual(parseRuleLine(line), { kind: 'hide', scope: { kind: 'subdomains', host: 'example.com' }, selector: '#ad-top' });
  assert.deepEqual(parseRuleLine('example.com/entry/*##div[data-ad]'), {
    kind: 'hide',
    scope: { kind: 'path', host: 'example.com', path: '/entry/' },
    selector: 'div[data-ad]',
  });
  assert.deepEqual(parseRuleLine('||ads.example.net^'), { kind: 'block', domain: 'ads.example.net' });
  for (const bad of ['', 'example.com', '##.ad', 'example.com##body', 'example.com/entry##.ad', '||com^', 'bad host##.ad', '||a b^']) {
    assert.equal(parseRuleLine(bad), null, bad);
  }
});

test('scope matching: exact page, path prefix, site, subdomains', () => {
  const page = parseScope('https://example.com/entry/1?x=2')!;
  assert.ok(matchesScope(page, 'https://example.com/entry/1?x=2'));
  assert.ok(matchesScope(page, 'http://www.example.com/entry/1?x=2#c'), 'scheme, www. and fragment do not matter');
  assert.ok(!matchesScope(page, 'https://example.com/entry/1'), 'another query is another page');
  assert.ok(!matchesScope(page, 'https://example.com/entry/12?x=2'));

  const path = parseScope('example.com/entry/*')!;
  assert.ok(matchesScope(path, 'https://example.com/entry/'));
  assert.ok(matchesScope(path, 'https://example.com/entry/9/comments'));
  assert.ok(!matchesScope(path, 'https://example.com/entryx'));
  assert.ok(!matchesScope(path, 'https://m.example.com/entry/9'), 'a path scope is for its own host');

  const site = parseScope('example.com')!;
  assert.ok(matchesScope(site, 'https://example.com/'));
  assert.ok(matchesScope(site, 'https://www.example.com/anything'));
  assert.ok(!matchesScope(site, 'https://m.example.com/'));
  assert.ok(!matchesScope(site, 'https://notexample.com/'));

  const subs = parseScope('*.example.com')!;
  assert.ok(matchesScope(subs, 'https://example.com/'));
  assert.ok(matchesScope(subs, 'https://m.example.com/a'));
  assert.ok(matchesScope(subs, 'https://a.b.example.com/'));
  assert.ok(!matchesScope(subs, 'https://badexample.com/'));
  assert.ok(!matchesScope(subs, 'about:blank'));
});

test('hosts: IDN in punycode, www. dropped, default ports dropped, other ports kept', () => {
  assert.equal(siteHost('www.ekşi.com'), 'xn--eki-tza.com');
  assert.ok(matchesScope(parseScope('*.ekşi.com')!, 'https://www.xn--eki-tza.com/'));
  assert.equal(scopeForUrl('https://example.com:443/', 'site')?.host, 'example.com');
  assert.equal(scopeForUrl('http://example.com:80/', 'site')?.host, 'example.com');
  assert.equal(scopeForUrl('http://example.com:443/', 'site')?.host, 'example.com:443');
  assert.equal(scopeForUrl('http://10.0.2.2:8765/a', 'site')?.host, '10.0.2.2:8765');
  assert.ok(!matchesScope(parseScope('10.0.2.2:8765')!, 'http://10.0.2.2:8766/'));
  assert.equal(siteHost('localhost'), 'localhost');
  assert.equal(siteHost('com'), null, 'a top-level domain is no site');
  assert.equal(siteHost('com.tr'), null, 'nor is a public suffix');
  assert.equal(parseScope('*.com'), null);
  assert.equal(parseScope('*.co.uk'), null);
});

test('selector validation and the over-broad guard', () => {
  for (const ok of ['#ad-top', '.ad-slot', 'div[data-ad]', 'main > .banner', '#side .sponsored, ins.adsbygoogle', 'div[id^="google_ads"]', 'a[href*="ads,x"]']) {
    assert.equal(selectorProblem(ok), null, ok);
  }
  assert.equal(selectorProblem(''), 'empty');
  assert.equal(selectorProblem('x'.repeat(301)), 'tooLong');
  for (const broad of ['body', 'html', '*', 'div', 'body > div', 'main section', ':root', '.ad *', '#x body', '.ad, div']) {
    assert.equal(selectorProblem(broad), 'tooBroad', broad);
  }
  for (const bad of ['.a{color:red}', '.a;', '@import x', '.a /* c */', '.a\\', '.a <b', '.a\n.b', '[data-x', '.a)']) {
    assert.equal(selectorProblem(bad), 'syntax', bad);
  }
});

test('try measurements: too much area, text or too many matches is refused', () => {
  const base = { selector: '.ad', count: 2, visible: 2, area: 0.03, text: 0 };
  assert.deepEqual(judgeMeasure(base), { ok: true });
  assert.deepEqual(judgeMeasure({ ...base, invalid: true }), { ok: false, reason: 'invalid' });
  assert.deepEqual(judgeMeasure({ ...base, count: 0, visible: 0 }), { ok: false, reason: 'noMatch' });
  assert.deepEqual(judgeMeasure({ ...base, count: 61 }), { ok: false, reason: 'count' });
  assert.deepEqual(judgeMeasure({ ...base, area: 0.3 }), { ok: false, reason: 'area' });
  assert.deepEqual(judgeMeasure({ ...base, text: 0.2 }), { ok: false, reason: 'text' });
});

test('blocked domains: malformed, public suffixes and the site itself are refused', () => {
  assert.deepEqual(checkBlockDomain('ads.example.net', 'example.com'), { domain: 'ads.example.net' });
  assert.deepEqual(checkBlockDomain('||Ads.Example.net^', null), { domain: 'ads.example.net' });
  assert.deepEqual(checkBlockDomain('https://ads.example.net/x.js', null), { domain: 'ads.example.net' });
  assert.deepEqual(checkBlockDomain('example.com', 'example.com'), { problem: 'ownSite' });
  assert.deepEqual(checkBlockDomain('example.com', 'm.example.com'), { problem: 'ownSite' });
  assert.deepEqual(checkBlockDomain('static.example.com', 'example.com'), { domain: 'static.example.com' });
  assert.deepEqual(checkBlockDomain('com.tr', null), { problem: 'invalid' });
  assert.deepEqual(checkBlockDomain('not a domain', null), { problem: 'invalid' });
});

test('only enabled rules reach the page and the blocker; off sites get none', () => {
  const rules = [
    rule('*.example.com##.ad'),
    rule('example.com##.off', { enabled: false }),
    rule('example.com/entry/*##.entry-ad'),
    rule('||ads.example.net^'),
    rule('||ads.example.net^', { id: 'dup' }),
    rule('||off.example.net^', { enabled: false }),
  ];
  assert.deepEqual(blockedDomains(rules), ['ads.example.net']);
  assert.equal(pageRules(rules).length, 2);
  assert.deepEqual(selectorsFor(rules, 'https://m.example.com/entry/1'), ['.ad']);
  assert.deepEqual(selectorsFor(rules, 'https://example.com/entry/1'), ['.ad', '.entry-ad']);
  assert.deepEqual(selectorsFor(rules, 'https://example.com/entry/1', ['example.com']), []);
  assert.deepEqual(selectorsFor(rules, 'https://m.example.com/', ['example.com']), [], 'subdomains of an off site too');
});

/** Runs the page script in a small fake page and returns the CSS it applied after each address. */
function runPageScript(rules: PageRule[], off: string[], urls: string[]): string[] {
  const styles: { textContent: string }[] = [];
  const listeners: Record<string, (() => void)[]> = {};
  const location = { hostname: '', port: '', protocol: 'https:', pathname: '/', search: '' };
  const go = (url: string) => {
    const u = new URL(url);
    Object.assign(location, { hostname: u.hostname, port: u.port, protocol: u.protocol, pathname: u.pathname, search: u.search });
  };
  const timers: (() => void)[] = [];
  const head = { appendChild: (el: { textContent: string }) => styles.push(el) };
  const window: Record<string, unknown> = {
    addEventListener: (name: string, fn: () => void) => (listeners[name] ??= []).push(fn),
  };
  const history = { pushState() {}, replaceState() {} };
  const context = {
    window,
    history,
    location,
    setTimeout: (fn: () => void) => timers.push(fn),
    MutationObserver: class {},
    document: {
      documentElement: head,
      head,
      addEventListener() {},
      createElement: () => ({ textContent: '', setAttribute() {}, parentNode: null as unknown }),
      createDocumentFragment: () => ({
        querySelector(sel: string) {
          if (sel.includes('!!')) throw new Error('bad selector');
          return null;
        },
      }),
    },
  };
  go(urls[0]);
  vm.runInNewContext(siteRulesScript(rules, off), context);
  const css = () => (styles[0]?.textContent ?? '').trim();
  const out = [css()];
  for (const url of urls.slice(1)) {
    go(url);
    history.pushState();
    timers.splice(0).forEach((fn) => fn());
    out.push(css());
  }
  return out;
}

test('page script: matches like the app, follows history API moves, drops invalid selectors, skips off sites', () => {
  const rules = pageRules([
    rule('*.example.com##.ad'),
    rule('example.com/entry/*##.entry-ad'),
    rule('https://example.com/entry/1?x=2##.one'),
    rule('example.com:8443##.port'),
  ]).concat([{ s: 'site', h: 'example.com', c: '.bad!!' }]);
  const urls = [
    'https://www.example.com/',
    'https://example.com/entry/1?x=2',
    'https://example.com/entry/2',
    'https://m.example.com/entry/1?x=2',
    'https://example.com:8443/',
    'https://other.com/',
  ];
  const got = runPageScript(rules, [], urls);
  assert.deepEqual(got, [
    '.ad{display:none!important}',
    '.ad{display:none!important}\n.entry-ad{display:none!important}\n.one{display:none!important}',
    '.ad{display:none!important}\n.entry-ad{display:none!important}',
    '.ad{display:none!important}',
    '.port{display:none!important}',
    '',
  ]);
  // The same answers as matchesScope for every rule and address.
  for (const url of urls) {
    const expected = selectorsFor(
      [rule('*.example.com##.ad'), rule('example.com/entry/*##.entry-ad'), rule('https://example.com/entry/1?x=2##.one'), rule('example.com:8443##.port')],
      url,
    );
    const css = runPageScript(rules, [], [url])[0];
    assert.deepEqual(css ? css.split('\n').map((l) => l.replace('{display:none!important}', '')) : [], expected, url);
  }
  assert.deepEqual(runPageScript(rules, ['example.com'], ['https://m.example.com/']), ['']);
});
