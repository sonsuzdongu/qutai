// Android text keeps an explicit font family (patches/react-native+<version>.patch): Fabric measures a Text without
// one with the bare default typeface but draws it with the theme's, and on phones that swap the system font (ColorOS)
// with a theme other than the phone's, bold labels lost their last letters ("Ayarl…", "Bitt"), also right after a theme
// switch while the app runs (UI-46). If a React Native upgrade drops the patch, this fails instead of the labels.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const version = JSON.parse(readFileSync('node_modules/react-native/package.json', 'utf8')).version as string;
const textJs = readFileSync('node_modules/react-native/Libraries/Text/Text.js', 'utf8');

test('the React Native patch matches the installed version', () => {
  assert.ok(readdirSync('patches').includes(`react-native+${version}.patch`), `patches/react-native+${version}.patch`);
});

test('outermost Android Text without a font family gets a system font family', () => {
  assert.match(textJs, /androidFont:\s*\{\s*fontFamily: 'sans-serif',?\s*\}/);
  assert.match(textJs, /androidFontDark:\s*\{\s*fontFamily: 'arial',?\s*\}/);
  assert.match(textJs, /androidScheme != null &&\s*\(processedStyle == null \|\| processedStyle\.fontFamily == null\)/);
  // Only outside a parent Text: nested text inherits the parent's family (a monospace code span keeps it).
  assert.ok(textJs.indexOf('styles.androidFont') > textJs.indexOf('if (hasTextAncestor)'));
});

test('a live theme switch measures and draws labels anew (UI-46)', () => {
  // The family's name and the native view's key follow the scheme the native side reported, not setColorScheme's value.
  assert.match(textJs, /<React\.Fragment key=\{androidScheme\}>\{nativeText\}<\/React\.Fragment>/);
  assert.match(textJs, /Appearance\.addChangeListener\(\(\{colorScheme\}\) => \{\s*qutaiTextScheme = colorScheme \?\? 'light';/);
  assert.doesNotMatch(textJs.slice(textJs.indexOf('function qutaiAndroidTextScheme')), /setColorScheme/);
});
