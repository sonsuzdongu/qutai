import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { safeFileName } from './download';

/**
 * Files the assistant composes for the user (save_file): CSV, Markdown, plain text or JSON. The content stays in
 * memory while the app runs and is written to disk only when the user taps Share (a temporary copy in the cache,
 * removed when the share sheet closes) or Save (into a folder they pick). So nothing is left on disk by the
 * assistant, and after a restart, or once newer files pushed it out, a card says the file has expired.
 */

export type FileFormat = 'csv' | 'md' | 'txt' | 'json';

/** What a chat card keeps (and what is saved with the conversation): never the content. */
export type FileOffer = { id: string; name: string; format: FileFormat; size: number; rows?: number };

const FORMATS: Record<FileFormat, { ext: string; mime: string; uti: string }> = {
  csv: { ext: 'csv', mime: 'text/csv', uti: 'public.comma-separated-values-text' },
  md: { ext: 'md', mime: 'text/markdown', uti: 'net.daringfireball.markdown' },
  txt: { ext: 'txt', mime: 'text/plain', uti: 'public.plain-text' },
  json: { ext: 'json', mime: 'application/json', uti: 'public.json' },
};

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** Kept in memory at most; older files expire first. */
const MAX_KEPT_FILES = 20;
const MAX_KEPT_BYTES = 12 * 1024 * 1024;

export function isFileFormat(value: unknown): value is FileFormat {
  return typeof value === 'string' && value in FORMATS;
}

/** Bytes of a string in UTF-8. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** "Price list.csv" from whatever name the model gave: safe characters, the format's own extension. */
export function composedFileName(raw: unknown, format: FileFormat): string {
  const ext = FORMATS[format].ext;
  const base = safeFileName(String(raw ?? ''), 'qutai')
    .replace(/\.(csv|md|markdown|txt|text|json)$/i, '')
    .trim()
    .slice(0, 100);
  return `${base || 'qutai'}.${ext}`;
}

/** A plain number ("-12", "3.5", "1,25", "1e3"): safe in a spreadsheet, left as it is. */
const PLAIN_NUMBER = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/;

/**
 * One CSV field. Text from web pages could carry spreadsheet formulas, so a value starting with =, +, -, @, tab or
 * carriage return gets a leading apostrophe (plain numbers excepted); fields with the delimiter, quotes, line breaks
 * or edge spaces are quoted, with quotes doubled.
 */
export function csvField(value: unknown, delimiter: string): string {
  let text: string;
  if (value === null || value === undefined) text = '';
  else if (typeof value === 'string') text = value;
  else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') text = String(value);
  else text = JSON.stringify(value) ?? '';
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  const needsQuotes =
    text.includes(delimiter) || /["\r\n]/.test(text) || (text.length > 0 && text.trim() !== text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows as RFC 4180 CSV with CRLF line endings (every line, the last one too). */
export function toCsv(rows: unknown[][], delimiter = ','): string {
  return rows.map((row) => row.map((cell) => csvField(cell, delimiter)).join(delimiter) + '\r\n').join('');
}

/**
 * The table the model sent: an array of arrays (with optional column names as the header), or an array of objects
 * (columns give the order; otherwise the keys in the order they first appear). Null when it is neither.
 */
export function tableRows(rows: unknown, columns: unknown): { rows: unknown[][]; records: number } | string {
  if (!Array.isArray(rows) || rows.length === 0) return 'rows must be a non-empty array of arrays or of objects.';
  const names = Array.isArray(columns) ? columns.map((c) => String(c ?? '')) : null;
  if (rows.every((r) => Array.isArray(r))) {
    const body = rows as unknown[][];
    return { rows: names ? [names, ...body] : body, records: body.length };
  }
  if (rows.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))) {
    const records = rows as Record<string, unknown>[];
    let header = names;
    if (!header) {
      const seen = new Set<string>();
      for (const r of records) for (const k of Object.keys(r)) seen.add(k);
      header = [...seen];
    }
    const keys = header;
    return { rows: [keys, ...records.map((r) => keys.map((k) => r[k]))], records: records.length };
  }
  return 'rows must be all arrays (one per row) or all objects (one per row), not a mix.';
}

export type ComposeInput = {
  name?: unknown;
  format?: unknown;
  rows?: unknown;
  columns?: unknown;
  content?: unknown;
  delimiter?: unknown;
  bom?: unknown;
};

export type Composed = { name: string; format: FileFormat; text: string; size: number; rows?: number };

/** Builds the file from the tool's input, or says what is wrong with it. Pure. */
export function composeFile(input: ComposeInput): Composed | string {
  const format = input.format;
  if (!isFileFormat(format)) return 'format must be "csv", "md", "txt" or "json".';
  const name = composedFileName(input.name, format);
  let text: string;
  let records: number | undefined;
  if (format === 'csv') {
    if (input.content !== undefined && input.rows === undefined)
      return 'For CSV, pass the table as rows (arrays or objects), not as content: the tool does the quoting.';
    const delimiter = input.delimiter === ';' || input.delimiter === '\t' ? input.delimiter : ',';
    const table = tableRows(input.rows, input.columns);
    if (typeof table === 'string') return table;
    records = table.records;
    // A byte order mark lets Excel read UTF-8 (Turkish letters) correctly; on unless turned off.
    text = (input.bom === false ? '' : '﻿') + toCsv(table.rows, delimiter);
  } else {
    if (typeof input.content !== 'string' || !input.content) return 'content must be a non-empty string.';
    text = input.content;
    if (format === 'json') {
      try {
        JSON.parse(text);
      } catch {
        return 'content is not valid JSON.';
      }
    }
  }
  const size = utf8Length(text);
  if (size > MAX_FILE_BYTES) return `The file would be ${Math.ceil(size / 1024)} KB; the limit is 2 MB. Make it smaller.`;
  return { name, format, text, size, ...(records !== undefined ? { rows: records } : {}) };
}

type Kept = { offer: FileOffer; text: string; incognito: boolean };
const kept = new Map<string, Kept>();

/** Keeps a composed file in memory for its card; the oldest ones expire past the limits. */
export function keepComposedFile(file: Composed, incognito: boolean): FileOffer {
  // "file-" marks the id as one tools may name (src/chat/shareable.ts); older cards had bare ids.
  const id = `file-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const offer: FileOffer = { id, name: file.name, format: file.format, size: file.size, ...(file.rows !== undefined ? { rows: file.rows } : {}) };
  kept.set(id, { offer, text: file.text, incognito });
  let total = 0;
  for (const k of kept.values()) total += k.offer.size;
  for (const [key, k] of kept) {
    if (kept.size <= MAX_KEPT_FILES && total <= MAX_KEPT_BYTES) break;
    if (key === id) break;
    kept.delete(key);
    total -= k.offer.size;
  }
  return offer;
}

/** Whether the card's file can still be shared or saved. */
export function composedFileAvailable(id: string): boolean {
  return kept.has(id);
}

/** The incognito session ended: files made in incognito conversations go. */
export function forgetIncognitoFiles() {
  for (const [key, k] of kept) if (k.incognito) kept.delete(key);
}

/** The file has gone (app restarted, or pushed out by newer ones); the card says so. */
export class FileExpiredError extends Error {}

function keptFile(id: string): Kept {
  const k = kept.get(id);
  if (!k) throw new FileExpiredError();
  return k;
}

/** The text of a composed file, to hand it out (src/device/outgoing.ts); throws FileExpiredError when it is gone. */
export function composedFileContent(id: string): { offer: FileOffer; text: string; incognito: boolean } {
  return keptFile(id);
}

/** Opens the share sheet (Save to Files, AirDrop, mail…) with a temporary copy, removed afterwards. */
export async function shareComposedFile(id: string): Promise<void> {
  const { offer, text } = keptFile(id);
  const dir = new Directory(Paths.cache, 'composed');
  if (!dir.exists) dir.create({ idempotent: true });
  const file = new File(dir, offer.name);
  const { mime, uti } = FORMATS[offer.format];
  try {
    if (file.exists) file.delete();
    file.create();
    await file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: uti, dialogTitle: offer.name });
  } finally {
    if (file.exists) file.delete();
  }
}

/**
 * Android: writes the file into a folder the user picks (Downloads, Documents, a cloud drive) through the system
 * picker. Resolves false when they cancel.
 */
export async function saveComposedFileToFolder(id: string): Promise<boolean> {
  const { offer, text } = keptFile(id);
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return false;
  }
  if (!dir) return false;
  const file = dir.createFile(offer.name, FORMATS[offer.format].mime);
  await file.write(text);
  return true;
}
