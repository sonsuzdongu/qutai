// The user style sanitiser (src/content/userCss.ts, docs/page-customisation.md › CSS sanitising): what passes, what is
// refused (above all anything that could load from the network), and that the output is what runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_CSS_LENGTH, MAX_CSS_RULES, sanitizeCss, type CssProblem } from '../../src/content/userCss.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const ALLOWED: [string, string, RegExp?][] = [
  ['links red', 'a { color: red }', /a \{\n  color: red !important;\n\}/],
  ['already important', 'a{color:red!important}', /color: red !important;/],
  ['bigger text', 'body { font-size: 120%; line-height: 1.6 }', /font-size: 120% !important;/],
  ['dark background', 'html, body { background: #111 !important; color: #eee }', /background: #111 !important;/],
  ['hex colour starting with a digit', 'p { color: #1a2b3c }', /#1a2b3c/],
  ['media query', '@media (max-width: 600px) { .nav { display: none } }', /^@media \(max-width: 600px\) \{\n  \.nav \{/],
  ['media range syntax', '@media (400px <= width <= 700px) { p { margin: 0 } }', /\(400px <= width <= 700px\)/],
  ['prefers-color-scheme', '@media (prefers-color-scheme: dark) { a { color: #9cf } }', /prefers-color-scheme: dark/],
  ['supports', '@supports (display: grid) and (not (display: inline-grid)) { main { display: grid } }', /@supports/],
  ['functions', 'p { width: calc(100% - 2em); color: rgb(0 0 0 / .5); transform: rotate(3deg) scale(1.1) }', /calc\(100% - 2em\)/],
  ['gradients', '.hero { background-image: linear-gradient(to right, #fff, rgba(0,0,0,.4)) }', /linear-gradient/],
  ['custom properties and var()', ':root { --accent: tomato } a { color: var(--accent, red) }', /--accent: tomato !important;/],
  ['selectors', 'ul > li:nth-child(2n+1):not(.ad), a[href^="https"]::after, h1 ~ p + p { color: navy }', /:nth-child\(2n\+1\)/],
  ['attribute selector with a string', 'a[title="x y"] { color: red }', /a\[title="x y"\]/],
  ['content string', 'a::before { content: "→ " }', /content: "→ " !important;/],
  ['font stack', 'body { font-family: -apple-system, "Segoe UI", sans-serif }', /-apple-system/],
  ['comments are dropped', '/* hi */ a /* x */ { /* y */ color: red /* z */ }', /^a \{\n  color: red !important;\n\}\n$/],
  ['raster data image', `.logo { background: url(${PNG}) }`, /url\("data:image\/png;base64,/],
  ['quoted raster data image', `.logo { background: url( "${PNG}" ) }`, /data:image\/png/],
  ['empty rule', '.x {}', /\.x \{\}/],
  ['unicode', '.café::before { content: "\\201C" }', /\.café/],
  ['escaped selector', '.\\31 23 { color: red }', /\.\\31 23/],
];

const REFUSED: [string, string, CssProblem][] = [
  ['@import', '@import "https://evil.example/x.css";', 'atRule'],
  ['@import url', '@import url(https://evil.example/x.css);', 'atRule'],
  ['@IMPORT upper case', '@IMPORT "x.css";', 'atRule'],
  ['@import escaped', '@\\69mport "x.css";', 'atRule'],
  ['@import hex escape with space', '@\\000069 mport "x.css";', 'atRule'],
  ['@import after a comment', '/**/@import/**/"x.css";', 'atRule'],
  ['@import after rules', 'a{color:red} @import "x.css";', 'atRule'],
  ['@font-face', '@font-face { font-family: x; src: url(https://e/x.woff) }', 'atRule'],
  ['@font-face local only', '@font-face { font-family: x; src: local(Arial) }', 'atRule'],
  ['@namespace', '@namespace url(http://www.w3.org/1999/xhtml);', 'atRule'],
  ['@charset', '@charset "utf-8"; a{color:red}', 'atRule'],
  ['@keyframes', '@keyframes spin { from { opacity: 0 } }', 'atRule'],
  ['@layer', '@layer base { a { color: red } }', 'atRule'],
  ['@property', '@property --x { syntax: "<color>"; inherits: false; initial-value: red }', 'atRule'],
  ['@container', '@container (min-width: 1px) { a { color: red } }', 'atRule'],
  ['@page', '@page { margin: 0 }', 'atRule'],
  ['at-rule inside a rule', 'a { @media (x) { color: red } }', 'atRule'],
  ['url http', 'a { background: url(https://evil.example/x.png) }', 'url'],
  ['url protocol-relative', 'a { background: url(//evil.example/x.png) }', 'url'],
  ['url relative', 'a { background: url(x.png) }', 'url'],
  ['url quoted', 'a { background: url("https://evil.example/x.png") }', 'url'],
  ['url single quoted with spaces', "a { background: url(  'https://evil.example/x.png'  ) }", 'url'],
  ['URL upper case', 'a { background: URL(https://evil.example/x.png) }', 'url'],
  ['url escaped name', 'a { background: u\\72l(https://evil.example/x.png) }', 'url'],
  ['url escaped name 2', 'a { background: \\75 rl(https://evil.example/x.png) }', 'url'],
  ['url with an escaped address', 'a { background: url(ht\\74ps://evil.example/x.png) }', 'url'],
  ['url split by a comment', 'a { background: url/**/(https://evil.example/x.png) }', 'syntax'],
  ['url in cursor', 'a { cursor: url(https://evil.example/c.cur), auto }', 'url'],
  ['url in list-style', 'li { list-style: url(https://e/x.png) }', 'url'],
  ['url in a custom property', ':root { --bg: url(https://e/x.png) }', 'url'],
  ['url in a selector', 'a[href=url(x)] { color: red }', 'url'],
  ['data svg', 'a { background: url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'><image href=\'https://e/x\'/></svg>") }', 'url'],
  ['data html', 'a { background: url(data:text/html;base64,PHNjcmlwdD4=) }', 'url'],
  ['data not base64', 'a { background: url("data:image/png,abc") }', 'url'],
  ['javascript url', 'a { background: url(javascript:alert(1)) }', 'url'],
  ['image-set', 'a { background-image: image-set("x.png" 1x) }', 'function'],
  ['-webkit-image-set', 'a { background-image: -webkit-image-set("x.png" 1x) }', 'function'],
  ['image()', 'a { background-image: image("x.png") }', 'function'],
  ['cross-fade', 'a { background-image: cross-fade(url(a.png), url(b.png), 50%) }', 'function'],
  ['element()', 'a { background: element(#x) }', 'function'],
  ['paint()', 'a { background: paint(x) }', 'function'],
  ['src()', 'a { background: src("x.png") }', 'function'],
  ['attr()', 'a::after { content: attr(href) }', 'function'],
  ['attr() typed as url', 'a { background: attr(data-x url) }', 'function'],
  ['expression()', 'a { width: expression(alert(1)) }', 'function'],
  ['unknown function', 'a { color: foo(1) }', 'function'],
  ['unknown selector function', 'a:foo(1) { color: red }', 'function'],
  ['behavior', 'a { behavior: url(x.htc) }', 'property'],
  ['-moz-binding', 'a { -moz-binding: url(x.xml#y) }', 'property'],
  ['src property', 'a { src: local(x) }', 'property'],
  ['escaped property name', 'a { beh\\61vior: x }', 'property'],
  ['qutai elements', '[data-qutai] { display: none }', 'selector'],
  ['qutai escaped', '[data-\\71utai] { display: none }', 'selector'],
  ['qutai id', '#__qutaiMarker { display: none }', 'selector'],
  ['string in a selector', 'a "x" { color: red }', 'selector'],
  ['nesting', 'a { color: red; .b { color: blue } }', 'nesting'],
  ['nesting with &', 'a { &:hover { color: blue } }', 'nesting'],
  ['media in media', '@media (x) { @media (y) { a { color: red } } }', 'nesting'],
  ['unclosed block', 'a { color: red', 'syntax'],
  ['stray close', 'a { color: red } }', 'syntax'],
  ['unclosed comment', 'a { color: red } /* x', 'syntax'],
  ['unclosed string', 'a { content: "x }', 'syntax'],
  ['newline in a string', 'a { content: "x\ny" }', 'syntax'],
  ['declaration outside a rule', 'color: red;', 'syntax'],
  ['missing colon', 'a { color red }', 'syntax'],
  ['missing value', 'a { color: }', 'syntax'],
  ['bad bang', 'a { color: red !importantx }', 'syntax'],
  ['html comment', '<!-- a { color: red } -->', 'syntax'],
  ['NUL', 'a { color: red\0 }', 'syntax'],
  ['brace in a value', 'a { color: {red} }', 'nesting'],
  ['empty', '   ', 'empty'],
  ['only comments', '/* nothing */', 'empty'],
  ['too large', `a { color: red } ${' '.repeat(MAX_CSS_LENGTH)}`, 'tooLarge'],
  ['too many rules', Array.from({ length: MAX_CSS_RULES + 1 }, (_, i) => `.r${i}{color:red}`).join(''), 'tooManyRules'],
];

test('allowed constructs pass and come back normalised, with !important', () => {
  for (const [label, css, pattern] of ALLOWED) {
    const result = sanitizeCss(css);
    assert.ok(result.ok, `${label}: ${result.ok ? '' : result.detail}`);
    if (pattern) assert.match(result.css, pattern, label);
    // Every declaration is important, once.
    assert.ok(!/!important\s*!important/.test(result.css), label);
  }
});

test('refused constructs are refused with the expected reason, the whole stylesheet', () => {
  for (const [label, css, problem] of REFUSED) {
    const result = sanitizeCss(css);
    assert.equal(result.ok, false, `${label} should be refused`);
    if (!result.ok) assert.equal(result.problem, problem, `${label}: ${result.detail}`);
  }
});

test('no output can contain a network-loading construct', () => {
  for (const [, css] of [...ALLOWED, ...REFUSED]) {
    const result = sanitizeCss(css);
    if (!result.ok) continue;
    assert.ok(!/@import|@font-face|image-set|expression\(/i.test(result.css), css);
    for (const m of result.css.matchAll(/url\(([^)]*)\)/gi)) assert.match(m[1], /^"data:image\/(png|jpeg|jpg|gif|webp);base64,/i, css);
  }
});

test('sanitising is idempotent: the output passes again unchanged', () => {
  for (const [label, css] of ALLOWED) {
    const once = sanitizeCss(css);
    assert.ok(once.ok);
    const twice = sanitizeCss(once.css);
    assert.ok(twice.ok, label);
    assert.equal(twice.css, once.css, label);
  }
});

test('tokens a comment separated stay separate', () => {
  const result = sanitizeCss('a { margin: 1px/**/-2px; color: red/**/blue }');
  assert.ok(result.ok);
  assert.match(result.css, /1px\/\*\*\/-2px/);
  assert.match(result.css, /red\/\*\*\/blue/);
});

test('strings are written back safely: quotes, backslashes, "<" and new lines escaped', () => {
  const result = sanitizeCss('a::before { content: "a\\"b\\\\c</style>\\a d" }');
  assert.ok(result.ok);
  assert.ok(!result.css.includes('</style'));
  assert.match(result.css, /content: "a\\"b\\\\c\\3c \/style>\\a d"/);
});
