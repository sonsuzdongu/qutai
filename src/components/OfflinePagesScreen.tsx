import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { deleteOfflineFile, readOfflinePage } from '../device/offline';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { makeStyles, readableColumn, usePalette } from '../ui/theme';
import { dayLabel, formatSize, hostOf } from '../i18n/format';
import { getDb } from '../storage/db';
import { listOfflinePages, OfflinePage, removeOfflinePage } from '../storage/offlinePages';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost } from './Dialog';

type Props = { visible: boolean; onOpenLive: (url: string) => void; onClose: () => void };

/** Pages saved for reading without a connection. */
export function OfflinePagesScreen({ visible, onOpenLive, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible && <OfflineList onOpenLive={onOpenLive} onClose={onClose} />}
      <DialogHost />
    </Modal>
  );
}

function OfflineList({ onOpenLive, onClose }: Omit<Props, 'visible'>) {
  const styles = useStyles();
  const palette = usePalette();
  const [pages, setPages] = useState<OfflinePage[] | null>(null);
  const [reading, setReading] = useState<{ page: OfflinePage; html: string } | null>(null);
  const reload = useCallback(() => {
    getDb()
      .then(listOfflinePages)
      .then(setPages)
      .catch(() => setPages([]));
  }, []);
  useEffect(reload, [reload]);

  const open = (page: OfflinePage) => {
    readOfflinePage(page)
      .then((html) => setReading({ page, html }))
      .catch(() => {});
  };
  const remove = (page: OfflinePage) => {
    deleteOfflineFile(page);
    getDb()
      .then((db) => removeOfflinePage(db, page.id))
      .then(reload)
      .catch(() => {});
  };

  if (reading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => setReading(null)} hitSlop={8} style={styles.side}>
            <View style={styles.backRow}>
              <Icon name="chevronLeft" size={18} color={palette.tintText} />
              <Text style={styles.back}>{t('offline.title')}</Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onOpenLive(reading.page.url)} hitSlop={8} style={[styles.side, styles.right]}>
            <Text style={styles.done}>{t('offline.openLive')}</Text>
          </Pressable>
        </View>
        <WebView
          source={{ html: reading.html, baseUrl: reading.page.url }}
          originWhitelist={['*']}
          // Links lead to the live web: they open in a tab.
          onShouldStartLoadWithRequest={(req) => {
            if (/^https?:\/\//i.test(req.url) && req.url !== reading.page.url && req.navigationType === 'click') {
              onOpenLive(req.url);
              return false;
            }
            return true;
          }}
          javaScriptEnabled={false}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
      <View style={styles.header}>
        <View style={styles.side} />
        <Text style={styles.title}>{t('offline.title')}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={[styles.side, styles.right]}>
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>
      <FlatList
        data={pages ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={pages ? <Text style={styles.empty}>{t('offline.empty')}</Text> : <ActivityIndicator style={styles.loading} />}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.texts}>
              <Text style={styles.name} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[hostOf(item.url), formatSize(item.size), dayLabel(item.savedAt)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Pressable
              onPress={() => remove(item)}
              hitSlop={10}
              style={styles.remove}
              accessibilityRole="button"
              accessibilityLabel={t('offline.delete')}
            >
              <Icon name="close" size={14} color={palette.textSecondary} />
            </Pressable>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  side: { flex: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  right: { alignItems: 'flex-end' },
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  back: { fontSize: 16, color: c.tintText },
  done: { fontSize: 16, color: c.tintText, fontWeight: '600' },
  list: { ...readableColumn, padding: 16, gap: 8 },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32, lineHeight: 21 },
  loading: { marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  pressed: { backgroundColor: c.pressed },
  texts: { flex: 1, gap: 2 },
  name: { fontSize: 15, color: c.text },
  meta: { fontSize: 12, color: c.textSecondary },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
}));
