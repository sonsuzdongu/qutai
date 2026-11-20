import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProvider } from '../ai/providers';
import {
  CryptoUnavailableError,
  exportBackup,
  MIN_BACKUP_PASSWORD,
  openBackup,
  reloadApp,
  restoreBackup,
} from '../backup/backup';
import { BackupError } from '../backup/crypto';
import type { ApplyMode } from '../backup/database';
import { BackupPayload, BackupSummary, PayloadError, summarize } from '../backup/payload';
import { authenticate } from '../device/biometric';
import { MessageKey, t } from '../i18n';
import { formatDateTime, formatList, formatPercent, formatSize } from '../i18n/format';
import { appsDataSize } from '../apps/appStore';
import { Button } from '../ui/Button';
import { PasswordField } from '../ui/PasswordField';
import { SwitchRow } from '../ui/SettingsRows';
import { makeStyles, readableColumn, usePalette, common } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';
import { KeyboardAwareScrollView } from './KeyboardAware';
import { ScreenHeader } from './ScreenHeader';

/** A backup downloaded from the Qutai account, and the password kept on this phone for it (tried first). */
export type ServerRestoreJob = { file: Uint8Array; keptPassword: string | null };

type Props = {
  /** 'export', the bytes of a picked backup file to import, or a server backup to restore; null: closed. */
  job: 'export' | Uint8Array | ServerRestoreJob | null;
  /** Export asks for Face ID / fingerprint first when the app lock is on. */
  appLock: boolean;
  onClose: () => void;
};

/**
 * Export (choose what goes in, set a password) and import (password, summary, merge or replace) of a backup. A server
 * backup (docs/server-backup.md) is restored through the same import: the same summary, choices and code path.
 */
export function BackupScreen({ job, appLock, onClose }: Props) {
  const styles = useStyles();
  // The title stays while the modal slides away.
  const [kind, setKind] = useState<'export' | 'import'>('export');
  const current = job === null ? kind : job === 'export' ? 'export' : 'import';
  if (current !== kind) setKind(current);
  const [busy, setBusy] = useState(false);
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <AppModal visible={job !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <ScreenHeader
          title={t(current === 'export' ? 'backup.exportTitle' : 'backup.importTitle')}
          left={{ label: t('common.cancel'), tone: 'plain', disabled: busy, onPress: close }}
        />
        {/* Mounted per job, so every export or import starts with empty fields. */}
        {job === 'export' && <ExportForm appLock={appLock} busy={busy} setBusy={setBusy} onDone={onClose} />}
        {job instanceof Uint8Array && <ImportFlow file={job} busy={busy} setBusy={setBusy} />}
        {job !== null && job !== 'export' && !(job instanceof Uint8Array) && (
          <ImportFlow file={job.file} keptPassword={job.keptPassword} busy={busy} setBusy={setBusy} />
        )}
      </SafeAreaView>
      <DialogHost />
    </AppModal>
  );
}

type BusyProps = { busy: boolean; setBusy: (busy: boolean) => void };

/** Percent of key derivation done; noble reports very often, so the screen updates only when it changes. */
function useProgress() {
  const [percent, setPercent] = useState<number | null>(null);
  const lastPercent = useRef(-1);
  const report = (fraction: number) => {
    const next = Math.floor(fraction * 100);
    if (next !== lastPercent.current) {
      lastPercent.current = next;
      setPercent(next);
    }
  };
  const reset = () => {
    lastPercent.current = -1;
    setPercent(null);
  };
  return { percent, report, reset };
}

/** Bytes of every app's data, for the "Apps' data" switch (null while it is read). */
export function useAppsDataSize(): number | null {
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    appsDataSize()
      .then((n) => alive && setSize(n))
      .catch(() => alive && setSize(0));
    return () => {
      alive = false;
    };
  }, []);
  return size;
}


function Progress({ percent, label }: { percent: number | null; label: string }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={styles.progress} accessibilityLiveRegion="polite">
      <ActivityIndicator color={palette.tintText} />
      <Text style={styles.hint}>{percent === null ? label : `${label} ${formatPercent(percent)}`}</Text>
    </View>
  );
}

function ExportForm({ appLock, busy, setBusy, onDone }: BusyProps & { appLock: boolean; onDone: () => void }) {
  const styles = useStyles();
  const [tabs, setTabs] = useState(true);
  const [chats, setChats] = useState(false);
  const [activity, setActivity] = useState(false);
  const [apiKeys, setApiKeys] = useState(false);
  const [apps, setApps] = useState(true);
  const [appData, setAppData] = useState(true);
  const appDataSize = useAppsDataSize();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const progress = useProgress();

  const tooShort = password.length < MIN_BACKUP_PASSWORD;
  const mismatch = repeat.length > 0 && repeat !== password;
  const ready = !tooShort && repeat === password && !busy;

  const run = async () => {
    if (!ready) return;
    if (appLock && !(await authenticate(t('backup.authPrompt')))) return;
    setBusy(true);
    progress.reset();
    try {
      await exportBackup({ tabs, chats: tabs && chats, activity, apiKeys, apps, appData: apps && appData }, password, progress.report);
      setBusy(false);
      onDone();
    } catch (e) {
      setBusy(false);
      dialog.alert(
        t('backup.exportFailed'),
        e instanceof CryptoUnavailableError ? t('backup.needsBuild') : e instanceof Error ? e.message : String(e),
      );
    }
  };

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>{t('backup.alwaysIncluded')}</Text>
      <SwitchRow title={t('backup.tabs')} hint={t('backup.tabsHint')} value={tabs} onChange={setTabs} disabled={busy} />
      <SwitchRow
        title={t('backup.chats')}
        hint={t('backup.chatsHint')}
        value={tabs && chats}
        onChange={setChats}
        disabled={busy || !tabs}
      />
      <SwitchRow
        title={t('backup.activity')}
        hint={t('backup.activityHint')}
        value={activity}
        onChange={setActivity}
        disabled={busy}
      />
      <SwitchRow title={t('backup.apps')} hint={t('backup.appsHint')} value={apps} onChange={setApps} disabled={busy} />
      <SwitchRow
        title={t('backup.appData')}
        hint={t('backup.appDataHint', { size: formatSize(appDataSize ?? 0) })}
        value={apps && appData}
        onChange={setAppData}
        disabled={busy || !apps}
      />
      <SwitchRow
        title={t('backup.apiKeys')}
        hint={t('backup.apiKeysHint')}
        value={apiKeys}
        onChange={setApiKeys}
        disabled={busy}
      />
      <Text style={styles.hint}>{t('backup.notIncluded')}</Text>

      <Text style={[styles.label, styles.section]}>{t('backup.password')}</Text>
      <PasswordField value={password} onChange={setPassword} label={t('backup.password')} purpose="new" />
      <PasswordField value={repeat} onChange={setRepeat} label={t('backup.repeatPassword')} purpose="new" onSubmit={run} />
      <Text style={[styles.hint, mismatch && styles.error]}>
        {mismatch ? t('backup.passwordMismatch') : t('backup.passwordMin', { min: MIN_BACKUP_PASSWORD })}
      </Text>
      <Text style={styles.warning}>{t('backup.passwordWarning')}</Text>

      {busy ? (
        <Progress percent={progress.percent} label={t('backup.encrypting')} />
      ) : (
        <Button size="large" label={t('backup.export')} onPress={run} disabled={!ready} style={styles.button} />
      )}
    </KeyboardAwareScrollView>
  );
}

function openError(e: unknown): string {
  if (e instanceof BackupError) {
    const keys: Record<BackupError['code'], MessageKey> = {
      'not-backup': 'backup.error.notBackup',
      'newer-format': 'backup.error.newer',
      damaged: 'backup.error.damaged',
      'wrong-password': 'backup.error.wrongPassword',
    };
    return t(keys[e.code]);
  }
  if (e instanceof PayloadError)
    return t(e.code === 'newer-version' ? 'backup.error.newer' : 'backup.error.unreadable');
  return t('common.error', { message: e instanceof Error ? e.message : String(e) });
}

/** Names of the kinds in the backup, for "what will be erased". */
function kindNames(s: BackupSummary): string[] {
  const names: string[] = [];
  if (s.bookmarks !== undefined) names.push(t('backup.kind.bookmarks'));
  if (s.history !== undefined) names.push(t('backup.kind.history'));
  if (s.memories !== undefined) names.push(t('backup.kind.memories'));
  if (s.tasks !== undefined) names.push(t('backup.kind.tasks'));
  if (s.sites !== undefined) names.push(t('backup.kind.sites'));
  if (s.tabs !== undefined) names.push(t('backup.kind.tabs'));
  if (s.chats !== undefined) names.push(t('backup.kind.chats'));
  if (s.activity !== undefined) names.push(t('backup.kind.activity'));
  if (s.apps !== undefined) names.push(t('backup.kind.apps'));
  return names;
}

function ImportFlow({ file, keptPassword, busy, setBusy }: BusyProps & { file: Uint8Array; keptPassword?: string | null }) {
  const styles = useStyles();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [mode, setMode] = useState<ApplyMode>('merge');
  const [withKeys, setWithKeys] = useState(true);
  const progress = useProgress();

  const open = async (typed = password, kept = false) => {
    if (!typed || busy) return;
    setBusy(true);
    setError(null);
    progress.reset();
    try {
      setPayload(await openBackup(file, typed, progress.report));
      setPassword('');
    } catch (e) {
      // The kept password may be newer than this backup ("change password" leaves older server copies as they were).
      setError(kept && e instanceof BackupError && e.code === 'wrong-password' ? t('serverBackup.keptPasswordFailed') : openError(e));
    } finally {
      setBusy(false);
    }
  };

  // A server backup opens with the password kept on this phone first; the field shows only when that fails.
  const triedKept = useRef(false);
  useEffect(() => {
    if (keptPassword && !triedKept.current) {
      triedKept.current = true;
      void open(keptPassword, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keptPassword]);

  if (!payload) {
    return (
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>{t('backup.enterPassword')}</Text>
        <PasswordField
          value={password}
          onChange={(text) => {
            setPassword(text);
            setError(null);
          }}
          label={t('backup.password')}
          purpose="current"
          error={error}
          onSubmit={() => open()}
          autoFocus={!keptPassword}
        />
        {busy ? (
          <Progress percent={progress.percent} label={t('backup.decrypting')} />
        ) : (
          <Button size="large" label={t('backup.open')} onPress={() => open()} disabled={!password} style={styles.button} />
        )}
      </KeyboardAwareScrollView>
    );
  }

  const summary = summarize(payload);
  const keys = summary.apiKeys.length > 0;
  const lines: string[] = [];
  if (summary.bookmarks !== undefined) {
    lines.push(t('backup.summary.bookmarks', { count: summary.bookmarks, folders: summary.folders ?? 0 }));
  }
  if (summary.history !== undefined) lines.push(t('backup.summary.history', { count: summary.history }));
  if (summary.memories !== undefined) lines.push(t('backup.summary.memories', { count: summary.memories }));
  if (summary.tasks !== undefined) lines.push(t('backup.summary.tasks', { count: summary.tasks }));
  if (summary.sites !== undefined) lines.push(t('backup.summary.sites', { count: summary.sites }));
  if (summary.settings) lines.push(t('backup.summary.settings'));
  if (summary.tabs !== undefined) lines.push(t('backup.summary.tabs', { count: summary.tabs }));
  if (summary.chats !== undefined) lines.push(t('backup.summary.chats', { count: summary.chats }));
  if (summary.activity !== undefined) lines.push(t('backup.summary.activity', { count: summary.activity }));
  if (summary.apps !== undefined)
    lines.push(t(summary.appsWithData ? 'backup.summary.appsData' : 'backup.summary.appsNoData', { count: summary.apps }));

  const restore = async () => {
    if (mode === 'replace') {
      const confirmed = await dialog.confirm({
        title: t('backup.replaceConfirmTitle'),
        message: t('backup.replaceConfirmBody', { kinds: formatList(kindNames(summary)) }),
        confirmText: t('backup.replaceConfirm'),
        destructive: true,
      });
      if (!confirmed) return;
    }
    setBusy(true);
    let settingsSaved: boolean;
    try {
      settingsSaved = await restoreBackup(payload, mode, keys && withKeys);
    } catch (e) {
      setBusy(false);
      dialog.alert(t('backup.restoreFailed'), e instanceof Error ? e.message : String(e));
      return;
    }
    // The database is held from here on; the app starts again to read everything back.
    await dialog.show({
      title: t('backup.restored'),
      message: settingsSaved
        ? t('backup.restoredBody')
        : `${t('backup.settingsFailed')}\n\n${t('backup.restoredBody')}`,
    });
    if (!(await reloadApp())) {
      dialog.alert(t('backup.restartNeeded'));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        {t('backup.madeOn', {
          date: summary.createdAt ? formatDateTime(new Date(summary.createdAt)) : '–',
          version: summary.appVersion || '–',
        })}
      </Text>
      <View style={styles.card}>
        {lines.map((line) => (
          <Text key={line} style={styles.summaryLine}>
            {line}
          </Text>
        ))}
        {lines.length === 0 && <Text style={styles.summaryLine}>{t('backup.summary.empty')}</Text>}
      </View>
      {keys && (
        <SwitchRow
          title={t('backup.restoreKeys')}
          hint={t('backup.restoreKeysHint', {
            providers: formatList(summary.apiKeys.map((id) => getProvider(id).label)),
          })}
          value={withKeys}
          onChange={setWithKeys}
          disabled={busy}
        />
      )}
      <Text style={[styles.label, styles.section]}>{t('backup.howToApply')}</Text>
      {(['merge', 'replace'] as const).map((value) => (
        <Pressable
          key={value}
          onPress={() => setMode(value)}
          disabled={busy}
          style={styles.option}
          accessibilityRole="radio"
          accessibilityState={{ checked: mode === value }}
        >
          <Radio selected={mode === value} />
          <View style={styles.texts}>
            <Text style={styles.label}>{t(value === 'merge' ? 'backup.merge' : 'backup.replace')}</Text>
            <Text style={styles.hint}>{t(value === 'merge' ? 'backup.mergeHint' : 'backup.replaceHint')}</Text>
          </View>
        </Pressable>
      ))}
      <Text style={styles.hint}>{t('backup.restartNote')}</Text>
      {busy ? (
        <Progress percent={null} label={t('backup.restoring')} />
      ) : (
        <Button
          size="large"
          variant={mode === 'replace' ? 'destructive' : 'primary'}
          label={t('backup.restore')}
          onPress={restore}
          style={styles.button}
        />
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { ...readableColumn, padding: 16, gap: 12, paddingBottom: 40 },
  label: common(c).label,
  section: { marginTop: 12 },
  hint: common(c).hint,
  error: { color: c.danger },
  warning: { fontSize: 13, color: c.text, lineHeight: 18, fontWeight: '600' },
  texts: { flex: 1, gap: 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  card: { ...common(c).card, padding: 14, gap: 6 },
  summaryLine: { fontSize: 15, color: c.text },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    marginTop: 12,
  },
  button: { marginTop: 12 },
}));
