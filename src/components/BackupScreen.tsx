import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { formatDateTime } from '../i18n/format';
import { makeStyles, readableColumn, usePalette } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';
import { KeyboardAwareScrollView } from './KeyboardAware';

type Props = {
  /** 'export', or the bytes of a picked backup file to import; null: closed. */
  job: 'export' | Uint8Array | null;
  /** Export asks for Face ID / fingerprint first when the app lock is on. */
  appLock: boolean;
  onClose: () => void;
};

/** Export (choose what goes in, set a password) and import (password, summary, merge or replace) of a backup. */
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
    <Modal visible={job !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={close} hitSlop={8} style={styles.side} disabled={busy}>
            <Text style={[styles.cancel, busy && styles.disabled]}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.title}>{t(current === 'export' ? 'backup.exportTitle' : 'backup.importTitle')}</Text>
          <View style={styles.side} />
        </View>
        {/* Mounted per job, so every export or import starts with empty fields. */}
        {job === 'export' && <ExportForm appLock={appLock} busy={busy} setBusy={setBusy} onDone={onClose} />}
        {job instanceof Uint8Array && <ImportFlow file={job} busy={busy} setBusy={setBusy} />}
      </SafeAreaView>
      <DialogHost />
    </Modal>
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

function PasswordField({
  value,
  onChange,
  label,
  visible,
  onSubmit,
  autoFocus,
}: {
  value: string;
  onChange: (text: string) => void;
  label: string;
  visible: boolean;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder={label}
      placeholderTextColor={palette.textSecondary}
      accessibilityLabel={label}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      textContentType="none"
      importantForAutofill="no"
      maxLength={200}
      autoFocus={autoFocus}
      onSubmitEditing={onSubmit}
      returnKeyType={onSubmit ? 'go' : 'next'}
    />
  );
}

function ShowPassword({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      style={styles.showRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: visible }}
    >
      <Text style={styles.link}>{t(visible ? 'backup.hidePassword' : 'backup.showPassword')}</Text>
    </Pressable>
  );
}

function SwitchRow({
  title,
  hint,
  value,
  onChange,
  disabled,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.texts}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <ThemedSwitch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={title} />
    </View>
  );
}

function Progress({ percent, label }: { percent: number | null; label: string }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={styles.progress} accessibilityLiveRegion="polite">
      <ActivityIndicator color={palette.tintText} />
      <Text style={styles.hint}>{percent === null ? label : `${label} ${percent}%`}</Text>
    </View>
  );
}

function ExportForm({ appLock, busy, setBusy, onDone }: BusyProps & { appLock: boolean; onDone: () => void }) {
  const styles = useStyles();
  const [tabs, setTabs] = useState(true);
  const [chats, setChats] = useState(false);
  const [activity, setActivity] = useState(false);
  const [apiKeys, setApiKeys] = useState(false);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [visible, setVisible] = useState(false);
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
      await exportBackup({ tabs, chats: tabs && chats, activity, apiKeys }, password, progress.report);
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
      <SwitchRow
        title={t('backup.apiKeys')}
        hint={t('backup.apiKeysHint')}
        value={apiKeys}
        onChange={setApiKeys}
        disabled={busy}
      />
      <Text style={styles.hint}>{t('backup.notIncluded')}</Text>

      <Text style={[styles.label, styles.section]}>{t('backup.password')}</Text>
      <PasswordField value={password} onChange={setPassword} label={t('backup.password')} visible={visible} />
      <PasswordField
        value={repeat}
        onChange={setRepeat}
        label={t('backup.repeatPassword')}
        visible={visible}
        onSubmit={run}
      />
      <ShowPassword visible={visible} onToggle={() => setVisible(!visible)} />
      <Text style={[styles.hint, mismatch && styles.error]}>
        {mismatch ? t('backup.passwordMismatch') : t('backup.passwordMin', { min: MIN_BACKUP_PASSWORD })}
      </Text>
      <Text style={styles.warning}>{t('backup.passwordWarning')}</Text>

      {busy ? (
        <Progress percent={progress.percent} label={t('backup.encrypting')} />
      ) : (
        <Pressable
          onPress={run}
          disabled={!ready}
          style={[styles.button, !ready && styles.disabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
        >
          <Text style={styles.buttonText}>{t('backup.export')}</Text>
        </Pressable>
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
  return names;
}

function ImportFlow({ file, busy, setBusy }: BusyProps & { file: Uint8Array }) {
  const styles = useStyles();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [mode, setMode] = useState<ApplyMode>('merge');
  const [withKeys, setWithKeys] = useState(true);
  const progress = useProgress();

  const open = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    progress.reset();
    try {
      setPayload(await openBackup(file, password, progress.report));
      setPassword('');
    } catch (e) {
      setError(openError(e));
    } finally {
      setBusy(false);
    }
  };

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
          visible={visible}
          onSubmit={open}
          autoFocus
        />
        <ShowPassword visible={visible} onToggle={() => setVisible(!visible)} />
        {error && (
          <Text style={[styles.hint, styles.error]} accessibilityLiveRegion="assertive">
            {error}
          </Text>
        )}
        {busy ? (
          <Progress percent={progress.percent} label={t('backup.decrypting')} />
        ) : (
          <Pressable
            onPress={open}
            disabled={!password}
            style={[styles.button, !password && styles.disabled]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{t('backup.open')}</Text>
          </Pressable>
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

  const restore = async () => {
    if (mode === 'replace') {
      const confirmed = await dialog.confirm({
        title: t('backup.replaceConfirmTitle'),
        message: t('backup.replaceConfirmBody', { kinds: kindNames(summary).join(', ') }),
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
            providers: summary.apiKeys.map((id) => getProvider(id).label).join(', '),
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
        <Pressable
          onPress={restore}
          style={[styles.button, mode === 'replace' && styles.dangerButton]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{t('backup.restore')}</Text>
        </Pressable>
      )}
    </ScrollView>
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
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  cancel: { fontSize: 16, color: c.textSecondary },
  content: { ...readableColumn, padding: 16, gap: 12, paddingBottom: 40 },
  label: { fontSize: 15, fontWeight: '600', color: c.text },
  section: { marginTop: 12 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  error: { color: c.danger },
  warning: { fontSize: 13, color: c.text, lineHeight: 18, fontWeight: '600' },
  link: { fontSize: 14, color: c.tintText, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, gap: 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  showRow: { alignSelf: 'flex-start' },
  input: {
    color: c.text,
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 6 },
  summaryLine: { fontSize: 15, color: c.text },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    marginTop: 12,
  },
  button: {
    marginTop: 12,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButton: { backgroundColor: c.dangerFill },
  buttonText: { color: c.onTint, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.4 },
}));
