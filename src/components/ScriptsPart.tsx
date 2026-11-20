import { useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { keptScripts } from '../browser/keptScripts';
import { checkScript } from '../content/scriptCheck';
import { formatScope, parseScope, siteHost, type Scope, type ScopeKind } from '../content/siteRules';
import {
  DEFAULT_SCRIPT_RUN_AT,
  DEFAULT_SCRIPT_SCOPE,
  SCRIPT_RUN_ATS,
  SCRIPT_SCOPE_KINDS,
  scriptScopeForUrl,
  sealMatches,
  type UserScript,
} from '../content/userScripts';
import { scriptKey } from '../device/scriptKey';
import { formatDateTime } from '../i18n/format';
import { t, type MessageKey } from '../i18n';
import { siteRules, SiteRuleError } from '../storage/siteRules';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { dialog } from './Dialog';
import { approveKeptCode, runAtLabel, scriptScopeLabel, scriptWhere, switchScriptOn } from './pageScripts';
import { ScriptEditorScreen, type ScriptDraft } from './ScriptEditorScreen';

/**
 * Kept scripts in "My rules" (docs/page-customisation.md › Kept scripts): their own kind, each with its name, where and
 * when it runs, what it does (the flags), its last run, a switch (asking for approval first when its code isn't
 * approved on this phone), View and edit code (changed code is approved before it is saved), where, when, Delete.
 */
export function ScriptsPart() {
  const styles = useStyles();
  const palette = usePalette();
  useSyncExternalStore(siteRules.subscribe, siteRules.getVersion);
  useSyncExternalStore(keptScripts.subscribe, keptScripts.getVersion);
  const [draft, setDraft] = useState<(ScriptDraft & { save: (name: string, code: string) => Promise<boolean> }) | null>(null);
  const key = scriptKey();
  const scriptsOn = keptScripts.enabled();
  const groups = new Map<string, UserScript[]>();
  for (const script of siteRules.scripts) groups.set(script.site, [...(groups.get(script.site) ?? []), script]);
  const sites = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  const failed = (e: unknown) =>
    dialog.alert(t('scripts.failedTitle'), e instanceof SiteRuleError && e.code === 'tooMany' ? t('scripts.tooMany') : t('scripts.invalid'));

  const edit = (script: UserScript) =>
    setDraft({
      title: t('scripts.editTitle'),
      name: script.name,
      code: script.code,
      where: scriptWhere(script.scope),
      save: async (name, code) => {
        if (code === script.code) {
          await siteRules.updateScript(script.id, { name });
          return true;
        }
        const seal = await approveKeptCode({ name: name || script.name, scope: script.scope, code });
        if (!seal) return false;
        await siteRules.updateScript(script.id, { name, code, seal, enabled: script.enabled });
        return true;
      },
    });

  const changeScope = async (script: UserScript) => {
    const current = parseScope(script.scope);
    if (!current) return;
    const kind = await pickScriptScope(current.kind, script.name);
    if (!kind || kind === current.kind) return;
    const base = script.url ?? baseUrl(current);
    const scope = scriptScopeForUrl(base, kind);
    if (!scope) return dialog.alert(t('scripts.failedTitle'), t('styles.noAddress'));
    await siteRules.updateScript(script.id, { scope: formatScope(scope) }).catch(failed);
  };

  const changeWhen = async (script: UserScript) => {
    const result = await dialog.show({
      title: t('scripts.whenLabel'),
      message: script.name,
      choices: { label: t('scripts.whenLabel'), options: SCRIPT_RUN_ATS.map(runAtLabel), initial: SCRIPT_RUN_ATS.indexOf(script.runAt) },
      buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.save') }],
    });
    if (result.button === 1) await siteRules.updateScript(script.id, { runAt: SCRIPT_RUN_ATS[result.choice] ?? script.runAt }).catch(failed);
  };

  const remove = async (script: UserScript) => {
    const ok = await dialog.confirm({ title: t('scripts.removeTitle'), message: script.name, confirmText: t('siteRules.remove'), destructive: true });
    if (ok) await siteRules.removeScripts([script.id]).catch(() => {});
  };

  const add = async () => {
    const siteText = await dialog.prompt({
      title: t('scripts.addTitle'),
      message: t('scripts.addSiteBody'),
      label: t('siteRules.siteLabel'),
      placeholder: 'example.com',
      maxLength: 300,
      confirmText: t('siteRules.next'),
    });
    if (!siteText) return;
    const raw = siteText.trim();
    const isUrl = /^https?:\/\//i.test(raw);
    const host = isUrl ? (parseScope(raw)?.host ?? null) : siteHost(raw.replace(/^\*\./, '').replace(/\/.*$/, ''));
    if (!host) return dialog.alert(t('scripts.failedTitle'), t('siteRules.badSite'));
    const url = isUrl ? raw : `https://${host}/`;
    const kind = await pickScriptScope(isUrl ? 'page' : DEFAULT_SCRIPT_SCOPE);
    if (!kind) return;
    const scope = scriptScopeForUrl(url, kind);
    if (!scope) return;
    setDraft({
      title: t('scripts.addTitle'),
      name: '',
      code: '',
      where: scriptWhere(formatScope(scope)),
      save: async (name, code) => {
        const label = name || scriptWhere(formatScope(scope));
        const seal = await approveKeptCode({ name: label, scope: formatScope(scope), code });
        if (!seal) return false;
        await siteRules.addScript({ name: label, scope: formatScope(scope), code, runAt: DEFAULT_SCRIPT_RUN_AT, site: scope.host, source: 'manual', seal, url });
        return true;
      },
    });
  };

  return (
    <View style={styles.part}>
      <Text style={styles.subheading} accessibilityRole="header">
        {t('scripts.title')}
      </Text>
      <Text style={styles.hint}>{t('scripts.intro')}</Text>
      {!scriptsOn && <Text style={[styles.hint, styles.warn]}>{t('scripts.allOff')}</Text>}
      {sites.map((site) => (
        <View key={site} style={styles.card}>
          <Text style={styles.site}>{site}</Text>
          {groups.get(site)!.map((script) => {
            const sealed = sealMatches(script.code, script.seal, key);
            const checked = checkScript(script.code, 'kept');
            const flags = checked.ok ? checked.flags : [];
            return (
              <View key={script.id} style={styles.rule}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.value} numberOfLines={3}>
                      {script.name}
                    </Text>
                    <Text style={styles.hint}>
                      {scriptWhere(script.scope)}
                      {' · '}
                      {runAtLabel(script.runAt)}
                    </Text>
                    <Text style={[styles.hint, flags.length > 0 && styles.warn]}>
                      {flags.length ? flags.map((f) => t(`scripts.flag.${f}` as MessageKey)).join(' · ') : t('scripts.noFlags')}
                    </Text>
                    {!sealed && <Text style={[styles.hint, styles.warn]}>{t('scripts.needsApproval')}</Text>}
                    <Text style={styles.hint}>{lastRunText(script)}</Text>
                  </View>
                  <Pressable
                    onPress={() => remove(script)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('scripts.removeLabel', { name: script.name })}
                    style={styles.remove}
                  >
                    <Icon name="close" size={16} color={palette.textSecondary} />
                  </Pressable>
                  <ThemedSwitch
                    value={script.enabled && sealed}
                    onValueChange={(on) =>
                      void (on ? switchScriptOn(script, sealed) : siteRules.updateScript(script.id, { enabled: false })).catch(failed)
                    }
                    accessibilityLabel={script.name}
                  />
                </View>
                <View style={styles.links}>
                  <Text
                    style={styles.link}
                    onPress={() => edit(script)}
                    accessibilityRole="button"
                    accessibilityLabel={t('scripts.editLabel', { name: script.name })}
                  >
                    {t('scripts.edit')}
                  </Text>
                  <Text style={styles.link} onPress={() => changeScope(script)} accessibilityRole="button">
                    {t('styles.changeScope')}
                  </Text>
                  <Text style={styles.link} onPress={() => changeWhen(script)} accessibilityRole="button">
                    {t('scripts.changeWhen')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
      {!siteRules.scripts.length && <Text style={styles.hint}>{t('scripts.none')}</Text>}
      <Pressable onPress={add} style={({ pressed }) => [styles.button, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.buttonText}>{t('scripts.add')}</Text>
      </Pressable>
      <ScriptEditorScreen
        draft={draft}
        onSave={(name, code) => (draft ? draft.save(name, code) : Promise.resolve(false))}
        onClose={() => setDraft(null)}
      />
    </View>
  );
}

function lastRunText(script: UserScript): string {
  const run = script.lastRun;
  if (!run) return t('scripts.lastRun.never');
  const when = formatDateTime(new Date(run.at));
  if (run.status === 'error') return t('scripts.lastRun.error', { when, error: keptScripts.lastMessage(script.id) ?? run.error ?? 'Error' });
  return t(`scripts.lastRun.${run.status}` as MessageKey, { when });
}

async function pickScriptScope(initial: ScopeKind, message?: string): Promise<ScopeKind | null> {
  const result = await dialog.show({
    title: t('siteRules.scopeTitle'),
    message,
    choices: { label: t('siteRules.scopeLabel'), options: SCRIPT_SCOPE_KINDS.map(scriptScopeLabel), initial: SCRIPT_SCOPE_KINDS.indexOf(initial) },
    buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.save') }],
  });
  return result.button === 1 ? SCRIPT_SCOPE_KINDS[result.choice] : null;
}

function baseUrl(scope: Scope): string {
  return `https://${scope.host}${scope.kind === 'page' || scope.kind === 'path' ? (scope.path ?? '/') : '/'}`;
}

const useStyles = makeStyles((c) => ({
  part: { gap: 10, marginTop: 8 },
  subheading: { fontSize: 16, fontWeight: '700', color: c.text },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  warn: { color: c.danger },
  card: { ...common(c).card, padding: 14, gap: 10 },
  site: { fontSize: 15, fontWeight: '600', color: c.text },
  rule: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  value: { fontSize: 14, color: c.text },
  remove: { paddingHorizontal: 4 },
  link: { fontSize: 13, color: c.tintText, fontWeight: '600', paddingVertical: 4 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
  button: { backgroundColor: c.surface, borderRadius: radii.control, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600', color: c.tintText },
  pressed: { backgroundColor: c.pressed },
}));
