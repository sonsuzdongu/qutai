#!/usr/bin/env node
/**
 * Raises the app's version and writes the matching build number everywhere (docs/versioning.md).
 *
 *   npm run version:bump                 shows what the next patch bump would do, changes nothing
 *   npm run version:bump -- --yes        does it
 *   npm run version:bump -- 0.2.0        shows what setting 0.2.0 would do
 *   npm run version:bump -- 0.2.0 --yes  does it
 *
 * Written: app.json expo.version, expo.ios.buildNumber, expo.android.versionCode; package.json version
 * (and package-lock.json's two copies of it when the file exists). Only run when the owner asks for a new version.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { plan } from './rule.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const yes = args.includes('--yes');
const to = args.find((a) => !a.startsWith('--'));
const unknown = args.filter((a) => a.startsWith('--') && a !== '--yes');
if (unknown.length) {
  console.error(`Unknown option: ${unknown.join(' ')}`);
  process.exit(2);
}

const read = (file) => readFileSync(join(root, file), 'utf8');
const appText = read('app.json');
const app = JSON.parse(appText);
const expo = app.expo;

const result = plan({
  version: expo.version,
  androidVersionCode: expo.android?.versionCode,
  iosBuildNumber: expo.ios?.buildNumber,
  to,
});
if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}

const android = expo.android?.versionCode;
const ios = expo.ios?.buildNumber;
const builds = String(android) === String(ios) ? `${android} → ${result.toBuild}` : `Android ${android}, iOS ${ios} → both ${result.toBuild}`;
console.log(`Version: ${result.from} → ${result.to}`);
console.log(`Build:   ${builds}`);
if (result.warning) console.log(`Warning: ${result.warning}`);

if (!yes) {
  console.log('\nNothing was changed. Add --yes to write it.');
  process.exit(0);
}

/** Replaces one JSON value in the file's text, so the file's formatting and key order stay as they are. */
function replaceValue(text, pattern, value, what) {
  let count = 0;
  const out = text.replace(pattern, (_, before) => {
    count++;
    return before + value;
  });
  if (count !== 1) throw new Error(`${what}: expected exactly one match, found ${count}`);
  return out;
}

let nextApp = appText;
nextApp = replaceValue(nextApp, /("version":\s*)"[^"]*"/, JSON.stringify(result.to), 'app.json version');
nextApp = replaceValue(nextApp, /("buildNumber":\s*)"[^"]*"/, JSON.stringify(String(result.toBuild)), 'app.json ios.buildNumber');
nextApp = replaceValue(nextApp, /("versionCode":\s*)\d+/, String(result.toBuild), 'app.json android.versionCode');

// Check before writing anything: the edited text must parse to exactly the intended values.
const check = JSON.parse(nextApp).expo;
if (check.version !== result.to || check.ios.buildNumber !== String(result.toBuild) || check.android.versionCode !== result.toBuild) {
  throw new Error('app.json: the edit did not land on expo.version / ios.buildNumber / android.versionCode');
}

const nextPackage = replaceValue(read('package.json'), /("version":\s*)"[^"]*"/, JSON.stringify(result.to), 'package.json version');
writeFileSync(join(root, 'app.json'), nextApp);
writeFileSync(join(root, 'package.json'), nextPackage);
const written = ['app.json', 'package.json'];

if (existsSync(join(root, 'package-lock.json'))) {
  const lock = JSON.parse(read('package-lock.json'));
  lock.version = result.to;
  if (lock.packages?.['']) lock.packages[''].version = result.to;
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  written.push('package-lock.json');
}

console.log(`\nWritten: ${written.join(', ')}. Commit them together; the next native build carries ${result.to} (${result.toBuild}).`);
