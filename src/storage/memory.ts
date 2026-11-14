import {
  cleanMemoryText,
  hiddenKindOf,
  hiddenLabelProblem,
  isMemoryCategory,
  MAX_MEMORIES,
  Memory,
  MemoryCategory,
  MemoryStore,
  sensitiveReason,
} from '../agent/memory';
import { Db } from './db';

type Row = {
  id: string;
  text: string;
  category: string | null;
  created_at: number;
  updated_at: number;
  sensitive?: number | null;
  label?: string | null;
};

const toMemory = (row: Row): Memory => ({
  id: row.id,
  text: row.text,
  category: isMemoryCategory(row.category) ? row.category : 'general',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  sensitive: !!row.sensitive,
  label: row.label || null,
});

/** Thrown when a hidden memory needs a short label first (the Memory screen asks for one). */
export class HiddenLabelError extends Error {}

/** Throws unless a hidden memory can be described without its value: a detected kind, or a label that is fine. */
function checkHidden(text: string, label: string | null): string | null {
  const clean = label?.replace(/\s+/g, ' ').trim() || null;
  if (!clean) {
    if (!hiddenKindOf(text)) throw new HiddenLabelError('A hidden memory needs a short label saying what it is');
    return null;
  }
  const problem = hiddenLabelProblem(clean, text);
  if (problem) throw new HiddenLabelError(`The label can't be used: ${problem}`);
  return clean;
}

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
 * Throws for sensitive data. A national ID or passport number is saved hidden from the AI (agent/hiddenValues.ts);
 * `hidden` marks any other fact hidden, with the user's `label`.
 */
export async function addMemory(
  db: Db,
  text: string,
  category: MemoryCategory = 'general',
  hidden?: { label: string | null },
): Promise<Memory> {
  const clean = checkText(text, category);
  const sensitive = !!hidden || !!hiddenKindOf(clean);
  const label = sensitive ? checkHidden(clean, hidden?.label ?? null) : null;
  const now = Date.now();
  const existing = await db.getFirstAsync<Row>('SELECT * FROM memories WHERE lower(text) = lower(?)', [clean]);
  if (existing) {
    // Saving it again never makes a hidden memory visible.
    const keep = sensitive || !!existing.sensitive;
    const keptLabel = sensitive ? (label ?? existing.label ?? null) : (existing.label ?? null);
    await db.runAsync('UPDATE memories SET updated_at = ?, category = ?, sensitive = ?, label = ? WHERE id = ?', [
      now,
      category,
      keep ? 1 : 0,
      keptLabel,
      existing.id,
    ]);
    return toMemory({ ...existing, category, updated_at: now, sensitive: keep ? 1 : 0, label: keptLabel });
  }
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM memories', []);
  if ((count?.n ?? 0) >= MAX_MEMORIES) throw new Error(`Memory is full (${MAX_MEMORIES}); forget something first`);
  const row: Row = {
    id: newId(),
    text: clean,
    category,
    created_at: now,
    updated_at: now,
    sensitive: sensitive ? 1 : 0,
    label,
  };
  await db.runAsync(
    'INSERT INTO memories (id, text, category, created_at, updated_at, sensitive, label) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [row.id, row.text, category, row.created_at, row.updated_at, row.sensitive ?? 0, label],
  );
  return toMemory(row);
}

/**
 * Changes a memory's text and (optionally) its category; an empty text deletes it. `hidden` (the Memory screen's
 * lock) marks it hidden with a label, or visible with null; left out, it stays as it is, except that a text that
 * newly holds an ID or passport number becomes hidden.
 */
export async function updateMemory(
  db: Db,
  id: string,
  text: string,
  category?: MemoryCategory,
  hidden?: { label: string | null } | null,
): Promise<void> {
  if (!cleanMemoryText(text)) return deleteMemory(db, id).then(() => undefined);
  const current = await db.getFirstAsync<Row>('SELECT * FROM memories WHERE id = ?', [id]);
  if (!current) return;
  const target = category ?? toMemory(current).category;
  const clean = checkText(text, target);
  const sensitive =
    hidden !== undefined
      ? hidden !== null
      : !!current.sensitive || (!!hiddenKindOf(clean) && !hiddenKindOf(current.text));
  const label = sensitive ? checkHidden(clean, hidden ? hidden.label : (current.label ?? null)) : null;
  await db.runAsync(
    'UPDATE memories SET text = ?, category = ?, updated_at = ?, sensitive = ?, label = ? WHERE id = ?',
    [clean, target, Date.now(), sensitive ? 1 : 0, label, id],
  );
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
    get: async (id) => {
      const row = await (await getDb()).getFirstAsync<Row>('SELECT * FROM memories WHERE id = ?', [id]);
      return row ? toMemory(row) : null;
    },
    remove: async (id) => deleteMemory(await getDb(), id),
  };
}
