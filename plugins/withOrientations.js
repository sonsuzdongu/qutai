const { withInfoPlist } = require('expo/config-plugins');

const PORTRAIT = 'UIInterfaceOrientationPortrait';
const UPSIDE_DOWN = 'UIInterfaceOrientationPortraitUpsideDown';
const LANDSCAPE = ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'];

/**
 * iOS: the orientations Qutai turns to (docs/landscape.md). `orientation: "default"` in app.json lists all four for
 * every device; an iPhone leaves out upside-down (as Apple's own apps do), an iPad keeps all four, which iPad
 * multitasking (Split View, Stage Manager, resizable windows) requires. Android: "default" is
 * screenOrientation="unspecified", so the system decides and follows the auto-rotate setting there.
 */
module.exports = function withOrientations(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UISupportedInterfaceOrientations = [PORTRAIT, ...LANDSCAPE];
    config.modResults['UISupportedInterfaceOrientations~ipad'] = [PORTRAIT, UPSIDE_DOWN, ...LANDSCAPE];
    return config;
  });
};
