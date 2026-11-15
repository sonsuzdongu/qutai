import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Sign-in nonces and the device id. Pure code (the random bytes are passed in: expo-crypto in the app,
 * node:crypto in the tests).
 *
 * The server's nonce protocol (backend/README.md › Auth): a fresh random nonce per sign-in; Apple and Google get
 * its SHA-256 as lowercase hex, which they put into the identity token's `nonce` claim; the server gets the raw
 * nonce, hashes it and compares, and accepts each nonce once.
 */

export type RandomBytes = (length: number) => Uint8Array;

/** URL-safe base64 without padding: only [A-Za-z0-9_-], as the server's device id rule asks. */
export function base64url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + alphabet[(n >> 6) & 63] + alphabet[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + alphabet[(n >> 6) & 63];
  }
  return out;
}

export type SignInNonce = {
  /** Sent to Qutai's server. */
  raw: string;
  /** Given to Apple / Google: SHA-256 of `raw`, lowercase hex. */
  hashed: string;
};

export function makeNonce(randomBytes: RandomBytes): SignInNonce {
  const raw = base64url(randomBytes(32));
  return { raw, hashed: sha256Hex(raw) };
}

export function sha256Hex(text: string): string {
  return bytesToHex(sha256(utf8ToBytes(text)));
}

/** 32 random bytes: 43 characters of [A-Za-z0-9_-]. */
export function makeDeviceId(randomBytes: RandomBytes): string {
  return base64url(randomBytes(32));
}

export function isDeviceId(value: string | null | undefined): value is string {
  return !!value && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}
