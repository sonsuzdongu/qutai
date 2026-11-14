import type { Turn } from '../ai/types';
import type { Source } from '../agent/types';
import type { ChatItem } from '../components/AssistantPanel';

let itemCounter = 0;
const STREAM_FLUSH_MS = 50;

export function sourcesItem(sources: Source[], searchWidget?: string): ChatItem {
  return { id: String(++itemCounter), kind: 'sources', text: '', sources, ...(searchWidget ? { searchWidget } : {}) };
}

export function newItem(kind: ChatItem['kind'], text: string, options?: string[]): ChatItem {
  return options ? { id: String(++itemCounter), kind, text, options } : { id: String(++itemCounter), kind, text };
}

/** Saved messages keep their ids, so new ones must continue after the highest. */
function continueItemIds(items: ChatItem[]) {
  itemCounter = Math.max(itemCounter, ...items.map((item) => Number(item.id) || 0));
}

/** draft: what the user was typing, so it survives the app being closed. */
export type SavedConversation = { items: ChatItem[]; turns: Turn[]; draft?: string };

/** Storage key of a tab group's conversation (a tab's own conversation is stored under the tab's uid). */
export const groupChatKey = (groupId: string) => `group:${groupId}`;

/**
 * A conversation with the assistant: what is shown, what the model sees, and the message being typed.
 * Each tab has its own, and each tab group has one shared by its tabs (see `Browser.conversationOf`).
 */
export class Conversation {
  items: ChatItem[] = [];
  /** History sent to the model; the agent appends to this array in place while it runs. */
  turns: Turn[] = [];
  draft = '';
  running = false;
  /** Set when the conversation touched an incognito tab, so it is never written to disk. */
  privacy = { touchedIncognito: false };
  /** The next message starts a deep research task (switched off again once it is sent). */
  research = false;
  /** Saved messages have been read from disk (or there was nothing to read). */
  loaded = false;

  private abortController: AbortController | null = null;
  private streamingId: string | null = null;
  private pendingText = '';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param key Where it is saved: the owning tab's uid or `groupChatKey(groupId)`. Changes when it moves
   *   (e.g. from a tab to the group it founded).
   * @param incognito It belongs to an incognito tab, or to a group that ever held one: never written to disk.
   */
  constructor(
    private onChange: () => void,
    public key: string,
    public incognito = false,
  ) {}

  get isEmpty(): boolean {
    return this.items.length === 0 && this.turns.length === 0;
  }

  /** Nothing said, nothing typed, nothing running, and nothing left unread on disk. */
  get isBlank(): boolean {
    return this.loaded && this.isEmpty && !this.draft && !this.running;
  }

  add(item: ChatItem) {
    // A new array, so memoized lists notice the change.
    this.items = [...this.items, item];
    this.onChange();
  }

  /** Records which option was tapped, so the buttons show the answer and can't be used again. */
  choose(itemId: string, option: string) {
    this.items = this.items.map((item) => (item.id === itemId ? { ...item, chosen: option } : item));
    this.onChange();
  }

  /** Adds a piece of a streamed reply. Updates are batched so the screen redraws at most every 50 ms. */
  appendStreaming(delta: string) {
    this.pendingText += delta;
    this.flushTimer ??= setTimeout(() => this.flushStreaming(), STREAM_FLUSH_MS);
  }

  private flushStreaming() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (!this.pendingText) return;
    const text = this.pendingText;
    this.pendingText = '';
    const id = this.streamingId;
    if (id) {
      this.items = this.items.map((item) => (item.id === id ? { ...item, text: item.text + text } : item));
    } else {
      const item = { ...newItem('assistant', text), streaming: true };
      this.streamingId = item.id;
      this.items = [...this.items, item];
    }
    this.onChange();
  }

  /**
   * Ends a streamed reply. With text, it replaces what was streamed ("" removes the bubble);
   * without (e.g. after an error), the streamed part stays as it is.
   */
  finishStreaming(text?: string) {
    this.flushStreaming();
    const id = this.streamingId;
    this.streamingId = null;
    if (!id) {
      if (text) this.add(newItem('assistant', text));
      return;
    }
    this.items =
      text === ''
        ? this.items.filter((item) => item.id !== id)
        : this.items.map((item) => (item.id === id ? { id, kind: 'assistant', text: text ?? item.text } : item));
    this.onChange();
  }

  setResearch(on: boolean) {
    this.research = on;
    this.onChange();
  }

  setDraft(text: string) {
    this.draft = text;
    this.onChange();
  }

  /** Puts saved messages before anything said since the tab was opened (e.g. a task sent before loading finished). */
  restore(saved: SavedConversation | null) {
    this.loaded = true;
    if (saved && (saved.items.length || saved.turns.length)) {
      continueItemIds(saved.items);
      this.items = [...saved.items, ...this.items];
      this.turns.unshift(...saved.turns);
    }
    // Something typed since the tab opened wins over the saved draft.
    if (saved?.draft && !this.draft) this.draft = saved.draft;
    this.onChange();
  }

  clear() {
    this.items = [];
    this.turns = [];
    this.privacy = { touchedIncognito: false };
    this.onChange();
  }

  start(): AbortSignal {
    this.abortController = new AbortController();
    this.running = true;
    this.onChange();
    return this.abortController.signal;
  }

  finish() {
    this.abortController = null;
    this.running = false;
    this.onChange();
  }

  stop() {
    this.abortController?.abort();
  }

  toSaved(): SavedConversation {
    return { items: this.items, turns: this.turns, draft: this.draft };
  }
}
