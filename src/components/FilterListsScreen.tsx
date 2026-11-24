import { useEffect, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BlockingError,
  BlockingErrorCode,
  contentBlocking,
  ListKind,
  ListProgress,
  ListState,
  MAX_LIST_BYTES,
} from '../content/blocking';
import { hasNativeBlocking } from '../device/contentBlocker';
import { t } from '../i18n';
import { formatDateTime, formatNumber } from '../i18n/format';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { makeStyles, readableColumn, usePalette, common } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';
import { SiteRulesSection } from './SiteRulesSection';
import { ScreenHeader } from './ScreenHeader';

type Props = {
  visible: boolean;
  /** "Block ads and trackers" is on. */
  blockingEnabled: boolean;
  /** Downloads are allowed: the user accepted the terms and blocking is on. */
  allowed: boolean;
  onClose: () => void;
};

function reasonText(code: BlockingErrorCode, status?: number): string {
  if (code === 'http') return t('blocking.error.http', { status: status ?? 0 });
  if (code === 'tooBig') return t('blocking.error.tooBig', { mb: Math.round(MAX_LIST_BYTES / 1024 / 1024) });
  return t(`blocking.error.${code}`);
}

/** The alert's text: each list that failed with its reason ("AdGuard German filter: …"), or the one reason. */
function errorText(e: unknown): string {
  if (!(e instanceof BlockingError)) return t('blocking.error.network');
  if (e.lists?.length)
    return e.lists.map((l) => t('blocking.failedList', { name: l.name, reason: reasonText(l.code, l.status) })).join('\n');
  return reasonText(e.code, e.status);
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The filter lists for network blocking: switches, custom lists, updates, reset. */
export function FilterListsScreen({ visible, blockingEnabled, allowed, onClose }: Props) {
  const styles = useStyles();
  useSyncExternalStore(contentBlocking.subscribe, contentBlocking.getVersion);
  const [busy, setBusy] = useState(false);
  const { lists, status, compiled, active } = contentBlocking;
  const native = hasNativeBlocking();
  const palette = usePalette();
  const publisherLists = lists.filter((l) => l.kind !== 'custom');
  const myLists = lists.filter((l) => l.kind === 'custom');
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const dragged = useRef(false);
  useEffect(() => {
    if (!visible) return;
    dragged.current = false;
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [visible]);

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      dialog.alert(t('blocking.failedTitle'), errorText(e));
    } finally {
      setBusy(false);
    }
  };

  /** A list's switch or "Try again": no screen-wide lock, the row shows its own progress; a cancel says nothing. */
  const runList = async (task: () => Promise<unknown>) => {
    try {
      await task();
    } catch (e) {
      if (e instanceof BlockingError && e.code === 'cancelled') return;
      dialog.alert(t('blocking.failedTitle'), errorText(e));
    }
  };

  const addList = async () => {
    const url = await dialog.prompt({
      title: t('blocking.addTitle'),
      message: t('blocking.addBody'),
      label: t('blocking.addLabel'),
      placeholder: 'https://',
      maxLength: 2048,
      confirmText: t('blocking.addConfirm'),
    });
    if (!url) return;
    await run(async () => {
      const list = await contentBlocking.addCustom(url);
      dialog.alert(
        t('blocking.addedTitle'),
        t('blocking.addedBody', {
          name: list.name,
          size: sizeLabel(list.bytes ?? 0),
          used: formatNumber(list.stats?.used ?? 0),
          rules: formatNumber(list.stats?.rules ?? 0),
          domains: formatNumber(list.domains ?? 0),
        }),
      );
    });
  };

  const statusLine = (() => {
    if (!native) return t('blocking.status.needsBuild');
    if (!blockingEnabled) return t('blocking.status.off');
    if (status.phase === 'downloading') return t('blocking.status.downloading', { name: status.name });
    if (status.phase === 'compiling') return t('blocking.status.compiling', { done: status.done, total: status.total });
    if (active && compiled) return t('blocking.status.active', { domains: formatNumber(compiled.domains) });
    if (!allowed) return t('blocking.status.waitingTerms');
    return t('blocking.status.notYet');
  })();

  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <ScreenHeader title={t('blocking.title')} right={{ label: t('common.done'), onPress: onClose }} />
        <ScrollView
          ref={scroller}
          contentContainerStyle={styles.content}
          // Opens at the top: until the user scrolls, content that grows or arrives late (the rules, a list's row)
          // never leaves the screen scrolled down (UI-57).
          onScrollBeginDrag={() => {
            dragged.current = true;
          }}
          onContentSizeChange={() => {
            if (!dragged.current) scroller.current?.scrollTo({ y: 0, animated: false });
          }}
        >
          <Text style={styles.hint}>{t('blocking.intro')}</Text>
          <View style={styles.statusRow}>
            {blockingEnabled && status.phase !== 'idle' && <ActivityIndicator size="small" color={palette.tintText} />}
            <Text style={[styles.status, styles.flex, active && blockingEnabled && styles.statusOn]}>{statusLine}</Text>
          </View>
          {Platform.OS === 'ios' && <Text style={styles.hint}>{t('blocking.iosNoCounts')}</Text>}

          {/* Grouped (UI-57): the publishers' lists, the user's own lists, then the user's rules, styles and scripts. */}
          <Text style={styles.heading} accessibilityRole="header">
            {t('blocking.publisherSection')}
          </Text>
          {publisherLists.map((list) => (
            <ListRow
              key={list.id}
              list={list}
              progress={contentBlocking.progressOf(list.id)}
              disabled={!blockingEnabled}
              onToggle={(on) => runList(() => contentBlocking.setEnabled(list.id, on, allowed))}
              onRetry={allowed ? () => runList(() => contentBlocking.retry(list.id, allowed)) : undefined}
              onRemove={
                list.kind === 'custom'
                  ? async () => {
                      const ok = await dialog.confirm({
                        title: t('blocking.removeTitle'),
                        message: list.url,
                        confirmText: t('blocking.remove'),
                        destructive: true,
                      });
                      if (ok) await run(() => contentBlocking.removeCustom(list.id));
                    }
                  : undefined
              }
            />
          ))}
          <Button
            variant="secondary"
            label={t('blocking.updateNow')}
            disabled={busy || !allowed}
            onPress={() => run(() => contentBlocking.updateNow())}
          />
          <Text style={styles.hint}>{t('blocking.updatesHint')}</Text>
          <Text style={styles.hint}>{t('blocking.boundaryHint')}</Text>

          <Text style={[styles.heading, styles.group]} accessibilityRole="header">
            {t('blocking.mineSection')}
          </Text>
          {myLists.length === 0 && <Text style={styles.hint}>{t('blocking.mineNone')}</Text>}
          {myLists.map((list) => (
            <ListRow
              key={list.id}
              list={list}
              progress={contentBlocking.progressOf(list.id)}
              disabled={!blockingEnabled}
              onToggle={(on) => runList(() => contentBlocking.setEnabled(list.id, on, allowed))}
              onRetry={allowed ? () => runList(() => contentBlocking.retry(list.id, allowed)) : undefined}
              onRemove={
                list.kind === 'custom'
                  ? async () => {
                      const ok = await dialog.confirm({
                        title: t('blocking.removeTitle'),
                        message: list.url,
                        confirmText: t('blocking.remove'),
                        destructive: true,
                      });
                      if (ok) await run(() => contentBlocking.removeCustom(list.id));
                    }
                  : undefined
              }
            />
          ))}
          <Button variant="secondary" label={t('blocking.add')} disabled={busy || !allowed} onPress={addList} />
          <Button
            variant="secondary"
            label={t('blocking.reset')}
            danger
            disabled={busy}
            onPress={async () => {
              const ok = await dialog.confirm({
                title: t('blocking.resetTitle'),
                message: t('blocking.resetBody'),
                confirmText: t('blocking.resetConfirm'),
                destructive: true,
              });
              if (ok) await run(() => contentBlocking.reset(allowed));
            }}
          />
          <SiteRulesSection disabled={!blockingEnabled} />
        </ScrollView>
      </SafeAreaView>
      <DialogHost />
    </AppModal>
  );
}

function ListRow({
  list,
  progress,
  disabled,
  onToggle,
  onRetry,
  onRemove,
}: {
  list: ListState;
  /** Waiting for or in the current download run. */
  progress?: ListProgress;
  disabled: boolean;
  /** Switching a waiting or downloading list off cancels it. */
  onToggle: (on: boolean) => void;
  /** "Try again" after a failure (only when downloads are allowed). */
  onRetry?: () => void;
  onRemove?: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const details: string[] = [];
  if (list.fetchedAt && list.stats) {
    details.push(
      t('blocking.listStats', {
        date: formatDateTime(new Date(list.fetchedAt)),
        size: sizeLabel(list.bytes ?? 0),
        used: formatNumber(list.stats.used),
        rules: formatNumber(list.stats.rules),
      }),
    );
  } else if (list.error && !progress) details.push(t('blocking.row.failed'));
  else if (list.enabled && !progress) details.push(t('blocking.notDownloaded'));
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.name}>{list.name}</Text>
          <Text style={styles.hint}>{kindLabel(list)}</Text>
        </View>
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('blocking.remove')} style={styles.remove}>
            <Icon name="close" size={16} color={palette.textSecondary} />
          </Pressable>
        )}
        <ThemedSwitch
          value={list.enabled}
          disabled={disabled}
          onValueChange={onToggle}
          accessibilityLabel={list.name}
        />
      </View>
      {details.map((d) => (
        <Text key={d} style={styles.hint}>
          {d}
        </Text>
      ))}
      {progress && (
        <View style={styles.progress}>
          <ActivityIndicator size="small" color={palette.tintText} />
          <Text style={styles.hint}>{t(progress === 'downloading' ? 'blocking.row.downloading' : 'blocking.row.queued')}</Text>
        </View>
      )}
      {list.error && !progress && (
        <Text style={styles.error}>
          {reasonText(list.error, list.errorStatus)}
          {onRetry && !disabled && (
            <Text style={styles.link} onPress={onRetry} accessibilityRole="button">
              {' · '}
              {t('blocking.row.retry')}
            </Text>
          )}
        </Text>
      )}
      {list.kind === 'custom' ? (
        <Text style={styles.hint} selectable numberOfLines={2}>
          {list.url}
        </Text>
      ) : (
        <View style={styles.links}>
          {list.homepage && (
            <Text style={styles.link} onPress={() => Linking.openURL(list.homepage!)}>
              {t('blocking.homepage')}
            </Text>
          )}
          {list.licenseUrl && (
            <Text style={styles.link} onPress={() => Linking.openURL(list.licenseUrl!)}>
              {t('blocking.licence', { licence: list.license ?? '' })}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}


const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { ...readableColumn, padding: 16, gap: 10 },
  flex: { flex: 1 },
  hint: common(c).hint,
  status: { fontSize: 14, color: c.text, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusOn: { color: c.tintText },
  card: { ...common(c).card, padding: 14, gap: 4 },
  row: common(c).row,
  name: common(c).label,
  error: { fontSize: 13, color: c.danger, lineHeight: 18 },
  links: { flexDirection: 'row', gap: 16, marginTop: 2 },
  link: { fontSize: 13, color: c.tintText, fontWeight: '600' },
  remove: { paddingHorizontal: 4 },
  heading: { fontSize: 17, fontWeight: '700', color: c.text, marginTop: 8 },
  group: { marginTop: 18 },
  danger: { color: c.danger },
  pressed: { backgroundColor: c.pressed },
  disabled: { opacity: 0.5 },
}));

/**
 * What a list blocks. The Turkish list keeps its own wording; the other regional lists read "Ads · Deutsch" (the
 * sites' language in itself, which needs no translation).
 */
function kindLabel(list: { id: string; kind: ListKind }): string {
  const region = REGIONAL_LANGUAGE[list.id];
  return region ? `${t('blocking.kind.ads')} · ${region}` : t(`blocking.kind.${list.kind}`);
}

const REGIONAL_LANGUAGE: Record<string, string> = {
  'adguard-german': 'Deutsch',
  'adguard-spanish-portuguese': 'Español · Português',
  'adguard-french': 'Français',
  'adguard-japanese': '日本語',
  'adguard-russian': 'Русский',
  abpindo: 'Bahasa Indonesia',
};
