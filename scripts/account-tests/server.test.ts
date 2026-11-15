/**
 * The pro-mode account client (src/account/) against Qutai's server running locally (`cd backend && npm run dev`).
 * Run: npm run test:account:server (skipped unless QUTAI_TEST_API_URL is set; see README.md in this folder).
 *
 * Real Apple and Google identity tokens can't be made here, so each test starts its session the way a sign-in
 * would leave it: a user, an identity and a refresh token written straight into the local D1 database (the token
 * hashed with the local REFRESH_TOKEN_PEPPER from backend/apps/api/.dev.vars, as the server does). Everything after
 * that goes through the server's real routes: refresh and rotation, reuse detection, GET /me, sign-out, sign-out
 * everywhere, DELETE /account. The sign-in routes are only checked for how they refuse a bad token.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { AccountApiError, createApi } from '../../src/account/api.ts';
import { AccountSession, type SessionStorage, type StoredSession } from '../../src/account/session.ts';

const API_URL = process.env.QUTAI_TEST_API_URL;
const BACKEND = join(import.meta.dirname, '../../backend');

function pepper(): string {
  const vars = readFileSync(join(BACKEND, 'apps/api/.dev.vars'), 'utf8');
  const line = vars.split('\n').find((l) => l.startsWith('REFRESH_TOKEN_PEPPER='));
  if (!line) throw new Error('REFRESH_TOKEN_PEPPER missing in backend/apps/api/.dev.vars');
  return line.slice('REFRESH_TOKEN_PEPPER='.length).trim();
}

function d1(sql: string) {
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'DB', '-c', 'apps/api/wrangler.jsonc', '--env', 'dev', '--local', '--persist-to', '.wrangler/state/api', '--command', sql],
    { cwd: BACKEND, stdio: 'pipe' },
  );
}

/** A user with a Google identity and one refresh token for `deviceId`, as `POST /auth/google` would leave them. */
function seedSession(deviceId = `test_${randomBytes(6).toString('hex')}`) {
  const userId = randomUUID();
  const refreshToken = 'qrt_' + randomBytes(32).toString('base64url');
  const hash = createHmac('sha256', pepper()).update(refreshToken).digest('hex');
  const now = Date.now();
  d1(
    `INSERT INTO users (id, status, created_at, last_seen_at) VALUES ('${userId}', 'active', ${now}, ${now});` +
      `INSERT INTO identities (provider, subject, user_id, created_at, client_id) VALUES ('google', 'test-${userId}', '${userId}', ${now}, 'test');` +
      `INSERT INTO refresh_tokens (hash, user_id, device_id, family_id, created_at, expires_at) VALUES ('${hash}', '${userId}', '${deviceId}', '${randomUUID()}', ${now}, ${now + 86_400_000});`,
  );
  return { userId, refreshToken, deviceId };
}

function memoryStorage(initial: StoredSession | null) {
  let stored = initial;
  const storage: SessionStorage = {
    load: async () => stored,
    save: async (s) => void (stored = s),
    clear: async () => void (stored = null),
    deviceId: async () => 'unused_device',
  };
  return { storage, get: () => stored };
}

/** A session that was signed in earlier and whose access token has run out: the first request refreshes. */
async function restoredSession(refreshToken: string, userId: string) {
  const mem = memoryStorage({
    accessToken: 'expired',
    accessExpiresAt: 0,
    refreshToken,
    refreshExpiresAt: Date.now() + 86_400_000,
    user: { id: userId, providers: ['google'], status: 'active' },
  });
  const session = new AccountSession(createApi(API_URL!), mem.storage);
  await session.load();
  return { session, mem };
}

describe('account client against the local server', { skip: !API_URL && 'QUTAI_TEST_API_URL not set' }, () => {
  it('refreshes once, rotates the refresh token, and reads GET /me', async () => {
    const { userId, refreshToken } = seedSession();
    const { session, mem } = await restoredSession(refreshToken, userId);
    const [a, b] = await Promise.all([session.refreshUser(), session.refreshUser()]);
    assert.equal(a.id, userId);
    assert.deepEqual(b, { id: userId, providers: ['google'], status: 'active' });
    const rotated = mem.get()!.refreshToken;
    assert.notEqual(rotated, refreshToken, 'the refresh token was rotated');
    assert.ok(mem.get()!.accessExpiresAt > Date.now() + 800_000, 'a 15-minute access token');
  });

  it('a reused refresh token ends the session on the server and here', async () => {
    const { userId, refreshToken } = seedSession();
    const api = createApi(API_URL!);
    const first = await api.request<{ refreshToken: string; accessToken: string }>({
      method: 'POST',
      path: '/auth/refresh',
      body: { refreshToken },
    });
    // The spent token again (a stolen copy, or a retried request): the whole family is revoked.
    await assert.rejects(api.request({ method: 'POST', path: '/auth/refresh', body: { refreshToken } }), { code: 'unauthorized' });
    await assert.rejects(api.request({ method: 'GET', path: '/me', accessToken: first.accessToken }), { code: 'unauthorized' });

    const { session, mem } = await restoredSession(first.refreshToken, userId);
    await assert.rejects(session.refreshUser(), { code: 'unauthorized' });
    assert.deepEqual(session.getState(), { status: 'signedOut', reason: 'expired' });
    assert.equal(mem.get(), null);
  });

  it('sign-out ends this device only', async () => {
    const user = seedSession('device_a_1234');
    const { session } = await restoredSession(user.refreshToken, user.userId);
    await session.refreshUser();
    const other = seedSessionFor(user.userId, 'device_b_1234');
    await session.signOut();
    assert.deepEqual(session.getState(), { status: 'signedOut' });
    const { session: second } = await restoredSession(other, user.userId);
    assert.equal((await second.refreshUser()).id, user.userId, 'the other device is still signed in');
  });

  it('sign out of all devices ends every session', async () => {
    const user = seedSession('device_a_5678');
    const other = seedSessionFor(user.userId, 'device_b_5678');
    const { session } = await restoredSession(user.refreshToken, user.userId);
    await session.signOutEverywhere();
    assert.deepEqual(session.getState(), { status: 'signedOut' });
    const { session: second } = await restoredSession(other, user.userId);
    await assert.rejects(second.refreshUser(), { code: 'unauthorized' });
  });

  it('DELETE /account deletes the account and signs out', async () => {
    const user = seedSession();
    const { session } = await restoredSession(user.refreshToken, user.userId);
    await session.refreshUser();
    const access = (session as unknown as { session: StoredSession }).session.accessToken;
    await session.deleteAccount();
    assert.deepEqual(session.getState(), { status: 'signedOut' });
    await assert.rejects(
      createApi(API_URL!).request({ method: 'GET', path: '/me', accessToken: access }),
      (e: unknown) => e instanceof AccountApiError && e.code === 'unauthorized',
    );
  });

  it('a suspended account keeps its session and can still sign out', async () => {
    const user = seedSession();
    const { session, mem } = await restoredSession(user.refreshToken, user.userId);
    await session.refreshUser();
    d1(`UPDATE users SET status = 'suspended' WHERE id = '${user.userId}'`);
    await assert.rejects(session.refreshUser(), { code: 'account_suspended' });
    await new Promise((r) => setTimeout(r, 0));
    const state = session.getState();
    assert.equal(state.status === 'signedIn' && state.user.status, 'suspended');
    assert.ok(mem.get());
    await session.signOutEverywhere();
    assert.equal(session.getState().status, 'signedOut');
  });

  it('refuses a sign-in it cannot verify with a clear code', async () => {
    const session = new AccountSession(createApi(API_URL!), memoryStorage(null).storage);
    await session.load();
    // 401 with real client ids configured; 503 while they are placeholders (the local default).
    await assert.rejects(session.signInWithGoogle({ idToken: 'not-a-token', nonce: 'nonce_12345678' }), (e: unknown) => {
      assert.ok(e instanceof AccountApiError);
      assert.ok(['unauthorized', 'unavailable', 'bad_request'].includes(e.code), e.code);
      return true;
    });
    assert.equal(session.getState().status, 'signedOut');
  });
});

/** Another device's refresh token for an existing user. */
function seedSessionFor(userId: string, deviceId: string): string {
  const refreshToken = 'qrt_' + randomBytes(32).toString('base64url');
  const hash = createHmac('sha256', pepper()).update(refreshToken).digest('hex');
  const now = Date.now();
  d1(
    `INSERT INTO refresh_tokens (hash, user_id, device_id, family_id, created_at, expires_at) VALUES ('${hash}', '${userId}', '${deviceId}', '${randomUUID()}', ${now}, ${now + 86_400_000});`,
  );
  return refreshToken;
}
