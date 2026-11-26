#!/usr/bin/env node
/**
 * Store packages made on this machine: an Android App Bundle or an iOS IPA of the version in app.json.
 *
 *   npm run build:aab                    builds/qutai-<version>-<build>.aab
 *   npm run build:aab -- --pro-mode      builds/qutai-<version>-<build>-pro-mode.aab
 *   npm run build:ipa -- --pro-mode      builds/qutai-<version>-<build>-pro-mode.ipa
 *   ... -- --without-purchases           a pro build that can't sell credits (no RevenueCat key needed)
 *   ... -- --dry-run                     prints what would run, runs nothing
 *
 * The version is never changed here (npm run version:bump, docs/versioning.md). Each run regenerates the native
 * project (expo prebuild), so the version, the build number and pro mode's entitlements are in it.
 *
 * Values that must not be committed are read from the environment or from .build.local.env (git-ignored). The name must not start
 * with ".env": Expo's development bundler pulls every .env* file in the project root into the bundle (a file named
 * .env.build.local broke `expo start` on 20 Nov 2026), and these values must not leak into development:
 *
 *   EXPO_PUBLIC_QUTAI_API_URL   the server a pro-mode build talks to (required with --pro-mode)
 *   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY  RevenueCat's public SDK key for Google Play (goog_…), so a pro AAB can sell
 *                               credits (required for a pro AAB unless --without-purchases; README.md › Buying credits)
 *   EXPO_PUBLIC_REVENUECAT_IOS_KEY      the same for the App Store (appl_…; required for a pro IPA unless
 *                               --without-purchases, BUY-33)
 *   QUTAI_APPLE_TEAM_ID         the Apple Developer team that signs the IPA (required for the IPA)
 *
 * The Google client ids come from .env as in every build. No package carries the test sign-in: the build sets
 * EXPO_PUBLIC_DEV_LOGIN to "off" and EXPO_PUBLIC_DEV_LOGIN_SECRET (and, for a plain build, EXPO_PUBLIC_QUTAI_API_URL) to
 * empty in its own environment, which Expo's .env loading never overrides (deleting them, as before 20 Nov 2026, let
 * a .env value win). After the build the bundle is checked (bundleCheck.mjs): no test sign-in secret (any value the
 * shell or a .env file has) and no runtime reference to the test sign-in variables; the server's host in a pro
 * bundle and no server address in a plain one; RevenueCat's SDK only in a pro bundle, and in a pro AAB that sells
 * credits the Play Billing permission in its manifest (never in a plain AAB). The RevenueCat keys are set to empty in a
 * plain build's environment, like the server address. Otherwise nothing is written to builds/.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleProblems, hostOf, manifestProblems } from './bundleCheck.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const kind = args.find((a) => a === 'aab' || a === 'ipa');
const pro = args.includes('--pro-mode');
const dry = args.includes('--dry-run');
const withoutPurchases = args.includes('--without-purchases');
const unknown = args.filter((a) => !['aab', 'ipa', '--pro-mode', '--dry-run', '--without-purchases'].includes(a));

function stop(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!kind || unknown.length) {
  stop(`Usage: npm run build:aab | build:ipa [-- --pro-mode [--without-purchases]] [--dry-run]${unknown.length ? `\nNot understood: ${unknown.join(' ')}` : ''}`);
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

const local = envFile('.build.local.env');
const value = (key) => (process.env[key] || local[key] || '').trim();

const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
const version = app.version;
const build = app.android.versionCode;
if (String(build) !== String(app.ios.buildNumber)) {
  stop(`app.json: Android's build number (${build}) and iOS's (${app.ios.buildNumber}) differ. Run npm run version:bump.`);
}

const env = { ...process.env, EXPO_PUBLIC_PRO_MODE: pro ? 'on' : 'off' };
// Set, not deleted: Expo fills only variables that are missing from the environment from .env files.
env.EXPO_PUBLIC_DEV_LOGIN = 'off';
env.EXPO_PUBLIC_DEV_LOGIN_SECRET = '';
let apiHost = null;
if (pro) {
  const api = value('EXPO_PUBLIC_QUTAI_API_URL');
  if (!/^https:\/\/[^/\s]+/.test(api)) {
    stop('A pro-mode build needs EXPO_PUBLIC_QUTAI_API_URL (an https:// address), in the environment or in .build.local.env.');
  }
  env.EXPO_PUBLIC_QUTAI_API_URL = api;
  apiHost = new URL(api).host;
} else {
  env.EXPO_PUBLIC_QUTAI_API_URL = '';
}

// RevenueCat's public SDK keys (src/purchases/index.ts). Set, not deleted, for the same reason as above.
env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = '';
env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = '';
/** Whether this package must be able to sell credits (checked in the bundle and, for the AAB, its manifest). */
let sellsCredits = false;
if (withoutPurchases && !pro) stop('--without-purchases is for a pro-mode build; a plain build never sells credits.');
if (pro && !withoutPurchases) {
  if (kind === 'aab') {
    const key = value('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');
    if (!key) {
      stop(
        'A pro-mode AAB needs EXPO_PUBLIC_REVENUECAT_ANDROID_KEY (RevenueCat › Project settings › API keys › the Play Store app’s public key, goog_…), in the environment or in .build.local.env. To build without purchases on purpose, add --without-purchases.',
      );
    }
    if (!/^goog_[A-Za-z0-9]{8,}$/.test(key)) stop('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY is not a RevenueCat Play Store public key (goog_…). A secret key (sk_…) never goes into the app.');
    env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = key;
    sellsCredits = true;
  } else {
    // Required like Android's (BUY-33): a pro IPA that shows Qutai Credits but can't sell them is refused by App Review.
    const key = value('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
    if (!key) {
      stop(
        'A pro-mode IPA needs EXPO_PUBLIC_REVENUECAT_IOS_KEY (RevenueCat › Project settings › API keys › the App Store app’s public key, appl_…), in the environment or in .build.local.env. To build without purchases on purpose, add --without-purchases.',
      );
    }
    if (!/^appl_[A-Za-z0-9]{8,}$/.test(key)) stop('EXPO_PUBLIC_REVENUECAT_IOS_KEY is not a RevenueCat App Store public key (appl_…). A secret key (sk_…) never goes into the app.');
    env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = key;
    sellsCredits = true;
  }
}
// The sign-in link as an App Link / Universal Link (docs/app-links.md): optional, pro mode only. Set, not deleted,
// for the same reason as above; a build without it is as before (the mail's link opens the website's page first).
env.EXPO_PUBLIC_APP_LINK_HOST = pro ? value('EXPO_PUBLIC_APP_LINK_HOST') : '';
env.EXPO_PUBLIC_APP_LINK_PATH = pro ? value('EXPO_PUBLIC_APP_LINK_PATH') : '';
if (env.EXPO_PUBLIC_APP_LINK_HOST) console.log(`Sign-in link opens the app directly from https://${env.EXPO_PUBLIC_APP_LINK_HOST}`);
const team = value('QUTAI_APPLE_TEAM_ID');
if (kind === 'ipa' && !/^[A-Z0-9]{10}$/.test(team)) {
  stop('The IPA needs QUTAI_APPLE_TEAM_ID (the 10-character Apple team id), in the environment or in .build.local.env.');
}

const name = `qutai-${version}-${build}${pro ? '-pro-mode' : ''}.${kind}`;
const target = join(root, 'builds', name);

function run(command, commandArgs, cwd = root) {
  console.log(`\n$ ${command} ${commandArgs.join(' ')}${cwd === root ? '' : `   (in ${cwd.slice(root.length + 1)})`}`);
  if (dry) return;
  const result = spawnSync(command, commandArgs, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) stop(`${command} failed (${result.status ?? result.signal}). Nothing was written to builds/.`);
}

/**
 * The package really is what was asked for (bundleCheck.mjs): the server's host in a pro bundle and no server address
 * in a plain one; no test sign-in secret and no runtime reference to the test sign-in variables in either.
 */
function checkBundle(archive, entry) {
  if (dry) return;
  const listed = spawnSync('unzip', ['-p', archive, entry], { maxBuffer: 512 * 1024 * 1024 });
  if (listed.status !== 0 || !listed.stdout.length) stop(`Could not read the JavaScript bundle (${entry}) in ${archive}.`);
  // Every place a value could have come from: the shell and the .env files Expo reads (values stay in memory).
  const dotenv = ['.env', '.env.local', '.env.production', '.env.production.local'].map(envFile);
  const all = (key) => [process.env[key], ...dotenv.map((f) => f[key])].filter(Boolean);
  const problems = bundleProblems(listed.stdout, {
    pro,
    apiHost,
    serverHosts: [value('EXPO_PUBLIC_QUTAI_API_URL'), ...all('EXPO_PUBLIC_QUTAI_API_URL')].map(hostOf),
    secrets: all('EXPO_PUBLIC_DEV_LOGIN_SECRET').map((v) => ({ name: 'EXPO_PUBLIC_DEV_LOGIN_SECRET', value: v })),
    purchases: sellsCredits,
  });
  if (problems.length) stop(`The JavaScript bundle is not fit to ship: ${problems.join('; ')}. Nothing was written to builds/.`);
}

/** The AAB's manifest: the Play Billing permission exactly when the package sells credits (never in a plain one). */
function checkManifest(archive) {
  if (dry) return;
  const read = spawnSync('unzip', ['-p', archive, 'base/manifest/AndroidManifest.xml'], { maxBuffer: 64 * 1024 * 1024 });
  if (read.status !== 0 || !read.stdout.length) stop(`Could not read the manifest in ${archive}.`);
  const problems = manifestProblems(read.stdout, { pro, purchases: sellsCredits });
  if (problems.length) stop(`The bundle is not fit to ship: ${problems.join('; ')}. Nothing was written to builds/.`);
}

function keep(from) {
  if (dry) return console.log(`\nWould write builds/${name}`);
  mkdirSync(join(root, 'builds'), { recursive: true });
  copyFileSync(from, target);
  console.log(`\nbuilds/${name}  (${(statSync(target).size / 1024 / 1024).toFixed(1)} MB)  version ${version}, build ${build}${pro ? ', pro mode' : ''}`);
}

console.log(
  `Qutai ${version} (${build})${pro ? `, pro mode, ${sellsCredits ? 'sells credits' : 'without purchases'}` : ''} → builds/${name}${dry ? '   [dry run]' : ''}`,
);

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
  checkManifest(made);
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
