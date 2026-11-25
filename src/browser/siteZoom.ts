import { useSyncExternalStore } from 'react';
import { getJson, setJson, withDb } from '../storage/db';
import { DEFAULT_ZOOM_LEVEL, SiteZoomLevels, stepZoom } from './pageZoom';

/**
 * The zoom level the user chose for each site (UI-84): kept on the phone (kv "site_zoom") for normal tabs, like
 * Safari's per-website zoom; incognito tabs start from it but what they change is kept in memory only and forgotten
 * when the app closes. Nothing leaves the phone and nothing is in backups.
 */
const KEY = 'site_zoom';

let saved = new SiteZoomLevels();
let incognito = new SiteZoomLevels();
/** Sites an incognito tab changed (its own level wins there, even back to 100%). */
const incognitoSites = new Set<string>();
let version = 0;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function changed() {
  version++;
  listeners.forEach((l) => l());
}

function load(): Promise<void> {
  loaded ??= withDb('siteZoom.load', async (db) => {
    const value = await getJson<unknown>(db, KEY);
    // A level set before loading finished wins over the saved one.
    const read = SiteZoomLevels.fromJson(value);
    for (const [site, level] of Object.entries(saved.toJson())) read.set(site, level);
    saved = read;
    changed();
  }).then(() => undefined);
  return loaded;
}

function persist() {
  const value = saved.toJson();
  void withDb('siteZoom.save', (db) => setJson(db, KEY, value));
}

export const siteZoom = {
  subscribe(listener: () => void) {
    void load();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getVersion: () => version,
  level(site: string | null, isIncognito: boolean): number {
    if (!site) return DEFAULT_ZOOM_LEVEL;
    if (isIncognito && incognitoSites.has(site)) return incognito.get(site);
    return saved.get(site);
  },
  set(site: string | null, isIncognito: boolean, level: number) {
    if (!site) return;
    if (isIncognito) {
      incognitoSites.add(site);
      incognito.set(site, level);
      changed();
      return;
    }
    if (saved.set(site, level)) {
      persist();
      changed();
    }
  },
  /** ⌘+ / ⌘−: one step from the site's level; returns the new level. */
  step(site: string | null, isIncognito: boolean, direction: 'in' | 'out'): number {
    const next = stepZoom(siteZoom.level(site, isIncognito), direction);
    siteZoom.set(site, isIncognito, next);
    return next;
  },
  /** The incognito session ended: its levels are forgotten. */
  clearIncognito() {
    if (incognitoSites.size === 0) return;
    incognitoSites.clear();
    incognito = new SiteZoomLevels();
    changed();
  },
};

/** The site's zoom level, redrawn when it changes. */
export function useSiteZoomLevel(site: string | null, isIncognito: boolean): number {
  useSyncExternalStore(siteZoom.subscribe, siteZoom.getVersion);
  return siteZoom.level(site, isIncognito);
}
