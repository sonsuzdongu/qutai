import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Device verification (pro builds only; backend/README.md › Device verification, docs/design/33-accounts.md): a proof
 * that a sign-in or relay request comes from Qutai as Apple or Google installed it on a real device, in request headers.
 *
 * - iOS, Apple App Attest: a key made once per install in the Secure Enclave and attested to the server once
 *   (`POST /device/challenge`, `POST /device/attest`); each request carries an assertion signed by that key.
 * - Android, Google Play Integrity (standard request): a token from Google bound to the request; after a pass the server
 *   accepts the same signed-in session for an hour without one (`X-Qutai-Device-Pass-Until`).
 *
 * Only while the server's `GET /config` asks for it (`deviceCheck`). Nothing here ever blocks a request: when no proof
 * can be made, the request goes with `X-Qutai-Device-Error` and the server decides (it refuses only in "enforce" mode).
 * Pure code with the platform and native module injected, so the tests run it in Node.
 */

export interface IntegrityModule {
  isSupported: boolean;
  generateKeyAsync(): Promise<string>;
  attestKeyAsync(keyId: string, challenge: string): Promise<string>;
  generateAssertionAsync(keyId: string, challenge: string): Promise<string>;
  prepareIntegrityTokenProviderAsync(cloudProjectNumber: string): Promise<void>;
  requestIntegrityCheckAsync(requestHash: string): Promise<string>;
}

export interface DeviceCheckConfig {
  mode: 'log' | 'enforce';
  playCloudProjectNumber: string | null;
  appAttest: boolean;
}

export interface KeyStore {
  get(): Promise<string | null>;
  set(keyId: string | null): Promise<void>;
}

export interface DeviceProofDeps {
  platform: 'ios' | 'android' | 'other';
  /** Null when the build has no native module (never in a pro build). */
  module: () => IntegrityModule | null;
  /** `GET /config` › `deviceCheck`; null when the server doesn't ask for proofs. Cached by the caller. */
  config: () => Promise<DeviceCheckConfig | null>;
  /** POST to the server without an account (`/device/challenge`, `/device/attest`). */
  post: (path: string, body: unknown) => Promise<unknown>;
  keys: KeyStore;
  now?: () => number;
  random?: () => string;
}

/** Proof headers are made within this time or the request goes without (an error header instead). */
export const PROOF_TIMEOUT_MS = 8000;
/** After a failed attestation, the next try waits this long. */
export const ATTEST_RETRY_MS = 60 * 60_000;

export type ProofHeaders = Record<string, string>;

export interface DeviceProof {
  /** Headers for one request (fresh each time: an iOS assertion works once). `signedIn`: the request has a session. */
  headers(method: string, path: string, signedIn: boolean): Promise<ProofHeaders>;
  /** Reads the server's answer: an Android pass, or a refusal that means the key or pass is no longer known. */
  observe(status: number, headers: { get(name: string): string | null }, reason: string | null): void;
  /** A new account or signed out: the Android pass belonged to the old session. */
  reset(): void;
}

function defaultRandom(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function createDeviceProof(deps: DeviceProofDeps): DeviceProof {
  const now = deps.now ?? Date.now;
  const random = deps.random ?? defaultRandom;
  let attesting: Promise<string | null> | null = null;
  let attestFailedAt = Number.NEGATIVE_INFINITY;
  let prepared: string | null = null;
  let passUntil = 0;

  async function attestedKey(m: IntegrityModule): Promise<string | null> {
    const stored = await deps.keys.get();
    if (stored) return stored;
    if (attesting) return attesting;
    if (now() - attestFailedAt < ATTEST_RETRY_MS) return null;
    attesting = (async () => {
      try {
        const keyId = await m.generateKeyAsync();
        const { challenge } = (await deps.post('/device/challenge', {})) as { challenge: string };
        const attestation = await m.attestKeyAsync(keyId, challenge);
        await deps.post('/device/attest', { keyId, attestation, challenge });
        await deps.keys.set(keyId);
        return keyId;
      } catch {
        attestFailedAt = now();
        return null;
      } finally {
        attesting = null;
      }
    })();
    return attesting;
  }

  async function make(method: string, path: string, signedIn: boolean): Promise<ProofHeaders> {
    if (deps.platform === 'other') return {};
    const config = await deps.config();
    if (!config) return {};
    const platform = deps.platform;
    const m = deps.module();
    if (!m) return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': 'unsupported' };
    const time = now();
    const nonce = random();
    const clientData = `${method} ${path}\n${time}\n${nonce}`;
    const base = { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Time': String(time), 'X-Qutai-Device-Nonce': nonce };

    if (platform === 'ios') {
      if (!config.appAttest) return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': 'not_configured' };
      if (!m.isSupported) return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': 'unsupported' };
      const keyId = await attestedKey(m);
      if (!keyId) return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': 'failed' };
      try {
        return { ...base, 'X-Qutai-Device-Key': keyId, 'X-Qutai-Device-Assertion': await m.generateAssertionAsync(keyId, clientData) };
      } catch (e) {
        // A key the system no longer has (reinstall, restore): make a new one next time.
        if ((e as { code?: string })?.code === 'ERR_APP_INTEGRITY_INVALID_KEY') await deps.keys.set(null);
        return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': 'failed' };
      }
    }

    // Android
    if (signedIn && passUntil > time + 60_000) return { 'X-Qutai-Device-Platform': platform };
    const project = config.playCloudProjectNumber;
    if (!project) return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': 'not_configured' };
    try {
      if (prepared !== project) {
        await m.prepareIntegrityTokenProviderAsync(project);
        prepared = project;
      }
      const hash = bytesToHex(sha256(utf8ToBytes(clientData)));
      let token: string;
      try {
        token = await m.requestIntegrityCheckAsync(hash);
      } catch (e) {
        if ((e as { code?: string })?.code !== 'ERR_APP_INTEGRITY_PROVIDER_INVALID') throw e;
        await m.prepareIntegrityTokenProviderAsync(project);
        token = await m.requestIntegrityCheckAsync(hash);
      }
      return { ...base, 'X-Qutai-Device-Integrity': token };
    } catch {
      prepared = null;
      return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': 'failed' };
    }
  }

  return {
    async headers(method, path, signedIn) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          make(method, path, signedIn),
          new Promise<ProofHeaders>((resolve) => {
            timer = setTimeout(() => resolve(deps.platform === 'other' ? {} : { 'X-Qutai-Device-Platform': deps.platform, 'X-Qutai-Device-Error': 'timeout' }), PROOF_TIMEOUT_MS);
          }),
        ]);
      } catch {
        return deps.platform === 'other' ? {} : { 'X-Qutai-Device-Platform': deps.platform, 'X-Qutai-Device-Error': 'failed' };
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    observe(status, headers, reason) {
      const until = Number(headers.get('X-Qutai-Device-Pass-Until'));
      if (Number.isSafeInteger(until) && until > 0) passUntil = until;
      if (status === 403 && reason === 'device_check') {
        // Refused: the server may have forgotten the key (unused for 180 days) or the pass. Start over next time.
        passUntil = 0;
        if (deps.platform === 'ios') void deps.keys.set(null);
        attestFailedAt = Number.NEGATIVE_INFINITY;
      }
    },
    reset() {
      passUntil = 0;
    },
  };
}

/** Sign-in routes that carry a proof (the server's DEVICE_CHECKED_ROUTES, besides `/relay`). */
export const DEVICE_CHECKED_PATHS: ReadonlySet<string> = new Set(['/auth/apple', '/auth/google', '/auth/email/verify', '/auth/apple/web/finish']);
