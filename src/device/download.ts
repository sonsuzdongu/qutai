/** File names, types and safety checks for downloads (both platforms). The downloads themselves: src/storage/downloads.ts. */

import { cutText, wellFormed } from '../utils/wellFormed';
import { shownHost } from '../utils/webUrl';

/** A file name safe on both platforms: no path separators or reserved characters, at most 120 characters. */
export function safeFileName(raw: string, fallback = 'download'): string {
  const clean = wellFormed(raw)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  const cut = cutText(clean, 120).trim();
  return cut || fallback;
}

/** A safe file name from the URL's last path segment (decoded), or a fallback. */
export function fileNameFromUrl(url: string, fallback = 'download'): string {
  let last = '';
  try {
    last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
  } catch {
    last = '';
  }
  return safeFileName(last, fallback);
}

/** The file name a Content-Disposition header gives (filename* first), or null. */
export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (star) {
    try {
      return safeFileName(decodeURIComponent(star[2].trim().replace(/^"|"$/g, '')), '') || null;
    } catch {
      // Falls through to the plain parameter.
    }
  }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  const value = plain ? (plain[2] ?? plain[1]).trim() : '';
  return value ? safeFileName(value, '') || null : null;
}

/** What a HEAD request says about a file before it is downloaded; null fields when unknown. */
export type DownloadProbe = { name: string | null; type: string | null; size: number | null };

/**
 * Asks the server about a file with a HEAD request (without the site's cookies, at most a few seconds), for the
 * confirmation the assistant's downloads show. Never throws: a server that refuses or is slow just leaves it unknown.
 */
export async function probeDownload(url: string, timeoutMs = 4000): Promise<DownloadProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, credentials: 'omit' });
    if (!res.ok) return { name: null, type: null, size: null };
    const length = Number(res.headers.get('content-length'));
    const type = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || null;
    return {
      name: fileNameFromDisposition(res.headers.get('content-disposition')),
      type,
      size: Number.isFinite(length) && length > 0 ? length : null,
    };
  } catch {
    return { name: null, type: null, size: null };
  } finally {
    clearTimeout(timer);
  }
}

/** File types that can install or run code, or hide anything inside: the confirmation warns about them. */
const RISKY_EXTENSIONS = new Set([
  'apk', 'apks', 'xapk', 'aab', 'ipa', 'exe', 'msi', 'msix', 'appx', 'dmg', 'pkg', 'mpkg', 'app', 'bat', 'cmd',
  'com', 'scr', 'ps1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'hta', 'sh', 'command', 'jar', 'deb', 'rpm', 'appimage',
  'run', 'bin', 'mobileconfig', 'xpi', 'crx', 'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', 'cab',
  'iso', 'img', 'lnk', 'reg', 'docm', 'xlsm', 'pptm',
]);
const RISKY_TYPES = /^application\/(vnd\.android\.package-archive|x-msdownload|x-ms-installer|x-msi|x-apple-diskimage|x-newton-compatible-pkg|x-sh|x-shellscript|java-archive|x-java-archive|x-executable|x-mach-binary|x-apple-aspen-config|zip|x-zip-compressed|x-7z-compressed|x-rar-compressed|vnd\.rar|x-tar|gzip|x-gzip|x-bzip2|x-xz|x-iso9660-image)$/;

/** Whether a download could install or run something, or is an archive (or an unknown binary). */
export function isRiskyDownload(name: string, type: string | null): boolean {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext && RISKY_EXTENSIONS.has(ext)) return true;
  // A generic binary type says nothing when the name has an extension ("invoice.pdf" served as octet-stream).
  if (type === 'application/octet-stream') return !ext;
  return !!type && RISKY_TYPES.test(type);
}

/** "rapor.pdf" → "rapor (2).pdf" until the name is free. */
export function uniqueName(name: string, taken: (candidate: string) => boolean): string {
  if (!taken(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!taken(candidate)) return candidate;
  }
}

const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  apk: 'application/vnd.android.package-archive',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  epub: 'application/epub+zip',
  ics: 'text/calendar',
};

/** The common type of a file name's extension, or null. */
export function mimeForName(name: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return (ext && TYPES[ext]) || null;
}

/** An extension for a type when the name has none ("report" + application/pdf → "pdf"), or null. */
export function extensionForMime(mime: string | null): string | null {
  if (!mime) return null;
  const type = mime.split(';')[0].trim().toLowerCase();
  return Object.keys(TYPES).find((ext) => TYPES[ext] === type && ext !== 'jpeg') ?? null;
}

/** "example.com" for the list ("" when the address has no host). */
export function siteOf(url: string): string {
  return shownHost(url) ?? '';
}

/**
 * The name to save a page's download under: Content-Disposition first, then the URL's last segment, with the type's
 * extension when the name has none. `nameFixed` says the server chose it (response headers don't rename it later).
 */
export function guessDownloadName(
  url: string,
  disposition: string | null | undefined,
  mime: string | null | undefined,
): { name: string; nameFixed: boolean } {
  const fromHeader = fileNameFromDisposition(disposition ?? null);
  if (fromHeader) return { name: fromHeader, nameFixed: true };
  let name = /^https?:/i.test(url) ? fileNameFromUrl(url) : 'download';
  if (!/\.[a-z0-9]{1,8}$/i.test(name)) {
    const ext = extensionForMime(mime ?? null);
    if (ext) name = `${name}.${ext}`;
  }
  return { name, nameFixed: false };
}
