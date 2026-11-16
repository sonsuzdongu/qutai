const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withInfoPlist } = require('expo/config-plugins');

/**
 * Ways into Qutai from outside the app (code in the local module modules/qutai-entry, handling in
 * src/device/entryPoints.ts). Everything arriving this way is untrusted input: it is opened, searched or put in the
 * assistant's draft only after the user chooses to, and only after the app lock.
 *
 * Android:
 * - "Qutai" in the share sheet for text and links (SEND text/plain), in other apps' text-selection menu
 *   (PROCESS_TEXT) and for web searches handed to a browser (WEB_SEARCH). Images and files are not accepted.
 * - Launcher shortcuts (long-press the app icon): New tab, New incognito tab, Ask Qutai, Scan QR code, each a
 *   qutai:// link to the main activity. Published by the app at start (AppLanguage.kt in the module), not declared
 *   here: the system reads manifest shortcuts in the phone's language, the app publishes them in its own (per-app)
 *   language. So they appear after the first launch. The `android.app.shortcuts` meta-data and
 *   res/xml/qutai_shortcuts.xml of earlier builds are removed.
 * - The home screen widget's receiver (layouts, colours and labels in the module's resources).
 * - A receiver for ACTION_LOCALE_CHANGED (sent when the phone's or Qutai's own language changes), which redoes the
 *   shortcuts and the widget's texts in the new language without the app being opened.
 * No permission is added: pinned "Add to home screen" shortcuts and the widget need none.
 *
 * iOS: the same four Home Screen quick actions (UIApplicationShortcutItems; the module's app delegate subscriber
 * hands them to JavaScript). Titles are translated through InfoPlist.strings from locales/*.json, keyed by the
 * English title.
 */
/** The iOS quick actions (Android's launcher shortcuts: AppLanguage.kt in the module, same ids and links). */
const SHORTCUTS = [
  {
    id: 'new_tab',
    url: 'qutai://new-tab',
    ios: { title: 'New tab', symbol: 'plus.square.on.square' },
  },
  {
    id: 'new_private_tab',
    url: 'qutai://new-private-tab',
    ios: { title: 'New incognito tab', symbol: 'eyeglasses' },
  },
  {
    id: 'ask',
    url: 'qutai://ask',
    ios: { title: 'Ask Qutai', symbol: 'sparkles' },
  },
  {
    id: 'scan',
    url: 'qutai://scan',
    ios: { title: 'Scan QR code', symbol: 'qrcode.viewfinder' },
  },
];

const WIDGET = 'expo.modules.qutaientry.QutaiWidgetProvider';
const LOCALE_RECEIVER = 'expo.modules.qutaientry.QutaiLocaleReceiver';

const TEXT_FILTERS = [
  { action: 'android.intent.action.SEND', mimeType: 'text/plain' },
  { action: 'android.intent.action.PROCESS_TEXT', mimeType: 'text/plain' },
  { action: 'android.intent.action.WEB_SEARCH' },
];

function withAndroidEntryPoints(config) {
  config = withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    activity['intent-filter'] = activity['intent-filter'] ?? [];
    for (const filter of TEXT_FILTERS) {
      const exists = activity['intent-filter'].some((f) =>
        (f.action ?? []).some((a) => a.$['android:name'] === filter.action),
      );
      if (exists) continue;
      activity['intent-filter'].push({
        action: [{ $: { 'android:name': filter.action } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        ...(filter.mimeType ? { data: [{ $: { 'android:mimeType': filter.mimeType } }] } : {}),
      });
    }
    activity['meta-data'] = (activity['meta-data'] ?? []).filter(
      (m) => m.$['android:name'] !== 'android.app.shortcuts',
    );
    if (activity['meta-data'].length === 0) delete activity['meta-data'];

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.receiver = (application.receiver ?? []).filter(
      (r) => r.$['android:name'] !== WIDGET && r.$['android:name'] !== LOCALE_RECEIVER,
    );
    application.receiver.push({
      $: { 'android:name': WIDGET, 'android:exported': 'false', 'android:label': '@string/qutai_widget_name' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
      'meta-data': [
        { $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/qutai_widget_info' } },
      ],
    });
    // Not exported: only the system sends this broadcast.
    application.receiver.push({
      $: { 'android:name': LOCALE_RECEIVER, 'android:exported': 'false' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.LOCALE_CHANGED' } }] }],
    });
    return config;
  });
  return withDangerousMod(config, [
    'android',
    async (config) => {
      // Launcher shortcuts used to be declared in this file; they are published by the app now.
      const file = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml', 'qutai_shortcuts.xml');
      await fs.promises.rm(file, { force: true });
      return config;
    },
  ]);
}

function withIosQuickActions(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationShortcutItems = SHORTCUTS.map((s) => ({
      UIApplicationShortcutItemType: s.url,
      UIApplicationShortcutItemTitle: s.ios.title,
      UIApplicationShortcutItemIconSymbolName: s.ios.symbol,
    }));
    return config;
  });
}

module.exports = function withEntryPoints(config) {
  return withIosQuickActions(withAndroidEntryPoints(config));
};
