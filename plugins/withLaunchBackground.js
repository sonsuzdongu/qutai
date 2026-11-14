const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

/**
 * Android: the activity's window background is the launch colour (the splash's `splashscreen_background`, written
 * by expo-splash-screen with a night variant: the theme's screen background in light and dark), so nothing white
 * or black shows between the splash fading out and the first React frame, or behind views later.
 * Without this the window background is Theme.AppCompat.DayNight's default grey.
 */
module.exports = function withLaunchBackground(config) {
  return withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:windowBackground',
      value: '@color/splashscreen_background',
    });
    return config;
  });
};
