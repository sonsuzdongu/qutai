/**
 * The answer style is no longer asked anywhere in setup (since 20 Nov 2026, `INTRO-29`, owner's decision): it is
 * always "short and to the point". Setup applies it exactly as picking "Short and to the point" did before: the line
 * "Answer briefly and to the point." (`profile.style.shortLine`, in the interface language) goes into the custom
 * instructions, where the user sees it in Settings › Assistant and can change or delete it. Nothing in the assistant's
 * fixed instructions changes, so the agent profile stays the same.
 *
 * Only a finished first-run setup adds it, and only when the instructions hold no answer-style line yet (one the user
 * volunteered in "Tell me about yourself", "short" or "detailed", wins). Installs that finished setup before are never
 * touched: an update leaves their custom instructions exactly as they are.
 */
export function withDefaultAnswerStyle(current: string, shortLine: string, styleLines: readonly string[]): string {
  const known = new Set([shortLine, ...styleLines].map((l) => l.trim()));
  const lines = current.replace(/\r\n?/g, '\n').split('\n');
  if (lines.some((l) => known.has(l.trim()))) return current;
  return current.trim() ? `${current.trimEnd()}\n${shortLine}` : shortLine;
}
