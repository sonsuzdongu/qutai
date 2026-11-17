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
same restart.

What a backup leaves out is unchanged: downloads and saved pages, caches and site data, incognito data, the "What was
sent to the AI" list, the locks, the account session and Qutai Credits (they live on the server's ledger).

**Size** (`npm run measure:backup`, synthetic data, Node on a Mac): light use 0.3 MB, typical 2.7 MB, heavy with 60
long conversations 54 MB (without the conversations about 6 MB). The server takes up to 50 MiB per backup by default
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
- **What goes in**: the export's switches, kept for server backups. Defaults: open tabs on; conversations, activity and
  AI keys off (conversations are what make backups large; keys on a server are a bigger step than keys in a file the
  user holds).
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
- **A new phone**: after sign-in, if the account has a backup and this phone never backed it up, the app offers the
  newest one once (`ServerRestoreOffer`, after the lock, Settings and the intro are out of the way). Yes downloads it
  and opens the import screen, which asks for the password.

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
