/**
 * One place where storage failures go (`DATA-26` in docs/design/03-data-on-the-phone.md). Every failure a caller
 * used to swallow is now one of three kinds:
 * - fine: nothing is lost and nothing the user asked for failed (a cache, a hint, a UI refresh); the caller ignores it;
 * - record: kept in a short in-memory list (recentStorageFailures, for diagnostics) and in the development log;
 * - user: recorded, and the user is told once per kind per run (a toast through the notice App.tsx installs), because
 *   something they did or saved may not be there next time.
 * Nothing here is written to disk (a failing store is the problem) and nothing leaves the phone.
 */
import { t, type MessageKey } from '../i18n';

export type StorageFailureLevel = 'record' | 'user';

export type StorageFailure = { at: number; label: string; message: string; level: StorageFailureLevel };

const MAX_KEPT = 50;
const failures: StorageFailure[] = [];
const told = new Set<string>();
let notice: ((message: string) => void) | null = null;

/** App.tsx installs its toast here (as for speech notices); before that, a failure is only recorded. */
export function setStorageNotice(show: ((message: string) => void) | null) {
  notice = show;
}

/**
 * Records a storage failure; `user` also tells the user once per `messageKey` in this run. `label` names the call
 * ("history.record", "chat.save"); it and the error message stay on the phone.
 */
export function reportStorageFailure(
  label: string,
  error: unknown,
  level: StorageFailureLevel = 'record',
  messageKey: MessageKey = 'storage.failed',
): void {
  const message = error instanceof Error ? error.message : String(error);
  failures.push({ at: Date.now(), label, message: message.slice(0, 300), level });
  if (failures.length > MAX_KEPT) failures.splice(0, failures.length - MAX_KEPT);
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[storage] ${label}: ${message}`);
  if (level !== 'user' || told.has(messageKey)) return;
  told.add(messageKey);
  try {
    notice?.(t(messageKey));
  } catch {
    // The toast is a courtesy; the failure is recorded either way.
  }
}

/** The latest failures, newest last. */
export function recentStorageFailures(): readonly StorageFailure[] {
  return failures;
}

/** For tests. */
export function resetStorageFailures() {
  failures.length = 0;
  told.clear();
  notice = null;
}
