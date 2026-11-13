import { cleanMemoryText, MAX_MEMORIES, Memory, MemoryStore, sensitiveReason } from '../agent/memory';
import { Db } from './db';

type Row = { id: string; text: string; created_at: number; updated_at: number };

const toMemory = (row: Row): Memory => ({
  id: row.id,
  text: row.text,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export async function listMemories(db: Db): Promise<Memory[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM memories ORDER BY updated_at DESC', []);
  return rows.map(toMemory);
}

/** Saves a fact; the same text (ignoring case) is refreshed instead of duplicated. Throws for sensitive data. */
export async function addMemory(db: Db, text: string): Promise<Memory> {
  const clean = cleanMemoryText(text);
  if (!clean) throw new Error('Empty memory');
  const reason = sensitiveReason(clean);
  if (reason) throw new Error(`Not saved: looks like a ${reason}`);
  const now = Date.now();
  const existing = await db.getFirstAsync<Row>('SELECT * FROM memories WHERE lower(text) = lower(?)', [clean]);
  if (existing) {
    await db.runAsync('UPDATE memories SET updated_at = ? WHERE id = ?', [now, existing.id]);
    return toMemory({ ...existing, updated_at: now });
  }
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM memories', []);
  if ((count?.n ?? 0) >= MAX_MEMORIES) throw new Error(`Memory is full (${MAX_MEMORIES}); forget something first`);
  const row: Row = { id: newId(), text: clean, created_at: now, updated_at: now };
  await db.runAsync('INSERT INTO memories (id, text, created_at, updated_at) VALUES (?, ?, ?, ?)', [
    row.id,
    row.text,
    row.created_at,
    row.updated_at,
  ]);
  return toMemory(row);
}

export async function updateMemory(db: Db, id: string, text: string): Promise<void> {
  const clean = cleanMemoryText(text);
  if (!clean) return deleteMemory(db, id).then(() => undefined);
  const reason = sensitiveReason(clean);
  if (reason) throw new Error(`Not saved: looks like a ${reason}`);
  await db.runAsync('UPDATE memories SET text = ?, updated_at = ? WHERE id = ?', [clean, Date.now(), id]);
}

export async function deleteMemory(db: Db, id: string): Promise<boolean> {
  const exists = await db.getFirstAsync<{ id: string }>('SELECT id FROM memories WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM memories WHERE id = ?', [id]);
  return exists !== null;
}

export async function clearMemories(db: Db): Promise<void> {
  await db.runAsync('DELETE FROM memories', []);
}

/** The on-device memory store used by the agent. */
export function deviceMemoryStore(getDb: () => Promise<Db>): MemoryStore {
  return {
    list: async () => listMemories(await getDb()),
    add: async (text) => addMemory(await getDb(), text),
    remove: async (id) => deleteMemory(await getDb(), id),
  };
}
