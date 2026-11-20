/**
 * Random ids and nonces from a cryptographically secure source (utils/secureRandom.ts): one place for every value a
 * page or another app must not be able to guess (message nonces between the app and a page, the page script's
 * per-document name) and for ids that only need to be unique.
 */
import { fillRandom } from './secureRandom';

const HEX = '0123456789abcdef';
const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomChars(alphabet: string, length: number): string {
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    // Small draws: a platform's getRandomValues takes at most 64 KB at a time (and less on some).
    const bytes = fillRandom(new Uint8Array(Math.min(256, (length - out.length) * 2)));
    for (let i = 0; i < bytes.length && out.length < length; i++) if (bytes[i] < limit) out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** A secret: 128 bits as 32 lowercase hex characters (or `bytes` × 8 bits). */
export function newNonce(bytes = 16): string {
  const b = fillRandom(new Uint8Array(bytes));
  let out = '';
  for (let i = 0; i < b.length; i++) out += HEX[b[i] >> 4] + HEX[b[i] & 15];
  return out;
}

/**
 * A unique id in the shape the app always used for stored ids: the time in base 36, then `randomLength` random base-36
 * characters, so ids still sort roughly by creation.
 */
export function newId(randomLength = 10): string {
  return Date.now().toString(36) + randomChars(BASE36, randomLength);
}

/** Random lowercase letters and digits only (for names that must start with a letter, prefix one). */
export function randomBase36(length: number): string {
  return randomChars(BASE36, length);
}
