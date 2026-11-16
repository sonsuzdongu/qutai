import { parseRequestCost, type RequestCost } from '../ai/cost';
import type { ProviderId, ToolImage } from '../ai/types';
import { Db, getDb } from './db';

/**
 * "What was sent to the AI": one entry per request the app makes to the AI provider.
 *
 * Retention: the outline of a request (time, provider, model, site, kinds and sizes of what was sent)
 * is kept in SQLite for 30 days like the activity history. The content itself (page text, messages,
 * screenshots) is kept only in memory while the app runs, within the caps below, so page text is
 * never copied to disk a second time. Requests from incognito conversations (or ones that touched an
 * incognito tab) stay in memory only, and once a conversation touches one, its earlier entries are
 * removed from disk, as its saved chat is. Not part of the encrypted backup.
 *
 * Each entry also gets the tokens the provider reported for the request and its approximate cost (`cost`: numbers,
 * the price table's date and where the figure came from; no content), once the reply is in.
 */

export type SentKind =
  | 'message'
  | 'page'
  | 'source'
  | 'screenshot'
  | 'attachment'
  | 'pdf'
  | 'tab'
  | 'history'
  | 'bookmarks'
  | 'settings'
  | 'memory'
  | 'location'
  | 'calendar'
  | 'tool';

/** One thing that left the phone with a request. Sizes only: no content here. */
export type SentItem = {
  kind: SentKind;
  /** Characters of text sent. */
  chars: number;
  /** Site the content came from (host only). */
  host?: string;
  /** For tool results: the tool's name. */
  tool?: string;
  /** Approximate bytes of the images sent with it. */
  imageBytes?: number;
  /** Memories included in the prompt. */
  count?: number;
};

/** The content of an item, kept only in memory. */
export type SentContent = { text?: string; images?: ToolImage[] };

export type SentRequest = {
  id: string;
  at: number;
  provider: ProviderId;
  model: string;
  /** The custom endpoint's host the request went to (custom provider only). */
  endpoint?: string;
  /** Site of the tab the assistant was working in (host only). */
  host: string | null;
  /** Key of the conversation it belongs to (a tab uid or a group key). */
  conversation: string;
  /** What was new in this request; earlier turns are resent too, see resentTurns. */
  items: SentItem[];
  /** Characters of the whole request: instructions, tool list and the conversation so far. */
  totalChars: number;
  /** Images in the whole request. */
  images: number;
  /** Earlier messages and results of the conversation sent again as context. */
  resentTurns: number;
  resentChars: number;
  webSearch: boolean;
  research: boolean;
  /** From an incognito conversation: shown for this app session only, never written to disk. */
  incognito: boolean;
  /** Parallel to items; absent once dropped from memory or for entries read from disk. */
  content?: SentContent[];
  /** What the request used and approximately cost; absent until the reply is in, or when none was reported. */
  cost?: RequestCost;
};

const KEEP_DAYS = 30;
const KEEP_ROWS = 2000;
/** Requests whose content stays in memory, newest first, and the most text and images they may hold. */
const CONTENT_REQUESTS = 60;
const CONTENT_CHARS = 2_000_000;
const CONTENT_IMAGES = 4;
/** Entries of this app session kept in memory (incognito ones exist nowhere else). */
const SESSION_REQUESTS = 500;

/** This app session's requests, oldest first. */
let session: SentRequest[] = [];
const listeners = new Set<() => void>();
/** Conversations whose entries were already removed from disk after they touched an incognito tab. */
const purged = new Set<string>();
/** Writes of entries still on their way to disk, so their cost is written after them. */
const writing = new Map<string, Promise<void>>();
let counter = 0;

export function newSentId(at: number): string {
  return `${at.toString(36)}-${(++counter).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function subscribeSentLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const notify = () => listeners.forEach((listener) => listener());

/** Drops content (not the entry) beyond the caps, newest kept first. */
function trimContent() {
  let chars = 0;
  let images = 0;
  let kept = 0;
  for (let i = session.length - 1; i >= 0; i--) {
    const entry = session[i];
    if (!entry.content) continue;
    if (kept >= CONTENT_REQUESTS) {
      entry.content = undefined;
      continue;
    }
    kept++;
    entry.content = entry.content.map((c) => {
      chars += c.text?.length ?? 0;
      if (chars > CONTENT_CHARS) return {};
      if (!c.images) return c;
      images += c.images.length;
      return images > CONTENT_IMAGES ? { text: c.text } : c;
    });
  }
  if (session.length > SESSION_REQUESTS) session = session.slice(-SESSION_REQUESTS);
}

/**
 * Adds a request to the log: in memory at once, and (unless incognito) its outline to disk in the
 * background. Never throws and never waits, so it can't slow down or fail the request itself.
 */
export function recordSent(entry: SentRequest): void {
  session.push(entry);
  trimContent();
  notify();
  if (entry.incognito) {
    // The conversation is private now: what it wrote before goes, as with its saved chat.
    session.forEach((e) => {
      if (e.conversation === entry.conversation) e.incognito = true;
    });
    if (!purged.has(entry.conversation)) {
      purged.add(entry.conversation);
      getDb()
        .then((db) => db.runAsync('DELETE FROM ai_requests WHERE conversation = ?', [entry.conversation]))
        .catch(() => {});
    }
    return;
  }
  // Cleared since (a new chat): it may write again, and be purged again if it touches incognito later.
  purged.delete(entry.conversation);
  const write = getDb()
    .then((db) => insertSent(db, entry))
    .catch(() => {})
    .finally(() => writing.delete(entry.id));
  writing.set(entry.id, write);
}

/** Adds a request's usage and cost to its entry (in memory, and on disk unless it is incognito). Never throws. */
export function setSentCost(id: string, cost: RequestCost): void {
  const entry = session.find((e) => e.id === id);
  if (!entry) return;
  entry.cost = cost;
  notify();
  if (entry.incognito) return;
  (writing.get(id) ?? Promise.resolve())
    .then(() => getDb())
    .then((db) => db.runAsync('UPDATE ai_requests SET cost = ? WHERE id = ?', [JSON.stringify(cost), id]))
    .catch(() => {});
}

async function insertSent(db: Db, e: SentRequest): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO ai_requests
       (id, at, provider, model, host, conversation, items, total_chars, images, resent_turns, resent_chars, web_search, research, endpoint)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.id,
      e.at,
      e.provider,
      e.model,
      e.host,
      e.conversation,
      JSON.stringify(e.items),
      e.totalChars,
      e.images,
      e.resentTurns,
      e.resentChars,
      e.webSearch ? 1 : 0,
      e.research ? 1 : 0,
      e.endpoint ?? null,
    ],
  );
}

type Row = {
  id: string;
  at: number;
  provider: ProviderId;
  model: string;
  host: string | null;
  conversation: string;
  items: string;
  total_chars: number;
  images: number;
  resent_turns: number;
  resent_chars: number;
  web_search: number;
  research: number;
  endpoint: string | null;
  cost: string | null;
};

function fromRow(r: Row): SentRequest {
  let items: SentItem[] = [];
  try {
    const parsed = JSON.parse(r.items);
    if (Array.isArray(parsed)) items = parsed;
  } catch {}
  let cost: RequestCost | undefined;
  try {
    cost = r.cost ? parseRequestCost(JSON.parse(r.cost)) : undefined;
  } catch {}
  return {
    id: r.id,
    at: r.at,
    provider: r.provider,
    model: r.model,
    ...(r.endpoint ? { endpoint: r.endpoint } : {}),
    host: r.host,
    conversation: r.conversation,
    items,
    totalChars: r.total_chars,
    images: r.images,
    resentTurns: r.resent_turns,
    resentChars: r.resent_chars,
    webSearch: r.web_search === 1,
    research: r.research === 1,
    incognito: false,
    ...(cost ? { cost } : {}),
  };
}

/**
 * Newest first: entries from disk, with this session's in-memory ones (content included, incognito
 * ones too) in their place. With conversation, only that conversation's requests.
 */
export async function listSent(db: Db, conversation?: string, limit = 500): Promise<SentRequest[]> {
  const rows = conversation
    ? await db.getAllAsync<Row>('SELECT * FROM ai_requests WHERE conversation = ? ORDER BY at DESC LIMIT ?', [
        conversation,
        limit,
      ])
    : await db.getAllAsync<Row>('SELECT * FROM ai_requests ORDER BY at DESC LIMIT ?', [limit]);
  const byId = new Map(rows.map((r) => [r.id, fromRow(r)]));
  for (const entry of session) {
    if (!conversation || entry.conversation === conversation) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => b.at - a.at).slice(0, limit);
}

/** A conversation moved to another key (a tab's chat became its group's, or back): its entries follow. */
export async function moveSentConversation(db: Db, from: string, to: string): Promise<void> {
  session.forEach((e) => {
    if (e.conversation === from) e.conversation = to;
  });
  await db.runAsync('UPDATE ai_requests SET conversation = ? WHERE conversation = ?', [to, from]);
}

/** Keeps the last 30 days and at most 2000 entries on disk. */
export async function pruneSent(db: Db, now = Date.now()): Promise<void> {
  await db.runAsync('DELETE FROM ai_requests WHERE at < ?', [now - KEEP_DAYS * 86400000]);
  await db.runAsync('DELETE FROM ai_requests WHERE id NOT IN (SELECT id FROM ai_requests ORDER BY at DESC LIMIT ?)', [
    KEEP_ROWS,
  ]);
}

/** Deletes entries from `from` on (0: all), on disk and in memory. */
export async function deleteSentSince(db: Db, from: number): Promise<void> {
  session = session.filter((e) => e.at < from);
  notify();
  await db.runAsync('DELETE FROM ai_requests WHERE at >= ?', [from]);
}
