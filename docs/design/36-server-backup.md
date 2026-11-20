# 36. Server backup

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

"Back up to your Qutai account" (official pro builds, signed in): the same password-encrypted backup file that
Settings › Backup can export is uploaded to the user's account, listed, and restored on the same or another phone.
It replaces live sync for now; the server never sees the password or what is inside.

## How it works

1. Settings › Backup › Qutai account appears only in pro builds; signed out it says to sign in, and on a server
   without backup storage it says "not available".
2. **Back up now**: the first time, Qutai asks for a backup password (at least 10 characters, typed twice, with the
   warning that nobody, not even Qutai, can recover it). The phone builds and encrypts the file (with a percentage),
   then uploads it. Cancel stops it; a half-sent backup is never listed.
3. The list shows each backup's date, device ("iPhone · iOS 26.1"), size and app version, newest first, with
   **Restore** and **Delete**, plus **Delete all backups in my account**. The account keeps the newest 3.
4. **Restore** downloads the file, checks it arrived intact, and opens the same import screen as a file import (what
   is inside, merge or replace, confirmation, restart), trying the kept password first. If the backup was made with
   an older password, the screen asks for that one.
5. **Automatic backup** (off by default): once a day, only while Qutai is open (when it opens, comes back to the
   front, after sign-in and after unlocking), on Wi-Fi only unless the user picks "any connection". It skips, and says
   why, when no password is kept, the tab in front is incognito, there is no connection, the phone isn't on Wi-Fi, the
   connection type can't be read, or the account is suspended. After a failure it waits an hour.
6. **What goes in** uses the export's switches: open tabs on; conversations, activity and AI keys off by default.
7. After each fresh sign-in, if the account has a backup (and its newest is not this phone's own last upload), Qutai
   offers the newest, once per sign-in; signing in during setup asks right there, before the profile questions. Example: Mehmet buys a new phone, signs in, taps "Restore", types his backup password, and his bookmarks,
   history and settings come back.
8. Errors are one plain sentence (wrong password, offline, daily limit, too large, signed out, suspended, server
   unavailable, damaged in transfer, no longer in the account) with the technical line under Details.

## The rules

- **`BACK-1`** There is no live sync for now: "sync" means the export's encrypted file kept in the Qutai account and restored whole (merge or replace).
  Status: Owner, 2026-11-17 · Why: real sync would need keys shared between devices, per-record versions, deletion markers, merging and incremental upload; none of that exists · Source: [TODO.md](../../TODO.md#sync--server-backup); docs/server-backup.md; ROADMAP.md › Account and sync
- **`BACK-3`** The password never leaves the phone and the server has no recovery or key copy; the server sees only the encrypted file and its size, date, app version and a generic device label.
  Status: Default (manager or implementing session; open to change) · Why: a server or database breach yields only encrypted files · Enforced: In the app: src/backup/crypto.ts (encryption on the phone); Server: backend/apps/api/src/routes/backups.ts (uploadBackup stores bytes as received) · Source: backend/DESIGN.md › Server backup › Threat model; docs/server-backup.md
- **`BACK-4`** Today new files use scrypt (a slow password-to-key function) with N = 2^14, r = 8, p = 1 and XChaCha20-Poly1305 encryption; files asking for more than 256 MiB of key memory are refused.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Security) · Why: 2^14 is the "interactive" setting and weak for a file kept on a server (OWASP's minimum is 2^17); proposed: 2^16 for new files with no format change, after timing it on a low-end Android phone (Node: 38 ms → 141 ms; the phone's engine is much slower; 64 MiB during encryption) · Enforced: In the app: src/backup/crypto.ts (DEFAULT_SCRYPT, LIMITS) · Source: backend/DESIGN.md › The file › KDF strength; 7eae6a1
- **`BACK-5`** Today the backup contents are not compressed.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Server backup) · Why: compressing would make files 4–8× smaller but needs a new format version and a compressor in the app · Source: backend/DESIGN.md › The file
- **`BACK-6`** The backup password has at least 10 characters and is kept in the phone's secure storage, readable only on this phone, together with the account it belongs to; another account never uses it.
  Status: Default (manager or implementing session; open to change) · Why: asked once and kept, so the daily backup can run; tied to the account so a second account can't use it · Enforced: In the app: src/backup/server/logic.ts (MIN_BACKUP_PASSWORD); src/backup/server/index.ts (PASSWORD_KEY, keepPassword) · Source: docs/server-backup.md › The password; backend/DESIGN.md › Decisions
- **`BACK-7`** Today the kept password is cleared on sign-out and account deletion, kept when the server ended the session, and cleared by the iPhone reinstall clean start.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Server backup) · Why: people sign out before handing a phone on, and the password protects copies that outlive the phone; the cost is typing it once after signing in again; an ended session means the same person signs in again · Enforced: In the app: src/backup/server/logic.ts (clearPasswordOn); src/storage/installCheck.ts · Source: docs/server-backup.md › The password; 9e18329
- **`BACK-8`** Changing the backup password affects only the next backup; copies already on the server keep the old password, and the screen says so.
  Status: Default (manager or implementing session; open to change) · Why: the server can't re-encrypt what it can't read · Source: docs/server-backup.md › Backup password
- **`BACK-9`** Today a server backup includes open tabs and leaves out conversations, activity and AI keys unless the user switches them on.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Server backup) · Why: conversations are what make backups large (up to 54 MB); keys on a server are a bigger step than keys in a file the user holds · Enforced: In the app: src/backup/server/logic.ts (DEFAULT_PREFS) · Source: docs/server-backup.md › What goes in; bd6743e
- **`BACK-10`** Today the automatic backup is off by default and, when on, runs once a day, only while Qutai is open (never from a background service), on Wi-Fi only by default, waiting an hour after a failure and the server's stated time after a daily-limit answer.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Server backup) · Why: the Wi-Fi and open-only defaults are the manager's; reason not recorded beyond that · Enforced: In the app: src/backup/server/logic.ts (DEFAULT_PREFS, AUTO_INTERVAL_MS, AUTO_RETRY_MS, autoBackupDecision); src/backup/server/useServerBackupLifecycle.ts · Source: docs/server-backup.md › Automatic backup
- **`BACK-11`** The automatic backup never runs while an incognito tab is in front.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/backup/server/index.ts (maybeAutoBackup) · Source: docs/server-backup.md › Automatic backup
- **`BACK-12`** A backup never contains downloads, saved pages, caches, site data, incognito data, the "What was sent to the AI" list, the locks, the account session or Qutai Credits.
  Status: Default (manager or implementing session; open to change) · Why: incognito is never kept; sessions belong to one phone; credits live on the server's ledger · Enforced: In the app: src/backup/payload.ts · Source: docs/server-backup.md › One file, two places; 7eae6a1
- **`BACK-13`** Server limits by default: 50 MiB per backup, 3 kept per account, 12 uploads a day (failed attempts count), 300 MiB uploaded a day, 30 downloads a day, 2 uploads at once; the owner can change them without a new server release.
  Status: Default (manager or implementing session; open to change) · Why: bounds each account's storage (3 × 50 MiB) and use as free storage · Enforced: Server: backend/apps/api/src/backups/limits.ts (DEFAULT_BACKUP_LIMITS, MAX_UPLOADS_IN_PROGRESS) · Source: backend/DESIGN.md › Server backup › Limits
- **`BACK-15`** A failed upload never replaces a good backup: older copies are removed only after the new one is complete and its checksum matches, and a retry of the same upload is not stored twice.
  Status: Default (manager or implementing session; open to change) · Why: safe retries over a bad connection · Enforced: Server: backend/apps/api/src/routes/backups.ts (uploadBackup) · Source: backend/DESIGN.md › Upload: atomic and safely retryable
- **`BACK-17`** Uploading needs an active account; listing, downloading and deleting work while suspended.
  Status: Default (manager or implementing session; open to change) · Why: "the user's own data stays reachable" · Enforced: Server: backend/apps/api/src/routes/backups.ts (uploadBackup, listBackups, downloadBackup) · Source: backend/DESIGN.md › Routes, › Decisions
- **`BACK-18`** Today "Delete all backups" needs no recent sign-in.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Security) · Why: risk left open: a stolen session can delete the backups or push them out with junk uploads (12 a day against 3 kept); proposed, not built · Enforced: Server: backend/apps/api/src/routes/backups.ts (deleteAllBackups, no recent-proof check) · Source: backend/DESIGN.md › Threat model, › Open
- **`BACK-19`** Combining two accounts moves the other account's backups to the surviving one; deleting the account deletes all its backups (a daily job finishes any that failed).
  Status: Default (manager or implementing session; open to change) · Why: a combine must not delete anyone's data · Enforced: Server: backend/apps/api/src/backups/store.ts (deleteAccountBackups, cleanUpBackups); backend/apps/api/src/account/merge.ts · Source: backend/DESIGN.md › Account deletion and merge
- **`BACK-20`** Stored files are named by a random id, never the user id; the admin panel shows only how many backups an account has and their total size; logs carry only the user id and a count.
  Status: Default (manager or implementing session; open to change) · Why: privacy; a combine is a list change only · Enforced: Server: backend/apps/api/src/backups/store.ts (objectKey) · Source: backend/DESIGN.md › Storage, › Admin panel, › Logs
- **`BACK-21`** The restore offer appears once after each fresh sign-in to an account with a backup (Apple, Google, email or test sign-in; not an app start with a kept session, not a token refresh), also when this phone backed up to that account before, and again at the next sign-in after "Not now"; never twice for one sign-in; not when the newest backup is this install's own last upload. It counts as asked only once the dialog was answered: an offer that could not be shown in time (something came in front while the backups were listed, or the app closed) is asked the next time it can be, and an account with no backup yet is asked once when one appears. In the browser it waits while the lock, Settings, the intro or a running task is in the way. In setup it is asked on the AI step's account screen right after signing in to Qutai, before the profile questions; restoring there saves setup's finished settings (setup done, legal accepted on this phone, Qutai Credits) with the backup's preferences over them (merge preselected), marks the intro as seen and restarts in the browser, skipping the remaining steps; the app lock, permissions and legal state are never in a backup and stay the phone's. "Not now" in setup continues setup and is not asked again after it. The dialog says the next screen asks merge or replace and that replacing erases this phone's data of those kinds. Changed 19 Nov 2026 (before: once per account per phone, and only on a phone that never backed up) and 20 Nov 2026 (marked only when answered; asked in setup).
  Status: Owner, 2026-11-19 (asked for both limits to go) and 2026-11-20 (asked in setup; reported the offer never came after signing in during setup); the details (what counts as a sign-in, the own-upload check, what a restore in setup saves) are Default · Why: a user signing in again should be able to restore without hunting for it, without being asked in a loop; the offer was marked before the dialog, and the first-run intro arriving 700 ms after setup dropped it for good · Enforced: In the app: src/backup/server/offer.ts (createRestoreOffer), src/backup/server/logic.ts (shouldOfferRestore, parseState), src/backup/server/index.ts (onSignIn → signedInAt, runRestoreOffer, lastUploadId), src/components/ServerRestoreOffer.tsx (useServerRestoreOffer), src/components/Onboarding.tsx, src/backup/backup.ts (restoreBackup's prepare), App.tsx (`ready` includes no running task); tested in scripts/backup-tests/offer.test.ts and logic.test.ts · Source: docs/server-backup.md › Restore offer after sign-in
- **`BACK-22`** The pro privacy policy describes server backups, and its version was raised so every pro user accepts again (now version 5).
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Server backup: confirm the re-acceptance) · Why: new data kept on the server · Source: src/legal/documents.ts (PRO_LEGAL_VERSION); d5c0f05, 94f9391, 040c537

## Details

**File and checks**

- (was `BACK-2`) The server stores exactly the bytes of the file export, so a server copy can be saved as a file and imported, and a restore uses the same import screen and code. Why: one format and one restore path. Where: In the app: src/backup/backup.ts (buildBackupFile); src/backup/server/index.ts (backUpNow, downloadServerBackup); docs/server-backup.md › One file, two places; bd6743e.
- (was `BACK-16`) The server checks only the size, the file's header and its checksum; whether the password is right is checked only on the phone. Why: the server can't read the file; the encryption itself detects tampering. Where: Server: backend/apps/api/src/routes/backups.ts (uploadBackup); backend/DESIGN.md › What the server checks.

**Size**

- (was `BACK-14`) The app checks the size before uploading and, if too large, says to turn off conversations or activity. Why: heavy use with conversations reaches 54 MB, above the 50 MiB limit. Where: docs/server-backup.md › Size.

## Limits and what is not built

- Not checked on phones: a backup and restore on Android and iPhone, memory use of a 20–50 MB backup, "Only on
  Wi-Fi" on Android, large text, a screen reader, landscape (in progress; needs a new development build for the
  network-type module).
- A cut upload restarts from the beginning (multi-part upload would be next if limits grow).
- The owner must create the two storage buckets before the server can be deployed.
- Website sentences saying the server keeps no browsing data must change (planned).
- Real end-to-end encrypted sync of bookmarks, history, tabs and memory (planned, ROADMAP Phase 5); incognito data is
  never synced.

## Where it lives

- App: `src/backup/server/` (`logic.ts`, `client.ts`, `index.ts`, `useServerBackupLifecycle.ts`),
  `src/components/ServerBackupSection.tsx`, `ServerRestoreOffer.tsx`, `src/backup/crypto.ts`, `backup.ts`, `payload.ts`.
- Server: `backend/apps/api/src/backups/`, `backend/apps/api/src/routes/backups.ts`.
- Read next: [docs/server-backup.md](../../docs/server-backup.md); [backend/DESIGN.md](../../backend/DESIGN.md) › Server backup;
  [backend/README.md](../../backend/README.md) › Server backup.

## Disagreements between sources

- README.md › Official builds says sync isn't in the code while its table lists encrypted backups in the account; backups are built, live sync is not.
- docs/server-plan.md plans `/sync` routes and storage for sync data; superseded by the 17 Nov 2026 backup decision.
