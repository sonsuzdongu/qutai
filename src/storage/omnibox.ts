import { hostOf } from '../i18n/format';
import type { Db } from './db';

export type LocalSuggestion = { url: string; title: string; bookmarked: boolean; visits: number };

const like = (query: string) => `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Lower is better: addresses starting with what was typed first, then bookmarks, then the most visited. */
export function rankSuggestions(query: string, items: LocalSuggestion[], limit = 5): LocalSuggestion[] {
  const q = query
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
  const startsWith = (s: LocalSuggestion) => {
    const host = hostOf(s.url).toLowerCase();
    const path = s.url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '');
    return host.startsWith(q) || path.startsWith(q);
  };
  const byUrl = new Map<string, LocalSuggestion>();
  for (const item of items) {
    const seen = byUrl.get(item.url);
    byUrl.set(
      item.url,
      seen
        ? {
            ...seen,
            bookmarked: seen.bookmarked || item.bookmarked,
            visits: seen.visits + item.visits,
            title: seen.title || item.title,
          }
        : item,
    );
  }
  return [...byUrl.values()]
    .map((s) => ({ s, prefix: startsWith(s) }))
    .sort(
      (a, b) =>
        Number(b.prefix) - Number(a.prefix) ||
        Number(b.s.bookmarked) - Number(a.s.bookmarked) ||
        b.s.visits - a.s.visits,
    )
    .slice(0, limit)
    .map(({ s }) => s);
}

/** Address bar suggestions from bookmarks and history; everything stays on the device. */
export async function localSuggestions(db: Db, query: string, limit = 5): Promise<LocalSuggestion[]> {
  if (!query.trim()) return [];
  const pattern = like(query);
  const [bookmarks, history] = await Promise.all([
    db.getAllAsync<{ url: string; title: string }>(
      `SELECT url, title FROM bookmarks WHERE title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\' LIMIT 20`,
      [pattern, pattern],
    ),
    db.getAllAsync<{ url: string; title: string; visits: number }>(
      `SELECT url, MAX(title) AS title, COUNT(*) AS visits FROM history
       WHERE title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\'
       GROUP BY url ORDER BY visits DESC, MAX(visited_at) DESC LIMIT 30`,
      [pattern, pattern],
    ),
  ]);
  return rankSuggestions(
    query,
    [
      ...bookmarks.map((b) => ({ url: b.url, title: b.title, bookmarked: true, visits: 0 })),
      ...history.map((h) => ({ url: h.url, title: h.title, bookmarked: false, visits: h.visits })),
    ],
    limit,
  );
}
