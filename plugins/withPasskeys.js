const { withAndroidManifest } = require('expo/config-plugins');

const SET_ORIGIN = 'android.permission.CREDENTIAL_MANAGER_SET_ORIGIN';

/**
 * Android: passkeys and security keys (WebAuthn) in web pages. The patched react-native-webview turns on the
 * WebView's WebAuthn support as a browser (WEB_AUTHENTICATION_SUPPORT_FOR_BROWSER), which asks Android's Credential
 * Manager for a credential on behalf of the page's origin. That needs CREDENTIAL_MANAGER_SET_ORIGIN (Android 14+, a
 * "normal" permission, granted at install); without it the WebView's call throws a SecurityException it doesn't catch,
 * and the app closes as soon as a page asks for a passkey. The credential provider (Google Password Manager, a
 * password manager app) still decides whether it serves Qutai as a browser. See docs/design/23-downloads-and-links.md.
 */
module.exports = function withPasskeys(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    if (!manifest['uses-permission'].some((p) => p.$['android:name'] === SET_ORIGIN)) {
      manifest['uses-permission'].push({ $: { 'android:name': SET_ORIGIN } });
    }
    return config;
  });
};
