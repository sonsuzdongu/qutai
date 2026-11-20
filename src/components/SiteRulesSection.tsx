import { useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  blockLine,
  checkBlockDomain,
  DEFAULT_SCOPE,
  hideLine,
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
import { exportRulesFile, importRulesFile } from '../content/rulesFile';
import {
  formatStyleScope,
  parseStyleScope,
  STYLE_SCOPE_KINDS,
  styleScopeForUrl,
  styleSite,
  type StyleScope,
  type StyleScopeKind,
  type UserStyle,
} from '../content/userStyles';
import { DEFAULT_STYLE_SCOPE_INDEX, styleScopeLabel } from './pageCustomisation';
import { flagLines, scriptWhere } from './pageScripts';
import { StyleEditorScreen, type StyleDraft } from './StyleEditorScreen';
import { ScriptsPart } from './ScriptsPart';
import { pickRulesFile, RulesFileTooLargeError, shareRulesFile } from '../device/siteRulesFile';
import { t, type MessageKey } from '../i18n';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
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
    await shareRulesFile(exportRulesFile(siteRules.rules, siteRules.styles, new Date(), siteRules.scripts), `qutai-rules-${day}.txt`).catch(() =>
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
    const read = importRulesFile(text, siteRules.rules.map((r) => r.line), siteRules.styles, siteRules.scripts);
    if (!read.rules.length && !read.styles.length && !read.scripts.length && !read.duplicates) {
      return dialog.alert(t('siteRules.importFailed'), t('siteRules.importNone'));
    }
    // Styles change how pages look: the user sees them listed and decides whether they arrive switched on.
    let stylesOn = false;
    if (read.styles.length) {
      const answer = await dialog.show({
        title: t('styles.importTitle', { count: read.styles.length }),
        message: t('styles.importBody'),
        lines: {
          lines: read.styles.slice(0, 30).map((style) => ({ icon: 'palette' as const, text: `${style.name} · ${styleWhere(style.scope)}` })),
        },
        buttons: [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('styles.importOff') },
          { text: t('styles.importOn'), primary: true },
        ],
      });
      if (answer.button === null || answer.button === 0) return;
      stylesOn = answer.button === 2;
    }
    // Scripts always arrive switched off, listed with what they do; each is approved before its first run.
    let takeScripts = false;
    if (read.scripts.length) {
      const answer = await dialog.show({
        title: t('scripts.importTitle', { count: read.scripts.length }),
        message: t('scripts.importBody'),
        lines: {
          lines: read.scripts.slice(0, 30).flatMap((script) => [
            { icon: 'script' as const, text: `${script.name} · ${scriptWhere(script.scope)}` },
            ...flagLines(script.flags),
          ]),
        },
        buttons: [
          { text: t('scripts.importSkip'), style: 'cancel' },
          { text: t('scripts.importOff'), primary: true },
        ],
      });
      if (answer.button === null) return;
      takeScripts = answer.button === 1;
    }
    let added = 0;
    try {
      added = await siteRules.addImported(read.rules);
      added += await siteRules.addImportedStyles(read.styles, stylesOn);
      if (takeScripts) added += await siteRules.addImportedScripts(read.scripts);
    } catch {
      return dialog.alert(t('siteRules.importFailed'));
    }
    const skipped =
      read.duplicates + read.invalid + read.unsupported + (read.rules.length + read.styles.length + (takeScripts ? read.scripts.length : 0) - added);
    const notes = [t('siteRules.importedBody', { added, skipped }), read.unsupported ? t('styles.importUnsupported', { count: read.unsupported }) : '']
      .filter(Boolean)
      .join('\n\n');
    dialog.alert(t('siteRules.importedTitle'), notes);
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
      <StylesPart />
      <ScriptsPart />
      <View style={styles.pair}>
        <Pressable
          onPress={exportAll}
          disabled={!siteRules.rules.length && !siteRules.styles.length && !siteRules.scripts.length}
          style={({ pressed }) => [
            styles.button,
            styles.half,
            pressed && styles.pressed,
            !siteRules.rules.length && !siteRules.styles.length && !siteRules.scripts.length && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !siteRules.rules.length && !siteRules.styles.length && !siteRules.scripts.length }}
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

/** Where a style applies, in words. */
function styleWhere(text: string): string {
  const scope = parseStyleScope(text);
  if (!scope) return text;
  return scope.kind === 'all' ? t('styles.where.all') : scopeText(scope);
}

/** Picks one of the five style scopes; null when cancelled. */
async function pickStyleScope(initial: StyleScopeKind, title: string, message?: string): Promise<StyleScopeKind | null> {
  const result = await dialog.show({
    title,
    message,
    choices: { label: t('siteRules.scopeLabel'), options: STYLE_SCOPE_KINDS.map(styleScopeLabel), initial: STYLE_SCOPE_KINDS.indexOf(initial) },
    buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.save') }],
  });
  return result.button === 1 ? STYLE_SCOPE_KINDS[result.choice] : null;
}

/**
 * The user styles in "My rules" (docs/page-customisation.md): not part of ad blocking, so never greyed out with it.
 * Each with its switch, Edit (name and CSS, sanitised again), where it applies, and Delete.
 */
function StylesPart() {
  const styles = useStyles();
  const palette = usePalette();
  useSyncExternalStore(siteRules.subscribe, siteRules.getVersion);
  const [draft, setDraft] = useState<(StyleDraft & { save: (name: string, css: string) => Promise<void> }) | null>(null);
  const groups = new Map<string, UserStyle[]>();
  for (const style of siteRules.styles) {
    const key = parseStyleScope(style.scope)?.kind === 'all' ? '*' : style.site;
    groups.set(key, [...(groups.get(key) ?? []), style]);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === '*' ? -1 : b === '*' ? 1 : a.localeCompare(b)));

  const failed = (e: unknown) =>
    dialog.alert(
      t('styles.failedTitle'),
      e instanceof SiteRuleError && e.code === 'tooMany' ? t('styles.tooMany') : t('styles.invalid'),
    );

  const edit = (style: UserStyle) =>
    setDraft({
      title: t('styles.editTitle'),
      name: style.name,
      css: style.css,
      where: styleWhere(style.scope),
      save: (name, css) => siteRules.updateStyle(style.id, { name, css }),
    });

  const changeScope = async (style: UserStyle) => {
    const current = parseStyleScope(style.scope);
    if (!current) return;
    const kind = await pickStyleScope(current.kind, t('siteRules.scopeTitle'), style.name);
    if (!kind || kind === current.kind) return;
    const base = style.url ?? styleBaseUrl(current, style.site);
    const scope = base ? styleScopeForUrl(base, kind) : null;
    if (!scope) return dialog.alert(t('styles.failedTitle'), t('styles.noAddress'));
    await siteRules.updateStyle(style.id, { scope: formatStyleScope(scope) }).catch(failed);
  };

  const remove = async (style: UserStyle) => {
    const ok = await dialog.confirm({
      title: t('styles.removeTitle'),
      message: style.name,
      confirmText: t('siteRules.remove'),
      destructive: true,
    });
    if (ok) await siteRules.removeStyles([style.id]).catch(() => {});
  };

  const add = async () => {
    const siteText = await dialog.prompt({
      title: t('styles.addTitle'),
      message: t('styles.addSiteBody'),
      label: t('siteRules.siteLabel'),
      placeholder: 'example.com',
      maxLength: 300,
      confirmText: t('siteRules.next'),
    });
    if (!siteText) return;
    const site = siteFromText(siteText);
    if (!site) return dialog.alert(t('styles.failedTitle'), t('siteRules.badSite'));
    const url = /^https?:\/\//i.test(siteText.trim()) ? siteText.trim() : `https://${site}/`;
    const kind = await pickStyleScope(
      /^https?:\/\//i.test(siteText.trim()) ? 'page' : STYLE_SCOPE_KINDS[DEFAULT_STYLE_SCOPE_INDEX],
      t('siteRules.scopeTitle'),
    );
    if (!kind) return;
    const scope = styleScopeForUrl(url, kind);
    if (!scope) return;
    setDraft({
      title: t('styles.addTitle'),
      name: '',
      css: '',
      where: styleWhere(formatStyleScope(scope)),
      save: async (name, css) => {
        await siteRules.addStyle({
          name: name || styleWhere(formatStyleScope(scope)),
          scope: formatStyleScope(scope),
          css,
          site: styleSite(scope, site),
          source: 'manual',
          url,
        });
      },
    });
  };

  return (
    <View style={styles.part}>
      <Text style={styles.subheading} accessibilityRole="header">
        {t('styles.title')}
      </Text>
      <Text style={styles.hint}>{t('styles.intro')}</Text>
      {keys.map((key) => (
        <View key={key} style={styles.card}>
          <Text style={styles.site}>{key === '*' ? t('styles.where.all') : key}</Text>
          {groups.get(key)!.map((style) => (
            <View key={style.id} style={styles.rule}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.value} numberOfLines={3}>
                    {style.name}
                  </Text>
                  <Text style={styles.hint}>
                    {styleWhere(style.scope)}
                    {' · '}
                    {t(style.source === 'assistant' ? 'siteRules.byAssistant' : 'siteRules.byYou')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => remove(style)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('styles.removeLabel', { name: style.name })}
                  style={styles.remove}
                >
                  <Icon name="close" size={16} color={palette.textSecondary} />
                </Pressable>
                <ThemedSwitch
                  value={style.enabled}
                  onValueChange={(on) => siteRules.updateStyle(style.id, { enabled: on }).catch(() => {})}
                  accessibilityLabel={style.name}
                />
              </View>
              <View style={styles.links}>
                <Text
                  style={styles.link}
                  onPress={() => edit(style)}
                  accessibilityRole="button"
                  accessibilityLabel={t('styles.editLabel', { name: style.name })}
                >
                  {t('styles.edit')}
                </Text>
                <Text
                  style={styles.link}
                  onPress={() => changeScope(style)}
                  accessibilityRole="button"
                  accessibilityLabel={t('siteRules.changeScopeLabel', { scope: styleWhere(style.scope) })}
                >
                  {t('styles.changeScope')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
      {!siteRules.styles.length && <Text style={styles.hint}>{t('styles.none')}</Text>}
      <Pressable onPress={add} style={({ pressed }) => [styles.button, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.buttonText}>{t('styles.add')}</Text>
      </Pressable>
      <StyleEditorScreen
        draft={draft}
        onSave={(name, css) => (draft ? draft.save(name, css) : Promise.resolve())}
        onClose={() => setDraft(null)}
      />
    </View>
  );
}

/** A page of the style's scope, for widening or narrowing it when the page it was made on is unknown. */
function styleBaseUrl(scope: StyleScope, site: string): string | null {
  if (scope.kind === 'all') return site && site !== '*' ? `https://${site}/` : null;
  return `https://${scope.host}${scope.kind === 'page' || scope.kind === 'path' ? (scope.path ?? '/') : '/'}`;
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
  card: { ...common(c).card, padding: 14, gap: 10 },
  site: { fontSize: 15, fontWeight: '600', color: c.text },
  rule: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  value: { fontSize: 14, color: c.text },
  remove: { paddingHorizontal: 4 },
  link: { fontSize: 13, color: c.tintText, fontWeight: '600', paddingVertical: 4 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
  part: { gap: 10, marginTop: 8 },
  subheading: { fontSize: 16, fontWeight: '700', color: c.text },
  button: { backgroundColor: c.surface, borderRadius: radii.control, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600', color: c.tintText },
  pressed: { backgroundColor: c.pressed },
  pair: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  disabled: { opacity: 0.5 },
}));
