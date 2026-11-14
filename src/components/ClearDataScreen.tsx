import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import type { ClearOptions } from '../storage/clearData';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';

type Props = { visible: boolean; onClear: (options: ClearOptions) => Promise<void>; onClose: () => void };

export type { ClearOptions };

const ITEMS = ['history', 'cache', 'recentlyClosed', 'chats', 'activity', 'downloads', 'offlinePages'] as const;

/** Clears browsing data: history and activity for a time range, the rest entirely. */
export function ClearDataScreen({ visible, onClear, onClose }: Props) {
  const styles = useStyles();
  const [options, setOptions] = useState<ClearOptions>({
    range: 'hour',
    history: true,
    cache: true,
    recentlyClosed: false,
    chats: false,
    activity: false,
    downloads: false,
    offlinePages: false,
  });
  const anything = ITEMS.some((key) => options[key]);

  const clear = () =>
    dialog.alert(t('clearData.confirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('clearData.clear'),
        style: 'destructive',
        onPress: () => {
          onClear(options).finally(onClose);
        },
      },
    ]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.side}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('clearData.title')}</Text>
          <View style={styles.side} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>{t('clearData.range')}</Text>
          <View style={styles.segment}>
            {(['hour', 'day', 'week', 'all'] as const).map((range) => (
              <Pressable
                key={range}
                onPress={() => setOptions({ ...options, range })}
                style={[styles.segmentButton, options.range === range && styles.segmentSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected: options.range === range }}
              >
                <Text style={[styles.segmentText, options.range === range && styles.segmentTextSelected]}>
                  {t(`clearData.range.${range}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          {ITEMS.map((key) => (
            <View key={key} style={styles.row}>
              <View style={styles.texts}>
                <Text style={styles.label}>{t(`clearData.${key}`)}</Text>
                <Text style={styles.hint}>{t(`clearData.${key}Hint`)}</Text>
              </View>
              <ThemedSwitch value={options[key]} onValueChange={(on) => setOptions({ ...options, [key]: on })} />
            </View>
          ))}
          <Pressable
            onPress={clear}
            disabled={!anything}
            style={[styles.button, !anything && styles.disabled]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{t('clearData.clear')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
      <DialogHost />
    </Modal>
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
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  cancel: { fontSize: 16, color: c.textSecondary },
  content: { padding: 16, gap: 12 },
  label: { fontSize: 15, fontWeight: '600', color: c.text },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  segment: { flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 10, padding: 3 },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentSelected: { backgroundColor: c.surface },
  segmentText: { fontSize: 13, color: c.textSecondary },
  segmentTextSelected: { color: c.text, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, gap: 2 },
  button: {
    marginTop: 12,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.dangerFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: c.onTint, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.4 },
}));
