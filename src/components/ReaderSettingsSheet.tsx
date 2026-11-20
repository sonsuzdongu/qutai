import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { READER_COLORS, READER_FONTS, READER_THEMES, ReaderFont, ReaderTheme } from '../browser/reader';
import { t } from '../i18n';
import { formatPercent } from '../i18n/format';
import { clampTextZoom, TEXT_ZOOM_MAX, TEXT_ZOOM_MIN } from '../storage/settings';
import { makeStyles, radii, common } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { BottomSheet } from './BottomSheet';
import { WholeWordsText } from './WholeWordsText';

export type ReaderSettings = {
  readerTheme: ReaderTheme;
  readerFont: ReaderFont;
  readerEasyReading: boolean;
  /** The app's text size, shared with web pages. */
  textZoom: number;
};

type Props = {
  visible: boolean;
  value: ReaderSettings;
  onChange: (value: ReaderSettings) => void;
  onClose: () => void;
};

/** Reader mode look: colours, typeface, text size and spacing. Changes show at once and are saved. */
export function ReaderSettingsSheet({ visible, value, onChange, onClose }: Props) {
  const styles = useStyles();
  const zoom = value.textZoom;
  const setZoom = (next: number) => onChange({ ...value, textZoom: clampTextZoom(next) });

  return (
    <BottomSheet visible={visible} onClose={onClose} style={styles.sheet} contentStyle={styles.content} bottomPadding={16}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('reader.settings')}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>{t('reader.theme')}</Text>
      <View style={styles.swatches} accessibilityRole="radiogroup">
        {READER_THEMES.map((theme) => {
          const selected = value.readerTheme === theme;
          const colors = theme === 'auto' ? null : READER_COLORS[theme];
          return (
            <Pressable
              key={theme}
              onPress={() => onChange({ ...value, readerTheme: theme })}
              style={[
                styles.swatch,
                colors ? { backgroundColor: colors.bg, borderColor: colors.border } : styles.swatchAuto,
                selected && styles.swatchSelected,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={t(`reader.theme.${theme}`)}
            >
              <Text style={[styles.swatchText, colors ? { color: colors.text } : null]} numberOfLines={1}>
                {t(`reader.theme.${theme}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t('reader.font')}</Text>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {READER_FONTS.map((font) => {
          const selected = value.readerFont === font;
          return (
            <Pressable
              key={font}
              onPress={() => onChange({ ...value, readerFont: font })}
              style={[styles.segmentButton, selected && styles.segmentSelected]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <WholeWordsText
                style={[
                  styles.segmentText,
                  font === 'serif' ? styles.serif : null,
                  selected && styles.segmentTextSelected,
                ]}
              >
                {t(`reader.font.${font}`)}
              </WholeWordsText>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t('textSize.title')}</Text>
      <View style={styles.controls}>
        <Pressable
          onPress={() => setZoom(zoom - 10)}
          disabled={zoom <= TEXT_ZOOM_MIN}
          style={[styles.step, zoom <= TEXT_ZOOM_MIN && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t('textSize.smaller')}
          accessibilityState={{ disabled: zoom <= TEXT_ZOOM_MIN }}
        >
          <Text style={styles.stepSmall}>A</Text>
        </Pressable>
        <Text style={styles.value} accessibilityLiveRegion="polite">
          {formatPercent(zoom)}
        </Text>
        <Pressable
          onPress={() => setZoom(zoom + 10)}
          disabled={zoom >= TEXT_ZOOM_MAX}
          style={[styles.step, zoom >= TEXT_ZOOM_MAX && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t('textSize.larger')}
          accessibilityState={{ disabled: zoom >= TEXT_ZOOM_MAX }}
        >
          <Text style={styles.stepLarge}>A</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{t('reader.textSizeHint')}</Text>

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.switchLabel}>{t('reader.easyReading')}</Text>
          <Text style={styles.hint}>{t('reader.easyReadingHint')}</Text>
        </View>
        <ThemedSwitch
          value={value.readerEasyReading}
          onValueChange={(readerEasyReading) => onChange({ ...value, readerEasyReading })}
          accessibilityLabel={t('reader.easyReading')}
        />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { paddingTop: 14 },
  content: { paddingHorizontal: 20, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  // A long title wraps; Done keeps its width.
  title: { ...common(c).title, flexShrink: 1 },
  done: { fontSize: 16, fontWeight: '600', color: c.tintText },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 6 },
  hint: common(c).hint,
  swatches: { flexDirection: 'row', gap: 8 },
  swatch: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  swatchAuto: { backgroundColor: c.surface, borderColor: c.border },
  swatchSelected: { borderWidth: 2, borderColor: c.tint },
  swatchText: { fontSize: 14, fontWeight: '600', color: c.text },
  segment: common(c).segment,
  segmentButton: common(c).segmentButton,
  segmentSelected: common(c).segmentSelected,
  segmentText: { ...common(c).segmentText, fontSize: 15 },
  segmentTextSelected: common(c).segmentTextSelected,
  serif: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    width: 56,
    height: 44,
    borderRadius: radii.control,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSmall: { fontSize: 14, fontWeight: '600', color: c.text },
  stepLarge: { fontSize: 22, fontWeight: '600', color: c.text },
  value: { fontSize: 18, fontWeight: '600', color: c.text },
  disabled: { opacity: 0.35 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  switchLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
  flex: { flex: 1 },
}));
