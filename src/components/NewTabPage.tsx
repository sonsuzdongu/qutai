import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Aurora } from '../ui/Aurora';
import { GradientText } from '../ui/BrandGradient';
import { siteColor } from '../ui/siteColor';
import { Icon } from '../ui/Icon';
import { QutaiMark } from '../ui/QutaiMark';
import { makeStyles, readableColumn, radii, common, usePalette } from '../ui/theme';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { incognitoInfoKey } from '../device/webviewProfile';
import { getLanguage, t, type Language } from '../i18n';
import { hostOf } from '../i18n/format';
import { Bookmark, listBookmarks, onBookmarksChanged } from '../storage/bookmarks';
import { getDb } from '../storage/db';
import { HistoryEntry, listHistory, onHistoryRemoved } from '../storage/history';
import { hideTopSite, TopSite, topSites } from '../storage/topSites';
import { dialog } from './Dialog';
import type { LibraryTab } from './LibraryScreen';
import { MyAppsSection } from './MyApps';
import { reportStorageFailure } from '../storage/failures';

type Props = {
  incognito: boolean;
  darkMode?: boolean;
  /** Data is refreshed each time the page comes on screen. */
  active: boolean;
  onNavigate: (url: string) => void;
  /** "My apps": asks the assistant for a first app. */
  onAskForApp: () => void;
  onOpenLibrary: (tab: LibraryTab) => void;
};

/** Shown until the user has history of their own. */
function defaultSites(): TopSite[] {
  const local = LOCAL_SITES[getLanguage()];
  const site = (url: string, title: string): TopSite => ({ host: hostOf(url), url, title, visits: 0 });
  return [
    site('https://www.google.com/', 'Google'),
    site('https://www.youtube.com/', 'YouTube'),
    site(`https://${local.wiki}.wikipedia.org/`, local.wikipedia),
    site(local.hl ? `https://news.google.com/?hl=${local.hl}` : 'https://news.google.com/', local.news),
  ];
}

/** Wikipedia and Google News in the app's language, under their own names there. */
const LOCAL_SITES: Record<Language, { wiki: string; wikipedia: string; hl: string; news: string }> = {
  en: { wiki: 'en', wikipedia: 'Wikipedia', hl: '', news: 'Google News' },
  tr: { wiki: 'tr', wikipedia: 'Vikipedi', hl: 'tr', news: 'Google Haberler' },
  de: { wiki: 'de', wikipedia: 'Wikipedia', hl: 'de', news: 'Google News' },
  es: { wiki: 'es', wikipedia: 'Wikipedia', hl: 'es', news: 'Google Noticias' },
  'pt-BR': { wiki: 'pt', wikipedia: 'Wikipédia', hl: 'pt-BR', news: 'Google Notícias' },
  fr: { wiki: 'fr', wikipedia: 'Wikipédia', hl: 'fr', news: 'Google Actualités' },
  ja: { wiki: 'ja', wikipedia: 'ウィキペディア', hl: 'ja', news: 'Google ニュース' },
  ko: { wiki: 'ko', wikipedia: '위키백과', hl: 'ko', news: 'Google 뉴스' },
  ru: { wiki: 'ru', wikipedia: 'Википедия', hl: 'ru', news: 'Google Новости' },
  id: { wiki: 'id', wikipedia: 'Wikipedia', hl: 'id', news: 'Google Berita' },
};

type Data = { sites: TopSite[]; bookmarks: Bookmark[]; recent: HistoryEntry[] };

export function NewTabPage({ incognito, darkMode, active, onNavigate, onAskForApp, onOpenLibrary }: Props) {
  // Incognito is always dark, whatever the app's appearance.
  const styles = useStyles(incognito);
  const [data, setData] = useState<Data | null>(null);
  const [reload, setReload] = useState(0);
  // Bookmarks the assistant adds or removes show at once.
  useEffect(() => onBookmarksChanged(() => setReload((n) => n + 1)), []);
  // Visits deleted in the Library (or by clearing data) leave the recent list and the top sites at once (UI-70).
  useEffect(() => onHistoryRemoved(() => setReload((n) => n + 1)), []);
  const [recentOpen, setRecentOpen] = useRecentOpen();

  useEffect(() => {
    // Incognito never shows anything from history or bookmarks.
    if (!active || incognito) return;
    let cancelled = false;
    getDb()
      .then(async (db) => {
        const [sites, bookmarks, recent] = await Promise.all([
          topSites(db),
          // Top-level bookmarks only (where the page menu adds them), so a big import doesn't take over.
          listBookmarks(db, { folderId: null }),
          listHistory(db, { limit: 5 }),
        ]);
        return { sites: sites.length ? sites : defaultSites(), bookmarks: bookmarks.slice(0, 5), recent };
      })
      .catch((e): Data => {
        reportStorageFailure('newTab.load', e, 'record');
        return { sites: defaultSites(), bookmarks: [], recent: [] };
      })
      .then((loaded) => !cancelled && setData(loaded));
    return () => {
      cancelled = true;
    };
  }, [active, incognito, reload]);

  const removeSite = (site: TopSite) => {
    if (site.visits === 0) return;
    dialog.alert(t('newTab.removeSite', { title: site.title || site.host }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('newTab.remove'),
        style: 'destructive',
        onPress: () =>
          getDb()
            .then((db) => hideTopSite(db, site.host))
            .then(() => setReload((n) => n + 1))
            .catch((e) => reportStorageFailure('newTab.hideSite', e, 'user')),
      },
    ]);
  };

  const darkUI = incognito || !!darkMode;
  const theme = darkUI ? dark : light;

  return (
    <View style={[styles.flex, theme.page]}>
      {/* Incognito keeps its own plain look. */}
      {!incognito && <Aurora base={darkUI ? '#1c1b22' : '#f5f4ef'} dark={darkUI} fade={0.5} animate={active} />}
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {incognito ? (
          <View style={styles.logoRow}>
            <Icon name="incognito" size={40} color="#f2f1f5" />
          </View>
        ) : (
          <View style={styles.logoRow} accessible accessibilityRole="header" accessibilityLabel="Qutai">
            <QutaiMark size={34} sweepWhenIdle animate={active} />
            <GradientText style={styles.logo} dark={darkUI}>
              Qutai
            </GradientText>
          </View>
        )}

        {/* No search box here: the address bar is the one place to type (UI-53). */}

        {incognito ? (
          <View style={[styles.card, theme.card]}>
            <Text style={[styles.cardTitle, theme.text]}>{t('newTab.incognitoTitle')}</Text>
            <Text style={[styles.cardBody, theme.dim]}>
              {t('tabs.incognitoInfo')}{' '}
              {t(incognitoInfoKey())}
            </Text>
          </View>
        ) : (
          data && (
            <>
              <View style={styles.grid}>
                {data.sites.map((site) => (
                  <Pressable
                    accessibilityRole="button"
                    key={site.host}
                    style={styles.tile}
                    onPress={() => onNavigate(site.url)}
                    onLongPress={() => removeSite(site)}
                    accessibilityLabel={site.title || site.host}
                  >
                    <View style={[styles.tileIcon, { backgroundColor: siteColor(site.host) }]}>
                      <Text style={styles.tileLetter}>{(site.host[0] || '?').toUpperCase()}</Text>
                    </View>
                    <Text style={styles.tileTitle} numberOfLines={1}>
                      {site.title || site.host}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* The user's own apps (docs/mini-apps.md); never in incognito, like history and bookmarks. */}
              <MyAppsSection active={active} dark={darkUI} onAskForApp={onAskForApp} />

              {data.bookmarks.length > 0 && (
                <Section title={t('library.bookmarks')} onSeeAll={() => onOpenLibrary('bookmarks')}>
                  {data.bookmarks.map((b) => (
                    <LinkRow key={b.url} title={b.title} url={b.url} onPress={() => onNavigate(b.url)} />
                  ))}
                </Section>
              )}

              {data.recent.length > 0 && (
                <Section
                  title={t('newTab.recent')}
                  onSeeAll={() => onOpenLibrary('history')}
                  open={recentOpen === true}
                  onToggle={() => setRecentOpen(!recentOpen)}
                >
                  {recentOpen === true &&
                    data.recent.map((h) => (
                      <LinkRow key={h.id} title={h.title} url={h.url} onPress={() => onNavigate(h.url)} />
                    ))}
                </Section>
              )}
            </>
          )
        )}
      </ScrollView>
    </View>
  );
}

/** Stored on the phone: whether "Recently visited" is open (UI-70); open until the user closes it. */
const RECENT_OPEN_KEY = 'newtab_recent_open';

// One value for every new tab page (several tabs can show one), read once per launch. Until it is read the list is
// not drawn, so a closed section never flashes open at start.
let recentOpen: boolean | null = null;
const recentListeners = new Set<() => void>();
const setRecentOpenValue = (open: boolean) => {
  recentOpen = open;
  recentListeners.forEach((l) => l());
};
SecureStore.getItemAsync(RECENT_OPEN_KEY)
  .then((v) => recentOpen === null && setRecentOpenValue(v !== '0'))
  .catch(() => recentOpen === null && setRecentOpenValue(true));

function useRecentOpen(): [boolean | null, (open: boolean) => void] {
  const open = useSyncExternalStore(
    (l) => {
      recentListeners.add(l);
      return () => {
        recentListeners.delete(l);
      };
    },
    () => recentOpen,
  );
  const set = (next: boolean) => {
    setRecentOpenValue(next);
    SecureStore.setItemAsync(RECENT_OPEN_KEY, next ? '1' : '0').catch(() => {});
  };
  return [open, set];
}

function Section({
  title,
  onSeeAll,
  open,
  onToggle,
  children,
}: {
  title: string;
  onSeeAll: () => void;
  /** With onToggle: the title row opens and closes the section. */
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {onToggle ? (
          <Pressable
            onPress={onToggle}
            hitSlop={8}
            style={styles.sectionToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: !!open }}
            accessibilityLabel={title}
          >
            <Text style={styles.sectionTitle}>{title}</Text>
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={palette.textSecondary} />
          </Pressable>
        ) : (
          <Text style={styles.sectionTitle}>{title}</Text>
        )}
        <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
          <Text style={styles.seeAll}>{t('newTab.seeAll')}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function LinkRow({ title, url, onPress }: { title: string; url: string; onPress: () => void }) {
  const styles = useStyles();
  const host = hostOf(url);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
      <View style={[styles.linkIcon, { backgroundColor: siteColor(host) }]}>
        <Text style={styles.linkLetter}>{(host[0] || '?').toUpperCase()}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.linkTitle} numberOfLines={1}>
          {title || host}
        </Text>
        <Text style={styles.linkHost} numberOfLines={1}>
          {host}
        </Text>
      </View>
    </Pressable>
  );
}

/** A stable colour per site, so tiles are recognisable without loading favicons from third parties. */

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  content: { ...readableColumn, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40, gap: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  askInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dimmed: { opacity: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  tile: { width: '25%', alignItems: 'center', gap: 6 },
  tileIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLetter: { color: c.onTint, fontSize: 22, fontWeight: '700' },
  tileTitle: { fontSize: 12, color: c.text, maxWidth: '90%' },
  section: { ...common(c).card, paddingVertical: 6 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { fontSize: 13, color: c.tintText, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  pressed: { backgroundColor: c.pressed },
  linkIcon: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  linkLetter: { color: c.onTint, fontSize: 13, fontWeight: '700' },
  linkTitle: { fontSize: 14, color: c.text },
  linkHost: { fontSize: 12, color: c.textSecondary },
  card: { borderRadius: radii.card, padding: 16, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardBody: { fontSize: 14, lineHeight: 20 },
}));

const light = StyleSheet.create({
  page: { backgroundColor: '#f5f4ef' },
  logo: { color: '#1460b4' },
  text: { color: '#222' },
  dim: { color: '#6b6862' },
  card: { backgroundColor: '#fff' },
});

const dark = StyleSheet.create({
  page: { backgroundColor: '#1c1b22' },
  logo: { color: '#f2f1f5' },
  text: { color: '#f2f1f5' },
  dim: { color: '#a9a8b3' },
  card: { backgroundColor: '#2b2a33' },
});
