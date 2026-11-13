import { isSiteLevel, SiteLevel, SitePolicy } from '../agent/sitePolicy';
import { Db } from './db';

export type SitePermission = { host: string; level: SiteLevel; updatedAt: number };

export async function listSitePermissions(db: Db): Promise<SitePermission[]> {
  const rows = await db.getAllAsync<{ host: string; level: string; updated_at: number }>(
    'SELECT * FROM site_permissions ORDER BY host',
    [],
  );
  return rows.flatMap((r) => (isSiteLevel(r.level) ? [{ host: r.host, level: r.level, updatedAt: r.updated_at }] : []));
}

/** Saves a site's level; 'default' removes the entry. */
export async function setSitePermission(db: Db, host: string, level: SiteLevel): Promise<void> {
  if (level === 'default') {
    await db.runAsync('DELETE FROM site_permissions WHERE host = ?', [host]);
    return;
  }
  await db.runAsync(
    'INSERT INTO site_permissions (host, level, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(host) DO UPDATE SET level = excluded.level, updated_at = excluded.updated_at',
    [host, level, Date.now()],
  );
}

/**
 * Site permissions with an in-memory copy, so the agent can check them synchronously.
 * Listeners are told about changes (for screens showing them).
 */
export class SitePermissionStore implements SitePolicy {
  private levels = new Map<string, SiteLevel>();
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;

  constructor(private getDb: () => Promise<Db>) {}

  load(): Promise<void> {
    this.loading ??= this.getDb()
      .then(listSitePermissions)
      .then((list) => {
        // Changes made while loading win over what was on disk.
        for (const p of list) if (!this.levels.has(p.host)) this.levels.set(p.host, p.level);
        this.emit();
      })
      .catch(() => {});
    return this.loading;
  }

  levelFor(host: string): SiteLevel {
    return this.levels.get(host) ?? 'default';
  }

  list(): { host: string; level: SiteLevel }[] {
    return [...this.levels].map(([host, level]) => ({ host, level })).sort((a, b) => a.host.localeCompare(b.host));
  }

  async set(host: string, level: SiteLevel): Promise<void> {
    if (level === 'default') this.levels.delete(host);
    else this.levels.set(host, level);
    this.emit();
    await setSitePermission(await this.getDb(), host, level);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }
}
