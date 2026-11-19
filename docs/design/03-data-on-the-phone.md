# 3. What is stored on the phone, and what leaves it

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Where Qutai keeps the user's data on the phone, the password-protected backup file that moves it to another phone,
how a reinstall and "Clear browsing data" remove it, and the complete list of what leaves the phone.

## How it works

1. **The database** (SQLite, `qutai.db`): open tabs and tab groups, history, bookmarks and folders, recently closed
   tabs, saved conversations, the assistant's memory, site permissions, saved tasks, the activity history, the outline
   of "What was sent to the AI", the downloads list, site rules.
2. **Secure storage** (iOS Keychain / Android Keystore): every setting, the AI keys and custom header values, and in
   pro mode the account session and the backup password; also the key that seals approved scripts.
3. **Files:** attached images and PDFs (kept with the conversation), downloads, saved pages.
4. **Incognito** tabs and conversations that touch them save nothing (see [section 8](08-incognito.md)).
5. **Backup file:** Settings › Backup › Export writes everything into one password-protected file,
   `qutai-backup-YYYY-MM-DD.qutai`, and hands it to the share sheet (Files, Drive…). There is no sync, so this is how
   data moves to a new phone. Import checks the password and the whole file, shows what it contains, then **merges**
   (what is on the phone stays) or **replaces** each kind it contains, in one step, and restarts the app.
6. **Always in a backup:** bookmarks and folders, history, memory (with categories and which memories are hidden),
   site permissions (assistant level, personal information, location), saved tasks, site rules, styles and scripts,
   and preferences (appearance, reader mode, custom instructions…). **Optional:** open tabs and groups (on),
   conversations (off), activity history (off), AI keys (off; only with "Include my AI provider keys").
7. **Reinstall on iPhone:** deleting Qutai leaves the Keychain behind, so on the first launch of a fresh install Qutai
   clears every secure-storage entry it has ever written before reading anything. Android clears it on uninstall.
8. **Clear browsing data** (Settings) removes, for the last hour, day, week or everything: history, cache, recently
   closed tabs, conversations, the activity history, the "What was sent to the AI" list, downloads and saved pages.
   Memory has its own controls ([section 11](11-memory.md)).
9. **What leaves the phone** (open-source build): see the rules DATA-14 to DATA-20. In pro mode, also Qutai's server
   for the pro features the user uses ([section 1](01-open-source-and-pro.md)).

## The rules

- **`DATA-1`** Tabs, history, bookmarks, recently closed tabs and conversations are stored only on the phone; there is no sync.
  Status: Default (manager or implementing session; open to change) · Why: no account in the open-source build · Enforced: In the app: src/storage/ (SQLite) · Source: README intro; 73275ab
- **`DATA-2`** Settings and AI keys live in secure storage, not in the database.
  Status: Default (manager or implementing session; open to change) · Why: keys are secrets · Enforced: In the app: src/storage/settings.ts (loadSettings, saveSettings) · Source: README › How does it work? (src/storage/ row)
- **`DATA-3`** A backup always contains bookmarks with folders, history, memory (categories and hidden flags), site permissions (assistant level, personal information, location), saved tasks, site rules, styles and scripts, and preferences.
  Status: Default (manager or implementing session; open to change) · Why: with no account and no sync the user needs one way to move their data · Source: src/backup/database.ts (collectBackup); README intro; 7eae6a1
- **`DATA-4`** Open tabs and groups are in a backup by default; conversations and the activity history only when ticked; AI keys only with the explicit "Include my AI provider keys"; custom endpoint headers travel only with the keys.
  Status: Default (manager or implementing session; open to change) · Why: keys and headers are secrets · Enforced: In the app: src/backup/backup.ts (buildBackupFile) · Source: README intro; 7eae6a1
- **`DATA-5`** Never in a backup: incognito data, downloads and saved pages, the "What was sent to the AI" list, caches and thumbnails, attached files (a restored chat shows "Not available"), app and incognito lock settings, first-run and legal state, the answer about the online speech service, "Let the assistant complete payments", "Let the assistant run scripts", and the script seal key.
  Status: Default (manager or implementing session; open to change) · Why: locks and first-run "stay with the phone"; the payments and scripts switches are "not restored from a backup"; each phone asks about speech again; the seal key stays out "so a backup or a rules file can't claim that a script was approved" · Enforced: In the app: src/backup/backup.ts (backupSettings lists exactly what is written); src/device/scriptKey.ts · Source: README intro; 7eae6a1; src/storage/settings.ts
- **`DATA-6`** The backup file is encrypted with XChaCha20-Poly1305 under a key made from the password with scrypt; the header (format, scrypt settings, random salt and nonce) is checked with the contents, so any change, wrong password or cut file fails before anything is written; nothing is compressed.
  Status: Default (manager or implementing session; open to change) · Why: scrypt is "memory-hard (better against GPU guessing than PBKDF2)"; the random 24-byte nonce has no reuse risk; the audited @noble libraries are used "since Hermes has no WebCrypto" · Enforced: In the app: src/backup/crypto.ts (encryptBackup, decryptBackup) · Source: src/backup/crypto.ts header; 7eae6a1
- **`DATA-7`** Today new backups use scrypt N = 2^14, r = 8, p = 1 (16 MiB).
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026): "scrypt N = 2^14 is weak for a file that now sits on a server … Proposed: 2^16") · Why: 2^14 is scrypt's "interactive" setting; OWASP's minimum is 2^17; the setting is in the header, so it can be raised without a new format · Enforced: In the app: src/backup/crypto.ts (DEFAULT_SCRYPT) · Source: TODO.md › Security
- **`DATA-8`** A file that asks for more than 256 MiB of memory (log2 N 10–20, r 1–16, p 1–4) is refused before any work.
  Status: Default (manager or implementing session; open to change) · Why: "a hostile file cannot make it allocate gigabytes" · Enforced: In the app: src/backup/crypto.ts (LIMITS) · Source: 7eae6a1
- **`DATA-9`** The backup password has at least 10 characters and cannot be recovered.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/backup/server/logic.ts (MIN_BACKUP_PASSWORD) · Source: README intro
- **`DATA-10`** Every field in a backup is checked as untrusted input; a newer app reads older backups, an older app refuses newer ones; on import, memories that `sensitiveReason` refuses are dropped and ID numbers are hidden.
  Status: Default (manager or implementing session; open to change) · Why: a backup file may come from anywhere · Enforced: In the app: src/backup/payload.ts (parseBackup) · Source: 7eae6a1; item 34 hand-over note
- **`DATA-11`** Merge takes a preference from the backup only where this phone still has the default; replace takes the backup's preferences; keys are never removed (merge fills only empty ones, replace overwrites the ones in the backup).
  Status: Default (manager or implementing session; open to change) · Why: merge must keep "what was changed here" · Source: src/backup/backup.ts (mergeSettings)
- **`DATA-12`** Export asks for Face ID or fingerprint first when the app lock is on.
  Status: Default (manager or implementing session; open to change) · Why: the file holds all the user's data · Enforced: In the app: Settings › Backup export flow · Source: 7eae6a1
- **`DATA-13`** On iPhone, the first launch with neither the install marker (`<documents>/.qutai-install`) nor the database clears every secure-storage entry Qutai has written before anything reads it; an install from before the marker (database present) keeps everything.
  Status: Default (manager or implementing session; open to change) · Why: "iOS keeps Keychain items when an app is deleted; this makes delete-and-reinstall a clean start (as on Android)" · Enforced: In the app: src/storage/installCheck.ts (startInstallCheck, allSecureStoreKeys) · Source: 9e18329
- **`DATA-14`** Each AI request carries the conversation so far, attachments, the custom instructions and, while memory is on, the memory section (hidden memories as labels only); page content is sent only when the assistant reads it for a task.
  Status: Default (manager or implementing session; open to change) · Why: the legal texts must state this · Enforced: In the app: src/agent/runAgent.ts (systemPrompt); src/agent/memory.ts (memoryPrompt) · Source: TODO.md › Other (open-source documents version 2)
- **`DATA-15`** Calendar details and the location reach the AI only after a confirmation each time (or the user's own "Don't ask again" for that kind), and never from incognito conversations.
  Status: Default (manager or implementing session; open to change) · Why: personal device data · Enforced: In the app: src/agent/executeTool.ts (locationTool, readCalendarTool); src/agent/alwaysAllow.ts · Source: c6ad335; TODO.md › Other
- **`DATA-16`** Sites receive only the details the assistant types at the user's request, behind the per-site personal-information question ([section 11](11-memory.md)).
  Status: Default (manager or implementing session; open to change) · Why: personal data must not reach a site without the user · Enforced: In the app: src/agent/executeTool.ts (personalGate) · Source: e7414e3
- **`DATA-17`** "Use my location" sends the position to the phone's address lookup (Apple's or, on most Android phones, Google's).
  Status: Default (manager or implementing session; open to change) · Why: turning a position into a place name needs it · Source: src/device/location.ts (readPlaceName); TODO.md › Other
- **`DATA-18`** Voice audio never goes to Qutai or the AI provider; it goes to Apple's or Google's speech service only when the phone can't recognise the language itself, after a one-time question, and never in incognito.
  Status: Default (manager or implementing session; open to change) · Why: audio is personal · Enforced: In the app: src/device/voiceInput.ts · Source: README › Voice input
- **`DATA-19`** Filter lists are downloaded from their publishers while blocking is on, and search suggestions go to the chosen search engine; Qutai's own requests never pass through the ad blocker.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: README › Known limitations; TODO.md › Other
- **`DATA-20`** Any change to what leaves the phone needs the privacy policy (`src/legal/documents.ts`) changed and its version bumped.
  Status: Default (manager or implementing session; open to change) · Why: the open-source policy's claims "must stay true" · Source: siz-legal-retired-instruction hand-over note; d9e446b
- **`DATA-21`** Clear browsing data offers history, cache, recently closed, conversations, activity, the AI request list, downloads and saved pages, for the last hour, day, week or all time; memory is not part of it.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/storage/clearData.ts (ClearOptions); 4fb6a89, 3c3f007
- **`DATA-22`** The account backup (pro) is the same encrypted file; the server stores only that file and keeps the newest 3; details are in [section 36](36-server-backup.md).
  Status: Default (manager or implementing session; open to change); its default contents and Wi-Fi rule are waiting ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026), Server backup) · Why: one file, so either copy restores the other · Source: bd6743e; docs/server-backup.md

## Details

None: every item in this area stays a rule.

## Limits and what is not built

- No sync (ROADMAP.md › 5. Decisions keeps "Should sync be end-to-end encrypted? (Recommended: yes)" open).
- No compression in the backup file (no compressor ships with the app; TODO.md asks whether to add one with a new format version).
- Attached files are not in backups.
- A forgotten backup password cannot be recovered (by design).

## Where it lives

- `src/storage/` (db.ts, chat.ts, session.ts, settings.ts, clearData.ts, installCheck.ts, installState.ts)
- `src/backup/` (backup.ts, crypto.ts, database.ts, payload.ts, server/), `src/components/BackupScreen.tsx`, `ClearDataScreen.tsx`
- README intro (backup paragraph); [docs/server-backup.md](../../docs/server-backup.md); [docs/permissions.md](../../docs/permissions.md)

## Disagreements between sources

- (Resolved 2026-11-19) The script and app seal key `qutai.scriptSealKey` is now in the list `src/storage/installCheck.ts` clears on a clean iPhone install, so restored scripts and apps arrive switched off until approved. Android removes secure storage with the app on uninstall. The pending email sign-in request (`account_email_pending`) was missing from the list too and is now cleared.
- These settings are not written to a backup, and no source says whether on purpose: the "Don't ask again" list, "Keep working in the background", "Notify me when a task finishes", Gemini streaming, "Show approximate cost", "Show where the assistant acts", the listening language, the custom endpoint's image setting.
