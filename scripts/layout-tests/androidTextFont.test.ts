// Android text keeps an explicit font family (patches/react-native+<version>.patch): Fabric measures a Text without
// one with the bare default typeface but draws it with the theme's, and on phones that swap the system font (ColorOS)
// with a theme other than the phone's, bold labels lost their last letters ("Ayarl…", "Bitt"). If a React Native
// upgrade drops the patch, this fails instead of the labels.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const version = JSON.parse(readFileSync('node_modules/react-native/package.json', 'utf8')).version as string;
const textJs = readFileSync('node_modules/react-native/Libraries/Text/Text.js', 'utf8');

test('the React Native patch matches the installed version', () => {
  assert.ok(readdirSync('patches').includes(`react-native+${version}.patch`), `patches/react-native+${version}.patch`);
});

test('outermost Android Text without a font family gets sans-serif', () => {
  assert.match(textJs, /androidFont:\s*\{\s*fontFamily: 'sans-serif',?\s*\}/);
  assert.match(textJs, /Platform\.OS === 'android' &&\s*\(processedStyle == null \|\| processedStyle\.fontFamily == null\)/);
  // Only outside a parent Text: nested text inherits the parent's family (a monospace code span keeps it).
  assert.ok(textJs.indexOf('styles.androidFont') > textJs.indexOf('if (hasTextAncestor)'));
});
