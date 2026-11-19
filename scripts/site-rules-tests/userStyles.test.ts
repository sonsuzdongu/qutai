// User styles (src/content/userStyles.ts) and the rules file version 2 (src/content/rulesFile.ts): scopes and their
// matching (the page script agrees with the app), SPA moves, the trial and "Styles off for this page", and export /
// import round trips with version 1 files.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { exportRules, importRules, type SiteRule } from '../../src/content/siteRules.ts';
import { exportRulesFile, importRulesFile, RULES_FILE_FORMAT } from '../../src/content/rulesFile.ts';
import {
  checkStyleEntry,
  cleanStyleName,
  formatStyleScope,
  matchesStyleScope,
  pageStyles,
  parseStyleScope,
  styleScopeForUrl,
  stylesFor,
  STYLE_SCOPE_KINDS,
  trialStyleScript,
  userStylesScript,
  type PageStyle,
  type StyleScopeKind,
  type UserStyle,
} from '../../src/content/userStyles.ts';

const style = (scope: string, css: string, extra: Partial<UserStyle> = {}): UserStyle => ({
  id: `${scope} ${css}`,
  name: 'Test',
  scope,
  css,
  enabled: true,
  source: 'assistant',
  site: 'example.com',
  createdAt: 0,
  ...extra,
});

const rule = (line: string, extra: Partial<SiteRule> = {}): SiteRule => ({
  id: line,
  line,
  enabled: true,
  createdAt: 0,
  source: 'manual',
  site: 'example.com',
  ...extra,
});

test('style scopes: the four hide-rule forms plus "everywhere", written and read back', () => {
  const url = 'https://www.example.com/entry/7?x=1#top';
  const expected: Record<StyleScopeKind, string> = {
    page: 'https://example.com/entry/7?x=1',
    path: 'example.com/entry/*',
    site: 'example.com',
    subdomains: '*.example.com',
    all: '*',
  };
  for (const kind of STYLE_SCOPE_KINDS) {
    const scope = styleScopeForUrl(url, kind);
    assert.ok(scope, kind);
    assert.equal(formatStyleScope(scope), expected[kind]);
    assert.deepEqual(parseStyleScope(expected[kind]), scope, kind);
  }
  assert.equal(styleScopeForUrl('about:blank', 'all'), null, 'no scope for non-web pages');
  assert.equal(parseStyleScope('**'), null);
  assert.equal(parseStyleScope('co.uk'), null, 'a public suffix is no site');
});

test('matching: every scope against pages, www and ports, non-web pages never', () => {
  const cases: [string, string, boolean][] = [
    ['*', 'https://anything.example.org/x', true],
    ['*', 'about:blank', false],
    ['*', 'file:///x.html', false],
    ['*.example.com', 'https://m.example.com/', true],
    ['*.example.com', 'https://example.com/', true],
    ['*.example.com', 'https://badexample.com/', false],
    ['example.com', 'https://www.example.com/a', true],
    ['example.com', 'https://m.example.com/a', false],
    ['example.com/entry/*', 'https://example.com/entry/9', true],
    ['example.com/entry/*', 'https://example.com/other', false],
    ['https://example.com/a?b=1', 'http://example.com/a?b=1#c', true],
    ['https://example.com/a?b=1', 'https://example.com/a?b=2', false],
    ['localhost:8791', 'http://localhost:8791/page', true],
    ['localhost:8791', 'http://localhost:8000/page', false],
  ];
  for (const [scope, url, expected] of cases) {
    const parsed = parseStyleScope(scope);
    assert.ok(parsed, scope);
    assert.equal(matchesStyleScope(parsed, url), expected, `${scope} on ${url}`);
  }
});

test('stylesFor and pageStyles: enabled styles only', () => {
  const styles = [style('*.example.com', 'a{color:red}'), style('*', 'body{zoom:1}'), style('example.com', 'p{x:y}', { enabled: false })];
  assert.equal(stylesFor(styles, 'https://example.com/').length, 2);
  assert.equal(stylesFor(styles, 'https://other.org/').length, 1);
  assert.deepEqual(pageStyles(styles), [
    { s: 'subdomains', h: 'example.com', c: 'a{color:red}' },
    { s: 'all', h: '', c: 'body{zoom:1}' },
  ]);
});

test('names: one line, trimmed, capped; entries from files and backups are checked again', () => {
  assert.equal(cleanStyleName('  Red\nlinks\t '), 'Red links');
  assert.equal(cleanStyleName('x'.repeat(200)).length, 80);
  assert.equal(cleanStyleName(5), '');
  assert.deepEqual(checkStyleEntry({ name: 'Red', scope: '*.example.com', css: 'a{color:red}' }), {
    name: 'Red',
    scope: '*.example.com',
    css: 'a {\n  color: red !important;\n}\n',
  });
  assert.equal(checkStyleEntry({ name: 'x', scope: '*.example.com', css: '@import "x.css";' }), null);
  assert.equal(checkStyleEntry({ name: 'x', scope: 'not a scope at all', css: 'a{color:red}' }), null);
  assert.equal(checkStyleEntry({ name: 'x', scope: '*', css: 5 }), null);
  assert.equal(checkStyleEntry({ scope: 'example.com', css: 'a{color:red}' })?.name, 'example.com', 'a missing name becomes the scope');
});

type FakeEl = { textContent: string; parentNode: unknown };

/** Runs the style script in a small fake page; returns helpers to move around and read the applied CSS. */
function fakePage(styles: PageStyle[], off: boolean, url: string) {
  const els: FakeEl[] = [];
  const listeners: Record<string, (() => void)[]> = {};
  const docListeners: Record<string, (() => void)[]> = {};
  const location = { hostname: '', port: '', protocol: 'https:', pathname: '/', search: '' };
  const go = (to: string) => {
    const u = new URL(to);
    Object.assign(location, { hostname: u.hostname, port: u.port, protocol: u.protocol, pathname: u.pathname, search: u.search });
  };
  const timers: (() => void)[] = [];
  const root = {
    lastChild: null as unknown,
    appendChild(el: FakeEl) {
      if (!els.includes(el)) els.push(el);
      el.parentNode = root;
      root.lastChild = el;
    },
  };
  const window: Record<string, unknown> = {
    addEventListener: (name: string, fn: () => void) => (listeners[name] ??= []).push(fn),
  };
  window.top = window;
  const history = { pushState() {}, replaceState() {} };
  const context = {
    window,
    history,
    location,
    setTimeout: (fn: () => void) => timers.push(fn),
    MutationObserver: class {},
    document: {
      documentElement: root,
      addEventListener: (name: string, fn: () => void) => (docListeners[name] ??= []).push(fn),
      createElement: () => ({ textContent: '', setAttribute() {}, parentNode: null }),
    },
  };
  go(url);
  vm.runInNewContext(userStylesScript(styles, off), context);
  return {
    css: () => (els[0]?.textContent ?? '').trim(),
    elements: () => els.length,
    run: (code: string) => vm.runInNewContext(code, context),
    spa: (to: string) => {
      go(to);
      history.pushState();
      timers.splice(0).forEach((fn) => fn());
    },
    pageAddsSheet: () => {
      root.lastChild = { page: true };
      (docListeners.DOMContentLoaded ?? []).forEach((fn) => fn());
    },
    isLast: () => root.lastChild === els[0],
  };
}

test('page script: matches like the app and follows SPA moves', () => {
  const styles = pageStyles([
    style('*.example.com', 'a{color:red}'),
    style('example.com/entry/*', '.entry{x:y}'),
    style('https://example.com/entry/1', '.one{x:y}'),
    style('*', '.all{x:y}'),
  ]);
  const page = fakePage(styles, false, 'https://example.com/entry/1');
  assert.equal(page.css(), 'a{color:red}\n.entry{x:y}\n.one{x:y}\n.all{x:y}');
  page.spa('https://example.com/entry/2');
  assert.equal(page.css(), 'a{color:red}\n.entry{x:y}\n.all{x:y}');
  page.spa('https://other.org/');
  assert.equal(page.css(), '.all{x:y}');
  assert.equal(page.elements(), 1, 'one style element, reused');
});

test('page script: moved after the page’s own sheets; "Styles off" and the trial', () => {
  const styles = pageStyles([style('*.example.com', 'a{color:red}')]);
  const page = fakePage(styles, false, 'https://example.com/');
  page.pageAddsSheet();
  assert.ok(page.isLast(), 'the user styles come last');
  // The trial adds to the kept styles; "" removes it.
  page.run(trialStyleScript('p{color:blue}', styles, false));
  assert.equal(page.css(), 'a{color:red}\np{color:blue}');
  page.run(trialStyleScript('', styles, false));
  assert.equal(page.css(), 'a{color:red}');
  // Styles off for this page: nothing applies, the trial included; on again restores both.
  page.run(trialStyleScript('p{color:blue}', styles, false));
  page.run(userStylesScript(styles, true));
  assert.equal(page.css(), '');
  page.run(userStylesScript(styles, false));
  assert.equal(page.css(), 'a{color:red}\np{color:blue}');
  // A kept style switched off in "My rules" reaches the open page.
  page.run(userStylesScript([], false));
  assert.equal(page.css(), 'p{color:blue}');
});

test('page script: off from the start applies nothing', () => {
  const page = fakePage(pageStyles([style('*', 'a{color:red}')]), true, 'https://example.com/');
  assert.equal(page.css(), '');
});

test('rules file v2: filter lines and styles round-trip, the format line is written', () => {
  const rules = [rule('*.example.com##.ad'), rule('||ads.example.net^', { enabled: false })];
  const styles = [
    style('*.example.com', 'a {\n  color: red !important;\n}\n', { name: 'Red links' }),
    style('*', 'body {\n  font-size: 120% !important;\n}\n', { name: 'Bigger text', enabled: false }),
  ];
  const text = exportRulesFile(rules, styles, new Date('2026-11-19T10:00:00Z'));
  assert.match(text, new RegExp(`^! Title: Qutai site rules\\n! Qutai-Format: ${RULES_FILE_FORMAT}\\n`));
  assert.match(text, /^! \[style\] \{"name":"Red links","scope":"\*\.example\.com","enabled":true\}$/m);
  const read = importRulesFile(text);
  assert.equal(read.format, RULES_FILE_FORMAT);
  assert.deepEqual(read.rules, [
    { line: '*.example.com##.ad', enabled: true, site: 'example.com' },
    { line: '||ads.example.net^', enabled: false, site: 'ads.example.net' },
  ]);
  assert.deepEqual(read.styles, [
    { name: 'Red links', scope: '*.example.com', css: styles[0].css, enabled: true, site: 'example.com' },
    { name: 'Bigger text', scope: '*', css: styles[1].css, enabled: false, site: '*' },
  ]);
  assert.equal(read.invalid, 0);
  // Read again with what the phone now has: everything is a duplicate.
  const again = importRulesFile(text, rules.map((r) => r.line), styles);
  assert.equal(again.rules.length + again.styles.length, 0);
  assert.equal(again.duplicates, 4);
});

test('rules file: a version 1 file reads as before; version 1 readers skip version 2 styles', () => {
  const v1 = exportRules([rule('*.example.com##.ad')], new Date(0));
  const read = importRulesFile(v1);
  assert.equal(read.format, 1);
  assert.equal(read.rules.length, 1);
  assert.equal(read.styles.length, 0);
  // An older Qutai (importRules only) reading a v2 file: the filter lines, no style lines as rules, nothing invalid.
  const v2 = exportRulesFile([rule('*.example.com##.ad')], [style('*', 'a {\n  color: red !important;\n}\n')]);
  const old = importRules(v2);
  assert.equal(old.rules.length, 1);
  assert.equal(old.invalid, 0);
});

test('rules file: styles are sanitised on import; broken, unknown and unclosed blocks never become rules', () => {
  const text = [
    '! Qutai-Format: 2',
    '! [style] {"name":"Evil","scope":"*","enabled":true}',
    '! | @import "https://evil.example/x.css";',
    '! [end]',
    '! [style] {"name":"Raw","scope":"example.com","enabled":true}',
    '! | a{color:red}',
    '! [end]',
    '! [script] {"name":"Everywhere","scope":"*"}',
    '! | return 1;',
    '! [end]',
    '! [widget] {"name":"Later"}',
    '! | something',
    '! [end]',
    '! [style] {"name":"Unclosed","scope":"*"}',
    '! | a{color:blue}',
    '*.example.com##.ad',
    '! [style] not json',
    '! | a{color:green}',
    '! [end]',
  ].join('\n');
  const read = importRulesFile(text);
  assert.equal(read.format, 2);
  assert.deepEqual(
    read.styles.map((s) => [s.name, s.css]),
    [['Raw', 'a {\n  color: red !important;\n}\n']],
  );
  assert.equal(read.unsupported, 1, 'the block of an unknown kind');
  assert.equal(read.scripts.length, 0, 'a script for everywhere is refused');
  assert.equal(read.invalid, 4, 'the @import style, the "everywhere" script, the unclosed block and the block whose header is not JSON');
  assert.equal(read.rules.length, 1);
  assert.ok(read.styles.every((s) => !s.css.includes('@import')));
});
