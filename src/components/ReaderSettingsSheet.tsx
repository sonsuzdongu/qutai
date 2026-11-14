import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { READER_COLORS, READER_FONTS, READER_THEMES, ReaderFont, ReaderTheme } from '../browser/reader';
import { t } from '../i18n';
import { clampTextZoom, TEXT_ZOOM_MAX, TEXT_ZOOM_MIN } from '../storage/settings';
import { makeStyles } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { BottomSheet } from './BottomSheet';

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
              <Text
                style={[
                  styles.segmentText,
                  font === 'serif' ? styles.serif : null,
                  selected && styles.segmentTextSelected,
                ]}
              >
                {t(`reader.font.${font}`)}
              </Text>
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
          %{zoom}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: c.text },
  done: { fontSize: 16, fontWeight: '600', color: c.tintText },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 6 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  swatches: { flexDirection: 'row', gap: 8 },
  swatch: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  swatchAuto: { backgroundColor: c.surface, borderColor: c.border },
  swatchSelected: { borderWidth: 2, borderColor: c.tint },
  swatchText: { fontSize: 14, fontWeight: '600', color: c.text },
  segment: { flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 10, padding: 3 },
  segmentButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentSelected: { backgroundColor: c.surface },
  segmentText: { fontSize: 15, color: c.textSecondary },
  segmentTextSelected: { color: c.text, fontWeight: '700' },
  serif: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    width: 56,
    height: 44,
    borderRadius: 12,
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
