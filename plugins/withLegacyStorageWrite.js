const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const WRITE_EXTERNAL_STORAGE = 'android.permission.WRITE_EXTERNAL_STORAGE';

/**
 * Android: declare WRITE_EXTERNAL_STORAGE only up to Android 10 (API 29).
 *
 * Qutai only adds files to shared storage: screenshots and images to the gallery (expo-media-library)
 * and downloads to the Downloads folder (the WebView's download manager). On Android 10 and older both
 * need this permission (expo-media-library copies the file into the public Pictures folder; the WebView
 * asks for it before a download on Android 9 and older). From Android 11 on, expo-media-library adds
 * through MediaStore and the download manager needs nothing, so no storage permission is declared or
 * asked for there. The libraries declare it up to Android 12 (maxSdkVersion 32); this lowers that.
 * The read permissions the libraries add are blocked in app.json (android.blockedPermissions).
 */
module.exports = function withLegacyStorageWrite(config) {
  return withAndroidManifest(config, (config) => {
    AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    let entry = manifest['uses-permission'].find((p) => p.$['android:name'] === WRITE_EXTERNAL_STORAGE);
    if (!entry) {
      entry = { $: { 'android:name': WRITE_EXTERNAL_STORAGE } };
      manifest['uses-permission'].push(entry);
    }
    entry.$['android:maxSdkVersion'] = '29';
    entry.$['tools:replace'] = 'android:maxSdkVersion';
    return config;
  });
};
