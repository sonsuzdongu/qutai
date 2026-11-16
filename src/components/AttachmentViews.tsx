import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AttachmentInfo } from '../chat/attachments';
import { presetInput, ResizePreset } from '../chat/imageEdit';
import { modelFile, originalFile } from '../device/attachments';
import { t } from '../i18n';
import { formatSize } from '../i18n/format';
import { Icon } from '../ui/Icon';
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
 * Full-screen view of an attachment, with Share and Save (images to Photos), and for images "Resize or crop": a few
 * presets that make an edited copy on the phone (`onResize` runs it with edit_image's arguments).
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
  const resizing = !!info && resizingId === info.id;
  const file = useMemo(() => (info ? originalFile(info.id) : null), [info]);
  const shown = info?.kind === 'image' ? (file?.uri ?? null) : null;
  const details = info
    ? [info.width && info.height ? `${info.width}×${info.height}` : '', formatSize(info.size)].filter(Boolean).join(' · ')
    : '';
  return (
    <Modal visible={!!info} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
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
        <View style={styles.body}>
          {shown ? (
            <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityLabel={info?.name} />
          ) : (
            <View style={styles.missing}>
              <Icon name={info?.kind === 'pdf' ? 'pdf' : 'image'} size={48} color="#cfcfd6" />
              <Text style={styles.missingText}>{file ? info?.name : t('attach.gone')}</Text>
            </View>
          )}
        </View>
        {file && info && resizing && onResize && info.width && info.height ? (
          <ResizePanel
            source={{ width: info.width, height: info.height }}
            onCancel={() => setResizingId(null)}
            onApply={(input) => onResize(info, input)}
          />
        ) : file && info ? (
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
              <Pressable onPress={() => setResizingId(info.id)} style={styles.action} accessibilityRole="button">
                <Icon name="image" size={20} color="#ffffff" />
                <Text style={styles.actionText}>{t('resize.action')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingContainer>
    </Modal>
  );
}

type Shape = ResizePreset['shape'];
const SHAPES: Shape[] = ['original', 'square', '4:3', '16:9'];
const EDGES = [null, 2048, 1024, 512] as const;
const BUDGETS = [null, 2_000_000, 1_000_000, 500_000, 200_000] as const;

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** "Resize or crop": shape, longest side or an exact size, and a largest file size; makes a copy. */
function ResizePanel({
  source,
  onCancel,
  onApply,
}: {
  source: { width: number; height: number };
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
  const nothing = !custom && shape === 'original' && edge === null && budget === null;
  const apply = async () => {
    const preset: ResizePreset = {
      shape,
      edge,
      maxBytes: budget,
      ...(custom ? { custom: { width: w, height: h } } : {}),
    };
    setBusy(true);
    try {
      await onApply(presetInput(preset, source));
    } finally {
      setBusy(false);
    }
  };
  const shapeLabel = (s: Shape) => (s === 'original' ? t('resize.original') : s === 'square' ? t('resize.square') : s);
  return (
    <KeyboardAwareScrollView containerStyle={styles.panel} contentContainerStyle={styles.panelContent}>
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
      <View style={styles.panelButtons}>
        <Pressable onPress={onCancel} style={styles.panelButton} accessibilityRole="button" disabled={busy}>
          <Text style={styles.actionText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          onPress={apply}
          style={[styles.panelButton, styles.panelPrimary, (busy || nothing || (custom && !customValid)) && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || nothing || (custom && !customValid), busy }}
          disabled={busy || nothing || (custom && !customValid)}
        >
          {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.actionText}>{t('resize.make')}</Text>}
        </Pressable>
      </View>
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
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  missingText: { color: '#cfcfd6', fontSize: 15, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 14, paddingHorizontal: 16 },
  // A long label ("Größe ändern oder zuschneiden") wraps between words under its icon instead of pushing the row
  // off the screen.
  action: { alignItems: 'center', gap: 4, minWidth: 64, minHeight: 44, flexShrink: 1 },
  actionText: { color: '#ffffff', fontSize: 13, textAlign: 'center' },
  panel: { maxHeight: '55%', backgroundColor: '#16161a' },
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
  panelButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  panelButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, minWidth: 88, alignItems: 'center' },
  panelPrimary: { backgroundColor: c.tint },
  disabled: { opacity: 0.4 },
}));
