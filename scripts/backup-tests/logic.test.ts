/**
 * Server backup's decisions (src/backup/server/logic.ts): when the daily backup runs or is skipped, the password's
 * lifecycle, error mapping, the stored state. Run: npm run test:backup (Node's test runner, no server).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AUTO_INTERVAL_MS,
  AUTO_RETRY_MS,
  DEFAULT_PREFS,
  autoBackupDecision,
  clearPasswordOn,
  deviceLabel,
  errorDetails,
  errorKind,
  isRetryable,
  newPasswordProblem,
  parseState,
  parseStoredPassword,
  passwordFor,
  runRecord,
  shouldOfferRestore,
  shouldRecordSkip,
  uploadId,
  type AutoInput,
} from '../../src/backup/server/logic.ts';
import { ServerBackupHttpError } from '../../src/backup/server/client.ts';

const NOW = 1_800_000_000_000;
const due = (o: Partial<AutoInput> = {}): AutoInput => ({
  now: NOW,
  prefs: { ...DEFAULT_PREFS, auto: true },
  userId: 'u1',
  suspended: false,
  serverHasBackups: true,
  hasPassword: true,
  incognito: false,
  network: 'wifi',
  busy: false,
  ...o,
});

describe('automatic backup: when it runs', () => {
  it('is off by default, and the defaults leave conversations, activity and keys out', () => {
    assert.equal(DEFAULT_PREFS.auto, false);
    assert.equal(DEFAULT_PREFS.network, 'wifi');
    assert.deepEqual([DEFAULT_PREFS.tabs, DEFAULT_PREFS.chats, DEFAULT_PREFS.activity, DEFAULT_PREFS.apiKeys], [true, false, false, false]);
    assert.deepEqual(autoBackupDecision(due({ prefs: DEFAULT_PREFS })), { run: false, quiet: true });
  });

  it('runs when due on Wi-Fi with a kept password', () => {
    assert.deepEqual(autoBackupDecision(due()), { run: true });
    assert.deepEqual(autoBackupDecision(due({ lastSuccessAt: NOW - AUTO_INTERVAL_MS })), { run: true });
  });

  it('waits a day after a success, quietly', () => {
    assert.deepEqual(autoBackupDecision(due({ lastSuccessAt: NOW - AUTO_INTERVAL_MS + 1 })), { run: false, quiet: true });
  });

  it('is quiet when signed out, without server support, or busy', () => {
    for (const o of [{ userId: null }, { serverHasBackups: false }, { busy: true }] as Partial<AutoInput>[]) {
      assert.deepEqual(autoBackupDecision(due(o)), { run: false, quiet: true }, JSON.stringify(o));
    }
  });

  it('says why it skipped: no password, incognito, offline, not on Wi-Fi, unknown network, suspended', () => {
    const reason = (o: Partial<AutoInput>) => {
      const d = autoBackupDecision(due(o));
      return d.run === false && d.quiet === false ? d.reason : d;
    };
    assert.equal(reason({ hasPassword: false }), 'no-password');
    assert.equal(reason({ incognito: true }), 'incognito');
    assert.equal(reason({ network: 'offline' }), 'offline');
    assert.equal(reason({ network: 'other' }), 'not-wifi');
    assert.equal(reason({ network: 'unknown' }), 'network-unknown');
    assert.equal(reason({ suspended: true }), 'suspended');
  });

  it('runs on any connection when the user chose so, but never offline', () => {
    const any = { ...DEFAULT_PREFS, auto: true, network: 'any' as const };
    assert.deepEqual(autoBackupDecision(due({ prefs: any, network: 'other' })), { run: true });
    assert.deepEqual(autoBackupDecision(due({ prefs: any, network: 'unknown' })), { run: true });
    assert.deepEqual(autoBackupDecision(due({ prefs: any, network: 'offline' })), { run: false, quiet: false, reason: 'offline' });
  });

  it('waits an hour after a failed automatic run, and until notBefore after a quota answer', () => {
    const failed = runRecord('auto', NOW - AUTO_RETRY_MS + 1, { ok: false, kind: 'unavailable' });
    assert.deepEqual(autoBackupDecision(due({ last: failed })), { run: false, quiet: true });
    assert.deepEqual(autoBackupDecision(due({ last: { ...failed, at: NOW - AUTO_RETRY_MS } })), { run: true });
    const quota = runRecord('auto', NOW - 2 * AUTO_RETRY_MS, { ok: false, kind: 'quota', retryAfterSeconds: 6 * 3600 });
    assert.equal(quota.notBefore, NOW - 2 * AUTO_RETRY_MS + 6 * 3600_000);
    assert.deepEqual(autoBackupDecision(due({ last: quota })), { run: false, quiet: true });
    assert.deepEqual(autoBackupDecision(due({ last: quota, now: quota.notBefore! })), { run: true });
    // A failed manual run doesn't hold the daily one back.
    assert.deepEqual(autoBackupDecision(due({ last: runRecord('manual', NOW - 1, { ok: false, kind: 'offline' }) })), { run: true });
  });

  it('records the same skip once an hour, not on every opening', () => {
    const skipped = { at: NOW - 1000, trigger: 'auto' as const, result: 'skipped' as const, reason: 'not-wifi' as const };
    assert.equal(shouldRecordSkip(skipped, 'not-wifi', NOW), false);
    assert.equal(shouldRecordSkip(skipped, 'incognito', NOW), true);
    assert.equal(shouldRecordSkip({ ...skipped, at: NOW - AUTO_RETRY_MS }, 'not-wifi', NOW), true);
    assert.equal(shouldRecordSkip(undefined, 'not-wifi', NOW), true);
  });
});

describe('password lifecycle', () => {
  it('needs 10 characters and the same twice', () => {
    assert.equal(newPasswordProblem('short', 'short'), 'too-short');
    assert.equal(newPasswordProblem('long enough!', 'long enough?'), 'mismatch');
    assert.equal(newPasswordProblem('long enough!', 'long enough!'), null);
  });

  it('is used only for the account it was kept for', () => {
    const stored = parseStoredPassword(JSON.stringify({ userId: 'u1', password: 'correct horse', setAt: 5 }));
    assert.deepEqual(stored, { userId: 'u1', password: 'correct horse', setAt: 5 });
    assert.equal(passwordFor(stored, 'u1'), 'correct horse');
    assert.equal(passwordFor(stored, 'u2'), null);
    assert.equal(passwordFor(stored, null), null);
  });

  it('ignores a damaged or too short stored value', () => {
    for (const raw of [null, '', 'x', '{}', JSON.stringify({ userId: 'u1', password: 'short' }), JSON.stringify({ password: 'correct horse' })]) {
      assert.equal(parseStoredPassword(raw), null, String(raw));
    }
  });

  it('is cleared when the user signs out, kept when the server ended the session or another account signs in', () => {
    const stored = { userId: 'u1', password: 'correct horse', setAt: 1 };
    assert.equal(clearPasswordOn({ status: 'signedOut' }, stored), true);
    assert.equal(clearPasswordOn({ status: 'signedOut', reason: 'expired' }, stored), false);
    assert.equal(clearPasswordOn({ status: 'signedIn', userId: 'u2' }, stored), false);
    assert.equal(clearPasswordOn({ status: 'signedOut' }, null), false);
  });
});

describe('errors', () => {
  const http = (code: string, status: number, reason: string | null = null) => new ServerBackupHttpError(code, status, reason, 'req-1');

  it('maps to the plain errors the screen shows', () => {
    assert.equal(errorKind(Object.assign(new Error('wrong-password'), { name: 'BackupError', code: 'wrong-password' })), 'wrong-password');
    assert.equal(errorKind(Object.assign(new Error('damaged'), { name: 'BackupError', code: 'damaged' })), 'damaged');
    assert.equal(errorKind(Object.assign(new Error('x'), { name: 'PayloadError', code: 'invalid' })), 'damaged');
    assert.equal(errorKind(http('network', 0)), 'offline');
    assert.equal(errorKind(http('timeout', 0)), 'offline');
    assert.equal(errorKind(http('aborted', 0)), 'cancelled');
    assert.equal(errorKind(http('rate_limited', 429, 'daily_upload_limit')), 'quota');
    assert.equal(errorKind(http('payload_too_large', 413, 'too_large')), 'too-large');
    assert.equal(errorKind(http('unauthorized', 401)), 'signed-out');
    assert.equal(errorKind(http('account_suspended', 403)), 'suspended');
    assert.equal(errorKind(http('unavailable', 503, 'not_configured')), 'unavailable');
    assert.equal(errorKind(http('internal', 500)), 'unavailable');
    assert.equal(errorKind(http('conflict', 409, 'upload_in_progress')), 'unavailable');
    assert.equal(errorKind(http('not_found', 404)), 'not-found');
    assert.equal(errorKind(http('checksum', 200)), 'damaged');
    assert.equal(errorKind(http('bad_request', 400, 'checksum_mismatch')), 'damaged');
    assert.equal(errorKind(new Error('boom')), 'unknown');
    assert.equal(errorKind(null), 'unknown');
  });

  it('retries only a dropped connection', () => {
    assert.equal(isRetryable(http('network', 0)), true);
    assert.equal(isRetryable(http('timeout', 0)), true);
    assert.equal(isRetryable(http('rate_limited', 429)), false);
    assert.equal(isRetryable(http('aborted', 0)), false);
  });

  it('gives a technical line for Details without tokens or content', () => {
    assert.equal(errorDetails(http('rate_limited', 429, 'daily_upload_limit')), 'rate_limited (daily_upload_limit) · HTTP 429 · request req-1');
    assert.equal(errorDetails(new ServerBackupHttpError('network', 0)), 'network');
  });
});

describe('stored state and helpers', () => {
  it('reads back what was stored and falls back to defaults on anything else', () => {
    const state = {
      prefs: { auto: true, network: 'any', tabs: false, chats: true, activity: true, apiKeys: true },
      accounts: { u1: { lastSuccessAt: 5, last: { at: 6, trigger: 'auto', result: 'skipped', reason: 'not-wifi' }, restoreOffered: true } },
    };
    assert.deepEqual(parseState(JSON.stringify(state)), state);
    assert.deepEqual(parseState('nonsense').prefs, DEFAULT_PREFS);
    assert.deepEqual(parseState(JSON.stringify({ prefs: { network: 'cellular', auto: 'yes' } })).prefs, DEFAULT_PREFS);
    const odd = parseState(JSON.stringify({ accounts: { u1: { last: { at: 1, result: 'exploded' } }, 'bad id!': {} } }));
    assert.deepEqual(odd.accounts, { u1: {} });
  });

  it('offers a restore once, only to a phone that never backed up this account', () => {
    assert.equal(shouldOfferRestore({ userId: 'u1', offered: false, backups: 2 }), true);
    assert.equal(shouldOfferRestore({ userId: 'u1', offered: true, backups: 2 }), false);
    assert.equal(shouldOfferRestore({ userId: 'u1', offered: false, backups: 0 }), false);
    assert.equal(shouldOfferRestore({ userId: 'u1', offered: false, backups: 2, lastSuccessAt: 1 }), false);
    assert.equal(shouldOfferRestore({ userId: null, offered: false, backups: 2 }), false);
  });

  it('labels the device generically, never with its own name', () => {
    assert.equal(deviceLabel('ios', '26.1'), 'iPhone · iOS 26.1');
    assert.equal(deviceLabel('ios', '26.1', true), 'iPad · iPadOS 26.1');
    assert.equal(deviceLabel('android', '16'), 'Android 16');
    assert.equal(deviceLabel('android', "Pat's phone"), 'Android Patsphone');
  });

  it('makes upload ids the server accepts', () => {
    const id = uploadId(new Uint8Array(16).fill(171));
    assert.match(id, /^[A-Za-z0-9_-]{16,64}$/);
  });
});
