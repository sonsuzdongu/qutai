/**
 * "Back up to your Qutai account" (docs/server-backup.md): the decisions, without React Native, so
 * scripts/backup-tests/ can run them in Node. The file itself is the export's (src/backup/crypto.ts); the server only
 * stores it.
 */

/** Shortest password accepted for a backup (the file export uses the same). */
export const MIN_BACKUP_PASSWORD = 10;

/** How often the automatic backup runs. */
export const AUTO_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** After a failed automatic run, the next try waits this long (no hammering a server that refused). */
export const AUTO_RETRY_MS = 60 * 60 * 1000;
/** After a quota answer, the wait is the server's Retry-After, at least this. */
const MIN_QUOTA_WAIT_MS = 60 * 60 * 1000;

export type NetworkChoice = 'wifi' | 'any';

/** What the user chose for server backups (kept on the phone). */
export type ServerBackupPrefs = {
  /** The daily automatic backup (off by default). */
  auto: boolean;
  /** Automatic backups only on Wi-Fi (default) or on any connection. "Back up now" ignores it. */
  network: NetworkChoice;
  /** What goes in, like the export's switches. Defaults: tabs, apps and their data on; conversations, activity and AI keys off. */
  tabs: boolean;
  chats: boolean;
  activity: boolean;
  apiKeys: boolean;
  /** The user's apps and their data (docs/mini-apps.md › Backup and restore). Both on by default. */
  apps: boolean;
  appData: boolean;
};

export const DEFAULT_PREFS: ServerBackupPrefs = {
  auto: false,
  network: 'wifi',
  tabs: true,
  chats: false,
  activity: false,
  apiKeys: false,
  apps: true,
  appData: true,
};

/** Why an automatic backup didn't run (shown under the switch). */
export type SkipReason = 'no-password' | 'incognito' | 'offline' | 'not-wifi' | 'network-unknown' | 'suspended';

/** What went wrong with a backup or a restore, in the words the screen uses. */
export type ServerBackupErrorKind =
  | 'wrong-password'
  | 'offline'
  | 'quota'
  | 'too-large'
  | 'signed-out'
  | 'suspended'
  | 'unavailable'
  | 'damaged'
  | 'not-found'
  | 'cancelled'
  | 'needs-build'
  | 'unknown';

/** The last automatic or manual run, for "Last backup … / Skipped because …". */
export type RunRecord = {
  at: number;
  /** Who started it. */
  trigger: 'auto' | 'manual';
  result: 'done' | 'skipped' | 'failed';
  reason?: SkipReason | ServerBackupErrorKind;
  /** For quota: don't try again before this (Unix ms). */
  notBefore?: number;
  /** Done, but without the apps' data: with it the file was over the server's limit (docs/mini-apps.md). */
  appDataLeftOut?: boolean;
};

/** Kept on the phone with the prefs: per account, so another account signing in starts fresh. */
export type ServerBackupState = {
  prefs: ServerBackupPrefs;
  /** Per user id: the last successful backup from this phone and the last run of any kind. */
  accounts: Record<
    string,
    {
      lastSuccessAt?: number;
      last?: RunRecord;
      /** When this account last signed in on this phone (a fresh sign-in, not an app start or a token refresh). */
      signedInAt?: number;
      /** The sign-in (its signedInAt) the restore offer was last shown for: once per sign-in. */
      offeredFor?: number;
      /** The id of the newest backup this install uploaded: never offered back to it. */
      lastUploadId?: string;
    }
  >;
};

export const EMPTY_STATE: ServerBackupState = { prefs: DEFAULT_PREFS, accounts: {} };

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const time = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
const SKIPS: readonly string[] = ['no-password', 'incognito', 'offline', 'not-wifi', 'network-unknown', 'suspended'];
const KINDS: readonly string[] = [
  'wrong-password',
  'offline',
  'quota',
  'too-large',
  'signed-out',
  'suspended',
  'unavailable',
  'damaged',
  'not-found',
  'cancelled',
  'needs-build',
  'unknown',
];

function parseRecord(v: unknown): RunRecord | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const r = v as Record<string, unknown>;
  const at = time(r.at);
  if (at === undefined || (r.result !== 'done' && r.result !== 'skipped' && r.result !== 'failed')) return undefined;
  const reason = typeof r.reason === 'string' && (SKIPS.includes(r.reason) || KINDS.includes(r.reason)) ? r.reason : undefined;
  const notBefore = time(r.notBefore);
  return {
    at,
    trigger: r.trigger === 'manual' ? 'manual' : 'auto',
    result: r.result,
    ...(reason ? { reason: reason as RunRecord['reason'] } : {}),
    ...(notBefore !== undefined ? { notBefore } : {}),
    ...(r.result === 'done' && r.appDataLeftOut === true ? { appDataLeftOut: true } : {}),
  };
}

/** Reads the stored state; anything unreadable falls back to the defaults. */
export function parseState(raw: string | null): ServerBackupState {
  if (!raw) return { prefs: { ...DEFAULT_PREFS }, accounts: {} };
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { prefs: { ...DEFAULT_PREFS }, accounts: {} };
  }
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const p = (typeof o.prefs === 'object' && o.prefs !== null ? o.prefs : {}) as Record<string, unknown>;
  const prefs: ServerBackupPrefs = {
    auto: bool(p.auto, DEFAULT_PREFS.auto),
    network: p.network === 'any' ? 'any' : 'wifi',
    tabs: bool(p.tabs, DEFAULT_PREFS.tabs),
    chats: bool(p.chats, DEFAULT_PREFS.chats),
    activity: bool(p.activity, DEFAULT_PREFS.activity),
    apiKeys: bool(p.apiKeys, DEFAULT_PREFS.apiKeys),
    apps: bool(p.apps, DEFAULT_PREFS.apps),
    appData: bool(p.appData, DEFAULT_PREFS.appData),
  };
  const accounts: ServerBackupState['accounts'] = {};
  if (typeof o.accounts === 'object' && o.accounts !== null) {
    for (const [id, a] of Object.entries(o.accounts as Record<string, unknown>).slice(0, 20)) {
      if (!/^[\w-]{1,128}$/.test(id) || typeof a !== 'object' || a === null) continue;
      const x = a as Record<string, unknown>;
      const last = parseRecord(x.last);
      const lastSuccessAt = time(x.lastSuccessAt);
      const signedInAt = time(x.signedInAt);
      const offeredFor = time(x.offeredFor);
      // The old once-per-phone flag (restoreOffered) is dropped: the offer now comes back at the next sign-in.
      accounts[id] = {
        ...(lastSuccessAt !== undefined ? { lastSuccessAt } : {}),
        ...(last ? { last } : {}),
        ...(signedInAt !== undefined ? { signedInAt } : {}),
        ...(offeredFor !== undefined ? { offeredFor } : {}),
        ...(typeof x.lastUploadId === 'string' && /^[\w-]{1,128}$/.test(x.lastUploadId) ? { lastUploadId: x.lastUploadId } : {}),
      };
    }
  }
  return { prefs, accounts };
}

// ---------- The automatic backup ----------

export type NetworkKind = 'wifi' | 'other' | 'offline' | 'unknown';

export type AutoInput = {
  now: number;
  prefs: ServerBackupPrefs;
  /** Null when signed out (or accounts are off). */
  userId: string | null;
  suspended: boolean;
  /** The server offers backups (GET /config › backups). */
  serverHasBackups: boolean;
  hasPassword: boolean;
  /** The tab in front is incognito (the user is browsing privately right now). */
  incognito: boolean;
  network: NetworkKind;
  /** A backup or restore is already running. */
  busy: boolean;
  lastSuccessAt?: number;
  last?: RunRecord;
};

/**
 * `run`, or why not. `quiet` reasons (off, not due yet, busy, nothing to back up to) are not recorded; the others are
 * shown as "Skipped: …" so the user knows why their daily backup didn't happen.
 */
export type AutoDecision = { run: true } | { run: false; quiet: true } | { run: false; quiet: false; reason: SkipReason };

export function autoBackupDecision(i: AutoInput): AutoDecision {
  if (!i.prefs.auto || !i.userId || !i.serverHasBackups || i.busy) return { run: false, quiet: true };
  // Due: a day after the last success (or never backed up), and not within an hour of a failed try.
  if (i.lastSuccessAt !== undefined && i.now - i.lastSuccessAt < AUTO_INTERVAL_MS) return { run: false, quiet: true };
  if (i.last?.trigger === 'auto' && i.last.result === 'failed') {
    if (i.last.notBefore !== undefined && i.now < i.last.notBefore) return { run: false, quiet: true };
    if (i.now - i.last.at < AUTO_RETRY_MS) return { run: false, quiet: true };
  }
  const skip = (reason: SkipReason): AutoDecision => ({ run: false, quiet: false, reason });
  if (i.suspended) return skip('suspended');
  if (!i.hasPassword) return skip('no-password');
  if (i.incognito) return skip('incognito');
  if (i.network === 'offline') return skip('offline');
  if (i.prefs.network === 'wifi') {
    if (i.network === 'unknown') return skip('network-unknown');
    if (i.network !== 'wifi') return skip('not-wifi');
  }
  return { run: true };
}

/** Records the same skip once: a repeat within the same day doesn't rewrite "Skipped at …" every time the app opens. */
export function shouldRecordSkip(last: RunRecord | undefined, reason: SkipReason, now: number): boolean {
  return !(last && last.result === 'skipped' && last.reason === reason && now - last.at < AUTO_RETRY_MS);
}

/** The record for a finished run. */
export function runRecord(
  trigger: RunRecord['trigger'],
  now: number,
  outcome: { ok: true; appDataLeftOut?: boolean } | { ok: false; kind: ServerBackupErrorKind; retryAfterSeconds?: number | null },
): RunRecord {
  if (outcome.ok) return { at: now, trigger, result: 'done', ...(outcome.appDataLeftOut ? { appDataLeftOut: true } : {}) };
  const record: RunRecord = { at: now, trigger, result: 'failed', reason: outcome.kind };
  if (outcome.kind === 'quota') record.notBefore = now + Math.max(MIN_QUOTA_WAIT_MS, (outcome.retryAfterSeconds ?? 0) * 1000);
  return record;
}

// ---------- Errors ----------

/** What the HTTP client throws (src/backup/server/client.ts), as data. */
export type HttpFailure = {
  /** The server's error code, or `network` / `timeout` / `aborted` / `bad_response` / `checksum`. */
  code: string;
  status: number;
  reason: string | null;
};

/** One sentence's worth: which of the plain errors the screen shows. */
export function errorKind(e: unknown): ServerBackupErrorKind {
  if (typeof e !== 'object' || e === null) return 'unknown';
  const x = e as Partial<HttpFailure> & { name?: string; code?: unknown };
  // The file's own errors (src/backup/crypto.ts BackupError, payload.ts PayloadError).
  if (x.name === 'BackupError') return x.code === 'wrong-password' ? 'wrong-password' : 'damaged';
  if (x.name === 'PayloadError') return 'damaged';
  if (x.name === 'CryptoUnavailableError') return 'needs-build';
  if (x.name === 'AbortError') return 'cancelled';
  if (x.name !== 'ServerBackupHttpError') return 'unknown';
  switch (x.code) {
    case 'aborted':
      return 'cancelled';
    case 'network':
    case 'timeout':
      return 'offline';
    case 'payload_too_large':
      return 'too-large';
    case 'rate_limited':
      return 'quota';
    case 'unauthorized':
      return 'signed-out';
    case 'account_suspended':
      return 'suspended';
    case 'not_found':
      return 'not-found';
    case 'checksum':
      return 'damaged';
    case 'bad_request':
      // The server refused the file itself: something on the way changed it, or it isn't a backup.
      return x.reason === 'checksum_mismatch' || x.reason === 'not_backup' || x.reason === 'incomplete' ? 'damaged' : 'unknown';
    case 'conflict':
      // Another upload of this account is still running (another phone, or a retry still in flight).
      return 'unavailable';
    case 'unavailable':
    case 'internal':
    case 'bad_response':
    case 'maintenance':
      return 'unavailable';
    default:
      return 'unknown';
  }
}

/** Errors worth one automatic retry with the same upload id (the connection dropped; the server may have it already). */
export function isRetryable(e: unknown): boolean {
  const x = e as Partial<HttpFailure> & { name?: string };
  return x?.name === 'ServerBackupHttpError' && (x.code === 'network' || x.code === 'timeout');
}

// ---------- The password ----------

/** Kept in secure storage with the account it belongs to. */
export type StoredPassword = { userId: string; password: string; setAt: number };

export function parseStoredPassword(raw: string | null): StoredPassword | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredPassword>;
    if (typeof v.userId === 'string' && typeof v.password === 'string' && v.password.length >= MIN_BACKUP_PASSWORD) {
      return { userId: v.userId, password: v.password, setAt: typeof v.setAt === 'number' ? v.setAt : 0 };
    }
  } catch {}
  return null;
}

/** The password for this account, or null: one kept for another account is never used. */
export function passwordFor(stored: StoredPassword | null, userId: string | null): string | null {
  return stored && userId && stored.userId === userId ? stored.password : null;
}

/** A new password's problem, or null when it can be used. */
export function newPasswordProblem(password: string, repeat: string): 'too-short' | 'mismatch' | null {
  if (password.length < MIN_BACKUP_PASSWORD) return 'too-short';
  if (repeat !== password) return 'mismatch';
  return null;
}

/**
 * When the kept password goes. Sign-out (by the user) and account deletion clear it: a phone handed on or sold after
 * signing out must not hold the key to that account's server copies. A session the server ended ('expired') keeps it,
 * because the same person signs in again and nothing changed hands. Another account signing in never uses it.
 */
export function clearPasswordOn(event: { status: 'signedOut'; reason?: 'expired' } | { status: 'signedIn'; userId: string }, stored: StoredPassword | null): boolean {
  if (!stored) return false;
  if (event.status === 'signedOut') return event.reason !== 'expired';
  return false;
}

// ---------- Restore on a new phone ----------

/**
 * Whether to offer the account's newest server backup (decided 19 Nov 2026, docs/server-backup.md › Restore offer): once
 * after each fresh sign-in to that account on this phone (signing in with Apple, Google, email or the test sign-in; not
 * an app start with a kept session, not a token refresh), also when this phone has backed up to that account before,
 * and again after "Not now" at the next sign-in. Never twice for one sign-in, never before a sign-in is on record, and
 * not when the newest backup is the one this install uploaded itself (the phone's data is at least as new). A backup
 * this phone restored earlier can't be told apart, so it is offered.
 */
export function shouldOfferRestore(i: {
  userId: string | null;
  signedInAt?: number;
  offeredFor?: number;
  /** The account's backups, newest first. */
  backups: { id: string }[];
  lastUploadId?: string;
}): boolean {
  if (!i.userId || i.signedInAt === undefined || i.offeredFor === i.signedInAt) return false;
  const newest = i.backups[0];
  if (!newest) return false;
  return newest.id !== i.lastUploadId;
}

// ---------- Small helpers ----------

/** A generic label for the list ("iPhone · iOS 26.1"): never the phone's own name, which often holds the owner's. */
export function deviceLabel(os: string, version: string | number, isPad = false): string {
  const v = String(version).replace(/[^\w.]/g, '').slice(0, 12);
  if (os === 'ios') return isPad ? `iPad · iPadOS ${v}` : `iPhone · iOS ${v}`;
  if (os === 'android') return `Android ${v}`;
  return os.slice(0, 20);
}

/** A random id for one backup's upload, repeated on a retry (16–64 of [A-Za-z0-9_-] on the server). */
export function uploadId(random: Uint8Array): string {
  return [...random].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Lowercase hex. */
export function hex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, '0');
  return out;
}

/** The technical line under "Details": the server's code, reason, status and request id; never a token or content. */
export function errorDetails(e: unknown): string {
  if (typeof e !== 'object' || e === null) return String(e);
  const x = e as { name?: string; code?: unknown; status?: unknown; reason?: unknown; requestId?: unknown; message?: unknown };
  if (x.name === 'ServerBackupHttpError') {
    const parts = [String(x.code) + (x.reason ? ` (${String(x.reason)})` : '')];
    if (typeof x.status === 'number' && x.status > 0) parts.push(`HTTP ${x.status}`);
    if (typeof x.requestId === 'string') parts.push(`request ${x.requestId}`);
    return parts.join(' · ');
  }
  return [x.name, typeof x.code === 'string' ? x.code : null].filter(Boolean).join(': ') || 'Error';
}

/**
 * Over the server's limit with the apps' data in it: the backup is made again without that data rather than failing
 * (docs/mini-apps.md › Backup and restore). Null when that wouldn't help (no limit, it fits, or the data is out already).
 */
export function appDataFallback(bytes: number, limit: number | null | undefined, prefs: Pick<ServerBackupPrefs, 'apps' | 'appData'>): boolean {
  return !!limit && bytes > limit && prefs.apps && prefs.appData;
}
