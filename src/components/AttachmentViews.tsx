import { useMemo } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { attachmentLabel, AttachmentInfo } from '../chat/attachments';
import { modelFile, originalFile } from '../device/attachments';
import { t } from '../i18n';
import { formatSize } from '../i18n/format';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';

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
  const label = `${attachmentLabel(info, index)}: ${info.name}`;
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

/** Full-screen view of an attachment, with Share and Save (images to Photos). */
export function AttachmentPreview({
  info,
  onClose,
  onShare,
  onSave,
}: {
  info: AttachmentInfo | null;
  onClose: () => void;
  onShare: (info: AttachmentInfo) => void;
  onSave: (info: AttachmentInfo) => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const file = useMemo(() => (info ? originalFile(info.id) : null), [info]);
  const shown = info?.kind === 'image' ? (file?.uri ?? null) : null;
  const details = info
    ? [info.width && info.height ? `${info.width}×${info.height}` : '', formatSize(info.size)].filter(Boolean).join(' · ')
    : '';
  return (
    <Modal visible={!!info} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.preview, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
        {file && info ? (
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
          </View>
        ) : null}
      </View>
    </Modal>
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
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 36, paddingVertical: 14 },
  action: { alignItems: 'center', gap: 4, minWidth: 64 },
  actionText: { color: '#ffffff', fontSize: 13 },
}));
