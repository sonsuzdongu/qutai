import { AccessibilityInfo, Text, View } from 'react-native';
import type { ScriptApproval, ScriptOffer } from '../agent/scriptTool';
import { checkScript, type ScriptFlag } from '../content/scriptCheck';
import { formatScope, parseScope, type Scope, type ScopeKind } from '../content/siteRules';
import {
  DEFAULT_SCRIPT_RUN_AT,
  DEFAULT_SCRIPT_SCOPE,
  SCRIPT_RUN_ATS,
  SCRIPT_SCOPE_KINDS,
  scriptScopeForUrl,
  scriptSeal,
  type UserScript,
} from '../content/userScripts';
import { loadScriptKey } from '../device/scriptKey';
import { t, type MessageKey } from '../i18n';
import { siteRules, SiteRuleError } from '../storage/siteRules';
import { Icon, type IconLine } from '../ui/Icon';
import { Button } from '../ui/Button';
import { makeStyles, usePalette, common } from '../ui/theme';
import { dialog } from './Dialog';
import { scriptSandbox } from './ScriptSandbox';
import { newNonce } from '../utils/ids';

/**
 * The app's side of scripts (docs/page-customisation.md › Scripts): the approval dialogs (one-off runs and kept
 * scripts), the script card in the chat, keeping a script, and the words for flags, scopes and run times.
 */

/** Script cards made in this run of the app (their token); only these offer Keep. */
const liveOffers = new Set<string>();

/** Marks a new script card as made now; returns it with its token. */
export function liveOffer(offer: ScriptOffer): ScriptOffer {
  const token = newNonce();
  liveOffers.add(token);
  return { ...offer, token };
}

export function canKeep(offer: ScriptOffer): boolean {
  return offer.state === 'ran' && !offer.incognito && !!offer.token && liveOffers.has(offer.token);
}

export function flagLines(flags: readonly ScriptFlag[]): IconLine[] {
  return flags.map((flag) => ({ icon: 'insecure' as const, text: t(`scripts.flag.${flag}` as MessageKey), tone: 'danger' as const }));
}

export function scriptScopeLabel(kind: ScopeKind): string {
  return t(`siteRules.scope.${kind}` as MessageKey);
}

export function runAtLabel(runAt: (typeof SCRIPT_RUN_ATS)[number]): string {
  return t(`scripts.runAt.${runAt}` as MessageKey);
}

/** Where a kept script runs, in words ("example.com", "pages under example.com/a/"…). */
export function scriptWhere(text: string): string {
  const scope = parseScope(text);
  if (!scope) return text;
  return scopeWords(scope);
}

export function scopeWords(scope: Scope): string {
  switch (scope.kind) {
    case 'subdomains':
      return t('scripts.where.subdomains', { site: scope.host });
    case 'site':
      return scope.host;
    case 'path':
      return t('scripts.where.path', { path: `${scope.host}${scope.path ?? '/'}` });
    case 'page':
      return t('scripts.where.page', { path: `${scope.host}${scope.path ?? '/'}` });
  }
}

/**
 * run_script: the description, where it runs, the flags in red, what an approved script can do, the code under Details.
 * `onRemember` (absent in incognito): the box "Run scripts on {site} without asking" (off, SCR-36), called on Run with
 * it ticked.
 */
export async function askScript(approval: ScriptApproval, signal: AbortSignal, onRemember?: () => void): Promise<boolean> {
  const lines: IconLine[] = [
    { icon: 'script', text: approval.description },
    approval.where === 'copy'
      ? { icon: 'shield', text: t('scripts.whereCopy') }
      : { icon: 'insecure', text: t('scripts.wherePage', { site: approval.site }), tone: 'danger' },
    ...flagLines(approval.flags),
  ];
  const notes = [
    t(approval.where === 'copy' ? 'scripts.approveBodyCopy' : 'scripts.approveBodyPage'),
    approval.incognito ? t('scripts.approveIncognito') : '',
  ].filter(Boolean);
  const result = await dialog.show({
    title: t('scripts.approveTitle', { site: approval.site }),
    lines: { lines },
    message: notes.join('\n\n'),
    details: approval.code,
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: t('scripts.run'), primary: true }],
    ...(onRemember ? { checkbox: { label: t('scripts.rememberSite', { site: approval.site }) } } : {}),
    signal,
  });
  const approved = result.button === 1;
  if (approved && onRemember && result.checked) onRemember();
  return approved;
}

/**
 * A kept script's code before it may run by itself (switching on an unapproved script, saving changed code, an
 * imported one): the checks, then the dialog with what it does and the code. Resolves with the seal on Approve.
 */
export async function approveKeptCode(entry: { name: string; scope: string; code: string }): Promise<string | null> {
  const checked = checkScript(entry.code, 'kept');
  if (!checked.ok) {
    await dialog.show({
      title: t('scripts.refusedTitle'),
      message: t('scripts.refusedBody'),
      details: checked.problems.join('\n'),
      buttons: [{ text: t('common.ok'), primary: true }],
    });
    return null;
  }
  const syntax = await scriptSandbox.check(checked.code);
  if (syntax) {
    await dialog.show({
      title: t('scripts.refusedTitle'),
      message: t('scripts.syntaxBody'),
      details: syntax,
      buttons: [{ text: t('common.ok'), primary: true }],
    });
    return null;
  }
  const key = await loadScriptKey();
  if (!key) {
    await dialog.alert(t('scripts.refusedTitle'), t('scripts.noKey'));
    return null;
  }
  const result = await dialog.show({
    title: t('scripts.approveKeptTitle', { where: scriptWhere(entry.scope) }),
    lines: { lines: [{ icon: 'script', text: entry.name }, ...flagLines(checked.flags)] },
    message: t('scripts.approveKeptBody'),
    details: checked.code,
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: t('scripts.approve'), primary: true }],
  });
  return result.button === 1 ? scriptSeal(checked.code, key) : null;
}

/** Switches a kept script on, asking first when its code isn't approved on this phone. */
export async function switchScriptOn(script: UserScript, sealed: boolean): Promise<void> {
  if (sealed) return siteRules.updateScript(script.id, { enabled: true });
  const seal = await approveKeptCode(script);
  if (!seal) return;
  await siteRules.updateScript(script.id, { seal, enabled: true });
}

/**
 * "Keep for this site…" on the script card: where (never everywhere) and when, then into "My rules" with the seal of
 * the code the user just approved on this site. Never from an incognito tab.
 */
export async function keepScript(offer: ScriptOffer): Promise<boolean> {
  if (!canKeep(offer)) return false;
  const where = await dialog.show({
    title: t('scripts.keepTitle'),
    message: t('scripts.keepBody'),
    choices: {
      label: t('siteRules.scopeLabel'),
      options: SCRIPT_SCOPE_KINDS.map(scriptScopeLabel),
      initial: SCRIPT_SCOPE_KINDS.indexOf(DEFAULT_SCRIPT_SCOPE),
    },
    buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('siteRules.next'), primary: true }],
  });
  if (where.button !== 1) return false;
  const when = await dialog.show({
    title: t('scripts.keepTitle'),
    choices: { label: t('scripts.whenLabel'), options: SCRIPT_RUN_ATS.map(runAtLabel), initial: SCRIPT_RUN_ATS.indexOf(DEFAULT_SCRIPT_RUN_AT) },
    buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('scripts.keep'), primary: true }],
  });
  if (when.button !== 1 || !canKeep(offer)) return false;
  const scope = scriptScopeForUrl(offer.url, SCRIPT_SCOPE_KINDS[where.choice] ?? DEFAULT_SCRIPT_SCOPE);
  const key = await loadScriptKey();
  if (!scope || !key) {
    dialog.alert(t('scripts.failedTitle'), key ? t('scripts.invalid') : t('scripts.noKey'));
    return false;
  }
  try {
    await siteRules.addScript({
      name: offer.description,
      scope: formatScope(scope),
      code: offer.code,
      runAt: SCRIPT_RUN_ATS[when.choice] ?? DEFAULT_SCRIPT_RUN_AT,
      site: scope.host,
      source: 'assistant',
      seal: scriptSeal(offer.code, key),
      url: offer.url,
    });
  } catch (e) {
    dialog.alert(t('scripts.failedTitle'), e instanceof SiteRuleError && e.code === 'tooMany' ? t('scripts.tooMany') : t('scripts.invalid'));
    return false;
  }
  liveOffers.delete(offer.token!);
  AccessibilityInfo.announceForAccessibility(t('scripts.kept'));
  return true;
}

/** The script card: what ran, what it may do, and Keep for this site… (not in incognito). */
export function ScriptCard({ offer, dark, onKeep }: { offer: ScriptOffer; dark?: boolean; onKeep: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <View style={styles.row}>
        <Icon name="script" size={18} color={palette.tintText} />
        <Text style={[styles.status, dark && styles.textDark]}>
          {t(offer.state === 'kept' ? 'scripts.cardKept' : 'scripts.cardRan', { site: offer.site })}
        </Text>
      </View>
      <Text style={[styles.text, dark && styles.textDark]}>{offer.description}</Text>
      {offer.state === 'ran' && offer.incognito && <Text style={styles.hint}>{t('scripts.cardIncognito')}</Text>}
      {canKeep(offer) && (
        <Button
          variant="secondary"
          label={t('scripts.keepFor')}
          onPress={onKeep}
          style={styles.grow}
          icon={<Icon name="script" size={16} color={palette.tintText} />}
          accessibilityLabel={t('scripts.keepLabel', { description: offer.description })}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { ...common(c).card, padding: 14, gap: 8, alignSelf: 'stretch' },
  grow: { flexGrow: 1 },
  cardDark: { backgroundColor: '#2a2930' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flex: 1, fontSize: 14, fontWeight: '600', color: c.textSecondary },
  text: { fontSize: 15, color: c.text, lineHeight: 21 },
  textDark: { color: '#f2f1ee' },
  hint: common(c).hint,
}));
