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
