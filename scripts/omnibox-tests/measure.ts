// Measures the address bar's history lookup (src/storage/omnibox.ts localSuggestions) on Node's SQLite with a seeded
// history, with the index the app had before version 0.1.4 and with the covering one, and counts how many lookups a
// quickly typed word starts (src/browser/omniboxResults.ts) against one per letter before. Run: npm run measure:omnibox
// (N=20000 for a bigger history). A Mac is several times faster than a mid-range phone; compare the two columns.
import { DatabaseSync } from 'node:sqlite';
import { OmniboxResults } from '../../src/browser/omniboxResults.ts';
import { localSuggestions } from '../../src/storage/omnibox.ts';
import { fakeTimers, seedHistory } from './seed.ts';

const N = Number(process.env.N ?? 5000);
const word = 'galatasa';

async function timeLookups(withCoveringIndex: boolean) {
  const raw = new DatabaseSync(':memory:');
  seedHistory(raw, N, withCoveringIndex);
  const db = { getAllAsync: async <T,>(sql: string, p: (string | number)[]) => raw.prepare(sql).all(...p) as T[] };
  const plan = raw
    .prepare(
      `EXPLAIN QUERY PLAN SELECT url, MAX(title) AS title, COUNT(*) AS visits FROM history
       WHERE title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\' GROUP BY url ORDER BY visits DESC, MAX(visited_at) DESC LIMIT 30`,
    )
    .all('%a%', '%a%')
    .map((r) => (r as { detail: string }).detail)
    .join(' / ');
  const times: number[] = [];
  for (let pass = 0; pass < 2; pass++) {
    times.length = 0;
    for (let k = 1; k <= word.length; k++) {
      const t0 = performance.now();
      for (let r = 0; r < 20; r++) await localSuggestions(db as never, word.slice(0, k));
      times.push((performance.now() - t0) / 20);
    }
  }
  const avg = times.slice(1).reduce((a, b) => a + b, 0) / (times.length - 1);
  console.log(
    `${withCoveringIndex ? 'covering index' : 'old index     '}  first letter ${times[0].toFixed(2)} ms, later letters ${avg.toFixed(2)} ms  (${plan})`,
  );
}

function countLookups(gapMs: number) {
  const timers = fakeTimers();
  const results = new OmniboxResults({
    lookupLocal: async () => [],
    lookupRemote: () => new Promise<string[]>(() => {}),
    onChange: () => {},
    timers,
  });
  for (let k = 1; k <= word.length; k++) {
    results.setQuery(word.slice(0, k));
    timers.advance(gapMs);
  }
  timers.advance(1000);
  return { local: results.launches.length, remote: results.remoteRequests.length };
}

console.log(`History of ${N} visits (about ${Math.round(N / 3)} addresses), typing "${word}":`);
await timeLookups(false);
await timeLookups(true);
for (const gap of [60, 90, 150, 250]) {
  const n = countLookups(gap);
  console.log(`  ${gap} ms per letter: ${n.local} history lookups (${word.length} before), ${n.remote} engine requests`);
}
