// Android launcher shortcuts (LANG-19): the plugin declares none, the module publishes four dynamic ones in Qutai's
// language. The Kotlin side runs only on a phone, so its decisions are checked here from its source; docs/test-checklist.md
// lists what to try on a device.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../..');
const plugin = require(path.join(root, 'plugins/withEntryPoints.js'));
const moduleDir = path.join(root, 'modules/qutai-entry/android/src/main');
const kotlin = fs.readFileSync(path.join(moduleDir, 'java/expo/modules/qutaientry/AppLanguage.kt'), 'utf8');

/** The module's SHORTCUTS list: id, url and the label resources, in order. */
function moduleShortcuts() {
  const list = kotlin.slice(kotlin.indexOf('private val SHORTCUTS = listOf('));
  const body = list.slice(0, list.indexOf('\n  )\n'));
  return [...body.matchAll(/Shortcut\(\s*"([^"]+)",\s*"([^"]+)",\s*R\.drawable\.(\w+),\s*R\.string\.(\w+),\s*R\.string\.(\w+),?\s*\)/g)].map(
    (m) => ({ id: m[1], url: m[2], icon: m[3], short: m[4], long: m[5] }),
  );
}

function manifestWithOldShortcuts() {
  return {
    manifest: {
      $: {},
      application: [
        {
          $: { 'android:name': '.MainApplication' },
          activity: [
            {
              $: { 'android:name': '.MainActivity' },
              'intent-filter': [
                {
                  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
                },
              ],
              'meta-data': [{ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/qutai_shortcuts' } }],
            },
          ],
        },
      ],
    },
  };
}

test('the manifest declares no static launcher shortcuts, also when an earlier prebuild added them', () => {
  let manifest = plugin.editManifest(manifestWithOldShortcuts());
  manifest = plugin.editManifest(manifest);
  const activity = manifest.manifest.application[0].activity[0];
  assert.ok(!(activity['meta-data'] ?? []).some((m: any) => m.$['android:name'] === 'android.app.shortcuts'));
  assert.ok(!JSON.stringify(manifest).includes('qutai_shortcuts'));
});

test('the locale receiver hears language changes and updates (shortcuts published without opening the app)', () => {
  const manifest = plugin.editManifest(manifestWithOldShortcuts());
  const receivers = manifest.manifest.application[0].receiver.filter(
    (r: any) => r.$['android:name'] === 'expo.modules.qutaientry.QutaiLocaleReceiver',
  );
  assert.equal(receivers.length, 1, 'declared once, also after two runs');
  assert.equal(receivers[0].$['android:exported'], 'false');
  const actions = receivers[0]['intent-filter'][0].action.map((a: any) => a.$['android:name']);
  assert.deepEqual(actions.sort(), ['android.intent.action.LOCALE_CHANGED', 'android.intent.action.MY_PACKAGE_REPLACED']);
  // Nothing that starts the app at boot just for the shortcuts.
  assert.ok(!JSON.stringify(manifest).includes('BOOT_COMPLETED'));
});

test('a static shortcuts file left in android/ by an earlier prebuild is removed', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qutai-entry-'));
  const xml = path.join(dir, 'app/src/main/res/xml');
  fs.mkdirSync(xml, { recursive: true });
  fs.writeFileSync(path.join(xml, 'qutai_shortcuts.xml'), '<shortcuts/>');
  fs.writeFileSync(path.join(xml, 'other.xml'), '<x/>');
  await plugin.removeStaticShortcutsFile(dir);
  assert.ok(!fs.existsSync(path.join(xml, 'qutai_shortcuts.xml')));
  assert.ok(fs.existsSync(path.join(xml, 'other.xml')));
  await plugin.removeStaticShortcutsFile(dir); // already gone: no error
  fs.rmSync(dir, { recursive: true, force: true });
});

test('after an update the dynamic set is the four, in order, under the ids pinned copies of older builds carry', () => {
  const shortcuts = moduleShortcuts();
  assert.deepEqual(
    shortcuts.map((s) => s.id),
    ['new_tab', 'new_private_tab', 'ask', 'scan'],
  );
  // static_* ids belong to the removed manifest shortcuts: their pinned copies stay immutable and publishing a dynamic
  // shortcut with such an id throws.
  assert.ok(shortcuts.every((s) => !s.id.startsWith('static_')));
  // Four fit every launcher's menu (most show at most four).
  assert.ok(shortcuts.length <= 4);
  // The same links as the iOS quick actions, in the same order.
  assert.deepEqual(
    shortcuts.map((s) => s.url),
    plugin.SHORTCUTS.map((s: { url: string }) => s.url),
  );
  // One call replaces the whole dynamic set (no duplicates), ranked in list order, never more than the launcher allows.
  assert.match(kotlin, /ShortcutManagerCompat\.setDynamicShortcuts\(context, items\)/);
  assert.match(kotlin, /\.setRank\(rank\)/);
  assert.match(kotlin, /SHORTCUTS\.take\(max\.coerceAtLeast\(0\)\)/);
  assert.doesNotMatch(kotlin, /removeAllDynamicShortcuts/);
  // Published on start, on a language change and after an update.
  assert.match(kotlin, /ACTION_LOCALE_CHANGED \|\| intent\.action == Intent\.ACTION_MY_PACKAGE_REPLACED/);
  const moduleKt = fs.readFileSync(path.join(moduleDir, 'java/expo/modules/qutaientry/QutaiEntryModule.kt'), 'utf8');
  assert.match(moduleKt, /OnCreate \{[\s\S]*?AppLanguage\.apply\(context\)/);
});

test("labels are read in Qutai's language: the chosen one, else the phone's (not the app context's)", () => {
  assert.match(kotlin, /fun localized\(context: Context, tag: String = get\(context\)\)/);
  assert.match(
    kotlin,
    /if \(tag\.isEmpty\(\)\) Resources\.getSystem\(\)\.configuration\.locales else LocaleList\.forLanguageTags\(tag\)/,
  );
  // get(): Android 13+ the system's per-app language, earlier the stored choice.
  assert.match(kotlin, /LocaleManager::class\.java\)\?\.applicationLocales\?\.toLanguageTags\(\)/);
  assert.match(kotlin, /getString\(APP_LANGUAGE, ""\)/);
  // Setting the language publishes straight away with the new tag on Android 13+ too.
  assert.match(kotlin, /manager\.applicationLocales = [^\n]+\n(?:\s*\/\/[^\n]*\n)*\s*apply\(context, tag\)/);
  // Publishing never throws out of a receiver or the module.
  assert.match(kotlin, /catch \(e: RuntimeException\) \{\n\s*\/\/ No shortcut support/);
});

test('every label exists in all ten languages', () => {
  const dirs = ['values', 'values-tr', 'values-de', 'values-es', 'values-pt-rBR', 'values-fr', 'values-ja', 'values-ko', 'values-ru', 'values-in'];
  const names = new Set(moduleShortcuts().flatMap((s) => [s.short, s.long]));
  for (const dir of dirs) {
    const xml = fs.readFileSync(path.join(moduleDir, 'res', dir, 'strings.xml'), 'utf8');
    for (const name of names) assert.match(xml, new RegExp(`<string name="${name}">[^<]+</string>`), `${dir}: ${name}`);
  }
  for (const s of moduleShortcuts()) assert.ok(fs.existsSync(path.join(moduleDir, 'res/drawable', `${s.icon}.xml`)), s.icon);
});
