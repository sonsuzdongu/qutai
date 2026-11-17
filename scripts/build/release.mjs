#!/usr/bin/env node
/**
 * Store packages made on this machine: an Android App Bundle or an iOS IPA of the version in app.json.
 *
 *   npm run build:aab                    builds/qutai-<version>-<build>.aab
 *   npm run build:aab -- --pro-mode      builds/qutai-<version>-<build>-pro-mode.aab
 *   npm run build:ipa -- --pro-mode      builds/qutai-<version>-<build>-pro-mode.ipa
 *   ... -- --dry-run                     prints what would run, runs nothing
 *
 * The version is never changed here (npm run version:bump, docs/versioning.md). Each run regenerates the native
 * project (expo prebuild), so the version, the build number and pro mode's entitlements are in it.
 *
 * Values that must not be committed are read from the environment or from .env.build.local (git-ignored; Expo's own
 * commands never load a file of that name, so they don't leak into development):
 *
 *   EXPO_PUBLIC_QUTAI_API_URL   the server a pro-mode build talks to (required with --pro-mode)
 *   QUTAI_APPLE_TEAM_ID         the Apple Developer team that signs the IPA (required for the IPA)
 *
 * The Google client ids come from .env as in every build. A pro-mode package never carries the test sign-in: the
 * EXPO_PUBLIC_DEV_LOGIN variables are removed even if the shell has them.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const kind = args.find((a) => a === 'aab' || a === 'ipa');
const pro = args.includes('--pro-mode');
const dry = args.includes('--dry-run');
const unknown = args.filter((a) => !['aab', 'ipa', '--pro-mode', '--dry-run'].includes(a));

function stop(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!kind || unknown.length) {
  stop(`Usage: npm run build:aab | build:ipa [-- --pro-mode] [--dry-run]${unknown.length ? `\nNot understood: ${unknown.join(' ')}` : ''}`);
}

/** KEY=value lines of an env file (no export, no interpolation); {} when the file isn't there. */
function envFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const local = envFile('.env.build.local');
const value = (key) => (process.env[key] || local[key] || '').trim();

const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
const version = app.version;
const build = app.android.versionCode;
if (String(build) !== String(app.ios.buildNumber)) {
  stop(`app.json: Android's build number (${build}) and iOS's (${app.ios.buildNumber}) differ. Run npm run version:bump.`);
}

const env = { ...process.env, EXPO_PUBLIC_PRO_MODE: pro ? 'on' : 'off' };
delete env.EXPO_PUBLIC_DEV_LOGIN;
delete env.EXPO_PUBLIC_DEV_LOGIN_SECRET;
let apiHost = null;
if (pro) {
  const api = value('EXPO_PUBLIC_QUTAI_API_URL');
  if (!/^https:\/\/[^/\s]+/.test(api)) {
    stop('A pro-mode build needs EXPO_PUBLIC_QUTAI_API_URL (an https:// address), in the environment or in .env.build.local.');
  }
  env.EXPO_PUBLIC_QUTAI_API_URL = api;
  apiHost = new URL(api).host;
} else {
  delete env.EXPO_PUBLIC_QUTAI_API_URL;
}
const team = value('QUTAI_APPLE_TEAM_ID');
if (kind === 'ipa' && !/^[A-Z0-9]{10}$/.test(team)) {
  stop('The IPA needs QUTAI_APPLE_TEAM_ID (the 10-character Apple team id), in the environment or in .env.build.local.');
}

const name = `qutai-${version}-${build}${pro ? '-pro-mode' : ''}.${kind}`;
const target = join(root, 'builds', name);

function run(command, commandArgs, cwd = root) {
  console.log(`\n$ ${command} ${commandArgs.join(' ')}${cwd === root ? '' : `   (in ${cwd.slice(root.length + 1)})`}`);
  if (dry) return;
  const result = spawnSync(command, commandArgs, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) stop(`${command} failed (${result.status ?? result.signal}). Nothing was written to builds/.`);
}

/** The package really is what was asked for: the server's host is in a pro bundle and absent from a plain one. */
function checkBundle(archive, entry) {
  if (dry) return;
  const listed = spawnSync('unzip', ['-p', archive, entry], { maxBuffer: 512 * 1024 * 1024 });
  if (listed.status !== 0 || !listed.stdout.length) stop(`Could not read the JavaScript bundle (${entry}) in ${archive}.`);
  const found = apiHost !== null && listed.stdout.includes(Buffer.from(apiHost));
  if (pro && !found) stop('The JavaScript bundle does not contain the server address: this is not a pro-mode build. Nothing was written to builds/.');
}

function keep(from) {
  if (dry) return console.log(`\nWould write builds/${name}`);
  mkdirSync(join(root, 'builds'), { recursive: true });
  copyFileSync(from, target);
  console.log(`\nbuilds/${name}  (${(statSync(target).size / 1024 / 1024).toFixed(1)} MB)  version ${version}, build ${build}${pro ? ', pro mode' : ''}`);
}

console.log(`Qutai ${version} (${build})${pro ? ', pro mode' : ''} → builds/${name}${dry ? '   [dry run]' : ''}`);

if (kind === 'aab') {
  const signing = process.env.QUTAI_RELEASE_SIGNING || join(homedir(), '.qutai', 'release-signing.properties');
  if (!existsSync(signing)) {
    stop(`No release signing file (${signing}): the bundle would be signed with the debug key, which Play refuses. See docs/release-signing.md.`);
  }
  run('npx', ['expo', 'prebuild', '--platform', 'android']);
  // --rerun: Gradle otherwise keeps the old JavaScript bundle when only EXPO_PUBLIC_* values changed.
  run('./gradlew', [':app:createBundleReleaseJsAndAssets', '--rerun', ':app:bundleRelease'], join(root, 'android'));
  const made = join(root, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  checkBundle(made, 'base/assets/index.android.bundle');
  keep(made);
} else {
  const out = join(root, 'ios', 'build');
  const archive = join(out, 'Qutai.xcarchive');
  const exported = join(out, 'export');
  const options = join(out, 'ExportOptions.plist');
  run('npx', ['expo', 'prebuild', '--platform', 'ios']);
  run('xcodebuild', [
    '-workspace', 'ios/Qutai.xcworkspace',
    '-scheme', 'Qutai',
    '-configuration', 'Release',
    '-destination', 'generic/platform=iOS',
    '-archivePath', archive,
    '-allowProvisioningUpdates',
    `DEVELOPMENT_TEAM=${team}`,
    'CODE_SIGN_STYLE=Automatic',
    'archive',
  ]);
  if (!dry) {
    mkdirSync(out, { recursive: true });
    writeFileSync(
      options,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>${team}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>destination</key><string>export</string>
</dict></plist>
`,
    );
  }
  run('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportOptionsPlist', options, '-exportPath', exported, '-allowProvisioningUpdates']);
  if (dry) {
    keep('');
  } else {
    const ipa = readdirSync(exported).find((f) => f.endsWith('.ipa'));
    if (!ipa) stop(`xcodebuild exported no .ipa into ${exported}.`);
    checkBundle(join(exported, ipa), 'Payload/*.app/main.jsbundle');
    keep(join(exported, ipa));
  }
}
