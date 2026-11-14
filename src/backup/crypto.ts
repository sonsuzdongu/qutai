import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';

/**
 * Password-protected backup file. Pure code (no React Native imports), so it can run anywhere.
 *
 * File layout, all numbers single bytes:
 *
 *   offset  size  field
 *   0       8     magic "QUTAIBAK" (ASCII)
 *   8       1     format version (1)
 *   9       1     KDF id: 1 = scrypt
 *   10      1     scrypt log2(N)
 *   11      1     scrypt r
 *   12      1     scrypt p
 *   13      1     salt length (16)
 *   14      16    salt (random)
 *   30      1     cipher id: 1 = XChaCha20-Poly1305
 *   31      1     nonce length (24)
 *   32      24    nonce (random)
 *   56      ...   ciphertext followed by the 16-byte Poly1305 tag
 *
 * The 32-byte key is scrypt(password as NFC UTF-8, salt, N, r, p). The whole header (bytes 0-55) is
 * the AEAD's associated data, so changing any parameter fails the authentication check just like a
 * wrong password or a damaged ciphertext. The parameters live in the header so later versions can
 * raise them and still open older files; the reader accepts only bounded values, so a hostile file
 * cannot make it allocate gigabytes. Nothing is compressed (no compressor ships with the app).
 *
 * Choices: scrypt is memory-hard (better against GPU guessing than PBKDF2) and noble's version yields
 * to the event loop while it runs. XChaCha20-Poly1305 is fast and constant-time in plain JavaScript,
 * and its 192-bit nonce can be picked at random without any risk of reuse. Both come from the audited
 * @noble libraries; Hermes has no WebCrypto.
 */

const MAGIC = 'QUTAIBAK';
export const FORMAT_VERSION = 1;
const KDF_SCRYPT = 1;
const CIPHER_XCHACHA20_POLY1305 = 1;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 24;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
export const HEADER_LENGTH = 8 + 1 + 1 + 3 + 1 + SALT_LENGTH + 1 + 1 + NONCE_LENGTH;

/** Parameters for new files. N = 2^14 with r = 8 is 16 MiB and scrypt's "interactive" setting. */
export const DEFAULT_SCRYPT = { logN: 14, r: 8, p: 1 };
/** What a file may ask for when it is opened (up to 256 MiB of memory). */
const LIMITS = { logN: [10, 20], r: [1, 16], p: [1, 4], maxmem: 2 ** 28 + 2 ** 20 } as const;

export type BackupErrorCode = 'not-backup' | 'newer-format' | 'damaged' | 'wrong-password';

/** Opening failed. 'wrong-password' also covers a damaged file: authenticated encryption can't tell them apart. */
export class BackupError extends Error {
  constructor(public code: BackupErrorCode) {
    super(code);
    this.name = 'BackupError';
  }
}

/** Random bytes from the OS (expo-crypto in the app, node:crypto in a script). */
export type RandomBytes = (length: number) => Promise<Uint8Array>;
export type Progress = (fraction: number) => void;

type Header = { version: number; logN: number; r: number; p: number; salt: Uint8Array; nonce: Uint8Array };

/** UTF-8 of the password in NFC, so the same password typed on another phone or keyboard gives the same bytes. */
export function passwordBytes(password: string): Uint8Array {
  let normalized = password;
  try {
    normalized = password.normalize('NFC');
  } catch {}
  return new TextEncoder().encode(normalized);
}

function writeHeader(h: Header): Uint8Array {
  const out = new Uint8Array(HEADER_LENGTH);
  for (let i = 0; i < MAGIC.length; i++) out[i] = MAGIC.charCodeAt(i);
  out.set([h.version, KDF_SCRYPT, h.logN, h.r, h.p, SALT_LENGTH], 8);
  out.set(h.salt, 14);
  out.set([CIPHER_XCHACHA20_POLY1305, NONCE_LENGTH], 30);
  out.set(h.nonce, 32);
  return out;
}

const within = (value: number, [min, max]: readonly [number, number]) => value >= min && value <= max;

/** Checks the magic, version and parameters. Throws BackupError; says nothing yet about the password. */
export function readHeader(file: Uint8Array): Header {
  if (file.length < MAGIC.length || [...MAGIC].some((c, i) => file[i] !== c.charCodeAt(0))) {
    throw new BackupError('not-backup');
  }
  if (file.length < 9) throw new BackupError('damaged');
  const version = file[8];
  if (version > FORMAT_VERSION) throw new BackupError('newer-format');
  if (version < 1) throw new BackupError('damaged');
  if (file.length < HEADER_LENGTH + TAG_LENGTH) throw new BackupError('damaged');
  const [kdf, logN, r, p, saltLength] = file.subarray(9, 14);
  const [cipher, nonceLength] = file.subarray(30, 32);
  if (
    kdf !== KDF_SCRYPT ||
    cipher !== CIPHER_XCHACHA20_POLY1305 ||
    saltLength !== SALT_LENGTH ||
    nonceLength !== NONCE_LENGTH ||
    !within(logN, LIMITS.logN) ||
    !within(r, LIMITS.r) ||
    !within(p, LIMITS.p) ||
    128 * r * (2 ** logN + p + 1) > LIMITS.maxmem
  ) {
    throw new BackupError('damaged');
  }
  return { version, logN, r, p, salt: file.slice(14, 30), nonce: file.slice(32, 56) };
}

function deriveKey(password: string, h: Header, onProgress?: Progress): Promise<Uint8Array> {
  const pw = passwordBytes(password);
  return scryptAsync(pw, h.salt, {
    N: 2 ** h.logN,
    r: h.r,
    p: h.p,
    dkLen: KEY_LENGTH,
    maxmem: LIMITS.maxmem,
    // Gives the UI a frame every ~16 ms of work.
    asyncTick: 16,
    onProgress,
  }).finally(() => pw.fill(0));
}

/** Encrypts `plaintext` into a complete backup file. */
export async function encryptBackup(
  plaintext: Uint8Array,
  password: string,
  randomBytes: RandomBytes,
  onProgress?: Progress,
  params = DEFAULT_SCRYPT,
): Promise<Uint8Array> {
  const salt = await randomBytes(SALT_LENGTH);
  const nonce = await randomBytes(NONCE_LENGTH);
  if (salt.length !== SALT_LENGTH || nonce.length !== NONCE_LENGTH) throw new Error('Random source failed');
  const h: Header = { version: FORMAT_VERSION, ...params, salt, nonce };
  const header = writeHeader(h);
  const key = await deriveKey(password, h, onProgress);
  try {
    const sealed = xchacha20poly1305(key, nonce, header).encrypt(plaintext);
    const out = new Uint8Array(header.length + sealed.length);
    out.set(header);
    out.set(sealed, header.length);
    return out;
  } finally {
    key.fill(0);
  }
}

/** Opens a backup file. Throws BackupError before returning anything that failed the authentication check. */
export async function decryptBackup(file: Uint8Array, password: string, onProgress?: Progress): Promise<Uint8Array> {
  const h = readHeader(file);
  const key = await deriveKey(password, h, onProgress);
  try {
    return xchacha20poly1305(key, h.nonce, file.subarray(0, HEADER_LENGTH)).decrypt(file.subarray(HEADER_LENGTH));
  } catch {
    throw new BackupError('wrong-password');
  } finally {
    key.fill(0);
  }
}
