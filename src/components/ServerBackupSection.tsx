import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccountState } from '../account';
import {
  backUpNow,
  deleteAllServerBackups,
  deleteServerBackup,
  downloadServerBackup,
  keepPassword,
  keptPassword,
  listServerBackups,
  loadServerBackup,
  savePrefs,
  serverBackupConfig,
  useServerBackup,
  type BackupOutcome,
  type ServerBackup,
  type ServerBackupErrorKind,
  type ServerBackupPrefs,
} from '../backup/server';
import { errorDetails, errorKind, MIN_BACKUP_PASSWORD, newPasswordProblem, type RunRecord, type SkipReason } from '../backup/server/logic';
import { MessageKey, t } from '../i18n';
import { formatDateTime, formatPercent, formatSize } from '../i18n/format';
import { AppModal } from '../ui/AppModal';
import { Button } from '../ui/Button';
import { GroupLink, GroupSwitch, SettingsSection } from '../ui/SettingsRows';
import { makeStyles, readableColumn, usePalette, radii, common } from '../ui/theme';
import { useAppsDataSize, type ServerRestoreJob } from './BackupScreen';
import { PasswordField } from '../ui/PasswordField';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';
import { ErrorDetails } from './ErrorDetails';
import { KeyboardAwareScrollView } from './KeyboardAware';
import { ScreenHeader } from './ScreenHeader';

/**
 * Settings › Backup › Qutai account (docs/server-backup.md): back up now, the account's backups (restore, delete), the
 * daily automatic backup and the backup password. Pro mode, signed in, and a server that offers backups only.
 */

const ERROR_KEYS: Record<ServerBackupErrorKind, MessageKey> = {
  'wrong-password': 'backup.error.wrongPassword',
  offline: 'serverBackup.error.offline',
  quota: 'serverBackup.error.quota',
  'too-large': 'serverBackup.error.tooLarge',
  'signed-out': 'serverBackup.error.signedOut',
  suspended: 'serverBackup.error.suspended',
  unavailable: 'serverBackup.error.unavailable',
  damaged: 'serverBackup.error.damaged',
  'not-found': 'serverBackup.error.notFound',
  cancelled: 'serverBackup.error.cancelled',
  'needs-build': 'serverBackup.error.needsBuild',
  unknown: 'serverBackup.error.unknown',
};

const SKIP_KEYS: Record<SkipReason, MessageKey> = {
  'no-password': 'serverBackup.skip.noPassword',
  incognito: 'serverBackup.skip.incognito',
  offline: 'serverBackup.skip.offline',
  'not-wifi': 'serverBackup.skip.notWifi',
  'network-unknown': 'serverBackup.skip.networkUnknown',
  suspended: 'serverBackup.skip.suspended',
};

/** A plain sentence for an error kind (the screen's errors: wrong password, offline, quota, too large, signed out…). */
export function serverBackupErrorText(kind: ServerBackupErrorKind): string {
  return t(ERROR_KEYS[kind]);
}

function reasonText(record: RunRecord): string {
  const r = record.reason;
  if (!r) return '';
  if (r in SKIP_KEYS) return t(SKIP_KEYS[r as SkipReason]);
  return t(ERROR_KEYS[r as ServerBackupErrorKind]);
}

function statusLine(lastSuccessAt: number | undefined, last: RunRecord | undefined): string {
  const lines: string[] = [];
  lines.push(
    lastSuccessAt
      ? t('serverBackup.lastBackup', {
          date: formatDateTime(new Date(lastSuccessAt)),
        })
      : t('serverBackup.never'),
  );
  if (last && last.result === 'done' && last.appDataLeftOut) lines.push(t('serverBackup.appDataLeftOutLine'));
  if (last && last.result !== 'done' && (!lastSuccessAt || last.at > lastSuccessAt)) {
    const date = formatDateTime(new Date(last.at));
    lines.push(
      last.result === 'skipped'
        ? t('serverBackup.lastSkipped', { date, reason: reasonText(last) })
        : t('serverBackup.lastFailed', { date, reason: reasonText(last) }),
    );
  }
  return lines.join('\n');
}

type ListState = { status: 'loading' } | { status: 'ready'; backups: ServerBackup[] } | { status: 'failed'; error: unknown };

export function ServerBackupSection({ onRestore }: { onRestore: (job: ServerRestoreJob) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const account = useAccountState();
  const { state, hasPassword, job } = useServerBackup();
  const [config, setConfig] = useState<{ maxBytes: number; keep: number } | null | undefined>(undefined);
  const appData = useAppsDataSize();
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [passwordSheet, setPasswordSheet] = useState<null | {
    change: boolean;
    thenBackUp: boolean;
  }>(null);
  const userId = account.status === 'signedIn' ? account.user.id : null;

  useEffect(() => {
    void loadServerBackup();
    let live = true;
    serverBackupConfig().then((c) => live && setConfig(c));
    return () => {
      live = false;
    };
  }, []);

  // State is set only in the answer's callbacks (the list shows "loading" from the start and on a retry).
  const refresh = useCallback(
    () =>
      listServerBackups().then(
        (backups) => setList({ status: 'ready', backups }),
        (error: unknown) => setList({ status: 'failed', error }),
      ),
    [],
  );

  useEffect(() => {
    if (userId && config) void refresh();
  }, [userId, config, refresh]);

  // A finished backup (automatic or by hand) shows in the list.
  const lastSuccess = userId ? state.accounts[userId]?.lastSuccessAt : undefined;
  useEffect(() => {
    if (lastSuccess && userId && config) void refresh();
  }, [lastSuccess, userId, config, refresh]);

  if (!userId) {
    return (
      <View style={styles.block}>
        <Text style={styles.title}>{t('serverBackup.title')}</Text>
        <Text style={styles.hint}>{t('serverBackup.signedOut')}</Text>
      </View>
    );
  }
  if (config === undefined) {
    return (
      <View style={styles.block}>
        <Text style={styles.title}>{t('serverBackup.title')}</Text>
        <ActivityIndicator color={palette.tintText} />
      </View>
    );
  }
  if (config === null) {
    return (
      <View style={styles.block}>
        <Text style={styles.title}>{t('serverBackup.title')}</Text>
        <Text style={styles.hint}>{t('serverBackup.unavailable')}</Text>
      </View>
    );
  }

  const prefs = state.prefs;
  const setPref = (change: Partial<ServerBackupPrefs>) => void savePrefs({ ...prefs, ...change });
  const accountState = state.accounts[userId] ?? {};
  const busy = job.kind !== 'idle';

  const showError = (title: string, error: unknown, kind = errorKind(error)) => {
    if (kind === 'cancelled') return;
    dialog.alert(title, serverBackupErrorText(kind), undefined, error ? errorDetails(error) : undefined);
  };

  /** Over the account's limit with the apps' data: it was backed up without; say so (docs/mini-apps.md). */
  const noteLeftOut = (outcome: BackupOutcome) => {
    if (!outcome.ok || !outcome.appDataLeftOut) return;
    dialog.alert(
      t('serverBackup.appDataLeftOutTitle'),
      t('serverBackup.appDataLeftOut', { size: formatSize(outcome.appDataLeftOut.bytes), limit: formatSize(outcome.appDataLeftOut.limit) }),
    );
  };

  const runBackup = async () => {
    if (busy) return;
    if (!keptPassword()) {
      setPasswordSheet({ change: false, thenBackUp: true });
      return;
    }
    const outcome = await backUpNow('manual');
    if (!outcome.ok) showError(t('serverBackup.failedTitle'), outcome.error, outcome.kind);
    else noteLeftOut(outcome);
  };

  const restore = async (backup: ServerBackup) => {
    if (busy) return;
    let file: Uint8Array;
    try {
      file = await downloadServerBackup(backup);
    } catch (error) {
      showError(t('serverBackup.restoreFailedTitle'), error);
      return;
    }
    onRestore({ file, keptPassword: keptPassword() });
  };

  const remove = async (backup: ServerBackup) => {
    const confirmed = await dialog.confirm({
      title: t('serverBackup.deleteConfirmTitle'),
      message: t('serverBackup.deleteConfirmBody', {
        date: formatDateTime(new Date(backup.createdAt)),
      }),
      confirmText: t('serverBackup.delete'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteServerBackup(backup.id);
    } catch (error) {
      if (errorKind(error) !== 'not-found') showError(t('serverBackup.deleteFailedTitle'), error);
    }
    void refresh();
  };

  const removeAll = async () => {
    const confirmed = await dialog.confirm({
      title: t('serverBackup.deleteAllConfirmTitle'),
      message: t('serverBackup.deleteAllConfirmBody'),
      confirmText: t('serverBackup.deleteAllConfirm'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteAllServerBackups();
    } catch (error) {
      showError(t('serverBackup.deleteFailedTitle'), error);
    }
    void refresh();
  };

  return (
    <View style={styles.block}>
      <Text style={styles.title} accessibilityRole="header">
        {t('serverBackup.title')}
      </Text>
      <Text style={styles.hint}>{t('serverBackup.intro')}</Text>
      <Text style={styles.status} accessibilityLiveRegion="polite">
        {statusLine(accountState.lastSuccessAt, accountState.last)}
      </Text>

      {job.kind === 'backup' || job.kind === 'download' ? (
        <View style={styles.progressRow} accessibilityLiveRegion="polite">
          <ActivityIndicator color={palette.tintText} />
          <Text style={[styles.hint, styles.flex]}>
            {job.kind === 'download'
              ? `${t('serverBackup.downloading')}${job.percent ? ` ${formatPercent(job.percent)}` : ''}`
              : job.phase === 'encrypting'
                ? `${t('backup.encrypting')}${job.percent !== null ? ` ${formatPercent(job.percent)}` : ''}`
                : t('serverBackup.uploading')}
          </Text>
          <Pressable onPress={job.cancel} hitSlop={8} accessibilityRole="button" style={styles.smallButton}>
            <Text style={styles.link}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : (
        <Button size="large" label={t('serverBackup.backUpNow')} onPress={runBackup} style={styles.button} />
      )}

      <Text style={[styles.label, styles.section]}>{t('serverBackup.listTitle')}</Text>
      {list.status === 'loading' && <ActivityIndicator color={palette.tintText} />}
      {list.status === 'failed' && (
        <View style={styles.gap}>
          <Text style={[styles.hint, styles.error]}>{serverBackupErrorText(errorKind(list.error))}</Text>
          <ErrorDetails details={errorDetails(list.error)} style={styles.details} />
          <Pressable
            onPress={() => {
              setList({ status: 'loading' });
              void refresh();
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.smallButton}
          >
            <Text style={styles.link}>{t('serverBackup.retry')}</Text>
          </Pressable>
        </View>
      )}
      {list.status === 'ready' && list.backups.length === 0 && <Text style={styles.hint}>{t('serverBackup.listEmpty')}</Text>}
      {list.status === 'ready' &&
        list.backups.map((backup) => (
          <View key={backup.id} style={styles.card}>
            <Text style={styles.cardTitle}>{formatDateTime(new Date(backup.createdAt))}</Text>
            <Text style={styles.hint}>
              {[backup.deviceLabel, formatSize(backup.size), backup.appVersion ? `Qutai ${backup.appVersion}` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <View style={styles.cardActions}>
              <Pressable
                onPress={() => restore(backup)}
                disabled={busy}
                style={({ pressed }) => [styles.smallButton, busy && styles.disabled, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${t('serverBackup.restore')}, ${formatDateTime(new Date(backup.createdAt))}`}
              >
                <Text style={styles.link}>{t('serverBackup.restore')}</Text>
              </Pressable>
              <Pressable
                onPress={() => remove(backup)}
                disabled={busy}
                style={({ pressed }) => [styles.smallButton, busy && styles.disabled, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${t('serverBackup.delete')}, ${formatDateTime(new Date(backup.createdAt))}`}
              >
                <Text style={[styles.link, styles.danger]}>{t('serverBackup.delete')}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      {list.status === 'ready' && list.backups.length > 0 && (
        <>
          <Text style={styles.hint}>{t('serverBackup.keepNote', { count: config.keep })}</Text>
          <Pressable onPress={removeAll} disabled={busy} accessibilityRole="button" hitSlop={8} style={styles.smallButton}>
            <Text style={[styles.link, styles.danger]}>{t('serverBackup.deleteAll')}</Text>
          </Pressable>
        </>
      )}

      <SettingsSection title={t('serverBackup.password')}>
        <GroupLink
          title={t(hasPassword ? 'serverBackup.changePassword' : 'serverBackup.setPassword')}
          summary={hasPassword ? t('serverBackup.passwordSet') : t('serverBackup.passwordNotSet')}
          disabled={busy}
          onPress={() => setPasswordSheet({ change: hasPassword, thenBackUp: false })}
        />
      </SettingsSection>

      <SettingsSection title={t('serverBackup.automatic')}>
        <GroupSwitch title={t('serverBackup.auto')} hint={t('serverBackup.autoHint')} value={prefs.auto} onChange={(auto) => setPref({ auto })} />
        {prefs.auto && (
          <GroupSwitch
            title={t('serverBackup.wifiOnly')}
            hint={t('serverBackup.wifiOnlyHint')}
            value={prefs.network === 'wifi'}
            onChange={(wifi) => setPref({ network: wifi ? 'wifi' : 'any' })}
          />
        )}
      </SettingsSection>

      {/* What goes in, as one group (UI-59). */}
      <SettingsSection title={t('serverBackup.contents')} description={t('backup.alwaysIncluded')} footer={t('backup.notIncluded')}>
        <GroupSwitch title={t('backup.tabs')} hint={t('backup.tabsHint')} value={prefs.tabs} onChange={(tabs) => setPref({ tabs })} />
        <GroupSwitch
          title={t('backup.chats')}
          hint={t('serverBackup.chatsHint')}
          value={prefs.tabs && prefs.chats}
          disabled={!prefs.tabs}
          onChange={(chats) => setPref({ chats })}
        />
        <GroupSwitch
          title={t('backup.activity')}
          hint={t('backup.activityHint')}
          value={prefs.activity}
          onChange={(activity) => setPref({ activity })}
        />
        <GroupSwitch
          title={t('backup.apiKeys')}
          hint={t('serverBackup.apiKeysHint')}
          value={prefs.apiKeys}
          onChange={(apiKeys) => setPref({ apiKeys })}
        />
        <GroupSwitch title={t('backup.apps')} hint={t('backup.appsHint')} value={prefs.apps} onChange={(apps) => setPref({ apps })} />
        <GroupSwitch
          title={t('backup.appData')}
          hint={t('serverBackup.appDataHint', { size: formatSize(appData ?? 0) })}
          value={prefs.apps && prefs.appData}
          disabled={!prefs.apps}
          onChange={(appData) => setPref({ appData })}
        />
      </SettingsSection>

      <PasswordSheet
        open={passwordSheet}
        onClose={() => setPasswordSheet(null)}
        onSaved={async (thenBackUp) => {
          setPasswordSheet(null);
          if (thenBackUp) {
            const outcome = await backUpNow('manual');
            if (!outcome.ok) showError(t('serverBackup.failedTitle'), outcome.error, outcome.kind);
            else noteLeftOut(outcome);
          }
        }}
      />
    </View>
  );
}

/** Set (first time) or change the backup password: twice, with the warning that it can't be recovered. */
function PasswordSheet({
  open,
  onClose,
  onSaved,
}: {
  open: { change: boolean; thenBackUp: boolean } | null;
  onClose: () => void;
  onSaved: (thenBackUp: boolean) => void;
}) {
  const styles = useStyles();
  return (
    <AppModal visible={open !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        {/* Mounted per opening, so the fields always start empty. */}
        {open && <PasswordForm open={open} onClose={onClose} onSaved={onSaved} />}
      </SafeAreaView>
      <DialogHost />
    </AppModal>
  );
}

function PasswordForm({
  open,
  onClose,
  onSaved,
}: {
  open: { change: boolean; thenBackUp: boolean };
  onClose: () => void;
  onSaved: (thenBackUp: boolean) => void;
}) {
  const styles = useStyles();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const problem = newPasswordProblem(password, repeat);
  const mismatch = repeat.length > 0 && problem === 'mismatch';
  const save = async () => {
    if (problem || saving) return;
    setSaving(true);
    try {
      await keepPassword(password);
      onSaved(open.thenBackUp);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <ScreenHeader
        title={t(open.change ? 'serverBackup.changePassword' : 'serverBackup.passwordTitle')}
        left={{
          label: t('common.cancel'),
          tone: 'plain',
          disabled: saving,
          onPress: onClose,
        }}
      />
      <KeyboardAwareScrollView contentContainerStyle={styles.sheet}>
        <Text style={styles.hint}>{t('serverBackup.passwordIntro')}</Text>
        {open.change && <Text style={styles.hint}>{t('serverBackup.changeNote')}</Text>}
        <PasswordField value={password} onChange={setPassword} label={t('backup.password')} purpose="new" autoFocus />
        <PasswordField value={repeat} onChange={setRepeat} label={t('backup.repeatPassword')} purpose="new" onSubmit={save} />
        <Text style={[styles.hint, mismatch && styles.error]}>
          {mismatch ? t('backup.passwordMismatch') : t('backup.passwordMin', { min: MIN_BACKUP_PASSWORD })}
        </Text>
        <Text style={styles.warning}>{t('serverBackup.passwordWarning')}</Text>
        {failed && <Text style={[styles.hint, styles.error]}>{t('serverBackup.passwordSaveFailed')}</Text>}
        <Button
          size="large"
          label={t(open.thenBackUp ? 'serverBackup.saveAndBackUp' : 'serverBackup.savePassword')}
          onPress={save}
          disabled={!!problem}
          busy={saving}
          style={styles.button}
        />
      </KeyboardAwareScrollView>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  sheet: { ...readableColumn, padding: 16, gap: 12, paddingBottom: 40 },
  block: { gap: 8, marginTop: 24 },
  title: common(c).title,
  label: common(c).label,
  section: { marginTop: 12 },
  hint: common(c).hint,
  status: { fontSize: 14, color: c.text, lineHeight: 20 },
  error: { color: c.danger },
  danger: { color: c.danger },
  warning: { fontSize: 13, color: c.text, lineHeight: 18, fontWeight: '600' },
  link: { fontSize: 14, color: c.tintText, fontWeight: '600' },
  flex: { flex: 1 },
  gap: { gap: 6 },
  details: { marginLeft: 0 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.card,
    padding: 14,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 6,
  },
  smallButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  button: { marginTop: 4 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));
