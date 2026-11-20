// Every key in en.ts is used somewhere: written out in the app's code ('settings.blockAds'), or built from one of the
// dynamic patterns declared below. A key nothing reaches is dead weight in all ten languages and is removed instead.
// When code builds a key from a template (`site.level.${level}`), add the pattern here, with where it is built.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { en } from '../../src/i18n/en.ts';

const ROOT = new URL('../../', import.meta.url).pathname;

/** Keys built at run time. `prefix` covers every key starting with it; `pattern` a narrower shape. */
const DYNAMIC: { prefix?: string; pattern?: RegExp; where: string }[] = [
  { pattern: /^action\.(switch|read|close)TabPlain$/, where: 'src/agent/executeTool.ts (describeToolCall: `${key}Plain`)' },
  { prefix: 'suggest.', where: 'src/agent/pageSuggestions.ts' },
  { prefix: 'settings.theme.', where: 'SettingsModal.tsx, src/agent/settingsTool.ts' },
  { prefix: 'settings.addressBar.', where: 'SettingsModal.tsx, src/agent/settingsTool.ts' },
  { prefix: 'settings.alwaysAllow.', where: 'SettingsModal.tsx' },
  { prefix: 'settings.voiceMode.', where: 'SettingsModal.tsx' },
  { prefix: 'settings.contactsState.', where: 'SettingsModal.tsx' },
  { prefix: 'reader.theme.', where: 'ReaderSettingsSheet.tsx, src/agent/settingsTool.ts' },
  { prefix: 'reader.font.', where: 'ReaderSettingsSheet.tsx, src/agent/settingsTool.ts' },
  { prefix: 'model.', where: 'AiProviderFields.tsx, ModelSheet.tsx' },
  { prefix: 'site.level.', where: 'SitePermissionsScreen.tsx, SitePermissionSheet.tsx, App.tsx' },
  { prefix: 'site.setting.', where: 'SitePermissionSheet.tsx' },
  { prefix: 'site.hint.', where: 'SitePermissionSheet.tsx' },
  { pattern: /^site\.(personal|location|camera|microphone)(Summary|Hint)\./, where: 'SitePermissionsScreen.tsx, SitePermissionSheet.tsx' },
  { prefix: 'blocking.error.', where: 'FilterListsScreen.tsx' },
  { prefix: 'blocking.kind.', where: 'FilterListsScreen.tsx' },
  { prefix: 'permissions.', where: 'PermissionsStep.tsx' },
  { prefix: 'library.', where: 'LibraryScreen.tsx' },
  { prefix: 'sentLog.kind.', where: 'SentLogScreen.tsx' },
  { prefix: 'clearData.', where: 'ClearDataScreen.tsx' },
  { prefix: 'siteRules.scope.', where: 'pageCustomisation.tsx, pageScripts.tsx, SiteRulesSection.tsx, src/task/dialogs.ts' },
  { prefix: 'siteRules.selector.', where: 'SiteRulesSection.tsx' },
  { prefix: 'custom.check.', where: 'CustomEndpointFields.tsx' },
  { prefix: 'loadError.', where: 'ErrorPage.tsx' },
  { prefix: 'memory.category.', where: 'memoryCategories.ts' },
  { prefix: 'personal.kind.', where: 'memoryCategories.ts' },
  { prefix: 'downloads.restarted.', where: 'DownloadsScreen.tsx' },
  { prefix: 'profile.payment.', where: 'ProfileQuestions.tsx' },
  { prefix: 'confirm.dontAskAgain.', where: 'src/task/dialogs.ts' },
  { prefix: 'approval.title.', where: 'src/task/dialogs.ts' },
  { prefix: 'approval.changeTitle.', where: 'src/task/dialogs.ts' },
  { prefix: 'styles.problem.', where: 'StyleEditorScreen.tsx' },
  { prefix: 'scripts.flag.', where: 'ScriptsPart.tsx, pageScripts.tsx' },
  { prefix: 'scripts.lastRun.', where: 'ScriptsPart.tsx' },
  { prefix: 'scripts.runAt.', where: 'pageScripts.tsx' },
  { prefix: 'settings.scriptSite.', where: 'ScriptSitesSection.tsx' },
  { prefix: 'taskDone.', where: 'App.tsx' },
  { prefix: 'quick.', where: 'App.tsx' },
];

/** The app's code: App.tsx and src/, without the dictionaries themselves. */
function sources(): string[] {
  const out: string[] = [join(ROOT, 'App.tsx')];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name)) out.push(path);
    }
  };
  walk(join(ROOT, 'src'));
  const dictionaries = /src\/i18n\/(en|tr|de|es|fr|id|ja|ko|pt-BR|ru)\.ts$/;
  return out.filter((path) => !dictionaries.test(path));
}

const code = sources().map((path) => readFileSync(path, 'utf8'));
const written = new Set(code.flatMap((text) => [...text.matchAll(/['"`]([a-zA-Z]\w*(?:\.[\w-]+)+)['"`]/g)].map((m) => m[1])));
const keys = Object.keys(en);
const reached = (key: string, d: (typeof DYNAMIC)[number]) => (d.prefix ? key.startsWith(d.prefix) : d.pattern!.test(key));

test('every key in en.ts is written in the code or built from a declared pattern', () => {
  const unused = keys.filter((key) => !written.has(key) && !DYNAMIC.some((d) => reached(key, d)));
  assert.deepEqual(unused, [], `no code reaches: ${unused.join(', ')} (remove them from all ten languages, or declare the pattern that builds them)`);
});

test('every declared pattern still reaches a key', () => {
  const stale = DYNAMIC.filter((d) => !keys.some((key) => reached(key, d))).map((d) => d.prefix ?? String(d.pattern));
  assert.deepEqual(stale, [], `remove from DYNAMIC: ${stale.join(', ')}`);
});

test('every key template in the code is declared', () => {
  // `site.level.${x}` in the code: the part before ${ must be covered by a declared prefix or pattern.
  const templates = new Set(
    code.flatMap((text) => [...text.matchAll(/`([a-zA-Z]\w*(?:\.[\w-]+)*\.)\$\{/g)].map((m) => m[1])),
  );
  const undeclared = [...templates].filter((prefix) => {
    const covered = keys.filter((key) => key.startsWith(prefix));
    if (!covered.length) return false; // not a translation key (`window.${…}`, a file name…)
    return !DYNAMIC.some((d) => d.prefix === prefix || (d.prefix && prefix.startsWith(d.prefix)) || covered.every((key) => reached(key, d)));
  });
  assert.deepEqual(undeclared, [], `declare in DYNAMIC: ${undeclared.join(', ')}`);
});
