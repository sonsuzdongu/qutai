const { AndroidConfig, withAndroidManifest, withSettingsGradle } = require('expo/config-plugins');
const { isProBuild } = require('./proBuild');

/**
 * Buying Qutai Credits through Google Play (pro mode only; src/purchases/). RevenueCat's SDK is linked only into pro
 * builds (react-native.config.js), and Google Play Billing's library brings `com.android.vending.BILLING` with it. This
 * plugin makes the manifest say so explicitly either way, so it doesn't depend on a library's manifest:
 *
 * - pro build: `<uses-permission android:name="com.android.vending.BILLING" />` (Play Console also needs it in the
 *   uploaded bundle before in-app products can be created);
 * - any other build: the same permission with `tools:node="remove"`, so even a library that declared it couldn't put it
 *   into the open-source build's merged manifest.
 *
 * And `android/settings.gradle` gets a few lines that drop React Native's cached autolinking result whenever the kind of
 * build (pro or plain) differs from the last Gradle build's: that cache is keyed on the lockfiles only, so a plain build
 * right after a pro one would otherwise link the pro-only packages again.
 *
 * iOS needs no entitlement or Info.plist entry for in-app purchases; CocoaPods resolves autolinking afresh at every
 * `pod install`.
 */
const BILLING = 'com.android.vending.BILLING';
const MARK = '// Qutai: autolinking cache per build kind (plugins/withProPurchases.js)';
const SETTINGS_SNIPPET = `${MARK}
// Which native packages are linked depends on pro mode (react-native.config.js), but React Native caches the
// autolinking result by lockfile only: drop the cache when the kind of build changed since the last Gradle run.
def qutaiBuildKind = providers.exec {
  workingDir(rootDir)
  commandLine("node", "--print", "require('../plugins/proBuild').isProBuild() ? 'pro' : 'plain'")
}.standardOutput.asText.get().trim()
def qutaiKindFile = new File(rootDir, "build/generated/autolinking/qutai-build-kind.txt")
if (!qutaiKindFile.exists() || qutaiKindFile.text.trim() != qutaiBuildKind) {
  new File(rootDir, "build/generated/autolinking/autolinking.json").delete()
  qutaiKindFile.parentFile.mkdirs()
  qutaiKindFile.text = qutaiBuildKind
}
`;
const ANCHOR = 'extensions.configure(com.facebook.react.ReactSettingsExtension)';

module.exports = function withProPurchases(config) {
  const pro = isProBuild();
  config = withSettingsGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes(MARK)) return config;
    if (!contents.includes(ANCHOR)) throw new Error('withProPurchases: android/settings.gradle has no autolinking block to guard.');
    config.modResults.contents = contents.replace(ANCHOR, `${SETTINGS_SNIPPET}\n${ANCHOR}`);
    return config;
  });
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    AndroidConfig.Manifest.ensureToolsAvailable(manifest);
    const list = (manifest.manifest['uses-permission'] ?? []).filter((p) => p.$['android:name'] !== BILLING);
    list.push(pro ? { $: { 'android:name': BILLING } } : { $: { 'android:name': BILLING, 'tools:node': 'remove' } });
    manifest.manifest['uses-permission'] = list;
    return config;
  });
};
