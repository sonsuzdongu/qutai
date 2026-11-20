/**
 * Unit tests for the pro-mode account client (src/account/api.ts, session.ts, nonce.ts) against a fake server.
 * Run: npm run test:account (Node's built-in test runner; see README.md in this folder).
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { AccountApiError, createApi, type Fetch } from '../../src/account/api.ts';
import { accountErrorDetails, providerFailureDetail, scrubDetail } from '../../src/account/errorDetails.ts';
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

  it('a rotated refresh token the phone fails to save is retried, kept working, saved before the next request, and told once (ACC-53)', async () => {
    const now = 1_000_000;
    const mem = memoryStorage(stored(now, now - 1));
    let failSaves = 5;
    const saveAttempts: string[] = [];
    const storage: SessionStorage = {
      ...mem.storage,
      save: async (s) => {
        saveAttempts.push(s.refreshToken);
        if (failSaves-- > 0) throw new Error('keychain locked');
        await mem.storage.save(s);
      },
    };
    const problems: string[] = [];
    let refreshes = 0;
    const { fetchImpl } = fakeServer({
      'POST /auth/refresh': () => {
        refreshes++;
        return { status: 200, body: { accessToken: 'a1', accessTokenExpiresIn: 900, refreshToken: 'r1', refreshTokenExpiresAt: now + 1e9 } };
      },
      'GET /me': (_b, headers) => (headers.Authorization === 'Bearer a1' ? { status: 200, body: USER } : error(401, 'unauthorized')),
    });
    const session = new AccountSession(
      createApi('https://api.test', fetchImpl),
      storage,
      () => now,
      undefined,
      (kind) => problems.push(kind),
      async () => {},
    );
    await session.load();
    // The refresh's save fails three times (and the user's profile save after it twice): the new pair still works.
    assert.deepEqual(await session.refreshUser(), USER);
    assert.equal(refreshes, 1);
    assert.deepEqual(saveAttempts.slice(0, 3), ['r1', 'r1', 'r1'], 'three tries');
    assert.deepEqual(problems, ['save'], 'told once');
    assert.equal(mem.get()?.refreshToken, 'r1', 'the profile save that worked stored the new pair');
    assert.equal(session.saveOutstanding, false);

    // Only the profile fails to save now: kept pending for the next request, but not told (the tokens are stored).
    failSaves = 100;
    await session.refreshUser();
    assert.equal(session.saveOutstanding, true);
    assert.deepEqual(problems, ['save']);
  });

  it('a pending save is retried before the next request and cleared once it works', async () => {
    const now = 1_000_000;
    const mem = memoryStorage(stored(now, now - 1));
    let refuse = true;
    const storage: SessionStorage = {
      ...mem.storage,
      save: async (s) => {
        if (refuse) throw new Error('disk full');
        await mem.storage.save(s);
      },
    };
    const problems: string[] = [];
    const { fetchImpl } = fakeServer({
      'POST /auth/refresh': () => ({
        status: 200,
        body: { accessToken: 'a1', accessTokenExpiresIn: 900, refreshToken: 'r1', refreshTokenExpiresAt: now + 1e9 },
      }),
      'GET /me': () => ({ status: 200, body: USER }),
    });
    const session = new AccountSession(createApi('https://api.test', fetchImpl), storage, () => now, undefined, (k) => problems.push(k), async () => {});
    await session.load();
    await session.refreshUser();
    assert.equal(session.saveOutstanding, true);
    assert.equal(mem.get()?.refreshToken, 'r0', 'the phone still holds the spent token');
    assert.deepEqual(problems, ['save']);
    refuse = false;
    await session.refreshUser();
    assert.equal(session.saveOutstanding, false);
    assert.equal(mem.get()?.refreshToken, 'r1');
    assert.deepEqual(problems, ['save'], 'not told again');
  });

  it('a sign-out the phone fails to clear is tried three times, then told', async () => {
    const now = 1_000_000;
    const mem = memoryStorage(stored(now, now + 600_000));
    let clears = 0;
    const storage: SessionStorage = {
      ...mem.storage,
      clear: async () => {
        clears++;
        throw new Error('keychain locked');
      },
    };
    const problems: string[] = [];
    const { fetchImpl } = fakeServer({ 'POST /auth/signout': () => ({ status: 204 }) });
    const session = new AccountSession(createApi('https://api.test', fetchImpl), storage, () => now, undefined, (k) => problems.push(k), async () => {});
    await session.load();
    await session.signOut();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(clears, 3);
    assert.deepEqual(problems, ['clear']);
    assert.equal(session.getState().status, 'signedOut');
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

  it('test sign-in sends the secret header and the device id, and stores an ordinary session', async () => {
    const now = 1_000_000;
    const mem = memoryStorage();
    const testUser = { id: 'u-test', providers: ['test' as const], status: 'active' as const };
    let secretSeen: string | undefined;
    const { fetchImpl, calls } = fakeServer({
      'POST /auth/dev': (_body, headers) => {
        secretSeen = headers['X-Dev-Sign-In-Secret'];
        return {
          status: 200,
          body: { accessToken: 'a', accessTokenExpiresIn: 900, refreshToken: 'r', refreshTokenExpiresAt: now + 1e9, user: testUser, created: true },
        };
      },
      'POST /auth/signout': () => ({ status: 204 }),
    });
    const session = new AccountSession(createApi('https://api.test', fetchImpl), mem.storage, () => now);
    await session.load();
    await session.signInAsTestUser('test-2', 'the-test-secret');
    assert.equal(secretSeen, 'the-test-secret');
    assert.deepEqual(calls[0].body, { user: 'test-2', deviceId: 'device_12345678' });
    assert.deepEqual(session.getState(), { status: 'signedIn', user: testUser });
    assert.equal(mem.get()?.refreshToken, 'r');
    await session.signOut();
    assert.deepEqual(calls[1], { path: 'POST /auth/signout', body: { refreshToken: 'r' }, auth: undefined });
    assert.equal(mem.get(), null);
  });

  it('test sign-in that the server refuses (off, wrong secret) stays signed out with not_found', async () => {
    const mem = memoryStorage();
    const { fetchImpl } = fakeServer({}); // every path answers 404, like a server with the test sign-in off
    const session = new AccountSession(createApi('https://api.test', fetchImpl), mem.storage);
    await session.load();
    await assert.rejects(session.signInAsTestUser('test-1', 'wrong'), { code: 'not_found', status: 404 });
    assert.deepEqual(session.getState(), { status: 'signedOut' });
    assert.equal(mem.get(), null);
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

describe('sign-in error details', () => {
  it('keeps the server reason when it is a short code word, and drops anything else', async () => {
    const answer = (reason: unknown): Fetch => async () =>
      new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'x', requestId: 'req-1', reason } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    for (const [sent, kept] of [
      ['wrong_audience', 'wrong_audience'],
      ['eyJhbGciOi.payload.sig', null],
      [42, null],
      [undefined, null],
    ] as const) {
      const api = createApi('https://api.example.test', answer(sent));
      await assert.rejects(
        api.request({ method: 'POST', path: '/auth/google', body: {} }),
        (e: unknown) => e instanceof AccountApiError && e.status === 401 && e.reason === kept && e.requestId === 'req-1',
      );
    }
  });

  it('describes a server refusal by status, code, reason and request id', () => {
    assert.equal(
      accountErrorDetails(new AccountApiError('unauthorized', 401, 'req-1', 'nonce_reused')),
      'Qutai server: HTTP 401 unauthorized (nonce_reused); request req-1',
    );
    assert.equal(
      accountErrorDetails(new AccountApiError('unavailable', 503, null, 'not_configured')),
      'Qutai server: HTTP 503 unavailable (not_configured)',
    );
    assert.equal(accountErrorDetails(new AccountApiError('network', 0)), 'Qutai server: no answer (network)');
    assert.equal(accountErrorDetails(new Error('x')), undefined);
    assert.equal(accountErrorDetails({ detail: 'Google: ERR_GOOGLE_SIGN_IN: TYPE_UNKNOWN: x' }), 'Google: ERR_GOOGLE_SIGN_IN: TYPE_UNKNOWN: x');
  });

  it('keeps the native error type and Google’s text but never an email, client id, token or nonce', () => {
    const native =
      "Call to function 'QutaiAuth.googleSignIn' has been rejected.\n→ Caused by: TYPE_UNKNOWN: During get sign-in intent, failure response from one tap: 10: [28444] Developer console is not set up correctly.";
    assert.equal(
      providerFailureDetail('Google', 'ERR_GOOGLE_SIGN_IN', native),
      'Google: ERR_GOOGLE_SIGN_IN: TYPE_UNKNOWN: During get sign-in intent, failure response from one tap: 10: [28444] Developer console is not set up correctly.',
    );
    const leaky = `person@example.com 123-abc.apps.googleusercontent.com eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln ${'a1b2'.repeat(16)}`;
    const scrubbed = scrubDetail(leaky);
    for (const secret of ['person@example.com', '123-abc', 'eyJ', 'a1b2a1b2']) assert.ok(!scrubbed.includes(secret), scrubbed);
    assert.equal(providerFailureDetail('Google', 'not a code!', undefined), undefined);
    assert.ok(scrubDetail('x'.repeat(1000)).length <= 300);
  });
});
