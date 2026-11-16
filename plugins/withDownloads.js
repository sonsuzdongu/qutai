const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  // Android 14+: the user-initiated data transfer job that keeps downloads going in the background.
  'android.permission.RUN_USER_INITIATED_JOBS',
  // "Open" on a downloaded APK hands it to the system's installer, which refuses (silently) a caller without this
  // permission. The user still allows Qutai as a source in the system's own "Install unknown apps" screen, which the
  // installer offers the first time. Google Play allows it for web browsers (Permissions Declaration Form needed).
  'android.permission.REQUEST_INSTALL_PACKAGES',
];
const PACKAGE = 'expo.modules.qutaidownloads';

/**
 * Android: Qutai's own downloads (modules/qutai-downloads, src/storage/androidDownloads.ts). Declares what keeps a
 * download running when the user leaves the app: on Android 14+ a user-initiated data transfer job
 * (DownloadJobService, JobScheduler, RUN_USER_INITIATED_JOBS), on Android 8 to 13 (and as a fallback when the job
 * can't be scheduled) a dataSync foreground service (DownloadService); plus the receiver of the notification's
 * Pause / Resume / Cancel actions. Nothing is exported. Also REQUEST_INSTALL_PACKAGES, so "Open" on an APK reaches the
 * system's installer, and a <queries> entry for viewers of content:// files (the "done" notification's tap). No iOS
 * part: iOS downloads run while the app is open.
 */
module.exports = function withDownloads(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    for (const name of PERMISSIONS) {
      if (!manifest['uses-permission'].some((p) => p.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }
    // Android 11+ package visibility: whether some app opens a finished file (content://, any type), so the "done"
    // notification's tap opens it directly, or goes through Qutai to say why it can't.
    manifest.queries = manifest.queries ?? [];
    const viewQuery = (q) =>
      (q.intent ?? []).some(
        (i) =>
          i.action?.[0]?.$['android:name'] === 'android.intent.action.VIEW' &&
          i.data?.[0]?.$['android:scheme'] === 'content',
      );
    if (!manifest.queries.some(viewQuery)) {
      manifest.queries.push({
        intent: [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
            data: [{ $: { 'android:scheme': 'content', 'android:mimeType': '*/*' } }],
          },
        ],
      });
    }
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const ours = (list) => (list ?? []).filter((s) => !s.$['android:name'].startsWith(PACKAGE));
    application.service = ours(application.service);
    application.service.push(
      {
        $: {
          'android:name': `${PACKAGE}.DownloadJobService`,
          'android:permission': 'android.permission.BIND_JOB_SERVICE',
          'android:exported': 'false',
        },
      },
      {
        $: {
          'android:name': `${PACKAGE}.DownloadService`,
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync',
        },
      },
    );
    application.receiver = ours(application.receiver);
    application.receiver.push({ $: { 'android:name': `${PACKAGE}.DownloadActionReceiver`, 'android:exported': 'false' } });
    return config;
  });
};
