/**
 * Sign-in by email on the app's side (src/account/emailSignIn.ts and the session's email calls) against a fake
 * server: requests, the pending address's lifecycle, link parsing, the reason → sentence mapping, and that the
 * browser's entry points never take a sign-in link as a page. Run: npm run test:account (no server needed).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AccountApiError, createApi, parseRetryAfter, type Fetch } from '../../src/account/api.ts';
import {
  codeDigits,
  countdownText,
  EmailSignInFlow,
  emailErrorMessage,
  isSignInLink,
  looksLikeEmail,
  MalformedSignInLink,
  NoPendingEmailSignIn,
  parseEmailSignInLink,
  waitSpan,
  type EmailSignInEvent,
  type PendingEmailSignIn,
  type PendingStorage,
} from '../../src/account/emailSignIn.ts';
import { accountErrorDetails, scrubDetail } from '../../src/account/errorDetails.ts';
import { AccountSession, type SessionStorage, type StoredSession } from '../../src/account/session.ts';

const TOKEN = 'qel_' + 'A'.repeat(43);
const USER = { id: 'u1', providers: ['email' as const], methods: [{ provider: 'email' as const, email: 'a@example.com', linkedAt: 1 }], status: 'active' as const };
const SIGNED_IN = (extra: Record<string, unknown> = {}) => ({
  status: 200,
  body: { accessToken: 'a1', accessTokenExpiresIn: 900, refreshToken: 'r1', refreshTokenExpiresAt: Date.now() + 1e9, user: USER, created: false, ...extra },
});

type Answer = { status: number; body?: unknown; headers?: Record<string, string> };
type Route = (body: any) => Answer | Promise<Answer>;

function fakeServer(routes: Record<string, Route>) {
  const calls: { path: string; body: any }[] = [];
  const fetchImpl: Fetch = async (url, init) => {
    const key = `${init?.method} ${new URL(url).pathname}`;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path: key, body });
    const route = routes[key];
    if (!route) return new Response(JSON.stringify({ error: { code: 'not_found', message: '', requestId: 'r' } }), { status: 404 });
    const answer = await route(body);
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'X-Request-Id': 'req-1', ...answer.headers } });
  };
  return { fetchImpl, calls };
}

const refuse = (status: number, code: string, reason?: string, headers?: Record<string, string>): Answer => ({
  status,
  body: { error: { code, message: 'x', requestId: 'req-9', ...(reason ? { reason } : {}) } },
  headers,
});

function sessionStorage(): SessionStorage & { get(): StoredSession | null } {
  let stored: StoredSession | null = null;
  return {
    load: async () => stored,
    save: async (s) => {
      stored = s;
    },
    clear: async () => {
      stored = null;
    },
    deviceId: async () => 'device_12345678',
    get: () => stored,
  };
}

function pendingStorage(initial: unknown = null) {
  let stored: unknown = initial;
  const writes: unknown[] = [];
  const storage: PendingStorage = {
    load: async () => stored,
    save: async (p) => {
      stored = p;
      writes.push(p);
    },
    clear: async () => {
      stored = null;
      writes.push(null);
    },
  };
  return { storage, writes, get: () => stored as PendingEmailSignIn | null };
}

function setup(routes: Record<string, Route>, opts: { pending?: unknown; locale?: string; now?: () => number } = {}) {
  const server = fakeServer(routes);
  const store = sessionStorage();
  const now = opts.now ?? Date.now;
  const session = new AccountSession(createApi('https://api.test', server.fetchImpl), store, now, () => opts.locale);
  const pending = pendingStorage(opts.pending ?? null);
  const flow = new EmailSignInFlow(session, pending.storage, now);
  const events: EmailSignInEvent[] = [];
  flow.onEvent((e) => events.push(e));
  return { server, store, session, pending, flow, events };
}

const START = (): Answer => ({ status: 202, body: { expiresIn: 600, resendAfter: 30, codeLength: 6 } });

describe('email sign-in: client calls', () => {
  it('starts with the address, the device id and the interface language', async () => {
    const { flow, server, pending } = setup({ 'POST /auth/email/start': START }, { locale: 'tr-TR' });
    await flow.start('  a@example.com ');
    assert.deepEqual(server.calls[0], {
      path: 'POST /auth/email/start',
      body: { email: 'a@example.com', deviceId: 'device_12345678', locale: 'tr-TR' },
    });
    const state = flow.getState();
    assert.equal(state.status, 'pending');
    assert.equal(pending.get()?.email, 'a@example.com');
    assert.equal(pending.get()?.codeLength, 6);
    assert.ok(!('code' in (pending.get() as object)), 'the code is never stored');
  });

  it('verifies a code with the pending address and signs in like the other methods', async () => {
    const { flow, server, store, session, pending, events } = setup(
      { 'POST /auth/email/start': START, 'POST /auth/email/verify': () => SIGNED_IN({ created: true }) },
      { locale: 'de-DE' },
    );
    await flow.start('a@example.com');
    const response = await flow.verifyCode('123456');
    assert.equal(response.created, true);
    assert.deepEqual(server.calls[1].body, { email: 'a@example.com', deviceId: 'device_12345678', code: '123456', locale: 'de-DE' });
    assert.equal(store.get()?.refreshToken, 'r1');
    assert.equal(session.getState().status, 'signedIn');
    assert.equal(flow.getState().status, 'idle');
    assert.equal(pending.get(), null, 'cleared on success');
    assert.deepEqual(events.map((e) => e.type === 'signedIn' && e.via), ['code']);
  });

  it('verifies a link token with the pending address, never with a code', async () => {
    const { flow, server } = setup({ 'POST /auth/email/start': START, 'POST /auth/email/verify': () => SIGNED_IN() });
    await flow.start('a@example.com');
    await flow.verifyLink(TOKEN);
    assert.deepEqual(server.calls[1].body, { email: 'a@example.com', deviceId: 'device_12345678', linkToken: TOKEN });
  });

  it('sends locale on Apple and Google sign-ins too, and leaves out a malformed one', async () => {
    const answer = () => SIGNED_IN();
    const a = setup({ 'POST /auth/google': answer, 'POST /auth/apple': answer }, { locale: 'pt-BR' });
    await a.session.signInWithGoogle({ idToken: 't', nonce: 'n' });
    await a.session.signInWithApple({ identityToken: 't', nonce: 'n' });
    assert.equal(a.server.calls[0].body.locale, 'pt-BR');
    assert.equal(a.server.calls[1].body.locale, 'pt-BR');
    const b = setup({ 'POST /auth/google': answer }, { locale: 'not a locale!' });
    await b.session.signInWithGoogle({ idToken: 't', nonce: 'n' });
    assert.equal('locale' in b.server.calls[0].body, false);
  });

  it('tells sign-in listeners the server answer (emailLink, created)', async () => {
    const { flow, session } = setup({ 'POST /auth/email/start': START, 'POST /auth/email/verify': () => SIGNED_IN({ emailLink: 'linked' }) });
    const seen: unknown[] = [];
    session.onSignIn((r) => seen.push(r.emailLink));
    await flow.start('a@example.com');
    await flow.verifyCode('123456');
    assert.deepEqual(seen, ['linked']);
  });

  it('keeps a stored session without methods (from before sign-in by email) usable', async () => {
    const store = sessionStorage();
    const old: StoredSession = {
      accessToken: 'a0',
      accessExpiresAt: Date.now() + 600_000,
      refreshToken: 'r0',
      refreshExpiresAt: Date.now() + 1e9,
      user: { id: 'u0', providers: ['google'], status: 'active' },
    };
    await store.save(old);
    const session = new AccountSession(createApi('https://api.test', fakeServer({}).fetchImpl), store);
    await session.load();
    const state = session.getState();
    assert.equal(state.status, 'signedIn');
    assert.equal(state.status === 'signedIn' && state.user.methods, undefined);
  });
});

describe('email sign-in: pending address lifecycle', () => {
  it('survives a restart (loaded from storage) until it expires', async () => {
    let now = 1_000_000;
    const stored: PendingEmailSignIn = { email: 'a@example.com', expiresAt: now + 600_000, resendAt: now + 30_000, codeLength: 6 };
    const live = setup({}, { pending: stored, now: () => now });
    await live.flow.load();
    assert.equal(live.flow.getState().status, 'pending');

    now += 700_000;
    const late = setup({}, { pending: stored, now: () => now });
    await late.flow.load();
    assert.equal(late.flow.getState().status, 'idle');
    assert.equal(late.pending.get(), null, 'an expired one is cleared');
  });

  it('drops junk found in storage', async () => {
    const junk = setup({}, { pending: { email: 42 } });
    await junk.flow.load();
    assert.equal(junk.flow.getState().status, 'idle');
    assert.equal(junk.pending.get(), null);
  });

  it('cancel clears it, and a late start answer for the old address is dropped', async () => {
    let release!: () => void;
    const { flow, pending } = setup({
      'POST /auth/email/start': () => new Promise<Answer>((r) => (release = () => r(START()))),
    });
    const started = flow.start('a@example.com');
    await new Promise((r) => setTimeout(r, 5));
    flow.cancel();
    release();
    await started;
    assert.equal(flow.getState().status, 'idle');
    assert.equal(pending.get(), null);
  });

  it('marks the code dead on expired / too_many_attempts but keeps the address for "send a new code"', async () => {
    const { flow, pending } = setup({
      'POST /auth/email/start': START,
      'POST /auth/email/verify': () => refuse(401, 'unauthorized', 'too_many_attempts'),
    });
    await flow.start('a@example.com');
    await assert.rejects(flow.verifyCode('000000'), (e: unknown) => e instanceof AccountApiError && e.reason === 'too_many_attempts');
    const state = flow.getState();
    assert.equal(state.status, 'pending');
    assert.equal(state.status === 'pending' && state.codeDead, true);
    assert.equal(state.status === 'pending' && state.verifying, null);
    assert.equal(pending.get()?.codeDead, true);
    assert.equal(flow.expired(), true);
  });

  it('a wrong code keeps the code usable', async () => {
    const { flow } = setup({ 'POST /auth/email/start': START, 'POST /auth/email/verify': () => refuse(401, 'unauthorized', 'invalid_code') });
    await flow.start('a@example.com');
    await assert.rejects(flow.verifyCode('000000'));
    const state = flow.getState();
    assert.equal(state.status === 'pending' && !state.codeDead && !flow.expired(), true);
  });

  it('resend asks again for the same address and resets the countdown', async () => {
    let now = 5_000_000;
    const { flow, server } = setup({ 'POST /auth/email/start': START }, { now: () => now });
    await flow.start('a@example.com');
    now += 40_000;
    await flow.resend();
    assert.equal(server.calls.length, 2);
    assert.equal(server.calls[1].body.email, 'a@example.com');
    const state = flow.getState();
    assert.equal(state.status === 'pending' && state.resendAt, now + 30_000);
  });

  it('bounds odd server timings', async () => {
    const now = 0;
    const { flow } = setup({ 'POST /auth/email/start': () => ({ status: 202, body: { expiresIn: 1e9, resendAfter: -1, codeLength: 99 } }) }, { now: () => now });
    await flow.start('a@example.com');
    const state = flow.getState();
    assert.equal(state.status === 'pending' && state.expiresAt, 3_600_000);
    assert.equal(state.status === 'pending' && state.resendAt, 30_000);
    assert.equal(state.status === 'pending' && state.codeLength, 6);
  });

  it('a link with nothing pending reports NoPendingEmailSignIn (the wrong-device wording) without calling the server', async () => {
    const { flow, server, events } = setup({});
    assert.equal(await flow.verifyLink(TOKEN), null);
    assert.equal(server.calls.length, 0);
    assert.equal(events.length, 1);
    assert.ok(events[0].type === 'linkFailed' && events[0].error instanceof NoPendingEmailSignIn);
  });

  it('the same link delivered twice is handled once; a link that got no answer can be opened again', async () => {
    let fail = true;
    const { flow, server } = setup({
      'POST /auth/email/start': START,
      'POST /auth/email/verify': () => (fail ? refuse(503, 'unavailable') : SIGNED_IN()),
    });
    await flow.start('a@example.com');
    await flow.verifyLink(TOKEN);
    fail = false;
    await flow.verifyLink(TOKEN);
    assert.equal(server.calls.filter((c) => c.path === 'POST /auth/email/verify').length, 2);
    assert.equal(flow.getState().status, 'idle');
    await flow.verifyLink(TOKEN);
    assert.equal(server.calls.filter((c) => c.path === 'POST /auth/email/verify').length, 2);
  });

  it('says whether a code screen was open when the link arrived (it disappears once signed in)', async () => {
    const { flow, events } = setup({ 'POST /auth/email/start': START, 'POST /auth/email/verify': () => SIGNED_IN() });
    await flow.start('a@example.com');
    const hide = flow.showScreen();
    const done = flow.verifyLink(TOKEN);
    hide(); // the account replaces the code screen before the answer is reported
    await done;
    assert.equal(flow.screenShown, false);
    assert.ok(events[0].type === 'signedIn' && events[0].onScreen === true);
  });

  it('a refused link (wrong device) reports it and keeps the code usable on this screen', async () => {
    const { flow, events } = setup({ 'POST /auth/email/start': START, 'POST /auth/email/verify': () => refuse(403, 'forbidden', 'wrong_device') });
    await flow.start('a@example.com');
    await flow.verifyLink(TOKEN);
    assert.equal(flow.getState().status, 'pending');
    assert.ok(events[0].type === 'linkFailed');
  });
});

describe('email sign-in: links', () => {
  it('reads the token from the mail link', () => {
    assert.equal(parseEmailSignInLink(`qutai://sign-in/email?token=${TOKEN}`), TOKEN);
    assert.equal(parseEmailSignInLink(`QUTAI://sign-in/email/?token=${TOKEN}&utm_source=mail`), TOKEN);
    assert.equal(parseEmailSignInLink(`qutai://sign-in/email?token=${encodeURIComponent(TOKEN)}#x`), TOKEN);
  });

  it('reads the token from the website page the mail links to', () => {
    const page = `https://qutai.sonsuzdongu.com/intent/sign-in/email?token=${TOKEN}`;
    assert.equal(parseEmailSignInLink(page), TOKEN);
    assert.equal(parseEmailSignInLink(`https://QUTAI.sonsuzdongu.com/intent/sign-in/email/?token=${TOKEN}&tried=1`), TOKEN);
    assert.equal(isSignInLink(page), true);
    assert.equal(isSignInLink('https://qutai.sonsuzdongu.com/intent/sign-in/email'), true, 'no token: still never a page here');
    for (const other of [
      `https://evil.example/intent/sign-in/email?token=${TOKEN}`,
      `https://qutai.sonsuzdongu.com.evil.example/intent/sign-in/email?token=${TOKEN}`,
      `https://user@qutai.sonsuzdongu.com/intent/sign-in/email?token=${TOKEN}`,
      `http://qutai.sonsuzdongu.com/intent/sign-in/email?token=${TOKEN}`,
      `https://qutai.sonsuzdongu.com/en/?token=${TOKEN}`,
      'https://qutai.sonsuzdongu.com/',
    ]) {
      assert.equal(parseEmailSignInLink(other), null, other);
      assert.equal(isSignInLink(other), false, other);
    }
  });

  it('refuses anything else', () => {
    for (const url of [
      'qutai://sign-in/email',
      'qutai://sign-in/email?token=',
      'qutai://sign-in/email?token=short',
      `qutai://sign-in/email?token=${TOKEN}&token=${TOKEN}`,
      `qutai://sign-in/email?token=${TOKEN}%20x`,
      `qutai://sign-in/google?token=${TOKEN}`,
      `https://example.com/sign-in/email?token=${TOKEN}`,
      `qutai://open?url=${encodeURIComponent(`qutai://sign-in/email?token=${TOKEN}`)}`,
      null,
    ]) {
      assert.equal(parseEmailSignInLink(url), null, String(url));
    }
  });

  it('knows which links are sign-in links (never opened as a page)', () => {
    assert.equal(isSignInLink(`qutai://sign-in/email?token=${TOKEN}`), true);
    assert.equal(isSignInLink('qutai://sign-in/email'), true);
    assert.equal(isSignInLink('qutai://sign-in'), true);
    assert.equal(isSignInLink('qutai://sign-inx'), false);
    assert.equal(isSignInLink('qutai://open?url=https%3A%2F%2Fexample.com'), false);
    assert.equal(isSignInLink('https://example.com/qutai://sign-in'), false);
  });
});

describe('email sign-in: input helpers', () => {
  it('checks addresses lightly before asking the server', () => {
    for (const ok of ['a@example.com', ' name.tag+x@sub.example.org ', 'ö@example.com']) assert.equal(looksLikeEmail(ok), true, ok);
    for (const bad of ['', 'a@b', 'a@@example.com', '@example.com', 'a@example', 'a b@example.com', 'a@1.2.3.4', 'a@example.']) {
      assert.equal(looksLikeEmail(bad), false, bad);
    }
  });

  it('takes the digits of a typed or pasted code', () => {
    assert.equal(codeDigits('123 456'), '123456');
    assert.equal(codeDigits('Code: 123-456.'), '123456');
    assert.equal(codeDigits('12345678'), '123456');
    assert.equal(codeDigits('12a'), '12');
  });

  it('formats waits and the countdown', () => {
    assert.deepEqual(waitSpan(45), { unit: 'second', count: 45 });
    assert.deepEqual(waitSpan(61), { unit: 'minute', count: 2 });
    assert.deepEqual(waitSpan(3600), { unit: 'hour', count: 1 });
    assert.deepEqual(waitSpan(0), { unit: 'second', count: 1 });
    assert.equal(countdownText(29.2), '0:30');
    assert.equal(countdownText(75), '1:15');
    assert.equal(countdownText(-3), '0:00');
  });

  it('reads Retry-After as seconds, bounded', () => {
    assert.equal(parseRetryAfter('30'), 30);
    assert.equal(parseRetryAfter(' 3600 '), 3600);
    assert.equal(parseRetryAfter('999999999'), 86_400);
    assert.equal(parseRetryAfter('0'), null);
    assert.equal(parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT'), null);
    assert.equal(parseRetryAfter(null), null);
  });
});

describe('email sign-in: what the user is told', () => {
  const api = (status: number, code: string, reason: string | null, retryAfter: number | null = null) =>
    new AccountApiError(code as never, status, 'req-1', reason, retryAfter);

  it('maps every reason of the email routes to its sentence', () => {
    const cases: [AccountApiError, string, number?][] = [
      [api(400, 'bad_request', 'invalid_email'), 'account.email.error.invalidEmail'],
      [api(401, 'unauthorized', 'invalid_code'), 'account.email.error.invalidCode'],
      [api(401, 'unauthorized', 'expired'), 'account.email.error.expired'],
      [api(401, 'unauthorized', 'too_many_attempts'), 'account.email.error.tooManyAttempts'],
      [api(403, 'forbidden', 'wrong_device'), 'account.email.error.wrongDevice'],
      [api(403, 'account_suspended', 'suspended'), 'account.email.error.suspended'],
      [api(403, 'forbidden', 'deleted'), 'account.email.error.deleted'],
      [api(409, 'conflict', 'account_conflict'), 'account.email.error.conflict'],
      [api(429, 'rate_limited', 'too_soon', 25), 'account.email.error.tooSoon', 25],
      [api(429, 'rate_limited', 'address_limit', 3600), 'account.email.error.addressLimit', 3600],
      [api(429, 'rate_limited', 'device_limit', 3600), 'account.email.error.deviceLimit', 3600],
      [api(429, 'rate_limited', 'ip_limit', 60), 'account.email.error.ipLimit', 60],
      [api(429, 'rate_limited', null, 60), 'account.email.error.rateLimited', 60],
      [api(503, 'unavailable', 'sender_not_configured'), 'account.email.error.notConfigured'],
      [api(503, 'unavailable', 'sender_failed'), 'account.email.error.senderFailed'],
    ];
    for (const [error, key, wait] of cases) {
      assert.deepEqual(emailErrorMessage(error), wait ? { key, waitSeconds: wait } : { key }, `${error.reason}`);
    }
    assert.deepEqual(emailErrorMessage(new NoPendingEmailSignIn()), { key: 'account.email.error.wrongDevice' });
    assert.deepEqual(emailErrorMessage(new MalformedSignInLink()), { key: 'account.email.error.badLink' });
  });

  it('leaves the general errors to the general sentences', () => {
    assert.equal(emailErrorMessage(api(0, 'network', null)), null);
    assert.equal(emailErrorMessage(api(503, 'unavailable', null)), null);
    assert.equal(emailErrorMessage(api(401, 'unauthorized', 'wrong_audience')), null);
    assert.equal(emailErrorMessage(new Error('x')), null);
  });

  it('puts the wait and the reason in the Details line, never a token', async () => {
    const { fetchImpl } = fakeServer({ 'POST /auth/email/start': () => refuse(429, 'rate_limited', 'too_soon', { 'Retry-After': '25' }) });
    const error = await createApi('https://api.test', fetchImpl)
      .request({ method: 'POST', path: '/auth/email/start', body: {} })
      .catch((e: unknown) => e);
    assert.ok(error instanceof AccountApiError);
    assert.equal(error.retryAfter, 25);
    assert.equal(accountErrorDetails(error), 'Qutai server: HTTP 429 rate_limited (too_soon); Retry-After 25 s; request req-9');
    assert.equal(accountErrorDetails(new NoPendingEmailSignIn()), 'Qutai app: no email sign-in is waiting on this phone (no_pending)');
    assert.equal(scrubDetail(`failed for ${TOKEN}`), 'failed for [token]');
  });

  it('a 409 without a readable body is a conflict', async () => {
    const api409 = createApi('https://api.test', async () => new Response('nope', { status: 409 }));
    await assert.rejects(api409.request({ method: 'POST', path: '/auth/email/verify' }), { code: 'conflict' });
  });
});
