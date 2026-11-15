const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  // Android 14+: the user-initiated data transfer job that keeps downloads going in the background.
  'android.permission.RUN_USER_INITIATED_JOBS',
];
const PACKAGE = 'expo.modules.qutaidownloads';

/**
 * Android: Qutai's own downloads (modules/qutai-downloads, src/storage/androidDownloads.ts). Declares what keeps a
 * download running when the user leaves the app: on Android 14+ a user-initiated data transfer job
 * (DownloadJobService, JobScheduler, RUN_USER_INITIATED_JOBS), on Android 8 to 13 (and as a fallback when the job
 * can't be scheduled) a dataSync foreground service (DownloadService); plus the receiver of the notification's
 * Pause / Resume / Cancel actions. Nothing is exported. No iOS part: iOS downloads run while the app is open.
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
