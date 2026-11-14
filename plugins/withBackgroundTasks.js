const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  // Held only while a task runs in the background, with a timeout renewed while it makes progress.
  'android.permission.WAKE_LOCK',
];
const SERVICE = 'expo.modules.qutaiagent.AgentTaskService';
/** Read by Play review together with the Play Console declaration (docs/permissions.md). */
const SPECIAL_USE =
  'User-started AI assistant task: continues a browsing task the user started in the app (reading and operating ' +
  'web pages the user asked about, and the AI request) after the user leaves the app, only while that task runs, ' +
  'with an ongoing notification that shows the current step and a Stop button. Opt-in setting.';

/**
 * Android: "Keep working in the background" for assistant tasks (src/device/backgroundTask.ts, modules/qutai-agent).
 * The specialUse foreground service, its permissions and the special use property Play review reads. No iOS part:
 * iOS gives an app only a short time to finish work after it leaves the screen, so tasks pause there as before.
 */
module.exports = function withBackgroundTasks(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    for (const name of PERMISSIONS) {
      if (!manifest['uses-permission'].some((p) => p.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.service = (application.service ?? []).filter((s) => s.$['android:name'] !== SERVICE);
    application.service.push({
      $: {
        'android:name': SERVICE,
        'android:exported': 'false',
        'android:foregroundServiceType': 'specialUse',
      },
      property: [{ $: { 'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE', 'android:value': SPECIAL_USE } }],
    });
    return config;
  });
};
