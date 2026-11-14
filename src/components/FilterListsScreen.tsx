import { useState, useSyncExternalStore } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlockingError, contentBlocking, ListState, MAX_LIST_BYTES } from '../content/blocking';
import { hasNativeBlocking } from '../device/contentBlocker';
import { t } from '../i18n';
import { formatDateTime, formatNumber } from '../i18n/format';
import { makeStyles } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';

type Props = {
  visible: boolean;
  /** "Block ads and trackers" is on. */
  blockingEnabled: boolean;
  /** Downloads are allowed: the user accepted the terms and blocking is on. */
  allowed: boolean;
  onClose: () => void;
};

function errorText(e: unknown): string {
  if (!(e instanceof BlockingError)) return t('blocking.error.network');
  if (e.code === 'http') return t('blocking.error.http', { status: e.status ?? 0 });
  if (e.code === 'tooBig') return t('blocking.error.tooBig', { mb: Math.round(MAX_LIST_BYTES / 1024 / 1024) });
  return t(`blocking.error.${e.code}`);
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <View style={styles.header}>
          <View style={styles.side} />
          <Text style={styles.title}>{t('blocking.title')}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={[styles.side, styles.right]}>
            <Text style={styles.done}>{t('common.done')}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.hint}>{t('blocking.intro')}</Text>
          <Text style={[styles.status, active && blockingEnabled && styles.statusOn]}>{statusLine}</Text>
          {Platform.OS === 'ios' && <Text style={styles.hint}>{t('blocking.iosNoCounts')}</Text>}

          {lists.map((list) => (
            <ListRow
              key={list.id}
              list={list}
              disabled={busy || !blockingEnabled}
              onToggle={(on) => run(() => contentBlocking.setEnabled(list.id, on, allowed))}
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

          <View style={styles.buttons}>
            <Button label={t('blocking.add')} disabled={busy || !allowed} onPress={addList} />
            <Button
              label={t('blocking.updateNow')}
              disabled={busy || !allowed}
              onPress={() => run(() => contentBlocking.updateNow())}
            />
            <Button
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
          </View>
          <Text style={styles.hint}>{t('blocking.updatesHint')}</Text>
          <Text style={styles.hint}>{t('blocking.boundaryHint')}</Text>
        </ScrollView>
      </SafeAreaView>
      <DialogHost />
    </Modal>
  );
}

function ListRow({
  list,
  disabled,
  onToggle,
  onRemove,
}: {
  list: ListState;
  disabled: boolean;
  onToggle: (on: boolean) => void;
  onRemove?: () => void;
}) {
  const styles = useStyles();
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
  } else if (list.enabled) details.push(t('blocking.notDownloaded'));
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.name}>{list.name}</Text>
          <Text style={styles.hint}>{t(`blocking.kind.${list.kind}`)}</Text>
        </View>
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={t('blocking.remove')} style={styles.remove}>
            <Text style={styles.removeText}>✕</Text>
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
      {list.error && <Text style={styles.error}>{errorText(new BlockingError(list.error))}</Text>}
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

function Button({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole="button"
    >
      <Text style={[styles.buttonText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  side: { flex: 1 },
  right: { alignItems: 'flex-end' },
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  done: { fontSize: 16, color: c.tintText, fontWeight: '600' },
  content: { padding: 16, gap: 10 },
  flex: { flex: 1 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  status: { fontSize: 14, color: c.text, fontWeight: '600' },
  statusOn: { color: c.tintText },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15, fontWeight: '600', color: c.text },
  error: { fontSize: 13, color: c.danger, lineHeight: 18 },
  links: { flexDirection: 'row', gap: 16, marginTop: 2 },
  link: { fontSize: 13, color: c.tintText, fontWeight: '600' },
  remove: { paddingHorizontal: 4 },
  removeText: { fontSize: 16, color: c.textSecondary },
  buttons: { gap: 8, marginTop: 6 },
  button: { backgroundColor: c.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600', color: c.tintText },
  danger: { color: c.danger },
  pressed: { backgroundColor: c.pressed },
  disabled: { opacity: 0.5 },
}));
