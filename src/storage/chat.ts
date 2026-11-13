import { compactHistory } from '../agent/runAgent';
import type { Turn } from '../ai/types';
import type { ChatItem } from '../components/AssistantPanel';
import { Db, deleteKey, getJson, setJson } from './db';

export type SavedChat = { items: ChatItem[]; turns: Turn[] };

const KEY = 'chat';
const MAX_ITEMS = 300;
const MAX_TURNS_JSON = 1_000_000;

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
  return { items: chat.items.slice(-MAX_ITEMS), turns };
}

export async function loadChat(db: Db): Promise<SavedChat | null> {
  const chat = await getJson<SavedChat>(db, KEY);
  if (!chat || !Array.isArray(chat.items) || !Array.isArray(chat.turns)) return null;
  return chat;
}

export async function saveChat(db: Db, chat: SavedChat): Promise<void> {
  if (chat.items.length === 0 && chat.turns.length === 0) return deleteKey(db, KEY);
  await setJson(db, KEY, prepareForStorage(chat));
}

export async function clearChat(db: Db): Promise<void> {
  await deleteKey(db, KEY);
}
