import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { groupByDay, hostOf, timeLabel } from '../i18n/format';
import { Bookmark, listBookmarks, removeBookmark } from '../storage/bookmarks';
import { getDb } from '../storage/db';
import { clearHistory, deleteHistoryEntry, HistoryEntry, listHistory } from '../storage/history';

export type LibraryTab = 'bookmarks' | 'history';

type Props = {
  visible: boolean;
  initialTab: LibraryTab;
  onOpen: (url: string) => void;
  onClose: () => void;
};

const PAGE_SIZE = 60;

/** Bookmarks and history in one screen, like the library in mobile browsers. */
export function LibraryScreen({ visible, initialTab, onOpen, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Mounted only while visible, so it always opens fresh on the requested tab. */}
      {visible && <LibraryContent initialTab={initialTab} onOpen={onOpen} onClose={onClose} />}
    </Modal>
  );
}

function LibraryContent({ initialTab, onOpen, onClose }: Omit<Props, 'visible'>) {
  const styles = useStyles();
  const [tab, setTab] = useState<LibraryTab>(initialTab);
  const [query, setQuery] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.segment}>
          {(['bookmarks', 'history'] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.segmentButton, tab === id && styles.segmentSelected]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === id }}
            >
              <Text style={[styles.segmentText, tab === id && styles.bold]}>{t(`library.${id}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={[styles.action, styles.bold]}>{t('common.done')}</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('library.search')}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      {tab === 'history' ? (
        <HistoryList query={query} onOpen={onOpen} />
      ) : (
        <BookmarkList query={query} onOpen={onOpen} />
      )}
    </SafeAreaView>
  );
}

function HistoryList({ query, onOpen }: { query: string; onOpen: (url: string) => void }) {
  const styles = useStyles();
  // `loadedQuery` tells which search the entries belong to; while it differs from `query`, a load is running.
  const [result, setResult] = useState<{ loadedQuery: string | null; entries: HistoryEntry[]; done: boolean }>({
    loadedQuery: null,
    entries: [],
    done: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const { entries, done } = result;
  const loading = result.loadedQuery !== query || loadingMore;

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then((db) => listHistory(db, { query, limit: PAGE_SIZE }))
      .catch(() => [] as HistoryEntry[])
      .then((page) => {
        if (!cancelled) setResult({ loadedQuery: query, entries: page, done: page.length < PAGE_SIZE });
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const loadMore = async () => {
    if (loading || done || entries.length === 0) return;
    setLoadingMore(true);
    try {
      const db = await getDb();
      const page = await listHistory(db, { query, limit: PAGE_SIZE, before: entries[entries.length - 1].visitedAt });
      setResult((prev) => ({ ...prev, entries: [...prev.entries, ...page], done: page.length < PAGE_SIZE }));
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = async (entry: HistoryEntry) => {
    await deleteHistoryEntry(await getDb(), entry.id);
    setResult((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== entry.id) }));
  };

  const clearAll = () => {
    Alert.alert(t('library.clearHistoryConfirm'), t('library.cannotUndo'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('library.clearHistory'),
        style: 'destructive',
        onPress: async () => {
          await clearHistory(await getDb());
          setResult({ loadedQuery: query, entries: [], done: true });
        },
      },
    ]);
  };

  return (
    <SectionList
      sections={groupByDay(entries, (e) => e.visitedAt)}
      keyExtractor={(e) => String(e.id)}
      stickySectionHeadersEnabled
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
      renderItem={({ item }) => (
        <Row
          title={item.title}
          url={item.url}
          meta={timeLabel(item.visitedAt)}
          onPress={() => onOpen(item.url)}
          onRemove={() => remove(item)}
        />
      )}
      onEndReached={() => {
        loadMore().catch(() => {});
      }}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        loading ? undefined : <Empty title={t(query ? 'library.noResults' : 'library.emptyHistory')} />
      }
      ListFooterComponent={
        loading ? (
          <ActivityIndicator style={styles.footer} />
        ) : entries.length > 0 && !query ? (
          <Pressable onPress={clearAll} style={styles.footer} accessibilityRole="button">
            <Text style={styles.danger}>{t('library.clearHistory')}</Text>
          </Pressable>
        ) : undefined
      }
    />
  );
}

function BookmarkList({ query, onOpen }: { query: string; onOpen: (url: string) => void }) {
  const styles = useStyles();
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then((db) => listBookmarks(db, { query }))
      .then((list) => !cancelled && setBookmarks(list))
      .catch(() => !cancelled && setBookmarks([]));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const remove = async (bookmark: Bookmark) => {
    await removeBookmark(await getDb(), bookmark.url);
    setBookmarks((prev) => prev?.filter((b) => b.url !== bookmark.url) ?? null);
  };

  if (!bookmarks) return <ActivityIndicator style={styles.footer} />;
  return (
    <FlatList
      data={bookmarks}
      keyExtractor={(b) => b.url}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <Row title={item.title} url={item.url} onPress={() => onOpen(item.url)} onRemove={() => remove(item)} />
      )}
      ListEmptyComponent={
        query ? (
          <Empty title={t('library.noResults')} />
        ) : (
          <Empty title={t('library.emptyBookmarks')} hint={t('library.emptyBookmarksHint')} />
        )
      }
    />
  );
}

function Row({
  title,
  url,
  meta,
  onPress,
  onRemove,
}: {
  title: string;
  url: string;
  meta?: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const host = hostOf(url);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{(host[0] || '?').toUpperCase()}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title || host}
        </Text>
        <Text style={styles.rowUrl} numberOfLines={1}>
          {meta ? `${meta} · ${host}` : host}
        </Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={10} style={styles.remove} accessibilityLabel={t('library.delete')}>
        <Text style={styles.removeText}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint && <Text style={styles.emptyHint}>{hint}</Text>}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 12 },
  segment: { flex: 1, flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 10, padding: 3 },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  segmentSelected: { backgroundColor: c.surface },
  segmentText: { fontSize: 14, color: c.text },
  bold: { fontWeight: '700' },
  action: { fontSize: 16, color: c.tintText },
  search: {
    marginHorizontal: 12,
    marginBottom: 8,
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    color: c.textSecondary,
    backgroundColor: c.pressed,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  pressed: { backgroundColor: c.pressed },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: c.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 15, fontWeight: '700', color: c.textSecondary },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, color: c.text },
  rowUrl: { fontSize: 12, color: c.textSecondary },
  remove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontSize: 14, color: c.textSecondary },
  footer: { paddingVertical: 20, alignItems: 'center' },
  danger: { color: c.danger, fontSize: 15, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: c.textSecondary },
  emptyHint: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },
}));
