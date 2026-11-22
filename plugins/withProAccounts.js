const { AndroidConfig, withAndroidManifest, withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

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
 * - Android needs nothing for Google: Credential Manager (modules/qutai-auth) is matched to the app by package name
 *   and signing certificate SHA-1 in the Google Cloud console.
 * - The sign-in link as an App Link (Android) / Universal Link (iOS), only when EXPO_PUBLIC_APP_LINK_HOST is set
 *   (docs/app-links.md): iOS gets the Associated Domains entitlement `applinks:<host>`, Android a verified
 *   (`autoVerify`) https intent filter for `<host>` and the link's path (EXPO_PUBLIC_APP_LINK_PATH, default
 *   `/intent/sign-in/email`). The site must serve apple-app-site-association / assetlinks.json first. Without the
 *   variable nothing changes. Sign in with Apple on Android needs nothing native: it runs in a Custom Tab and returns
 *   through the existing `qutai` scheme.
 */
const HOST = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const PATH = /^(\/[A-Za-z0-9._~-]+){1,8}$/;

function appLink() {
  const host = (process.env.EXPO_PUBLIC_APP_LINK_HOST ?? '').trim().toLowerCase();
  if (!host) return null;
  if (!HOST.test(host)) throw new Error(`EXPO_PUBLIC_APP_LINK_HOST is not a host name: ${host}`);
  const rawPath = (process.env.EXPO_PUBLIC_APP_LINK_PATH ?? '').trim().replace(/\/+$/, '');
  const path = rawPath || '/intent/sign-in/email';
  if (!PATH.test(path)) throw new Error(`EXPO_PUBLIC_APP_LINK_PATH is not a plain path: ${path}`);
  return { host, path };
}
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

  // The privacy manifest's collected data types (OSPERM-26): a pro build talks to Qutai's server, so the list that is
  // empty in app.json (the open-source build has no server) is filled here. Kept the same as App Store Connect ›
  // App Privacy (docs/store-submission.md § 3.3): all for app functionality, linked to the account, never tracking.
  const collected = [
    'NSPrivacyCollectedDataTypeEmailAddress',
    'NSPrivacyCollectedDataTypeUserID',
    'NSPrivacyCollectedDataTypeDeviceID',
    'NSPrivacyCollectedDataTypePurchaseHistory',
    'NSPrivacyCollectedDataTypeOtherUserContent',
    'NSPrivacyCollectedDataTypeOtherUsageData',
  ];
  config.ios = config.ios ?? {};
  config.ios.privacyManifests = {
    ...(config.ios.privacyManifests ?? {}),
    NSPrivacyTracking: false,
    NSPrivacyCollectedDataTypes: [
      ...collected.map((type) => ({
        NSPrivacyCollectedDataType: type,
        NSPrivacyCollectedDataTypeLinked: true,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
      })),
      // Product analytics (SRV-31): consented, anonymous usage events, not linked to the account (a random install id).
      {
        NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
        NSPrivacyCollectedDataTypeLinked: false,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics'],
      },
    ],
  };

  const link = appLink();
  if (link) {
    config = withEntitlementsPlist(config, (config) => {
      const domains = config.modResults['com.apple.developer.associated-domains'] ?? [];
      const entry = `applinks:${link.host}`;
      if (!domains.includes(entry)) domains.push(entry);
      config.modResults['com.apple.developer.associated-domains'] = domains;
      return config;
    });
    config = withAndroidManifest(config, (config) => {
      const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
      const filters = activity['intent-filter'] ?? [];
      const exists = filters.some((f) => (f.data ?? []).some((d) => d.$['android:host'] === link.host && d.$['android:path'] === link.path));
      if (!exists) {
        filters.push({
          $: { 'android:autoVerify': 'true' },
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }, { $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
          data: [{ $: { 'android:scheme': 'https', 'android:host': link.host, 'android:path': link.path } }],
        });
      }
      activity['intent-filter'] = filters;
      return config;
    });
  }

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
