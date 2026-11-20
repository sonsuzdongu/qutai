import { isSiteLevel, PersonalSetting, SiteLevel, SitePolicy } from '../agent/sitePolicy';
import { Db } from './db';
import { siteKeyOfHost } from '../utils/webUrl';
import { reportStorageFailure } from './failures';

export type SitePermission = { host: string; level: SiteLevel; updatedAt: number };

/** Whether a site itself may use something on the phone (location, camera…). 'ask' (the default) is not stored. */
export type PermissionSetting = 'ask' | 'allow' | 'block';

export const PERMISSION_SETTINGS: PermissionSetting[] = ['ask', 'allow', 'block'];

/** Whether a site itself may use the user's location. */
export type LocationSetting = PermissionSetting;

export const LOCATION_SETTINGS = PERMISSION_SETTINGS;

/** What a page can capture with getUserMedia; each has its own per-site setting. */
export type MediaKind = 'camera' | 'microphone';

export const MEDIA_KINDS: MediaKind[] = ['camera', 'microphone'];

export function isPermissionSetting(value: unknown): value is PermissionSetting {
  return typeof value === 'string' && (PERMISSION_SETTINGS as string[]).includes(value);
}

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === 'string' && (MEDIA_KINDS as string[]).includes(value);
}

export async function listLocationSettings(db: Db): Promise<{ host: string; setting: LocationSetting }[]> {
  const rows = await db.getAllAsync<{ host: string; setting: string }>('SELECT host, setting FROM site_location', []);
  return rows.flatMap((r) => (isPermissionSetting(r.setting) ? [{ host: r.host, setting: r.setting }] : []));
}

export async function listMediaSettings(
  db: Db,
): Promise<{ host: string; kind: MediaKind; setting: PermissionSetting }[]> {
  const rows = await db.getAllAsync<{ host: string; kind: string; setting: string }>(
    'SELECT host, kind, setting FROM site_media',
    [],
  );
  return rows.flatMap((r) =>
    isMediaKind(r.kind) && isPermissionSetting(r.setting) ? [{ host: r.host, kind: r.kind, setting: r.setting }] : [],
  );
}

/** Saves whether a site may use the camera or the microphone; 'ask' removes the entry. */
export async function setMediaSetting(db: Db, host: string, kind: MediaKind, setting: PermissionSetting): Promise<void> {
  if (setting === 'ask') {
    await db.runAsync('DELETE FROM site_media WHERE host = ? AND kind = ?', [host, kind]);
    return;
  }
  await db.runAsync(
    'INSERT INTO site_media (host, kind, setting, updated_at) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(host, kind) DO UPDATE SET setting = excluded.setting, updated_at = excluded.updated_at',
    [host, kind, setting, Date.now()],
  );
}

export async function listPersonalSettings(db: Db): Promise<{ host: string; setting: PersonalSetting }[]> {
  const rows = await db.getAllAsync<{ host: string; setting: string }>('SELECT host, setting FROM site_personal', []);
  return rows.flatMap((r) => (isPermissionSetting(r.setting) ? [{ host: r.host, setting: r.setting }] : []));
}

/** Saves whether the assistant may enter personal details on a site; 'ask' removes the entry. */
export async function setPersonalSetting(db: Db, host: string, setting: PersonalSetting): Promise<void> {
  if (setting === 'ask') {
    await db.runAsync('DELETE FROM site_personal WHERE host = ?', [host]);
    return;
  }
  await db.runAsync(
    'INSERT INTO site_personal (host, setting, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(host) DO UPDATE SET setting = excluded.setting, updated_at = excluded.updated_at',
    [host, setting, Date.now()],
  );
}

/** Sites where network ad and tracker blocking is off. */
export async function listBlockingOff(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ host: string }>('SELECT host FROM site_blocking ORDER BY host', []);
  return rows.map((r) => r.host);
}

/** Turns ad and tracker blocking off (or back on) for one site. */
export async function setBlockingOff(db: Db, host: string, off: boolean): Promise<void> {
  if (!off) {
    await db.runAsync('DELETE FROM site_blocking WHERE host = ?', [host]);
    return;
  }
  await db.runAsync(
    'INSERT INTO site_blocking (host, updated_at) VALUES (?, ?) ON CONFLICT(host) DO UPDATE SET updated_at = excluded.updated_at',
    [host, Date.now()],
  );
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

/** A site with its own setting: what the assistant may do there, and what the site itself may use. */
export type SiteEntry = {
  host: string;
  level: SiteLevel;
  location: LocationSetting;
  camera: PermissionSetting;
  microphone: PermissionSetting;
  /** Ad and tracker blocking is on for this site (the default). */
  blocking: boolean;
  /** Whether the assistant may enter the user's remembered personal details here. */
  personal: PersonalSetting;
};

/**
 * Site permissions with an in-memory copy, so the agent can check them synchronously.
 * Also holds each site's location, camera and microphone settings (whether the site itself may
 * use them). Listeners are told about changes (for screens showing them, and pages capturing).
 */
export class SitePermissionStore implements SitePolicy {
  private levels = new Map<string, SiteLevel>();
  private locations = new Map<string, LocationSetting>();
  /** Keyed `${kind} ${host}`. */
  private media = new Map<string, PermissionSetting>();
  private personal = new Map<string, PersonalSetting>();
  /** Sites where ad and tracker blocking is off ("Don't block on this site"). */
  private blockingOff = new Set<string>();
  /** Changes made before loading finished: they win over what was on disk. */
  private blockingTouched = new Set<string>();
  /** The same, sorted; a new array only when it changes (a WebView prop). */
  private blockingOffList: string[] = [];
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;

  constructor(private getDb: () => Promise<Db>) {}

  load(): Promise<void> {
    this.loading ??= this.getDb()
      .then((db) =>
        Promise.all([
          listSitePermissions(db),
          listLocationSettings(db),
          listMediaSettings(db),
          listBlockingOff(db),
          listPersonalSettings(db),
        ]),
      )
      .then(([list, locations, media, blockingOff, personal]) => {
        // Changes made while loading win over what was on disk. Stored hosts are read as siteKey makes them now
        // (utils/webUrl.ts, SITE-25: punycode, no trailing dot), so an older key still matches its site.
        const key = (host: string) => siteKeyOfHost(host) ?? host;
        for (const p of list) if (!this.levels.has(key(p.host))) this.levels.set(key(p.host), p.level);
        for (const l of locations) if (!this.locations.has(key(l.host))) this.locations.set(key(l.host), l.setting);
        for (const p of personal) if (!this.personal.has(key(p.host))) this.personal.set(key(p.host), p.setting);
        for (const m of media) {
          const k = `${m.kind} ${key(m.host)}`;
          if (!this.media.has(k)) this.media.set(k, m.setting);
        }
        for (const host of blockingOff) if (!this.blockingTouched.has(key(host))) this.blockingOff.add(key(host));
        this.blockingOffList = [...this.blockingOff].sort();
        this.unreadable = false;
        this.emit();
      })
      .catch((e) => {
        // Not knowing which sites the user blocked is not "none": until the permissions are read, every site
        // without a level in memory is 'ask' (the assistant asks before acting), the user is told, and the next
        // load tries again (DATA-26).
        this.unreadable = true;
        this.loading = null;
        reportStorageFailure('sitePermissions.load', e, 'user');
        this.emit();
      });
    return this.loading;
  }

  /** The stored permissions couldn't be read (load failed): unknown sites are asked about. */
  private unreadable = false;

  levelFor(host: string): SiteLevel {
    return this.levels.get(host) ?? (this.unreadable ? 'ask' : 'default');
  }

  locationFor(host: string): LocationSetting {
    return this.locations.get(host) ?? 'ask';
  }

  personalFor(host: string): PersonalSetting {
    return this.personal.get(host) ?? 'ask';
  }

  async setPersonal(host: string, setting: PersonalSetting): Promise<void> {
    if (setting === 'ask') this.personal.delete(host);
    else this.personal.set(host, setting);
    this.emit();
    await setPersonalSetting(await this.getDb(), host, setting);
  }

  mediaFor(host: string, kind: MediaKind): PermissionSetting {
    return this.media.get(`${kind} ${host}`) ?? 'ask';
  }

  /** Whether ad and tracker blocking is on for this site (sites are keyed without "www."). */
  blockingFor(host: string): boolean {
    return !this.blockingOff.has(host);
  }

  /** The sites where blocking is off, sorted (for the WebViews; their subdomains count too). */
  blockingOffSites(): string[] {
    return this.blockingOffList;
  }

  async setBlocking(host: string, on: boolean): Promise<void> {
    this.blockingTouched.add(host);
    if (on) this.blockingOff.delete(host);
    else this.blockingOff.add(host);
    this.blockingOffList = [...this.blockingOff].sort();
    this.emit();
    await setBlockingOff(await this.getDb(), host, !on);
  }

  /** Every site with an assistant level, a personal-information, location, camera or microphone setting of its own. */
  list(): SiteEntry[] {
    const hosts = new Set([
      ...this.levels.keys(),
      ...this.locations.keys(),
      ...[...this.media.keys()].map((key) => key.slice(key.indexOf(' ') + 1)),
      ...this.blockingOff,
      ...this.personal.keys(),
    ]);
    return [...hosts]
      .map((host) => ({
        host,
        level: this.levelFor(host),
        location: this.locationFor(host),
        camera: this.mediaFor(host, 'camera'),
        microphone: this.mediaFor(host, 'microphone'),
        blocking: this.blockingFor(host),
        personal: this.personalFor(host),
      }))
      .sort((a, b) => a.host.localeCompare(b.host));
  }

  async setMedia(host: string, kind: MediaKind, setting: PermissionSetting): Promise<void> {
    if (setting === 'ask') this.media.delete(`${kind} ${host}`);
    else this.media.set(`${kind} ${host}`, setting);
    this.emit();
    await setMediaSetting(await this.getDb(), host, kind, setting);
  }

  async setLocation(host: string, setting: LocationSetting): Promise<void> {
    if (setting === 'ask') this.locations.delete(host);
    else this.locations.set(host, setting);
    this.emit();
    await setLocationSetting(await this.getDb(), host, setting);
  }

  /** Back to the defaults for everything on this site. */
  async reset(host: string): Promise<void> {
    await Promise.all([
      this.set(host, 'default'),
      this.setLocation(host, 'ask'),
      ...MEDIA_KINDS.map((kind) => this.setMedia(host, kind, 'ask')),
      this.setBlocking(host, true),
      this.setPersonal(host, 'ask'),
    ]);
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
