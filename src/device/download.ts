import { Directory, File, Paths } from 'expo-file-system';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import type { DownloadEntry, DownloadStore } from '../storage/downloads';
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

/** The user cancelled a download; nothing was kept. */
export class DownloadCancelled extends Error {
  constructor() {
    super(t('downloads.cancelled'));
  }
}

/** Settles like promise, or rejects as soon as signal is aborted (the promise's result is then ignored). */
function unlessAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DownloadCancelled());
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/**
 * Downloads a file the WebView couldn't show (iOS). The page fetches it first, with the
 * site's cookies, so downloads behind a login work; otherwise it is downloaded directly.
 * Meanwhile it is listed in the store's downloads in progress (with its progress when downloaded
 * directly) and can be cancelled from there: the partial file is then removed and
 * DownloadCancelled is thrown.
 */
export async function downloadFile(tab: Tab, url: string, store: DownloadStore): Promise<DownloadEntry> {
  const dir = downloadsDir();
  const name = uniqueName(fileNameFromUrl(url), (n) => new File(dir, n).exists);
  const file = new File(dir, name);
  const active = store.begin(name);
  const { signal } = active.controller;
  try {
    const data = /^https?:/i.test(url)
      ? await unlessAborted(tab.run<string>('fileData', [url], 60000), signal).catch((e) => {
          if (e instanceof DownloadCancelled) throw e;
          return null;
        })
      : null;
    const parsed = data ? parseDataUrl(data) : null;
    if (parsed && parsed.base64.length * 0.75 <= PAGE_FETCH_MAX_BYTES) {
      await file.write(parsed.base64, { encoding: 'base64' });
    } else {
      await File.downloadFileAsync(url, file, {
        signal,
        onProgress: ({ bytesWritten, totalBytes }) => store.progress(active.id, bytesWritten, totalBytes),
      });
    }
  } catch (e) {
    // Whatever was written so far goes (the name was free when the download started).
    if (file.exists) file.delete();
    throw signal.aborted ? new DownloadCancelled() : e;
  } finally {
    store.end(active.id);
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
