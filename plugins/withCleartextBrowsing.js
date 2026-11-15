const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/**
 * Android: allow plain http (cleartext) in release builds too, for pages the user chooses to open over http.
 *
 * Qutai is a browser: with HTTPS-only off, or after the user accepts the "open the insecure version?" prompt, it has to
 * load http pages, most often on the local network (development servers, routers, NAS boxes at 192.168.x.x or
 * name.local). Apps targeting API 28+ get no cleartext by default, and the WebView honours that, so release builds
 * failed every http page with net::ERR_CLEARTEXT_NOT_PERMITTED while debug builds (whose manifest allows cleartext for
 * the Metro server) worked. A network security config can't do better: it matches named domains and exact IP
 * addresses only, not private address ranges or "whatever the user typed", so the narrowest setting that lets a
 * browser open http pages is cleartext for the app.
 *
 * What still keeps traffic on https: the HTTPS-only setting (on by default) upgrades every http navigation and asks
 * before falling back; the app's own requests are https-only in code (AI providers' fixed https addresses, the custom
 * endpoint refused unless https on Android in src/ai/custom.ts and checked again in src/ai/http.ts, filter lists
 * refused unless https in src/content/blocking.ts). See docs/permissions.md.
 */
module.exports = function withCleartextBrowsing(config) {
  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });
};
