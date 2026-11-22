# 38. Phone permissions and store forms

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Every permission Qutai declares on iOS and Android, when the user is asked, which ones are blocked on purpose, and the
texts prepared for the App Store and Google Play forms. The full table is in [docs/permissions.md](../../docs/permissions.md).

## How it works

1. Nothing is asked when Qutai starts. The first-run setup has an optional step, "What Qutai may use": location,
   calendar, Reminders (iOS) and notifications, each with what it is for and a switch. The phone's own question
   appears only when the user turns a switch on; the step can be passed with every switch off.
2. Anything not allowed there is asked the first time a feature needs it (the first calendar event the user confirms,
   the first scheduled notification, a site asking for the location). Qutai never asks again once the phone has an
   answer; to take a permission back, the user goes to the phone's settings.
3. The camera and the microphone are asked where their use is obvious: the QR scanner, taking a photo, the microphone
   button, or a site the user allows.
4. Permissions that libraries add but Qutai doesn't use are removed from the Android build (`android.blockedPermissions`
   in `app.json`). `ios/` and `android/` are generated, so every declaration comes from `app.json` and config plugins.

## The rules

- **`OSPERM-1`** Nothing is asked at launch; the setup step "What Qutai may use" is optional, shows the phone's question only when a switch is turned on, and can be passed with all switches off; the camera and microphone are not in it.
  Status: Default (manager or implementing session; open to change) · Why: ask where the use is plain · Source: docs/permissions.md (intro); src/components/PermissionsStep.tsx
- **`OSPERM-2`** Qutai never asks for a permission twice once the phone has answered; taking one back is done in the phone's settings.
  Status: Default (manager or implementing session; open to change) · Why: the phone's settings are "the only place to take a permission back" · Source: docs/permissions.md (intro)
- **`OSPERM-3`** Photos: add-only; Qutai can't see the photo library; attaching images uses the system picker, which needs no permission. The iOS "read photos" text exists only because App Store Connect refuses a build without it, and is never asked.
  Status: Default (manager or implementing session; open to change) · Why: App Store Connect error ITMS-90683 when a bundled library references the photo library API · Source: docs/permissions.md (iOS table)
- **`OSPERM-4`** Calendar: adding events uses write-only access on iOS 17+; full access is asked only for the calendar chooser and for reading the calendar when the user asks about their schedule; Android has no write-only access, so one question covers both.
  Status: Default (manager or implementing session; open to change) · Why: adding events never needs to read the calendar · Source: docs/permissions.md (iOS and Android tables)
- **`OSPERM-5`** Reminders: iOS has no write-only access; Qutai only writes and reads only list names and colours for the chooser; on Android a reminder is a calendar event with an alarm.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/permissions.md
- **`OSPERM-6`** Location is foreground only and approximate is accepted; background location is blocked. Setup's "Use my location" (city question of the typed questions and of "Ask me questions", `INTRO-31`) asks for "while using the app" location only on that tap, never at start, then turns the position into place names with the phone's geocoder (Apple's on iOS, usually Google's on Android); the coordinates are not kept or sent to the AI, only the place name the user keeps becomes the memory "City: …". The iOS usage string in all ten languages already says this (`locales/*.json` NSLocationWhenInUseUsageDescription); no new permission or usage string, so no native rebuild.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: app.json (android.blockedPermissions ACCESS_BACKGROUND_LOCATION, FOREGROUND_SERVICE_LOCATION) · Source: docs/permissions.md
- **`OSPERM-7`** Contacts are read only (adding or editing is blocked), looked up only for a name the user said, at most 5 people; the AI gets names and labels, never numbers or addresses; never in incognito; a short explanation comes before the phone's question.
  Status: Default (manager or implementing session; open to change) · Why: Play's policy wants the use tied to a feature the user starts, with a prominent disclosure · Enforced: In the app: src/agent/contactTool.ts (findContactTool); app.json (WRITE_CONTACTS blocked) · Source: de0d0a2; docs/contacts.md
- **`OSPERM-8`** Today the proposed store answers for contacts are: App Store "Contacts › App Functionality, not linked to identity, not used for tracking"; Google Play "Contacts › collected (names of matches sent to the AI service), not shared, processed ephemerally, optional".
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: data used only on the device is not "collected", but matching names do reach the AI provider, so declaring is the safe side · Source: docs/permissions.md › Notes for the store forms; TODO.md › Contacts
- **`OSPERM-9`** Notifications are local only: no push (no push entitlement on iOS, the push permission blocked on Android).
  Status: Default (manager or implementing session; open to change) · Why: Qutai doesn't use push · Enforced: In the app: app.json (expo-notifications enableRemoteNotifications false; c2dm RECEIVE blocked) · Source: dc01c39; docs/permissions.md
- **`OSPERM-10`** Voice input uses on-device recognition when the phone supports the language; otherwise Apple's or Google's speech service, only after the user agreed once in Qutai, never in incognito; only the text reaches Qutai and the AI.
  Status: Default (manager or implementing session; open to change) · Why: audio leaving the phone needs the user's consent · Source: docs/permissions.md (speech rows)
- **`OSPERM-11`** Face ID and fingerprint are used only for the app lock and the incognito lock.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/permissions.md
- **`OSPERM-12`** iOS background audio is used only for sound the user started on a web page; Qutai plays no sound of its own in the background and keeps no silent audio session.
  Status: Default (manager or implementing session; open to change) · Why: App Review guideline 2.5.4 (background audio only for its intended purpose) · Source: docs/permissions.md (Other store-facing iOS declarations)
- **`OSPERM-13`** iOS App Transport Security: arbitrary loads off, local networking on (for a custom AI endpoint on the home network); the app allows http for a custom endpoint only to loopback and private addresses; the local network question is only for that endpoint (web pages need none).
  Status: Default (manager or implementing session; open to change) · Why: reach Ollama or LM Studio on a home computer without opening http to the internet · Source: docs/permissions.md; a74e1b5
- **`OSPERM-14`** Android allows plain http for the app because Qutai is a browser (see `BLK-26`); the app's own requests stay https.
  Status: Default (manager or implementing session; open to change) · Why: a per-domain network security config can't cover "whatever the user typed" or private address ranges · Source: docs/permissions.md (Cleartext)
- **`OSPERM-16`** Storage: write access only up to Android 10 (for saving and downloads there); read access to storage and media is blocked.
  Status: Default (manager or implementing session; open to change) · Why: Qutai only adds to the gallery; imports use the system picker. Known residue: Android still implies read access up to Android 10 from the write permission, which can't be removed without dropping saving there · Source: dc01c39; docs/permissions.md
- **`OSPERM-17`** Also blocked on Android: Wi-Fi state, the overlay permission (development only), the install referrer and launcher badge permissions.
  Status: Default (manager or implementing session; open to change) · Why: not used (Wi-Fi type comes from the network state; Qutai never sets a badge) · Source: docs/permissions.md (Blocked)
- **`OSPERM-18`** Foreground services: media playback only while a tab plays (and 2 minutes after a pause); "Keep working in the background" (off by default, Android, 30 minutes at most, never incognito) plus a 3-minute "finishing a reply" mode; downloads use a user-initiated job on Android 14+ and a data-sync service only where that job can't run.
  Status: Default (manager or implementing session; open to change) · Why: each runs only for work the user started, with a notification · Source: docs/permissions.md (Install-time permissions; Play Console texts)
- **`OSPERM-19`** Today the Play Console foreground-service declaration still has the old text; the owner must update it and record the video for the 17 Nov "finishing a reply" change.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: the declaration text changed on 17 Nov 2026 · Source: TODO.md › Set-up only the owner can do; docs/permissions.md
- **`OSPERM-20`** `REQUEST_INSTALL_PACKAGES` is declared only so "Open" on a downloaded APK reaches the system installer; a Play declaration text ("Web browsing or search") is drafted.
  Status: Default (manager or implementing session; open to change); whether to file the declaration or drop the permission is an open owner question · Why: Play allows it for web browsers; Firefox declares it too · Source: 21d43e3; docs/permissions.md
- **`OSPERM-23`** Ways in from other apps (share, text selection menu, web search, shortcuts, widget) need no permission; files shared out go through a private file provider limited to hand-out folders, with a read grant per share.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/permissions.md
- **`OSPERM-24`** Store notes: page content, chats and screenshots go from the phone to the AI provider the user chose with the user's own key; no analytics, advertising ID or tracking; the iOS privacy manifest lists the libraries' required-reason APIs and, in the open-source build, no collected data (pro build: `OSPERM-26`).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/permissions.md › Notes for the store forms
- **`OSPERM-25`** Export compliance: `ITSAppUsesNonExemptEncryption` is not in the Info.plist (`ios.config.usesNonExemptEncryption` unset), so App Store Connect asks the export questions for each build. The answer is "standard encryption algorithms instead of, or in addition to, the operating system's". France is left out of the App Store availability until the owner has France's encryption declaration.
  Status: Owner, 2026-11-21 (chose "Beyan et, Fransa hariç" when asked after the store-review audit); key removed the same day after the 0.1.10 upload was refused · Why: backups and exported apps are encrypted in Qutai's own code (XChaCha20-Poly1305 with scrypt, `src/backup/crypto.ts`), so "only the system's encryption" was not true. `true` in the plist needs `ITSEncryptionExportComplianceCode` from approved export documentation (none exists; the upload failed with error 90592), and `false` would declare the encryption exempt, a legal call for the owner · Source: docs/permissions.md
- **`OSPERM-26`** A pro build's iOS privacy manifest lists the collected data types, the same as App Store Connect › App Privacy: email address, user ID, device ID, purchase history, other user content and other usage data; each for app functionality, linked to the account, never for tracking; since 22 Nov 2026 also product interaction for analytics, not linked, never for tracking (`SRV-31`). The open-source build's list stays empty.
  Status: Owner, 2026-11-21 ("düzeltilebileceklerin hepsini düzelt", after the store-review audit); the wording and mechanism are the implementing session's · Why: a pro build signs in to Qutai's server, sells credits and relays requests, so "no collected data" was wrong for it; the manifest and the store's privacy answers must agree. · Where: `plugins/withProAccounts.js`, docs/permissions.md › Notes for the store forms

## Details

- (was `OSPERM-15`) Android's local network permission is not declared at target API 36; it must be declared and asked when targeting API 37. Why: Android's documentation says not to declare it below 37. Where: docs/permissions.md (Local network access).
- (was `OSPERM-21`) The screen-capture detection permission is present only because the screenshot library registers a callback; Qutai only blocks screenshots in incognito and doesn't listen for them. Where: docs/permissions.md.
- (was `OSPERM-22`) The wake lock is held only while a background task's service runs, with a 5-minute timeout that progress renews. Where: docs/permissions.md.

## Limits and what is not built

- Several prompts and strings are not yet checked on a device in every language (TODO › To try on the phone).
- Pro builds' planned analytics will change the store forms (planned, with consent).
- When the app targets Android API 37, the local network permission must be added (planned).

## Where it lives

- `app.json` (plugins, `ios.infoPlist`, `android.blockedPermissions`), `plugins/with*.js`, `locales/*.json`,
  `src/components/PermissionsStep.tsx`, `src/device/permissionStatus.ts`.
- Read next: [docs/permissions.md](../../docs/permissions.md), [docs/contacts.md](../../docs/contacts.md).

## Disagreements between sources

- docs/permissions.md says "Qutai has no servers of its own" and "the collected data types list is empty"; that holds
  for the open-source build, while pro builds have a server (accounts, credits relay, server backup), which the same
  file mentions elsewhere. The store notes don't separate the two builds.
