const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

/**
 * `.qutaiapp` files (docs/mini-apps.md › The export file): Qutai's own document type, so opening one from Files, a
 * mail or chat attachment, AirDrop or another browser's downloads offers "Open in Qutai". What arrives is handled in
 * src/device/entryPoints.ts (kind `appFile`): it opens the import screen and nothing else; the app is stored switched
 * off until the user turns it on.
 *
 * iOS: an exported type (UTI com.sonsuzdongu.qutai.app, extension qutaiapp, conforming to public.json so Quick Look in
 * Files shows the code as text) and a document type with Qutai as its owner. LSSupportsOpeningDocumentsInPlace is
 * false: iOS copies an opened file into Documents/Inbox and hands over a file:// URL, which the app deletes after reading.
 *
 * Android: a VIEW filter on the main activity for content:// and file:// addresses with Qutai's MIME type (what its own
 * export sends) or application/octet-stream (what file managers and browsers call an unknown `.qutaiapp`: Android can't
 * match a content:// address by its extension). DEFAULT only, not BROWSABLE: a web page can't launch it.
 */
const UTI = 'com.sonsuzdongu.qutai.app';
const MIME = 'application/vnd.qutai.app+json';
const EXTENSION = 'qutaiapp';

function withIosAppFiles(config) {
  return withInfoPlist(config, (config) => {
    const plist = config.modResults;
    plist.UTExportedTypeDeclarations = [
      ...(plist.UTExportedTypeDeclarations ?? []).filter((t) => t.UTTypeIdentifier !== UTI),
      {
        UTTypeIdentifier: UTI,
        UTTypeDescription: 'Qutai app',
        UTTypeConformsTo: ['public.json', 'public.data', 'public.content'],
        UTTypeTagSpecification: { 'public.filename-extension': [EXTENSION], 'public.mime-type': [MIME] },
      },
    ];
    plist.CFBundleDocumentTypes = [
      ...(plist.CFBundleDocumentTypes ?? []).filter((d) => !(d.LSItemContentTypes ?? []).includes(UTI)),
      { CFBundleTypeName: 'Qutai app', CFBundleTypeRole: 'Viewer', LSHandlerRank: 'Owner', LSItemContentTypes: [UTI] },
    ];
    plist.LSSupportsOpeningDocumentsInPlace = false;
    return config;
  });
}

function withAndroidAppFiles(config) {
  return withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    const isOurs = (f) => (f.data ?? []).some((d) => d.$['android:mimeType'] === MIME);
    activity['intent-filter'] = (activity['intent-filter'] ?? []).filter((f) => !isOurs(f));
    activity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [
        { $: { 'android:scheme': 'content' } },
        { $: { 'android:scheme': 'file' } },
        { $: { 'android:mimeType': MIME } },
        { $: { 'android:mimeType': 'application/octet-stream' } },
      ],
    });
    return config;
  });
}

module.exports = function withAppFiles(config) {
  return withAndroidAppFiles(withIosAppFiles(config));
};
