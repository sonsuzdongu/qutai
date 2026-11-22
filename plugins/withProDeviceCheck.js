const { withEntitlementsPlist } = require('expo/config-plugins');
const { isProBuild } = require('./proBuild');

/**
 * Device verification (pro mode only; src/account/deviceCheck.ts, backend/README.md › Device verification).
 * `@expo/app-integrity` has no config plugin of its own and is linked only into pro builds (plugins/proBuild.js).
 *
 * - iOS: the App Attest entitlement `com.apple.developer.devicecheck.appattest-environment`. "production" by default;
 *   QUTAI_APP_ATTEST_ENVIRONMENT=development for a development build tried against a dev server (the production server
 *   refuses development keys). The App ID needs the App Attest capability in the Apple Developer portal. Removed from
 *   any other build, so the open-source build asks for nothing.
 * - Android needs nothing in the manifest: Play Integrity is a library call; the Google Cloud project number comes from
 *   the server's `GET /config`.
 */
const KEY = 'com.apple.developer.devicecheck.appattest-environment';

module.exports = function withProDeviceCheck(config) {
  const pro = isProBuild();
  const env = (process.env.QUTAI_APP_ATTEST_ENVIRONMENT ?? '').trim() === 'development' ? 'development' : 'production';
  return withEntitlementsPlist(config, (config) => {
    if (pro) config.modResults[KEY] = env;
    else delete config.modResults[KEY];
    return config;
  });
};
