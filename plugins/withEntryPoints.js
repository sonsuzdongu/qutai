const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/**
 * Ways into Qutai from outside the app (code in the local module modules/qutai-entry, handling in
 * src/device/entryPoints.ts). Everything arriving this way is untrusted input: it is opened, searched or put in the
 * assistant's draft only after the user chooses to, and only after the app lock.
 *
 * Android: "Qutai" in the share sheet for text and links (SEND text/plain), in other apps' text-selection menu
 * (PROCESS_TEXT) and for web searches handed to a browser (WEB_SEARCH). Images and files are not accepted.
 * No permission is added.
 */
const TEXT_FILTERS = [
  { action: 'android.intent.action.SEND', mimeType: 'text/plain' },
  { action: 'android.intent.action.PROCESS_TEXT', mimeType: 'text/plain' },
  { action: 'android.intent.action.WEB_SEARCH' },
];

function withAndroidEntryPoints(config) {
  return withAndroidManifest(config, (config) => {
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
    return config;
  });
}

module.exports = function withEntryPoints(config) {
  return withAndroidEntryPoints(config);
};
