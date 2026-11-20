/**
 * Whether the chat follows its end while an answer streams in (design record UI-30). It follows while the user is at
 * the end; scrolling up to read stops it (a "jump to latest" button appears) and scrolling back down, or the button,
 * starts it again. Pure, so it is tested without React.
 */

/** How far from the very end still counts as "at the end" (a bit of a line, so a half-shown last line counts). */
export const FOLLOW_SLACK = 48;

export type ScrollMetrics = { offset: number; viewport: number; content: number };

export function isAtEnd({ offset, viewport, content }: ScrollMetrics, slack = FOLLOW_SLACK): boolean {
  return offset + viewport >= content - slack;
}

/**
 * Following after a scroll event. Only the user's own scrolling (a drag or its momentum) can stop it: the list's own
 * scroll to the end, or content growing under a still list, never does.
 */
export function nextFollowing(following: boolean, metrics: ScrollMetrics, byUser: boolean): boolean {
  const atEnd = isAtEnd(metrics);
  return byUser ? atEnd : following || atEnd;
}
