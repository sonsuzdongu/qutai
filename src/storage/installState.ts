/**
 * Whether this launch is the first one after a fresh installation (pure: no native modules, tested by
 * scripts/install-tests). iOS keeps an app's Keychain items when the app is deleted, so without this a reinstalled
 * Qutai would find the old settings, AI keys and account tokens; the app sandbox (documents, database) is removed on
 * uninstall, so a marker file there tells a fresh installation from an existing one.
 *
 * - marker: the install marker file in the documents folder. 'done' = written by an earlier launch; 'pending' = a wipe
 *   started and didn't finish; 'missing'; 'unknown' = it couldn't be checked.
 * - database: whether Qutai's database file (created on every launch) was already there before this launch opened it.
 *
 * Rules: never wipe on anything unknown. No marker but a database = an installation from before this check existed
 * (an updating user): keep everything and write the marker. No marker and no database = a new installation: clear the
 * secure storage, then write the marker. A pending marker = finish the wipe.
 */
export type MarkerState = 'done' | 'pending' | 'missing' | 'unknown';
export type DatabaseState = 'present' | 'missing' | 'unknown';
export type InstallAction = 'none' | 'markExisting' | 'wipe';

export function installAction(marker: MarkerState, database: DatabaseState): InstallAction {
  if (marker === 'done' || marker === 'unknown') return 'none';
  if (marker === 'pending') return 'wipe';
  if (database === 'present') return 'markExisting';
  if (database === 'missing') return 'wipe';
  return 'none';
}

export const MARKER_DONE = 'done';
export const MARKER_PENDING = 'pending';

/** The marker file's content as a state; anything unexpected counts as done (never wipe on a surprise). */
export function parseMarker(content: string | null): MarkerState {
  if (content === null) return 'missing';
  return content.trim() === MARKER_PENDING ? 'pending' : 'done';
}
