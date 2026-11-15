import type { ProviderId, Turn } from '../ai/types';
import type { Source } from '../agent/types';
import type { ChatItem } from '../components/AssistantPanel';
import type { FileOffer } from '../device/composedFile';
import type { CallOffer } from '../device/phone';
import { formatSize } from '../i18n/format';
import type { SmsOffer } from '../device/sms';
import type { WhatsAppOffer } from '../device/whatsapp';
import { AttachmentInfo, MAX_ATTACHMENTS, MAX_EDITED_IMAGES } from './attachments';
import type { ComposedRef, ShareOffer } from './shareable';

let itemCounter = 0;
const STREAM_FLUSH_MS = 50;

export function sourcesItem(sources: Source[], searchWidget?: string): ChatItem {
  return { id: String(++itemCounter), kind: 'sources', text: '', sources, ...(searchWidget ? { searchWidget } : {}) };
}

/** A Call button offered by the assistant; the text is what versions without the card show instead. */
export function callItem(call: CallOffer): ChatItem {
  const text = `📞 ${call.name ? `${call.name} · ` : ''}${call.number}`;
  return { id: String(++itemCounter), kind: 'call', text, call };
}

/** An "Open in Messages" card offered by the assistant; the text is what versions without the card show instead. */
export function smsItem(sms: SmsOffer): ChatItem {
  const text = `💬 ${sms.name ? `${sms.name} · ` : ''}${sms.number}`;
  return { id: String(++itemCounter), kind: 'sms', text, sms };
}

/** An "Open in WhatsApp" card offered by the assistant; the text is what versions without the card show instead. */
export function whatsAppItem(whatsapp: WhatsAppOffer): ChatItem {
  const who = [whatsapp.name, whatsapp.number].filter(Boolean).join(' · ');
  return { id: String(++itemCounter), kind: 'whatsapp', text: `🟢 WhatsApp${who ? ` · ${who}` : ''}`, whatsapp };
}

/** A file the assistant composed (save_file), with Share and Save buttons; the text is what older versions show. */
export function fileItem(file: FileOffer): ChatItem {
  return { id: String(++itemCounter), kind: 'file', text: `📄 ${file.name} · ${formatSize(file.size)}`, file };
}

/** An image the assistant made (edit_image), as a card; its manifest makes it one of the conversation's attachments. */
export function imageItem(info: AttachmentInfo): ChatItem {
  const size = info.width && info.height ? ` · ${info.width}×${info.height}` : '';
  return { id: String(++itemCounter), kind: 'image', text: `🖼 ${info.name}${size} · ${formatSize(info.size)}`, attachments: [info] };
}

/** A PDF Qutai made (save_pdf, or an answer saved as a PDF), as a card; its manifest makes it a file of the conversation. */
export function pdfItem(info: AttachmentInfo): ChatItem {
  return { id: String(++itemCounter), kind: 'pdf', text: `📄 ${info.name} · ${formatSize(info.size)}`, attachments: [info] };
}

/**
 * A share prepared by the assistant (share), or the card of an email draft that took files. The text is what
 * versions without the card show: where it goes and the file names, never the message text.
 */
export function shareItem(share: ShareOffer): ChatItem {
  const where = share.app === 'whatsapp' ? '🟢 WhatsApp' : share.app === 'email' ? '✉️' : '📤';
  const files = share.files.map((f) => f.name).join(', ');
  return { id: String(++itemCounter), kind: 'share', text: `${where} ${files}`.trim(), share };
}

/** A message the user sent, with the files attached to it. */
export function userItem(text: string, attachments: AttachmentInfo[]): ChatItem {
  return attachments.length
    ? { id: String(++itemCounter), kind: 'user', text, attachments }
    : { id: String(++itemCounter), kind: 'user', text };
}

export function newItem(kind: ChatItem['kind'], text: string, options?: string[]): ChatItem {
  return options ? { id: String(++itemCounter), kind, text, options } : { id: String(++itemCounter), kind, text };
}

/** Saved messages keep their ids, so new ones must continue after the highest. */
function continueItemIds(items: ChatItem[]) {
  itemCounter = Math.max(itemCounter, ...items.map((item) => Number(item.id) || 0));
}

/** A provider and model chosen for one conversation, instead of the default in Settings. */
export type ModelChoice = { provider: ProviderId; model: string };

/**
 * draft: what the user was typing, so it survives the app being closed. model: the conversation's own model
 * choice (absent: the default in Settings; not in conversations saved before it existed).
 */
export type SavedConversation = {
  items: ChatItem[];
  turns: Turn[];
  draft?: string;
  model?: ModelChoice;
  /** The voice-input language picked by hand for this conversation (a language or a tag, e.g. "tr", "en-GB"). */
  voiceLanguage?: string;
};

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
  /**
   * The provider and model for this conversation's next messages, chosen under the panel's title; null uses the
   * default in Settings (which this never changes). Read when a message is sent, so a running task keeps its model.
   */
  model: ModelChoice | null = null;
  /** Voice input listens in this language in this conversation (picked by hand); null: chosen automatically. */
  voiceLanguage: string | null = null;
  /**
   * How the last task ended, while the user has not looked at the conversation since (it ended in another tab or
   * group, with the panel closed, or with Qutai in the background). Cleared once the conversation is shown.
   */
  unseen: 'done' | 'failed' | 'needsAnswer' | null = null;
  /**
   * Files attached to the message being written, shown as thumbnails above the input until it is sent. Kept in
   * memory only (their files are pruned at the next start if the app closes first).
   */
  pending: AttachmentInfo[] = [];
  /** Saved messages have been read from disk (or there was nothing to read). */
  loaded = false;
  /** Reading the saved messages has started (so they are read only once). */
  loading = false;

  private loadedCallbacks: (() => void)[] = [];
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

  /** Runs fn once the saved messages have been read: right away if they have. */
  whenLoaded(fn: () => void) {
    if (this.loaded) fn();
    else this.loadedCallbacks.push(fn);
  }

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

  setUnseen(outcome: 'done' | 'failed' | 'needsAnswer' | null) {
    if (this.unseen === outcome) return;
    this.unseen = outcome;
    this.onChange();
  }

  setResearch(on: boolean) {
    this.research = on;
    this.onChange();
  }

  setModel(choice: ModelChoice | null) {
    this.model = choice;
    this.onChange();
  }

  setVoiceLanguage(language: string | null) {
    this.voiceLanguage = language;
    this.onChange();
  }

  /** Adds attachments to the message being written, up to MAX_ATTACHMENTS; returns those that didn't fit. */
  addPending(list: AttachmentInfo[]): AttachmentInfo[] {
    const room = Math.max(0, MAX_ATTACHMENTS - this.pending.length);
    this.pending = [...this.pending, ...list.slice(0, room)];
    this.onChange();
    return list.slice(room);
  }

  removePending(id: string) {
    this.pending = this.pending.filter((a) => a.id !== id);
    this.onChange();
  }

  /** The attachments of the message being sent; the input row is empty again. */
  takePending(): AttachmentInfo[] {
    const list = this.pending;
    this.pending = [];
    if (list.length) this.onChange();
    return list;
  }

  /** Every attachment the user sent in this conversation, oldest first: the manifest tools look ids up in. */
  get attachments(): AttachmentInfo[] {
    const out: AttachmentInfo[] = [];
    for (const item of this.items)
      for (const a of item.attachments ?? []) if (!out.some((b) => b.id === a.id)) out.push(a);
    for (const turn of this.turns) {
      if (turn.role !== 'user' || !turn.attachments) continue;
      for (const a of turn.attachments) if (!out.some((b) => b.id === a.id)) out.push(a);
    }
    return out;
  }

  /** The files composed with save_file in this conversation (from their cards), for tools that hand files out. */
  get composedFiles(): ComposedRef[] {
    return this.items.filter((item) => item.kind === 'file' && item.file).map((item) => item.file!);
  }

  /**
   * PDFs made outside the assistant's tools (an answer saved as a PDF from its menu) since the last message: the
   * next message tells the model their ids, so it can attach or share them when asked.
   */
  private unannounced: AttachmentInfo[] = [];

  /** Adds the card of a PDF Qutai made; `announce`: made by the user's tap, so the model hears of it with the next message. */
  addMadePdf(info: AttachmentInfo, announce: boolean) {
    this.add(pdfItem(info));
    if (announce) this.unannounced.push(info);
  }

  /** The note for the next message about PDFs made since the last one (and forgets them), or "". */
  takeMadeNote(): string {
    const list = this.unannounced;
    this.unannounced = [];
    if (!list.length) return '';
    return `[Since your last answer the user saved ${list.map((a) => `"${a.name}" (id=${a.id})`).join(', ')} as a PDF from an answer; it can be attached or shared by its id.]`;
  }

  /** Edited images given to a page in this run (upload_image): kept when old edited images are dropped. */
  private usedImages = new Set<string>();

  markImageUsed(id: string) {
    this.usedImages.add(id);
  }

  /**
   * Adds an edited image's card, then marks the oldest edited images over MAX_EDITED_IMAGES as expired and returns
   * their ids, for the caller to delete their files. Never the new one, one a kept image was made from, or one used.
   */
  addEditedImage(info: AttachmentInfo): string[] {
    this.add(imageItem(info));
    const live = this.items.filter((item) => item.kind === 'image' && !item.expired && item.attachments?.[0]);
    let excess = live.length - MAX_EDITED_IMAGES;
    if (excess <= 0) return [];
    const parents = new Set(live.map((item) => item.attachments![0].derivedFrom).filter(Boolean));
    const dropped: string[] = [];
    for (const item of live) {
      if (excess <= 0) break;
      const id = item.attachments![0].id;
      if (id === info.id || parents.has(id) || this.usedImages.has(id)) continue;
      dropped.push(id);
      excess--;
    }
    if (dropped.length) {
      this.items = this.items.map((item) =>
        item.kind === 'image' && dropped.includes(item.attachments?.[0]?.id ?? '') ? { ...item, expired: true } : item,
      );
      this.onChange();
    }
    return dropped;
  }

  /** Ids of every file this conversation refers to (sent or about to be), so pruning keeps them. */
  attachmentIds(): string[] {
    return [...this.attachments, ...this.pending].map((a) => a.id);
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
    // Something typed since the tab opened wins over the saved draft, and a model chosen since over the saved one.
    if (saved?.draft && !this.draft) this.draft = saved.draft;
    if (saved?.model && !this.model) this.model = saved.model;
    if (saved?.voiceLanguage && !this.voiceLanguage) this.voiceLanguage = saved.voiceLanguage;
    this.onChange();
    const callbacks = this.loadedCallbacks;
    this.loadedCallbacks = [];
    callbacks.forEach((fn) => fn());
  }

  /** A new chat: messages, history and the conversation's model and voice-language choices go. */
  clear() {
    this.items = [];
    this.unannounced = [];
    this.turns = [];
    this.model = null;
    this.voiceLanguage = null;
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
    return {
      items: this.items,
      turns: this.turns,
      draft: this.draft,
      ...(this.model ? { model: this.model } : {}),
      ...(this.voiceLanguage ? { voiceLanguage: this.voiceLanguage } : {}),
    };
  }
}
