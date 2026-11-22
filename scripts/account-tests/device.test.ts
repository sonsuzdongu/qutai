/**
 * Device verification, the app's side (src/account/deviceProof.ts, api.ts): which headers go with which request, the
 * App Attest key's one-time attestation, the Android pass, and that nothing ever blocks a request. Run: npm run test:account.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { createApi, type Fetch } from '../../src/account/api.ts';
import { createDeviceProof, type DeviceCheckConfig, type IntegrityModule } from '../../src/account/deviceProof.ts';

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
    assert.equal((await make('android', broken.m).proof.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'failed');
    const noAttest = fakeModule({ attestKeyAsync: async () => Promise.reject(new Error('x')) });
    const ios = make('ios', noAttest.m);
    assert.equal((await ios.proof.headers('POST', '/relay', true))['X-Qutai-Device-Error'], 'failed');
    // The next try waits an hour (no attestation storm).
    await ios.proof.headers('POST', '/relay', true);
    assert.equal(noAttest.calls.filter((c) => c === 'generate').length, 1);
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
