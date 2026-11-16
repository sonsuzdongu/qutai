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
