/**
 * Server backup end to end against Qutai's server running locally with the backup routes (backend README › Server
 * backup): "device A" signs in as a test user, encrypts a backup the way the export does and uploads it; "device B"
 * signs in to the same account, lists, downloads, checks the checksum and opens it with the password. Then the
 * limits the app relies on: a repeated upload id, a damaged upload refused, delete.
 *
 * Run: QUTAI_TEST_API_URL=http://localhost:8790 QUTAI_TEST_DEV_LOGIN_SECRET=<the server's DEV_SIGN_IN_SECRET> npm run test:backup:server
 * Skipped unless both are set (the server needs DEV_SIGN_IN=true; README › Test sign-in). Uses the test user test-3 and
 * deletes the backups it made.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { decryptBackup, encryptBackup } from '../../src/backup/crypto.ts';
import { createServerBackupClient, fileSha256, ServerBackupHttpError, type TokenSource } from '../../src/backup/server/client.ts';

const API_URL = process.env.QUTAI_TEST_API_URL;
const SECRET = process.env.QUTAI_TEST_DEV_LOGIN_SECRET;
const skip = !API_URL || !SECRET ? 'set QUTAI_TEST_API_URL and QUTAI_TEST_DEV_LOGIN_SECRET' : false;

async function signIn(deviceId: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/dev`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dev-Sign-In-Secret': SECRET! },
    body: JSON.stringify({ user: 'test-3', deviceId }),
  });
  assert.equal(res.status, 200, `test sign-in: ${res.status}`);
  return ((await res.json()) as { accessToken: string }).accessToken;
}

const tokens = (token: string): TokenSource => ({
  get: async () => token,
  renew: async () => {
    throw new Error('no refresh in this test');
  },
  suspended() {},
  ended() {},
});

const random = async (n: number) => new Uint8Array(randomBytes(n));

describe('server backup against a local server', { skip }, () => {
  it('device A backs up, device B restores it with the password', async () => {
    const a = createServerBackupClient({ baseUrl: API_URL!, tokens: tokens(await signIn(`dev-a-${randomBytes(6).toString('hex')}`)) });
    const b = createServerBackupClient({ baseUrl: API_URL!, tokens: tokens(await signIn(`dev-b-${randomBytes(6).toString('hex')}`)) });
    await a.removeAll();
    const payload = JSON.stringify({ app: 'qutai', payloadVersion: 1, createdAt: Date.now(), appVersion: '1.0.0', schemaVersion: 9, bookmarks: { folders: [], items: [] } });
    const file = await encryptBackup(new TextEncoder().encode(payload), 'correct horse battery', random);
    const uploadId = `round-trip-${randomBytes(8).toString('hex')}`;
    const meta = { uploadId, appVersion: '1.0.0', deviceLabel: 'Android 16' };
    const first = await a.upload(file, meta);
    assert.equal(first.replayed, false);
    // A retry after a lost answer: the same backup, not a second one.
    assert.equal((await a.upload(file, meta)).replayed, true);

    const { backups, limits } = await b.list();
    assert.equal(backups.length, 1);
    assert.equal(backups[0]!.deviceLabel, 'Android 16');
    assert.equal(backups[0]!.sha256, fileSha256(file));
    assert.ok(limits && limits.keep >= 1);
    const downloaded = await b.download(backups[0]!);
    assert.equal(new TextDecoder().decode(await decryptBackup(downloaded, 'correct horse battery')), payload);

    // Not a backup file: refused, and nothing changes.
    const junk = new Uint8Array(200);
    await assert.rejects(a.upload(junk, { ...meta, uploadId: `junk-${randomBytes(8).toString('hex')}` }), (e: unknown) => e instanceof ServerBackupHttpError && e.reason === 'not_backup');
    assert.equal((await b.list()).backups.length, 1);

    await b.remove(backups[0]!.id);
    assert.equal((await a.list()).backups.length, 0);
  });
});
