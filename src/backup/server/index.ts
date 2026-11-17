import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { accountSession } from '../../account';
import { accountsEnabled, features } from '../../config/features';
import { creditsStore } from '../../credits';
import { appVersion } from '../../device/appVersion';
import { secureStoreReady } from '../../storage/secureStoreGate';
import { buildBackupFile, randomBytes } from '../backup';
import { createServerBackupClient, type ServerBackup, type ServerBackupClient } from './client';
import {
  autoBackupDecision,
  clearPasswordOn,
  deviceLabel,
  errorKind,
  isRetryable,
  parseState,
  parseStoredPassword,
  passwordFor,
  runRecord,
  shouldOfferRestore,
  shouldRecordSkip,
  uploadId,
  type NetworkKind,
  type RunRecord,
  type ServerBackupErrorKind,
  type ServerBackupPrefs,
  type ServerBackupState,
  type StoredPassword,
} from './logic';

/**
 * "Back up to your Qutai account" (docs/server-backup.md): the export's encrypted file, uploaded to the signed-in
 * account and restored from it. Pro mode and signed in only. Runs only while the app is open (never from a background
 * service in this version).
 */

export type { ServerBackup } from './client';
export type { ServerBackupErrorKind, ServerBackupPrefs, RunRecord } from './logic';

/** Secure storage keys (also listed in storage/installCheck.ts, so an iOS reinstall starts clean). */
export const PASSWORD_KEY = 'server_backup_password';
export const STATE_KEY = 'server_backup_state';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

/** The job running now (one at a time: a backup, a download for a restore). */
export type Job =
  | { kind: 'idle' }
  | { kind: 'backup'; trigger: 'auto' | 'manual'; phase: 'encrypting' | 'uploading'; percent: number | null; cancel: () => void }
  | { kind: 'download'; percent: number | null; cancel: () => void };

type Snapshot = {
  state: ServerBackupState;
  /** The kept password belongs to the signed-in account. */
  hasPassword: boolean;
  job: Job;
};

let snapshot: Snapshot = { state: parseState(null), hasPassword: false, job: { kind: 'idle' } };
let stored: StoredPassword | null = null;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const l of listeners) l();
}

function currentUserId(): string | null {
  const s = accountSession()?.getState();
  return s?.status === 'signedIn' ? s.user.id : null;
}

function suspended(): boolean {
  const s = accountSession()?.getState();
  return s?.status === 'signedIn' && s.user.status === 'suspended';
}

/** Whether this build can have server backups at all (pro mode with a server). */
export const serverBackupEnabled = accountsEnabled && !!features.apiUrl;

let client: ServerBackupClient | null = null;

function getClient(): ServerBackupClient {
  const session = accountSession();
  if (!serverBackupEnabled || !session || !features.apiUrl) throw new Error('server backup is off in this build');
  client ??= createServerBackupClient({
    baseUrl: features.apiUrl,
    tokens: {
      get: () => session.currentAccessToken(),
      renew: (stale) => session.renewAccessToken(stale),
      suspended: () => session.noteSuspended(),
      ended: () => session.noteSessionEnded(),
    },
  });
  return client;
}

async function saveState(state: ServerBackupState): Promise<void> {
  emit({ state });
  await SecureStore.setItemAsync(STATE_KEY, JSON.stringify(state), OPTIONS).catch(() => {});
}

function updateAccount(userId: string, change: (a: ServerBackupState['accounts'][string]) => ServerBackupState['accounts'][string]) {
  const state = snapshot.state;
  return saveState({ ...state, accounts: { ...state.accounts, [userId]: change(state.accounts[userId] ?? {}) } });
}

/** Loads the kept state and password; also clears the password when the user signs out (logic.ts › clearPasswordOn). */
export function loadServerBackup(): Promise<void> {
  if (!serverBackupEnabled) return Promise.resolve();
  loaded ??= (async () => {
    await secureStoreReady();
    const [state, password] = await Promise.all([
      SecureStore.getItemAsync(STATE_KEY, OPTIONS).catch(() => null),
      SecureStore.getItemAsync(PASSWORD_KEY, OPTIONS).catch(() => null),
    ]);
    stored = parseStoredPassword(password);
    emit({ state: parseState(state), hasPassword: passwordFor(stored, currentUserId()) !== null });
    accountSession()?.subscribe((s) => {
      if (s.status === 'loading') return;
      const event = s.status === 'signedIn' ? { status: 'signedIn' as const, userId: s.user.id } : { status: 'signedOut' as const, reason: s.reason };
      if (clearPasswordOn(event, stored)) void forgetPassword();
      else emit({ hasPassword: passwordFor(stored, currentUserId()) !== null });
    });
  })();
  return loaded;
}

export function useServerBackup(): Snapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}

/** Whether the server offers backups (GET /config › backups), and its limits; null when it doesn't or can't be asked. */
export async function serverBackupConfig(): Promise<{ maxBytes: number; keep: number } | null> {
  if (!serverBackupEnabled) return null;
  try {
    return (await creditsStore.config()).backups ?? null;
  } catch {
    return null;
  }
}

// ---------- Password ----------

/** Keeps the backup password for the signed-in account (after the user set it with confirmation). */
export async function keepPassword(password: string): Promise<void> {
  const userId = currentUserId();
  if (!userId) throw new Error('signed out');
  const next: StoredPassword = { userId, password, setAt: Date.now() };
  await SecureStore.setItemAsync(PASSWORD_KEY, JSON.stringify(next), OPTIONS);
  stored = next;
  emit({ hasPassword: true });
}

export async function forgetPassword(): Promise<void> {
  stored = null;
  emit({ hasPassword: false });
  await SecureStore.deleteItemAsync(PASSWORD_KEY, OPTIONS).catch(() => {});
}

/** The kept password for the signed-in account, or null. */
export function keptPassword(): string | null {
  return passwordFor(stored, currentUserId());
}

// ---------- Preferences ----------

export function savePrefs(prefs: ServerBackupPrefs): Promise<void> {
  return saveState({ ...snapshot.state, prefs });
}

// ---------- List, delete ----------

export async function listServerBackups(): Promise<ServerBackup[]> {
  return (await getClient().list()).backups;
}

export async function deleteServerBackup(id: string): Promise<void> {
  await getClient().remove(id);
}

export async function deleteAllServerBackups(): Promise<number> {
  return getClient().removeAll();
}

// ---------- Back up ----------

export class BackupBusyError extends Error {
  constructor() {
    super('busy');
    this.name = 'BackupBusyError';
  }
}

export type BackupOutcome = { ok: true; backup: ServerBackup; removed: number } | { ok: false; kind: ServerBackupErrorKind; error: unknown };

/**
 * Builds the file with the kept password (or `password`, for a first backup), uploads it, and records the run. The
 * same upload id is used for one retry after a dropped connection, so the server never stores it twice.
 */
export async function backUpNow(trigger: 'auto' | 'manual', password = keptPassword()): Promise<BackupOutcome> {
  const userId = currentUserId();
  if (snapshot.job.kind !== 'idle') throw new BackupBusyError();
  if (!userId || !password) return { ok: false, kind: userId ? 'wrong-password' : 'signed-out', error: null };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const prefs = snapshot.state.prefs;
  emit({ job: { kind: 'backup', trigger, phase: 'encrypting', percent: 0, cancel } });
  let lastPercent = -1;
  let outcome: BackupOutcome;
  try {
    const file = await buildBackupFile(
      { tabs: prefs.tabs, chats: prefs.tabs && prefs.chats, activity: prefs.activity, apiKeys: prefs.apiKeys },
      password,
      (fraction) => {
        const percent = Math.floor(fraction * 100);
        if (percent !== lastPercent && snapshot.job.kind === 'backup') {
          lastPercent = percent;
          emit({ job: { ...snapshot.job, percent } });
        }
      },
    );
    if (controller.signal.aborted) throw new DOMExceptionLike();
    const limit = (await serverBackupConfig())?.maxBytes;
    if (limit && file.length > limit) throw tooLarge();
    emit({ job: { kind: 'backup', trigger, phase: 'uploading', percent: null, cancel } });
    const meta = {
      uploadId: uploadId(await randomBytes(16)),
      appVersion: appVersion().version,
      // Android: the release ("16"), not the API level Platform.Version gives.
      deviceLabel: deviceLabel(
        Platform.OS,
        Platform.OS === 'android' ? ((Platform.constants as { Release?: string }).Release ?? Platform.Version) : Platform.Version,
        (Platform as { isPad?: boolean }).isPad === true,
      ),
    };
    const send = () => getClient().upload(file, meta, controller.signal);
    let result;
    try {
      result = await send();
    } catch (e) {
      if (!isRetryable(e) || controller.signal.aborted) throw e;
      result = await send();
    }
    outcome = { ok: true, backup: result.backup, removed: result.removed };
  } catch (e) {
    outcome = { ok: false, kind: controller.signal.aborted ? 'cancelled' : errorKind(e), error: e };
  } finally {
    emit({ job: { kind: 'idle' } });
  }
  const now = Date.now();
  const retryAfter = !outcome.ok && typeof (outcome.error as { retryAfter?: unknown })?.retryAfter === 'number' ? (outcome.error as { retryAfter: number }).retryAfter : null;
  await updateAccount(userId, (a) => ({
    ...a,
    ...(outcome.ok ? { lastSuccessAt: now } : {}),
    // A cancel by the user isn't a failure worth showing.
    ...(outcome.ok || outcome.kind !== 'cancelled'
      ? { last: runRecord(trigger, now, outcome.ok ? { ok: true } : { ok: false, kind: outcome.kind, retryAfterSeconds: retryAfter }) }
      : {}),
  }));
  return outcome;
}

class DOMExceptionLike extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

function tooLarge() {
  const e = new Error('too large') as Error & { code: string; status: number; reason: null };
  e.name = 'ServerBackupHttpError';
  e.code = 'payload_too_large';
  return e;
}

// ---------- Restore ----------

/** Downloads a backup's file (checked against its SHA-256) for the import screen; cancellable. */
export async function downloadServerBackup(backup: ServerBackup): Promise<Uint8Array> {
  if (snapshot.job.kind !== 'idle') throw new BackupBusyError();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  emit({ job: { kind: 'download', percent: 0, cancel } });
  try {
    return await getClient().download(backup, controller.signal, (fraction) => {
      const percent = Math.floor(fraction * 100);
      if (snapshot.job.kind === 'download' && snapshot.job.percent !== percent) emit({ job: { ...snapshot.job, percent } });
    });
  } finally {
    emit({ job: { kind: 'idle' } });
  }
}

/** After sign-in on a phone that never backed up this account: the newest server backup to offer, once. */
export async function restoreOffer(): Promise<ServerBackup | null> {
  await loadServerBackup();
  const userId = currentUserId();
  if (!userId || !(await serverBackupConfig())) return null;
  const account = snapshot.state.accounts[userId] ?? {};
  if (account.restoreOffered) return null;
  let backups: ServerBackup[];
  try {
    backups = await listServerBackups();
  } catch {
    return null;
  }
  const offer = shouldOfferRestore({ userId, offered: false, backups: backups.length, lastSuccessAt: account.lastSuccessAt });
  // Asked once per account on this phone (an account without backups yet is asked when it has one).
  if (backups.length > 0) await updateAccount(userId, (a) => ({ ...a, restoreOffered: true }));
  return offer ? backups[0]! : null;
}

// ---------- The automatic backup ----------

async function networkKind(): Promise<NetworkKind> {
  let Network: typeof import('expo-network');
  try {
    Network = await import('expo-network');
  } catch {
    return 'unknown';
  }
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false || state.type === Network.NetworkStateType.NONE) return 'offline';
    if (state.type === Network.NetworkStateType.WIFI || state.type === Network.NetworkStateType.ETHERNET) return 'wifi';
    if (state.type === Network.NetworkStateType.UNKNOWN || state.type === undefined) return 'unknown';
    return 'other';
  } catch {
    return 'unknown';
  }
}

/**
 * Called when the app opens and whenever it comes to the foreground: runs the daily backup when it is due, or records
 * why it was skipped. `incognito`: the tab in front is incognito.
 */
export async function maybeAutoBackup(context: { incognito: boolean }): Promise<void> {
  if (!serverBackupEnabled) return;
  await loadServerBackup();
  const userId = currentUserId();
  const prefs = snapshot.state.prefs;
  if (!userId || !prefs.auto || snapshot.job.kind !== 'idle') return;
  const account = snapshot.state.accounts[userId] ?? {};
  const config = await serverBackupConfig();
  const decision = autoBackupDecision({
    now: Date.now(),
    prefs,
    userId,
    suspended: suspended(),
    serverHasBackups: config !== null,
    hasPassword: keptPassword() !== null,
    incognito: context.incognito,
    network: await networkKind(),
    busy: snapshot.job.kind !== 'idle',
    lastSuccessAt: account.lastSuccessAt,
    last: account.last,
  });
  if (decision.run) {
    await backUpNow('auto').catch(() => undefined);
    return;
  }
  if (decision.quiet) return;
  const now = Date.now();
  if (shouldRecordSkip(account.last, decision.reason, now)) {
    await updateAccount(userId, (a) => ({ ...a, last: { at: now, trigger: 'auto', result: 'skipped', reason: decision.reason } as RunRecord }));
  }
}
