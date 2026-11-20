import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { Button } from '../ui/Button';
import { makeStyles, readableColumn, common } from '../ui/theme';
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
          <Button
            size="large"
            variant="destructive"
            label={t('clearData.clear')}
            onPress={clear}
            disabled={!anything}
            style={styles.button}
          />
        </ScrollView>
      </SafeAreaView>
      <DialogHost />
    </AppModal>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { ...readableColumn, padding: 16, gap: 12 },
  label: common(c).label,
  hint: common(c).hint,
  segment: common(c).segment,
  segmentButton: { ...common(c).segmentButton, paddingHorizontal: 2 },
  segmentSelected: common(c).segmentSelected,
  segmentText: { ...common(c).segmentText, fontSize: 13 },
  segmentTextSelected: common(c).segmentTextSelected,
  row: common(c).row,
  texts: { flex: 1, gap: 2 },
  button: { marginTop: 12 },
}));
