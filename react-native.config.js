// Autolinking settings for the native projects (read by Expo's autolinking when Gradle and CocoaPods resolve native
// modules). Pro-only native packages (plugins/proBuild.js: RevenueCat's react-native-purchases) are left out of a build
// without pro mode, so the open-source build carries none of their native code and, on Android, none of the
// permissions their libraries declare (Google Play Billing's com.android.vending.BILLING). docs/native-code.md.
const { isProBuild, PRO_ONLY_PACKAGES } = require('./plugins/proBuild');

module.exports = {
  dependencies: isProBuild()
    ? {}
    : Object.fromEntries(PRO_ONLY_PACKAGES.map((name) => [name, { platforms: { android: null, ios: null } }])),
};
