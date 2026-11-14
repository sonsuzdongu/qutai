const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const CONFIG_CHANGES = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation'];

/**
 * Android: lets the main activity go into picture-in-picture (a playing full-screen video when the user goes home;
 * modules/qutai-media decides when). The window size changes of PiP are handled by the activity instead of
 * recreating it, so the browser is where it was when the user comes back.
 */
module.exports = function withPictureInPicture(config) {
  return withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    activity.$['android:supportsPictureInPicture'] = 'true';
    const changes = new Set((activity.$['android:configChanges'] ?? '').split('|').filter(Boolean));
    CONFIG_CHANGES.forEach((change) => changes.add(change));
    activity.$['android:configChanges'] = [...changes].join('|');
    return config;
  });
};
