import { droppedImageNote, KEEP_IMAGE_MESSAGES, MAX_SENT_IMAGES } from '../chat/attachments';
import type { Turn } from '../ai/types';
import { cutText } from '../utils/wellFormed';

/** The newest large tool results (page snapshots) always sent in full. */
export const KEEP_FULL_RESULTS = 2;
/**
 * Older large results are compacted this many at a time, not one per step: compacting changes the history in the
 * middle, which ends every provider's prompt cache at that point, so the next request pays for the rest of the
 * history again. In batches the history stays the same for COMPACT_BATCH - 1 steps out of COMPACT_BATCH, and between
 * KEEP_FULL_RESULTS and KEEP_FULL_RESULTS + COMPACT_BATCH - 1 results are sent in full.
 */
export const COMPACT_BATCH = 2;
const KEEP_IMAGES = 1;
/** Results longer than this (in characters) are the ones compacted. */
export const COMPACT_THRESHOLD = 1500;

/**
 * Page snapshots are large. Keep only the most recent ones in full so long sessions don't blow up cost and latency;
 * older ones are cut to their first 300 characters, in batches (COMPACT_BATCH) so the history sent stays a stable,
 * cacheable prefix between batches. Which results are compacted depends only on the turns, never on when the
 * request is made, so the same history always gives the same request.
 *
 * Images the user attached stay with the KEEP_IMAGE_MESSAGES most recent user messages (MAX_SENT_IMAGES at most);
 * older ones are taken off the turn and named in its text instead, so the model can still refer to them by id.
 */
/** The result a call gets when its task ended before it returned (Stop, a crash, Qutai killed mid-step). */
export const UNFINISHED_CALL = 'Not executed: the task ended before this call finished.';

/**
 * Every tool call followed by its result, as every provider requires: a call whose result never came (the task was
 * stopped or Qutai was killed while it ran) gets one saying so, in call order. The last turn is left as it is: an
 * answer that paused mid-search is continued with the next request, never answered with results. Returns the same
 * array when nothing is missing.
 */
export function pairToolCalls(turns: Turn[]): Turn[] {
  let out: Turn[] | null = null;
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const next = turns[i + 1];
    if (turn.role !== 'assistant' || !turn.toolCalls.length || !next) {
      out?.push(turn);
      continue;
    }
    const results = next.role === 'tool_results' ? next.results : [];
    const missing = turn.toolCalls.filter((c) => !results.some((r) => r.callId === c.id));
    if (!missing.length) {
      out?.push(turn);
      continue;
    }
    out ??= turns.slice(0, i);
    out.push(turn, {
      role: 'tool_results',
      results: turn.toolCalls.map(
        (c) => results.find((r) => r.callId === c.id) ?? { callId: c.id, name: c.name, content: UNFINISHED_CALL, isError: true },
      ),
    });
    if (next.role === 'tool_results') i++;
  }
  return out ?? turns;
}

export function compactHistory(turns: Turn[], maxImages?: number, batch = COMPACT_BATCH): Turn[] {
  turns = pairToolCalls(turns);
  // A server's limit on images per request (Qutai Credits' maxImages) leaves room for the latest screenshot.
  const userImageCap = maxImages ? Math.max(0, Math.min(MAX_SENT_IMAGES, maxImages - KEEP_IMAGES)) : MAX_SENT_IMAGES;
  // The oldest `cut` of the large results are cut: none until there are more than KEEP_FULL_RESULTS, then
  // whole batches of `batch`.
  let large = 0;
  for (const turn of turns) {
    if (turn.role === 'tool_results') for (const r of turn.results) if (r.content.length > COMPACT_THRESHOLD) large++;
  }
  const step = Math.max(1, Math.floor(batch));
  const cut = large <= KEEP_FULL_RESULTS ? 0 : Math.floor((large - KEEP_FULL_RESULTS) / step) * step;
  let kept = large - cut;
  let keptImages = 0;
  let userMessages = 0;
  let userImages = 0;
  const out: Turn[] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn.role === 'user') {
      const images = turn.attachments?.filter((a) => a.kind === 'image') ?? [];
      const recent = userMessages++ < KEEP_IMAGE_MESSAGES;
      if (images.length && recent && userImages + images.length <= userImageCap) {
        userImages += images.length;
        out.unshift(turn);
      } else if (images.length) {
        const others = turn.attachments!.filter((a) => a.kind !== 'image');
        const notes = images.map(droppedImageNote).join('\n');
        const compacted = { ...turn, text: `${turn.text}\n${notes}` };
        if (others.length) compacted.attachments = others;
        else delete compacted.attachments;
        out.unshift(compacted);
      } else {
        out.unshift(turn);
      }
      continue;
    }
    if (turn.role !== 'tool_results') {
      out.unshift(turn);
      continue;
    }
    const results = [...turn.results].reverse().map((original) => {
      let r = original;
      // Screenshots cost far more than text, so only the latest ones are kept.
      if (r.images?.length) {
        if (keptImages < KEEP_IMAGES) keptImages++;
        else r = { ...r, images: undefined, content: `${r.content}\n[Older screenshot removed]` };
      }
      if (original.content.length <= COMPACT_THRESHOLD) return r;
      if (kept > 0) {
        kept--;
        return r;
      }
      return { ...r, content: `${cutText(r.content, 300)}\n[Older page snapshot removed]` };
    });
    out.unshift({ role: 'tool_results', results: results.reverse() });
  }
  return out;
}
