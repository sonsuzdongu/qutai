/**
 * Unit tests for the pro-mode account client (src/account/api.ts, session.ts, nonce.ts) against a fake server.
 * Run: npm run test:account (Node's built-in test runner; see README.md in this folder).
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { AccountApiError, createApi, type Fetch } from '../../src/account/api.ts';
import { isDeviceId, makeDeviceId, makeNonce } from '../../src/account/nonce.ts';
import { AccountSession, type SessionStorage, type StoredSession } from '../../src/account/session.ts';

const USER = { id: 'u1', providers: ['google' as const], status: 'active' as const };

function memoryStorage(initial: StoredSession | null = null) {
  let stored = initial;
  const saves: StoredSession[] = [];
  const storage: SessionStorage = {
    load: async () => stored,
    save: async (s) => {
      stored = s;
      saves.push(s);
    },
    clear: async () => {
      stored = null;
    },
    deviceId: async () => 'device_12345678',
  };
  return { storage, saves, get: () => stored };
}

type Route = (body: any, headers: Record<string, string>) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>;

function fakeServer(routes: Record<string, Route>) {
  const calls: { path: string; body: any; auth?: string }[] = [];
  const fetchImpl: Fetch = async (url, init) => {
    const path = new URL(url).pathname;
    const key = `${init?.method} ${path}`;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ path: key, body, auth: headers.Authorization });
    const route = routes[key];
    if (!route) return new Response(JSON.stringify({ error: { code: 'not_found', message: '', requestId: 'r' } }), { status: 404 });
    const answer = await route(body, headers);
    return answer.status === 204
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'X-Request-Id': 'req-1' } });
  };
  return { fetchImpl, calls };
}

const error = (status: number, code: string) => ({ status, body: { error: { code, message: 'x', requestId: 'req-9' } } });

function stored(now: number, accessExpiresAt: number): StoredSession {
  return { accessToken: 'a0', accessExpiresAt, refreshToken: 'r0', refreshExpiresAt: now + 86_400_000, user: USER };
}

describe('nonce and device id', () => {
  it('hands the provider the SHA-256 hex of the raw nonce', () => {
    const nonce = makeNonce((n) => new Uint8Array(randomBytes(n)));
    assert.match(nonce.raw, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(nonce.hashed, createHash('sha256').update(nonce.raw).digest('hex'));
  });

  it('makes device ids the server accepts', () => {
    const id = makeDeviceId((n) => new Uint8Array(randomBytes(n)));
    assert.ok(isDeviceId(id));
    assert.equal(isDeviceId('short'), false);
    assert.equal(isDeviceId('has space in it'), false);
  });
});

describe('api client', () => {
  it('maps the server error shape to its code and request id', async () => {
    const { fetchImpl } = fakeServer({ 'GET /me': () => error(403, 'account_suspended') });
    const api = createApi('https://api.test/', fetchImpl);
    await assert.rejects(api.request({ method: 'GET', path: '/me' }), (e: unknown) => {
      assert.ok(e instanceof AccountApiError);
      assert.equal(e.code, 'account_suspended');
      assert.equal(e.status, 403);
      assert.equal(e.requestId, 'req-9');
      return true;
    });
  });

  it('maps an unreadable error page by its status', async () => {
    const api = createApi('https://api.test', async () => new Response('<html>Bad gateway</html>', { status: 502 }));
    await assert.rejects(api.request({ method: 'GET', path: '/me' }), { code: 'unavailable' });
  });

  it('reports network failures and timeouts without an answer', async () => {
    const offline = createApi('https://api.test', async () => {
      throw new TypeError('Network request failed');
    });
    await assert.rejects(offline.request({ method: 'GET', path: '/me' }), { code: 'network', status: 0 });

    const slow = createApi('https://api.test', (_url, init) => {
      return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    await assert.rejects(slow.request({ method: 'GET', path: '/me', timeoutMs: 20 }), { code: 'timeout' });
  });
});

describe('session', () => {
  it('runs one refresh for concurrent requests and stores the new pair before using it', async () => {
    let now = 1_000_000;
    const mem = memoryStorage(stored(now, now + 10_000)); // expires within the margin: refresh first
    let refreshes = 0;
    const { fetchImpl, calls } = fakeServer({
      'POST /auth/refresh': async (body) => {
        refreshes++;
        assert.equal(body.refreshToken, 'r0');
        await new Promise((r) => setTimeout(r, 20));
        return { status: 200, body: { accessToken: 'a1', accessTokenExpiresIn: 900, refreshToken: 'r1', refreshTokenExpiresAt: now + 1e9 } };
      },
      'GET /me': (_b, headers) => {
        assert.equal(headers.Authorization, 'Bearer a1');
        assert.equal(mem.get()?.refreshToken, 'r1', 'the new refresh token is stored before it is used');
        return { status: 200, body: USER };
      },
    });
    const session = new AccountSession(createApi('https://api.test', fetchImpl), mem.storage, () => now);
    await session.load();
    await Promise.all([session.refreshUser(), session.refreshUser(), session.refreshUser()]);
    assert.equal(refreshes, 1);
    assert.equal(calls.filter((c) => c.path === 'GET /me').length, 3);
    assert.equal(session.refreshInFlight, false);
  });

  it('refreshes once and retries when the server rejects the access token', async () => {
    const now = 1_000_000;
    const mem = memoryStorage(stored(now, now + 600_000));
    const { fetchImpl, calls } = fakeServer({
      'POST /auth/refresh': () => ({
        status: 200,
        body: { accessToken: 'a1', accessTokenExpiresIn: 900, refreshToken: 'r1', refreshTokenExpiresAt: now + 1e9 },
      }),
      'GET /me': (_b, headers) => (headers.Authorization === 'Bearer a1' ? { status: 200, body: USER } : error(401, 'unauthorized')),
    });
    const session = new AccountSession(createApi('https://api.test', fetchImpl), mem.storage, () => now);
    await session.load();
    assert.deepEqual(await session.refreshUser(), USER);
    assert.deepEqual(
      calls.map((c) => c.path),
      ['GET /me', 'POST /auth/refresh', 'GET /me'],
    );
  });

  it('signs out when the server refuses the refresh token (reuse, revoked, deleted)', async () => {
    const now = 1_000_000;
    const mem = memoryStorage(stored(now, now));
    const { fetchImpl } = fakeServer({ 'POST /auth/refresh': () => error(401, 'unauthorized') });
    const session = new AccountSession(createApi('https://api.test', fetchImpl), mem.storage, () => now);
    await session.load();
    await assert.rejects(session.refreshUser(), { code: 'unauthorized' });
    assert.deepEqual(session.getState(), { status: 'signedOut', reason: 'expired' });
    assert.equal(mem.get(), null);
  });

  it('keeps the session when the server cannot be reached', async () => {
    const now = 1_000_000;
    const mem = memoryStorage(stored(now, now));
    const session = new AccountSession(
      createApi('https://api.test', async () => {
        throw new TypeError('offline');
      }),
      mem.storage,
      () => now,
    );
    await session.load();
    await assert.rejects(session.refreshUser(), { code: 'network' });
    assert.equal(session.getState().status, 'signedIn');
    assert.equal(mem.get()?.refreshToken, 'r0');
  });

  it('marks a suspended account and keeps its tokens', async () => {
    const now = 1_000_000;
    const mem = memoryStorage(stored(now, now + 600_000));
    const { fetchImpl } = fakeServer({ 'GET /me': () => error(403, 'account_suspended') });
    const session = new AccountSession(createApi('https://api.test', fetchImpl), mem.storage, () => now);
    await session.load();
    await assert.rejects(session.refreshUser(), { code: 'account_suspended' });
    await new Promise((r) => setTimeout(r, 0));
    const state = session.getState();
    assert.equal(state.status === 'signedIn' && state.user.status, 'suspended');
    assert.equal(mem.get()?.refreshToken, 'r0');
  });

  it('signs out locally even when the server is down', async () => {
    const now = 1_000_000;
    const mem = memoryStorage(stored(now, now + 600_000));
    const session = new AccountSession(createApi('https://api.test', async () => new Response('', { status: 503 })), mem.storage, () => now);
    await session.load();
    await session.signOut();
    assert.deepEqual(session.getState(), { status: 'signedOut' });
    assert.equal(mem.get(), null);
  });

  it('sends the device id with a sign-in and stores the session', async () => {
    const now = 1_000_000;
    const mem = memoryStorage();
    const { fetchImpl, calls } = fakeServer({
      'POST /auth/google': () => ({
        status: 200,
        body: { accessToken: 'a', accessTokenExpiresIn: 900, refreshToken: 'r', refreshTokenExpiresAt: now + 1e9, user: USER, created: true },
      }),
    });
    const session = new AccountSession(createApi('https://api.test', fetchImpl), mem.storage, () => now);
    await session.load();
    assert.equal(session.getState().status, 'signedOut');
    await session.signInWithGoogle({ idToken: 'id', nonce: 'n' });
    assert.deepEqual(calls[0].body, { idToken: 'id', nonce: 'n', deviceId: 'device_12345678' });
    assert.equal(mem.get()?.accessExpiresAt, now + 900_000);
    assert.deepEqual(session.getState(), { status: 'signedIn', user: USER });
  });

  it('drops a refresh answer that arrives after signing out', async () => {
    const now = 1_000_000;
    const mem = memoryStorage(stored(now, now));
    let release!: () => void;
    const { fetchImpl } = fakeServer({
      'POST /auth/refresh': async () => {
        await new Promise<void>((r) => (release = r));
        return { status: 200, body: { accessToken: 'a1', accessTokenExpiresIn: 900, refreshToken: 'r1', refreshTokenExpiresAt: now + 1e9 } };
      },
      'POST /auth/signout': () => ({ status: 204 }),
    });
    const session = new AccountSession(createApi('https://api.test', fetchImpl), mem.storage, () => now);
    await session.load();
    const pending = session.refreshUser();
    await new Promise((r) => setTimeout(r, 0));
    await session.signOut();
    release();
    await assert.rejects(pending);
    assert.equal(mem.get(), null);
    assert.equal(session.getState().status, 'signedOut');
  });
});
