import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Tab } from '../browser/Tab';
import { fileNameFromUrl, mimeForName, safeFileName, siteOf, uniqueName } from '../device/download';
import { parseDataUrl } from '../device/saveImage';
import { Db } from './db';
import { stripDevice } from '../device/macDevice';
import type { DownloadBackend, DownloadItem, OpenResult, PageWriter, SaveResult, StartRequest } from './downloads';
import { offersSaveCopy, openSteps } from './openFileSteps';
import { reportStorageFailure } from './failures';
import { newId } from '../utils/ids';

/** modules/qutai-downloads/ios: Quick Look, the system's app for the type, the export picker (DL-19). Missing on a
 * binary built before it existed (an over-the-air update): Open then shares, as before, and "Save…" isn't offered. */
type NativeFileOpener = {
  canPreview(uri: string): boolean;
  preview(uri: string): Promise<'shown' | 'unsupported' | 'gone'>;
  openInApp(uri: string): Promise<boolean>;
  saveCopy(uri: string): Promise<'saved' | 'cancelled' | 'gone' | 'failed'>;
};
const fileOpener = requireOptionalNativeModule<NativeFileOpener>('QutaiFileOpener');

/** Files larger than this are downloaded directly instead of through the page (which holds them in memory). */
const PAGE_FETCH_MAX_BYTES = 25e6;
/** Progress redraws at most this often. */
const PROGRESS_EMIT_MS = 250;

type Row = { id: string; url: string; name: string; uri: string; size: number | null; created_at: number };

async function listRows(db: Db): Promise<Row[]> {
  return db.getAllAsync<Row>('SELECT * FROM downloads ORDER BY created_at DESC', []);
}

async function addRow(db: Db, item: DownloadItem): Promise<void> {
  await db.runAsync('INSERT INTO downloads (id, url, name, uri, size, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    item.id,
    item.url,
    item.name,
    item.uri,
    item.total,
    item.createdAt,
  ]);
}

async function removeRow(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM downloads WHERE id = ?', [id]);
}

function downloadsDir(): Directory {
  const dir = new Directory(Paths.document, 'Downloads');
  if (!dir.exists) dir.create({ idempotent: true });
  return dir;
}

const newDownloadId = () => newId(4);

function doneItem(r: Row): DownloadItem {
  return {
    id: r.id,
    url: r.url,
    name: r.name,
    mime: mimeForName(r.name),
    site: siteOf(r.url),
    state: 'done',
    received: r.size ?? 0,
    total: r.size,
    speed: null,
    error: null,
    restarted: null,
    uri: r.uri,
    createdAt: r.created_at,
    finishedAt: r.created_at,
    incognito: false,
    resumable: false,
    missing: false,
  };
}

/** Settles like promise, or rejects as soon as signal is aborted (the promise's result is then ignored). */
function unlessAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('cancelled'));
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * iOS: downloads into Qutai's own Downloads folder (Files › On My iPhone isn't used: the screen shares or saves them).
 * The page fetches a file first, with the site's cookies, so downloads behind a login work; larger files (or when the
 * page can't) are downloaded directly with progress. Cancel only: expo-file-system's download has no resume, so
 * there is no pause on iOS. Finished downloads are kept in the database (incognito ones only in memory), failed ones
 * stay in the list (memory) until removed.
 */
export class IosDownloads implements DownloadBackend {
  readonly canPause = false;
  readonly canShowFolder = false;
  readonly canSaveCopy = fileOpener != null && offersSaveCopy(stripDevice);
  private items: DownloadItem[] = [];
  private controllers = new Map<string, AbortController>();
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;
  private lastEmit = 0;

  constructor(private getDb: () => Promise<Db>) {}

  load(): Promise<void> {
    this.loading ??= this.getDb()
      .then(listRows)
      .then((rows) => {
        const known = new Set(this.items.map((e) => e.id));
        this.items = [...this.items, ...rows.filter((r) => !known.has(r.id)).map(doneItem)].sort(
          (a, b) => b.createdAt - a.createdAt,
        );
        this.emit();
      })
      .catch((e) => {
        // The Downloads screen would look empty: told, and tried again next time.
        this.loading = null;
        reportStorageFailure('downloads.load', e, 'user');
      });
    return this.loading;
  }

  list() {
    return this.items;
  }

  private update(id: string, patch: Partial<DownloadItem>, throttle = false) {
    this.items = this.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    if (throttle) {
      const now = Date.now();
      if (now - this.lastEmit < PROGRESS_EMIT_MS) return;
      this.lastEmit = now;
    }
    this.emit();
  }

  private begin(tab: Tab, url: string, name: string, mime: string | null, total: number | null): DownloadItem {
    const item: DownloadItem = {
      id: newDownloadId(),
      url,
      name,
      mime: mime ?? mimeForName(name),
      site: siteOf(/^https?:/i.test(url) ? url : tab.url),
      state: 'downloading',
      received: 0,
      total,
      speed: null,
      error: null,
      restarted: null,
      uri: null,
      createdAt: Date.now(),
      finishedAt: null,
      incognito: tab.incognito,
      resumable: false,
      missing: false,
    };
    this.items = [item, ...this.items];
    this.emit();
    return item;
  }

  private async finish(id: string, file: File) {
    const patch: Partial<DownloadItem> = {
      state: 'done',
      uri: file.uri,
      total: file.size ?? null,
      received: file.size ?? 0,
      finishedAt: Date.now(),
      speed: null,
    };
    this.update(id, patch);
    const item = this.items.find((i) => i.id === id);
    if (item && !item.incognito)
      await this.getDb()
        .then((db) => addRow(db, item))
        .catch((e) => reportStorageFailure('downloads.add', e, 'record'));
  }

  private fail(id: string, file: File | null, error: string) {
    if (file?.exists) file.delete();
    this.update(id, { state: 'failed', error, speed: null });
  }

  async start(request: StartRequest): Promise<string> {
    const { tab, url } = request;
    const dir = downloadsDir();
    const name = uniqueName(safeFileName(request.name || fileNameFromUrl(url)), (n) => new File(dir, n).exists);
    const file = new File(dir, name);
    const item = this.begin(tab, url, name, request.mime ?? null, request.length ?? null);
    const controller = new AbortController();
    this.controllers.set(item.id, controller);
    const { signal } = controller;
    let started = Date.now();
    (async () => {
      try {
        const data = /^https?:/i.test(url)
          ? await unlessAborted(tab.run<string>('fileData', [url], 60000), signal).catch((e) => {
              if (signal.aborted) throw e;
              return null;
            })
          : null;
        const parsed = data ? parseDataUrl(data) : null;
        if (parsed && parsed.base64.length * 0.75 <= PAGE_FETCH_MAX_BYTES) {
          await file.write(parsed.base64, { encoding: 'base64' });
        } else {
          started = Date.now();
          await File.downloadFileAsync(url, file, {
            signal,
            onProgress: ({ bytesWritten, totalBytes }) => {
              const seconds = (Date.now() - started) / 1000;
              this.update(
                item.id,
                {
                  received: bytesWritten,
                  total: totalBytes > 0 ? totalBytes : null,
                  speed: seconds > 1 ? bytesWritten / seconds : null,
                },
                true,
              );
            },
          });
        }
        await this.finish(item.id, file);
      } catch {
        if (signal.aborted) {
          if (file.exists) file.delete();
          this.items = this.items.filter((i) => i.id !== item.id);
          this.emit();
        } else {
          this.fail(item.id, file, 'network');
        }
      } finally {
        this.controllers.delete(item.id);
      }
    })();
    return item.id;
  }

  async beginPage(meta: { tab: Tab; name: string; mime: string | null; total: number | null }): Promise<PageWriter> {
    const dir = downloadsDir();
    const name = uniqueName(safeFileName(meta.name), (n) => new File(dir, n).exists);
    const file = new File(dir, name);
    const item = this.begin(meta.tab, meta.tab.url, name, meta.mime, meta.total);
    const controller = new AbortController();
    this.controllers.set(item.id, controller);
    file.create();
    const handle = file.open();
    let received = 0;
    const close = () => {
      try {
        handle.close();
      } catch {
        // Already closed.
      }
      this.controllers.delete(item.id);
    };
    return {
      id: item.id,
      write: async (base64) => {
        if (controller.signal.aborted) return false;
        const bytes = base64ToBytes(base64);
        await handle.writeBytes(bytes);
        received += bytes.length;
        this.update(item.id, { received }, true);
        return true;
      },
      end: async () => {
        close();
        if (controller.signal.aborted) return false;
        await this.finish(item.id, file);
        return true;
      },
      fail: async (code) => {
        close();
        this.fail(item.id, file, code);
      },
    };
  }

  pause() {}
  resume() {}
  retry() {}
  pauseAll() {}
  resumeAll() {}

  cancel(id: string) {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.abort();
      // Page writes stop at their next chunk; the entry goes now.
      const item = this.items.find((i) => i.id === id);
      if (item?.state === 'downloading') {
        this.items = this.items.filter((i) => i.id !== id);
        this.emit();
      }
    }
  }

  async remove(id: string) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    if (item.state === 'downloading') return this.cancel(id);
    this.items = this.items.filter((i) => i.id !== id);
    this.emit();
    if (item.state === 'done' && !item.incognito) await removeRow(await this.getDb(), id);
  }

  async deleteFile(id: string) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return false;
    if (item.uri) {
      const file = new File(item.uri);
      if (file.exists) file.delete();
    }
    await this.remove(id);
    return true;
  }

  async clearFinished() {
    const finished = this.items.filter((i) => i.state === 'done' || i.state === 'failed');
    this.items = this.items.filter((i) => !(i.state === 'done' || i.state === 'failed'));
    this.emit();
    const db = await this.getDb();
    for (const item of finished) if (item.state === 'done' && !item.incognito) await removeRow(db, item.id);
  }

  /** Clear browsing data: on iOS the files are Qutai's own, so they go too (as before). */
  async clearAll() {
    for (const id of [...this.controllers.keys()]) this.cancel(id);
    for (const item of [...this.items]) await this.deleteFile(item.id);
  }

  forgetIncognito() {
    for (const item of this.items.filter((i) => i.incognito)) {
      if (item.state === 'downloading') this.cancel(item.id);
    }
    this.items = this.items.filter((i) => !i.incognito);
    this.emit();
  }

  /** iPhone: the share sheet. iPad: Quick Look. Mac: the Mac's app for the type, else Quick Look (DL-19). */
  async open(id: string): Promise<OpenResult> {
    const item = this.items.find((i) => i.id === id);
    if (!item?.uri || !new File(item.uri).exists) return 'gone';
    const uri = item.uri;
    const canPreview = fileOpener ? safely(() => fileOpener.canPreview(uri), false) : false;
    for (const step of fileOpener ? openSteps(stripDevice, canPreview) : ['share']) {
      if (step === 'app' && (await fileOpener!.openInApp(uri).catch(() => false))) return 'opened';
      if (step === 'preview' && (await fileOpener!.preview(uri).catch(() => 'failed')) === 'shown') return 'opened';
      if (step === 'share') return this.share(id, '');
    }
    return 'failed';
  }

  async saveCopy(id: string): Promise<SaveResult> {
    const item = this.items.find((i) => i.id === id);
    if (!item?.uri || !new File(item.uri).exists) return 'gone';
    if (!fileOpener) return 'failed';
    return fileOpener.saveCopy(item.uri);
  }

  async share(id: string, title: string): Promise<OpenResult> {
    const item = this.items.find((i) => i.id === id);
    if (!item?.uri || !new File(item.uri).exists) return 'gone';
    await Sharing.shareAsync(item.uri, { dialogTitle: title || item.name });
    return 'opened';
  }

  async showFolder() {
    return false;
  }

  seen() {}

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}
