/**
 * Files this conversation may hand out: the one place that decides what a tool may attach to an email draft, share
 * to another app or put into a web page's file field. Pure and without dependencies (src/device/outgoing.ts writes
 * the files).
 *
 * Eligible, each by a stable id the model sees in the conversation:
 * - images the user attached ("att-…"/"inc-…", listed with the message they came with) and edit_image results;
 * - PDFs the user attached;
 * - PDFs Qutai made in this conversation (save_pdf, or an answer saved as a PDF), kept as attachments of their own;
 * - files composed with save_file ("file-…"), while the app still holds them.
 *
 * Not eligible, by construction rather than by a check: screenshots of pages (view_screenshot), downloads, and
 * anything in the photo library or the file system the user did not bring into this conversation. None of them has
 * an id here, so no tool input can name them. That matters because tool inputs are shaped by web page content: a
 * page that talks the assistant into "attach your latest photo" or "send the screenshot of the other tab" must find
 * nothing to point at. Only what the user deliberately put into the conversation, or what the assistant made in it
 * at the user's request, can leave it, and it always leaves through a step the user completes (sending the email,
 * picking the chat, confirming the upload).
 */
import type { AttachmentInfo } from './attachments';

/** What a chat card for a composed file keeps (src/device/composedFile.ts FileOffer), as far as sharing needs it. */
export type ComposedRef = { id: string; name: string; format: string; size: number };

/** One file a tool may hand out, described without its content. */
export type Shareable = {
  id: string;
  name: string;
  mimeType: string;
  /** Bytes, as far as known before the file is prepared (an image may come out a little different). */
  size: number;
  kind: 'image' | 'pdf' | 'file';
  /** Where it came from, for tool results and cards. */
  origin: 'attached' | 'edited' | 'made' | 'composed';
  /** For images and PDFs: the attachment's manifest (thumbnails on cards). */
  attachment?: AttachmentInfo;
};

/** At most this many files in one email or share. */
export const MAX_OUTGOING_FILES = 10;
/**
 * At most this many bytes in one email or share, all files together. Common mail services accept about 25 MB per
 * message (attachments grow by a third when encoded), so 20 MB of files stays under that.
 */
export const MAX_OUTGOING_BYTES = 20 * 1024 * 1024;

const COMPOSED_MIME: Record<string, string> = {
  csv: 'text/csv',
  md: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
};

/** Composed files have "file-" ids (older cards had none and are not addressable). */
export const isComposedId = (id: string) => id.startsWith('file-');

/** The image a user attached goes out without its metadata; this is the MIME type of what goes out. */
function outgoingImageMime(a: AttachmentInfo): string {
  if (a.derivedFrom) return a.mimeType;
  return a.mimeType === 'image/png' || a.mimeType === 'image/webp' ? a.mimeType : 'image/jpeg';
}

/** An attachment of this conversation as a shareable file. */
export function shareableAttachment(a: AttachmentInfo): Shareable {
  if (a.kind === 'pdf')
    return { id: a.id, name: a.name, mimeType: 'application/pdf', size: a.size, kind: 'pdf', origin: a.made ? 'made' : 'attached', attachment: a };
  const mimeType = outgoingImageMime(a);
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const name = a.derivedFrom ? a.name : `${a.name.replace(/\.[a-z0-9]{2,5}$/i, '') || 'image'}.${ext}`;
  return { id: a.id, name, mimeType, size: a.size, kind: 'image', origin: a.derivedFrom ? 'edited' : 'attached', attachment: a };
}

export function shareableComposed(f: ComposedRef): Shareable {
  return { id: f.id, name: f.name, mimeType: COMPOSED_MIME[f.format] ?? 'text/plain', size: f.size, kind: 'file', origin: 'composed' };
}

/** Everything this conversation may hand out, oldest first. */
export function listShareables(attachments: AttachmentInfo[], composed: ComposedRef[]): Shareable[] {
  const seen = new Set<string>();
  const out: Shareable[] = [];
  for (const a of attachments) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(shareableAttachment(a));
  }
  for (const f of composed) {
    if (!isComposedId(f.id) || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(shareableComposed(f));
  }
  return out;
}

const ORIGIN_LABEL: Record<Shareable['origin'], string> = {
  attached: 'attached by the user',
  edited: 'edited image',
  made: 'PDF made by Qutai',
  composed: 'file made with save_file',
};

/** One line per file, for tool results. */
export function describeShareables(list: Shareable[]): string {
  return list.map((s) => `${s.id} "${s.name}" (${ORIGIN_LABEL[s.origin]})`).join(', ');
}

/** "1.2 MB": sizes in tool results. */
function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The files a tool call names (ids as the model gave them), or an error for the model. Every id must be found: an
 * unknown or ineligible id fails the whole call, so nothing is ever dropped quietly.
 */
export function pickShareables(raw: unknown, all: Shareable[]): { ok: true; items: Shareable[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, items: [] };
  const ids = (Array.isArray(raw) ? raw : [raw]).map((v) => String(v ?? '').trim()).filter(Boolean);
  const known = all.length
    ? `Files this conversation can hand out: ${describeShareables(all)}.`
    : 'This conversation has no files that can be handed out: only images and PDFs the user attached, edits of ' +
      'them, PDFs made with save_pdf and files made with save_file can be.';
  const items: Shareable[] = [];
  for (const id of ids) {
    const found = all.find((s) => s.id === id);
    if (!found) {
      return {
        ok: false,
        error:
          `"${id}" is not a file of this conversation. Only files the user attached or you made in this conversation ` +
          `can be sent; screenshots, downloads and other files on the phone cannot. ${known} Nothing was prepared.`,
      };
    }
    if (!items.includes(found)) items.push(found);
  }
  if (items.length > MAX_OUTGOING_FILES)
    return { ok: false, error: `At most ${MAX_OUTGOING_FILES} files can go at once. Nothing was prepared.` };
  const total = items.reduce((n, s) => n + s.size, 0);
  if (total > MAX_OUTGOING_BYTES) {
    return {
      ok: false,
      error:
        `These files come to ${mb(total)}; at most ${mb(MAX_OUTGOING_BYTES)} can go at once (mail services refuse ` +
        'larger messages). Send fewer, or make images smaller with edit_image (max_bytes). Nothing was prepared.',
    };
  }
  return { ok: true, items };
}

/** The MIME type for a share of several files: the common one, the common family ("image/*"), or any. */
export function commonMimeType(types: string[]): string {
  if (!types.length) return 'text/plain';
  if (types.every((m) => m === types[0])) return types[0];
  const family = types[0].split('/')[0];
  return types.every((m) => m.split('/')[0] === family) ? `${family}/*` : '*/*';
}

/** Where a share goes: WhatsApp (or WhatsApp Business), or any app the user picks in the share sheet. */
export type ShareApp = 'whatsapp' | 'any';

/**
 * Whether text given with files reaches the receiving app reliably. Android sends it in EXTRA_TEXT with the files,
 * and WhatsApp shows it as the caption; other apps may ignore it. On iOS each app's share extension decides what it
 * takes from the share sheet, so the text may be left out. Where it may not travel, the text is copied to the
 * clipboard on the tap as well, and the card says so.
 */
export function textTravelsWithFiles(platform: string, app: ShareApp): boolean {
  return platform === 'android' && app === 'whatsapp';
}

/** The packages a WhatsApp share is sent to on Android, tried in order (the regular app, then WhatsApp Business). */
export const WHATSAPP_PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'];

/**
 * What a share card keeps (saved with the conversation): where it goes, the text, the number the user gave (shown
 * so they can find the chat; it can't be preselected with files), and the files described without content.
 * `app: "email"` is the card of an email draft that took files: it shows where they went and has no button.
 */
export type ShareOffer = {
  app: ShareApp | 'email';
  text?: string;
  number?: string;
  name?: string;
  files: Shareable[];
  /** Images the user attached go out as picked, metadata included (they asked for the original). */
  original?: boolean;
  /** Email: the subject and recipients, and where the files went. */
  subject?: string;
  to?: string[];
  delivered?: 'composer' | 'share';
  /** The text will be (or was) copied on the tap, as it may not travel with the files. */
  copiesText?: boolean;
};
