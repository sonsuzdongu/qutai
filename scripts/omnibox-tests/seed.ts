// Shared by the address bar tests and the measurement: a seeded history and a clock the tests move by hand.
import type { DatabaseSync } from 'node:sqlite';
import type { Timers } from '../../src/browser/omniboxResults.ts';

/** The history and bookmarks tables as the app creates them (src/storage/db.ts, versions 1 and 21). */
export function seedHistory(raw: DatabaseSync, visits: number, withCoveringIndex = true): void {
  raw.exec(`CREATE TABLE history (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
              visited_at INTEGER NOT NULL);
            CREATE INDEX history_visited_at ON history (visited_at DESC);
            CREATE INDEX history_url ON history (url);
            CREATE TABLE bookmarks (url TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);`);
  if (withCoveringIndex) {
    raw.exec(`CREATE INDEX history_url_title_visited ON history (url, title, visited_at);
              DROP INDEX IF EXISTS history_url;`);
  }
  const hosts = ['github.com', 'news.ycombinator.com', 'www.wikipedia.org', 'tr.wikipedia.org', 'www.youtube.com',
    'www.google.com', 'stackoverflow.com', 'www.reddit.com', 'www.hurriyet.com.tr', 'www.sozcu.com.tr', 'docs.expo.dev',
    'developer.android.com', 'www.amazon.com.tr', 'www.trendyol.com', 'twitter.com'];
  const words = ['react', 'native', 'expo', 'browser', 'istanbul', 'haber', 'futbol', 'galatasaray', 'fenerbahce',
    'weather', 'recipe', 'python', 'sqlite', 'android', 'iphone', 'debounce', 'suggest', 'omnibox', 'kahve', 'ankara'];
  const insert = raw.prepare('INSERT INTO history (url, title, visited_at) VALUES (?, ?, ?)');
  const start = Date.UTC(2026, 10, 19);
  raw.exec('BEGIN');
  for (let i = 0; i < visits; i++) {
    const host = hosts[i % hosts.length];
    const a = words[(i * 7) % words.length];
    const b = words[(i * 13) % words.length];
    const page = Math.floor(i / 3); // about three visits per address
    insert.run(`https://${host}/${a}/${b}-${page}`, `${a} ${b} – page ${page} | ${host}`, start - i * 60_000);
  }
  raw.exec('COMMIT');
  const bookmark = raw.prepare('INSERT OR IGNORE INTO bookmarks (url, title, created_at) VALUES (?, ?, ?)');
  for (let i = 0; i < 300; i++) {
    bookmark.run(`https://${hosts[i % hosts.length]}/saved/${words[i % words.length]}-${i}`, `${words[(i * 3) % words.length]} saved ${i}`, i);
  }
}

/** Timers that only move when the test says so; promises settle on `flush`. */
export function fakeTimers(): Timers & { advance(ms: number): void; time: number } {
  let time = 0;
  let nextId = 1;
  const queue = new Map<number, { at: number; fn: () => void }>();
  const api = {
    get time() {
      return time;
    },
    now: () => time,
    set(fn: () => void, ms: number) {
      const id = nextId++;
      queue.set(id, { at: time + ms, fn });
      return id;
    },
    clear(handle: unknown) {
      queue.delete(handle as number);
    },
    advance(ms: number) {
      const end = time + ms;
      for (;;) {
        let first: [number, { at: number; fn: () => void }] | null = null;
        for (const entry of queue) if (entry[1].at <= end && (!first || entry[1].at < first[1].at)) first = entry;
        if (!first) break;
        queue.delete(first[0]);
        time = first[1].at;
        first[1].fn();
      }
      time = end;
    },
  };
  return api;
}

/** Lets resolved promises run their `then`s. */
export const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
