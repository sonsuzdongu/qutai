import { ReactNode, useEffect, useState } from 'react';
import { Aurora } from '../ui/Aurora';
import { GradientButton, GradientText } from '../ui/BrandGradient';
import { siteColor } from '../ui/siteColor';
import { Icon } from '../ui/Icon';
import { QutaiMark } from '../ui/QutaiMark';
import { makeStyles } from '../ui/theme';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SearchEngineId } from '../browser/search';
import { toUrl } from '../browser/url';
import { getLanguage, t } from '../i18n';
import { hostOf } from '../i18n/format';
import { Bookmark, listBookmarks } from '../storage/bookmarks';
import { getDb } from '../storage/db';
import { HistoryEntry, listHistory } from '../storage/history';
import { hideTopSite, TopSite, topSites } from '../storage/topSites';
import type { LibraryTab } from './LibraryScreen';

type Props = {
  incognito: boolean;
  darkMode?: boolean;
  searchEngine: SearchEngineId;
  /** Data is refreshed each time the page comes on screen. */
  active: boolean;
  onNavigate: (url: string) => void;
  onAsk: (text: string) => void;
  onOpenLibrary: (tab: LibraryTab) => void;
};

/** Shown until the user has history of their own. */
function defaultSites(): TopSite[] {
  const tr = getLanguage() === 'tr';
  const site = (url: string, title: string): TopSite => ({ host: hostOf(url), url, title, visits: 0 });
  return [
    site('https://www.google.com/', 'Google'),
    site('https://www.youtube.com/', 'YouTube'),
    tr ? site('https://tr.wikipedia.org/', 'Vikipedi') : site('https://en.wikipedia.org/', 'Wikipedia'),
    tr ? site('https://news.google.com/?hl=tr', 'Google Haberler') : site('https://news.google.com/', 'Google News'),
  ];
}

type Data = { sites: TopSite[]; bookmarks: Bookmark[]; recent: HistoryEntry[] };

export function NewTabPage({ incognito, darkMode, searchEngine, active, onNavigate, onAsk, onOpenLibrary }: Props) {
  // Incognito is always dark, whatever the app's appearance.
  const styles = useStyles(incognito);
  const [text, setText] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [reload, setReload] = useState(0);

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
      .catch((): Data => ({ sites: defaultSites(), bookmarks: [], recent: [] }))
      .then((loaded) => !cancelled && setData(loaded));
    return () => {
      cancelled = true;
    };
  }, [active, incognito, reload]);

  const submit = () => {
    if (text.trim()) onNavigate(toUrl(text, searchEngine));
  };
  // With nothing typed, it opens the assistant to type there.
  const ask = () => {
    onAsk(text.trim());
    setText('');
  };

  const removeSite = (site: TopSite) => {
    if (site.visits === 0) return;
    Alert.alert(t('newTab.removeSite', { title: site.title || site.host }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('newTab.remove'),
        style: 'destructive',
        onPress: () =>
          getDb()
            .then((db) => hideTopSite(db, site.host))
            .then(() => setReload((n) => n + 1))
            .catch(() => {}),
      },
    ]);
  };

  const darkUI = incognito || !!darkMode;
  const theme = darkUI ? dark : light;

  return (
    <View style={[styles.flex, theme.page]}>
      {/* Incognito keeps its own plain look. */}
      {!incognito && <Aurora base={darkUI ? '#1c1b22' : '#f5f4ef'} dark={darkUI} fade={0.5} />}
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

        <View style={[styles.searchRow, theme.search]}>
          <TextInput
            style={[styles.searchInput, theme.text]}
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder={t('address.placeholder')}
            placeholderTextColor={darkUI ? '#a9a8b3' : '#6b6862'}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          <GradientButton
            label={t('newTab.ask')}
            onPress={ask}
            style={styles.askButton}
            textStyle={styles.askText}
            icon={<Icon name="assistant" size={15} color="#ffffff" />}
          />
        </View>

        {incognito ? (
          <View style={[styles.card, theme.card]}>
            <Text style={[styles.cardTitle, theme.text]}>{t('newTab.incognitoTitle')}</Text>
            <Text style={[styles.cardBody, theme.dim]}>
              {t('tabs.incognitoInfo')}{' '}
              {t(Platform.OS === 'ios' ? 'tabs.incognitoInfoIos' : 'tabs.incognitoInfoAndroid')}
            </Text>
          </View>
        ) : (
          data && (
            <>
              <View style={styles.grid}>
                {data.sites.map((site) => (
                  <Pressable
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

              {data.bookmarks.length > 0 && (
                <Section title={t('library.bookmarks')} onSeeAll={() => onOpenLibrary('bookmarks')}>
                  {data.bookmarks.map((b) => (
                    <LinkRow key={b.url} title={b.title} url={b.url} onPress={() => onNavigate(b.url)} />
                  ))}
                </Section>
              )}

              {data.recent.length > 0 && (
                <Section title={t('newTab.recent')} onSeeAll={() => onOpenLibrary('history')}>
                  {data.recent.map((h) => (
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

function Section({ title, onSeeAll, children }: { title: string; onSeeAll: () => void; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
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
  content: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40, gap: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  askInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 5,
    height: 48,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  askButton: {
    borderRadius: 19,
    paddingHorizontal: 12,
    height: 38,
    justifyContent: 'center',
  },
  askText: { color: c.onTint, fontWeight: '600', fontSize: 14 },
  dimmed: { opacity: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  tile: { width: '25%', alignItems: 'center', gap: 6 },
  tileIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLetter: { color: c.onTint, fontSize: 22, fontWeight: '700' },
  tileTitle: { fontSize: 12, color: c.text, maxWidth: '90%' },
  section: { backgroundColor: c.surface, borderRadius: 16, paddingVertical: 6 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  seeAll: { fontSize: 13, color: c.tintText, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  pressed: { backgroundColor: c.pressed },
  linkIcon: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  linkLetter: { color: c.onTint, fontSize: 13, fontWeight: '700' },
  linkTitle: { fontSize: 14, color: c.text },
  linkHost: { fontSize: 12, color: c.textSecondary },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardBody: { fontSize: 14, lineHeight: 20 },
}));

const light = StyleSheet.create({
  page: { backgroundColor: '#f5f4ef' },
  logo: { color: '#1460b4' },
  search: { backgroundColor: '#fff' },
  text: { color: '#222' },
  dim: { color: '#6b6862' },
  card: { backgroundColor: '#fff' },
});

const dark = StyleSheet.create({
  page: { backgroundColor: '#1c1b22' },
  logo: { color: '#f2f1f5' },
  search: { backgroundColor: '#2b2a33' },
  text: { color: '#f2f1f5' },
  dim: { color: '#a9a8b3' },
  card: { backgroundColor: '#2b2a33' },
});
