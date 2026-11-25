/**
 * Site icons kept on the phone for the new tab page (UI-72 in docs/design/27-interface.md; picking and checks in
 * browser/siteIcons.ts).
 *
 * - Fetched only on a visit in a normal tab (Browser.notifyVisit never reports incognito tabs), from the site being
 *   visited: the page's own icon links, else /favicon.ico. https only, without cookies or Referer and skipping ad and
 *   tracker hosts while blocking is on (chat/cardImages.ts fetchBytes), at most ICON_MAX_BYTES, checked by its bytes.
 *   Once per site per 7 days (a site without a usable icon: once a day).
 * - One file per site in the app's cache folder (Paths.cache/site-icons): not in backups (iOS Caches, Android cache
 *   dir), may be dropped by the system, fetched again on the next visit. The assistant never gets them.
 * - Deleted: all of them with Clear browsing data › History (any range, then only sites with no visit left) or
 *   › Cached files; a site's own when it has no visit left in history (any deletion) or its tile is removed.
 * - Opening the new tab page reads only these files: it makes no network request.
 */
import { useEffect, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { cardImageAllowed, fetchBytes } from '../chat/cardImages';
import { hostOf } from '../i18n/format';
import type { Tab } from '../browser/Tab';
import {
  iconCandidates,
  iconFileKey,
  iconFileName,
  iconFormat,
  ICON_MAX_BYTES,
  IconEntry,
  needsIconFetch,
  parseIconFileName,
  parseIconLinks,
  siteIconKey,
} from '../browser/siteIcons';
import type { Db } from './db';

const ACCEPT = 'image/png,image/x-icon,image/vnd.microsoft.icon,image/webp,image/jpeg,image/gif;q=0.8';

const dir = new Directory(Paths.cache, 'site-icons');
/** File key → what is stored; read from the folder on first use. */
let index: Map<string, IconEntry> | null = null;
const inFlight = new Set<string>();
const listeners = new Set<() => void>();

function entries(): Map<string, IconEntry> {
  if (index) return index;
  index = new Map();
  try {
    if (!dir.exists) return index;
    for (const item of dir.list()) {
      const parsed = item instanceof File ? parseIconFileName(item.name) : null;
      if (!parsed) continue;
      const known = index.get(parsed.key);
      // A newer file wins; an older one left behind (a crash between write and delete) goes.
      if (known && known.at >= parsed.at) {
        deleteFile(item.name);
        continue;
      }
      if (known) deleteFile(known.file ?? iconFileName(parsed.key, known.at, 'none'));
      index.set(parsed.key, { at: parsed.at, file: parsed.ext === 'none' ? null : item.name });
    }
  } catch {
    // An unreadable folder: letters until the next visit writes an icon.
  }
  return index;
}

function deleteFile(name: string) {
  try {
    const file = new File(dir, name);
    if (file.exists) file.delete();
  } catch {}
}

function notify() {
  listeners.forEach((l) => l());
}

/** The stored icon of a site (a host as the new tab page shows it) as a file address, or null. */
export function siteIconUri(host: string): string | null {
  const entry = entries().get(iconFileKey(host));
  return entry?.file ? new File(dir, entry.file).uri : null;
}

/** The site's stored icon, following new and deleted icons while on screen; null shows the letter. */
export function useSiteIcon(host: string): string | null {
  const [uri, setUri] = useState(() => siteIconUri(host));
  useEffect(() => {
    const update = () => setUri(siteIconUri(host));
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, [host]);
  return uri;
}

/** Remembers what was found for a site, replacing its older file. */
async function store(key: string, at: number, bytes: Uint8Array | null, ext: ReturnType<typeof iconFormat>) {
  const map = entries();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const name = iconFileName(key, at, bytes && ext ? ext : 'none');
  await new File(dir, name).write(bytes && ext ? bytes : '');
  const old = map.get(key);
  if (old) deleteFile(old.file ?? iconFileName(key, old.at, 'none'));
  map.set(key, { at, file: bytes && ext ? name : null });
  notify();
}

/**
 * After a visit in a normal tab: fetches the site's icon if it has none or an old one. Never throws; only the site
 * being visited is asked.
 */
export async function refreshSiteIcon(tab: Tab, now = Date.now()): Promise<void> {
  if (tab.incognito || tab.isNewTab) return;
  const pageUrl = tab.url;
  const site = siteIconKey(pageUrl);
  if (!site) return;
  const key = iconFileKey(site);
  if (inFlight.has(key) || !needsIconFetch(entries().get(key), now)) return;
  inFlight.add(key);
  try {
    const raw = await tab.run<unknown>('siteIcons', [], 3000).catch(() => null);
    // The tab went elsewhere meanwhile: its answer may be another site's.
    if (siteIconKey(tab.url) !== site) return;
    for (const url of iconCandidates(pageUrl, parseIconLinks(raw))) {
      if (!cardImageAllowed(url)) continue;
      const bytes = await fetchBytes(url, ICON_MAX_BYTES, ACCEPT).catch(() => null);
      const ext = bytes ? iconFormat(bytes) : null;
      if (bytes && ext) return await store(key, now, bytes, ext);
    }
    await store(key, now, null, null);
  } catch {
    // Storage failed: tried again on a later visit.
  } finally {
    inFlight.delete(key);
  }
}

/** Deletes the stored icons of these sites (hosts as the new tab page shows them). */
export function removeSiteIcons(hosts: string[]): void {
  const map = entries();
  let changed = false;
  for (const host of hosts) {
    const key = iconFileKey(host);
    const entry = map.get(key);
    if (!entry) continue;
    deleteFile(entry.file ?? iconFileName(key, entry.at, 'none'));
    map.delete(key);
    changed = true;
  }
  if (changed) notify();
}

/** Deletes every stored icon (Clear browsing data). */
export function clearSiteIcons(): void {
  try {
    if (dir.exists) dir.delete();
  } catch {}
  index = new Map();
  notify();
}

/** After visits are deleted: icons of sites with no visit left in history go too. */
export async function pruneSiteIcons(db: Db): Promise<void> {
  const map = entries();
  if (!map.size) return;
  const rows = await db.getAllAsync<{ url: string }>('SELECT DISTINCT url FROM history', []);
  if (!rows.length) return clearSiteIcons();
  const kept = new Set(rows.map((r) => iconFileKey(hostOf(r.url))));
  removeSiteIcons([...map.keys()].filter((key) => !kept.has(key)));
}
