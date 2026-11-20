import { compactHistory } from '../agent/runAgent';
import { PROVIDER_ORDER } from '../ai/providers';
import type { Turn } from '../ai/types';
import { attachmentIdsIn } from '../chat/attachments';
import { checkedOptionItem } from '../chat/optionCards';
import type { Conversation, ModelChoice } from '../chat/Conversation';
import type { ChatItem } from '../components/AssistantPanel';
import { Db, deleteKey, getJson, setJson } from './db';
import { cutText } from '../utils/wellFormed';

export type SavedChat = {
  items: ChatItem[];
  turns: Turn[];
  draft?: string;
  model?: ModelChoice;
  voiceLanguage?: string;
  /** A task was running when it was saved (Conversation.toSaved): read back, it was interrupted. */
  task?: { sentId: string };
};

const MAX_ITEMS = 300;
const MAX_TURNS_JSON = 1_000_000;
const MAX_DRAFT = 20_000;

/**
 * Shrinks a conversation for storage: page snapshots are compacted the same way as when
 * sending, screenshots are dropped (attached images are kept as files, see device/attachments.ts), and the oldest exchanges go first if it is still too
 * large. Cuts happen only at user turns, so tool calls always keep their results.
 */
export function prepareForStorage(chat: SavedChat): SavedChat {
  let turns = compactHistory(chat.turns).map((turn) =>
    turn.role === 'tool_results'
      ? { ...turn, results: turn.results.map((r) => (r.images ? { ...r, images: undefined } : r)) }
      : turn.role === 'user' && turn.images
        ? { ...turn, images: undefined }
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
    ...(chat.draft ? { draft: cutText(chat.draft, MAX_DRAFT) } : {}),
    ...(validModel(chat.model) ? { model: chat.model } : {}),
    ...(validLanguageTag(chat.voiceLanguage) ? { voiceLanguage: chat.voiceLanguage } : {}),
    ...(validTask(chat.task) ? { task: { sentId: chat.task.sentId } } : {}),
  };
}

function validTask(task: unknown): task is { sentId: string } {
  return !!task && typeof (task as { sentId?: unknown }).sentId === 'string';
}

/** A BCP 47-like language tag ("tr", "en-GB", "zh-Hant-TW"). */
function validLanguageTag(tag: unknown): tag is string {
  return typeof tag === 'string' && /^[a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]{2,8}){0,3}$/.test(tag);
}

/**
 * A saved model choice is used only if it names a provider this version knows and a model id. Qutai Credits needs no
 * model: it is chosen as `''` (and a tier an older version stored is kept but not read, CRED-39).
 */
function validModel(model: unknown): model is ModelChoice {
  const m = model as ModelChoice | undefined;
  return (
    !!m &&
    (PROVIDER_ORDER as string[]).includes(m.provider) &&
    typeof m.model === 'string' &&
    (m.provider === 'qutai' || m.model.trim().length > 0)
  );
}

const LEGACY_KEY = 'chat';
/** key: a tab's uid or a group's `groupChatKey` (from `Conversation.key`). */
const keyFor = (key: string) => `chat:${key}`;

function isSavedChat(chat: SavedChat | null): chat is SavedChat {
  return !!chat && Array.isArray(chat.items) && Array.isArray(chat.turns);
}

/**
 * Loads a tab's or a group's conversation. With adoptLegacy, the single conversation saved by
 * earlier versions moves here (once) when there is none of its own.
 */
export async function loadChat(db: Db, key: string, { adoptLegacy = false } = {}): Promise<SavedChat | null> {
  const chat = await getJson<SavedChat>(db, keyFor(key));
  if (isSavedChat(chat)) {
    // Cards are page data: checked again when read back (chat/optionCards.ts).
    chat.items = chat.items.map((item) => checkedOptionItem(item));
    if (chat.model !== undefined && !validModel(chat.model)) delete chat.model;
    if (chat.voiceLanguage !== undefined && !validLanguageTag(chat.voiceLanguage)) delete chat.voiceLanguage;
    if (chat.task !== undefined && !validTask(chat.task)) delete chat.task;
    return chat;
  }
  if (!adoptLegacy) return null;
  const legacy = await getJson<SavedChat>(db, LEGACY_KEY);
  await deleteKey(db, LEGACY_KEY);
  if (!isSavedChat(legacy)) return null;
  await setJson(db, keyFor(key), legacy);
  return legacy;
}

export async function saveChat(db: Db, key: string, chat: SavedChat): Promise<void> {
  if (chat.items.length === 0 && chat.turns.length === 0 && !chat.draft && !chat.model && !chat.voiceLanguage)
    return deleteKey(db, keyFor(key));
  await setJson(db, keyFor(key), prepareForStorage(chat));
}

export async function clearChat(db: Db, key: string): Promise<void> {
  await deleteKey(db, keyFor(key));
}

/**
 * Moves a saved conversation that hasn't been read yet to another key, replacing what is there.
 * One statement, so a read of either key never sees it half moved. Nothing saved: nothing changes.
 */
export async function renameChat(db: Db, fromKey: string, toKey: string): Promise<void> {
  await db.runAsync('UPDATE OR REPLACE kv SET key = ? WHERE key = ?', [keyFor(toKey), keyFor(fromKey)]);
}

/**
 * Writes a conversation under its key. One that belongs to an incognito tab (or to a group that ever held
 * one) or that touched a private tab leaves nothing: its saved copy is removed (deleting a key that was
 * never written changes nothing on disk). With fromKey, the conversation has just moved from there; one
 * not read from disk yet gets its saved copy renamed instead.
 */
export async function storeChat(db: Db, chat: Conversation, fromKey = chat.key): Promise<void> {
  const moved = fromKey !== chat.key;
  if (chat.incognito || chat.privacy.touchedIncognito) {
    await clearChat(db, chat.key);
    if (moved) await clearChat(db, fromKey);
  } else if (!chat.loaded) {
    if (moved) await renameChat(db, fromKey, chat.key);
  } else {
    await saveChat(db, chat.key, chat.toSaved());
    if (moved) await clearChat(db, fromKey);
  }
}

/** Ids of the attachments every saved conversation refers to (in its messages or its history). */
export async function savedAttachmentIds(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ value: string }>("SELECT value FROM kv WHERE key LIKE 'chat:%'", []);
  return rows.flatMap((row) => attachmentIdsIn(row.value));
}

/** Deletes conversations of tabs and groups that are gone (keys of open tabs, groups and recently closed tabs are kept). */
export async function deleteOrphanChats(db: Db, keepKeys: string[]): Promise<void> {
  const rows = await db.getAllAsync<{ key: string }>("SELECT key FROM kv WHERE key LIKE 'chat:%'", []);
  const keep = new Set(keepKeys.map(keyFor));
  for (const { key } of rows) {
    if (!keep.has(key)) await deleteKey(db, key);
  }
}
