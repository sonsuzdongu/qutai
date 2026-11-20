import type { Conversation } from '../chat/Conversation';

/** Typing in the chat input is saved after this pause. */
export const DRAFT_SAVE_DELAY_MS = 800;

/**
 * Writes conversations to storage, one at a time per conversation (TABS-28, TABS-29):
 * - `soon`: after a pause in typing, with its own timer per conversation, so typing in a second tab never drops the
 *   first tab's save;
 * - `now`: at once, coalesced: while a write of this conversation is under way, later requests make exactly one more
 *   write when it ends (a task's steps can come faster than a write), and writes never land out of order;
 * - `flush`: what waits on a timer is written now (switching conversations, Qutai leaving the foreground).
 * A write takes the conversation as it is when it starts, under its key then (conversations move between keys).
 * What it writes is small: screenshots are never saved and attached images are files (storage/chat.ts).
 */
export class ChatSaver {
  private timers = new Map<Conversation, ReturnType<typeof setTimeout>>();
  private writing = new Map<Conversation, Promise<void>>();
  private again = new Set<Conversation>();

  constructor(private write: (chat: Conversation) => Promise<unknown>) {}

  /** Saves after a pause (typing). */
  soon(chat: Conversation, delayMs = DRAFT_SAVE_DELAY_MS) {
    const timer = this.timers.get(chat);
    if (timer) clearTimeout(timer);
    this.timers.set(
      chat,
      setTimeout(() => {
        this.timers.delete(chat);
        void this.now(chat);
      }, delayMs),
    );
  }

  /** Saves now (after the write under way, if any); resolves when this state of the conversation is written. */
  now(chat: Conversation): Promise<void> {
    const timer = this.timers.get(chat);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(chat);
    }
    const current = this.writing.get(chat);
    if (current) {
      // The write under way goes round once more before it ends.
      this.again.add(chat);
      return current;
    }
    const run = (async () => {
      try {
        do {
          this.again.delete(chat);
          await this.write(chat).catch(() => undefined);
        } while (this.again.has(chat));
      } finally {
        this.writing.delete(chat);
      }
    })();
    this.writing.set(chat, run);
    return run;
  }

  /** Writes what waits on a timer now: one conversation, or every one. */
  flush(chat?: Conversation): Promise<void> {
    const waiting = chat ? (this.timers.has(chat) ? [chat] : []) : [...this.timers.keys()];
    return Promise.all(waiting.map((c) => this.now(c))).then(() => undefined);
  }

  /** Whether a save of this conversation waits on a timer. */
  pending(chat: Conversation): boolean {
    return this.timers.has(chat);
  }
}
