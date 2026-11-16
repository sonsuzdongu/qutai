// Whether the model's name still has room beside the Qutai Credits balance under the assistant panel's title
// (AssistantPanel.tsx). The balance is always shown in full; the name goes when too little of it would be left.

/** Below this the name would be a few letters and "…": it goes instead. */
export const MIN_LABEL_WIDTH = 56;
/** The " · " between the name and the balance, and the arrow after them, at font scale 1 (points). */
const SEPARATOR = 12;
const ARROW = 17;

/**
 * `room`: the width under the title; `balance`: the balance text's measured width (0 before it is measured: the name
 * shows until then); `label`: the name's full width (0 when not measured yet); `fontScale`: the text scale, capped
 * like the texts (maxFontSizeMultiplier 1.4). The name shows when it fits whole, or when enough of it is left to read.
 */
export function statusLabelFits(room: number, balance: number, label: number, fontScale: number): boolean {
  if (room <= 0 || balance <= 0) return true;
  const scale = Math.min(Math.max(fontScale, 1), 1.4);
  const left = room - balance - (SEPARATOR + ARROW) * scale;
  const needed = label > 0 ? Math.min(label, MIN_LABEL_WIDTH * scale) : MIN_LABEL_WIDTH * scale;
  return left >= needed;
}

/**
 * Own key or custom endpoint: whether the whole line ("Anthropic · Claude Sonnet 5.5") fits under the title with the
 * arrow. When it does not, the line becomes the model alone (see compactModelName), shortened at its end if needed,
 * so it is never cut in the middle of the provider's name. `full`: the whole line's measured width (0 before it is
 * measured: the shorter line shows until then).
 */
export function statusFullFits(room: number, full: number, fontScale: number): boolean {
  if (room <= 0 || full <= 0) return false;
  const scale = Math.min(Math.max(fontScale, 1), 1.4);
  return full + ARROW * scale <= room;
}

/**
 * The model's name without its maker, for the short line: "Anthropic: Claude Sonnet 5.5" (OpenRouter's catalog)
 * becomes "Claude Sonnet 5.5", an id like "meta-llama/llama-4-maverick" becomes "llama-4-maverick".
 */
export function compactModelName(name: string): string {
  const trimmed = name.trim();
  const colon = /^[^:/]{1,40}:\s+(\S.*)$/.exec(trimmed);
  if (colon) return colon[1];
  const slash = trimmed.lastIndexOf('/');
  if (slash > 0 && slash < trimmed.length - 1) return trimmed.slice(slash + 1);
  return trimmed;
}
