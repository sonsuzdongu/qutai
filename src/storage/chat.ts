import { compactHistory } from '../agent/runAgent';
import type { Turn } from '../ai/types';
import type { ChatItem } from '../components/AssistantPanel';
import { Db, deleteKey, getJson, setJson } from './db';

export type SavedChat = { items: ChatItem[]; turns: Turn[]; draft?: string };

const MAX_ITEMS = 300;
const MAX_TURNS_JSON = 1_000_000;
const MAX_DRAFT = 20_000;

/**
 * Shrinks a conversation for storage: page snapshots are compacted the same way as when
 * sending, screenshots are dropped, and the oldest exchanges go first if it is still too
 * large. Cuts happen only at user turns, so tool calls always keep their results.
 */
export function prepareForStorage(chat: SavedChat): SavedChat {
  let turns = compactHistory(chat.turns).map((turn) =>
    turn.role === 'tool_results'
      ? { ...turn, results: turn.results.map((r) => (r.images ? { ...r, images: undefined } : r)) }
      : turn,
  );
  while (JSON.stringify(turns).length > MAX_TURNS_JSON) {
    const nextUser = turns.findIndex((turn, i) => i > 0 && turn.role === 'user');
    if (nextUser === -1) {
      turns = [];
      break;
    }
    turns = turns.slice(nextUser);
  }
  return {
    items: chat.items.slice(-MAX_ITEMS),
    turns,
    ...(chat.draft ? { draft: chat.draft.slice(0, MAX_DRAFT) } : {}),
  };
}

const LEGACY_KEY = 'chat';
const keyFor = (uid: string) => `chat:${uid}`;

function isSavedChat(chat: SavedChat | null): chat is SavedChat {
  return !!chat && Array.isArray(chat.items) && Array.isArray(chat.turns);
}

/**
 * Loads a tab's conversation. With adoptLegacy, the single conversation saved by earlier
 * versions moves to this tab (once) when the tab has none of its own.
 */
export async function loadChat(db: Db, uid: string, { adoptLegacy = false } = {}): Promise<SavedChat | null> {
  const chat = await getJson<SavedChat>(db, keyFor(uid));
  if (isSavedChat(chat)) return chat;
  if (!adoptLegacy) return null;
  const legacy = await getJson<SavedChat>(db, LEGACY_KEY);
  await deleteKey(db, LEGACY_KEY);
  if (!isSavedChat(legacy)) return null;
  await setJson(db, keyFor(uid), legacy);
  return legacy;
}

export async function saveChat(db: Db, uid: string, chat: SavedChat): Promise<void> {
  if (chat.items.length === 0 && chat.turns.length === 0 && !chat.draft) return deleteKey(db, keyFor(uid));
  await setJson(db, keyFor(uid), prepareForStorage(chat));
}

export async function clearChat(db: Db, uid: string): Promise<void> {
  await deleteKey(db, keyFor(uid));
}

/** Deletes conversations of tabs that are neither open nor in recently closed. */
export async function deleteOrphanChats(db: Db, keepUids: string[]): Promise<void> {
  const rows = await db.getAllAsync<{ key: string }>("SELECT key FROM kv WHERE key LIKE 'chat:%'", []);
  const keep = new Set(keepUids.map(keyFor));
  for (const { key } of rows) {
    if (!keep.has(key)) await deleteKey(db, key);
  }
}
