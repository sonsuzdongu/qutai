import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Tab } from '../browser/Tab';
import { siteKey } from '../agent/sitePolicy';
import { cookieId, cookieMetadata, groupByDomain, type CookieKey, type CookieMeta, type StoreCookie } from '../content/cookieInfo';
import { deleteTabCookies, readTabCookies } from '../device/cookieStore';
import { t } from '../i18n';
import { formatDateTime } from '../i18n/format';
import { AppModal } from '../ui/AppModal';
import { Icon } from '../ui/Icon';
import { makeStyles, readableColumn, usePalette, radii, common } from '../ui/theme';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';
import { ErrorDetails } from './ErrorDetails';
import { ScreenHeader } from './ScreenHeader';
import { WholeWordsText } from './WholeWordsText';

/**
 * The Cookies view (docs/page-customisation.md › Cookies): the cookies that apply to a tab's page, from the tab's own
 * native cookie store, grouped by domain. Each value stays hidden until the user taps "Show value"; values live in
 * this screen's state only (never logged, never sent anywhere) and are dropped when it closes.
 */
export function CookiesScreen({ tab, onClose }: { tab: Tab | null; onClose: () => void }) {
  return (
    <AppModal visible={!!tab} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {tab && <Cookies tab={tab} onClose={onClose} />}
      <DialogHost />
    </AppModal>
  );
}

type Loaded = { cookies: StoreCookie[]; list: CookieMeta[]; detailed: boolean; platform: 'android' | 'ios' };

function Cookies({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const site = siteKey(tab.url) ?? '';
  const [state, setState] = useState<Loaded | 'loading' | { error: string }>('loading');
  const [shown, setShown] = useState<Set<string>>(new Set());

  // Reads the store again whenever `round` changes (Refresh, after deleting); the state changes after the read.
  const [round, setRound] = useState(0);
  useEffect(() => {
    let alive = true;
    readTabCookies(tab)
      .then((read) => {
        if (!alive) return;
        const { list } = cookieMetadata(read.cookies, site);
        setState({ cookies: read.cookies, list, detailed: read.detailed, platform: read.platform });
      })
      .catch((e) => alive && setState({ error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [tab, site, round]);
  const load = () => {
    setState('loading');
    setRound((n) => n + 1);
  };

  const valueOf = (meta: CookieMeta) =>
    typeof state === 'object' && 'cookies' in state ? (state.cookies.find((c) => cookieId(c) === cookieId(meta))?.value ?? '') : '';

  const remove = async (metas: CookieMeta[], all: boolean) => {
    const ok = await dialog.confirm({
      title: all ? t('cookies.deleteAllTitle', { site }) : t('cookies.deleteOneTitle', { name: metas[0].name }),
      message: t('cookies.deleteBody', { site }),
      confirmText: t('cookies.delete'),
      destructive: true,
    });
    if (!ok || typeof state !== 'object' || !('cookies' in state)) return;
    const keys: CookieKey[] = metas.map((m) => ({ name: m.name, domain: m.domain, path: m.path, hostOnly: null, secure: m.secure }));
    // The full key (host-only or not) comes from the store's own record.
    for (const key of keys) {
      const own = state.cookies.find((c) => cookieId(c) === cookieId(key));
      if (own) key.hostOnly = own.hostOnly;
    }
    try {
      const deleted = await deleteTabCookies(tab, keys);
      AccessibilityInfo.announceForAccessibility(t('cookies.deleted', { count: deleted }));
    } catch (e) {
      dialog.alert(t('cookies.deleteFailed'), undefined, undefined, e instanceof Error ? e.message : String(e));
    }
    setShown(new Set());
    load();
  };

  const toggle = (meta: CookieMeta) => {
    const id = cookieId(meta);
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
      <ScreenHeader
        title={t('cookies.title')}
        left={{
          label: t('cookies.reload'),
          icon: 'reload',
          iconOnly: true,
          onPress: load,
        }}
        right={{ label: t('common.done'), onPress: onClose }}
      />
      <ScrollView contentContainerStyle={[styles.content, readableColumn]}>
        <Text style={styles.site}>{site}</Text>
        <Text style={styles.hint}>
          {tab.incognito ? t('cookies.introIncognito') : t('cookies.intro')}
        </Text>
        {state === 'loading' && <ActivityIndicator style={styles.loading} color={palette.tint} />}
        {typeof state === 'object' && 'error' in state && (
          <View style={styles.card}>
            <Text style={styles.text}>{t('cookies.failed')}</Text>
            <ErrorDetails details={state.error} />
          </View>
        )}
        {typeof state === 'object' && 'list' in state && (
          <>
            {!state.list.length && <Text style={styles.text}>{t('cookies.none')}</Text>}
            {groupByDomain(state.list).map(({ domain, cookies }) => (
              <View key={domain} style={styles.card}>
                <Text style={styles.domain} accessibilityRole="header">
                  {domain}
                </Text>
                <Text style={styles.hint}>
                  {cookies[0].party === 'first' ? t('cookies.firstParty') : t('cookies.thirdParty')}
                </Text>
                {cookies.map((c) => {
                  const open = shown.has(cookieId(c));
                  return (
                    <View key={cookieId(c)} style={styles.cookie}>
                      <Text style={styles.name} selectable>
                        {c.name || t('cookies.noName')}
                      </Text>
                      <Text style={styles.hint}>{describe(c)}</Text>
                      {open && (
                        <Text style={styles.value} selectable>
                          {valueOf(c) || t('cookies.emptyValue')}
                        </Text>
                      )}
                      <View style={styles.actions}>
                        <Action
                          icon="view"
                          label={open ? t('cookies.hideValue') : t('cookies.showValue')}
                          a11y={open ? t('cookies.hideValueOf', { name: c.name }) : t('cookies.showValueOf', { name: c.name })}
                          onPress={() => toggle(c)}
                        />
                        {open && (
                          <Action
                            icon="copy"
                            label={t('cookies.copy')}
                            a11y={t('cookies.copyOf', { name: c.name })}
                            onPress={async () => {
                              await Clipboard.setStringAsync(valueOf(c));
                              AccessibilityInfo.announceForAccessibility(t('common.copied'));
                            }}
                          />
                        )}
                        <Action
                          icon="trash"
                          label={t('cookies.delete')}
                          a11y={t('cookies.deleteOf', { name: c.name })}
                          danger
                          onPress={() => void remove([c], false)}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
            {state.list.length > 0 && (
              <Pressable
                onPress={() => void remove(state.list, true)}
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <WholeWordsText style={styles.danger}>{t('cookies.deleteAll', { site })}</WholeWordsText>
              </Pressable>
            )}
            <Text style={styles.hint}>{limitsText(state)}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  function Action({ icon, label, a11y, danger, onPress }: { icon: 'view' | 'copy' | 'trash'; label: string; a11y: string; danger?: boolean; onPress: () => void }) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        hitSlop={6}
      >
        <Icon name={icon} size={16} color={danger ? palette.danger : palette.tintText} />
        <Text style={[styles.actionText, danger && styles.danger]}>{label}</Text>
      </Pressable>
    );
  }

  function describe(c: CookieMeta): string {
    const parts = [
      c.expires === null
        ? c.limited
          ? t('cookies.expiryUnknown')
          : t('cookies.session')
        : t('cookies.expires', { date: formatDateTime(new Date(c.expires)) }),
      t('cookies.path', { path: c.path }),
      t('cookies.size', { count: c.size }),
    ];
    if (c.httpOnly) parts.push('HttpOnly');
    if (c.secure) parts.push('Secure');
    if (c.sameSite) parts.push(`SameSite=${c.sameSite}`);
    return parts.join(' · ');
  }
}

function limitsText(state: Loaded): string {
  if (state.platform === 'ios') return t('cookies.limitsIos');
  return state.detailed ? t('cookies.limitsAndroid') : t('cookies.limitsAndroidOld');
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  site: { fontSize: 17, fontWeight: '700', color: c.text },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  text: { fontSize: 15, color: c.text },
  loading: { marginTop: 24 },
  card: { ...common(c).card, padding: 14, gap: 8 },
  domain: { fontSize: 15, fontWeight: '600', color: c.text },
  cookie: { gap: 4, paddingTop: 8, borderTopWidth: Platform.OS === 'ios' ? 0.5 : 1, borderTopColor: c.separator },
  name: { fontSize: 15, color: c.text, fontWeight: '600' },
  value: { fontSize: 13, color: c.text, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, borderRadius: radii.control },
  actionText: { fontSize: 14, color: c.tintText, fontWeight: '600' },
  danger: { color: c.danger, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  button: { backgroundColor: c.surface, borderRadius: radii.control, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
  pressed: { backgroundColor: c.pressed },
}));
