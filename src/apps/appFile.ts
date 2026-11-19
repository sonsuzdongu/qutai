import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { COLLECTION, KEY, LIMITS } from './contract';
import {
  AVAILABLE_PERMISSIONS,
  CONTRACT_VERSION,
  PACKAGE_FORMAT_VERSION,
  PACKAGE_LIMITS,
  checkPackage,
  cleanAppName,
  describeProblems,
  packageHash,
  packageSize,
  utf8Length,
  type AppManifest,
  type AppPackage,
  type AppPermission,
} from './manifest';

/**
 * The `.qutaiapp` export file (docs/mini-apps.md › Phase 2): one UTF-8 JSON object with the current version's package,
 * its hash and, when the user chose "with my data", the app's data with its own hash. Reading treats the file as
 * untrusted input: every check runs before anything is stored. Pure code: no React Native, also runs in Node.
 */

export const APP_FILE_FORMAT = 'qutai-app-file';
export const APP_FILE_VERSION = 1;
export const APP_FILE_EXTENSION = 'qutaiapp';
export const APP_FILE_MIME = 'application/vnd.qutai.app+json';
export const APP_FILE_UTI = 'com.sonsuzdongu.qutai.app';
/** Larger files are refused before they are read: 512 KB of package and 5 MB of data fit well inside. */
export const APP_FILE_MAX_BYTES = 8 * 1024 * 1024;
/** Key-value entries plus documents in one app's data. */
export const APP_DATA_MAX_ENTRIES = 100_000;

export type KvEntry = { key: string; value: unknown };
export type DocEntry = { collection: string; doc: Record<string, unknown> & { id: string; createdAt: number; updatedAt: number } };
/** An app's data as it travels in a file or a backup. */
export type AppData = { kv: KvEntry[]; docs: DocEntry[] };

export type AppFileContents = {
  pkg: AppPackage;
  hash: string;
  data: AppData | null;
  /** Bytes of the data as the store counts them (0 without data). */
  dataBytes: number;
  exportedAt: string | null;
  exportedBy: string | null;
};

export type AppFileErrorCode =
  /** Not a Qutai app file at all. */
  | 'not-app'
  /** A Qutai backup (.qutai), which is restored in Settings. */
  | 'backup'
  /** Over APP_FILE_MAX_BYTES. */
  | 'too-large'
  /** Made by a newer Qutai (file or package format). */
  | 'newer'
  /** A hash doesn't match: damaged in transfer or changed after export. */
  | 'damaged'
  /** It is an app file, but the package or the data fails a check. */
  | 'invalid';

export class AppFileError extends Error {
  constructor(
    public code: AppFileErrorCode,
    /** The technical line for Details. */
    public detail = '',
  ) {
    super(detail || code);
    this.name = 'AppFileError';
  }
}

/** Whether an address handed to Qutai from outside is a file to import (not a web page or a qutai:// link). */
export function isAppFileUri(uri: string | null | undefined): uri is string {
  return !!uri && /^(file|content):\/\//i.test(uri) && uri.length <= 4096;
}

// ---------- Data ----------

/** Bytes of one key-value entry or document, the same count the store's quota uses (src/apps/store.ts). */
export function kvEntryBytes(e: KvEntry): number {
  return utf8Length(e.key) + utf8Length(JSON.stringify(e.value));
}
export function docEntryBytes(e: DocEntry): number {
  return utf8Length(e.collection) + utf8Length(e.doc.id) + utf8Length(JSON.stringify(e.doc));
}
export function appDataBytes(data: AppData): number {
  let bytes = 0;
  for (const e of data.kv) bytes += kvEntryBytes(e);
  for (const e of data.docs) bytes += docEntryBytes(e);
  return bytes;
}
export function appDataCount(data: AppData): number {
  return data.kv.length + data.docs.length;
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** SHA-256 (hex) of the data in a canonical order, independent of how the file lists it. */
export function appDataHash(data: AppData): string {
  const parts = ['qutai-app-data-v1'];
  for (const e of [...data.kv].sort((a, b) => byText(a.key, b.key))) parts.push(`k\n${e.key}\n${JSON.stringify(e.value)}`);
  for (const e of [...data.docs].sort((a, b) => byText(a.collection, b.collection) || byText(a.doc.id, b.doc.id)))
    parts.push(`d\n${e.collection}\n${e.doc.id}\n${JSON.stringify(e.doc)}`);
  return bytesToHex(sha256(utf8ToBytes(parts.join('\n'))));
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 8.64e15;

/** Checks data from a file or a backup by the bridge's own rules; the clean data, or the reason it can't be used. */
export function checkAppData(raw: unknown): { data: AppData; bytes: number } | { problem: string } {
  if (!isObj(raw) || !Array.isArray(raw.kv) || !Array.isArray(raw.docs)) return { problem: 'data: kv and docs must be lists' };
  if (raw.kv.length + raw.docs.length > APP_DATA_MAX_ENTRIES) return { problem: `data: more than ${APP_DATA_MAX_ENTRIES} entries` };
  const kv: KvEntry[] = [];
  const keys = new Set<string>();
  for (const [i, e] of raw.kv.entries()) {
    if (!isObj(e) || typeof e.key !== 'string' || !KEY.test(e.key) || !('value' in e) || e.value === undefined)
      return { problem: `data.kv[${i}]: a key (letters, digits, _ . : -) and a value` };
    if (keys.has(e.key)) return { problem: `data.kv[${i}]: the key ${e.key} is there twice` };
    keys.add(e.key);
    const entry = { key: e.key, value: e.value };
    if (utf8Length(JSON.stringify(entry.value)) > LIMITS.valueBytes) return { problem: `data.kv[${i}]: larger than 256 KB` };
    kv.push(entry);
  }
  const docs: DocEntry[] = [];
  const ids = new Set<string>();
  for (const [i, e] of raw.docs.entries()) {
    if (!isObj(e) || typeof e.collection !== 'string' || !COLLECTION.test(e.collection) || !isObj(e.doc))
      return { problem: `data.docs[${i}]: a collection name and a document` };
    const doc = e.doc;
    if (typeof doc.id !== 'string' || !KEY.test(doc.id) || !isTime(doc.createdAt) || !isTime(doc.updatedAt))
      return { problem: `data.docs[${i}]: the document needs an id, createdAt and updatedAt` };
    const at = `${e.collection}\u0000${doc.id}`;
    if (ids.has(at)) return { problem: `data.docs[${i}]: ${e.collection}/${doc.id} is there twice` };
    ids.add(at);
    const entry = { collection: e.collection, doc: doc as DocEntry['doc'] };
    if (utf8Length(JSON.stringify(entry.doc)) > LIMITS.valueBytes) return { problem: `data.docs[${i}]: larger than 256 KB` };
    docs.push(entry);
  }
  const data = { kv, docs };
  const bytes = appDataBytes(data);
  if (bytes > LIMITS.quotaBytes) return { problem: `data: ${Math.round(bytes / 1024)} KB is over the ${LIMITS.quotaBytes / 1024 / 1024} MB an app may keep` };
  return { data, bytes };
}

// ---------- Writing ----------

/** The file's text. `data` only when the user chose "with my data". */
export function buildAppFile(input: { pkg: AppPackage; data?: AppData | null; exportedAt: string; exportedBy: string }): string {
  const { pkg } = input;
  const file: Record<string, unknown> = {
    format: APP_FILE_FORMAT,
    fileVersion: APP_FILE_VERSION,
    exportedAt: input.exportedAt,
    exportedBy: input.exportedBy,
    package: { manifest: pkg.manifest, files: pkg.files, sha256: packageHash(pkg) },
  };
  if (input.data) file.data = { kv: input.data.kv, docs: input.data.docs, bytes: appDataBytes(input.data), sha256: appDataHash(input.data) };
  return JSON.stringify(file, null, 1);
}

/** `<name>.qutaiapp` (or `<name> (with data).qutaiapp`), with characters file systems dislike replaced. */
export function appFileName(name: string, withData: boolean, withDataLabel = 'with data'): string {
  const safe = cleanAppName(name).replace(/[\\/:*?"<>|#%]+/g, '-').replace(/^[.\s-]+|[.\s]+$/g, '') || 'app';
  return `${safe}${withData ? ` (${withDataLabel.replace(/[\\/:*?"<>|#%]+/g, '-')})` : ''}.${APP_FILE_EXTENSION}`;
}

// ---------- Reading ----------

const BACKUP_MAGIC = [0x51, 0x55, 0x54, 0x41, 0x49, 0x42, 0x41, 0x4b]; // "QUTAIBAK"

/** Reads and checks a file's bytes. Throws AppFileError; never returns something unchecked. */
export function readAppFile(bytes: Uint8Array): AppFileContents {
  if (bytes.length > APP_FILE_MAX_BYTES) throw new AppFileError('too-large', `${bytes.length} bytes`);
  if (BACKUP_MAGIC.every((b, i) => bytes[i] === b)) throw new AppFileError('backup');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new AppFileError('not-app', 'not UTF-8 text');
  }
  return parseAppFile(text.replace(/^﻿/, ''));
}

export function parseAppFile(text: string): AppFileContents {
  if (utf8Length(text) > APP_FILE_MAX_BYTES) throw new AppFileError('too-large');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppFileError('not-app', 'not JSON');
  }
  if (!isObj(raw) || raw.format !== APP_FILE_FORMAT) throw new AppFileError('not-app', 'format is not qutai-app-file');
  if (!Number.isInteger(raw.fileVersion) || (raw.fileVersion as number) < 1) throw new AppFileError('not-app', 'fileVersion');
  if ((raw.fileVersion as number) > APP_FILE_VERSION) throw new AppFileError('newer', `file version ${raw.fileVersion}`);
  const p = raw.package;
  if (!isObj(p) || !isObj(p.manifest) || !isObj(p.files) || typeof p.sha256 !== 'string')
    throw new AppFileError('invalid', 'package: manifest, files and sha256');
  const manifest = p.manifest as unknown as AppManifest;
  // checkPackage refuses it too; reported as "newer" so the user is told to update Qutai rather than "invalid".
  if (Number.isInteger(manifest.formatVersion) && manifest.formatVersion > PACKAGE_FORMAT_VERSION)
    throw new AppFileError('newer', `package format ${manifest.formatVersion}`);
  const pkg: AppPackage = { manifest, files: p.files as Record<string, string> };
  const problems = checkPackage(pkg);
  if (problems.length) throw new AppFileError('invalid', describeProblems(problems));
  const hash = packageHash(pkg);
  if (hash !== p.sha256.toLowerCase()) throw new AppFileError('damaged', 'package sha256 does not match');
  let data: AppData | null = null;
  let dataBytes = 0;
  if (raw.data !== undefined && raw.data !== null) {
    const d = raw.data;
    if (!isObj(d) || typeof d.sha256 !== 'string') throw new AppFileError('invalid', 'data: kv, docs and sha256');
    const checked = checkAppData(d);
    if ('problem' in checked) throw new AppFileError('invalid', checked.problem);
    if (appDataHash(checked.data) !== d.sha256.toLowerCase()) throw new AppFileError('damaged', 'data sha256 does not match');
    if (d.bytes !== undefined && d.bytes !== checked.bytes) throw new AppFileError('damaged', 'data bytes do not match');
    data = checked.data;
    dataBytes = checked.bytes;
  }
  return {
    pkg,
    hash,
    data,
    dataBytes,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt.slice(0, 40) : null,
    exportedBy: typeof raw.exportedBy === 'string' ? raw.exportedBy.slice(0, 60) : null,
  };
}

// ---------- What the import screen shows ----------

/** Code an app normally doesn't need: named on the review screen ("uses techniques apps normally don't need"). */
const FLAG_PATTERNS: [string, RegExp][] = [
  ['RTCPeerConnection', /\b(webkit)?RTCPeerConnection\b|\bRTCDataChannel\b|\bRTCIceCandidate\b/],
  ['iframe', /<\s*i?frame\b|createElement\s*\(\s*['"`]i?frame/i],
  ['frames[', /\bframes\s*\[|\bwindow\s*\[\s*\d/],
  ['eval', /\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(\s*['"`]/],
  ['WebAssembly', /\bWebAssembly\b/],
];

/** Which flags the files raise, each once, in a fixed order. */
export function codeFlags(files: Record<string, string>): string[] {
  const text = Object.values(files).join('\n');
  return FLAG_PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

/** Permissions the manifest declares that this Qutai can't grant yet (later phases). */
export function unavailablePermissions(manifest: AppManifest): AppPermission[] {
  return manifest.permissions.filter((p) => !AVAILABLE_PERMISSIONS.includes(p));
}

export function needsNewerQutai(manifest: AppManifest): boolean {
  return manifest.contract > CONTRACT_VERSION;
}

export type ExistingApp = { id: string; name: string };

/** What the import collides with on this phone: the same id, else the same name (case-insensitive). */
export function findClash(manifest: AppManifest, existing: readonly ExistingApp[]): { kind: 'id' | 'name'; app: ExistingApp } | null {
  const byId = existing.find((a) => a.id === manifest.id);
  if (byId) return { kind: 'id', app: byId };
  const name = manifest.name.toLocaleLowerCase();
  const byName = existing.find((a) => a.name.toLocaleLowerCase() === name);
  return byName ? { kind: 'name', app: byName } : null;
}

/** "Notes", or "Notes 2", "Notes 3"… when the name is taken, within the 40 characters. */
export function uniqueAppName(name: string, existing: readonly ExistingApp[]): string {
  const taken = new Set(existing.map((a) => a.name.toLocaleLowerCase()));
  if (!taken.has(name.toLocaleLowerCase())) return name;
  for (let n = 2; n < 1000; n++) {
    const suffix = ` ${n}`;
    const base = [...name].slice(0, PACKAGE_LIMITS.name - suffix.length).join('').trimEnd();
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return name;
}

/** The package's size in bytes (for the review). */
export function packageBytes(pkg: AppPackage): number {
  return packageSize(pkg.files);
}
