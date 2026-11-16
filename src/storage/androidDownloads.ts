import { requireOptionalNativeModule } from 'expo';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import { siteOf } from '../device/download';
import type { DownloadBackend, DownloadItem, OpenResult, PageWriter, StartRequest } from './downloads';

type Subscription = { remove(): void };

type NativeDownloads = {
  setLanguage(language: string): void;
  list(): DownloadItem[];
  refresh(): void;
  start(request: {
    url: string;
    name: string;
    nameFixed: boolean;
    mime: string | null;
    site: string;
    incognito: boolean;
    profile: string | null;
    userAgent: string | null;
    referrer: string | null;
    length: number;
  }): Promise<string>;
  beginWrite(name: string, mime: string | null, site: string, url: string, total: number, incognito: boolean): Promise<string>;
  writeChunk(id: string, base64: string): Promise<boolean>;
  endWrite(id: string): Promise<boolean>;
  failWrite(id: string, code: string): Promise<void>;
  pause(id: string): void;
  resume(id: string): void;
  retry(id: string): void;
  cancel(id: string): void;
  remove(id: string): void;
  pauseAll(): void;
  resumeAll(): void;
  clearFinished(): void;
  clearAll(): void;
  forgetIncognito(): void;
  isMetered(): boolean;
  seen(): void;
  deleteFile(id: string): Promise<boolean>;
  open(id: string): Promise<OpenResult>;
  share(id: string, title: string): Promise<'shared' | 'gone'>;
  showFolder(): Promise<boolean>;
  needsStoragePermission(): boolean;
  consumeOpenRequest(): boolean;
  /** Newer builds: the download whose "done" notification opened the app to open that file. */
  consumeOpenFileRequest?(): string | null;
  addListener(event: 'onChange', listener: (e: { items: DownloadItem[] }) => void): Subscription;
  addListener(event: 'onOpenRequested', listener: () => void): Subscription;
  addListener(event: 'onOpenFileRequested', listener: (e: { id: string }) => void): Subscription;
};

export const nativeDownloads = requireOptionalNativeModule<NativeDownloads>('QutaiDownloads');

/** The page's address without its fragment, as a browser sends it as the referrer (the engine trims it further). */
function referrerOf(tab: Tab): string | null {
  return /^https?:/i.test(tab.url) ? tab.url.split('#')[0] : null;
}

/**
 * Android: downloads done by Qutai itself (modules/qutai-downloads), into the public Downloads folder, with the tab's
 * cookies (its own WebView profile in incognito), pause / resume / retry, a notification and the background job.
 * The native side keeps the list (a JSON file; incognito entries only in memory) and sends every change.
 */
export class AndroidDownloads implements DownloadBackend {
  readonly canPause = true;
  readonly canShowFolder = true;
  private items: DownloadItem[] = [];
  private listeners = new Set<() => void>();

  constructor() {
    nativeDownloads?.addListener('onChange', ({ items }) => {
      this.items = items;
      this.emit();
    });
  }

  private get native(): NativeDownloads {
    if (!nativeDownloads) throw Object.assign(new Error('Downloads need a newer build of Qutai on Android.'), {
        userMessage: t('downloads.needsBuild'),
      });
    return nativeDownloads;
  }

  async load() {
    if (!nativeDownloads) return;
    this.items = nativeDownloads.list();
    nativeDownloads.refresh();
    this.emit();
  }

  list() {
    return this.items;
  }

  /** Android 9 and older ask for storage first (the app's caller requests it). */
  needsStoragePermission() {
    return nativeDownloads?.needsStoragePermission() ?? false;
  }

  start(request: StartRequest): Promise<string> {
    const { tab } = request;
    return this.native.start({
      url: request.url,
      name: request.name,
      nameFixed: !!request.nameFixed,
      mime: request.mime ?? null,
      site: siteOf(request.url),
      incognito: tab.incognito,
      profile: tab.profile ?? null,
      userAgent: request.userAgent ?? null,
      referrer: referrerOf(tab),
      length: request.length ?? -1,
    });
  }

  async beginPage(meta: { tab: Tab; name: string; mime: string | null; total: number | null }): Promise<PageWriter> {
    const native = this.native;
    const id = await native.beginWrite(
      meta.name,
      meta.mime,
      siteOf(meta.tab.url),
      // Blob addresses mean nothing later; the page's address is what the list shows and copies.
      meta.tab.url,
      meta.total ?? -1,
      meta.tab.incognito,
    );
    return {
      id,
      write: (base64) => native.writeChunk(id, base64),
      end: () => native.endWrite(id),
      fail: (code) => native.failWrite(id, code),
    };
  }

  pause = (id: string) => this.native.pause(id);
  resume = (id: string) => this.native.resume(id);
  retry = (id: string) => this.native.retry(id);
  cancel = (id: string) => this.native.cancel(id);
  pauseAll = () => this.native.pauseAll();
  resumeAll = () => this.native.resumeAll();

  async remove(id: string) {
    this.native.remove(id);
  }

  deleteFile(id: string) {
    return this.native.deleteFile(id);
  }

  async clearFinished() {
    this.native.clearFinished();
  }

  /** Clear browsing data: the list empties and running downloads stop; the files stay in the Downloads folder. */
  async clearAll() {
    this.native.clearAll();
  }

  forgetIncognito() {
    nativeDownloads?.forgetIncognito();
  }

  open(id: string) {
    return this.native.open(id);
  }

  async share(id: string, title: string): Promise<OpenResult> {
    return (await this.native.share(id, title)) === 'gone' ? 'gone' : 'opened';
  }

  showFolder() {
    return this.native.showFolder();
  }

  seen() {
    nativeDownloads?.seen();
    nativeDownloads?.refresh();
  }

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
