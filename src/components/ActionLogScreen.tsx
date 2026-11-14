import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { groupByDay, timeLabel } from '../i18n/format';
import { ActionEntry, clearActions, listActions } from '../storage/actionLog';
import { getDb } from '../storage/db';
import { dialog, DialogHost } from './Dialog';

type Entry = ActionEntry & { id: number };
type Props = { visible: boolean; onClose: () => void };

/** What Qutai did, newest first, grouped by day. Incognito tabs are never recorded. */
export function ActionLogScreen({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible && <ActionLog onClose={onClose} />}
      <DialogHost />
    </Modal>
  );
}

function ActionLog({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const reload = useCallback(() => {
    getDb()
      .then((db) => listActions(db))
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);
  useEffect(reload, [reload]);

  const clearAll = () =>
    dialog.alert(t('actionLog.clearConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('actionLog.clear'),
        style: 'destructive',
        onPress: () =>
          getDb()
            .then(clearActions)
            .then(reload)
            .catch(() => {}),
      },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={clearAll} disabled={!entries?.length} hitSlop={8} style={styles.side}>
          <Text style={[styles.clear, !entries?.length && styles.disabled]}>{t('actionLog.clear')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('actionLog.title')}</Text>
        <Pressable onPress={onClose} hitSlop={8} style={[styles.side, styles.right]}>
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>
      <SectionList
        sections={groupByDay(entries ?? [], (e) => e.at)}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={<Text style={styles.hint}>{t('actionLog.hint')}</Text>}
        ListEmptyComponent={entries ? <Text style={styles.empty}>{t('actionLog.empty')}</Text> : undefined}
        renderSectionHeader={({ section }) => <Text style={styles.day}>{section.title}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.time}>{timeLabel(item.at)}</Text>
            <View style={styles.texts}>
              <Text style={[styles.description, !item.ok && styles.failed]} numberOfLines={2}>
                {item.ok ? '' : '⚠️ '}
                {item.description}
              </Text>
              {item.host ? (
                <Text style={styles.host} numberOfLines={1}>
                  {item.host}
                </Text>
              ) : null}
            </View>
          </View>
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
  right: { alignItems: 'flex-end' },
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  clear: { fontSize: 15, color: c.danger },
  done: { fontSize: 16, color: c.tintText, fontWeight: '600' },
  disabled: { opacity: 0.35 },
  list: { padding: 16, gap: 2 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 8 },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  day: { fontSize: 13, fontWeight: '700', color: c.textSecondary, marginTop: 14, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  time: { width: 44, fontSize: 12, color: c.textSecondary, marginTop: 2 },
  texts: { flex: 1, gap: 1 },
  description: { fontSize: 14, color: c.text },
  failed: { color: c.danger },
  host: { fontSize: 12, color: c.textSecondary },
}));
