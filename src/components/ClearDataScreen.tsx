import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { makeStyles, readableColumn } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import type { ClearOptions } from '../storage/clearData';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';
import { ScreenHeader } from './ScreenHeader';
import { WholeWordsText } from './WholeWordsText';

type Props = { visible: boolean; onClear: (options: ClearOptions) => Promise<void>; onClose: () => void };

export type { ClearOptions };

const ITEMS = [
  'history',
  'cache',
  'recentlyClosed',
  'chats',
  'activity',
  'aiRequests',
  'downloads',
  'offlinePages',
] as const;

/** Clears browsing data: history, activity and the AI request log for a time range, the rest entirely. */
export function ClearDataScreen({ visible, onClear, onClose }: Props) {
  const styles = useStyles();
  const [options, setOptions] = useState<ClearOptions>({
    range: 'hour',
    history: true,
    cache: true,
    recentlyClosed: false,
    chats: false,
    activity: false,
    aiRequests: false,
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
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <ScreenHeader title={t('clearData.title')} left={{ label: t('common.cancel'), tone: 'plain', onPress: onClose }} />
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
                <WholeWordsText style={[styles.segmentText, options.range === range && styles.segmentTextSelected]}>
                  {t(`clearData.range.${range}`)}
                </WholeWordsText>
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
    </AppModal>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { ...readableColumn, padding: 16, gap: 12 },
  label: { fontSize: 15, fontWeight: '600', color: c.text },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  segment: { flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 10, padding: 3 },
  segmentButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 2, borderRadius: 8 },
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
