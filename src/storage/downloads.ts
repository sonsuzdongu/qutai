import { Db } from './db';

export type DownloadEntry = {
  id: string;
  url: string;
  name: string;
  /** Local file. */
  uri: string;
  size: number | null;
  createdAt: number;
  /** Downloaded from an incognito tab: listed for this session only, never written to the database. */
  incognito?: boolean;
};

/** A file still downloading (iOS): listed with its progress until it finishes, fails or is cancelled. */
export type ActiveDownload = {
  id: string;
  name: string;
  bytesWritten: number;
  /** null while the size isn't known (no Content-Length, or the page is still fetching it). */
  totalBytes: number | null;
  controller: AbortController;
};

/** Progress redraws at most this often. */
const PROGRESS_EMIT_MS = 250;

type Row = { id: string; url: string; name: string; uri: string; size: number | null; created_at: number };

export async function listDownloads(db: Db): Promise<DownloadEntry[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM downloads ORDER BY created_at DESC', []);
  return rows.map((r) => ({ id: r.id, url: r.url, name: r.name, uri: r.uri, size: r.size, createdAt: r.created_at }));
}

export async function addDownload(db: Db, d: DownloadEntry): Promise<void> {
  await db.runAsync('INSERT INTO downloads (id, url, name, uri, size, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    d.id,
    d.url,
    d.name,
    d.uri,
    d.size,
    d.createdAt,
  ]);
}

export async function removeDownload(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM downloads WHERE id = ?', [id]);
}

/** Downloaded files, newest first; incognito ones only in memory. Listeners hear about changes. */
export class DownloadStore {
  private entries: DownloadEntry[] = [];
  private active: ActiveDownload[] = [];
  private lastProgressEmit = 0;
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;
  private version = 0;

  constructor(private getDb: () => Promise<Db>) {}

  load(): Promise<void> {
    this.loading ??= this.getDb()
      .then(listDownloads)
      .then((saved) => {
        const known = new Set(this.entries.map((e) => e.id));
        this.entries = [...this.entries, ...saved.filter((e) => !known.has(e.id))].sort(
          (a, b) => b.createdAt - a.createdAt,
        );
        this.emit();
      })
      .catch(() => {});
    return this.loading;
  }

  list(): DownloadEntry[] {
    return this.entries;
  }

  /** Downloads in progress, oldest first. */
  activeList(): ActiveDownload[] {
    return this.active;
  }

  /** A download starts: it is listed with its progress until `end`. */
  begin(name: string): ActiveDownload {
    const entry: ActiveDownload = {
      id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name,
      bytesWritten: 0,
      totalBytes: null,
      controller: new AbortController(),
    };
    this.active = [...this.active, entry];
    this.emit();
    return entry;
  }

  progress(id: string, bytesWritten: number, totalBytes: number) {
    const now = Date.now();
    this.active = this.active.map((a) =>
      a.id === id ? { ...a, bytesWritten, totalBytes: totalBytes > 0 ? totalBytes : null } : a,
    );
    if (now - this.lastProgressEmit < PROGRESS_EMIT_MS) return;
    this.lastProgressEmit = now;
    this.emit();
  }

  /** Stops a download in progress; its partial file is removed by whoever started it. */
  cancel(id: string) {
    this.active.find((a) => a.id === id)?.controller.abort();
  }

  end(id: string) {
    this.active = this.active.filter((a) => a.id !== id);
    this.emit();
  }

  async add(entry: DownloadEntry): Promise<void> {
    this.entries = [entry, ...this.entries];
    this.emit();
    if (!entry.incognito) await addDownload(await this.getDb(), entry);
  }

  async remove(id: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === id);
    this.entries = this.entries.filter((e) => e.id !== id);
    this.emit();
    if (entry && !entry.incognito) await removeDownload(await this.getDb(), id);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;

  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
}
