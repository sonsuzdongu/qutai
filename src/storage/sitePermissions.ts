import { isSiteLevel, SiteLevel, SitePolicy } from '../agent/sitePolicy';
import { Db } from './db';

export type SitePermission = { host: string; level: SiteLevel; updatedAt: number };

/** Whether a site itself may use the user's location. 'ask' (the default) is not stored. */
export type LocationSetting = 'ask' | 'allow' | 'block';

export const LOCATION_SETTINGS: LocationSetting[] = ['ask', 'allow', 'block'];

function isLocationSetting(value: unknown): value is LocationSetting {
  return typeof value === 'string' && (LOCATION_SETTINGS as string[]).includes(value);
}

export async function listLocationSettings(db: Db): Promise<{ host: string; setting: LocationSetting }[]> {
  const rows = await db.getAllAsync<{ host: string; setting: string }>('SELECT host, setting FROM site_location', []);
  return rows.flatMap((r) => (isLocationSetting(r.setting) ? [{ host: r.host, setting: r.setting }] : []));
}

/** Saves a site's location setting; 'ask' removes the entry. */
export async function setLocationSetting(db: Db, host: string, setting: LocationSetting): Promise<void> {
  if (setting === 'ask') {
    await db.runAsync('DELETE FROM site_location WHERE host = ?', [host]);
    return;
  }
  await db.runAsync(
    'INSERT INTO site_location (host, setting, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(host) DO UPDATE SET setting = excluded.setting, updated_at = excluded.updated_at',
    [host, setting, Date.now()],
  );
}

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

/** A site with its own setting: what the assistant may do there and/or whether it may use the location. */
export type SiteEntry = { host: string; level: SiteLevel; location: LocationSetting };

/**
 * Site permissions with an in-memory copy, so the agent can check them synchronously.
 * Also holds each site's location setting (whether the site itself may use the location).
 * Listeners are told about changes (for screens showing them).
 */
export class SitePermissionStore implements SitePolicy {
  private levels = new Map<string, SiteLevel>();
  private locations = new Map<string, LocationSetting>();
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;

  constructor(private getDb: () => Promise<Db>) {}

  load(): Promise<void> {
    this.loading ??= this.getDb()
      .then((db) => Promise.all([listSitePermissions(db), listLocationSettings(db)]))
      .then(([list, locations]) => {
        // Changes made while loading win over what was on disk.
        for (const p of list) if (!this.levels.has(p.host)) this.levels.set(p.host, p.level);
        for (const l of locations) if (!this.locations.has(l.host)) this.locations.set(l.host, l.setting);
        this.emit();
      })
      .catch(() => {});
    return this.loading;
  }

  levelFor(host: string): SiteLevel {
    return this.levels.get(host) ?? 'default';
  }

  locationFor(host: string): LocationSetting {
    return this.locations.get(host) ?? 'ask';
  }

  /** Every site with an assistant level or a location setting of its own. */
  list(): SiteEntry[] {
    const hosts = new Set([...this.levels.keys(), ...this.locations.keys()]);
    return [...hosts]
      .map((host) => ({ host, level: this.levelFor(host), location: this.locationFor(host) }))
      .sort((a, b) => a.host.localeCompare(b.host));
  }

  async setLocation(host: string, setting: LocationSetting): Promise<void> {
    if (setting === 'ask') this.locations.delete(host);
    else this.locations.set(host, setting);
    this.emit();
    await setLocationSetting(await this.getDb(), host, setting);
  }

  /** Back to the defaults for everything on this site. */
  async reset(host: string): Promise<void> {
    await Promise.all([this.set(host, 'default'), this.setLocation(host, 'ask')]);
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

  /** Changes on every update, for useSyncExternalStore. */
  version = 0;

  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
}
