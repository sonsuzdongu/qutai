import { Db } from './db';

export type ActionEntry = {
  at: number;
  host: string | null;
  url: string | null;
  tool: string;
  description: string;
  ok: boolean;
};

const KEEP_DAYS = 30;
const KEEP_ROWS = 2000;

export async function addAction(db: Db, entry: ActionEntry): Promise<void> {
  await db.runAsync('INSERT INTO agent_actions (at, host, url, tool, description, ok) VALUES (?, ?, ?, ?, ?, ?)', [
    entry.at,
    entry.host,
    entry.url,
    entry.tool,
    entry.description,
    entry.ok ? 1 : 0,
  ]);
}

export async function listActions(db: Db, limit = 500): Promise<(ActionEntry & { id: number })[]> {
  const rows = await db.getAllAsync<{
    id: number;
    at: number;
    host: string | null;
    url: string | null;
    tool: string;
    description: string;
    ok: number;
  }>('SELECT * FROM agent_actions ORDER BY at DESC, id DESC LIMIT ?', [limit]);
  return rows.map((r) => ({ ...r, ok: r.ok === 1 }));
}

/** Keeps the last 30 days and at most 2000 entries. */
export async function pruneActions(db: Db, now = Date.now()): Promise<void> {
  await db.runAsync('DELETE FROM agent_actions WHERE at < ?', [now - KEEP_DAYS * 86400000]);
  await db.runAsync(
    'DELETE FROM agent_actions WHERE id NOT IN (SELECT id FROM agent_actions ORDER BY at DESC, id DESC LIMIT ?)',
    [KEEP_ROWS],
  );
}

export async function clearActions(db: Db): Promise<void> {
  await db.runAsync('DELETE FROM agent_actions', []);
}
