import type { Tab } from '../browser/Tab';

/**
 * Downloads, one model for both platforms. Two back ends do the work: iOS downloads in the app
 * (src/storage/iosDownloads.ts, files in Qutai's own storage, cancel only), Android in the native module
 * modules/qutai-downloads (src/storage/androidDownloads.ts, files in the public Downloads folder, pause / resume /
 * retry, background with a notification). The Downloads screen, the download indicator, the assistant's
 * download_file and "Clear browsing data" only talk to {@link DownloadStore}.
 *
 * Incognito (both platforms): a download from an incognito tab is listed only while the incognito session lasts and
 * never written to the database or the native list file; when the session ends (the last incognito tab closes) its
 * finished downloads leave the list and unfinished ones are cancelled. The finished files themselves stay: the user
 * asked for them.
 */

export type DownloadState = 'queued' | 'downloading' | 'paused' | 'waiting' | 'failed' | 'done' | 'interrupted';

export type DownloadItem = {
  id: string;
  /** Where it came from (http(s); "blob:"/"data:" ones show their page's site). */
  url: string;
  name: string;
  mime: string | null;
  /** Site shown in the list. */
  site: string;
  state: DownloadState;
  received: number;
  /** null while the size isn't known. */
  total: number | null;
  /** Bytes per second while downloading, when known. */
  speed: number | null;
  /** Why it failed: "network", "http:404", "space", "file", "size", "interrupted", "unsupported", "redirects". */
  error: string | null;
  /** It started again from zero: the server can't resume ("noRange") or the file changed ("changed"). */
  restarted: 'noRange' | 'changed' | null;
  /** The finished file (iOS: file://, Android: content://). */
  uri: string | null;
  createdAt: number;
  finishedAt: number | null;
  incognito: boolean;
  /** Pause / resume / retry work (Android http downloads). */
  resumable: boolean;
  /** Finished, but the file was deleted elsewhere (Android file managers). */
  missing: boolean;
};

export const ACTIVE_STATES: ReadonlySet<DownloadState> = new Set(['queued', 'downloading', 'paused', 'waiting']);

export const isActive = (item: DownloadItem) => ACTIVE_STATES.has(item.state);

/** What a download starts from: the tab (cookies, profile, incognito) and what the page or the user said. */
export type StartRequest = {
  tab: Tab;
  url: string;
  /** The suggested name (Content-Disposition or the URL's last segment, made safe). */
  name: string;
  /** The name came from the server's Content-Disposition: response headers don't rename it. */
  nameFixed?: boolean;
  mime?: string | null;
  length?: number | null;
  userAgent?: string | null;
};

/** A blob: / data: download the app writes itself, chunk by chunk (the page holds the bytes). */
export type PageWriter = {
  id: string;
  /** False when the download was cancelled meanwhile: stop sending. */
  write(base64: string): Promise<boolean>;
  end(): Promise<boolean>;
  fail(code: string): Promise<void>;
};

export type OpenResult = 'opened' | 'noApp' | 'gone';

export interface DownloadBackend {
  /** Pause / resume / retry exist. */
  readonly canPause: boolean;
  /** "Show in folder" exists (Android: the system's Downloads view). */
  readonly canShowFolder: boolean;
  load(): Promise<void>;
  list(): DownloadItem[];
  start(request: StartRequest): Promise<string>;
  beginPage(meta: { tab: Tab; name: string; mime: string | null; total: number | null }): Promise<PageWriter>;
  pause(id: string): void;
  resume(id: string): void;
  retry(id: string): void;
  cancel(id: string): void;
  pauseAll(): void;
  resumeAll(): void;
  /** Off the list; the file stays. */
  remove(id: string): Promise<void>;
  /** The file and its entry. */
  deleteFile(id: string): Promise<boolean>;
  clearFinished(): Promise<void>;
  /** Clear browsing data › Downloads. */
  clearAll(): Promise<void>;
  forgetIncognito(): void;
  open(id: string): Promise<OpenResult>;
  share(id: string, title: string): Promise<OpenResult>;
  showFolder(): Promise<boolean>;
  /** The screen is open (Android: the finished-download notifications go). */
  seen(): void;
  subscribe(listener: () => void): () => void;
}

/** A download's state changed to done or failed (for the app's toast). */
export type Finished = { item: DownloadItem };

/** The app's downloads: a thin layer over the platform's back end, with change listeners for React. */
export class DownloadStore {
  private listeners = new Set<() => void>();
  private finishedListeners = new Set<(item: DownloadItem) => void>();
  private version = 0;
  private items: DownloadItem[] = [];
  private states = new Map<string, DownloadState>();

  constructor(readonly backend: DownloadBackend) {
    backend.subscribe(() => this.refresh());
  }

  get canPause() {
    return this.backend.canPause;
  }

  get canShowFolder() {
    return this.backend.canShowFolder;
  }

  load(): Promise<void> {
    return this.backend.load().then(() => this.refresh());
  }

  /** Newest first. */
  list(): DownloadItem[] {
    return this.items;
  }

  /** Still going (or paused), oldest first. */
  activeList(): DownloadItem[] {
    return this.items.filter(isActive).reverse();
  }

  get(id: string) {
    return this.items.find((i) => i.id === id);
  }

  start(request: StartRequest) {
    return this.backend.start(request);
  }

  beginPage(meta: { tab: Tab; name: string; mime: string | null; total: number | null }) {
    return this.backend.beginPage(meta);
  }

  pause = (id: string) => this.backend.pause(id);
  resume = (id: string) => this.backend.resume(id);
  retry = (id: string) => this.backend.retry(id);
  cancel = (id: string) => this.backend.cancel(id);
  pauseAll = () => this.backend.pauseAll();
  resumeAll = () => this.backend.resumeAll();
  remove = (id: string) => this.backend.remove(id);
  deleteFile = (id: string) => this.backend.deleteFile(id);
  clearFinished = () => this.backend.clearFinished();
  clearAll = () => this.backend.clearAll();
  forgetIncognito = () => this.backend.forgetIncognito();
  open = (id: string) => this.backend.open(id);
  share = (id: string, title: string) => this.backend.share(id, title);
  showFolder = () => this.backend.showFolder();
  seen = () => this.backend.seen();

  /** Hears about every download that finishes or fails from now on. */
  onFinished(listener: (item: DownloadItem) => void) {
    this.finishedListeners.add(listener);
    return () => {
      this.finishedListeners.delete(listener);
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;

  private refresh() {
    this.items = this.backend.list();
    const next = new Map<string, DownloadState>();
    for (const item of this.items) {
      const before = this.states.get(item.id);
      if (before && before !== item.state && (item.state === 'done' || item.state === 'failed')) {
        this.finishedListeners.forEach((l) => l(item));
      }
      next.set(item.id, item.state);
    }
    this.states = next;
    this.version++;
    this.listeners.forEach((l) => l());
  }
}
