// Android draws the text layout that was measured (plugins/withPreparedTextLayout.js, UI-49): React Native's
// prepared text layout is turned on in MainApplication, right after React Native has loaded its own flags.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { addPreparedTextLayout } = require('../../plugins/withPreparedTextLayout.js') as {
  addPreparedTextLayout: (source: string) => string;
};

// The shape of the MainApplication.kt that `expo prebuild` writes for this SDK.
const MAIN = `package com.sonsuzdongu.qutai

import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`;

test('turns prepared text layout on right after React Native loads its flags', () => {
  const out = addPreparedTextLayout(MAIN);
  const load = out.indexOf('loadReactNative(this)\n');
  const force = out.indexOf('ReactNativeFeatureFlags.dangerouslyForceOverride(QutaiFeatureFlags())');
  assert.ok(load > 0 && force > load, 'the override follows loadReactNative');
  assert.ok(force < out.indexOf('ApplicationLifecycleDispatcher.onApplicationCreate'));
  assert.match(out, /import com\.facebook\.react\.internal\.featureflags\.ReactNativeFeatureFlags\n/);
  assert.match(out, /private class QutaiFeatureFlags : ReactNativeNewArchitectureFeatureFlagsDefaults\(\) \{\n {2}override fun enablePreparedTextLayout\(\): Boolean = true\n\}/);
});

test('applying it twice changes nothing', () => {
  const once = addPreparedTextLayout(MAIN);
  assert.equal(addPreparedTextLayout(once), once);
});

test('stops the build when MainApplication no longer has the expected shape', () => {
  assert.throws(() => addPreparedTextLayout(MAIN.replace('loadReactNative(this)', 'start(this)')), /loadReactNative/);
});

test('app.json uses the plugin', () => {
  const plugins = JSON.parse(readFileSync('app.json', 'utf8')).expo.plugins as unknown[];
  assert.ok(plugins.includes('./plugins/withPreparedTextLayout'));
});
