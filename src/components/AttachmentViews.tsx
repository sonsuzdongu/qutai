import { Canvas, Image as SkiaImage, Skia, type SkImage } from '@shopify/react-native-skia';
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AttachmentInfo } from '../chat/attachments';
import { describeFilters } from '../chat/filterSummary';
import { presetInput, ResizePreset } from '../chat/imageEdit';
import {
  type Adjustable,
  ADJUSTABLE,
  FILTER_PRESETS,
  type FilterPreset,
  type Filters,
  filtersArgument,
  isNeutral,
  type Levels,
  NO_FILTERS,
  presetActive,
  RANGES,
  stepAmount,
  togglePreset,
} from '../chat/imageFilters';
import { modelFile, originalFile } from '../device/attachments';
import { measureLevels, renderFiltered } from '../device/filterRender';
import { loadPreviewImage } from '../device/imageEdit';
import { t, type MessageKey } from '../i18n';
import { formatSize } from '../i18n/format';
import { Icon } from '../ui/Icon';
import { isWide } from '../ui/layout';
import { Slider } from '../ui/Slider';
import { makeStyles, usePalette } from '../ui/theme';
import { KeyboardAvoidingContainer, KeyboardAwareScrollView } from './KeyboardAware';

/** A small square for an attachment: the image's model copy, or a document icon with the file name. */
export function AttachmentThumb({
  info,
  index,
  size,
  onPress,
}: {
  info: AttachmentInfo;
  index: number;
  size: number;
  onPress: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  // Read once per attachment; a missing file (cleared, or restored from a backup) shows a placeholder.
  const uri = useMemo(() => (info.kind === 'image' ? (modelFile(info.id)?.uri ?? null) : null), [info.id, info.kind]);
  const label = t(info.kind === 'pdf' ? 'attach.a11yPdf' : 'attach.a11yImage', { n: index + 1, name: info.name });
  return (
    <Pressable
      onPress={onPress}
      style={[styles.thumb, { width: size, height: size }]}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      accessibilityHint={t('attach.openHint')}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <>
          <Icon name={info.kind === 'pdf' ? 'pdf' : 'image'} size={22} color={palette.textSecondary} />
          <Text style={styles.label} numberOfLines={2}>
            {info.kind === 'pdf' ? info.name : t('attach.unavailableShort')}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * Full-screen view of an attachment, with Share and Save (images to Photos), and for images "Edit": filters with a
 * live preview, and shapes and sizes, that make an edited copy on the phone (`onResize` runs it with edit_image's
 * arguments). With the edit panel open the picture is a preview of the filters on a reduced copy; side by side with
 * the panel in a wide window.
 */
export function AttachmentPreview({
  info,
  onClose,
  onShare,
  onSave,
  onResize,
}: {
  info: AttachmentInfo | null;
  onClose: () => void;
  onShare: (info: AttachmentInfo) => void;
  onSave: (info: AttachmentInfo) => void;
  onResize?: (info: AttachmentInfo, input: Record<string, unknown>) => Promise<void>;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  // The panel belongs to the image it was opened for (another image, or the copy just made, starts without it).
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const resizing = !!info && resizingId === info.id;
  const wide = isWide(useWindowDimensions());
  const file = useMemo(() => (info ? originalFile(info.id) : null), [info]);
  const shown = info?.kind === 'image' ? (file?.uri ?? null) : null;
  const details = info
    ? [info.width && info.height ? `${info.width}×${info.height}` : '', formatSize(info.size), describeFilters(info.filters)]
        .filter(Boolean)
        .join(' · ')
    : '';
  const editing = !!(file && info && resizing && onResize && info.width && info.height);
  return (
    <AppModal visible={!!info} animationType="fade" onRequestClose={onClose}>
      {/* The resize panel's size fields stay above the keyboard; the image shrinks to make room. */}
      <KeyboardAvoidingContainer style={[styles.preview, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.bar}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Icon name="close" size={22} color="#ffffff" />
          </Pressable>
          <View style={styles.titleBox}>
            <Text style={styles.title} numberOfLines={1}>
              {info?.name}
            </Text>
            <Text style={styles.subtitle}>{details}</Text>
          </View>
        </View>
        <View style={[styles.body, editing && wide && styles.bodyWide]}>
          {editing && info ? (
            <FilterPreview key={info.id} info={info} filters={filters} />
          ) : shown ? (
            <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityLabel={info?.name} />
          ) : (
            <View style={styles.missing}>
              <Icon name={info?.kind === 'pdf' ? 'pdf' : 'image'} size={48} color="#cfcfd6" />
              <Text style={styles.missingText}>{file ? info?.name : t('attach.gone')}</Text>
            </View>
          )}
          {editing && info && wide ? (
            <ResizePanel
              source={{ width: info.width!, height: info.height! }}
              filters={filters}
              setFilters={setFilters}
              wide
              onCancel={() => setResizingId(null)}
              onApply={(input) => onResize(info, input)}
            />
          ) : null}
        </View>
        {editing && info && !wide ? (
          <ResizePanel
            source={{ width: info.width!, height: info.height! }}
            filters={filters}
            setFilters={setFilters}
            wide={false}
            onCancel={() => setResizingId(null)}
            onApply={(input) => onResize(info, input)}
          />
        ) : editing ? null : file && info ? (
          <View style={styles.actions}>
            <Pressable onPress={() => onShare(info)} style={styles.action} accessibilityRole="button">
              <Icon name="share" size={20} color="#ffffff" />
              <Text style={styles.actionText}>{t('chat.share')}</Text>
            </Pressable>
            {info.kind === 'image' ? (
              <Pressable onPress={() => onSave(info)} style={styles.action} accessibilityRole="button">
                <Icon name="download" size={20} color="#ffffff" />
                <Text style={styles.actionText}>{t('common.save')}</Text>
              </Pressable>
            ) : null}
            {info.kind === 'image' && onResize && info.width && info.height ? (
              <Pressable
                onPress={() => {
                  setFilters(NO_FILTERS);
                  setResizingId(info.id);
                }}
                style={styles.action}
                accessibilityRole="button"
              >
                <Icon name="image" size={20} color="#ffffff" />
                <Text style={styles.actionText}>{t('resize.action')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingContainer>
    </AppModal>
  );
}

type Shape = ResizePreset['shape'];
const SHAPES: Shape[] = ['original', 'square', '4:3', '16:9'];
const EDGES = [null, 2048, 1024, 512] as const;
const BUDGETS = [null, 2_000_000, 1_000_000, 500_000, 200_000] as const;

function Chip({
  label,
  selected,
  onPress,
  toggle = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** On or off by itself (a filter), not one of a group. */
  toggle?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole={toggle ? 'togglebutton' : 'radio'}
      accessibilityState={toggle ? { checked: selected } : { selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const PRESET_LABEL: Record<FilterPreset, MessageKey> = {
  original: 'resize.original',
  auto: 'filters.auto',
  greyscale: 'filters.greyscale',
  sepia: 'filters.sepia',
  sharpen: 'filters.sharpen',
  brighter: 'filters.brighter',
  contrast: 'filters.moreContrast',
  blur: 'filters.blur',
};
const SLIDER_LABEL: Record<Adjustable, MessageKey> = {
  brightness: 'filters.brightness',
  contrast: 'filters.contrast',
  saturation: 'filters.saturation',
  warmth: 'filters.warmth',
  sharpen: 'filters.sharpness',
  blur: 'filters.blur',
};
/** Longest side of the preview's reduced copy: sharp on a phone screen, quick to redraw on every change. */
const PREVIEW_EDGE = 900;

/** A slider's value: sharpen and blur replace each other, as edit_image takes one or the other. */
function withAmount(f: Filters, key: Adjustable, value: number): Filters {
  const next = { ...f, [key]: value };
  if (key === 'sharpen' && value) next.blur = 0;
  if (key === 'blur' && value) next.sharpen = 0;
  return next;
}

const amountText = (key: Adjustable, v: number) => (RANGES[key].min < 0 && v > 0 ? `+${v}` : v < 0 ? `−${-v}` : String(v));

/**
 * The edit panel's picture: the filters on a reduced copy (PREVIEW_EDGE), redrawn once per frame at most while a
 * slider moves; touching and holding it (or a screen reader's activate) shows the copy without filters.
 */
function FilterPreview({ info, filters }: { info: AttachmentInfo; filters: Filters }) {
  const styles = useStyles();
  const [source, setSource] = useState<SkImage | null>(null);
  const [rendered, setRendered] = useState<SkImage | null>(null);
  const [failed, setFailed] = useState(false);
  const [holding, setHolding] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const levels = useRef<{ image: SkImage; levels: Levels | null } | null>(null);

  useEffect(() => {
    let alive = true;
    let loaded: SkImage | null = null;
    loadPreviewImage(info, PREVIEW_EDGE)
      .then((image) => {
        if (!alive) return image.dispose();
        loaded = image;
        setSource(image);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      setSource(null);
      loaded?.dispose();
    };
  }, [info]);

  useEffect(() => {
    if (!source || isNeutral(filters)) return;
    const frame = requestAnimationFrame(() => {
      if (filters.auto && levels.current?.image !== source) levels.current = { image: source, levels: measureLevels(Skia, source) };
      const out = renderFiltered(
        Skia,
        source,
        { width: source.width(), height: source.height() },
        filters,
        filters.auto ? levels.current?.levels : null,
      );
      setRendered(out);
    });
    return () => cancelAnimationFrame(frame);
  }, [source, filters]);

  // A drawn preview is released once the next one is on screen (or the preview closes).
  useEffect(() => () => rendered?.dispose(), [rendered]);

  const image = holding || isNeutral(filters) ? source : (rendered ?? source);
  return (
    <Pressable
      style={styles.previewBox}
      onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      onLongPress={() => setHolding(true)}
      delayLongPress={150}
      onPressOut={() => setHolding(false)}
      accessibilityRole="image"
      accessibilityLabel={holding ? t('resize.original') : t('filters.preview')}
      accessibilityHint={t('filters.holdHint')}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => setHolding((h) => !h)}
    >
      {image && box.width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <SkiaImage image={image} x={0} y={0} width={box.width} height={box.height} fit="contain" />
        </Canvas>
      ) : failed ? (
        <View style={styles.missing}>
          <Icon name="image" size={48} color="#cfcfd6" />
        </View>
      ) : (
        <ActivityIndicator color="#ffffff" style={styles.previewLoading} />
      )}
      {holding ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{t('resize.original')}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The panel's "Filters" part: one-tap presets, a slider for each amount, and Reset. */
function FilterControls({ filters, setFilters }: { filters: Filters; setFilters: Dispatch<SetStateAction<Filters>> }) {
  const styles = useStyles();
  const neutral = isNeutral(filters);
  // One stable pair of callbacks per slider (the slider keeps its gesture across renders).
  const handlers = useMemo(
    () =>
      Object.fromEntries(
        ADJUSTABLE.map((key) => [
          key,
          {
            change: (v: number) => setFilters((f) => (f[key] === v ? f : withAmount(f, key, v))),
            step: (d: 1 | -1) => setFilters((f) => withAmount(f, key, stepAmount(key, f[key], d))),
          },
        ]),
      ) as Record<Adjustable, { change: (v: number) => void; step: (d: 1 | -1) => void }>,
    [setFilters],
  );
  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={[styles.panelLabel, styles.sectionTitle]} accessibilityRole="header">
          {t('filters.title')}
        </Text>
        <Pressable
          onPress={() => setFilters(NO_FILTERS)}
          disabled={neutral}
          hitSlop={8}
          style={[styles.reset, neutral && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: neutral }}
        >
          <Text style={styles.resetText}>{t('filters.reset')}</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {FILTER_PRESETS.map((p) => (
          <Chip
            key={p}
            label={t(PRESET_LABEL[p])}
            selected={presetActive(filters, p)}
            toggle={p !== 'original'}
            onPress={() => setFilters((f) => togglePreset(f, p))}
          />
        ))}
      </View>
      {ADJUSTABLE.map((key) => (
        <Slider
          key={key}
          label={t(SLIDER_LABEL[key])}
          value={filters[key]}
          min={RANGES[key].min}
          max={RANGES[key].max}
          valueText={amountText(key, filters[key])}
          onChange={handlers[key].change}
          onStep={handlers[key].step}
          color="#ffffff"
          trackColor="#5a5a64"
        />
      ))}
      <Text style={styles.panelHint}>{t('filters.holdHint')}</Text>
    </>
  );
}

/** "Edit": filters, shape, longest side or an exact size, and a largest file size; makes a copy. */
function ResizePanel({
  source,
  filters,
  setFilters,
  wide,
  onCancel,
  onApply,
}: {
  source: { width: number; height: number };
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  /** Beside the picture (a wide window) rather than under it. */
  wide: boolean;
  onCancel: () => void;
  onApply: (input: Record<string, unknown>) => Promise<void>;
}) {
  const styles = useStyles();
  const [shape, setShape] = useState<Shape>('original');
  const [edge, setEdge] = useState<number | null>(null);
  const [custom, setCustom] = useState(false);
  const [width, setWidth] = useState('1024');
  const [height, setHeight] = useState('1024');
  const [budget, setBudget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const w = Math.round(Number(width));
  const h = Math.round(Number(height));
  const customValid = w >= 1 && h >= 1 && w <= 4096 && h <= 4096;
  const nothing = !custom && shape === 'original' && edge === null && budget === null && isNeutral(filters);
  const apply = async () => {
    const preset: ResizePreset = {
      shape,
      edge,
      maxBytes: budget,
      ...(custom ? { custom: { width: w, height: h } } : {}),
    };
    setBusy(true);
    try {
      const input = presetInput(preset, source);
      if (!isNeutral(filters)) input.filters = filtersArgument(filters);
      await onApply(input);
    } finally {
      setBusy(false);
    }
  };
  const shapeLabel = (s: Shape) => (s === 'original' ? t('resize.original') : s === 'square' ? t('resize.square') : s);
  const disabled = busy || nothing || (custom && !customValid);
  const buttons = (
    <View style={styles.panelButtons}>
      <Pressable onPress={onCancel} style={styles.panelButton} accessibilityRole="button" disabled={busy}>
        <Text style={styles.actionText}>{t('common.cancel')}</Text>
      </Pressable>
      <Pressable
        onPress={apply}
        style={[styles.panelButton, styles.panelPrimary, disabled && styles.disabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
      >
        {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.actionText}>{t('resize.make')}</Text>}
      </Pressable>
    </View>
  );
  return (
    <KeyboardAwareScrollView
      containerStyle={[styles.panel, wide && styles.panelWide]}
      contentContainerStyle={styles.panelContent}
      footer={buttons}
    >
      <FilterControls filters={filters} setFilters={setFilters} />
      <Text style={styles.panelLabel}>{t('resize.shape')}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {SHAPES.map((s) => (
          <Chip key={s} label={shapeLabel(s)} selected={!custom && shape === s} onPress={() => (setCustom(false), setShape(s))} />
        ))}
      </View>
      <Text style={styles.panelLabel}>{t('resize.size')}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {EDGES.map((e) => (
          <Chip
            key={String(e)}
            label={e === null ? t('resize.original') : `${e} px`}
            selected={!custom && edge === e}
            onPress={() => (setCustom(false), setEdge(e))}
          />
        ))}
        <Chip label={t('resize.custom')} selected={custom} onPress={() => setCustom(true)} />
      </View>
      {custom ? (
        <View style={styles.customRow}>
          <TextInput
            value={width}
            onChangeText={setWidth}
            keyboardType="number-pad"
            style={styles.sizeInput}
            accessibilityLabel={t('resize.width')}
            maxLength={4}
          />
          <Text style={styles.panelText}>×</Text>
          <TextInput
            value={height}
            onChangeText={setHeight}
            keyboardType="number-pad"
            style={styles.sizeInput}
            accessibilityLabel={t('resize.height')}
            maxLength={4}
          />
          <Text style={styles.panelHint}>{t('resize.customHint')}</Text>
        </View>
      ) : null}
      <Text style={styles.panelLabel}>{t('resize.maxSize')}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {BUDGETS.map((b) => (
          <Chip
            key={String(b)}
            label={b === null ? t('resize.noLimit') : b >= 1_000_000 ? `${b / 1_000_000} MB` : `${b / 1000} KB`}
            selected={budget === b}
            onPress={() => setBudget(b)}
          />
        ))}
      </View>
      <Text style={styles.panelHint}>{t('resize.note')}</Text>
    </KeyboardAwareScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  thumb: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  label: { fontSize: 10, color: c.textSecondary, paddingHorizontal: 4, textAlign: 'center' },
  preview: { flex: 1, backgroundColor: '#000000' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  titleBox: { flex: 1 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  subtitle: { color: '#cfcfd6', fontSize: 12 },
  body: { flex: 1 },
  bodyWide: { flexDirection: 'row' },
  previewBox: { flex: 1 },
  previewLoading: { flex: 1 },
  badge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  missingText: { color: '#cfcfd6', fontSize: 15, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 14, paddingHorizontal: 16 },
  // A long label ("Größe ändern oder zuschneiden") wraps between words under its icon instead of pushing the row
  // off the screen.
  action: { alignItems: 'center', gap: 4, minWidth: 64, minHeight: 44, flexShrink: 1 },
  actionText: { color: '#ffffff', fontSize: 13, textAlign: 'center' },
  panel: { maxHeight: '60%', backgroundColor: '#16161a' },
  // Beside the picture in a wide window: the full height, at most half the width.
  panelWide: { maxHeight: undefined, flex: 0, width: '50%', maxWidth: 440 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { flexShrink: 1 },
  reset: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
  resetText: { color: '#ffffff', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  panelContent: { padding: 16, gap: 8 },
  panelLabel: { color: '#cfcfd6', fontSize: 13, fontWeight: '600', marginTop: 4 },
  panelText: { color: '#ffffff', fontSize: 15 },
  panelHint: { color: '#a0a0aa', fontSize: 12, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#5a5a64', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  chipText: { color: '#ffffff', fontSize: 14 },
  chipTextSelected: { color: '#000000', fontWeight: '600' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sizeInput: {
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#5a5a64',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
    fontSize: 15,
  },
  panelButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#16161a',
  },
  panelButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, minWidth: 88, alignItems: 'center' },
  panelPrimary: { backgroundColor: c.tint },
  disabled: { opacity: 0.4 },
}));
