const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const PORTRAIT = 'UIInterfaceOrientationPortrait';
const UPSIDE_DOWN = 'UIInterfaceOrientationPortraitUpsideDown';
const LANDSCAPE = ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'];

const SCREEN_FEATURES = ['android.hardware.screen.portrait', 'android.hardware.screen.landscape'];

/**
 * iOS: the orientations Qutai turns to (docs/landscape.md). `orientation: "default"` in app.json lists all four for
 * every device; an iPhone leaves out upside-down (as Apple's own apps do), an iPad keeps all four, which iPad
 * multitasking (Split View, Stage Manager, resizable windows) requires. Android: "default" is
 * screenOrientation="unspecified", so the system decides and follows the auto-rotate setting there.
 *
 * Android: ML Kit's invisible scanner delegate activities (QR and document scanning, through expo-camera) are fixed to
 * portrait in their own manifests, so Google Play infers a required "android.hardware.screen.portrait" feature and
 * hides the app from devices without it (tablets, desktops, Android XR; Play Console refuses the release for it). Qutai
 * itself needs no particular orientation, so both screen features are declared optional.
 */
function withOptionalScreenFeatures(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const features = (manifest['uses-feature'] = manifest['uses-feature'] ?? []);
    for (const name of SCREEN_FEATURES) {
      const existing = features.find((f) => f.$?.['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return config;
  });
}

module.exports = function withOrientations(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UISupportedInterfaceOrientations = [PORTRAIT, ...LANDSCAPE];
    config.modResults['UISupportedInterfaceOrientations~ipad'] = [PORTRAIT, UPSIDE_DOWN, ...LANDSCAPE];
    return config;
  });
  return withOptionalScreenFeatures(config);
};
