import type { Turn } from '../ai/types';
import type { ChatItem } from '../components/AssistantPanel';

let itemCounter = 0;

export function newItem(kind: ChatItem['kind'], text: string): ChatItem {
  return { id: String(++itemCounter), kind, text };
}

/** Saved messages keep their ids, so new ones must continue after the highest. */
function continueItemIds(items: ChatItem[]) {
  itemCounter = Math.max(itemCounter, ...items.map((item) => Number(item.id) || 0));
}

export type SavedConversation = { items: ChatItem[]; turns: Turn[] };

/** One tab's conversation with the assistant: what is shown, what the model sees, and the message being typed. */
export class Conversation {
  items: ChatItem[] = [];
  /** History sent to the model; the agent appends to this array in place while it runs. */
  turns: Turn[] = [];
  draft = '';
  running = false;
  /** Set when the conversation touched an incognito tab, so it is never written to disk. */
  privacy = { touchedIncognito: false };
  /** Saved messages have been read from disk (or there was nothing to read). */
  loaded = false;

  private abortController: AbortController | null = null;

  constructor(private onChange: () => void) {}

  get isEmpty(): boolean {
    return this.items.length === 0 && this.turns.length === 0;
  }

  add(item: ChatItem) {
    // A new array, so memoized lists notice the change.
    this.items = [...this.items, item];
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
    return { items: this.items, turns: this.turns };
  }
}
