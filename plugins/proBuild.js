const path = require('path');

/**
 * Whether the build being made is a pro build (EXPO_PUBLIC_PRO_MODE=on with EXPO_PUBLIC_QUTAI_API_URL set), the same
 * rule as src/config/features.ts (`accountsEnabled`) and plugins/withProAccounts.js. Used by everything that decides
 * what native code and which bundle a build gets without running inside the Expo CLI's environment: react-native.config.js
 * (autolinking, run by Gradle and CocoaPods), metro.config.js and plugins/withProPurchases.js.
 *
 * Values come from the environment first, then the project's .env files (as Expo reads them; the environment wins, as
 * in Expo), so a Gradle build started from Android Studio decides the same way as `npx expo run:android` or
 * scripts/build/release.mjs (which sets EXPO_PUBLIC_PRO_MODE to "on" or "off" itself).
 */
const root = path.join(__dirname, '..');
const on = (value) => /^(on|true|1|yes)$/i.test((value ?? '').trim());

function buildEnv(projectRoot = root) {
  let files = {};
  try {
    const expoPackage = require.resolve('expo/package.json', { paths: [projectRoot] });
    const envLib = require(require.resolve('@expo/env', { paths: [path.dirname(expoPackage)] }));
    files = envLib.parseProjectEnv(projectRoot, { silent: true }).env ?? {};
  } catch {
    // No .env support available: the environment alone decides.
  }
  return { ...files, ...process.env };
}

function isProBuild(projectRoot = root) {
  const env = buildEnv(projectRoot);
  return on(env.EXPO_PUBLIC_PRO_MODE) && !!(env.EXPO_PUBLIC_QUTAI_API_URL ?? '').trim();
}

/** Native packages only a pro build contains (left out of autolinking and of the bundle otherwise). */
const PRO_ONLY_PACKAGES = ['react-native-purchases'];

module.exports = { isProBuild, PRO_ONLY_PACKAGES };
