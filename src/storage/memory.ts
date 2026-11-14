import {
  cleanMemoryText,
  isMemoryCategory,
  MAX_MEMORIES,
  Memory,
  MemoryCategory,
  MemoryStore,
  sensitiveReason,
} from '../agent/memory';
import { Db } from './db';

type Row = { id: string; text: string; category: string | null; created_at: number; updated_at: number };

const toMemory = (row: Row): Memory => ({
  id: row.id,
  text: row.text,
  category: isMemoryCategory(row.category) ? row.category : 'general',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export async function listMemories(db: Db): Promise<Memory[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM memories ORDER BY updated_at DESC', []);
  return rows.map(toMemory);
}

/** Throws (with a message the model and the user can read) when the text must not be kept in this category. */
function checkText(text: string, category: MemoryCategory): string {
  const clean = cleanMemoryText(text);
  if (!clean) throw new Error('Empty memory');
  const reason = sensitiveReason(clean, category);
  if (reason) throw new Error(`Not saved: looks like a ${reason}`);
  return clean;
}

/**
 * Saves a fact; the same text (ignoring case) is refreshed instead of duplicated, and moves to the category given.
 * Throws for sensitive data.
 */
export async function addMemory(db: Db, text: string, category: MemoryCategory = 'general'): Promise<Memory> {
  const clean = checkText(text, category);
  const now = Date.now();
  const existing = await db.getFirstAsync<Row>('SELECT * FROM memories WHERE lower(text) = lower(?)', [clean]);
  if (existing) {
    await db.runAsync('UPDATE memories SET updated_at = ?, category = ? WHERE id = ?', [now, category, existing.id]);
    return toMemory({ ...existing, category, updated_at: now });
  }
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM memories', []);
  if ((count?.n ?? 0) >= MAX_MEMORIES) throw new Error(`Memory is full (${MAX_MEMORIES}); forget something first`);
  const row: Row = { id: newId(), text: clean, category, created_at: now, updated_at: now };
  await db.runAsync('INSERT INTO memories (id, text, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
    row.id,
    row.text,
    category,
    row.created_at,
    row.updated_at,
  ]);
  return toMemory(row);
}

/** Changes a memory's text and (optionally) its category; an empty text deletes it. */
export async function updateMemory(db: Db, id: string, text: string, category?: MemoryCategory): Promise<void> {
  if (!cleanMemoryText(text)) return deleteMemory(db, id).then(() => undefined);
  const current = await db.getFirstAsync<Row>('SELECT * FROM memories WHERE id = ?', [id]);
  if (!current) return;
  const target = category ?? toMemory(current).category;
  const clean = checkText(text, target);
  await db.runAsync('UPDATE memories SET text = ?, category = ?, updated_at = ? WHERE id = ?', [
    clean,
    target,
    Date.now(),
    id,
  ]);
}

/**
 * Moves memories to other categories (the Memory screen, "Organise for me"). Each move is checked like a new
 * memory, so an ID number never lands outside identity or travel; those are skipped. Returns how many moved.
 */
export async function moveMemories(db: Db, moves: { id: string; category: MemoryCategory }[]): Promise<number> {
  let moved = 0;
  await db.withTransactionAsync(async () => {
    for (const { id, category } of moves) {
      const row = await db.getFirstAsync<Row>('SELECT * FROM memories WHERE id = ?', [id]);
      if (!row || sensitiveReason(row.text, category)) continue;
      // The time is kept: moving is not new information, so the prompt's "newest first" stays as it was.
      await db.runAsync('UPDATE memories SET category = ? WHERE id = ?', [category, id]);
      moved++;
    }
  });
  return moved;
}

export async function deleteMemory(db: Db, id: string): Promise<boolean> {
  const exists = await db.getFirstAsync<{ id: string }>('SELECT id FROM memories WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM memories WHERE id = ?', [id]);
  return exists !== null;
}

export async function deleteMemoryCategory(db: Db, category: MemoryCategory): Promise<void> {
  // Rows written before categories existed got 'general' from the migration, so no NULL case is left.
  await db.runAsync('DELETE FROM memories WHERE category = ?', [category]);
}

export async function clearMemories(db: Db): Promise<void> {
  await db.runAsync('DELETE FROM memories', []);
}

/** The on-device memory store used by the agent. */
export function deviceMemoryStore(getDb: () => Promise<Db>): MemoryStore {
  return {
    list: async () => listMemories(await getDb()),
    add: async (text, category) => addMemory(await getDb(), text, category),
    remove: async (id) => deleteMemory(await getDb(), id),
  };
}
