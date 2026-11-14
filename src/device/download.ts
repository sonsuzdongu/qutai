import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import type { DownloadEntry, DownloadStore } from '../storage/downloads';
import { parseDataUrl } from './saveImage';

/** Files larger than this are downloaded directly instead of through the page (which holds them in memory). */
const PAGE_FETCH_MAX_BYTES = 25e6;

/** A file name safe on both platforms: no path separators or reserved characters, at most 120 characters. */
export function safeFileName(raw: string, fallback = 'download'): string {
  const clean = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim();
  return clean || fallback;
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
export async function downloadFile(
  tab: Tab,
  url: string,
  store: DownloadStore,
  suggestedName?: string,
): Promise<DownloadEntry> {
  const dir = downloadsDir();
  const name = uniqueName(suggestedName || fileNameFromUrl(url), (n) => new File(dir, n).exists);
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

type AgentDownloadModule = {
  download?: (
    key: string,
    url: string,
    fileName: string,
    mimeType: string,
    downloading: string,
    noPermission: string,
  ) => Promise<'started' | 'permission' | 'noWebView'>;
};

const agentNative = Platform.OS === 'android' ? requireOptionalNativeModule<AgentDownloadModule>('QutaiAgent') : null;

/**
 * Starts a download the assistant asked for and the user confirmed, the way the tab's own downloads go and without
 * waiting for it: iOS into Qutai's Downloads (with progress and cancel; `notify` reports how it ended), Android
 * through the system download manager with the tab's cookies. The file is never opened. Resolves "permission" when
 * Android 9 and older asks for storage first (the download starts if the user allows it).
 */
export async function startAgentDownload(
  tab: Tab,
  url: string,
  name: string,
  type: string | null,
  store: DownloadStore,
  notify: (message: string) => void,
): Promise<'started' | 'permission'> {
  if (Platform.OS === 'android') {
    if (!agentNative?.download) throw new Error('Downloads by the assistant need a newer build of Qutai on Android.');
    const status = await agentNative.download(
      tab.playback.nonce,
      url,
      name,
      type ?? '',
      t('downloads.androidStarted'),
      t('downloads.androidNoPermission'),
    );
    if (status === 'noWebView') throw new Error('The tab is not ready; open the page and try again.');
    return status;
  }
  downloadFile(tab, url, store, name).then(
    async (entry) => {
      await store.add(entry);
      notify(t('downloads.done', { name: entry.name }));
    },
    (e) => notify(e instanceof DownloadCancelled ? e.message : t('downloads.failed', { name })),
  );
  return 'started';
}
