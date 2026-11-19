import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { isWellFormed } from '../utils/wellFormed';

/**
 * App packages (docs/mini-apps.md › The package): the manifest, the files, their checks, the canonical hash and the
 * device seal. Pure code: no React Native, also runs in Node.
 */

export const PACKAGE_FORMAT = 'qutai-app';
export const PACKAGE_FORMAT_VERSION = 1;
/** The bridge contract this Qutai implements (src/apps/contract.ts). */
export const CONTRACT_VERSION = 1;

export const PACKAGE_LIMITS = {
  name: 40,
  description: 200,
  files: 12,
  fileBytes: 256 * 1024,
  totalBytes: 512 * 1024,
  svgBytes: 4096,
  /** Versions kept per app besides the current one (docs/mini-apps.md › Versions). */
  keptVersions: 20,
} as const;

/** Every permission the contract knows (docs/mini-apps.md › Permissions). Implicit ones are never declared. */
export const KNOWN_PERMISSIONS = [
  'clipboard-write',
  'clipboard-read',
  'share',
  'files',
  'location',
  'notifications',
  'camera',
  'photos',
  'links',
  'assistant',
  'network',
] as const;
export type AppPermission = (typeof KNOWN_PERMISSIONS)[number];
export const IMPLICIT_PERMISSIONS = ['storage', 'ui', 'app'] as const;
/** What this Qutai can grant (phase 1). An app declaring more can be listed but not written by the assistant. */
export const AVAILABLE_PERMISSIONS: readonly AppPermission[] = ['clipboard-write', 'clipboard-read'];
/** Asked with Qutai's dialog at first use; the rest of the available ones are granted by declaring them. */
export const ASKED_PERMISSIONS: readonly AppPermission[] = ['clipboard-read', 'location', 'notifications', 'camera', 'photos', 'assistant', 'links', 'network'];

/** Icon names an app may use (a subset of src/ui/Icon.tsx's names that suit apps). */
export const APP_ICONS = [
  'notes',
  'tasks',
  'calendar',
  'alarm',
  'reminder',
  'wallet',
  'food',
  'travel',
  'home',
  'person',
  'photo',
  'document',
  'globe',
  'bookmark',
  'location',
  'phone',
  'email',
  'message',
  'play',
  'key',
  'delivery',
  'palette',
  'library',
  'history',
  'check',
  'compare',
  'research',
  'memory',
  'tool',
  'camera',
  'microphone',
  'preferences',
] as const;
export type AppIconName = (typeof APP_ICONS)[number];

export type AppIcon = { name: AppIconName; color?: string } | { svg: string; color?: string };

export type AppAuthor = { kind: 'local' } | { kind: 'imported'; file: string; importedAt: string };

export type AppManifest = {
  format: typeof PACKAGE_FORMAT;
  formatVersion: number;
  id: string;
  name: string;
  description: string;
  icon: AppIcon;
  version: number;
  contract: number;
  permissions: AppPermission[];
  network?: { hosts: string[] };
  entry: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  author: AppAuthor;
};

/** File name → text. */
export type AppFiles = Record<string, string>;
export type AppPackage = { manifest: AppManifest; files: AppFiles };

export const APP_ID = /^app-[a-z0-9]{12}$/;
export const FILE_NAME = /^[a-z0-9][a-z0-9_-]{0,39}\.(html|css|js)$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export type PackageProblem = { field: string; message: string };

/** UTF-8 length of a string (well-formed or not: a lone surrogate counts as the 3 bytes of U+FFFD). */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

/** A new app id: `app-` and 12 characters from the random bytes given (crypto in the app, anything in tests). */
export function newAppId(random: Uint8Array): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) id += alphabet[(random[i] ?? 0) % alphabet.length];
  return `app-${id}`;
}

/** The name as stored: control characters out, spaces collapsed, at most 40 characters. */
export function cleanAppName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return [...name.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, PACKAGE_LIMITS.name).join('').trim();
}

const SVG_ELEMENTS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
const SVG_ATTRIBUTES = new Set([
  'viewbox',
  'width',
  'height',
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'fill-rule',
  'clip-rule',
  'opacity',
  'transform',
  'xmlns',
]);

/** Null when the SVG is in the icon subset; otherwise why not. */
export function checkSvgIcon(svg: unknown): string | null {
  if (typeof svg !== 'string') return 'not a string';
  if (utf8Length(svg) > PACKAGE_LIMITS.svgBytes) return `larger than ${PACKAGE_LIMITS.svgBytes} bytes`;
  const text = svg.trim();
  if (!/^<svg[\s>]/i.test(text) || !/<\/svg>$/i.test(text)) return 'must be one <svg> element';
  if (/<!|<\?|&|@|url\s*\(|javascript:|data:/i.test(text)) return 'comments, entities, url(), @ and data: are not allowed';
  const tag = /<\/?([a-zA-Z][\w:-]*)([^>]*)>/g;
  let rest = text;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(text))) {
    rest = rest.replace(m[0], '');
    const name = m[1].toLowerCase();
    if (!SVG_ELEMENTS.has(name)) return `element <${m[1]}> is not allowed`;
    if (m[0].startsWith('</')) {
      if (m[2].trim()) return 'bad closing tag';
      continue;
    }
    const attrs = m[2].replace(/\/\s*$/, '');
    const attr = /\s*([a-zA-Z][\w:-]*)\s*=\s*("[^"<>]*"|'[^'<>]*')/gy;
    let pos = 0;
    let a: RegExpExecArray | null;
    attr.lastIndex = 0;
    while ((a = attr.exec(attrs))) {
      if (!SVG_ATTRIBUTES.has(a[1].toLowerCase())) return `attribute ${a[1]} is not allowed`;
      pos = attr.lastIndex;
    }
    if (attrs.slice(pos).trim()) return 'attributes must be name="value"';
  }
  // Text between elements (text content) is not allowed: only whitespace may remain.
  if (rest.replace(/<[^>]*>/g, '').trim()) return 'text content is not allowed';
  return null;
}

function checkIcon(icon: unknown, problems: PackageProblem[]) {
  if (!icon || typeof icon !== 'object') return problems.push({ field: 'icon', message: 'icon must be an object' });
  const i = icon as Record<string, unknown>;
  if ('color' in i && i.color !== undefined && (typeof i.color !== 'string' || !COLOR.test(i.color)))
    problems.push({ field: 'icon.color', message: 'color must be #rrggbb' });
  if ('name' in i) {
    if (!(APP_ICONS as readonly string[]).includes(String(i.name)))
      problems.push({ field: 'icon.name', message: `unknown icon; use one of: ${APP_ICONS.join(', ')}` });
    if ('svg' in i) problems.push({ field: 'icon', message: 'name or svg, not both' });
  } else if ('svg' in i) {
    const why = checkSvgIcon(i.svg);
    if (why) problems.push({ field: 'icon.svg', message: why });
  } else problems.push({ field: 'icon', message: 'icon needs a name or an svg' });
}

/**
 * Checks a manifest. `forWriting`: the assistant is writing it in this Qutai, so only available permissions are
 * accepted and no network hosts (an import from a newer Qutai is checked without it and listed as needing an update).
 */
export function checkManifest(value: unknown, options: { forWriting?: boolean } = {}): PackageProblem[] {
  const problems: PackageProblem[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [{ field: 'manifest', message: 'not an object' }];
  const m = value as Record<string, unknown>;
  if (m.format !== PACKAGE_FORMAT) problems.push({ field: 'format', message: `must be "${PACKAGE_FORMAT}"` });
  if (!Number.isInteger(m.formatVersion) || (m.formatVersion as number) < 1)
    problems.push({ field: 'formatVersion', message: 'must be a positive integer' });
  else if ((m.formatVersion as number) > PACKAGE_FORMAT_VERSION)
    problems.push({ field: 'formatVersion', message: 'made by a newer Qutai' });
  if (typeof m.id !== 'string' || !APP_ID.test(m.id)) problems.push({ field: 'id', message: 'must be app- and 12 letters or digits' });
  if (typeof m.name !== 'string' || cleanAppName(m.name) !== m.name || !m.name)
    problems.push({ field: 'name', message: `1 to ${PACKAGE_LIMITS.name} characters, no line breaks` });
  if (typeof m.description !== 'string' || [...m.description].length > PACKAGE_LIMITS.description || /[\u0000-\u0008\u000b-\u001f]/.test(m.description))
    problems.push({ field: 'description', message: `at most ${PACKAGE_LIMITS.description} characters` });
  checkIcon(m.icon, problems);
  if (!Number.isInteger(m.version) || (m.version as number) < 1) problems.push({ field: 'version', message: 'must be a positive integer' });
  if (!Number.isInteger(m.contract) || (m.contract as number) < 1) problems.push({ field: 'contract', message: 'must be a positive integer' });
  else if (options.forWriting && m.contract !== CONTRACT_VERSION)
    problems.push({ field: 'contract', message: `this Qutai writes contract ${CONTRACT_VERSION}` });
  if (!Array.isArray(m.permissions)) problems.push({ field: 'permissions', message: 'must be a list' });
  else {
    const seen = new Set<string>();
    for (const p of m.permissions) {
      if (typeof p !== 'string' || !(KNOWN_PERMISSIONS as readonly string[]).includes(p)) {
        const implicit = (IMPLICIT_PERMISSIONS as readonly string[]).includes(String(p));
        problems.push({ field: 'permissions', message: implicit ? `${p} is implicit: leave it out` : `unknown permission ${String(p)}` });
      } else if (seen.has(p)) problems.push({ field: 'permissions', message: `${p} is listed twice` });
      else if (options.forWriting && !AVAILABLE_PERMISSIONS.includes(p as AppPermission))
        problems.push({ field: 'permissions', message: `${p} is not available yet (available: ${AVAILABLE_PERMISSIONS.join(', ')})` });
      seen.add(String(p));
    }
  }
  if (m.network !== undefined) {
    const hosts = (m.network as { hosts?: unknown })?.hosts;
    if (!Array.isArray(hosts) || hosts.some((h) => typeof h !== 'string'))
      problems.push({ field: 'network', message: 'network.hosts must be a list of host names' });
    else if (options.forWriting && hosts.length) problems.push({ field: 'network', message: 'apps have no network yet' });
  }
  if (typeof m.entry !== 'string' || !FILE_NAME.test(m.entry) || !m.entry.endsWith('.html'))
    problems.push({ field: 'entry', message: 'must be an .html file name' });
  if (typeof m.language !== 'string' || !LANGUAGE.test(m.language)) problems.push({ field: 'language', message: 'a language code such as tr or en' });
  for (const field of ['createdAt', 'updatedAt'] as const)
    if (typeof m[field] !== 'string' || !ISO.test(m[field] as string)) problems.push({ field, message: 'an ISO 8601 UTC time' });
  const author = m.author as Record<string, unknown> | undefined;
  if (!author || (author.kind !== 'local' && author.kind !== 'imported'))
    problems.push({ field: 'author', message: 'kind must be local or imported' });
  else if (author.kind === 'imported' && (typeof author.file !== 'string' || typeof author.importedAt !== 'string'))
    problems.push({ field: 'author', message: 'an imported app names its file and time' });
  return problems;
}

/** Checks the files against the manifest's entry and the caps. */
export function checkFiles(files: unknown, entry: string): PackageProblem[] {
  const problems: PackageProblem[] = [];
  if (!files || typeof files !== 'object' || Array.isArray(files)) return [{ field: 'files', message: 'files must be an object of name: text' }];
  const names = Object.keys(files);
  if (names.length > PACKAGE_LIMITS.files) problems.push({ field: 'files', message: `at most ${PACKAGE_LIMITS.files} files` });
  if (!names.includes(entry)) problems.push({ field: 'files', message: `the entry file ${entry} is missing` });
  let total = 0;
  for (const name of names) {
    const text = (files as Record<string, unknown>)[name];
    if (!FILE_NAME.test(name)) {
      problems.push({ field: `files.${name}`, message: 'file names: lowercase letters, digits, - and _, ending .html, .css or .js; no folders' });
      continue;
    }
    if (name.endsWith('.html') && name !== entry) problems.push({ field: `files.${name}`, message: 'only one .html file (the entry)' });
    if (typeof text !== 'string') {
      problems.push({ field: `files.${name}`, message: 'must be text' });
      continue;
    }
    if (!isWellFormed(text) || text.includes('\u0000')) problems.push({ field: `files.${name}`, message: 'not valid text' });
    const size = utf8Length(text);
    total += size;
    if (size > PACKAGE_LIMITS.fileBytes) problems.push({ field: `files.${name}`, message: `larger than ${PACKAGE_LIMITS.fileBytes / 1024} KB` });
  }
  if (total > PACKAGE_LIMITS.totalBytes) problems.push({ field: 'files', message: `the package is larger than ${PACKAGE_LIMITS.totalBytes / 1024} KB` });
  return problems;
}

export function checkPackage(pkg: unknown, options: { forWriting?: boolean } = {}): PackageProblem[] {
  if (!pkg || typeof pkg !== 'object') return [{ field: 'package', message: 'not an object' }];
  const { manifest, files } = pkg as { manifest?: unknown; files?: unknown };
  const problems = checkManifest(manifest, options);
  const entry = typeof (manifest as AppManifest | undefined)?.entry === 'string' ? (manifest as AppManifest).entry : 'index.html';
  return [...problems, ...checkFiles(files, entry)];
}

/** Problems as one short text for the model or the Details line. */
export function describeProblems(problems: PackageProblem[]): string {
  return problems.map((p) => `${p.field}: ${p.message}`).join('; ');
}

export function packageSize(files: AppFiles): number {
  return Object.values(files).reduce((sum, text) => sum + utf8Length(text), 0);
}

/** The manifest fields that make up the package, in a fixed order (the times and the version number are left out). */
function canonicalManifest(m: AppManifest): string {
  return JSON.stringify([
    m.format,
    m.formatVersion,
    m.name,
    m.description,
    'name' in m.icon ? ['name', m.icon.name, m.icon.color ?? ''] : ['svg', m.icon.svg, m.icon.color ?? ''],
    m.contract,
    [...m.permissions].sort(),
    [...(m.network?.hosts ?? [])].sort(),
    m.entry,
    m.language,
  ]);
}

/** SHA-256 (hex) of the canonical package: what export files carry and what the seal covers. */
export function packageHash(pkg: AppPackage): string {
  const names = Object.keys(pkg.files).sort();
  const parts = [`qutai-app-package-v1\n${canonicalManifest(pkg.manifest)}`];
  for (const name of names) parts.push(`${name}\n${pkg.files[name].length}\n${pkg.files[name]}`);
  return bytesToHex(sha256(utf8ToBytes(parts.join('\n'))));
}

/** The device seal of a package hash: HMAC-SHA-256 under this install's key (src/device/scriptKey.ts). */
export function packageSeal(hash: string, key: Uint8Array): string {
  return bytesToHex(hmac(sha256, key, utf8ToBytes(`qutai-app-v1\n${hash}`)));
}

/** Whether `seal` is this device's seal of the package (constant time). */
export function packageSealMatches(pkg: AppPackage, seal: string | null | undefined, key: Uint8Array | null): boolean {
  if (!seal || !key || seal.length !== 64) return false;
  const expected = packageSeal(packageHash(pkg), key);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ seal.charCodeAt(i);
  return diff === 0;
}

/** A stable colour for an app without its own (the same idea as site tiles). */
export function appColor(app: { id: string; icon?: AppIcon }): string {
  if (app.icon?.color) return app.icon.color;
  const palette = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#ef6c00', '#00838f', '#4e342e', '#ad1457'];
  let h = 0;
  for (let i = 0; i < app.id.length; i++) h = (h * 31 + app.id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
