// App packages (src/apps/manifest.ts, docs/mini-apps.md › The package): the manifest and file checks as a table, the
// SVG icon subset, the canonical hash and the device seal.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkFiles,
  checkManifest,
  checkPackage,
  checkSvgIcon,
  cleanAppName,
  newAppId,
  packageHash,
  packageSeal,
  packageSealMatches,
  utf8Length,
  type AppManifest,
  type AppPackage,
} from '../../src/apps/manifest.ts';
import { notesFiles } from './notesApp.mjs';

const KEY = new Uint8Array(32).fill(7);

function manifest(extra: Record<string, unknown> = {}): AppManifest {
  return {
    format: 'qutai-app',
    formatVersion: 1,
    id: 'app-abcdefghij12',
    name: 'Notes',
    description: 'My notes',
    icon: { name: 'notes' },
    version: 1,
    contract: 1,
    permissions: [],
    entry: 'index.html',
    language: 'tr',
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T10:00:00.000Z',
    author: { kind: 'local' },
    ...extra,
  } as AppManifest;
}

const MANIFEST_CASES: [string, Record<string, unknown>, string | null, { forWriting?: boolean }?][] = [
  ['a valid manifest', {}, null],
  ['wrong format', { format: 'zip' }, 'format'],
  ['format version 0', { formatVersion: 0 }, 'formatVersion'],
  ['a newer format', { formatVersion: 2 }, 'formatVersion'],
  ['id without prefix', { id: 'abcdefghij12' }, 'id'],
  ['id with capitals', { id: 'app-ABCDEFGHIJ12' }, 'id'],
  ['id too short', { id: 'app-abc' }, 'id'],
  ['empty name', { name: '' }, 'name'],
  ['name with a line break', { name: 'a\nb' }, 'name'],
  ['name with outer spaces', { name: ' Notes ' }, 'name'],
  ['name over 40 characters', { name: 'x'.repeat(41) }, 'name'],
  ['name of 40 characters', { name: 'x'.repeat(40) }, null],
  ['name in Turkish', { name: 'Notlarım ğüşıöç' }, null],
  ['description over 200', { description: 'x'.repeat(201) }, 'description'],
  ['description with a control character', { description: 'a\u0007b' }, 'description'],
  ['description not text', { description: 5 }, 'description'],
  ['icon missing', { icon: undefined }, 'icon'],
  ['icon unknown name', { icon: { name: 'rocket' } }, 'icon.name'],
  ['icon name and svg', { icon: { name: 'notes', svg: '<svg></svg>' } }, 'icon'],
  ['icon colour bad', { icon: { name: 'notes', color: 'red' } }, 'icon.color'],
  ['icon colour good', { icon: { name: 'notes', color: '#ff8800' } }, null],
  ['icon svg with script', { icon: { svg: '<svg><script>alert(1)</script></svg>' } }, 'icon.svg'],
  ['icon svg good', { icon: { svg: '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="#fff"/></svg>' } }, null],
  ['version 0', { version: 0 }, 'version'],
  ['version 1.5', { version: 1.5 }, 'version'],
  ['contract missing', { contract: undefined }, 'contract'],
  ['contract 2 when writing', { contract: 2 }, 'contract', { forWriting: true }],
  ['contract 2 when listing an import', { contract: 2 }, null],
  ['permissions not a list', { permissions: 'clipboard-read' }, 'permissions'],
  ['unknown permission', { permissions: ['root'] }, 'permissions'],
  ['implicit permission listed', { permissions: ['storage'] }, 'permissions'],
  ['permission twice', { permissions: ['clipboard-read', 'clipboard-read'] }, 'permissions'],
  ['phase-1 permissions', { permissions: ['clipboard-read', 'clipboard-write'] }, null, { forWriting: true }],
  ['location when writing in phase 1', { permissions: ['location'] }, 'permissions', { forWriting: true }],
  ['location in an import', { permissions: ['location'] }, null],
  ['network hosts when writing', { network: { hosts: ['example.com'] } }, 'network', { forWriting: true }],
  ['network hosts not a list', { network: { hosts: 'example.com' } }, 'network'],
  ['empty network when writing', { network: { hosts: [] } }, null, { forWriting: true }],
  ['entry not html', { entry: 'app.js' }, 'entry'],
  ['entry in a folder', { entry: 'www/index.html' }, 'entry'],
  ['language bad', { language: 'Turkish' }, 'language'],
  ['language with region', { language: 'pt-BR' }, null],
  ['createdAt not ISO', { createdAt: 'yesterday' }, 'createdAt'],
  ['author missing', { author: undefined }, 'author'],
  ['author someone', { author: { kind: 'person', name: 'Ada' } }, 'author'],
  ['imported author without file', { author: { kind: 'imported' } }, 'author'],
  ['imported author', { author: { kind: 'imported', file: 'notes.qutaiapp', importedAt: '2026-11-19T10:00:00.000Z' } }, null],
];

for (const [name, extra, field, options] of MANIFEST_CASES) {
  test(`manifest: ${name}`, () => {
    const problems = checkManifest(manifest(extra), options);
    if (field === null) assert.deepEqual(problems, []);
    else assert.ok(problems.some((p) => p.field === field), `${field} in ${JSON.stringify(problems)}`);
  });
}

test('manifest: not an object', () => {
  assert.equal(checkManifest(null)[0].field, 'manifest');
  assert.equal(checkManifest([1])[0].field, 'manifest');
});

const FILE_CASES: [string, Record<string, unknown>, string | null][] = [
  ['the notes app', notesFiles(), null],
  ['entry missing', { 'app.js': '' }, 'files'],
  ['a folder', { 'index.html': '', 'js/app.js': '' }, 'files.js/app.js'],
  ['dot dot', { 'index.html': '', '../x.js': '' }, 'files.../x.js'],
  ['capital letters', { 'index.html': '', 'App.js': '' }, 'files.App.js'],
  ['an image file', { 'index.html': '', 'logo.png': '' }, 'files.logo.png'],
  ['a second html file', { 'index.html': '', 'about.html': '' }, 'files.about.html'],
  ['a file not text', { 'index.html': 5 }, 'files.index.html'],
  ['a NUL byte', { 'index.html': 'a\u0000b' }, 'files.index.html'],
  ['a lone surrogate', { 'index.html': 'a\ud800b' }, 'files.index.html'],
  ['a file over 256 KB', { 'index.html': 'x'.repeat(256 * 1024 + 1) }, 'files.index.html'],
  ['a file of 256 KB', { 'index.html': 'x'.repeat(256 * 1024) }, null],
  ['multibyte text counted in bytes', { 'index.html': 'ğ'.repeat(128 * 1024 + 1) }, 'files.index.html'],
  [
    'a package over 512 KB',
    { 'index.html': 'x'.repeat(200 * 1024), 'a.js': 'x'.repeat(200 * 1024), 'b.js': 'x'.repeat(200 * 1024) },
    'files',
  ],
  ['13 files', Object.fromEntries([['index.html', ''], ...Array.from({ length: 12 }, (_, i) => [`f${i}.js`, ''])]), 'files'],
  ['12 files', Object.fromEntries([['index.html', ''], ...Array.from({ length: 11 }, (_, i) => [`f${i}.js`, ''])]), null],
];

for (const [name, files, field] of FILE_CASES) {
  test(`files: ${name}`, () => {
    const problems = checkFiles(files, 'index.html');
    if (field === null) assert.deepEqual(problems, []);
    else assert.ok(problems.some((p) => p.field === field), `${field} in ${JSON.stringify(problems)}`);
  });
}

test('files: not an object', () => {
  assert.equal(checkFiles(['index.html'], 'index.html')[0].field, 'files');
});

const SVG_CASES: [string, string, boolean][] = [
  ['a path', '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L2 2" stroke="#000" stroke-width="2"/></svg>', true],
  ['groups and shapes', '<svg viewBox="0 0 10 10"><g opacity="0.5"><circle cx="5" cy="5" r="4"/><rect x="1" y="1" width="2" height="2" rx="1"/></g></svg>', true],
  ['a script', '<svg><script>alert(1)</script></svg>', false],
  ['an onload handler', '<svg onload="alert(1)"></svg>', false],
  ['a style attribute', '<svg style="fill:red"></svg>', false],
  ['an href', '<svg><use href="#a"/></svg>', false],
  ['an image', '<svg><image href="https://evil.example/x.png"/></svg>', false],
  ['foreignObject', '<svg><foreignObject><div/></foreignObject></svg>', false],
  ['url() in fill', '<svg><path fill="url(https://evil.example/#a)"/></svg>', false],
  ['an entity', '<svg><path d="&lt;"/></svg>', false],
  ['a comment', '<svg><!-- x --></svg>', false],
  ['text content', '<svg>hello</svg>', false],
  ['unquoted attribute', '<svg width=10></svg>', false],
  ['two roots', '<svg></svg><svg></svg>', true],
  ['not svg', '<div></div>', false],
  ['over 4 KB', `<svg><path d="${'M0 0'.repeat(1100)}"/></svg>`, false],
];
for (const [name, svg, ok] of SVG_CASES) {
  test(`svg icon: ${name}`, () => {
    assert.equal(checkSvgIcon(svg) === null, ok, String(checkSvgIcon(svg)));
  });
}

test('names are cleaned to one line of 40 characters', () => {
  assert.equal(cleanAppName('  My\n  notes\t app '), 'My notes app');
  assert.equal(cleanAppName('x'.repeat(50)).length, 40);
  assert.equal(cleanAppName(5), '');
});

test('ids: app- and 12 characters', () => {
  assert.match(newAppId(new Uint8Array(12).fill(200)), /^app-[a-z0-9]{12}$/);
});

test('utf8Length counts bytes', () => {
  assert.equal(utf8Length('aé€😀'), 1 + 2 + 3 + 4);
  assert.equal(utf8Length('\ud800'), 3);
});

test('the hash covers files and what the manifest promises, not the version number or times', () => {
  const pkg: AppPackage = { manifest: manifest(), files: notesFiles() };
  const hash = packageHash(pkg);
  assert.equal(packageHash({ ...pkg, manifest: manifest({ version: 9, updatedAt: '2027-01-01T00:00:00.000Z' }) }), hash);
  assert.notEqual(packageHash({ ...pkg, files: { ...pkg.files, 'app.js': pkg.files['app.js'] + ' ' } }), hash);
  assert.notEqual(packageHash({ ...pkg, manifest: manifest({ permissions: ['clipboard-read'] }) }), hash);
  assert.notEqual(packageHash({ ...pkg, manifest: manifest({ name: 'Other' }) }), hash);
  // File boundaries count: moving text from one file to another changes the hash.
  const a = { manifest: manifest(), files: { 'index.html': 'ab', 'x.js': 'c' } };
  const b = { manifest: manifest(), files: { 'index.html': 'a', 'x.js': 'bc' } };
  assert.notEqual(packageHash(a), packageHash(b));
});

test('the seal verifies only with this phone key and the same package', () => {
  const pkg: AppPackage = { manifest: manifest(), files: notesFiles() };
  const seal = packageSeal(packageHash(pkg), KEY);
  assert.ok(packageSealMatches(pkg, seal, KEY));
  assert.ok(!packageSealMatches(pkg, seal, new Uint8Array(32).fill(8)));
  assert.ok(!packageSealMatches(pkg, seal, null));
  assert.ok(!packageSealMatches(pkg, null, KEY));
  assert.ok(!packageSealMatches({ ...pkg, files: { ...pkg.files, 'app.js': 'evil()' } }, seal, KEY));
});

test('checkPackage combines both', () => {
  assert.deepEqual(checkPackage({ manifest: manifest(), files: notesFiles() }, { forWriting: true }), []);
  assert.ok(checkPackage({ manifest: manifest({ name: '' }), files: {} }).length >= 2);
});
