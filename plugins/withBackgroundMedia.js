const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const PERMISSIONS = ['android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'];
const SERVICE = 'expo.modules.qutaimedia.MediaPlaybackService';

/**
 * Background playback of media in web pages.
 *
 * iOS: the `audio` background mode. WebKit sets the app's audio session itself (playback category while a page
 * plays audible media, nothing while it is silent), so the app stays suspended in the background unless a page
 * really plays sound. App Review: this is real user-started playback (guideline 2.5.4, "audio playback").
 *
 * Android: the mediaPlayback foreground service of the local module modules/qutai-media and its two install-time
 * permissions. It runs only while a tab plays sound (and up to two minutes after it pauses), with a media
 * notification. No POST_NOTIFICATIONS prompt for it: media session notifications are exempt on Android 13+.
 */
module.exports = function withBackgroundMedia(config) {
  config = withInfoPlist(config, (config) => {
    const modes = new Set(config.modResults.UIBackgroundModes ?? []);
    modes.add('audio');
    config.modResults.UIBackgroundModes = [...modes];
    return config;
  });
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
        'android:foregroundServiceType': 'mediaPlayback',
      },
    });
    return config;
  });
};
