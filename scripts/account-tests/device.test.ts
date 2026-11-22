/**
 * Device verification, the app's side (src/account/deviceProof.ts, api.ts): which headers go with which request, the
 * App Attest key's one-time attestation, the Android pass, and that nothing ever blocks a request. Run: npm run test:account.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { createApi, type Fetch } from '../../src/account/api.ts';
import { readFileSync } from 'node:fs';
import { createDeviceProof, deviceErrorToken, type DeviceCheckConfig, type IntegrityModule } from '../../src/account/deviceProof.ts';

function fakeModule(overrides: Partial<IntegrityModule> = {}) {
  const calls: string[] = [];
  const m: IntegrityModule = {
    isSupported: true,
    async generateKeyAsync() {
      calls.push('generate');
      return 'k'.repeat(44);
    },
    async attestKeyAsync(keyId, challenge) {
      calls.push(`attest ${challenge}`);
      return 'ATTEST';
    },
    async generateAssertionAsync(keyId, data) {
      calls.push(`assert ${data}`);
      return `ASSERT(${data})`;
    },
    async prepareIntegrityTokenProviderAsync(project) {
      calls.push(`prepare ${project}`);
    },
    async requestIntegrityCheckAsync(hash) {
      calls.push(`token ${hash}`);
      return `TOKEN-${hash.slice(0, 8)}`;
    },
    ...overrides,
  };
  return { m, calls };
}

const CONFIG: DeviceCheckConfig = { mode: 'log', playCloudProjectNumber: '123', appAttest: true };

function make(platform: 'ios' | 'android' | 'other', m: IntegrityModule | null, config: DeviceCheckConfig | null = CONFIG) {
  let stored: string | null = null;
  const posts: string[] = [];
  const proof = createDeviceProof({
    platform,
    module: () => m,
    config: async () => config,
    post: async (path) => {
      posts.push(path);
      return path === '/device/challenge' ? { challenge: 'CHAL' } : { ok: true };
    },
    keys: { get: async () => stored, set: async (k) => void (stored = k) },
    now: () => 1000,
    random: () => 'n'.repeat(32),
  });
  return { proof, posts, stored: () => stored };
}

describe('device proof', () => {
  it('iOS: attests a key once, then signs every request over method, path, time and nonce', async () => {
    const { m, calls } = fakeModule();
    const { proof, posts, stored } = make('ios', m);
    const h1 = await proof.headers('POST', '/auth/google', false);
    const h2 = await proof.headers('POST', '/relay', true);
    assert.deepEqual(posts, ['/device/challenge', '/device/attest']);
    assert.equal(stored(), 'k'.repeat(44));
    assert.equal(calls.filter((c) => c === 'generate').length, 1);
    assert.equal(h1['X-Qutai-Device-Platform'], 'ios');
    assert.equal(h1['X-Qutai-Device-Key'], 'k'.repeat(44));
    assert.equal(h1['X-Qutai-Device-Assertion'], `ASSERT(POST /auth/google\n1000\n${'n'.repeat(32)})`);
    assert.equal(h2['X-Qutai-Device-Assertion'], `ASSERT(POST /relay\n1000\n${'n'.repeat(32)})`);
  });

  it('Android: a token bound to the hash of the client data; after a pass, signed-in requests go without one', async () => {
    const { m, calls } = fakeModule();
    const { proof } = make('android', m);
    const h = await proof.headers('POST', '/relay', true);
    const hash = bytesToHex(sha256(utf8ToBytes(`POST /relay\n1000\n${'n'.repeat(32)}`)));
    assert.equal(h['X-Qutai-Device-Integrity'], `TOKEN-${hash.slice(0, 8)}`);
    assert.deepEqual(calls.slice(0, 2), ['prepare 123', `token ${hash}`]);
    proof.observe(200, new Headers({ 'X-Qutai-Device-Pass-Until': String(1000 + 3_600_000) }), null);
    assert.deepEqual(await proof.headers('POST', '/relay', true), { 'X-Qutai-Device-Platform': 'android' });
    // A sign-in has no session to hold the pass: always a token.
    assert.ok((await proof.headers('POST', '/auth/google', false))['X-Qutai-Device-Integrity']);
    // Refused by the server: the pass is forgotten.
    proof.observe(403, new Headers(), 'device_check');
    assert.ok((await proof.headers('POST', '/relay', true))['X-Qutai-Device-Integrity']);
  });

  it('sends nothing when the server does not ask, and an error header instead of failing', async () => {
    assert.deepEqual(await make('ios', fakeModule().m, null).proof.headers('POST', '/relay', true), {});
    assert.deepEqual(await make('other', fakeModule().m).proof.headers('POST', '/relay', true), {});
    assert.deepEqual(await make('android', null).proof.headers('POST', '/relay', true), { 'X-Qutai-Device-Platform': 'android', 'X-Qutai-Device-Error': 'unsupported' });
    assert.deepEqual(await make('android', fakeModule().m, { ...CONFIG, playCloudProjectNumber: null }).proof.headers('POST', '/relay', true), {
      'X-Qutai-Device-Platform': 'android',
      'X-Qutai-Device-Error': 'not_configured',
    });
    const broken = fakeModule({ requestIntegrityCheckAsync: async () => Promise.reject(new Error('no play')) });
    assert.equal((await make('android', broken.m).proof.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'req_failed');
    const noAttest = fakeModule({ attestKeyAsync: async () => Promise.reject(new Error('x')) });
    const ios = make('ios', noAttest.m);
    assert.equal((await ios.proof.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'attest_failed');
    // The next try waits an hour (no attestation storm), and the reason stays the same meanwhile.
    assert.equal((await ios.proof.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'attest_failed');
    assert.equal(noAttest.calls.filter((c) => c === 'generate').length, 1);
  });

  it('the error header names the stage and the native cause, never the message', async () => {
    const coded = (code: string) => Object.assign(new Error('secret text https://x'), { code });
    const prep = fakeModule({ prepareIntegrityTokenProviderAsync: async () => Promise.reject(coded('ERR_APP_INTEGRITY_API_NOT_AVAILABLE')) });
    assert.equal((await make('android', prep.m).proof.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'prep_api_not_available');
    const req = fakeModule({ requestIntegrityCheckAsync: async () => Promise.reject(coded('ERR_APP_INTEGRITY_PLAY_STORE_NOT_FOUND')) });
    assert.equal((await make('android', req.m).proof.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'req_play_store_missing');
    // A stale provider is prepared again; a failure there is reported as prep.
    let prepares = 0;
    const stale = fakeModule({
      prepareIntegrityTokenProviderAsync: async () => {
        if (prepares++ > 0) throw coded('ERR_APP_INTEGRITY_NETWORK_ERROR');
      },
      requestIntegrityCheckAsync: async () => Promise.reject(coded('ERR_APP_INTEGRITY_PROVIDER_INVALID')),
    });
    assert.equal((await make('android', stale.m).proof.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'prep_network_error');
    const keygen = fakeModule({ generateKeyAsync: async () => Promise.reject(coded('ERR_APP_INTEGRITY_FEATURE_UNSUPPORTED')) });
    assert.equal((await make('ios', keygen.m).proof.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'keygen_feature_unsupported');
    const assertFail = fakeModule({ generateAssertionAsync: async () => Promise.reject(coded('ERR_APP_INTEGRITY_SERVER_UNAVAILABLE')) });
    assert.equal((await make('ios', assertFail.m).proof.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'assert_apple_unavailable');
    // Our own server failing during attestation.
    const server = createDeviceProof({
      platform: 'ios',
      module: () => fakeModule().m,
      config: async () => CONFIG,
      post: async (path) => {
        if (path === '/device/attest') throw new Error('400');
        return { challenge: 'CHAL' };
      },
      keys: { get: async () => null, set: async () => {} },
      now: () => 1000,
      random: () => 'n'.repeat(32),
    });
    assert.equal((await server.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'register_failed');
    // Unknown or missing codes fall back to <stage>_failed.
    assert.equal(deviceErrorToken('req', coded('ERR_APP_INTEGRITY_SOMETHING_NEW')), 'req_failed');
    assert.equal(deviceErrorToken('req', coded('E_OTHER')), 'req_failed');
    assert.equal(deviceErrorToken('prep', null), 'prep_failed');
    assert.equal(deviceErrorToken('prep', 'string'), 'prep_failed');
  });

  it('works without a global crypto (React Native has none) and names failures before the platform steps', async (t) => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    t.after(() => {
      if (saved) Object.defineProperty(globalThis, 'crypto', saved);
    });
    // The app's wiring (deviceCheck.ts) passes its own secure random; with it, both platforms make proofs.
    for (const platform of ['android', 'ios'] as const) {
      const h = await make(platform, fakeModule().m).proof.headers('POST', '/relay', true);
      assert.equal(h['X-Qutai-Device-Error'], undefined, platform);
      assert.equal(h['X-Qutai-Device-Nonce'], 'n'.repeat(32));
    }
    // Without one and without a random source: a named word, not plain `failed`.
    const noRandom = createDeviceProof({
      platform: 'android',
      module: () => fakeModule().m,
      config: async () => CONFIG,
      post: async () => ({}),
      keys: { get: async () => null, set: async () => {} },
    });
    assert.equal((await noRandom.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'nonce_failed');
    const badConfig = createDeviceProof({
      platform: 'ios',
      module: () => fakeModule().m,
      config: async () => Promise.reject(new Error('offline')),
      post: async () => ({}),
      keys: { get: async () => null, set: async () => {} },
      random: () => 'n'.repeat(32),
    });
    assert.equal((await badConfig.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'config_failed');
    const badStore = createDeviceProof({
      platform: 'ios',
      module: () => fakeModule().m,
      config: async () => CONFIG,
      post: async () => ({}),
      keys: { get: async () => Promise.reject(new Error('keychain')), set: async () => {} },
      random: () => 'n'.repeat(32),
    });
    assert.equal((await badStore.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'setup_failed');
  });

  it('the app wires a secure random from expo-crypto, not the global crypto', () => {
    const wiring = readFileSync('src/account/deviceCheck.ts', 'utf8');
    assert.match(wiring, /random: \(\) => bytesToHex\(fillRandom\(/);
    assert.match(wiring, /from '\.\.\/utils\/secureRandom'/);
    assert.doesNotMatch(readFileSync('src/account/deviceProof.ts', 'utf8'), /\bcrypto\.getRandomValues/);
  });

  it('every native error code of @expo/app-integrity has a word that fits the server rule', () => {
    const base = 'node_modules/@expo/app-integrity';
    const sources = [`${base}/android/src/main/java/expo/modules/integrity/IntegrityErrorCodes.kt`, `${base}/ios/IntegrityErrorCodes.swift`];
    const codes = sources.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/"(ERR_APP_INTEGRITY_[A-Z_]+)"/g)].map((x) => x[1]));
    assert.ok(codes.length > 20);
    for (const code of codes) {
      if (code.includes('HARDWARE_ATTESTATION')) continue; // functions the app doesn't call
      for (const stage of ['prep', 'req', 'keygen', 'attest', 'assert'] as const) {
        const token = deviceErrorToken(stage, { code });
        assert.notEqual(token, `${stage}_failed`, code);
        assert.match(token, /^[a-z_]{1,30}$/, token);
      }
    }
  });

  it('the API client adds proofs only to the sign-in routes', async () => {
    const seen: Record<string, Record<string, string>> = {};
    const fetchImpl: Fetch = async (url, init) => {
      seen[new URL(url).pathname] = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const { m } = fakeModule();
    const { proof } = make('android', m);
    const api = createApi('https://api.test', fetchImpl, () => proof);
    await api.request({ method: 'POST', path: '/auth/google', body: {} });
    await api.request({ method: 'GET', path: '/me', accessToken: 't' });
    assert.ok(seen['/auth/google']!['X-Qutai-Device-Integrity']);
    assert.equal(seen['/me']!['X-Qutai-Device-Platform'], undefined);
  });
});
