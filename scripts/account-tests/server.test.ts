/**
 * The pro-mode account client (src/account/) against Qutai's server running locally (`cd backend && npm run dev`).
 * Run: npm run test:account:server (skipped unless QUTAI_TEST_API_URL is set; see README.md in this folder).
 *
 * Real Apple and Google identity tokens can't be made here, so each test starts its session the way a sign-in
 * would leave it: a user, an identity and a refresh token written straight into the local D1 database (the token
 * hashed with the local REFRESH_TOKEN_PEPPER from backend/apps/api/.dev.vars, as the server does). Everything after
 * that goes through the server's real routes: refresh and rotation, reuse detection, GET /me, sign-out, sign-out
 * everywhere, DELETE /account. The sign-in routes are only checked for how they refuse a bad token.
 *
 * The test sign-in (POST /auth/dev) is exercised for real when QUTAI_TEST_DEV_LOGIN_SECRET is set to the server's
 * DEV_SIGN_IN_SECRET (and the server has DEV_SIGN_IN=true): sign in as a test user, then the same routes as above.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { AccountApiError, createApi } from '../../src/account/api.ts';
import { AccountSession, type SessionStorage, type StoredSession } from '../../src/account/session.ts';

const API_URL = process.env.QUTAI_TEST_API_URL;
const DEV_SECRET = process.env.QUTAI_TEST_DEV_LOGIN_SECRET;
const BACKEND = join(import.meta.dirname, '../../backend');
/** The local server's D1 state (the API's `dev` script uses this one; override when running it elsewhere). */
const D1_STATE = process.env.QUTAI_TEST_D1_STATE ?? '.wrangler/state/api';

/** The server's .dev.vars (for the pepper only); another file when the server under test runs with its own. */
const DEV_VARS = process.env.QUTAI_TEST_DEV_VARS ?? join(BACKEND, 'apps/api/.dev.vars');
/**
 * Sign-in by email: the file the server's output goes to, when it runs with EMAIL_SENDER=log, so the tests can read
 * the code and link it "sent" (backend/README.md › Sign-in by email › Trying it locally).
 */
const EMAIL_LOG = process.env.QUTAI_TEST_EMAIL_LOG;

function pepper(): string {
  const vars = readFileSync(DEV_VARS, 'utf8');
  const line = vars.split('\n').find((l) => l.startsWith('REFRESH_TOKEN_PEPPER='));
  if (!line) throw new Error('REFRESH_TOKEN_PEPPER missing in backend/apps/api/.dev.vars');
  return line.slice('REFRESH_TOKEN_PEPPER='.length).trim();
}

function d1(sql: string) {
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'DB', '-c', 'apps/api/wrangler.jsonc', '--env', 'dev', '--local', '--persist-to', D1_STATE, '--command', sql],
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
    assert.deepEqual({ id: b.id, providers: b.providers, status: b.status }, { id: userId, providers: ['google'], status: 'active' });
    // Since sign-in by email, GET /me also lists the methods (a seeded identity has no address).
    assert.deepEqual(b.methods?.map((m) => m.provider), ['google']);
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

describe('test sign-in against the local server', { skip: (!API_URL || !DEV_SECRET) && 'QUTAI_TEST_API_URL or QUTAI_TEST_DEV_LOGIN_SECRET not set' }, () => {
  // The server allows about 20 calls a minute to its auth routes per address (backend/README.md › Auth), and the
  // tests above use most of that: let the window pass first.
  before(() => new Promise((resolve) => setTimeout(resolve, 61_000)));

  const fresh = async () => {
    const mem = memoryStorage(null);
    const device = `devtest_${randomBytes(6).toString('hex')}`;
    const session = new AccountSession(createApi(API_URL!), { ...mem.storage, deviceId: async () => device });
    await session.load();
    return { session, mem };
  };

  it('signs in as a test user, and the session works like any other', async () => {
    const { session, mem } = await fresh();
    const signIn = await session.signInAsTestUser('test-1', DEV_SECRET!);
    assert.deepEqual(signIn.user.providers, ['test']);
    assert.equal(session.getState().status, 'signedIn');

    // GET /me, then a refresh (the access token made to look expired) and GET /me again.
    assert.deepEqual(await session.refreshUser(), signIn.user);
    const before = mem.get()!.refreshToken;
    (session as unknown as { session: StoredSession }).session.accessExpiresAt = 0;
    assert.equal((await session.refreshUser()).id, signIn.user.id);
    assert.notEqual(mem.get()!.refreshToken, before, 'the refresh token was rotated');

    const current = mem.get()!.refreshToken;
    await session.signOut();
    assert.deepEqual(session.getState(), { status: 'signedOut' });
    // The current (unspent) refresh token no longer works: the server ended the session.
    await assert.rejects(
      createApi(API_URL!).request({ method: 'POST', path: '/auth/refresh', body: { refreshToken: current } }),
      { code: 'unauthorized' },
    );
  });

  it('signs out of all devices and deletes a test account', async () => {
    const a = await fresh();
    const b = await fresh();
    const first = await a.session.signInAsTestUser('test-2', DEV_SECRET!);
    await b.session.signInAsTestUser('test-2', DEV_SECRET!);
    await a.session.signOutEverywhere();
    await assert.rejects(b.session.refreshUser(), { code: 'unauthorized' });

    const c = await fresh();
    await c.session.signInAsTestUser('test-2', DEV_SECRET!);
    await c.session.deleteAccount();
    assert.deepEqual(c.session.getState(), { status: 'signedOut' });
    const again = await (await fresh()).session.signInAsTestUser('test-2', DEV_SECRET!);
    assert.equal(again.created, true, 'a new account after deletion');
    assert.notEqual(again.user.id, first.user.id);
  });

  it('a wrong secret is answered as if the route did not exist', async () => {
    const { session } = await fresh();
    await assert.rejects(session.signInAsTestUser('test-3', `${DEV_SECRET}-wrong`), { code: 'not_found', status: 404 });
    assert.deepEqual(session.getState(), { status: 'signedOut' });
  });
});

/** The newest message the log sender printed for `address`: its code and its link's token. */
async function mailFor(address: string, after: number): Promise<{ code: string; token: string }> {
  for (let i = 0; i < 50; i++) {
    const text = readFileSync(EMAIL_LOG!, 'utf8').slice(after);
    const blocks = text.split('[dev email sender: nothing was sent]').filter((b) => b.includes(`To: ${address}\n`));
    const last = blocks.at(-1);
    // The code stands alone on an indented line (the subject's wording depends on the language).
    const code = last?.match(/^\s{2,}(\d{6})\s*$/m)?.[1];
    // The custom-scheme link, or the https one (the server's MAIL_INTENT_DOMAIN and MAIL_INTENT_PATH).
    const token = last?.match(/(?:qutai:\/\/sign-in\/email|https:\/\/[a-z0-9.-]+\/[A-Za-z0-9/._~-]+)\?token=([A-Za-z0-9_-]+)/)?.[1];
    if (code && token) return { code, token };
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('no message for the address in the server output');
}

const logSize = () => readFileSync(EMAIL_LOG!, 'utf8').length;

function emailSession(deviceId: string) {
  let stored: StoredSession | null = null;
  const storage: SessionStorage = {
    load: async () => stored,
    save: async (s) => void (stored = s),
    clear: async () => void (stored = null),
    deviceId: async () => deviceId,
  };
  return new AccountSession(createApi(API_URL!), storage, Date.now, () => 'tr-TR');
}

describe('sign-in by email against the local server', { skip: (!API_URL || !EMAIL_LOG) && 'QUTAI_TEST_API_URL or QUTAI_TEST_EMAIL_LOG not set' }, () => {
  // Like the test sign-in above: the earlier tests use most of the ~20 auth calls a minute per address. These use
  // about 12, four of them `start` (its own limit is ~5 a minute per address).
  before(() => new Promise((resolve) => setTimeout(resolve, 61_000)));

  // Addresses on the reserved .test domain: the log sender sends nothing anyway.
  const address = `qt-${randomBytes(4).toString('hex')}@example.test`;
  const device = `email_${randomBytes(6).toString('hex')}`;

  it('code: a wrong one is refused, the right one creates the account with an email method', async () => {
    const session = emailSession(device);
    const from = logSize();
    const started = await session.startEmailSignIn(address);
    assert.deepEqual(started, { expiresIn: 600, resendAfter: 30, codeLength: 6 });
    const { code } = await mailFor(address, from);
    const wrong = code === '000000' ? '111111' : '000000';
    await assert.rejects(session.verifyEmailSignIn(address, { code: wrong }), { code: 'unauthorized', reason: 'invalid_code' });
    const answer = await session.verifyEmailSignIn(address, { code });
    assert.equal(answer.created, true);
    assert.deepEqual(answer.user.providers, ['email']);
    assert.equal(answer.user.methods?.[0]?.email, address);
    const me = await session.refreshUser();
    assert.equal(me.methods?.[0]?.provider, 'email');
    // The code works once.
    await assert.rejects(session.verifyEmailSignIn(address, { code }), { reason: 'expired' });
  });

  it('asking again at once is refused with a wait; after it, the old code is replaced', async () => {
    const session = emailSession(device);
    let from = logSize();
    // The previous test asked for this address moments ago: wait out its resend time first.
    await session.startEmailSignIn(address).catch(async (e: unknown) => {
      if (!(e instanceof AccountApiError && e.reason === 'too_soon')) throw e;
      await new Promise((r) => setTimeout(r, ((e.retryAfter ?? 30) + 1) * 1000));
      from = logSize();
      await session.startEmailSignIn(address);
    });
    const first = await mailFor(address, from);
    const soon = await session.startEmailSignIn(address).catch((e: unknown) => e);
    assert.ok(soon instanceof AccountApiError && soon.reason === 'too_soon' && soon.retryAfter && soon.retryAfter <= 30, String(soon));
    await new Promise((r) => setTimeout(r, (soon.retryAfter! + 1) * 1000));
    from = logSize();
    await session.startEmailSignIn(address);
    const second = await mailFor(address, from);
    // The replaced message's code is checked against the newer one: a wrong code ("check the newest email").
    if (first.code !== second.code) await assert.rejects(session.verifyEmailSignIn(address, { code: first.code }), { reason: 'invalid_code' });

    // The link on another device: refused, and still usable on the right one.
    await assert.rejects(emailSession(`other_${randomBytes(6).toString('hex')}`).verifyEmailSignIn(address, { linkToken: second.token }), {
      code: 'forbidden',
      reason: 'wrong_device',
    });
    // Second sign-in to the same address, by the link: the same account.
    const answer = await session.verifyEmailSignIn(address, { linkToken: second.token });
    assert.equal(answer.created, false);
    assert.deepEqual(answer.user.providers, ['email']);
  });

  it('refuses an address it cannot use', async () => {
    // On verify, so it doesn't spend one of the few `start` calls a minute.
    await assert.rejects(emailSession(device).verifyEmailSignIn('not-an-address', { code: '123456' }), {
      code: 'bad_request',
      reason: 'invalid_email',
    });
  });
});
