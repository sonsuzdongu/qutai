import { hiddenLabel, hiddenValue, Memory } from './memory';

/**
 * Hidden memories (memory.sensitive): the AI provider sees only what they are ("national ID number"), never the value.
 * The model asks for one with type's `memory` parameter, Qutai puts the value into the page itself (executeTool.ts),
 * and every tool result is passed through `redactHidden` before it goes back to the model, into the conversation or
 * into a log, so a page that prints the value (a field's value in read_page, the HTML in read_source, a validation
 * message) shows "[hidden: national ID number]" instead. Pure code; nothing here keeps or logs a value.
 *
 * Matching: the value's letters and digits in order, case-insensitively (Turkish i forms alike). A value without
 * spaces (an ID or passport number) also matches with spaces, dashes, dots or slashes between any of its characters
 * ("123 456 789 01"); one of several words matches with any punctuation, spaces or URL-escapes ("%20", "+") between
 * the words. Values with fewer than 4 letters and digits are not looked for (they would match everywhere).
 *
 * Limits: a value the page shows another way (reformatted with other characters, transliterated, HTML- or
 * JSON-escaped letters, split over separate elements, or inside an image) is not recognised.
 */

export type HiddenNeedle = { pattern: RegExp; marker: string };

const MIN_CHARS = 4;

/** One letter as a pattern: the Turkish i forms and case folded together; letters and digits need no escaping. */
function charPattern(ch: string): string {
  if (/[iIİı]/.test(ch)) return '[iIİı]';
  return ch;
}

/** The pattern that finds `value` in page text, or null when it is too short to look for. */
export function valuePattern(value: string): RegExp | null {
  const words = value.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.join('').length < MIN_CHARS) return null;
  const source =
    words.length === 1
      ? [...words[0]].map(charPattern).join('[\\s\\-./]*')
      : words.map((w) => [...w].map(charPattern).join('')).join('(?:[^\\p{L}\\p{N}]|%[0-9A-Fa-f]{2})+');
  return new RegExp(source, 'giu');
}

/** What to look for in tool results; empty when nothing is hidden (callers then skip the scan). */
export function hiddenNeedles(memories: Memory[]): HiddenNeedle[] {
  const needles: HiddenNeedle[] = [];
  for (const memory of memories) {
    if (!memory.sensitive) continue;
    const marker = `[hidden: ${hiddenLabel(memory)}]`;
    // The bare value, and the whole saved text in case a page echoes it with its label.
    for (const text of new Set([hiddenValue(memory), memory.text])) {
      const pattern = valuePattern(text);
      if (pattern) needles.push({ pattern, marker });
    }
  }
  // Longer patterns first, so the whole text is replaced before the value inside it.
  return needles.sort((a, b) => b.pattern.source.length - a.pattern.source.length);
}

/** `text` with every hidden value replaced by its marker. */
export function redactHidden(text: string, needles: HiddenNeedle[]): string {
  if (!needles.length || !text) return text;
  let out = text;
  for (const { pattern, marker } of needles) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, marker);
  }
  return out;
}

/** Whether `text` holds a hidden value (screenshots: a field or page text that would show one). */
export function containsHidden(text: string, needles: HiddenNeedle[]): boolean {
  return needles.some(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/** A memory id as shown in the prompt (`[k3j2h1abcd]` without the brackets). */
export const MEMORY_ID = /^[a-z0-9]{4,24}$/;
