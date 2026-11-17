/**
 * Qutai Credits (src/credits/) against Qutai's API Worker running locally. Run: npm run test:credits:server.
 * Skipped unless QUTAI_TEST_DEV_LOGIN_SECRET is set (the server's DEV_SIGN_IN_SECRET; the server needs DEV_SIGN_IN=true,
 * migrations, `seed:local` for its example settings and prices, and the app's agent profile registered: see
 * README.md in the folder above).
 *
 * Every request goes through the app's real code: the account session signs in with the test sign-in, the credits
 * client and the "Qutai Credits" provider with the real Anthropic / OpenAI / Gemini adapters talk to the server's real
 * routes, and the server checks, reserves, settles and answers as it would for the phone.
 *
 * Without provider keys on the server the relay answers `unavailable` once a request passes its checks (the key is
 * looked up before anything is reserved); those tests say so. QUTAI_TEST_FAKE_PROVIDERS=1 is for a server whose
 * outgoing requests to the providers are answered by a fake provider (a local harness; the server itself can't be
 * pointed elsewhere): then the streamed answers, charges, balance, refusals after the key check and
 * not-enough-credits are tested too. Those need test-1 to have a few credits (granted in the admin panel beforehand,
 * or by QUTAI_TEST_GRANT_URL: a local endpoint taking `POST { user, credits }`) and test-2 none.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createApi } from '../../../src/account/api.ts';
import { AccountSession, type SessionStorage, type StoredSession } from '../../../src/account/session.ts';
import type { DevSignInUser } from '../../../src/account/types.ts';
import type { ModelRequest } from '../../../src/ai/types.ts';
import { AGENT_PROFILE_ID } from '../../../src/credits/agentProfileId.ts';
import { createCreditsClient, type CreditsClient } from '../../../src/credits/client.ts';
import { nothingSent, RelayError } from '../../../src/credits/errors.ts';
import { createCreditsProvider } from '../../../src/credits/provider.ts';
import { createFakeStore } from '../../../src/purchases/fake.ts';
import { createPurchaseFlow, type PendingPurchase } from '../../../src/purchases/flow.ts';
import type { PublicConfig, RelayRequest } from '../../../src/credits/types.ts';

const API_URL = process.env.QUTAI_TEST_API_URL ?? 'http://localhost:8790';
const SECRET = process.env.QUTAI_TEST_DEV_LOGIN_SECRET;
const FAKE = process.env.QUTAI_TEST_FAKE_PROVIDERS === '1';
const GRANT_URL = process.env.QUTAI_TEST_GRANT_URL;
const APP_VERSION = '1.0.0';

function memoryStorage(): SessionStorage {
  let stored: StoredSession | null = null;
  return {
    load: async () => stored,
    save: async (s) => void (stored = s),
    clear: async () => void (stored = null),
    deviceId: async () => `credits_test_${Math.random().toString(36).slice(2, 10)}`,
  };
}

async function signIn(user: DevSignInUser) {
  const session = new AccountSession(createApi(API_URL), memoryStorage());
  const response = await session.signInAsTestUser(user, SECRET!);
  const balances: number[] = [];
  const client = createCreditsClient({
    baseUrl: API_URL,
    appVersion: APP_VERSION,
    tokens: {
      get: () => session.currentAccessToken(),
      renew: (stale) => session.renewAccessToken(stale),
      suspended: () => session.noteSuspended(),
      ended: () => session.noteSessionEnded(),
    },
    onBalance: (b) => balances.push(b),
  });
  return { session, client, userId: response.user.id, balances };
}

async function grant(user: string, credits: number) {
  const res = await fetch(GRANT_URL!, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, credits }) });
  assert.equal(res.status, 200, await res.text());
}

function request(model: string, extra: Partial<ModelRequest> = {}): ModelRequest {
  return {
    apiKey: 'sk-own-key-that-must-not-leave',
    model,
    system: 'ignored on this wire',
    tools: [],
    webSearch: false,
    turns: [{ role: 'user', text: 'Say hello. [Current tab 1: new tab page, no web page loaded.]' }],
    signal: new AbortController().signal,
    onText: () => {},
    audit: { conversation: 'test', incognito: false, host: null },
    agent: { step: 0, memoryTools: true, customInstructions: 'Answer briefly.' },
    ...extra,
  };
}

const raw = (model: string, extra: Partial<RelayRequest> = {}): RelayRequest => ({
  provider: 'anthropic',
  model,
  profile: AGENT_PROFILE_ID,
  step: 0,
  stream: true,
  options: {},
  context: {},
  input: [{ role: 'user', content: 'hi' }],
  ...extra,
});

const kindOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    if (e instanceof RelayError) return e.kind;
    throw e;
  }
};

describe('Qutai Credits against the local server', { skip: !SECRET && 'QUTAI_TEST_DEV_LOGIN_SECRET not set' }, () => {
  let config: PublicConfig;
  let one: Awaited<ReturnType<typeof signIn>>;
  const provider = (client: CreditsClient) => createCreditsProvider({ client: () => client, config: async () => config, appVersion: APP_VERSION });

  before(async () => {
    one = await signIn('test-1');
    config = await one.client.config();
  });

  it('GET /config lists models with credit prices and the public limits', () => {
    assert.ok(config.models.length > 0, 'seed:local sets allowed_models and pricing');
    for (const m of config.models) assert.ok(m.prices.some((p) => p.aboveInputTokens === 0 && p.inputPerMTok > 0));
    for (const k of ['maxSteps', 'maxResearchSteps', 'maxImages', 'maxMemoryChars', 'maxCustomInstructionsChars', 'maxRequestBytes']) {
      assert.ok(config.limits[k]! > 0, k);
    }
  });

  it('GET /credits answers with the signed-in user’s balance and ledger', async () => {
    const credits = await one.client.credits(100);
    assert.equal(typeof credits.balance, 'number');
    assert.ok(Array.isArray(credits.entries));
  });

  it('refusals before the provider: an unknown model, an app below the minimum version, a malformed request', async () => {
    assert.equal(await kindOf(one.client.relayStream(raw('no-such-model'), new AbortController().signal, () => {})), 'model_not_allowed');
    const old = createCreditsClient({ baseUrl: API_URL, appVersion: '0.0.1', tokens: { get: () => one.session.currentAccessToken(), renew: (s) => one.session.renewAccessToken(s), suspended() {}, ended() {} } });
    assert.equal(await kindOf(old.relayStream(raw(config.models[0]!.model, { provider: config.models[0]!.provider as 'anthropic' }), new AbortController().signal, () => {})), 'upgrade_required');
    const bad = raw(config.models[0]!.model, { provider: config.models[0]!.provider as 'anthropic' });
    (bad as unknown as Record<string, unknown>).apiKey = 'sk-not-allowed';
    assert.equal(await kindOf(one.client.relayStream(bad, new AbortController().signal, () => {})), 'bad_request');
  });

  // FAKE purchases (the temporary stand-in; backend README › Fake purchases): only against a server started with
  // FAKE_PURCHASES=true. Uses test-3 (each run makes one new test purchase; the server allows 10 a day per account).
  it('fake mode: buying a pack through the app's flow credits it once and the balance rises', async (t) => {
    if (config.purchases?.mode !== 'fake') return t.skip('the server is not in fake purchase mode (FAKE_PURCHASES=true)');
    const pack = config.packs.find((p) => p.store === 'google') ?? config.packs[0];
    if (!pack) return t.skip('no active pack (seed:local adds some)');
    const three = await signIn('test-3');
    const before = (await three.client.credits(1)).balance;
    let list: PendingPurchase[] = [];
    const asked: string[] = [];
    const flow = createPurchaseFlow({
      store: createFakeStore(() => crypto.randomUUID()),
      storeName: pack.store,
      verify: (req) => {
        asked.push(req.transactionId);
        return three.client.verifyPurchase(req);
      },
      pending: { load: async () => list, save: async (l) => void (list = l) },
    });
    const result = await flow.buy(pack, three.userId);
    if (result.kind === 'limit') return t.skip('test-3 used its 10 test purchases for today');
    assert.equal(result.kind, 'credited', JSON.stringify(result));
    assert.equal(result.kind === 'credited' && result.credits, pack.credits);
    assert.equal(result.kind === 'credited' && result.balance, before + pack.credits);
    assert.deepEqual(list, [], 'nothing left waiting');
    assert.equal(three.balances.at(-1), before + pack.credits, 'the balance reached the app');
    assert.equal((await three.client.credits(1)).balance, before + pack.credits);

    // The same transaction reported again (a lost answer, then the queue): the first result, nothing added.
    const again = await three.client.verifyPurchase({ store: 'fake', transactionId: asked[0]!, productId: pack.productId, packStore: pack.store });
    assert.ok(again.ok && again.response.replayed && again.response.store === 'fake');
    assert.equal((await three.client.credits(1)).balance, before + pack.credits);
  });

  it('signed out: the server refuses the relay and the client says so', async () => {
    const out = createCreditsClient({ baseUrl: API_URL, appVersion: APP_VERSION, tokens: { get: async () => 'not-a-token', renew: () => Promise.reject(new Error('signed out')), suspended() {}, ended() {} } });
    assert.equal(await kindOf(out.relayStream(raw(config.models[0]!.model), new AbortController().signal, () => {})), 'not_signed_in');
  });

  it('without provider keys on the server: "temporarily unavailable", nothing charged', { skip: FAKE && 'the fake providers answer' }, async () => {
    const m = config.models[0]!;
    const before = (await one.client.credits()).balance;
    const kind = await kindOf(provider(one.client).call(request(m.model)));
    assert.equal(kind, 'unavailable');
    assert.equal((await one.client.credits()).balance, before);
  });

  describe('with fake providers behind the server', { skip: !FAKE && 'needs QUTAI_TEST_FAKE_PROVIDERS=1' }, () => {
    before(async () => {
      if (GRANT_URL) await grant(one.userId, 5);
      // Otherwise test-1 must have credits already (granted in the admin panel: README.md › Qutai Credits).
      assert.ok((await one.client.credits()).balance > 1_000_000, 'test-1 needs a few credits');
    });

    for (const kind of ['anthropic', 'openai', 'gemini'] as const) {
      it(`${kind}: a streamed answer through the relay, charged, the balance updated`, async () => {
        const m = config.models.find((x) => x.provider === kind);
        assert.ok(m, `a ${kind} model in allowed_models`);
        const before = (await one.client.credits()).balance;
        const text: string[] = [];
        const reply = await provider(one.client).call(request(m.model, { onText: (d) => text.push(d) }));
        assert.match(reply.text, /Hello from the fake/);
        assert.ok(text.join('').length > 0, 'streamed');
        assert.ok(reply.cost?.credits! > 0, 'charged');
        assert.equal(reply.cost?.source, 'server');
        const after = await one.client.credits(10);
        assert.equal(after.balance, before - reply.cost!.credits!);
        assert.equal(one.balances.at(-1), after.balance, 'the settlement carried the new balance');
        assert.deepEqual(after.entries.slice(0, 2).map((e) => e.kind).sort(), ['reserve', 'settle']);
      });
    }

    it('a profile the server doesn’t know: "update Qutai"', async () => {
      const m = config.models.find((x) => x.provider === 'anthropic')!;
      assert.equal(await kindOf(one.client.relayStream(raw(m.model, { profile: 'f'.repeat(64) }), new AbortController().signal, () => {})), 'profile_unknown');
    });

    it('the step limit', async () => {
      const m = config.models.find((x) => x.provider === 'anthropic')!;
      assert.equal(await kindOf(one.client.relayStream(raw(m.model, { step: config.limits.maxSteps! }), new AbortController().signal, () => {})), 'step_limit');
    });

    it('a memory section over the limit is refused as too large', async () => {
      const m = config.models.find((x) => x.provider === 'anthropic')!;
      const memory = 'x'.repeat(config.limits.maxMemoryChars! + 1);
      assert.equal(await kindOf(one.client.relayStream(raw(m.model, { context: { memory } }), new AbortController().signal, () => {})), 'payload_too_large');
    });

    it('not enough credits: refused before anything reaches the AI, nothing charged', async () => {
      const two = await signIn('test-2');
      const m = config.models.find((x) => x.provider === 'anthropic')!;
      let error: unknown;
      try {
        // test-2 is never granted anything here; if an earlier run left it credits, spend them first.
        for (let i = 0; i < 50; i++) await provider(two.client).call(request(m.model));
      } catch (e) {
        error = e;
      }
      assert.ok(error instanceof RelayError && error.kind === 'insufficient_credits', String(error));
      assert.ok(nothingSent(error));
      assert.match((error as Error).message, /isn’t available in the app yet/);
    });
  });
});
