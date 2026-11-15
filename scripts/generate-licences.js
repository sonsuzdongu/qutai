#!/usr/bin/env node
/**
 * Writes src/legal/licences.json, the data behind Settings › About › Open source licences: every third-party
 * package shipped in the app with its version, licence and full licence/notice text.
 *
 * Run by hand after adding, removing or upgrading a dependency, and commit the result:
 *
 *   node scripts/generate-licences.js            # bundles the app with `expo export` to see what ships (~20 s)
 *   node scripts/generate-licences.js <dir>      # reuses an export made with --source-maps --dump-assetmap
 *
 * What it covers:
 * - npm packages whose code is in the JavaScript bundle (from the Android and iOS source maps) or whose files are
 *   bundled assets (the Material Symbols font), plus every autolinked native module (`expo-modules-autolinking`),
 *   plus pdfjs-dist (bundled through src/pdf/pdfjs.generated.json) and the prebuilt Skia binaries. Our own modules
 *   in modules/ are left out (they are Qutai's code). The text is the package's LICENSE/LICENCE/COPYING/NOTICE files.
 * - scripts/licences-manual.js: what the bundle can't show (code inside PDF.js's build, native Gradle/CocoaPods
 *   libraries). Keep that list current by hand.
 *
 * Identical texts are stored once and referenced by key. A package with no licence file, or with a copyleft or
 * unknown licence, is printed as a warning (it is still listed, so the screen stays complete).
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'src', 'legal', 'licences.json');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const warnings = [];

/** Packages that ship but don't appear in the bundle's source maps. */
const EXTRA_PACKAGES = ['pdfjs-dist', 'react-native-skia-android', 'react-native-skia-apple-ios'];

/**
 * Packages published without a licence file: where the text comes from instead. Each is from the same repository
 * (or, for qrcode-generator, is the notice at the top of its own source), checked by hand.
 */
const RN_MONOREPO = () => read('node_modules/react-native/LICENSE'); // facebook/react-native, packages/*
const SKIA_BINARIES = () => read('node_modules/@shopify/react-native-skia/LICENSE.md'); // built from Shopify/react-native-skia
const FALLBACK_TEXT = {
  '@react-native/asset-utils': RN_MONOREPO,
  '@react-native/js-polyfills': RN_MONOREPO,
  '@react-native/normalize-colors': RN_MONOREPO,
  '@react-native/virtualized-lists': RN_MONOREPO,
  'react-native-skia-android': SKIA_BINARIES,
  'react-native-skia-apple-ios': SKIA_BINARIES,
  'qrcode-generator': () =>
    read('node_modules/qrcode-generator/dist/qrcode.js')
      .match(/^(\/\/.*\n)+/)[0]
      .replace(/^\/\/ ?/gm, '')
      .replace(/^-+$/gm, '')
      .trim(),
};

function exportBundle(dir) {
  if (dir) return path.resolve(dir);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qutai-licences-'));
  console.log('generate-licences: bundling the app (expo export)…');
  execFileSync(
    'npx',
    ['expo', 'export', '-p', 'android', '-p', 'ios', '--source-maps', 'external', '--no-bytecode', '--dump-assetmap', '--output-dir', tmp],
    { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  return tmp;
}

/** node_modules/<name> (or nested) directory of a file path, or null. */
function packageDir(file) {
  // Source maps list bundle paths relative to the project ("/node_modules/…"); asset maps list absolute paths.
  const abs = file.startsWith(root) ? file : path.join(root, file);
  const i = abs.lastIndexOf(`${path.sep}node_modules${path.sep}`);
  if (i < 0) return null;
  const rest = abs.slice(i + 14).split(path.sep);
  return abs.slice(0, i + 14) + (rest[0].startsWith('@') ? `${rest[0]}${path.sep}${rest[1]}` : rest[0]);
}

function bundledPackages(exportDir) {
  const dirs = new Set();
  const jsDir = path.join(exportDir, '_expo', 'static', 'js');
  for (const platform of fs.readdirSync(jsDir)) {
    for (const file of fs.readdirSync(path.join(jsDir, platform)).filter((f) => f.endsWith('.map'))) {
      const map = JSON.parse(fs.readFileSync(path.join(jsDir, platform, file), 'utf8'));
      const sources = map.sources ?? map.sections.flatMap((s) => s.map.sources);
      for (const source of sources) {
        const dir = packageDir(source);
        if (dir) dirs.add(dir);
      }
    }
  }
  const assets = JSON.parse(fs.readFileSync(path.join(exportDir, 'assetmap.json'), 'utf8'));
  for (const asset of Object.values(assets)) {
    for (const file of asset.files) {
      const dir = packageDir(file);
      if (dir) dirs.add(dir);
    }
  }
  return dirs;
}

function autolinkedPackages() {
  const dirs = new Set();
  const run = (args) => JSON.parse(execFileSync('npx', ['expo-modules-autolinking', ...args, '--json'], { cwd: root, encoding: 'utf8' }));
  for (const platform of ['android', 'ios']) {
    // Each module's JSON names its native source folders; the package is the node_modules folder above them.
    for (const m of run(['resolve', '-p', platform]).modules) {
      const folder = JSON.stringify(m).match(/"(\/[^"]*\/node_modules\/[^"]+)"/);
      if (folder) dirs.add(packageDir(folder[1]));
    }
    for (const d of Object.values(run(['react-native-config', '-p', platform]).dependencies)) dirs.add(packageDir(d.root + '/x'));
  }
  return [...dirs].filter(Boolean);
}

const LICENCE_FILE = /^(licen[cs]e|copying|notice)([-_.].*)?$/i;

function licenceName(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  return 'UNKNOWN';
}

function repoUrl(pkg) {
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const url = (repo ?? pkg.homepage ?? '')
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^github:/, 'https://github.com/')
    .replace(/\.git$/, '');
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) return `https://github.com/${url}`;
  return /^https?:\/\//.test(url) ? url : undefined;
}

function npmEntry(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const files = fs
    .readdirSync(dir)
    .filter((f) => LICENCE_FILE.test(f) && fs.statSync(path.join(dir, f)).isFile())
    // LICENSE before NOTICE, then by name.
    .sort((a, b) => /^notice/i.test(a) - /^notice/i.test(b) || a.localeCompare(b));
  const text = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim()).join('\n\n') || FALLBACK_TEXT[pkg.name]?.();
  return { name: pkg.name, version: pkg.version, licence: licenceName(pkg), url: repoUrl(pkg), text: text || null };
}

const COPYLEFT = /\b(A?GPL|LGPL|MPL|EPL|CDDL|EUPL|CC-BY-SA)/i;
const KNOWN = /^(MIT|ISC|0BSD|BSD-[23]-Clause|Apache-2\.0|BSL-1\.0|Unlicense|CC0-1\.0|Zlib|FTL|IJG|libpng-2\.0|MIT-Modern-Variant|Python-2\.0|BlueOak-1\.0\.0|blessing)$/;

function check(entry) {
  const parts = entry.licence.replace(/[()]/g, '').split(/\s+(?:AND|OR)\s+/);
  if (entry.note === 'proprietary') return;
  if (entry.note === 'unclear') return warnings.push(`${entry.name}: licence not confirmed for every part (${entry.licence})`);
  if (!entry.text) warnings.push(`${entry.name} ${entry.version}: no licence file in the package (${entry.licence})`);
  if (COPYLEFT.test(entry.licence)) warnings.push(`${entry.name} ${entry.version}: copyleft option in "${entry.licence}"`);
  else if (!parts.every((p) => KNOWN.test(p.trim()))) warnings.push(`${entry.name} ${entry.version}: check licence "${entry.licence}"`);
}

function main() {
  const exportDir = exportBundle(process.argv[2]);
  const ownModules = path.join(root, 'modules') + path.sep;
  const dirs = new Set([...bundledPackages(exportDir), ...autolinkedPackages()]);
  for (const name of EXTRA_PACKAGES) dirs.add(path.join(root, 'node_modules', name));

  const entries = [];
  const seen = new Set();
  for (const dir of dirs) {
    if (dir.startsWith(ownModules) || !fs.existsSync(path.join(dir, 'package.json'))) continue;
    const entry = npmEntry(dir);
    const id = `${entry.name}@${entry.version}`;
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ ...entry, kind: 'npm' });
  }
  for (const m of require('./licences-manual')(read)) {
    const text = m.text ? m.text() : m.files ? m.files.map((f) => read(f).trim()).join('\n\n') : null;
    entries.push({ name: m.name, version: m.version, licence: m.licence, url: m.url, platform: m.platform, note: m.note, text, kind: 'native' });
  }

  // Deduplicate texts: each distinct text is stored once under a short hash.
  const texts = {};
  const list = entries
    .map((e) => {
      check(e);
      let key = null;
      if (e.text) {
        key = crypto.createHash('sha1').update(e.text).digest('hex').slice(0, 10);
        texts[key] = e.text;
      }
      const item = { name: e.name, version: e.version, licence: e.licence, text: key };
      if (e.url) item.url = e.url;
      if (e.platform) item.platform = e.platform;
      if (e.note === 'proprietary') item.proprietary = true;
      return item;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.version.localeCompare(b.version));

  fs.writeFileSync(out, `${JSON.stringify({ entries: list, texts }, null, 1)}\n`);
  const size = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`generate-licences: ${list.length} entries, ${Object.keys(texts).length} distinct texts → src/legal/licences.json (${size} KB)`);
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  if (!process.argv[2]) fs.rmSync(exportDir, { recursive: true, force: true });
}

main();
