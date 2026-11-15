const { AndroidConfig, withAndroidManifest, withMainActivity } = require('expo/config-plugins');

const CONFIG_CHANGES = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation'];

const MARKER = '// qutai-pip: onPictureInPictureUiStateChanged';
const OVERRIDE = `
  ${MARKER}
  // Android 15+ says here, as soon as the picture-in-picture animation starts, that the activity is going into PiP
  // (androidx.activity has no listener for it). An inline video is then made full screen at once (modules/qutai-media).
  override fun onPictureInPictureUiStateChanged(pipState: android.app.PictureInPictureUiState) {
    super.onPictureInPictureUiStateChanged(pipState)
    if (android.os.Build.VERSION.SDK_INT >= 35) {
      expo.modules.qutaimedia.PictureInPicture.onUiStateChanged(pipState.isTransitioningToPip)
    }
  }
`;

/**
 * Android: lets the main activity go into picture-in-picture (a playing video when the user goes home;
 * modules/qutai-media decides when). The window size changes of PiP are handled by the activity instead of
 * recreating it, so the browser is where it was when the user comes back. MainActivity passes on the start of the
 * PiP animation (Android 15+).
 */
module.exports = function withPictureInPicture(config) {
  config = withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    activity.$['android:supportsPictureInPicture'] = 'true';
    const changes = new Set((activity.$['android:configChanges'] ?? '').split('|').filter(Boolean));
    CONFIG_CHANGES.forEach((change) => changes.add(change));
    activity.$['android:configChanges'] = [...changes].join('|');
    return config;
  });
  return withMainActivity(config, (config) => {
    const main = config.modResults;
    if (main.language !== 'kt') throw new Error('withPictureInPicture: MainActivity.kt expected');
    if (main.contents.includes(MARKER)) return config;
    const end = main.contents.lastIndexOf('}');
    if (end < 0) throw new Error('withPictureInPicture: MainActivity class end not found');
    main.contents = main.contents.slice(0, end) + OVERRIDE + main.contents.slice(end);
    return config;
  });
};
