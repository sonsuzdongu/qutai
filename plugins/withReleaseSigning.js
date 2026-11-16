const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// qutai-release-signing';

/*
 * The release signing config, read at build time from a properties file outside the repository (never committed):
 * $QUTAI_RELEASE_SIGNING if set, else ~/.qutai/release-signing.properties, with
 *   storeFile=<absolute path of the .jks>   storePassword=...   keyAlias=...   keyPassword=...
 * (docs/release-signing.md). Without the file, release builds stay signed with the template debug keystore as
 * before, with a warning. A file that is there but incomplete, or names a missing keystore, fails the build.
 */
const SIGNING_CONFIG = `
        release {
            ${MARKER}
            def qutaiSigningFile = file(System.getenv('QUTAI_RELEASE_SIGNING') ?: "\${System.getProperty('user.home')}/.qutai/release-signing.properties")
            if (qutaiSigningFile.exists()) {
                def p = new Properties()
                qutaiSigningFile.withInputStream { p.load(it) }
                ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].each { key ->
                    if (!p.getProperty(key)) throw new GradleException("Qutai release signing: \${key} missing in \${qutaiSigningFile}")
                }
                def store = file(p.getProperty('storeFile'))
                if (!store.exists()) throw new GradleException("Qutai release signing: keystore not found: \${store}")
                storeFile store
                storePassword p.getProperty('storePassword')
                keyAlias p.getProperty('keyAlias')
                keyPassword p.getProperty('keyPassword')
            }
        }`;

const RELEASE_SIGNING =
  'signingConfig(signingConfigs.release.storeFile != null ? signingConfigs.release : signingConfigs.debug)\n' +
  '            if (signingConfigs.release.storeFile == null) logger.warn("Qutai: no release signing file, release build signed with the template debug keystore")';

/** The build.gradle text with Qutai's release signing; unchanged when it is already there. */
function addReleaseSigning(contents) {
  let s = contents;
  if (s.includes(MARKER)) return s;

  const signingConfigs = s.indexOf('signingConfigs {');
  if (signingConfigs < 0) throw new Error('withReleaseSigning: signingConfigs block not found');
  const debugEnd = s.indexOf('\n        }', s.indexOf('debug {', signingConfigs));
  if (debugEnd < 0) throw new Error('withReleaseSigning: signingConfigs.debug not found');
  const insertAt = debugEnd + '\n        }'.length;
  s = s.slice(0, insertAt) + SIGNING_CONFIG + s.slice(insertAt);

  const buildTypes = s.indexOf('buildTypes {');
  const release = s.indexOf('release {', buildTypes);
  const line = 'signingConfig signingConfigs.debug';
  const at = s.indexOf(line, release);
  if (buildTypes < 0 || release < 0 || at < 0) throw new Error('withReleaseSigning: buildTypes.release signingConfig not found');
  return s.slice(0, at) + RELEASE_SIGNING + s.slice(at + line.length);
}

/**
 * Android: release builds signed with Qutai's own upload key when this machine has the signing file (see above);
 * the template build.gradle signs release builds with the shared debug keystore. EAS Build signs with its own
 * credentials and is not affected.
 */
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') throw new Error('withReleaseSigning: a Groovy build.gradle expected');
    config.modResults.contents = addReleaseSigning(config.modResults.contents);
    return config;
  });
};
module.exports.addReleaseSigning = addReleaseSigning;
