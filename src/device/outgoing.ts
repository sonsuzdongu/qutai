import { Directory, File, Paths } from 'expo-file-system';
import { MAX_OUTGOING_BYTES, type Shareable } from '../chat/shareable';
import { originalFile } from './attachments';
import { composedFileContent, FileExpiredError } from './composedFile';
import { safeFileName } from './download';
import { uploadableImage } from './imageEdit';

/**
 * The files handed to another app (an email draft, a share) or to a web page, prepared from the conversation's
 * shareable files (src/chat/shareable.ts, which decides what is eligible).
 *
 * Each hand-out gets a folder of its own in the cache with copies under readable names ("Offer.pdf", not
 * "original.pdf"). Images the user attached go out re-encoded, which leaves out EXIF and other metadata such as the
 * place a photo was taken, unless the user explicitly asked for the original file; edited images are already free
 * of it. The receiving app may read the files after Qutai is back on screen (Android hands over content URIs that
 * are read when the user attaches or sends), so a folder is kept for a while: older ones go at the next hand-out,
 * all of them at every start, and incognito ones as soon as the incognito session ends.
 */

export type OutgoingFile = { id: string; uri: string; name: string; mimeType: string; size: number };

/** Why the files could not be prepared; `name` is the file concerned. */
export class OutgoingError extends Error {
  constructor(
    public code: 'gone' | 'tooLarge' | 'failed',
    public fileName: string,
    detail?: string,
  ) {
    super(detail ?? code);
  }
}

/** For tool results. */
export function outgoingErrorText(e: unknown): string {
  if (e instanceof OutgoingError) {
    if (e.code === 'gone')
      return `"${e.fileName}" is no longer on this phone (cleared, or the app restarted since it was made). Nothing was prepared.`;
    if (e.code === 'tooLarge')
      return `Prepared, the files come to more than ${Math.round(MAX_OUTGOING_BYTES / 1048576)} MB. Send fewer or smaller files. Nothing was prepared.`;
    return `"${e.fileName}" could not be prepared: ${e.message}. Nothing was prepared.`;
  }
  return `The files could not be prepared: ${e instanceof Error ? e.message : String(e)}. Nothing was prepared.`;
}

const NORMAL_DIR = 'outgoing';
const INCOGNITO_DIR = 'outgoing-incognito';
/** A hand-out's copies are kept this long for the receiving app, then go at the next hand-out. */
const KEEP_MS = 30 * 60 * 1000;

function rootDir(incognito: boolean): Directory {
  return new Directory(Paths.cache, incognito ? INCOGNITO_DIR : NORMAL_DIR);
}

/** Removes hand-out folders older than `maxAge` (all of them with 0). Folder names start with the time in base 36. */
function sweep(maxAge: number) {
  const now = Date.now();
  for (const incognito of [false, true]) {
    const root = rootDir(incognito);
    if (!root.exists) continue;
    for (const entry of root.list()) {
      const made = parseInt(entry.name.split('-')[0], 36);
      if (maxAge === 0 || !(now - made < maxAge)) {
        try {
          entry.delete();
        } catch {
          // Still being read; the next sweep takes it.
        }
      }
    }
  }
}

/** At start: nothing from an earlier run is needed any more. */
export function clearOutgoing() {
  sweep(0);
}

/** The incognito session ended: its hand-outs leave nothing behind. */
export function forgetIncognitoOutgoing() {
  const root = rootDir(true);
  if (root.exists) root.delete();
}

/** "name.ext", or "name (2).ext" when the hand-out already has one by that name. */
function uniqueName(name: string, taken: Set<string>): string {
  let candidate = name;
  const dot = name.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})${ext}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

export type Prepared = { files: OutgoingFile[]; incognito: boolean; dispose: () => void };

/**
 * Copies the files into a new hand-out folder. `original`: images the user attached go out as picked, metadata
 * included (only when the user asked for the original). Throws OutgoingError.
 */
export async function prepareOutgoing(items: Shareable[], options: { incognito: boolean; original?: boolean }): Promise<Prepared> {
  sweep(KEEP_MS);
  const dir = new Directory(rootDir(options.incognito), `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  dir.create({ intermediates: true, idempotent: true });
  const taken = new Set<string>();
  const files: OutgoingFile[] = [];
  const dispose = () => {
    try {
      if (dir.exists) dir.delete();
    } catch {
      // Removed by the next sweep.
    }
  };
  try {
    for (const item of items) {
      const target = new File(dir, uniqueName(safeFileName(item.name, 'file'), taken));
      let mimeType = item.mimeType;
      if (item.kind === 'file') {
        let text: string;
        try {
          text = composedFileContent(item.id).text;
        } catch (e) {
          if (e instanceof FileExpiredError) throw new OutgoingError('gone', item.name);
          throw e;
        }
        target.create();
        target.write(text);
      } else if (item.kind === 'pdf' || options.original) {
        const source = originalFile(item.id);
        if (!source) throw new OutgoingError('gone', item.name);
        if (item.kind === 'image' && item.attachment) {
          mimeType = item.attachment.mimeType;
          const named = new File(dir, uniqueName(safeFileName(item.attachment.name, 'image'), taken));
          source.copySync(named);
          files.push({ id: item.id, uri: named.uri, name: named.name, mimeType, size: named.size });
          continue;
        }
        source.copySync(target);
      } else {
        if (!item.attachment) throw new OutgoingError('failed', item.name, 'no manifest');
        if (!originalFile(item.id)) throw new OutgoingError('gone', item.name);
        let image: Awaited<ReturnType<typeof uploadableImage>>;
        try {
          image = await uploadableImage(item.attachment);
        } catch (e) {
          throw new OutgoingError('failed', item.name, e instanceof Error ? e.message : String(e));
        }
        try {
          image.file.copySync(target);
          mimeType = image.mimeType;
        } finally {
          if (image.temporary && image.file.exists) image.file.delete();
        }
      }
      files.push({ id: item.id, uri: target.uri, name: target.name, mimeType, size: target.size });
    }
    if (files.reduce((n, f) => n + f.size, 0) > MAX_OUTGOING_BYTES) throw new OutgoingError('tooLarge', '');
    return { files, incognito: options.incognito, dispose };
  } catch (e) {
    dispose();
    throw e;
  }
}
