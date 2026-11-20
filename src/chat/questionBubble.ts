import { plainAnswer } from './stripLine';

/**
 * Whether the assistant's question (ask_user) is small enough to ask over the page, in a bubble, instead of opening
 * the panel (WORK-17): a plain question of one or two short sentences and 2 to 4 short options. Anything longer, with
 * Markdown structure (lists, tables, links, code) or with many options opens the panel as before. With larger text
 * the limits shrink so the bubble stays a bubble. Pure (scripts/assistant-tests/workingMode.test.ts).
 */
export const BUBBLE_MAX_QUESTION = 140;
export const BUBBLE_MAX_OPTION = 28;
export const BUBBLE_MAX_OPTIONS = 4;

export function questionFitsBubble(question: string, options: readonly string[], fontScale = 1): boolean {
  const scale = Math.max(1, fontScale);
  if (options.length < 2 || options.length > BUBBLE_MAX_OPTIONS) return false;
  // A list, table, code, link or several paragraphs reads better in the panel.
  if (/\n\s*([-*+•]|\d+[.)])\s|\|.*\||```|\]\(|\n\s*\n/.test(question)) return false;
  const text = plainAnswer(question);
  if (!text || text.length * scale > BUBBLE_MAX_QUESTION) return false;
  const optionsLength = options.reduce((n, o) => n + o.length, 0);
  if (options.some((o) => o.length * scale > BUBBLE_MAX_OPTION)) return false;
  return optionsLength * scale <= BUBBLE_MAX_OPTION * 3;
}
