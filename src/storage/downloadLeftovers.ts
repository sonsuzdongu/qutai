/**
 * iOS keeps downloads in Qutai's own folder, which only the Downloads screen can reach: a file there that no list
 * entry points to can't be opened, shared or deleted by anyone and still takes room (and sits in the device backup).
 * These are the names of such files: left by a download that was killed half-way, or by an incognito download of a
 * build that dropped the entry and kept the file (INC-31).
 *
 * A file is kept when an entry names it or an entry's address ends with it; anything doubtful is kept.
 */
export function leftoverNames(onDisk: string[], entries: { name: string; uri: string | null }[]): string[] {
  const kept = new Set<string>();
  for (const entry of entries) {
    kept.add(entry.name);
    const last = entry.uri?.split('/').pop();
    if (!last) continue;
    kept.add(last);
    try {
      kept.add(decodeURIComponent(last));
    } catch {
      // Not an encoded name: the plain one is already kept.
    }
  }
  return onDisk.filter((name) => !kept.has(name));
}
