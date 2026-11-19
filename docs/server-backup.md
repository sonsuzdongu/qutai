# Back up to your Qutai account (app side)

Pro mode, signed in only. The owner's decision (17 Nov 2026) replaces live sync: the backup works like the file export,
only the file goes to the user's account on the server. No live sync, no record merging. The server side, threat model
and limits are in `backend/DESIGN.md` › Server backup and `backend/README.md` › Server backup.

## One file, two places

The server stores **exactly the bytes the file export makes** (`buildBackupFile` in `src/backup/backup.ts`): the
`QUTAIBAK` header, scrypt (N = 2^14, r = 8, p = 1) and XChaCha20-Poly1305, the versioned JSON payload
(`src/backup/payload.ts`). A server backup can be saved as a `.qutai` file and imported, and a restore from the server
goes through the same import screen and code (`ImportFlow` in `src/components/BackupScreen.tsx`, `openBackup`,
`restoreBackup`): the same summary of what is in it, merge or replace, the same confirmation before replacing, the
same restart. Payload additions reach both at once: user styles (19 Nov 2026) are the optional `sites.styles` array,
sanitised again on restore (docs/page-customisation.md); a server running an older app version stores them unread.
Apps (19 Nov 2026, docs/mini-apps.md › Backup and restore) are the optional `apps` section: each app's current version
with its seal, state and grants, and its data when "My apps' data" is on. On another phone an app comes back switched
off and unsealed with its data intact; on the same phone as it was. An older app version ignores the section.

**The server needs no change for apps.** The backup stays one opaque encrypted blob: the server never reads it, so
account merge (which moves whole backup rows) and account deletion (which deletes them) cover apps without knowing
they exist. Checked against `backend/DESIGN.md` › Server backup; nothing in `backend/` was changed.

What a backup leaves out is unchanged: downloads and saved pages, caches and site data, incognito data, the "What was
sent to the AI" list, the locks, the account session and Qutai Credits (they live on the server's ledger).

**Size** (`npm run measure:backup`, synthetic data, Node on a Mac): light use 0.3 MB, typical 2.7 MB, heavy with 60
long conversations 54 MB (without the conversations about 6 MB). Apps add their packages (at most 512 KB each, a
typical notes app 20 KB) and, with their data, up to 5 MB each (a notes app with a hundred notes is a few dozen KB). The server takes up to 50 MiB per backup by default
(`GET /config` › `backups.maxBytes`); the app checks the size before uploading and says "too large, turn off
conversations or activity". Hermes builds the whole file in memory: a 50 MB backup needs a few times that while it is
made (not measured on a phone yet).

## Settings › Backup › Qutai account

`src/components/ServerBackupSection.tsx`, shown in pro builds only; "sign in" when signed out; "not available" when the
server has no `backups` in `GET /config` (older server or no storage).

- **Back up now**: builds the file with the kept password and uploads it (`backUpNow` in `src/backup/server/index.ts`).
  The first time, it asks for the password first. Progress: encrypting with a percentage, then uploading; Cancel
  stops it (an upload already sent completes on the server or not at all; nothing half-stored is ever listed).
- **The list** (date, device, size, app version), newest first, with Restore and Delete; "Delete all backups in my
  account"; a note that the account keeps the newest N.
- **Restore**: downloads the file (percentage, Cancel), checks its SHA-256, then opens the import screen with the
  kept password tried first. If that fails (a backup made before the password was changed), the screen says so and
  asks for that password.
- **Backup password**: set or change, twice, at least 10 characters, with the warning that it cannot be recovered and
  that the server has no recovery. "Change password" only changes what the next backup uses: copies already on the
  server keep the old password (the screen says so).
- **Automatic backup** (off by default): once a day, only while Qutai is open: when it opens, comes back to the
  foreground, after sign-in and after unlocking (`useServerBackupLifecycle`). Never from a background service in this
  version. "Only on Wi-Fi" (on by default) or any connection. Skipped, and the screen says why, when no password is
  kept, the tab in front is incognito, there is no connection, the phone isn't on Wi-Fi, the connection type can't be
  read (a build without `expo-network`), or the account is suspended. After a failure it waits an hour, and after a
  daily-limit answer until the server's `Retry-After`.
- **What goes in**: the export's switches, kept for server backups. Defaults: open tabs, **My apps** and **My apps'
  data** on; conversations, activity and AI keys off (conversations are what make backups large; keys on a server are
  a bigger step than keys in a file the user holds). The apps' data switch shows the current total.
- **Over the limit because of apps' data**: an app may keep 5 MB, so a few apps can push a backup over the account's
  limit. When the file is over `backups.maxBytes` with apps' data in it, the backup is made again without apps' data
  and uploaded; the screen says so ("Backed up without your apps' data: with it the backup was 61 MB, over your
  account's limit of 50 MB") and the status line keeps "Your apps' data was left out" (`appDataLeftOut` in the run
  record), also for the daily automatic backup. Without apps' data and still too large: the usual "too large" error.
- **Errors** are one plain sentence with the technical line under Details: wrong password, offline, daily limit, too
  large, signed out, suspended, server unavailable, damaged in transfer, no longer in the account.

## The password

Kept in secure storage (`server_backup_password`, "this device only", with the account id it belongs to); another
account signing in never uses it.

- **Cleared on sign-out** (and account deletion, which signs out). Sign-out is what people do before handing a phone on;
  the password protects copies that outlive the phone. The cost is typing it once after signing in again. A session the
  server ended (expired, revoked elsewhere) keeps it: the same person signs in again.
- **Cleared by the iOS reinstall clean start** (`src/storage/installCheck.ts` lists both keys); Android clears secure
  storage on uninstall.
- **Restore offer after sign-in** (changed 19 Nov 2026, owner's request): after each fresh sign-in to an account
  that has a backup, the app offers the newest one, also when this phone has backed up to that account before
  (`ServerRestoreOffer`, `shouldOfferRestore`). A fresh sign-in is signing in with Apple, Google, email (or the test
  sign-in): not opening the app with a kept session and not a token refresh. It is asked once per sign-in, never in a
  loop, and after "Not now" again at the next sign-in. It waits until the lock, Settings, the intro and any running
  task are out of the way (onboarding comes before the browser, so never during it). It is not offered when the newest
  backup is the one this install uploaded itself (its data is at least as new); a backup this phone restored earlier
  can't be told apart and is offered. The dialog says that the next screen asks whether to merge or replace, and that
  replacing erases this phone's data of each kind in the backup; Yes downloads it and opens the import screen, which
  asks for the password and where that choice is made.

The pure rules (when the daily backup runs or why not, the password's lifecycle, error mapping, the stored state) are
in `src/backup/server/logic.ts`; the HTTP client in `src/backup/server/client.ts`.

## Tests

- `npm run test:backup`: the decisions and the client against an in-process fake (headers, checksum, token renewal,
  error shapes, the download check, cancel, device A → device B with the password).
- `npm run test:backup:server`: against a local server with the backup routes and the test sign-in
  (`QUTAI_TEST_API_URL`, `QUTAI_TEST_DEV_LOGIN_SECRET`); skipped otherwise.
- Server side: `cd backend && npm test` (`apps/api/test/backups.test.ts`).

## Native build

`expo-network` (the connection type for "Only on Wi-Fi") is a native module: **a new development build is needed**.
Older builds still work: the daily backup on Wi-Fi only is skipped with "the connection type couldn't be checked", and
on any connection it runs. Its `ACCESS_WIFI_STATE` is blocked in `app.json` (not needed for the connection type).

## What real sync would still need

End-to-end encrypted record-level sync (TODO.md › Sync): keys derived on the device and shared between devices, a
per-record format with versions and deletion markers (tombstones), merging concurrent edits, incremental upload
instead of whole files, and background transfer. None of it is in this version: a restore merges or replaces the
whole backup, exactly like the file import.
