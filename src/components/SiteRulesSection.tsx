import { useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  blockLine,
  checkBlockDomain,
  DEFAULT_SCOPE,
  exportRules,
  hideLine,
  importRules,
  parseRuleLine,
  parseScope,
  Scope,
  SCOPE_KINDS,
  ScopeKind,
  selectorProblem,
  SiteRule,
  siteHost,
} from '../content/siteRules';
import { siteRules, SiteRuleError } from '../storage/siteRules';
import { pickRulesFile, RulesFileTooLargeError, shareRulesFile } from '../device/siteRulesFile';
import { t, type MessageKey } from '../i18n';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { dialog } from './Dialog';

/** The scope's on-screen name, e.g. "This site and its subdomains". */
export function scopeLabel(kind: ScopeKind): string {
  return t(`siteRules.scope.${kind}` as MessageKey);
}

/** Where a hiding rule applies, in words ("Pages under example.com/entry/"). */
function scopeText(scope: Scope): string {
  switch (scope.kind) {
    case 'page':
      return t('siteRules.where.page', { url: `${scope.host}${scope.path ?? '/'}` });
    case 'path':
      return t('siteRules.where.path', { prefix: `${scope.host}${scope.path ?? '/'}` });
    case 'site':
      return t('siteRules.where.site', { site: scope.host });
    case 'subdomains':
      return t('siteRules.where.subdomains', { site: scope.host });
  }
}

/** Picks one of the four scopes; null when cancelled. */
export async function pickScope(initial: ScopeKind, title: string, message?: string): Promise<ScopeKind | null> {
  const result = await dialog.show({
    title,
    message,
    choices: { label: t('siteRules.scopeLabel'), options: SCOPE_KINDS.map(scopeLabel), initial: SCOPE_KINDS.indexOf(initial) },
    buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.save') }],
  });
  return result.button === 1 ? SCOPE_KINDS[result.choice] : null;
}

/** "My rules" in the filter lists screen: the user's own rules by site, each with a switch, its scope and delete. */
export function SiteRulesSection({ disabled }: { disabled: boolean }) {
  const styles = useStyles();
  const palette = usePalette();
  useSyncExternalStore(siteRules.subscribe, siteRules.getVersion);
  const groups = new Map<string, SiteRule[]>();
  for (const rule of siteRules.rules) groups.set(rule.site, [...(groups.get(rule.site) ?? []), rule]);
  const sites = [...groups.keys()].sort();

  const failed = (e: unknown) =>
    dialog.alert(t('siteRules.failedTitle'), e instanceof SiteRuleError && e.code === 'tooMany' ? t('siteRules.tooMany') : t('siteRules.invalid'));

  const changeScope = async (rule: SiteRule) => {
    const parsed = parseRuleLine(rule.line);
    if (parsed?.kind !== 'hide') return;
    const kind = await pickScope(parsed.scope.kind, t('siteRules.scopeTitle'), parsed.selector);
    if (!kind || kind === parsed.scope.kind) return;
    // A page or path scope needs an address; going back to one from a site scope uses the site's front page.
    const base =
      rule.url ??
      (parsed.scope.kind === 'page' || parsed.scope.kind === 'path'
        ? `https://${parsed.scope.host}${parsed.scope.path ?? '/'}`
        : `https://${parsed.scope.host}/`);
    const scope = scopeFrom(base, kind);
    if (!scope) return;
    await siteRules.setLine(rule.id, hideLine(scope, parsed.selector)).catch(failed);
  };

  const remove = async (rule: SiteRule) => {
    const ok = await dialog.confirm({
      title: t('siteRules.removeTitle'),
      message: rule.line,
      confirmText: t('siteRules.remove'),
      destructive: true,
    });
    if (ok) await siteRules.remove([rule.id]).catch(() => {});
  };

  const addRule = async () => {
    const result = await dialog.show({
      title: t('siteRules.addTitle'),
      message: t('siteRules.addBody'),
      choices: {
        label: t('siteRules.addKind'),
        options: [t('siteRules.addHide'), t('siteRules.addBlock')],
        initial: 0,
      },
      buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('siteRules.next') }],
    });
    if (result.button !== 1) return;
    if (result.choice === 1) return addBlock();
    const siteText = await dialog.prompt({
      title: t('siteRules.addHide'),
      message: t('siteRules.siteBody'),
      label: t('siteRules.siteLabel'),
      placeholder: 'example.com',
      maxLength: 300,
      confirmText: t('siteRules.next'),
    });
    if (!siteText) return;
    const site = siteFromText(siteText);
    if (!site) return dialog.alert(t('siteRules.failedTitle'), t('siteRules.badSite'));
    const selector = await dialog.prompt({
      title: t('siteRules.addHide'),
      message: t('siteRules.selectorBody', { site }),
      label: t('siteRules.selectorLabel'),
      placeholder: '#ad-banner',
      maxLength: 300,
      confirmText: t('siteRules.next'),
    });
    if (!selector) return;
    const problem = selectorProblem(selector);
    if (problem) return dialog.alert(t('siteRules.failedTitle'), t(`siteRules.selector.${problem}` as MessageKey));
    const url = /^https?:\/\//i.test(siteText.trim()) ? siteText.trim() : `https://${site}/`;
    const kind = await pickScope(/^https?:\/\//i.test(siteText.trim()) ? 'page' : DEFAULT_SCOPE, t('siteRules.scopeTitle'), selector);
    if (!kind) return;
    const scope = scopeFrom(url, kind);
    if (!scope) return;
    await siteRules.add(scope.host, [hideLine(scope, selector)], 'manual', url).catch(failed);
  };

  const addBlock = async () => {
    const text = await dialog.prompt({
      title: t('siteRules.addBlock'),
      message: t('siteRules.blockBody'),
      label: t('siteRules.domainLabel'),
      placeholder: 'ads.example.com',
      maxLength: 300,
      confirmText: t('common.save'),
    });
    if (!text) return;
    const checked = checkBlockDomain(text, null);
    if (!('domain' in checked)) return dialog.alert(t('siteRules.failedTitle'), t('siteRules.badDomain'));
    await siteRules.add(checked.domain, [blockLine(checked.domain)], 'manual').catch(failed);
  };

  const exportAll = async () => {
    const day = new Date().toISOString().slice(0, 10);
    await shareRulesFile(exportRules(siteRules.rules), `qutai-rules-${day}.txt`).catch(() =>
      dialog.alert(t('siteRules.exportFailed')),
    );
  };

  const importFile = async () => {
    let text: string | null;
    try {
      text = await pickRulesFile();
    } catch (e) {
      return dialog.alert(t('siteRules.importFailed'), e instanceof RulesFileTooLargeError ? t('siteRules.importTooLarge') : undefined);
    }
    if (text === null) return;
    const read = importRules(text, siteRules.rules.map((r) => r.line));
    if (!read.rules.length && !read.duplicates) return dialog.alert(t('siteRules.importFailed'), t('siteRules.importNone'));
    let added = 0;
    try {
      added = await siteRules.addImported(read.rules);
    } catch {
      return dialog.alert(t('siteRules.importFailed'));
    }
    const skipped = read.duplicates + read.invalid + (read.rules.length - added);
    dialog.alert(t('siteRules.importedTitle'), t('siteRules.importedBody', { added, skipped }));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        {t('siteRules.title')}
      </Text>
      <Text style={styles.hint}>{t('siteRules.intro')}</Text>
      {sites.length === 0 && <Text style={styles.hint}>{t('siteRules.none')}</Text>}
      {sites.map((site) => (
        <View key={site} style={styles.card}>
          <Text style={styles.site}>{site}</Text>
          {groups.get(site)!.map((rule) => {
            const parsed = parseRuleLine(rule.line);
            if (!parsed) return null;
            const label = parsed.kind === 'hide' ? parsed.selector : parsed.domain;
            return (
              <View key={rule.id} style={styles.rule}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.value} selectable numberOfLines={3}>
                      {parsed.kind === 'hide' ? t('siteRules.hides', { selector: label }) : t('siteRules.blocks', { domain: label })}
                    </Text>
                    <Text style={styles.hint}>
                      {parsed.kind === 'hide' ? scopeText(parsed.scope) : t('siteRules.everywhere')}
                      {' · '}
                      {t(rule.source === 'assistant' ? 'siteRules.byAssistant' : 'siteRules.byYou')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => remove(rule)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('siteRules.removeLabel', { rule: label })}
                    style={styles.remove}
                  >
                    <Icon name="close" size={16} color={palette.textSecondary} />
                  </Pressable>
                  <ThemedSwitch
                    value={rule.enabled}
                    disabled={disabled}
                    onValueChange={(on) => siteRules.setEnabled(rule.id, on).catch(() => {})}
                    accessibilityLabel={label}
                  />
                </View>
                {parsed.kind === 'hide' && (
                  <Text
                    style={styles.link}
                    onPress={() => changeScope(rule)}
                    accessibilityRole="button"
                    accessibilityLabel={t('siteRules.changeScopeLabel', { scope: scopeLabel(parsed.scope.kind) })}
                  >
                    {t('siteRules.changeScope', { scope: scopeLabel(parsed.scope.kind) })}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
      <Pressable
        onPress={addRule}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t('siteRules.add')}</Text>
      </Pressable>
      <View style={styles.pair}>
        <Pressable
          onPress={exportAll}
          disabled={!siteRules.rules.length}
          style={({ pressed }) => [styles.button, styles.half, pressed && styles.pressed, !siteRules.rules.length && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !siteRules.rules.length }}
        >
          <Text style={styles.buttonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t('siteRules.export')}
          </Text>
        </Pressable>
        <Pressable
          onPress={importFile}
          style={({ pressed }) => [styles.button, styles.half, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t('siteRules.import')}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{t('siteRules.exportHint')}</Text>
    </View>
  );
}

/** A site key from what the user typed: a site, "*.site", or an address. */
function siteFromText(text: string): string | null {
  const raw = text.trim();
  if (/^https?:\/\//i.test(raw)) return parseScope(raw)?.host ?? null;
  return siteHost(raw.replace(/^\*\./, '').replace(/\/.*$/, ''));
}

function scopeFrom(url: string, kind: ScopeKind): Scope | null {
  const page = parseScope(url);
  if (!page || page.kind !== 'page') return null;
  if (kind === 'page') return page;
  if (kind === 'path') {
    const path = page.path ?? '/';
    const bare = path.replace(/\?.*$/, '');
    return { kind, host: page.host, path: bare.endsWith('/') ? bare : bare.slice(0, bare.lastIndexOf('/') + 1) || '/' };
  }
  return { kind, host: page.host };
}

const useStyles = makeStyles((c) => ({
  section: { gap: 10, marginTop: 18 },
  heading: { fontSize: 17, fontWeight: '700', color: c.text },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 10 },
  site: { fontSize: 15, fontWeight: '600', color: c.text },
  rule: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  value: { fontSize: 14, color: c.text },
  remove: { paddingHorizontal: 4 },
  link: { fontSize: 13, color: c.tintText, fontWeight: '600', paddingVertical: 4 },
  button: { backgroundColor: c.surface, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600', color: c.tintText },
  pressed: { backgroundColor: c.pressed },
  pair: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  disabled: { opacity: 0.5 },
}));
