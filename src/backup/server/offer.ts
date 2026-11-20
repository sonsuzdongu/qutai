import { shouldOfferRestore } from './logic';

/**
 * The restore offer after a fresh sign-in (docs/server-backup.md › Restore offer; design record BACK-21), as a runner the
 * screens call whenever they could show it: setup's account screen and the browser when nothing else is in front.
 * Free of React and storage so the tests can drive it (scripts/backup-tests/offer.test.ts).
 *
 * - Once per sign-in: the offer is marked as made only when the user ANSWERED the dialog (restore or not now). A result
 *   that arrives after the screen stopped wanting it (`live()` false: the intro, a lock, Settings or a task came in
 *   front, setup moved on, the app closed) is dropped unmarked and asked again the next time a screen can show it.
 * - Not when the newest backup is the one this install uploaded (marked, nothing to show).
 * - No backups yet: nothing marked, so the first backup that appears during this sign-in is offered, once.
 * - One dialog at a time: a run while another run's dialog is open does nothing (that answer marks the offer).
 */
export type OfferAccount = { userId: string; signedInAt?: number; offeredFor?: number; lastUploadId?: string };

export type OfferDeps<B extends { id: string }> = {
  /** The signed-in account's offer state as stored now, null when signed out (or server backups are off). */
  account(): Promise<OfferAccount | null>;
  /** The account's backups, newest first; throws when they can't be listed. */
  list(): Promise<B[]>;
  /** Stores that the offer for this sign-in is settled. */
  mark(userId: string, signedInAt: number): Promise<void>;
};

export type OfferOutcome = 'none' | 'own' | 'dropped' | 'busy' | 'declined' | 'accepted';

export function createRestoreOffer<B extends { id: string }>(deps: OfferDeps<B>) {
  let asking = false;
  let listing: Promise<B[] | null> | null = null;

  const pending = (a: OfferAccount | null): a is OfferAccount & { signedInAt: number } =>
    !!a && a.signedInAt !== undefined && a.offeredFor !== a.signedInAt;

  /**
   * `live`: whether the caller can still show the dialog; `ask`: shows it, resolving true for "Restore". With "Restore"
   * the caller goes on to the restore (the offer is settled either way).
   */
  return async function run(live: () => boolean, ask: (backup: B) => Promise<boolean>): Promise<{ outcome: OfferOutcome; backup?: B }> {
    if (asking) return { outcome: 'busy' };
    const before = await deps.account();
    if (!pending(before)) return { outcome: 'none' };
    // Runs that overlap (the screen became ready again while the list was on its way) share one request.
    const request = (listing ??= deps
      .list()
      .catch(() => null)
      .finally(() => {
        listing = null;
      }));
    const backups = await request;
    if (!backups || backups.length === 0) return { outcome: 'none' };
    // Read again: another run may have settled it meanwhile, or the user signed in anew.
    const account = await deps.account();
    if (!pending(account) || account.userId !== before.userId || account.signedInAt !== before.signedInAt) return { outcome: 'none' };
    if (!shouldOfferRestore({ ...account, backups })) {
      await deps.mark(account.userId, account.signedInAt);
      return { outcome: 'own' };
    }
    if (!live()) return { outcome: 'dropped' };
    if (asking) return { outcome: 'busy' };
    asking = true;
    try {
      const backup = backups[0]!;
      const yes = await ask(backup);
      await deps.mark(account.userId, account.signedInAt);
      return yes ? { outcome: 'accepted', backup } : { outcome: 'declined' };
    } finally {
      asking = false;
    }
  };
}
