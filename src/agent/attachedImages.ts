import { missingImageNote } from '../chat/attachments';
import type { Turn } from '../ai/types';
import { modelImageData } from '../device/attachments';

/**
 * Adds the model copies of attached images to the user turns that still carry them (after compactHistory), on new
 * turn objects: the saved history never holds image data. An image whose file is gone (cleared, or a conversation
 * restored from a backup, which leaves attachments out) is named in the text instead.
 */
export async function withAttachedImages(turns: Turn[]): Promise<Turn[]> {
  return Promise.all(
    turns.map(async (turn) => {
      if (turn.role !== 'user' || !turn.attachments?.some((a) => a.kind === 'image')) return turn;
      const images: NonNullable<Extract<Turn, { role: 'user' }>['images']> = [];
      const missing: string[] = [];
      for (const a of turn.attachments) {
        if (a.kind !== 'image') continue;
        const data = a.model ? await modelImageData(a.id).catch(() => null) : null;
        if (data && a.model) images.push({ mediaType: a.model.mimeType, data });
        else missing.push(missingImageNote(a));
      }
      return {
        ...turn,
        text: missing.length ? `${turn.text}\n${missing.join('\n')}` : turn.text,
        ...(images.length ? { images } : {}),
      };
    }),
  );
}
