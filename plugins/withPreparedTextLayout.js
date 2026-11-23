const { withMainApplication } = require('expo/config-plugins');

const MARKER = 'QutaiFeatureFlags';

/**
 * Android: React Native's "prepared text layout" (UI-49). By default Fabric measures a text with its own long-lived
 * TextPaint and the text view then lays the text out again with its own paint to draw it. When the two disagree, the
 * text is drawn wider than the room it was given and is cut ("Ne" for "Ne yapayım?", "Ayarl…", "Bitt"). ColorOS does
 * this after a live dark → light switch, until the app is restarted. With prepared layout the view draws exactly the
 * Layout that was measured, so what is drawn always fits its measured box. The flag is off in every release level of
 * React Native 0.88, so it is turned on here, right after React Native has loaded its own flags.
 */
function addPreparedTextLayout(source) {
  if (source.includes(MARKER)) return source;
  const load = /^(\s*)loadReactNative\(this\)\s*$/m;
  if (!load.test(source)) throw new Error('withPreparedTextLayout: loadReactNative(this) not found in MainApplication');
  let out = source.replace(
    load,
    (line, indent) =>
      `${line}\n${indent}// Qutai (UI-49): draw the measured text layout itself (plugins/withPreparedTextLayout.js).\n` +
      `${indent}ReactNativeFeatureFlags.dangerouslyForceOverride(${MARKER}())`,
  );
  out = out.replace(
    /^(import com\.facebook\.react\.defaults\.DefaultNewArchitectureEntryPoint)$/m,
    '$1\nimport com.facebook.react.internal.featureflags.ReactNativeFeatureFlags\n' +
      'import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults',
  );
  if (!out.includes('import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags\n')) {
    throw new Error('withPreparedTextLayout: DefaultNewArchitectureEntryPoint import not found in MainApplication');
  }
  return (
    out.trimEnd() +
    `\n\n/** React Native's stable flags (the same as these defaults in 0.88), plus prepared text layout (UI-49, plugins/withPreparedTextLayout.js). */\n` +
    `private class ${MARKER} : ReactNativeNewArchitectureFeatureFlagsDefaults() {\n` +
    `  override fun enablePreparedTextLayout(): Boolean = true\n` +
    `}\n`
  );
}

module.exports = function withPreparedTextLayout(config) {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') throw new Error('withPreparedTextLayout: MainApplication must be Kotlin');
    config.modResults.contents = addPreparedTextLayout(config.modResults.contents);
    return config;
  });
};

module.exports.addPreparedTextLayout = addPreparedTextLayout;
