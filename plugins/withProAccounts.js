const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

/**
 * Pro mode only (EXPO_PUBLIC_PRO_MODE=on, see src/config/features.ts): the native setup for signing in to a
 * Qutai account (src/account/). Builds without pro mode get none of it, so the open-source build has no Sign in
 * with Apple entitlement and no Google URL scheme.
 *
 * Read when the native projects are generated (`npx expo prebuild`, `expo run:*`, EAS Build): the Expo CLI loads
 * `.env`, and EAS sets the build profile's `env`, before the app config is evaluated.
 *
 * - iOS: the Sign in with Apple entitlement (what expo-apple-authentication's own plugin adds; Expo applies
 *   that plugin by itself once the package is installed, so it is removed again here when pro mode is off).
 *   The App ID needs the capability (backend/README.md).
 * - iOS: the iOS OAuth client's reversed client id as a URL scheme, Google's redirect for "Sign in with Google"
 *   (src/account/providers.ts), when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set.
 * - Android needs nothing here: Credential Manager (modules/qutai-auth) is matched to the app by package name and
 *   signing certificate SHA-1 in the Google Cloud console.
 */
const on = (value) => /^(on|true|1|yes)$/i.test((value ?? '').trim());

module.exports = function withProAccounts(config) {
  const pro = on(process.env.EXPO_PUBLIC_PRO_MODE) && !!(process.env.EXPO_PUBLIC_QUTAI_API_URL ?? '').trim();

  // Expo's prebuild applies expo-apple-authentication's plugin by itself whenever the package is installed
  // (@expo/prebuild-config's versioned SDK plugins), which would give every build the entitlement.
  config = withEntitlementsPlist(config, (config) => {
    if (pro) config.modResults['com.apple.developer.applesignin'] = ['Default'];
    else delete config.modResults['com.apple.developer.applesignin'];
    return config;
  });
  if (!pro) return config;

  const iosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();
  if (iosClientId) {
    const scheme = iosClientId.split('.').reverse().join('.');
    config = withInfoPlist(config, (config) => {
      const types = config.modResults.CFBundleURLTypes ?? [];
      if (!types.some((type) => (type.CFBundleURLSchemes ?? []).includes(scheme))) {
        types.push({ CFBundleURLSchemes: [scheme] });
      }
      config.modResults.CFBundleURLTypes = types;
      return config;
    });
  }
  return config;
};
