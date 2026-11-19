import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import type { Browser } from '../browser/Browser';
import { pageStyleState } from '../browser/pageStyleState';
import type { Tab } from '../browser/Tab';
import type { CookieDeleteApproval, StyleApproval } from '../agent/pageCustomTool';
import { formatStyleScope, STYLE_SCOPE_KINDS, styleScopeForUrl, styleSite, stylesFor, trialStyleScript } from '../content/userStyles';
import { t, type MessageKey } from '../i18n';
import { siteRules, SiteRuleError } from '../storage/siteRules';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { dialog } from './Dialog';
import type { IconLine } from '../ui/Icon';
import { WholeWordsText } from './WholeWordsText';

/**
 * The app's side of user styles and the cookie list (docs/page-customisation.md): the approval dialogs, the trial
 * style on a tab, keeping it, and the two chat cards.
 */

/** A style the assistant applied after the user's approval (the 'style' chat card). */
export type StyleOffer = {
  description: string;
  site: string;
  /** The page it was approved on (without its fragment). */
  url: string;
  css: string;
  tabId: string;
  incognito: boolean;
  state: 'applied' | 'kept' | 'undone';
};

/** The 'cookies' chat card: opens the Cookies view of the tab. */
export type CookiesOffer = { site: string; count: number; tabId: string };

export const DEFAULT_STYLE_SCOPE_INDEX = STYLE_SCOPE_KINDS.indexOf('subdomains');

export function styleScopeLabel(kind: (typeof STYLE_SCOPE_KINDS)[number]): string {
  return kind === 'all' ? t('styles.scope.all') : t(`siteRules.scope.${kind}` as MessageKey);
}

/** restyle_page: what it changes in plain words, the site, the CSS under Details; every time, never "don't ask again". */
export async function askStyle(approval: StyleApproval, signal: AbortSignal): Promise<boolean> {
  const notes = [t('styles.approveBody'), approval.incognito ? t('styles.approveIncognito') : ''].filter(Boolean);
  const result = await dialog.show({
    title: t('styles.approveTitle', { site: approval.site }),
    lines: { lines: [{ icon: 'palette', text: approval.description }] },
    message: notes.join('\n\n'),
    details: approval.css,
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: t('styles.apply'), primary: true }],
    signal,
  });
  return result.button === 1;
}

/** page_cookies delete: which cookies, and that the user may be signed out; every time. */
export async function askCookieDelete(approval: CookieDeleteApproval, signal: AbortSignal): Promise<boolean> {
  const lines: IconLine[] = [
    { icon: 'cookies', text: t('cookies.deleteListed', { count: approval.cookies.length }) },
    ...approval.cookies.slice(0, 20).map((c) => ({ text: `${c.name} · ${c.domain}` })),
  ];
  const result = await dialog.show({
    title: t('cookies.deleteAllTitle', { site: approval.site }),
    lines: { lines },
    message: t('cookies.deleteBody', { site: approval.site }),
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: t('cookies.delete'), style: 'destructive' }],
    signal,
  });
  return result.button === 1;
}

/** Applies an approved style to the tab's page now; a later page load drops it. "Styles off" is switched back on. */
export function applyTrial(tab: Tab, css: string, description: string) {
  pageStyleState.setOff(tab.id, false);
  pageStyleState.setTrial(tab.id, { css, description, url: tab.url.replace(/#.*$/, '') });
  tab.webview?.injectJavaScript(trialStyleScript(css, siteRules.pageStyles, false));
}

export function undoTrial(tab: Tab): boolean {
  const had = !!pageStyleState.trial(tab.id);
  pageStyleState.setTrial(tab.id, null);
  tab.webview?.injectJavaScript(trialStyleScript('', siteRules.pageStyles, pageStyleState.off(tab.id)));
  return had;
}

/** Whether any user style (kept or tried) applies to the tab's page now: the page menu then offers "Styles off". */
export function stylesApply(tab: Tab): boolean {
  if (pageStyleState.trial(tab.id)) return true;
  return stylesFor(siteRules.styles, tab.url).length > 0;
}

/**
 * "Keep…" on the style card: where it applies, then into "My rules", named after its description (renamed there).
 * No text field here: on a phone its keyboard would cover the dialog's explanation. Never from an incognito tab.
 */
export async function keepStyle(offer: StyleOffer, browser: Browser): Promise<boolean> {
  if (offer.incognito) return false;
  const result = await dialog.show({
    title: t('styles.keepTitle'),
    message: t('styles.keepBody'),
    choices: { label: t('siteRules.scopeLabel'), options: STYLE_SCOPE_KINDS.map(styleScopeLabel), initial: DEFAULT_STYLE_SCOPE_INDEX },
    buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('styles.keep'), primary: true }],
  });
  if (result.button !== 1) return false;
  const kind = STYLE_SCOPE_KINDS[result.choice] ?? 'subdomains';
  const scope = styleScopeForUrl(offer.url, kind);
  if (!scope) return false;
  try {
    await siteRules.addStyle({
      name: offer.description,
      scope: formatStyleScope(scope),
      css: offer.css,
      site: styleSite(scope, offer.site),
      source: 'assistant',
      url: offer.url,
    });
  } catch (e) {
    dialog.alert(t('styles.failedTitle'), e instanceof SiteRuleError && e.code === 'tooMany' ? t('styles.tooMany') : t('styles.invalid'));
    return false;
  }
  // The kept style now comes from the store: the trial would apply it twice.
  const tab = browser.getTab(offer.tabId);
  if (tab) undoTrial(tab);
  AccessibilityInfo.announceForAccessibility(t('styles.kept'));
  return true;
}

export function undoOffer(offer: StyleOffer, browser: Browser) {
  const tab = browser.getTab(offer.tabId);
  if (tab) undoTrial(tab);
  AccessibilityInfo.announceForAccessibility(t('styles.undone'));
}

/** The style card in the chat: what changed, Keep… and Undo while it is tried; the outcome afterwards. */
export function StyleCard({
  offer,
  dark,
  onKeep,
  onUndo,
}: {
  offer: StyleOffer;
  dark?: boolean;
  onKeep: () => void;
  onUndo: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const status =
    offer.state === 'kept' ? t('styles.cardKept') : offer.state === 'undone' ? t('styles.cardUndone') : t('styles.cardApplied');
  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <View style={styles.row}>
        <Icon name="palette" size={18} color={palette.tintText} />
        <Text style={[styles.status, dark && styles.textDark]}>{status}</Text>
      </View>
      <Text style={[styles.text, dark && styles.textDark]}>{offer.description}</Text>
      {offer.state === 'applied' && offer.incognito && <Text style={styles.hint}>{t('styles.cardIncognito')}</Text>}
      {offer.state === 'applied' && (
        <View style={styles.buttons}>
          {!offer.incognito && (
            <Pressable
              onPress={onKeep}
              style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('styles.keepLabel', { description: offer.description })}
            >
              <WholeWordsText style={styles.primaryText}>{t('styles.keepFor')}</WholeWordsText>
            </Pressable>
          )}
          <Pressable
            onPress={onUndo}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('styles.undoLabel', { description: offer.description })}
          >
            <Icon name="undo" size={16} color={palette.tintText} />
            <WholeWordsText style={styles.secondaryText}>{t('styles.undo')}</WholeWordsText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** The cookies card in the chat: how many, and "Show cookies" (the values are only in that view). */
export function CookiesCard({ offer, dark, onShow }: { offer: CookiesOffer; dark?: boolean; onShow: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <View style={styles.row}>
        <Icon name="cookies" size={18} color={palette.tintText} />
        <Text style={[styles.status, dark && styles.textDark]}>{t('cookies.cardTitle', { site: offer.site, count: offer.count })}</Text>
      </View>
      <Pressable
        onPress={onShow}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('cookies.showLabel', { site: offer.site })}
      >
        <Icon name="cookies" size={16} color={palette.tintText} />
        <WholeWordsText style={styles.secondaryText}>{t('cookies.show')}</WholeWordsText>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 14, gap: 8, alignSelf: 'stretch' },
  cardDark: { backgroundColor: '#2a2930' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flex: 1, fontSize: 14, fontWeight: '600', color: c.textSecondary },
  text: { fontSize: 15, color: c.text, lineHeight: 21 },
  textDark: { color: '#f2f1ee' },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { flexGrow: 1, backgroundColor: c.tint, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  primaryPressed: { opacity: 0.85 },
  primaryText: { color: c.onTint, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  secondary: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: c.sunken,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryText: { color: c.tintText, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  pressed: { backgroundColor: c.pressed },
}));
