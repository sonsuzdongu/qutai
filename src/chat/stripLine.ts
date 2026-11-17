/**
 * The step strip's line (docs/working-mode.md): quick steps must not make it flicker. Each line stays at least
 * MIN_LINE_MS on screen; a line replaced before its turn came is skipped (only the newest waiting one is shown).
 * Pure: the caller passes the clock and sets a timer for `wakeAt`. Tested in scripts/assistant-tests/workingMode.test.ts.
 */

export const MIN_LINE_MS = 900;

export type StripLineState = {
  /** The line on screen ('' before the first). */
  shown: string;
  /** When it appeared. */
  shownAt: number;
  /** The newest line waiting for its turn, or null. */
  next: string | null;
};

export const emptyStripLine: StripLineState = { shown: '', shownAt: 0, next: null };

export type StripLineStep = { state: StripLineState; /** Call `tick` again at this time (null: nothing waits). */ wakeAt: number | null };

/** A new latest line arrived at `now`. */
export function offerLine(state: StripLineState, line: string, now: number): StripLineStep {
  if (line === state.shown) return { state: { ...state, next: null }, wakeAt: null };
  if (!state.shown || now - state.shownAt >= MIN_LINE_MS) {
    return { state: { shown: line, shownAt: now, next: null }, wakeAt: null };
  }
  return { state: { ...state, next: line }, wakeAt: state.shownAt + MIN_LINE_MS };
}

/** The timer fired (or any later moment): the waiting line takes its turn if the shown one has had its time. */
export function tickLine(state: StripLineState, now: number): StripLineStep {
  if (state.next === null) return { state, wakeAt: null };
  if (now - state.shownAt < MIN_LINE_MS) return { state, wakeAt: state.shownAt + MIN_LINE_MS };
  return { state: { shown: state.next, shownAt: now, next: null }, wakeAt: null };
}

/** What the chat's latest items say the assistant is doing now, or a fallback key when no step line applies yet. */
export type StripSource = { kind: string; text: string; streaming?: boolean };

/**
 * The strip's line from the running conversation's items since the user's message: the latest step line (an action,
 * a status or a failed step), or 'answering' while the answer is being written, or 'thinking' before anything.
 */
export function currentStripLine(items: readonly StripSource[]): { text: string } | 'thinking' | 'answering' {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === 'user') return 'thinking';
    if (item.kind === 'assistant' && (item.streaming || item.text)) return 'answering';
    if ((item.kind === 'action' || item.kind === 'info' || item.kind === 'error') && item.text.trim()) {
      return { text: item.text.trim() };
    }
  }
  return 'thinking';
}

/** The answer card's text: the answer without Markdown marks (links keep their words), trimmed. */
export function plainAnswer(markdown: string): string {
  return markdown
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
