/**
 * Sign-in methods while signed in, merging and Sign in with Apple on Android, the app's side (src/account/session.ts,
 * methodRules.ts, appleWeb.ts, emailSignIn.ts link hosts) against a fake server. Run: npm run test:account.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApi, type Fetch } from '../../src/account/api.ts';
import { isAuthReturnLink, parseAppleReturn } from '../../src/account/appleWeb.ts';
import { isSignInLink, linkHosts, linkPath, parseEmailSignInLink } from '../../src/account/emailSignIn.ts';
import { canRemove, mergeRetryDelayMs, methodsThatCanConfirm, setPendingEmailProof, takeEmailProofLink } from '../../src/account/methodRules.ts';
import { AccountSession, type SessionStorage, type StoredSession } from '../../src/account/session.ts';
import type { Me, SignInMethod } from '../../src/account/types.ts';

const ME: Me = {
  id: 'u1',
  providers: ['apple'],
  methods: [{ id: 'a'.repeat(32), provider: 'apple', linkedAt: 1 }],
  status: 'active',
};

function setup(routes: Record<string, (body: any) => { status: number; body?: unknown }>) {
  let stored: StoredSession | null = {
    accessToken: 'a0',
    accessExpiresAt: Date.now() + 600_000,
    refreshToken: 'r0',
    refreshExpiresAt: Date.now() + 86_400_000,
    user: ME,
  };
  const storage: SessionStorage = {
    load: async () => stored,
    save: async (s) => {
      stored = s;
    },
    clear: async () => {
      stored = null;
    },
    deviceId: async () => 'device_12345678',
  };
  const calls: { key: string; body: any; auth?: string }[] = [];
  const fetchImpl: Fetch = async (url, init) => {
    const key = `${init?.method} ${new URL(url).pathname}`;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ key, body, auth: (init?.headers as Record<string, string>)?.Authorization });
    const route = routes[key];
    if (!route) return new Response(JSON.stringify({ error: { code: 'not_found', message: '', requestId: 'r' } }), { status: 404 });
    const answer = route(body);
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  };
  const session = new AccountSession(createApi('https://api.test', fetchImpl), storage, Date.now, () => 'de-DE');
  return { session, calls, stored: () => stored };
}

const withGoogle: Me = {
  ...ME,
  providers: ['apple', 'google'],
  methods: [...ME.methods!, { id: 'b'.repeat(32), provider: 'google', linkedAt: 2 }],
};

describe('proofs while signed in', () => {
  it('sends the token, the purpose and the language with the access token, and keeps the account it returns', async () => {
    const { session, calls, stored } = setup({ 'POST /account/methods/google': () => ({ status: 200, body: { outcome: 'added', user: withGoogle } }) });
    await session.load();
    const result = await session.proveGoogle({ idToken: 'id', nonce: 'n'.repeat(20) }, 'add');
    assert.equal(result.outcome, 'added');
    assert.deepEqual(calls[0]!.body, { idToken: 'id', nonce: 'n'.repeat(20), purpose: 'add', locale: 'de-DE' });
    assert.equal(calls[0]!.auth, 'Bearer a0');
    assert.deepEqual(stored()?.user.providers, ['apple', 'google']);
  });

  it('confirms an email address with a code, or with the link', async () => {
    const { session, calls } = setup({
      'POST /account/methods/email/start': () => ({ status: 202, body: { expiresIn: 600, resendAfter: 30, codeLength: 6 } }),
      'POST /account/methods/email/verify': () => ({ status: 200, body: { outcome: 'reauthenticated', user: ME, reauthUntil: 1 } }),
    });
    await session.load();
    await session.startEmailProof('a@example.test', 'reauth');
    await session.verifyEmailProof('a@example.test', { code: '123456' }, 'reauth');
    await session.verifyEmailProof('a@example.test', { linkToken: 'qel_x' }, 'reauth');
    assert.deepEqual(calls.map((c) => c.body), [
      { email: 'a@example.test', purpose: 'reauth', locale: 'de-DE' },
      { email: 'a@example.test', code: '123456', purpose: 'reauth', locale: 'de-DE' },
      { email: 'a@example.test', linkToken: 'qel_x', purpose: 'reauth', locale: 'de-DE' },
    ]);
  });

  it('removes a method and keeps the account the server answers with', async () => {
    const { session, calls, stored } = setup({ 'POST /account/methods/remove': () => ({ status: 200, body: { user: ME } }) });
    await session.load();
    await session.removeMethod('b'.repeat(32), 'apple-code');
    assert.deepEqual(calls[0]!.body, { methodId: 'b'.repeat(32), appleAuthorizationCode: 'apple-code', locale: 'de-DE' });
    assert.deepEqual(stored()?.user, ME);
  });

  it('passes the server’s reauth_required through for the screen to ask', async () => {
    const { session } = setup({
      'POST /account/methods/remove': () => ({ status: 403, body: { error: { code: 'forbidden', message: '', requestId: 'r', reason: 'reauth_required' } } }),
    });
    await session.load();
    await assert.rejects(session.removeMethod('b'.repeat(32)), (e: any) => e.code === 'forbidden' && e.reason === 'reauth_required');
  });

  it('previews and confirms a merge', async () => {
    const side = { methods: [{ provider: 'google' }], balance: 5, purchases: 0, taskRunning: false };
    const { session, calls, stored } = setup({
      'POST /account/merge/preview': () => ({ status: 200, body: { into: side, from: side, expiresIn: 500 } }),
      'POST /account/merge': () => ({ status: 200, body: { mergeId: 'm1', status: 'done', user: withGoogle } }),
    });
    await session.load();
    assert.equal((await session.previewMerge('qmp_x')).expiresIn, 500);
    assert.equal((await session.confirmMerge('qmp_x')).status, 'done');
    assert.deepEqual(calls[1]!.body, { proofId: 'qmp_x', locale: 'de-DE' });
    assert.deepEqual(stored()?.user.providers, ['apple', 'google']);
  });
});

describe('Sign in with Apple on Android', () => {
  it('starts with the verifier’s hash and finishes with the return link’s values and the device', async () => {
    const { session, calls } = setup({
      'POST /auth/apple/web/start': () => ({ status: 200, body: { url: 'https://appleid.apple.com/auth/authorize?x=1', flow: 'f', expiresIn: 600 } }),
      'POST /auth/apple/web/finish': () => ({
        status: 200,
        body: { accessToken: 'a1', accessTokenExpiresIn: 900, refreshToken: 'r1', refreshTokenExpiresAt: Date.now() + 1e6, user: ME, created: true },
      }),
    });
    await session.startAppleWeb('h'.repeat(64));
    await session.signInWithAppleWeb({ flow: 'f', handoff: 'h', verifier: 'v' });
    assert.deepEqual(calls[0]!.body, { deviceId: 'device_12345678', verifierHash: 'h'.repeat(64) });
    assert.deepEqual(calls[1]!.body, { flow: 'f', handoff: 'h', verifier: 'v', deviceId: 'device_12345678', locale: 'de-DE' });
    assert.equal(session.getState().status, 'signedIn');
  });

  it('reads the return link and never treats it as a page', () => {
    const flow = '0b6c1f9e-1d2c-4f4e-9a55-0123456789ab';
    const handoff = 'H'.repeat(43);
    assert.deepEqual(parseAppleReturn(`qutai://auth/apple/done?flow=${flow}&handoff=${handoff}`), { ok: true, flow, handoff });
    assert.deepEqual(parseAppleReturn('qutai://auth/apple/done?error=cancelled'), { ok: false, error: 'cancelled' });
    assert.deepEqual(parseAppleReturn(`qutai://auth/apple/done?flow=${flow}&error=failed`), { ok: false, error: 'failed' });
    assert.deepEqual(parseAppleReturn(`qutai://auth/apple/done?flow=${flow}&flow=${flow}&handoff=${handoff}`), { ok: false, error: 'invalid' });
    assert.deepEqual(parseAppleReturn('https://evil.test/?flow=x'), { ok: false, error: 'invalid' });
    assert.equal(isAuthReturnLink('qutai://auth/apple/done?flow=x'), true);
    assert.equal(isSignInLink('QUTAI://auth/apple/done'), true);
    assert.equal(isAuthReturnLink('qutai://open?url=https://a.test'), false);
  });
});

describe('removal rules', () => {
  const methods: SignInMethod[] = [
    { id: '1', provider: 'apple', linkedAt: 10 },
    { id: '2', provider: 'email', email: 'a@example.test', linkedAt: 20 },
    { id: '3', provider: 'google', linkedAt: 30 },
  ];

  it('never offers to remove the last method or one without an id', () => {
    assert.equal(canRemove(methods.slice(0, 1), methods[0]!), false);
    assert.equal(canRemove(methods, methods[1]!), true);
    assert.equal(canRemove(methods, { provider: 'apple', linkedAt: 1 }), false);
  });

  it('confirms a removal only with the method itself or an older one', () => {
    assert.deepEqual(methodsThatCanConfirm(methods, methods[1]!).map((m) => m.id), ['1', '2']);
    assert.deepEqual(methodsThatCanConfirm(methods, methods[0]!).map((m) => m.id), ['1']);
  });

  it('hands a mail link to a waiting email proof, and only then', () => {
    assert.equal(takeEmailProofLink('qel_x'), false);
    const taken: string[] = [];
    setPendingEmailProof({ email: 'a@example.test', take: (token) => taken.push(token) });
    assert.equal(takeEmailProofLink('qel_y'), true);
    setPendingEmailProof(null);
    assert.equal(takeEmailProofLink('qel_z'), false);
    assert.deepEqual(taken, ['qel_y']);
  });

  it('waits a sensible time between merge retries', () => {
    assert.equal(mergeRetryDelayMs(null), 5000);
    assert.equal(mergeRetryDelayMs(1), 2000);
    assert.equal(mergeRetryDelayMs(3600), 60_000);
  });
});

describe('https sign-in links', () => {
  it('adds the build’s App Link host to the website’s, and nothing that isn’t a host', () => {
    assert.deepEqual(linkHosts(undefined), ['qutai.sonsuzdongu.com']);
    assert.deepEqual(linkHosts(' Links.Example.Test '), ['qutai.sonsuzdongu.com', 'links.example.test']);
    assert.deepEqual(linkHosts('https://x.test/path'), ['qutai.sonsuzdongu.com']);
    assert.equal(linkPath(undefined), '/intent/sign-in/email');
    assert.equal(linkPath('/s/email/'), '/s/email');
    assert.equal(linkPath('/a?b'), '/intent/sign-in/email');
  });

  it('takes the token from the website’s page link', () => {
    assert.equal(parseEmailSignInLink('https://qutai.sonsuzdongu.com/intent/sign-in/email?token=qel_ABCDEFGHIJKLMNOP'), 'qel_ABCDEFGHIJKLMNOP');
  });
});

describe('the website’s App Links / Universal Links files (webpage/worker/wellKnown.ts)', async () => {
  const { appleAppSiteAssociation, assetLinks, wellKnown } = await import('../../webpage/worker/wellKnown.ts');
  const FP = Array.from({ length: 32 }, () => 'AB').join(':');

  it('are 404 until configured, so a build without them is unchanged', async () => {
    assert.equal(appleAppSiteAssociation({}), null);
    assert.equal(assetLinks({ ANDROID_PACKAGE: 'com.example.app' }), null);
    assert.equal(wellKnown('/.well-known/assetlinks.json', {})?.status, 404);
    assert.equal(wellKnown('/other', {}), null);
  });

  it('serve the exact documents from configuration', async () => {
    assert.deepEqual(appleAppSiteAssociation({ APPLE_APP_IDS: 'ABCDE12345.com.example.app' }), {
      applinks: { details: [{ appIDs: ['ABCDE12345.com.example.app'], components: [{ '/': '/intent/sign-in/email', comment: 'Qutai sign-in link' }] }] },
    });
    assert.deepEqual(assetLinks({ ANDROID_PACKAGE: 'com.example.app', ANDROID_CERT_SHA256: ` ${FP.toLowerCase()} , not-a-fingerprint` }), [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: 'com.example.app', sha256_cert_fingerprints: [FP] },
      },
    ]);
    const res = wellKnown('/.well-known/apple-app-site-association', { APPLE_APP_IDS: 'ABCDE12345.com.example.app', APP_LINK_PATH: '/s/email' })!;
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.match(await res.text(), /"\/s\/email"/);
  });
});
