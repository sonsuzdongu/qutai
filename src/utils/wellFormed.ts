/**
 * Text that reaches a model must be well-formed UTF-16: no half of a surrogate pair on its own. JavaScript strings
 * may hold one (an emoji cut in two by `.slice`, or a page that has one in its text), and `JSON.stringify` writes
 * it as an escape such as `\ud83e` that the providers' strict JSON parsers refuse ("The request body is not valid
 * JSON: unexpected end of hex escape"). Once such a string is in a conversation's history every later request of
 * that conversation fails the same way.
 *
 * Two lines of defence: text is cut on code point boundaries where it is cut (`cutText`, `sliceText`), and every
 * request body is serialised with `wellFormedJson`, which replaces whatever lone surrogate is still there with
 * U+FFFD, so old conversations, backups and anything missed recover on their next send.
 *
 * No imports: the credits client and the Node tests use it too. The page script (src/browser/pageScript.ts) has its
 * own copy of `cutText` / `wellFormed`, since it runs inside the page.
 */

const isHigh = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLow = (c: number) => c >= 0xdc00 && c <= 0xdfff;

/** Any surrogate code unit: a fast test before the slower pass. */
const ANY_SURROGATE = /[\ud800-\udfff]/;
/** A pair (kept) or a lone surrogate (replaced). No `u` flag and no lookbehind: every engine the app runs on. */
const PAIR_OR_LONE = /[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;

type MaybeWellFormed = { isWellFormed?: () => boolean; toWellFormed?: () => string };
// ES2024. Hermes may not have it; feature-tested once, with the regex as fallback.
const nativeToWellFormed = typeof (String.prototype as MaybeWellFormed).toWellFormed === 'function';

/** The string with every lone surrogate replaced by U+FFFD; the same string when it is already well-formed. */
export function wellFormed(text: string): string {
  if (!ANY_SURROGATE.test(text)) return text;
  if (nativeToWellFormed) return (text as unknown as Required<MaybeWellFormed>).toWellFormed();
  return text.replace(PAIR_OR_LONE, (m) => (m.length === 2 ? m : '�'));
}

/** No lone surrogate in the string. */
export function isWellFormed(text: string): boolean {
  if (!ANY_SURROGATE.test(text)) return true;
  return wellFormed(text) === text;
}

/**
 * The first `max` code units at most, never ending on the first half of a surrogate pair (the pair is left out
 * whole). Use it wherever text is cut to a length: `.slice(0, max)` can split an emoji.
 */
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 0) return '';
  return isHigh(text.charCodeAt(max - 1)) && isLow(text.charCodeAt(max)) ? text.slice(0, max - 1) : text.slice(0, max);
}

/** A boundary moved back off the middle of a surrogate pair, for paging through text by offsets. */
export function pairBoundary(text: string, at: number): number {
  return at > 0 && at < text.length && isHigh(text.charCodeAt(at - 1)) && isLow(text.charCodeAt(at)) ? at - 1 : at;
}

/** `text.slice(start, end)` with both ends moved back off the middle of a surrogate pair. */
export function sliceText(text: string, start: number, end = text.length): string {
  return text.slice(pairBoundary(text, start), pairBoundary(text, end));
}

/**
 * An escape in serialised JSON, matched from the left so `\\` (an escaped backslash) is one token and the text
 * `\\ud83e` is never taken for an escape. Group 1 is a `\uD800`–`\uDFFF` escape, two in a row when they form a pair.
 */
const JSON_ESCAPE = /\\(u[dD][89abAB][0-9a-fA-F]{2}\\u[dD][c-fC-F][0-9a-fA-F]{2}|u[dD][89a-fA-F][0-9a-fA-F]{2}|[\s\S])/g;
const SURROGATE_ESCAPE = /\\u[dD][89a-fA-F]/;

/**
 * `JSON.stringify` for a request body that a provider will parse strictly: every lone surrogate in any string of
 * `value` comes out as U+FFFD. Costs one regex test over the result when nothing needs fixing, so it is cheap for
 * large conversations. Well-formed text is untouched, so the provider's own output replayed byte for byte (thinking
 * signatures, the paused-turn continuation the relay fingerprints) is sent exactly as received.
 *
 * Covers both engines' behaviour: a well-formed `JSON.stringify` (ES2019, as in V8 and Node) writes a lone surrogate
 * as a `\udXXX` escape; an older one would leave it raw in the output.
 */
export function wellFormedJson(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? json : wellFormedJsonText(json);
}

/**
 * Serialised JSON with every lone surrogate in it, raw or escaped, replaced by U+FFFD: for JSON made elsewhere (the
 * page script's replies, parsed in Tab.ts), so what it holds is well-formed once parsed.
 */
export function wellFormedJsonText(json: string): string {
  json = wellFormed(json);
  if (!SURROGATE_ESCAPE.test(json)) return json;
  return json.replace(JSON_ESCAPE, (m, esc: string) =>
    // Group 1 is one character (any other escape), a pair (another writer may escape one: kept) or a lone surrogate.
    esc.length === 5 ? '\\ufffd' : m,
  );
}
