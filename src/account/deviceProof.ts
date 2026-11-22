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

/**
 * The `@expo/app-integrity` error codes (the native module rejects with `ERR_APP_INTEGRITY_<X>`: Android maps Google's
 * StandardIntegrityErrorCode, iOS maps Apple's DCError) and the short word each becomes in `X-Qutai-Device-Error`.
 */
const NATIVE_CAUSES: Readonly<Record<string, string>> = {
  // Android, Play Integrity
  API_NOT_AVAILABLE: 'api_not_available',
  APP_NOT_INSTALLED: 'app_not_installed',
  APP_UID_MISMATCH: 'app_uid_mismatch',
  CANNOT_BIND_SERVICE: 'cannot_bind_service',
  CLIENT_TRANSIENT_ERROR: 'client_transient',
  INVALID_PROJECT_NUMBER: 'invalid_project',
  GOOGLE_SERVER_UNAVAILABLE: 'google_unavailable',
  PROVIDER_INVALID: 'provider_invalid',
  INTERNAL_ERROR: 'internal_error',
  NETWORK_ERROR: 'network_error',
  NO_ERROR: 'no_error',
  PLAY_SERVICES_NOT_FOUND: 'play_services_missing',
  PLAY_SERVICES_OUTDATED: 'play_services_outdated',
  PLAY_STORE_NOT_FOUND: 'play_store_missing',
  PLAY_STORE_OUTDATED: 'play_store_outdated',
  REQUEST_HASH_TOO_LONG: 'hash_too_long',
  TOO_MANY_REQUESTS: 'too_many_requests',
  CANCELLED: 'cancelled',
  PROVIDER_NOT_PREPARED: 'not_prepared',
  DECODE_FAILED: 'decode_failed',
  // iOS, App Attest (DCError)
  FEATURE_UNSUPPORTED: 'feature_unsupported',
  INVALID_INPUT: 'invalid_input',
  INVALID_KEY: 'invalid_key',
  SERVER_UNAVAILABLE: 'apple_unavailable',
  SYSTEM_FAILURE: 'system_failure',
  // Both
  UNKNOWN: 'unknown',
};

/** Where a proof failed: Android `prep` (prepareIntegrityTokenProvider) or `req` (the token); iOS `keygen`, `challenge`
 * and `register` (our server), `attest`, `assert`. */
export type ProofStage = 'prep' | 'req' | 'keygen' | 'challenge' | 'attest' | 'register' | 'assert';

/**
 * The `X-Qutai-Device-Error` value for an error: `<stage>_<cause>`, the cause read only from the error's `code` (never its
 * message), `<stage>_failed` for a code we don't know or an error without one. Always matches the server's
 * `^[a-z_]{1,30}$` (recorded as `app_<value>`); nothing from the error's text or the device goes in.
 */
export function deviceErrorToken(stage: ProofStage, error: unknown): string {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  const known = typeof code === 'string' && code.startsWith('ERR_APP_INTEGRITY_') ? NATIVE_CAUSES[code.slice('ERR_APP_INTEGRITY_'.length)] : undefined;
  return `${stage}_${known ?? 'failed'}`;
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
  /** Why the last attestation failed: sent on every iOS request until the next try. */
  let attestError = 'failed';
  let prepared: string | null = null;
  let passUntil = 0;

  async function attestedKey(m: IntegrityModule): Promise<string | null> {
    const stored = await deps.keys.get();
    if (stored) return stored;
    if (attesting) return attesting;
    if (now() - attestFailedAt < ATTEST_RETRY_MS) return null;
    attesting = (async () => {
      let stage: ProofStage = 'keygen';
      try {
        const keyId = await m.generateKeyAsync();
        stage = 'challenge';
        const { challenge } = (await deps.post('/device/challenge', {})) as { challenge: string };
        stage = 'attest';
        const attestation = await m.attestKeyAsync(keyId, challenge);
        stage = 'register';
        await deps.post('/device/attest', { keyId, attestation, challenge });
        await deps.keys.set(keyId);
        return keyId;
      } catch (e) {
        attestFailedAt = now();
        // Our own server's errors (challenge, register) carry no native code: `challenge_failed`, `register_failed`.
        attestError = deviceErrorToken(stage, e);
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
      if (!keyId) return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': attestError };
      try {
        return { ...base, 'X-Qutai-Device-Key': keyId, 'X-Qutai-Device-Assertion': await m.generateAssertionAsync(keyId, clientData) };
      } catch (e) {
        // A key the system no longer has (reinstall, restore): make a new one next time.
        if ((e as { code?: string })?.code === 'ERR_APP_INTEGRITY_INVALID_KEY') await deps.keys.set(null);
        return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': deviceErrorToken('assert', e) };
      }
    }

    // Android
    if (signedIn && passUntil > time + 60_000) return { 'X-Qutai-Device-Platform': platform };
    const project = config.playCloudProjectNumber;
    if (!project) return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': 'not_configured' };
    let stage: ProofStage = 'prep';
    try {
      if (prepared !== project) {
        await m.prepareIntegrityTokenProviderAsync(project);
        prepared = project;
      }
      const hash = bytesToHex(sha256(utf8ToBytes(clientData)));
      let token: string;
      try {
        stage = 'req';
        token = await m.requestIntegrityCheckAsync(hash);
      } catch (e) {
        if ((e as { code?: string })?.code !== 'ERR_APP_INTEGRITY_PROVIDER_INVALID') throw e;
        stage = 'prep';
        await m.prepareIntegrityTokenProviderAsync(project);
        stage = 'req';
        token = await m.requestIntegrityCheckAsync(hash);
      }
      return { ...base, 'X-Qutai-Device-Integrity': token };
    } catch (e) {
      prepared = null;
      return { 'X-Qutai-Device-Platform': platform, 'X-Qutai-Device-Error': deviceErrorToken(stage, e) };
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
