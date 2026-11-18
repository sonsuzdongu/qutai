/**
 * Files the user attaches to a message: what the conversation keeps about each one (a small manifest), and the
 * text the model gets about them. Pure and without dependencies, so it can be exercised outside the app; the files
 * themselves are handled by src/device/attachments.ts.
 *
 * Each attachment has a stable id ("att-…", or "inc-…" in an incognito conversation) that tools refer to. Images
 * are kept twice on the device: the original as it was picked (never sent anywhere, and no tool reads its
 * metadata), and a copy for the model, made once when it is attached: orientation applied, metadata stripped,
 * longest side at most MODEL_LONG_EDGE and at most MODEL_MAX_BYTES.
 */

import type { Filters } from './imageFilters';

export type AttachmentKind = 'image' | 'pdf';

/** What the conversation keeps about an attachment (in its messages and history); no file content. */
export type AttachmentInfo = {
  id: string;
  kind: AttachmentKind;
  /** File name as picked, or made up ("photo-….jpg" for camera photos). */
  name: string;
  /** Of the original file. */
  mimeType: string;
  /** Bytes of the original file. */
  size: number;
  /** Images: pixels of the original as displayed (orientation applied). */
  width?: number;
  height?: number;
  /** Images: the copy the model gets. */
  model?: { width: number; height: number; mimeType: 'image/jpeg' | 'image/png'; size: number };
  /** Edited images (edit_image, "Resize or crop"): the id of the image this one was made from. */
  derivedFrom?: string;
  /** Edited images: what was done, in a short line ("cropped to 1:1 …; resized to 1024×1024; JPEG quality 90"). */
  edits?: string;
  /** Edited images: the filters applied (only those set), for the card's translated summary. */
  filters?: Partial<Filters>;
  /**
   * PDFs Qutai made in this conversation (not attached by the user): "page" from save_pdf, "report" from an answer
   * saved as a PDF. Kept like attachments so they can be shared, attached to an email or uploaded later.
   */
  made?: 'page' | 'report';
};

/** At most this many files per message. */
export const MAX_ATTACHMENTS = 4;

/**
 * Longest side of the model's copy. Anthropic's standard tier resizes anything larger to 1568 px; OpenAI's "high"
 * detail fits 2048 px and Gemini tiles at 768 px, so 1568 px loses nothing on Anthropic and keeps costs predictable
 * elsewhere.
 */
export const MODEL_LONG_EDGE = 1568;
/** Bytes of the model's copy at most (well under Anthropic's 10 MB per image and Gemini's 20 MB per request). */
export const MODEL_MAX_BYTES = 1_000_000;
/** JPEG quality of the model's copy; lowered step by step while the copy is over MODEL_MAX_BYTES. */
export const MODEL_JPEG_QUALITY = [0.82, 0.7, 0.55];

/**
 * Retention: images attached to the KEEP_IMAGE_MESSAGES most recent user messages are sent with every request,
 * and at most MAX_SENT_IMAGES of them; older ones are left out and replaced by a line of text naming them, so the
 * model knows they exist and can look again with view_attachment.
 */
export const KEEP_IMAGE_MESSAGES = 3;
/**
 * Edited images (edit_image) a conversation keeps on the phone; beyond this the oldest ones nothing depends on (no
 * later edit was made from them, none was given to a page in this run) lose their files, and their cards say so.
 */
export const MAX_EDITED_IMAGES = 12;
export const MAX_SENT_IMAGES = 8;

/** The longest side scaled down to `edge`, keeping the aspect ratio; never enlarged. */
export function fitWithin(width: number, height: number, edge = MODEL_LONG_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!(longest > edge)) return { width: Math.round(width), height: Math.round(height) };
  const scale = edge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const dims = (a: AttachmentInfo) => (a.width && a.height ? `${a.width}×${a.height}` : '');

/** How an attachment is called in the text: "image 1", "PDF 2". */
export function attachmentLabel(a: AttachmentInfo, index: number): string {
  return `${a.kind === 'pdf' ? 'PDF' : 'image'} ${index + 1}`;
}

/** One line per attachment, for the message text the model gets (so tools can be asked to act on "image 1"). */
export function describeAttachments(list: AttachmentInfo[]): string {
  if (!list.length) return '';
  const lines = list.map((a, i) => {
    const parts = [`${attachmentLabel(a, i)}: id=${a.id}`, JSON.stringify(a.name)];
    if (a.kind === 'image') {
      if (dims(a)) parts.push(dims(a));
      if (a.model && (a.model.width !== a.width || a.model.height !== a.height))
        parts.push(`you see it at ${a.model.width}×${a.model.height}`);
    } else {
      parts.push('call read_pdf with this id to read it');
    }
    return `- ${parts.join(', ')}`;
  });
  return `[The user attached:\n${lines.join('\n')}]`;
}

/** Said in place of an image that is no longer sent with requests. */
export function droppedImageNote(a: AttachmentInfo): string {
  const size = dims(a) ? `, ${dims(a)}` : '';
  return `[image: ${a.name}${size}, id=${a.id}, attached earlier and not shown any more; call view_attachment with this id to see it again]`;
}

/** Said in place of an image whose file is gone (cleared, or a restored backup without attachments). */
export function missingImageNote(a: AttachmentInfo): string {
  return `[image: ${a.name}, id=${a.id}, no longer available on this phone]`;
}

/** Ids in a piece of saved JSON (conversations), for pruning files nothing refers to. */
export function attachmentIdsIn(json: string): string[] {
  return json.match(/\b(?:att|inc)-[a-z0-9]{6,24}\b/g) ?? [];
}

let counter = 0;

/** A new id; incognito ones are told apart by their prefix (their files live in a session-only folder). */
export function newAttachmentId(incognito: boolean): string {
  counter = (counter + 1) % 1296;
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${incognito ? 'inc' : 'att'}-${Date.now().toString(36)}${counter.toString(36).padStart(2, '0')}${rand}`;
}

export const isIncognitoAttachment = (id: string) => id.startsWith('inc-');
