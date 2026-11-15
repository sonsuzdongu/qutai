/**
 * Third-party software in the app that `generate-licences.js` can't find from the JavaScript bundle: code bundled
 * inside PDF.js's build, and native libraries that React Native, Skia and the Expo modules link in through Gradle
 * and CocoaPods. Hand-maintained: check it when React Native, Expo, Skia or PDF.js is upgraded.
 *
 * Every licence text is read from a file, never typed here:
 * - `node_modules/...`: copies shipped with the npm packages (PDF.js's wasm/LICENSE_* files, SQLite's header...);
 * - `scripts/licences/...`: verbatim copies of the upstream files, downloaded from the project's repository at the
 *   tag of the version we ship where it has one (see `source`), or from the Maven Central jar for Apache Commons.
 *
 * Fields: name, version, licence (SPDX expression, or a plain description), platform ('android' | 'ios' | undefined
 * for both), url (project home), files (paths from the repository root, joined in order), and optional
 * `text(read)` returning the text when it has to be cut out of a larger file, or `note` (shown instead of a text,
 * for proprietary SDKs whose terms aren't shipped with them). Versions come from the files named in `from`.
 */
const APACHE = 'node_modules/pdfjs-dist/LICENSE'; // The plain Apache License 2.0 text (PDF.js's own licence file).
const RN_LICENCE = 'node_modules/react-native/LICENSE'; // MIT, Meta; identical to Hermes's LICENSE (hermes-engine pod).
const L = (name) => `scripts/licences/${name}`;

// Versions read from node_modules/react-native/gradle/libs.versions.toml and ios/Podfile.lock (React Native 0.88.1).
const RN_DEPS = [
  { name: 'Folly', version: '2024.11.18.00', licence: 'Apache-2.0', url: 'https://github.com/facebook/folly', files: [APACHE] },
  { name: 'glog', version: '0.3.5', licence: 'BSD-3-Clause', url: 'https://github.com/google/glog', files: [L('glog.txt')], source: 'google/glog v0.3.5 COPYING' },
  { name: 'double-conversion', version: '1.1.6', licence: 'BSD-3-Clause', url: 'https://github.com/google/double-conversion', files: [L('double-conversion.txt')], source: 'google/double-conversion v1.1.6 LICENSE' },
  { name: '{fmt}', version: '12.1.0', licence: 'MIT', url: 'https://github.com/fmtlib/fmt', files: [L('fmt.txt')], source: 'fmtlib/fmt 12.1.0 LICENSE' },
  { name: 'Boost', version: '1.83.0 (Android), 1.84.0 (iOS)', licence: 'BSL-1.0', url: 'https://www.boost.org', files: [L('boost.txt')], source: 'boostorg/boost boost-1.84.0 LICENSE_1_0.txt' },
  { name: 'fast_float', version: '8.0.0', licence: 'MIT OR Apache-2.0 OR BSL-1.0', url: 'https://github.com/fastfloat/fast_float', files: [L('fast_float-mit.txt')], source: 'fastfloat/fast_float v8.0.0 LICENSE-MIT' },
  { name: 'Hermes', version: '260318099.0.5', licence: 'MIT', url: 'https://github.com/facebook/hermes', files: [RN_LICENCE] },
  { name: 'SocketRocket', version: '0.7.1', licence: 'BSD-3-Clause', platform: 'ios', url: 'https://github.com/facebookincubator/SocketRocket', files: [L('socketrocket.txt')], source: 'facebookincubator/SocketRocket 0.7.1 LICENSE' },
  { name: 'OkHttp', version: '4.9.2', licence: 'Apache-2.0', platform: 'android', url: 'https://square.github.io/okhttp/', files: [APACHE] },
  { name: 'Okio', version: '2.9.0, 3.16.0', licence: 'Apache-2.0', platform: 'android', url: 'https://square.github.io/okio/', files: [APACHE] },
  { name: 'Fresco', version: '3.7.0', licence: 'MIT', platform: 'android', url: 'https://frescolib.org', files: [L('fresco.txt')], source: 'facebook/fresco v3.7.0 LICENSE' },
  { name: 'SoLoader', version: '0.12.1', licence: 'Apache-2.0', platform: 'android', url: 'https://github.com/facebook/SoLoader', files: [APACHE] },
  { name: 'fbjni', version: '0.7.0', licence: 'Apache-2.0', platform: 'android', url: 'https://github.com/facebookincubator/fbjni', files: [APACHE] },
];

// The prebuilt Skia m154 libraries (react-native-skia-android / -apple-*) and what they link in; checked with `nm`
// on libskia.a and libskshaper.a (FreeType, libpng, libjpeg-turbo, libwebp, Expat, Wuffs, HarfBuzz symbols).
const SKIA = [
  { name: 'Skia', version: 'm154', licence: 'BSD-3-Clause', url: 'https://skia.org', files: [L('skia.txt')], source: 'google/skia chrome/m154 LICENSE' },
  { name: 'FreeType (in Skia)', version: 'as in Skia m154', licence: 'FTL', url: 'https://freetype.org', files: [L('freetype-ftl.txt')], source: 'freetype/freetype docs/FTL.TXT (FreeType is FTL or GPL-2.0; used under the FTL)' },
  { name: 'HarfBuzz (in Skia)', version: 'as in Skia m154', licence: 'MIT-Modern-Variant', url: 'https://harfbuzz.github.io', files: [L('harfbuzz.txt')], source: 'harfbuzz/harfbuzz COPYING' },
  { name: 'libpng (in Skia)', version: 'as in Skia m154', licence: 'libpng-2.0', url: 'http://www.libpng.org/pub/png/libpng.html', files: [L('libpng.txt')], source: 'pnggroup/libpng libpng16 LICENSE' },
  { name: 'libjpeg-turbo (in Skia)', version: 'as in Skia m154', licence: 'IJG AND BSD-3-Clause AND Zlib', url: 'https://libjpeg-turbo.org', files: [L('libjpeg-turbo.txt')], source: 'libjpeg-turbo/libjpeg-turbo LICENSE.md + README.ijg (LEGAL ISSUES)' },
  { name: 'libwebp (in Skia)', version: 'as in Skia m154', licence: 'BSD-3-Clause', url: 'https://chromium.googlesource.com/webm/libwebp', files: [L('libwebp.txt')], source: 'webmproject/libwebp COPYING' },
  { name: 'Expat (in Skia)', version: 'as in Skia m154', licence: 'MIT', url: 'https://libexpat.github.io', files: [L('expat.txt')], source: 'libexpat/libexpat expat/COPYING' },
  { name: 'Wuffs (in Skia)', version: 'as in Skia m154', licence: 'Apache-2.0 OR MIT', url: 'https://github.com/google/wuffs', files: [APACHE] },
];

// Gradle dependencies the Expo modules declare in node_modules/<module>/android/build.gradle (direct ones only).
const EXPO_ANDROID = [
  { name: 'AndroidX (Jetpack) libraries, incl. CameraX 1.6.0, WebKit, Biometric', version: 'various', licence: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx', files: [APACHE] },
  { name: 'Kotlin standard library and kotlinx.coroutines', version: '2.2.10, 1.10.2', licence: 'Apache-2.0', url: 'https://kotlinlang.org', files: [L('kotlin-notice.txt'), APACHE], source: 'JetBrains/kotlin license/NOTICE.txt' },
  { name: 'Glide', version: '5.0.5', licence: 'BSD-2-Clause AND MIT AND Apache-2.0', url: 'https://github.com/bumptech/glide', files: [L('glide.txt')], source: 'bumptech/glide v5.0.5 LICENSE' },
  { name: 'Android Image Cropper', version: '4.7.0', licence: 'Apache-2.0', url: 'https://github.com/CanHub/Android-Image-Cropper', files: [APACHE] },
  { name: 'BlurView', version: '3.1.0', licence: 'Apache-2.0', url: 'https://github.com/Dimezis/BlurView', files: [APACHE] },
  { name: 'ShortcutBadger', version: '1.1.22', licence: 'Apache-2.0', url: 'https://github.com/leolin310148/ShortcutBadger', files: [L('shortcutbadger.txt'), APACHE], source: 'leolin310148/ShortcutBadger LICENSE' },
  { name: 'Apache Commons IO', version: '2.6', licence: 'Apache-2.0', url: 'https://commons.apache.org/proper/commons-io/', files: [L('commons-io-notice.txt'), APACHE], source: 'META-INF/NOTICE.txt of commons-io-2.6.jar' },
  { name: 'Apache Commons Codec', version: '1.10', licence: 'Apache-2.0', url: 'https://commons.apache.org/proper/commons-codec/', files: [L('commons-codec-notice.txt'), APACHE], source: 'META-INF/NOTICE.txt of commons-codec-1.10.jar' },
  { name: 'Brotli decoder (Java)', version: '0.1.2', licence: 'MIT', url: 'https://github.com/google/brotli', files: [L('brotli.txt')], source: 'google/brotli LICENSE' },
  { name: 'zstd-kmp', version: '0.4.0', licence: 'Apache-2.0', url: 'https://github.com/square/zstd-kmp', files: [APACHE] },
  { name: 'Zstandard (in zstd-kmp)', version: 'as in zstd-kmp 0.4.0', licence: 'BSD-3-Clause', url: 'https://github.com/facebook/zstd', files: [L('zstd.txt')], source: 'facebook/zstd LICENSE (zstd is BSD-3-Clause or GPL-2.0; used under BSD)' },
  // Expo's own Android artifacts from Maven Central. pika-api's POM declares MIT; kolibri-android (version set by
  // Expo's Gradle platform) and expo-modules-v2-react declare nothing we could check, so they are flagged in the
  // generator's output. The text shown is Expo's MIT licence from the expo package.
  { name: 'Expo Android libraries (pika-api, kolibri-android, expo-modules-v2-react)', version: '1.1.0, —, 0.2.7', licence: 'MIT', url: 'https://github.com/expo/expo', files: ['node_modules/expo/LICENSE'], note: 'unclear' },
].map((e) => ({ platform: 'android', ...e }));

// Google's closed-source SDKs: not open source, listed so the screen is complete. Their terms aren't shipped
// with them, so the screen shows a link instead of a text.
const GOOGLE_TERMS = 'https://developer.android.com/studio/terms';
const GOOGLE_SDKS = [
  { name: 'Google Play services (location, base, code scanner)', version: '21.0.1, 17.3.0, 16.1.0' },
  { name: 'ML Kit Barcode Scanning', version: '17.3.0' },
  { name: 'Firebase Cloud Messaging', version: '25.0.1' },
  { name: 'Google Play In-App Review', version: '2.0.1' },
  { name: 'Play Install Referrer', version: '2.2' },
].map((e) => ({ ...e, licence: 'Proprietary (Google terms)', platform: 'android', url: GOOGLE_TERMS, note: 'proprietary' }));

const IOS = [
  { name: 'ZXingObjC', version: 'as required by expo-camera', licence: 'Apache-2.0', platform: 'ios', url: 'https://github.com/zxingify/zxingify-objc', files: [APACHE] },
];

/** Bundled inside PDF.js's build (src/pdf/pdfjs.generated.json): only the two decoders and core-js are shipped. */
function pdfjsInside(read) {
  const pdfjs = 'node_modules/pdfjs-dist';
  const version = JSON.parse(read(`${pdfjs}/package.json`)).version;
  // The legacy build carries core-js polyfills; its version and copyright are recorded in the build itself.
  const build = read(`${pdfjs}/legacy/build/pdf.min.mjs`);
  const coreJs = build.match(/version:"([\d.]+)",mode:[^,]+,copyright:"([^"]+)"/);
  if (!coreJs) throw new Error('generate-licences: core-js not found in the PDF.js legacy build; check licences-manual.js');
  // core-js is MIT: the standard MIT text (from React's LICENSE) with core-js's own copyright line.
  const mit = read('node_modules/react/LICENSE').replace(/^Copyright .*$/m, `Copyright ${coreJs[2]}`);
  return [
    {
      name: 'PDF.js JBIG2 decoder (from PDFium)',
      version: `in PDF.js ${version}`,
      licence: 'BSD-3-Clause AND Apache-2.0',
      url: 'https://pdfium.googlesource.com/pdfium/',
      files: [`${pdfjs}/wasm/LICENSE_JBIG2`, `${pdfjs}/wasm/LICENSE_PDFJS_JBIG2`],
    },
    {
      name: 'PDF.js JPEG 2000 decoder (OpenJPEG)',
      version: `in PDF.js ${version}`,
      licence: 'BSD-2-Clause',
      url: 'https://www.openjpeg.org',
      files: [`${pdfjs}/wasm/LICENSE_OPENJPEG`, `${pdfjs}/wasm/LICENSE_PDFJS_OPENJPEG`],
    },
    {
      name: 'core-js (in PDF.js)',
      version: coreJs[1],
      licence: 'MIT',
      url: 'https://github.com/zloirock/core-js',
      text: () => mit,
    },
  ];
}

/** SQLite, compiled into expo-sqlite from its vendored amalgamation; the "licence" is the blessing in sqlite3.h. */
function sqlite(read) {
  const header = read('node_modules/expo-sqlite/vendor/sqlite3/sqlite3.h');
  const version = header.match(/#define SQLITE_VERSION\s+"([^"]+)"/)[1];
  const blessing = header.match(/\*\* The author disclaims copyright[\s\S]*?\*\*\s+May you share freely[^\n]*\n/);
  if (!blessing) throw new Error('generate-licences: the SQLite blessing was not found in sqlite3.h');
  const text = blessing[0].replace(/^\*\* ?/gm, '').trim();
  return [{ name: 'SQLite (in expo-sqlite)', version, licence: 'blessing', url: 'https://sqlite.org', text: () => text }];
}

module.exports = (read) => [
  ...pdfjsInside(read),
  ...sqlite(read),
  ...RN_DEPS,
  ...SKIA,
  ...EXPO_ANDROID,
  ...GOOGLE_SDKS,
  ...IOS,
];
