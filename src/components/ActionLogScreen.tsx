import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SectionList, Text, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { makeStyles, readableColumn, usePalette } from '../ui/theme';
import { Icon } from '../ui/Icon';
import { toolIcon } from '../agent/toolIcons';
import { withoutLeadingSymbol } from '../utils/leadingSymbol';
import { groupByDay, timeLabel } from '../i18n/format';
import { ActionEntry, clearActions, listActions } from '../storage/actionLog';
import { getDb } from '../storage/db';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';
import { ScreenHeader } from './ScreenHeader';
import { reportStorageFailure } from '../storage/failures';

type Entry = ActionEntry & { id: number };
type Props = { visible: boolean; onClose: () => void };

/** What Qutai did, newest first, grouped by day. Incognito tabs are never recorded. */
export function ActionLogScreen({ visible, onClose }: Props) {
  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible && <ActionLog onClose={onClose} />}
      <DialogHost />
    </AppModal>
  );
}

function ActionLog({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const reload = useCallback(() => {
    getDb()
      .then((db) => listActions(db))
      .then(setEntries)
      .catch((e) => {
        reportStorageFailure('actionLog.list', e, 'user');
        setEntries([]);
      });
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
            .catch((e) => reportStorageFailure('actionLog.clear', e, 'user')),
      },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
      <ScreenHeader
        title={t('actionLog.title')}
        left={{ label: t('actionLog.clear'), tone: 'danger', disabled: !entries?.length, onPress: clearAll }}
        right={{ label: t('common.done'), onPress: onClose }}
      />
      <SectionList
        sections={groupByDay(entries ?? [], (e) => e.at)}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={<Text style={styles.hint}>{t('actionLog.hint')}</Text>}
        ListEmptyComponent={
          entries ? <Text style={styles.empty}>{t('actionLog.empty')}</Text> : <ActivityIndicator style={styles.loading} />
        }
        renderSectionHeader={({ section }) => <Text style={styles.day}>{section.title}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.time}>{timeLabel(item.at)}</Text>
            <Icon
              name={item.ok ? toolIcon(item.tool) : 'insecure'}
              size={16}
              color={item.ok ? palette.textSecondary : palette.danger}
              style={styles.icon}
            />
            <View style={styles.texts}>
              <Text
                style={[styles.description, !item.ok && styles.failed]}
                numberOfLines={2}
                accessibilityLabel={
                  item.ok
                    ? undefined
                    : t('actionLog.failedLabel', { action: withoutLeadingSymbol(item.description) })
                }
              >
                {withoutLeadingSymbol(item.description)}
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
  list: { ...readableColumn, padding: 16, gap: 2 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 8 },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  loading: { marginTop: 32 },
  day: { fontSize: 13, fontWeight: '700', color: c.textSecondary, marginTop: 14, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  time: { width: 44, fontSize: 12, color: c.textSecondary, marginTop: 2 },
  icon: { marginTop: 1 },
  texts: { flex: 1, gap: 1 },
  description: { fontSize: 14, color: c.text },
  failed: { color: c.danger },
  host: { fontSize: 12, color: c.textSecondary },
}));
