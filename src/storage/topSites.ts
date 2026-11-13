import { hostOf } from '../i18n/format';
import { Db, getJson, setJson } from './db';

export type TopSite = { host: string; url: string; title: string; visits: number };

const HIDDEN_KEY = 'hiddenTopSites';
const WINDOW_DAYS = 30;
const SCAN_LIMIT = 3000;

/**
 * Most visited sites of the last 30 days, one tile per host (pointing at its most recent
 * page). Hosts the user removed are skipped.
 */
export async function topSites(db: Db, limit = 8, now = Date.now()): Promise<TopSite[]> {
  const hidden = new Set(await hiddenTopSites(db));
  const rows = await db.getAllAsync<{ url: string; title: string }>(
    'SELECT url, title FROM history WHERE visited_at >= ? ORDER BY visited_at DESC LIMIT ?',
    [now - WINDOW_DAYS * 86_400_000, SCAN_LIMIT],
  );
  const byHost = new Map<string, TopSite>();
  for (const row of rows) {
    const host = hostOf(row.url);
    if (!host || hidden.has(host)) continue;
    const site = byHost.get(host);
    // Rows are newest first, so the first one seen for a host is its latest page.
    if (site) site.visits++;
    else byHost.set(host, { host, url: row.url, title: row.title, visits: 1 });
  }
  return [...byHost.values()].sort((a, b) => b.visits - a.visits).slice(0, limit);
}

export async function hiddenTopSites(db: Db): Promise<string[]> {
  return (await getJson<string[]>(db, HIDDEN_KEY)) ?? [];
}

export async function hideTopSite(db: Db, host: string): Promise<void> {
  const hidden = new Set(await hiddenTopSites(db));
  hidden.add(host);
  await setJson(db, HIDDEN_KEY, [...hidden]);
}
