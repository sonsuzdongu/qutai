import { Directory, File, Paths } from 'expo-file-system';
import type { Tab } from '../browser/Tab';
import type { DownloadEntry } from '../storage/downloads';
import { parseDataUrl } from './saveImage';

/** Files larger than this are downloaded directly instead of through the page (which holds them in memory). */
const PAGE_FETCH_MAX_BYTES = 25e6;

/** A safe file name from the URL's last path segment (decoded), or a fallback. */
export function fileNameFromUrl(url: string, fallback = 'download'): string {
  let last = '';
  try {
    last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
  } catch {
    last = '';
  }
  const clean = last
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return clean || fallback;
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

function downloadsDir(): Directory {
  const dir = new Directory(Paths.document, 'Downloads');
  if (!dir.exists) dir.create({ idempotent: true });
  return dir;
}

/**
 * Downloads a file the WebView couldn't show (iOS). The page fetches it first, with the
 * site's cookies, so downloads behind a login work; otherwise it is downloaded directly.
 */
export async function downloadFile(tab: Tab, url: string): Promise<DownloadEntry> {
  const dir = downloadsDir();
  const name = uniqueName(fileNameFromUrl(url), (n) => new File(dir, n).exists);
  const file = new File(dir, name);
  const data = /^https?:/i.test(url) ? await tab.run<string>('fileData', [url], 60000).catch(() => null) : null;
  const parsed = data ? parseDataUrl(data) : null;
  if (parsed && parsed.base64.length * 0.75 <= PAGE_FETCH_MAX_BYTES) {
    await file.write(parsed.base64, { encoding: 'base64' });
  } else {
    await File.downloadFileAsync(url, file);
  }
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    url,
    name,
    uri: file.uri,
    size: file.size ?? null,
    createdAt: Date.now(),
    incognito: tab.incognito || undefined,
  };
}

/** Removes a downloaded file from the device. */
export function deleteDownloadedFile(uri: string) {
  const file = new File(uri);
  if (file.exists) file.delete();
}
