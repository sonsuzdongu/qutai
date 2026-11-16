import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { actionErrorText } from '../agent/stepLine';
import { dayLabel, formatPercent, formatSize } from '../i18n/format';
import type { DownloadItem, DownloadStore } from '../storage/downloads';
import { isActive } from '../storage/downloads';
import { Icon, IconName } from '../ui/Icon';
import { makeStyles, readableColumn, usePalette } from '../ui/theme';
import { ActionSheet, SheetAction } from './ActionSheet';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost, dialog } from './Dialog';
import { downloadFraction } from './DownloadIndicator';
import { openDownload, shareDownload } from './openDownload';
import { Toast, useToast } from './Toast';
import { ScreenHeader } from './ScreenHeader';
import { WholeWordsText } from './WholeWordsText';

type Props = {
  visible: boolean;
  store: DownloadStore;
  copyText: (text: string) => Promise<void>;
  /** "Ask Qutai" on a downloaded PDF: attaches it to the conversation on screen (iOS, where the file is Qutai's). */
  onAsk?: (item: DownloadItem) => void;
  onClose: () => void;
};

const isPdf = (item: DownloadItem) => item.mime === 'application/pdf' || /\.pdf$/i.test(item.name);

/** An icon by the file's type. */
export function iconFor(item: DownloadItem): IconName {
  const mime = item.mime ?? '';
  if (isPdf(item)) return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'play';
  if (mime.startsWith('text/') || /word|sheet|presentation|opendocument|epub|json/.test(mime)) return 'document';
  return 'download';
}

/** "3 min" / "40 s". */
function duration(seconds: number): string {
  return seconds >= 60
    ? t('downloads.minutes', { n: Math.ceil(seconds / 60) })
    : t('downloads.seconds', { n: Math.max(1, Math.round(seconds)) });
}

/** The line under a download's name: its state, progress, speed and time left, or why it stopped. */
export function downloadStatus(item: DownloadItem): string {
  const sizes = item.total
    ? t('downloads.ofSize', { received: formatSize(item.received), total: formatSize(item.total) })
    : item.received > 0
      ? formatSize(item.received)
      : '';
  switch (item.state) {
    case 'downloading': {
      const parts = [item.total ? formatPercent(Math.min(100, Math.floor((item.received / item.total) * 100))) : '', sizes];
      if (item.speed) {
        parts.push(t('downloads.perSecond', { size: formatSize(Math.round(item.speed)) }));
        if (item.total && item.total > item.received) {
          parts.push(t('downloads.left', { time: duration((item.total - item.received) / item.speed) }));
        }
      }
      if (!item.received) parts.push(t('downloads.started'));
      return parts.filter(Boolean).join(' · ');
    }
    case 'queued':
      return t('downloads.state.queued');
    case 'paused':
      return [t('downloads.state.paused'), sizes].filter(Boolean).join(' · ');
    case 'waiting':
      return [t('downloads.state.waiting'), sizes].filter(Boolean).join(' · ');
    case 'interrupted':
      return [t('downloads.state.interrupted'), sizes].filter(Boolean).join(' · ');
    case 'failed':
      return `${t('downloads.state.failed')}: ${errorText(item.error)}`;
    case 'done':
      if (item.missing) return t('downloads.state.missing');
      return [formatSize(item.total ?? item.received), item.site, dayLabel(item.finishedAt ?? item.createdAt)]
        .filter(Boolean)
        .join(' · ');
  }
}

function errorText(error: string | null): string {
  if (error?.startsWith('http:')) return t('downloads.error.http', { code: error.slice(5) });
  switch (error) {
    case 'space':
      return t('downloads.error.space');
    case 'file':
      return t('downloads.error.file');
    case 'size':
      return t('downloads.error.size');
    case 'interrupted':
      return t('downloads.error.interrupted');
    case 'page':
      return t('downloads.error.page');
    case 'redirects':
      return t('downloads.error.redirects');
    case 'unsupported':
      return t('downloads.error.unsupported');
    default:
      return t('downloads.error.network');
  }
}

/**
 * Downloads, one screen for both platforms: in progress (pause / resume / cancel; Android also retry and the
 * notification) and finished (open, share, show in folder, copy link, remove from list, delete file), with search and
 * "Clear finished" (the list only). iOS keeps the files in Qutai; Android saves them in the public Downloads folder.
 */
export function DownloadsScreen({ visible, store, copyText, onAsk, onClose }: Props) {
  const styles = useStyles();
  const palette = usePalette();
  useSyncExternalStore(store.subscribe, store.getVersion);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<DownloadItem | null>(null);
  const all = store.list();
  // Its own toast: the app's is drawn under this sheet (a separate window on Android), where nobody sees it.
  const toast = useToast();
  /** Runs an action and shows its message or error as a toast. */
  const run = (action: () => Promise<string | void>) => {
    action().then(
      (message) => message && toast.show(message),
      (e: unknown) => toast.show(actionErrorText(e)),
    );
  };

  useEffect(() => {
    if (visible) store.seen();
  }, [visible, store]);
  const close = () => {
    setQuery('');
    onClose();
  };

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (i: DownloadItem) => !q || i.name.toLowerCase().includes(q) || i.site.toLowerCase().includes(q);
    const active = all.filter((i) => isActive(i) || i.state === 'interrupted').filter(match);
    const finished = all.filter((i) => i.state === 'done' || i.state === 'failed').filter(match);
    return [
      ...(active.length ? [{ key: 'active', title: t('downloads.sectionActive'), data: active }] : []),
      ...(finished.length ? [{ key: 'done', title: t('downloads.sectionDone'), data: finished }] : []),
    ];
    // The store's version changes `all`.
  }, [all, query]);

  const open = (item: DownloadItem) => void openDownload(store, item, toast.show);
  const share = (item: DownloadItem) => void shareDownload(store, item, toast.show);

  const deleteFile = async (item: DownloadItem) => {
    const ok = await dialog.confirm({
      title: t('downloads.deleteConfirm', { name: item.name }),
      message: t('downloads.deleteConfirmMessage'),
      confirmText: t('downloads.delete'),
      destructive: true,
    });
    if (!ok) return;
    run(async () => {
      if (!(await store.deleteFile(item.id))) return t('downloads.deleteFailed');
    });
  };

  const actionsFor = (item: DownloadItem): SheetAction[] => {
    const actions: SheetAction[] = [];
    const done = item.state === 'done';
    if (done && !item.missing) {
      actions.push(
        { icon: 'openInNew', label: t('downloads.open'), onPress: () => open(item) },
        { icon: 'share', label: t('downloads.share'), onPress: () => share(item) },
      );
      if (onAsk && isPdf(item) && Platform.OS === 'ios') {
        actions.push({ icon: 'assistant', label: t('downloads.ask'), onPress: () => onAsk(item) });
      }
      if (store.canShowFolder) {
        actions.push({
          icon: 'folder',
          label: t('downloads.showFolder'),
          onPress: () =>
            run(async () => {
              if (!(await store.showFolder())) return t('downloads.noFolder');
            }),
        });
      }
    }
    if (store.canPause && item.resumable) {
      if (item.state === 'downloading' || item.state === 'queued' || item.state === 'waiting') {
        actions.push({ icon: 'pause', label: t('downloads.pause'), onPress: () => store.pause(item.id) });
      } else if (item.state === 'paused' || item.state === 'interrupted') {
        actions.push({ icon: 'play', label: t('downloads.resume'), onPress: () => store.resume(item.id) });
      } else if (item.state === 'failed') {
        actions.push({ icon: 'reload', label: t('downloads.retry'), onPress: () => store.retry(item.id) });
      }
    }
    if (/^https?:/i.test(item.url)) {
      actions.push({
        icon: 'link',
        label: t('downloads.copyLink'),
        onPress: () =>
          run(async () => {
            await copyText(item.url);
            return t('common.copied');
          }),
      });
    }
    if (done || item.state === 'failed') {
      actions.push({ icon: 'close', label: t('downloads.removeFromList'), onPress: () => store.remove(item.id) });
    }
    if (done && !item.missing) {
      actions.push({ icon: 'close', label: t('downloads.delete'), destructive: true, onPress: () => deleteFile(item) });
    } else if (!done && item.state !== 'failed') {
      actions.push({ icon: 'close', label: t('downloads.cancel'), destructive: true, onPress: () => store.cancel(item.id) });
    }
    return actions;
  };

  /** The one button on the row: pause / resume / retry, or cancel where pausing doesn't exist. */
  const rowButton = (item: DownloadItem) => {
    const canPause = store.canPause && item.resumable;
    if (item.state === 'done') return null;
    if (canPause && (item.state === 'downloading' || item.state === 'queued' || item.state === 'waiting')) {
      return { icon: 'pause' as const, label: t('downloads.pause'), onPress: () => store.pause(item.id) };
    }
    if (canPause && (item.state === 'paused' || item.state === 'interrupted')) {
      return { icon: 'play' as const, label: t('downloads.resume'), onPress: () => store.resume(item.id) };
    }
    if (canPause && item.state === 'failed') {
      return { icon: 'reload' as const, label: t('downloads.retry'), onPress: () => store.retry(item.id) };
    }
    if (item.state === 'failed') return null;
    return { icon: 'close' as const, label: t('downloads.cancel'), onPress: () => store.cancel(item.id) };
  };

  const anyRunning = all.some((i) => i.resumable && (i.state === 'downloading' || i.state === 'queued' || i.state === 'waiting'));
  const anyPaused = all.some((i) => i.resumable && (i.state === 'paused' || i.state === 'interrupted'));
  const anyFinished = all.some((i) => i.state === 'done' || i.state === 'failed');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <ScreenHeader title={t('downloads.title')} right={{ label: t('common.done'), onPress: close }} />
        {all.length > 0 ? (
          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('downloads.search')}
              placeholderTextColor={palette.textSecondary}
              style={styles.search}
              accessibilityLabel={t('downloads.search')}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
          </View>
        ) : null}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={styles.where}>{t(Platform.OS === 'android' ? 'downloads.whereAndroid' : 'downloads.whereIos')}</Text>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{all.length ? t('downloads.noMatch') : t('downloads.empty')}</Text>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {section.title}
              </Text>
              {section.key === 'active' && store.canPause && (anyRunning || anyPaused) ? (
                <Pressable
                  onPress={() => (anyRunning ? store.pauseAll() : store.resumeAll())}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <WholeWordsText style={styles.sectionAction}>{anyRunning ? t('downloads.pauseAll') : t('downloads.resumeAll')}</WholeWordsText>
                </Pressable>
              ) : null}
              {section.key === 'done' && anyFinished ? (
                <Pressable
                  onPress={() => run(() => store.clearFinished())}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityHint={t('downloads.clearFinishedHint')}
                >
                  <WholeWordsText style={styles.sectionAction}>{t('downloads.clearFinished')}</WholeWordsText>
                </Pressable>
              ) : null}
            </View>
          )}
          renderItem={({ item }) => {
            const active = item.state !== 'done' && item.state !== 'failed';
            const fraction = downloadFraction(item);
            const button = rowButton(item);
            const status = downloadStatus(item);
            const note = item.restarted && active ? t(`downloads.restarted.${item.restarted}`) : null;
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => (item.state === 'done' && !item.missing ? open(item) : setMenu(item))}
                onLongPress={() => setMenu(item)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                accessibilityLabel={`${item.name}, ${status}`}
                accessibilityHint={item.state === 'done' ? t('downloads.open') : undefined}
              >
                <View style={styles.iconWrap}>
                  <Icon
                    name={iconFor(item)}
                    size={22}
                    color={item.state === 'failed' || item.missing ? palette.textSecondary : palette.tintText}
                  />
                </View>
                <View style={styles.texts}>
                  <Text style={[styles.name, item.missing && styles.dim]} numberOfLines={2}>
                    {item.incognito ? `${t('downloads.incognito')} · ` : ''}
                    {item.name}
                  </Text>
                  {active ? (
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.bar,
                          item.state !== 'downloading' && styles.barIdle,
                          { width: `${Math.round((fraction ?? (item.state === 'downloading' ? 0.15 : 0)) * 100)}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                  <Text style={[styles.meta, item.state === 'failed' && styles.error]} numberOfLines={2}>
                    {active && item.site ? `${item.site} · ${status}` : status}
                  </Text>
                  {note ? (
                    <Text style={styles.meta} numberOfLines={2}>
                      {note}
                    </Text>
                  ) : null}
                </View>
                {button ? (
                  <Pressable
                    onPress={button.onPress}
                    hitSlop={8}
                    style={styles.button}
                    accessibilityRole="button"
                    accessibilityLabel={`${button.label}: ${item.name}`}
                  >
                    <Icon name={button.icon} size={20} color={palette.textSecondary} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setMenu(item)}
                  hitSlop={8}
                  style={styles.button}
                  accessibilityRole="button"
                  accessibilityLabel={t('downloads.more', { name: item.name })}
                >
                  <Icon name="moreHorizontal" size={20} color={palette.textSecondary} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
      <ActionSheet title={menu ? menu.name : null} actions={menu ? actionsFor(menu) : []} onClose={() => setMenu(null)} />
      <Toast key={toast.key} message={toast.message} action={toast.action} onHidden={toast.hide} />
      <DialogHost />
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  search: {
    fontSize: 15,
    color: c.text,
    backgroundColor: c.sunken,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  list: { ...readableColumn, padding: 16, gap: 8 },
  where: { fontSize: 13, color: c.textSecondary, marginBottom: 4 },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  // At a large text size the action ("Abgeschlossene entfernen") moves under the section name instead of running
  // off the screen.
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
    marginTop: 12,
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase' },
  sectionAction: { fontSize: 14, color: c.tintText, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  pressed: { backgroundColor: c.pressed },
  iconWrap: { width: 28, alignItems: 'center' },
  texts: { flex: 1, gap: 2 },
  name: { fontSize: 15, color: c.text },
  dim: { color: c.textSecondary },
  meta: { fontSize: 12, color: c.textSecondary },
  error: { color: '#d64545' },
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  track: { height: 3, borderRadius: 2, backgroundColor: c.sunken, overflow: 'hidden', marginVertical: 3 },
  bar: { height: 3, borderRadius: 2, backgroundColor: c.tint },
  barIdle: { backgroundColor: c.textSecondary },
}));
