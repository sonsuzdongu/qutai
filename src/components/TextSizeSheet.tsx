import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { formatPercent } from '../i18n/format';
import { makeStyles, radii, common } from '../ui/theme';
import { clampTextZoom, TEXT_ZOOM_MAX, TEXT_ZOOM_MIN } from '../storage/settings';
import { BottomSheet } from './BottomSheet';
import { DEFAULT_ZOOM_LEVEL, MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, stepZoom } from '../browser/pageZoom';

type Props = {
  visible: boolean;
  zoom: number;
  onChange: (zoom: number) => void;
  onClose: () => void;
};

/** Bottom sheet for page text size; changes apply to every tab immediately. */
export function TextSizeSheet({ visible, zoom, onChange, onClose }: Props) {
  const styles = useStyles();
  const set = (value: number) => onChange(clampTextZoom(value));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      style={styles.sheet}
      contentStyle={styles.content}
      bottomPadding={16}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('textSize.title')}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>
      <Text style={[styles.sample, { fontSize: (15 * zoom) / 100 }]} numberOfLines={2}>
        {t('textSize.sample')}
      </Text>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          onPress={() => set(zoom - 10)}
          disabled={zoom <= TEXT_ZOOM_MIN}
          style={[styles.step, zoom <= TEXT_ZOOM_MIN && styles.disabled]}
          accessibilityLabel={t('textSize.smaller')}
        >
          <Text style={styles.stepSmall}>A</Text>
        </Pressable>
        <Text style={styles.value} accessibilityLiveRegion="polite">
          {formatPercent(zoom)}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => set(zoom + 10)}
          disabled={zoom >= TEXT_ZOOM_MAX}
          style={[styles.step, zoom >= TEXT_ZOOM_MAX && styles.disabled]}
          accessibilityLabel={t('textSize.larger')}
        >
          <Text style={styles.stepLarge}>A</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => set(100)} disabled={zoom === 100} style={styles.reset} accessibilityRole="button">
        <Text style={[styles.resetText, zoom === 100 && styles.disabled]}>{t('textSize.reset')}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { paddingTop: 14 },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  // A long title wraps; Done keeps its width.
  title: { ...common(c).title, flexShrink: 1 },
  done: { fontSize: 16, fontWeight: '600', color: c.tintText },
  sample: { color: c.text, minHeight: 44 },
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
  reset: { alignSelf: 'center', paddingVertical: 6 },
  resetText: { fontSize: 15, color: c.tintText, fontWeight: '600' },
  disabled: { opacity: 0.35 },
}));

type ZoomProps = {
  visible: boolean;
  /** The site's zoom level in percent (100 = Safari's size). */
  level: number;
  onChange: (level: number) => void;
  onClose: () => void;
};

/**
 * A Mac's "Zoom" sheet (UI-84), in place of the text size: the site's page zoom, the same level ⌘+ / ⌘− / ⌘0 change,
 * in Safari's steps; 100% is the size Safari shows.
 */
export function PageZoomSheet({ visible, level, onChange, onClose }: ZoomProps) {
  const styles = useStyles();
  return (
    <BottomSheet visible={visible} onClose={onClose} style={styles.sheet} contentStyle={styles.content} bottomPadding={16}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('menu.zoom')}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(stepZoom(level, 'out'))}
          disabled={level <= MIN_ZOOM_LEVEL}
          style={[styles.step, level <= MIN_ZOOM_LEVEL && styles.disabled]}
          accessibilityLabel={t('shortcuts.zoomOut')}
        >
          <Text style={styles.stepLarge}>−</Text>
        </Pressable>
        <Text style={styles.value} accessibilityLiveRegion="polite">
          {formatPercent(level)}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(stepZoom(level, 'in'))}
          disabled={level >= MAX_ZOOM_LEVEL}
          style={[styles.step, level >= MAX_ZOOM_LEVEL && styles.disabled]}
          accessibilityLabel={t('shortcuts.zoomIn')}
        >
          <Text style={styles.stepLarge}>+</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => onChange(DEFAULT_ZOOM_LEVEL)}
        disabled={level === DEFAULT_ZOOM_LEVEL}
        style={styles.reset}
        accessibilityRole="button"
      >
        <Text style={[styles.resetText, level === DEFAULT_ZOOM_LEVEL && styles.disabled]}>{t('shortcuts.actualSize')}</Text>
      </Pressable>
    </BottomSheet>
  );
}
