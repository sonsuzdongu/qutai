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
const SCREENSHOT_REMOVED = '\n[Older screenshot removed]';
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
        else r = { ...r, images: undefined, content: `${r.content}${SCREENSHOT_REMOVED}` };
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

/**
 * Long conversations get a bounded request (PERF-11). The history before the current message is what gets trimmed;
 * the current message and the steps of the task it started are always sent whole (compacted as above), so nothing
 * changes inside a task and each step keeps reading the previous one from the provider's prompt cache (Anthropic's
 * breakpoint on the last user message, OpenAI's and Gemini's prefix caching; ai/anthropic.ts withHistoryBreakpoint).
 * The system prompt and tools are not part of the history and are never touched.
 *
 * Over MAX_HISTORY_CHARS (counted as JSON text, an image as IMAGE_CHARS), in this order:
 * 1. the results of tools in earlier messages are cut to OLD_RESULT_CHARS (their screenshots and attached images are
 *    already gone, see compactHistory);
 * 2. whole earlier exchanges (a user message and everything up to the next) are left out from the oldest, in a block:
 *    once the earlier part passes MAX_HISTORY_CHARS it is brought down to TRIMMED_HISTORY_CHARS, so the start of the
 *    history, and with it the cache, changes only once in a while, not with every message. Which exchanges go is
 *    worked out from the history alone (as if it had grown message by message), so the same history always gives
 *    the same request. A cut is only ever before a user message: a tool call never loses its result.
 * The first message kept says that earlier ones were left out.
 */
export const MAX_HISTORY_CHARS = 300_000;
export const TRIMMED_HISTORY_CHARS = 150_000;
export const OLD_RESULT_CHARS = 200;
/** What an image counts for (a screenshot is about 1,500 tokens, about 6,000 characters of text). */
export const IMAGE_CHARS = 6_000;
export const LEFT_OUT_NOTE = '[Earlier messages of this conversation were left out to keep the request small.]';

/** A turn's size as it is sent: its JSON text, with each image counted as IMAGE_CHARS instead of its data. */
export function turnSize(turn: Turn): number {
  let images = 0;
  const text = JSON.stringify(turn, (key, value) => {
    if (key === 'images' && Array.isArray(value)) {
      images += value.length;
      return undefined;
    }
    return value;
  });
  return text.length + images * IMAGE_CHARS;
}

const sizeOf = (turns: Turn[]) => turns.reduce((sum, turn) => sum + turnSize(turn), 0);

/** Earlier tool results cut short (step 1). */
function shortenResults(turn: Turn): Turn {
  if (turn.role !== 'tool_results') return turn;
  let changed = false;
  const results = turn.results.map((r) => {
    if (r.content.length <= OLD_RESULT_CHARS && !r.images?.length) return r;
    changed = true;
    return { ...r, images: undefined, content: `${cutText(r.content, OLD_RESULT_CHARS)}\n[Older result shortened]` };
  });
  return changed ? { role: 'tool_results', results } : turn;
}

/** The request's history for long conversations: see MAX_HISTORY_CHARS. Takes compacted turns. */
export function boundHistory(turns: Turn[]): Turn[] {
  let current = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === 'user') {
      current = i;
      break;
    }
  }
  // Nothing earlier, or small enough: sent as it is.
  if (current <= 0 || sizeOf(turns.slice(0, current)) <= MAX_HISTORY_CHARS) return turns;
  const earlier = turns.slice(0, current).map(shortenResults);
  // Exchanges: each starts at a user message (the history may start with a turn that isn't one, kept with the first).
  const starts = earlier.flatMap((turn, i) => (i === 0 || turn.role === 'user' ? [i] : []));
  const sizes = starts.map((start, k) => sizeOf(earlier.slice(start, starts[k + 1] ?? earlier.length)));
  let cut = 0;
  let window = 0;
  for (let k = 0; k < sizes.length; k++) {
    window += sizes[k];
    if (window <= MAX_HISTORY_CHARS) continue;
    while (window > TRIMMED_HISTORY_CHARS && cut < k) window -= sizes[cut++];
  }
  const kept = earlier.slice(starts[cut] ?? 0);
  if (cut > 0 && kept[0]?.role === 'user') kept[0] = { ...kept[0], text: `${LEFT_OUT_NOTE}\n\n${kept[0].text}` };
  return [...kept, ...turns.slice(current)];
}

/** The history a request is built from: compacted (compactHistory), then bounded (boundHistory). */
export function requestHistory(turns: Turn[], maxImages?: number): Turn[] {
  return boundHistory(compactHistory(turns, maxImages));
}

/**
 * Screenshots kept in memory (PERF-11): only the newest KEEP_IMAGES tool results keep their images in the
 * conversation; older ones lose them in place, with the same note compactHistory gives them, so every request is
 * byte for byte what it was (the prompt cache is unaffected). Attached images are files, read for each request.
 */
export function releaseOldImages(turns: Turn[]): void {
  let kept = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn.role !== 'tool_results') continue;
    for (let j = turn.results.length - 1; j >= 0; j--) {
      const r = turn.results[j];
      if (!r.images?.length) continue;
      if (kept < KEEP_IMAGES) {
        kept++;
        continue;
      }
      const content = `${r.content}${SCREENSHOT_REMOVED}`;
      // The note would make a result count as a large one for compaction: kept as it is (rare: screenshots say little).
      if (r.content.length <= COMPACT_THRESHOLD && content.length > COMPACT_THRESHOLD) continue;
      turn.results[j] = { ...r, images: undefined, content };
    }
  }
}
