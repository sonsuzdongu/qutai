/**
 * History's select mode (UI-71): after a search, the chosen visits are only those still on screen, so Delete never
 * removes a visit the user can't see. Returns the same set when nothing changes, so nothing redraws.
 */
export function keepShown(chosen: ReadonlySet<number>, shown: readonly { id: number }[]): ReadonlySet<number> {
  if (chosen.size === 0) return chosen;
  const ids = new Set(shown.map((e) => e.id));
  const kept = [...chosen].filter((id) => ids.has(id));
  return kept.length === chosen.size ? chosen : new Set(kept);
}
