import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import type { ActiveDownload, DownloadStore } from '../storage/downloads';
import { makeStyles } from '../ui/theme';

/** "42%" when the size is known, else the bytes so far ("3.1 MB"), or "" before anything arrived. */
export function downloadProgressLabel(a: ActiveDownload): string {
  if (a.totalBytes) return `${Math.min(100, Math.floor((a.bytesWritten / a.totalBytes) * 100))}%`;
  return a.bytesWritten > 0 ? formatBytes(a.bytesWritten) : '';
}

/** 0…1 when the size is known, else null (an indeterminate bar). */
export function downloadFraction(a: ActiveDownload): number | null {
  return a.totalBytes ? Math.min(1, a.bytesWritten / a.totalBytes) : null;
}

type Props = {
  store: DownloadStore;
  /** Distance from the bottom safe area (above a bottom address bar). */
  bottomOffset: number;
  onOpen: () => void;
};

/**
 * A small pill over the page while files download (iOS): the newest download's name and progress,
 * a cancel button, and a tap opens the Downloads screen.
 */
export function DownloadIndicator({ store, bottomOffset, onOpen }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  useSyncExternalStore(store.subscribe, store.getVersion);
  const active = store.activeList();
  const current = active[active.length - 1];
  if (!current) return null;
  const fraction = downloadFraction(current);
  const progress = downloadProgressLabel(current);
  const more = active.length > 1 ? ` +${active.length - 1}` : '';
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + bottomOffset }]} pointerEvents="box-none">
      <Pressable
        onPress={onOpen}
        style={styles.pill}
        accessibilityRole="button"
        accessibilityLabel={t('downloads.inProgress', { name: current.name, progress })}
      >
        <Text style={styles.icon}>⬇</Text>
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {current.name}
            {more}
          </Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${Math.round((fraction ?? 0.15) * 100)}%` }]} />
          </View>
        </View>
        {progress ? <Text style={styles.progress}>{progress}</Text> : null}
        <Pressable
          onPress={() => store.cancel(current.id)}
          hitSlop={10}
          style={styles.cancel}
          accessibilityLabel={t('downloads.cancel')}
        >
          <Text style={styles.cancelText}>✕</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const useStyles = makeStyles((c) => ({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '86%',
    minWidth: 220,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  icon: { fontSize: 14, color: c.tintText },
  texts: { flex: 1, gap: 4 },
  name: { fontSize: 13, color: c.text },
  track: { height: 3, borderRadius: 2, backgroundColor: c.sunken, overflow: 'hidden' },
  bar: { height: 3, borderRadius: 2, backgroundColor: c.tint },
  progress: { fontSize: 12, color: c.textSecondary, fontVariant: ['tabular-nums'] },
  cancel: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, color: c.textSecondary },
}));
