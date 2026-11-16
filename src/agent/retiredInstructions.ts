import { cleanCustomInstructions } from './systemPrompt';

/**
 * Lines older builds wrote into Custom instructions themselves: from 849029b to d1c677e (14–15 Nov 2026) the
 * example chip "Always reply in Turkish" under Settings › Assistant › Custom instructions added its label, in the
 * language the app was shown in, as a line of its own. Replies now follow the language of the user's message, so
 * the line is removed once (settings.ts on launch, payload.ts when restoring a backup made before this change).
 *
 * Only a line that is exactly one of these is removed: anything the user typed, including a similar sentence in
 * other words, spacing or punctuation, stays. (A line typed by hand with the very same characters can't be told
 * apart from the chip's and goes too.)
 */
export const RETIRED_INSTRUCTION_LINES: readonly string[] = ['Always reply in Turkish', 'Her zaman Türkçe yanıt ver'];

/** The instructions without the retired lines, cleaned as when saved; the same text when there is none. */
export function removeRetiredInstructionLines(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const kept = lines.filter((line) => !RETIRED_INSTRUCTION_LINES.includes(line));
  return kept.length === lines.length ? text : cleanCustomInstructions(kept.join('\n'));
}

/**
 * A backup's customInstructions, cleaned: the retired lines go unless the backup carries `retiredInstructionsRemoved:
 * true`, which backups made after this change do (the phone had already removed them; what is left is the user's).
 */
export function restoredCustomInstructions(text: string, retiredInstructionsRemoved: unknown): string {
  const clean = cleanCustomInstructions(text);
  return retiredInstructionsRemoved === true ? clean : removeRetiredInstructionLines(clean);
}
