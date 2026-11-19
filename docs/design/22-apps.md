# 22. Apps inside Qutai

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The assistant can build small personal apps on request ("build me an app where I can keep my notes"). It writes the HTML, CSS and JavaScript itself. The app runs inside Qutai in a sealed box, offline, with its data kept on the phone. The user finds their apps under "My apps".

## How it works

Status by phase (checked against `git log` and `git status` on 19 Nov 2026):

| Phase | What | Status |
| --- | --- | --- |
| 1 | The app format, the runner, the storage bridge, the assistant's `apps` tool, versions and undo, My apps | **Built** (19 Nov 2026; c8b927a, 649a542, 394655f, 453107e). Verified in the iOS simulator; on the Android emulator (API 36) since 903a3f6, which fixed a native crash on open |
| 2 | Export and import as a `.qutaiapp` file, the approval screen, apps in backups, the Android network block | **Built** (19 Nov 2026; 83c8202, 92097ab, ea68c52, 768e14a, 27beec9, ceff51a, 903a3f6): APPS-30 to APPS-41, APPS-50. Tried in the iOS simulator (export, import, approval, backup and restore, break-out 46/46) and on the Android emulator (open from a file, keep both, approval, break-out 45/46); not on a real phone. Needs a native rebuild (file type, WebView patch) |
| 3 | More phone features for apps (share and files, location, notifications, camera and photos, links, asking the assistant) | **Planned.** The calls are already in the contract; today they answer "not available" |
| 4 | Network access to hosts the app declares, and a home-screen shortcut | **Planned** |

1. The user asks, for example "build me an app where I can keep my notes" ("bana bir uygulama oluştur, burada notlarımı tutabileyim"). This is an ordinary assistant request, paid with the user's own key or Qutai Credits. Running an app costs nothing.
2. The assistant uses one tool, `apps`.
   - It fetches the guide (the full contract and the writing rules) only when it is about to build.
   - It creates the app, then previews it: Qutai opens the app on screen and gives the assistant its errors, console lines and blocked attempts, each with file and line.
   - It fixes what the preview shows, at most 3 rounds.
3. The chat shows an app card with **Open** and **Undo**. The app appears under My apps on the new tab page (an invitation card shows while there are none) and in the main menu › Library › My apps.
4. An app opens only when the user taps it. It runs full screen with a slim header: its name, Close, and a ⋮ menu with these items:
   - Edit with the assistant
   - Versions
   - Permissions
   - Reload
   - Rename
   - Export (phase 2)
   - Delete app
5. Inside, the app can do these things:
   - save notes and lists (a small database, 5 MB per app);
   - show Qutai's own dialogs, toasts and haptics;
   - follow the phone's theme, safe areas and text size;
   - use the clipboard. Reading it asks the user once per app ("“Notes” wants to read what you copied"); writing shows "Copied".

   It cannot reach the internet, open websites, see any site's cookies, or see other apps' data.
6. If the app breaks, an overlay says "“Notes” ran into a problem." The technical line (for example `app.js:129`) is under Details, with the buttons **Ask Qutai to fix this**, Reload and Dismiss. "Ask Qutai to fix this" closes the app, opens the assistant in a normal tab and puts the error report in the message box; the user reads it and sends it. A crash ("stopped") and a hang ("isn't responding") each have their own screen.
7. Every change is a new version.
   - Undo on the card, or ⋮ › Versions › "Use this version", moves between versions.
   - The notes stay the same whichever version runs.
   - Delete asks first and says how many versions and how much data will be removed ("This can't be undone").
8. Phase 2: apps can be exported and imported as files and go into backups (Details › File, import and backup).

## The rules

- **`APPS-1`** An app runs only when its current version carries this phone's seal, its state is active, and its contract is supported. The seal is an HMAC under the device key, which is never put in a backup. Anything else shows the approval screen instead of running.
  Status: Default (manager or implementing session; open to change) · Why: a version not made on this phone (an import, a restore on another phone, or a database row changed behind Qutai's back) must not run until the user has seen it · Enforced: In the app: src/components/runnerSession.ts (RunnerSession.load, `runnable`), src/apps/store.ts (AppStore.load, `packageSealMatches`), src/apps/manifest.ts (packageSeal) · Source: docs/mini-apps.md › §1 Seal; c8b927a
- **`APPS-2`** Only the user's **Turn on** approves an unsealed or switched-off app. It re-checks the package, seals it with this phone's key and sets it active. The assistant has no import or approve action.
  Status: Default (manager or implementing session; open to change) · Why: an imported app may come from anyone; the user must see what it is first · Enforced: In the app: src/apps/store.ts (AppStore.approveCurrent), src/components/runnerSession.ts (approve), src/agent/appTools.ts (`action` enum has no import or approve) · Source: docs/mini-apps.md › §1, §8 Trust rules; TODO.md › Phase 2
- **`APPS-3`** An imported app arrives switched off and unsealed, with no grants and with the author set to "imported from <file>". Replacing an existing app also switches it off and drops its grants.
  Status: Default (manager or implementing session; open to change) · Why: the new code may differ; isolation and the permission list bound what it can do, but it can still show misleading content · Enforced: In the app: src/apps/store.ts (AppStore.importApp) · Source: docs/mini-apps.md › §8 Trust rules 1 and 3; 83c8202
- **`APPS-4`** Apps are offline: no network at all in phases 1 to 3. Three layers enforce this:
  - a Content Security Policy written before any byte of the app;
  - a lockdown script that stubs fetch, XHR, WebSocket, EventSource, WebRTC and Workers;
  - on iOS, a WebKit rule list that blocks every http, https, ws and ftp load;
  - on Android, the patched WebView's sandbox (APPS-41).

  Status: Owner, 2026-11-19 · Why: no data leaves the phone and no remote code loads; phase 4 will add only Qutai-mediated fetches to declared hosts · Enforced: In the app: src/apps/document.ts (APP_CSP, buildAppDocument, helperScript, IOS_OFFLINE_RULES), src/components/AppRunner.tsx (iosOfflineRules, contentRuleLists, `appSandbox`), patches/react-native-webview+14.0.1.patch · Source: docs/mini-apps.md › intro, §2 The network block, §8; ea68c52
- **`APPS-5`** Each app runs in its own WebView, created when it opens and destroyed when it closes. It has its own data store: iOS a non-persistent store, Android the `qutai-apps` WebView profile. It is apart from every browsing tab and every other app.
  Status: Owner, 2026-11-19 · Why: an app must not reach other sites' cookies or sessions, other apps' data or Qutai's storage · Enforced: In the app: src/components/AppRunner.tsx (Runner, ANDROID_PROFILE, `incognito` on iOS only) · Source: docs/mini-apps.md › intro, §2 One WebView per open app
- **`APPS-7`** Web storage, cookies and the browser's powerful APIs are refused inside apps:
  - `localStorage`, `sessionStorage`, `indexedDB` and `caches` throw;
  - `document.cookie` stays empty;
  - clipboard, share, credentials, service workers, media devices, geolocation, Bluetooth, USB, payment, notifications and BroadcastChannel are removed.

  Status: Default (manager or implementing session; open to change) · Why: a real origin brings these back; apps must keep data only through the bridge, which is quota-checked, scoped per app and backed up · Enforced: In the app: src/apps/document.ts (helperScript lockdown), src/components/AppRunner.tsx (`domStorageEnabled={false}`, `cacheEnabled={false}`, cookie props) · Source: 453107e; docs/mini-apps.md › §2
- **`APPS-8`** An app never navigates. Only its own document (and `#fragment` links inside it) is allowed. Links, `location =`, forms, meta refresh, `window.open` and `tel:` or `intent:` addresses are refused and reported. On Android the patched WebView refuses navigations natively; a load that starts anyway is stopped and the app rebuilt.
  Status: Default (manager or implementing session; open to change) · Why: navigation would take the app out of its box or carry data in an address; unpatched, Android lets a navigation through when Qutai's JavaScript thread takes over 250 ms to answer · Enforced: In the app: src/apps/document.ts (appNavigationAllowed, click and submit handlers), src/components/runnerSession.ts (allowNavigation, loadStarted), src/components/AppRunner.tsx (`setSupportMultipleWindows={false}`), patches/react-native-webview+14.0.1.patch (shouldOverrideUrlLoading) · Source: docs/mini-apps.md › §2 Navigation, Android navigation decision timeout; ea68c52
- **`APPS-9`** Frames and plugins are not allowed. No script API can put an `iframe`, `frame`, `object`, `embed`, `portal` or `fencedframe` element anywhere (refused before the insertion; HTML strings with a frame start tag are refused; `document.write`, `writeln` and `open` are off), frame tags in the app's markup become unknown elements when the document is built, any that still appear are removed, `contentWindow` returns null, and the policy forbids frames, workers and objects. Extended 19 Nov 2026 (before: removed after they were added).
  Status: Default (manager or implementing session; open to change) · Why: a fresh frame could give back the un-stubbed WebRTC constructors through `window[0]`, and inserting one creates its window at once · Enforced: In the app: src/apps/document.ts (helperScript insertion guard and `scrub`, inlineFiles FRAME_START, APP_CSP) · Source: docs/mini-apps.md › §2 Layer 3; 19 Nov 2026 security pass
- **`APPS-10`** The app's WebView has file access, location, camera and microphone switched off. Mixed content, form autofill saving, data detectors and link previews are off too. The `incognito` prop is never used on Android. `dataDetectorTypes` is always given as an array (a string crashes Android's new architecture natively).
  Status: Default (manager or implementing session; open to change) · Why: phone features must go through the bridge with per-app consent; on Android `incognito` would clear every cookie of the browsing tabs · Enforced: In the app: src/components/AppRunner.tsx (WebView props) · Source: docs/mini-apps.md › §2 table
- **`APPS-11`** The app reaches the phone only through bridge contract 1. Every call is checked in this order: known call, available in this Qutai, declared in the manifest, granted by the user, arguments. Every store query uses the app id the runner holds, never one the app sends.
  Status: Owner, 2026-11-19 · Why: Apple 4.7.2 (no native features without permission) and 4.7.3 (consent each time); a stable contract later phases keep working with · Enforced: In the app: src/apps/contract.ts (checkCall, CALLS, parseBridgeRequest), src/apps/bridge.ts (Bridge.handle, `host.appId`) · Source: docs/mini-apps.md › §3
- **`APPS-12`** Permissions work as follows:
  - storage, ui and app need no declaration;
  - `clipboard-write` must be declared and is not asked (writing shows "Copied");
  - `clipboard-read` must be declared and is asked at first use, per app;
  - an undeclared permission fails even if the user would agree;
  - "Allow" and "Don't allow" are stored per app; dismissing the dialog is not an answer;
  - ⋮ › Permissions resets an answer to "Ask next time".

  Status: Default (manager or implementing session; open to change) · Why: Apple 4.7.3 "explicit user consent in each instance", never "for all apps"; the manifest is the whole list, shown before an import is turned on · Enforced: In the app: src/apps/contract.ts (checkCall), src/apps/manifest.ts (AVAILABLE_PERMISSIONS, ASKED_PERMISSIONS), src/components/runnerSession.ts (askPermission, showPermissions) · Source: docs/mini-apps.md › §4
- **`APPS-13`** Only one Qutai dialog is open at a time (the next call gets `E_BUSY`), and at most 32 calls can be in flight. Every dialog an app opens carries a "From app: <name>" line.
  Status: Default (manager or implementing session; open to change) · Why: dialog spam, and an app pretending to be Qutai · Enforced: In the app: src/apps/bridge.ts (Bridge.dialog, LIMITS.inFlight), src/components/runnerSession.ts (`fromApp`) · Source: docs/mini-apps.md › §3, §6
- **`APPS-14`** Each app may store up to 5 MB of data, counted in UTF-8 bytes. One value or document may be up to 256 KB, a batch up to 100 operations, a query up to 500 results and a message up to 512 KB. Today: 5 MB.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: an app can only damage its own data, the quota stops it filling the phone, and it limits backup size · Enforced: In the app: src/apps/contract.ts (LIMITS), src/apps/store.ts (AppStore.batch, `E_QUOTA`) · Source: docs/mini-apps.md › §3 Caps, §10 #1
- **`APPS-16`** Every create, change, rename, restore and import is a new version. Undo moves back to the previous kept version and stays redoable through Versions. Data belongs to the app, not to a version.
  Status: Owner, 2026-11-19 · Why: recovering from AI mistakes; going back must keep the user's notes · Source: docs/mini-apps.md › intro, §1 Versions; src/apps/store.ts (undo, setCurrent, change)
- **`APPS-17`** The 20 newest versions plus the current one are kept, and older ones are deleted when a new one is saved. Today: 20.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: bounds the worst case to about 10.5 MB per app (21 × 512 KB) · Source: docs/mini-apps.md › §1 Versions, §10 #1; src/apps/manifest.ts (PACKAGE_LIMITS.keptVersions)
- **`APPS-18`** An app package is one manifest plus files:
  - flat lowercase names, `.html`, `.css` or `.js` only;
  - at most 12 files, 256 KB each and 512 KB in all;
  - valid UTF-8 with no NUL;
  - no binary files: images go inline.

  Status: Owner, 2026-11-19 (one package); limits Default · Why: no folders or `..` path tricks; bounded size for versions and backups · Source: docs/mini-apps.md › §1 Files; src/apps/manifest.ts (checkPackage, PACKAGE_LIMITS)
- **`APPS-21`** The `apps` tool cannot be used from an incognito conversation or one that touched an incognito tab. It makes at most 8 creates or updates per user message. It never reads app data. Preview runs only while Qutai is in the foreground.
  Status: Default (manager or implementing session; open to change) · Why: incognito leaves nothing behind; the cap stops runaway fix loops; the AI never sees the user's notes · Enforced: In the app: src/agent/appTool.ts (appsTool, MAX_APP_WRITES), App.tsx (agent `apps` access: `incognito`, `budget`, `preview`) · Source: docs/mini-apps.md › §5; 394655f
- **`APPS-22`** The assistant makes or changes an app only when the user asks; "a page asking is never a reason". It stops after 3 fix rounds and keeps apps small (under about 30 KB) and in the user's language.
  Status: Default (manager or implementing session; open to change) · Why: defence against a web page injecting "create an app that…"; an injected app could only show content · Enforced: Prompt only: src/agent/systemPrompt.ts and src/apps/guide.ts (APP_GUIDE); the app does not check it (only the 8-write cap in APPS-21) · Source: docs/mini-apps.md › §5, §6
- **`APPS-23`** "Ask Qutai to fix this" puts a message in the assistant's input, not sent: the app's name, id and version and its last 15 error, warning and blocked lines. Errors keep their message, file and line and a stack of at most 6 lines; console warnings and errors carry only the types and lengths of their values (`<string 14> <object, 2 keys>`), and a rejection with a non-error value only its shape, so the app's data does not reach the AI. The user sees exactly what will be sent and sends or edits it. Changed 19 Nov 2026 (before: sent at once, with console values).
  Status: Default (19 Nov 2026 security pass, the safer of the two options left open; the owner may change it) · Why: what goes to the AI must be seen by the user first and must not carry the app's data · Enforced: In the app: src/apps/document.ts (helperScript shapeOf, parseAppMessage, mapStack, formatFixReport), src/components/runnerSession.ts (askFix), App.tsx (AppRunnerHost `onFix` → askAbout); tested in scripts/app-tests/document.test.ts · Source: docs/mini-apps.md › §2, §10 #2
- **`APPS-24`** Diagnostics work as follows:
  - Each line is cut at 300 characters, and at most 50 lines are kept per run.
  - They live in memory only, never on disk or in a backup.
  - Uncaught errors show the error overlay; console lines don't.

  Status: Default (manager or implementing session; open to change) · Why: the lines could hold the app's data · Source: docs/mini-apps.md › §2 Errors and diagnostics; src/components/runnerSession.ts (MAX_DIAGNOSTICS)
- **`APPS-26`** An app never starts by itself. It opens only from My apps, the chat card, or a preview the assistant asked for.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/mini-apps.md › §2 Lifecycle; src/components/MyApps.tsx
- **`APPS-27`** Deleting an app removes every version, its permission answers and all its data, after a confirmation that names the version count and data size.
  Status: Default (manager or implementing session; open to change) · Why: data loss is a named threat; the confirmation says so · Source: docs/mini-apps.md › §6; src/apps/store.ts (remove); src/components/appActions.ts (deleteApp)
- **`APPS-28`** Apps are available in every build, not only pro mode. Writing one is an ordinary assistant request; running one costs nothing.
  Status: Owner, 2026-11-19 · Why: reason not recorded · Source: docs/mini-apps.md › intro; README › Apps (My apps)
- **`APPS-29`** Sharing is by file only. There is no gallery, store or catalogue of apps.
  Status: Owner, 2026-11-19 · Why: each user's apps are private, which keeps Qutai clear of the Apple 4.7.4 index and 4.7.5 age-rating duties of a mini-app platform · Source: docs/mini-apps.md › intro, §7
- **`APPS-31`** Export is without data by default; "with my data" is the user's choice, and the file name then ends in " (with data)".
  Status: Default (manager or implementing session; open to change) · Why: the data can be personal and goes wherever the file is sent · Enforced: In the app: src/components/appActions.ts (exportApp), src/apps/appFile.ts (appFileName) · Source: docs/mini-apps.md › §8; 92097ab
- **`APPS-33`** Format 1 has no author signatures.
  Status: Default (manager or implementing session; open to change) · Why: no keys to manage and no false sense of trust; the review screen and isolation are the protection · Source: docs/mini-apps.md › §1, §8
- **`APPS-34`** Imports start only from a user's tap: My apps › Import an app, opening a `.qutaiapp` from outside (after the app lock), or Open on a finished Qutai download. Never from an incognito tab, and never by the assistant.
  Status: Default (manager or implementing session; open to change) · Why: nothing imports by itself; a web page can only start a download; incognito leaves nothing behind · Enforced: In the app: App.tsx (entry kind `appFile`: switches to a normal tab first; My apps import), src/components/openDownload.ts (an incognito download is refused with `apps.importIncognito`), src/device/appFile.ts, src/apps/importState.ts (appImporter) · Source: docs/mini-apps.md › §8 Import; 92097ab
- **`APPS-35`** The import screen and the approval screen show the same review:
  - name and "written by someone else";
  - the warning "never type a password into an app";
  - size, permissions and code flags (RTCPeerConnection, iframe, `frames[`, eval, WebAssembly);
  - the files, with their code readable;
  - **Also bring in its data**, off by default.

  Status: Default (manager or implementing session; open to change) · Why: informed consent; the flags mark techniques apps don't normally need (the WebRTC risk) · Enforced: In the app: src/components/AppImport.tsx (AppReview, also used by the runner's approval screen in src/components/AppRunner.tsx), src/apps/appFile.ts (codeFlags) · Source: docs/mini-apps.md › §8 import screen; TODO.md › Phase 2; 92097ab
- **`APPS-36`** When an import clashes by id or name, the user picks **Keep both** (a new id, name " 2") or **Replace** (the next version of that app, with the phone's data kept). Replacing the data too needs a second confirmation that names both sizes.
  Status: Default (manager or implementing session; open to change) · Why: two copies never share data; data is never replaced silently · Enforced: In the app: src/apps/store.ts (AppStore.importApp), src/apps/appFile.ts (uniqueAppName) · Source: docs/mini-apps.md › §8 Trust rules 2-3; 83c8202
- **`APPS-37`** On Android, Qutai opens files sent as `application/vnd.qutai.app+json` and also `application/octet-stream`. The intent filter is never BROWSABLE.
  Status: Owner, date not recorded (octet-stream) · Why: Android can't match a `content://` file by extension; the cost is that Qutai appears in "Open with" for other unknown files and then says plainly it isn't a Qutai app; not BROWSABLE so a web page can't launch it · Enforced: In the app: plugins/withAppFiles.js (Android VIEW intent filter, DEFAULT only; iOS document type) · Source: docs/mini-apps.md › §8 Type and "Open in Qutai"; 92097ab
- **`APPS-38`** Backups (the encrypted file and the server backup) carry each app's current version with its seal, state and permission answers. App data is included when the "Apps' data" choice is on. Both switches (Apps, Apps' data) are on by default.
  Status: Default (manager or implementing session; open to change) · Why: apps are the user's own work and small; without data a restored notes app is empty, "the loss a backup is for" · Enforced: In the app: src/apps/appBackup.ts (collectBackupApps), src/backup/database.ts (ExportChoice `apps`, `appData`), src/components/BackupScreen.tsx, src/components/ServerBackupSection.tsx, src/backup/server/logic.ts (defaults `apps: true`, `appData: true`) · Source: docs/mini-apps.md › §8 Backup and restore; 83c8202, 92097ab
- **`APPS-39`** Restore re-checks each app and skips one that fails, never the whole restore.
  - On the same phone (the seal verifies) the app comes back exactly as it was.
  - On another phone, or after a reinstall, it comes back switched off, unsealed and without permission answers, with its data intact.
  - Merge keeps the phone's copy. Replace never empties an app because the backup was made without data.
  - An older Qutai ignores the apps section.

  Status: Default (manager or implementing session; open to change) · Why: the same rule as kept scripts; a backup is not proof of who wrote the code · Enforced: In the app: src/apps/appBackup.ts (restoredAppState, restoreApps, readBackupApps) · Source: docs/mini-apps.md › §8 Restore; 83c8202
- **`APPS-40`** If a server backup with apps' data is over the account's per-backup limit, it is made again without apps' data, uploaded, and the screen says so.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded beyond keeping the backup uploadable · Source: docs/mini-apps.md › §8 Size; src/backup/server/index.ts (appDataFallback, `appDataLeftOut`); 92097ab
- **`APPS-41`** On Android, apps run in a native sandbox (a patched WebView prop, `appSandbox`, runner only). It blocks every network load, answers every request with an empty 403, refuses navigations without waiting for JavaScript, and runs the frame guard (removes WebRTC) at document start in every frame where the WebView supports it. iOS runs the frame guard as a user script in every frame. Every app document has `x-dns-prefetch-control: off`.
  Status: Default (manager or implementing session; open to change) · Why: before it, on Android only the policy blocked subresources and the 250 ms race could let one navigation out; imported apps are not written on the user's request · Only `data:`, `blob:` and `about:` pass the 403 (the app's own document arrives as a `data:` request on recent WebViews; 903a3f6). Enforced: In the app (ea68c52, 903a3f6; break-out on the Android emulator: every network and navigation case blocked, including the busy-thread race): patches/react-native-webview+14.0.1.patch (setAppSandbox, RNCWebViewClient), src/components/AppRunner.tsx (`appSandbox`, `injectedJavaScriptBeforeContentLoaded`), src/apps/document.ts (APP_FRAME_GUARD) · Source: docs/mini-apps.md › §8 The Android network block; TODO.md › Phase 2
- **`APPS-42`** Some residual risks are accepted for phase 1:
  - WebRTC packets to a STUN server can carry a few bytes if an engine bug ever gave an app the constructors. The `window[0]` route of a fresh `about:blank` frame (Android document-start scripts skip that document) is closed since 19 Nov 2026: no frame can be created (`APPS-9`); the 25 frame routes of the break-out app are blocked in desktop Chromium, which like Android has no frame guard in frames. iOS also runs the frame guard in every frame;
  - DNS prefetch of link hosts by an engine that ignores `x-dns-prefetch-control: off`;
  - timing or visual tricks that need the user's help;
  - on an Android WebView without document-start scripts, no frame guard in sub-frames.

  ea68c52 closed the Android 250 ms race and subresources resting on the policy alone (confirmed on the emulator); the insertion guard closed the Android WebRTC frame route (19 Nov 2026). Also left: a user's own paste of HTML into an app's editable area (not a script API). Today: accepted, mitigated by the stubs, the frame guards, the code flags on the import screen and the rebuild.
  Status: Default (19 Nov 2026 security pass closed the open case the owner was asked about) · Why: no WebView lets an app turn WebRTC off; all need code the user asked for; none reaches cookies, other apps or Qutai's storage; imports raise them · Enforced: In the app: src/apps/document.ts (helperScript RTC stubs, insertion guard, scrub, APP_FRAME_GUARD), src/components/runnerSession.ts (loadStarted), patches/react-native-webview+14.0.1.patch · Source: docs/mini-apps.md › §2 What can't be blocked, §8; ea68c52; 19 Nov 2026 security pass
- **`APPS-43`** Phase 3 phone features are each declared and asked per app. `assistant.ask` shows each question and its cost source first, and links ask every time. Today: none are available.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) on whether to raise Apple Guideline 4.7.2 before building them · Why: 4.7.2 speaks of "prior permission from Apple" for native features exposed to downloaded or generated code · Enforced: In the app: src/apps/contract.ts (IMPLEMENTED_PHASE = 1, answers `E_NOT_AVAILABLE`) · Source: docs/mini-apps.md › §7, §9, §10 #3
- **`APPS-44`** Phase 4 network goes only through Qutai's `network.fetch`, to https hosts listed in the manifest, with no cookies and with size and rate caps. The hosts are shown when the app is turned on. The policy stays `connect-src 'none'`.
  Status: Default (manager or implementing session; open to change) · Why: Qutai, not the WebView, checks host, method and size · Enforced: Designed, not built (the manifest's `network` must be empty today) · Source: docs/mini-apps.md › §3, §9
- **`APPS-45`** There is no report button for AI-generated apps. Today: none.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: Apple 4.7.1 asks for "a mechanism to report content" and Play's AI-Generated Content policy asks for in-app reporting; the doc argues the general AI-report question covers it since apps are not shared inside Qutai · Source: docs/mini-apps.md › §7, §10 #4
- **`APPS-46`** The privacy policies say nothing about apps yet, and the legal version is not bumped. The proposed sentence: apps are stored only on the phone, and the app's code (not its data) and its error messages go to the AI provider when the user asks Qutai to make or fix it.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: reason not recorded (legal bumps are left to the owner) · Source: docs/mini-apps.md › §10 #5; src/legal (no mention)
- **`APPS-47`** The App Review notes describe apps as personal tools written at the user's request:
  - they run in a sandboxed WKWebView with no network, cookies or navigation;
  - no code is downloaded from Qutai, and there is no store;
  - "My apps" is the index Apple 4.7.4 asks for.

  For Google Play: the runner has no added JavaScript interface and loads no web content.
  Status: Default (manager or implementing session; open to change) · Why: Apple 2.5.2 and 4.7, which a reviewer may read as "HTML5 and JavaScript mini apps"; Play's Device and Network Abuse example is a webview with an added JavaScript interface loading untrusted content · Enforced: In the app: src/components/AppRunner.tsx (only `onMessage`, no injected native interface) · Source: docs/mini-apps.md › §7
- **`APPS-49`** The file backup and the server backup each keep their own Apps and Apps' data choice. Apps' data can only be on when Apps is on.
  Status: Default (manager or implementing session; open to change) · Why: "Server backups keep their own choice, like the other switches" · Source: docs/mini-apps.md › §8 Backup and restore; src/components/BackupScreen.tsx (`appData: apps && appData`), src/backup/server/index.ts; 92097ab
- **`APPS-50`** The approval screen of an app made with Qutai but not sealed here (restored elsewhere, or changed) leaves out "made on this phone".
  Status: Default (manager or implementing session; open to change) · Why: the line would be untrue · Enforced: In the app: src/components/AppRunner.tsx (approval screen, `showAuthor`), src/components/AppImport.tsx (AppReview `showAuthor`) · Source: 768e14a

## Details

Plain facts about how this area is built. Each was a rule; its old id is kept as "was".

**The app's document and origin**

- (was `APPS-6`) Each app has its own origin, `https://<app-id>.apps.qutai.invalid/`. The `.invalid` domain never resolves. Why: the first build used an opaque `about:blank` origin, and WebKit then reported every app error as "Script error." with no line, which blinded the fix loop (found in the simulator run); a separate origin per app also keeps apps apart. · Where: In the app: src/apps/document.ts (appBaseUrl), src/components/runnerSession.ts (baseUrl); 453107e; docs/mini-apps.md › §2
- (was `APPS-20`) Qutai never loads the app's files as they are. It builds one document: the policy first, then the lockdown and helper library, then the base styles, then the app with its CSS and JS inlined. External links and scripts are removed, and a line map turns errors back into `file:line`. Why: nothing the app writes can loosen the policy (a second policy only adds restrictions); the line map lets the fix loop say `app.js:37`. · Where: In the app: src/apps/document.ts (buildAppDocument, inlineFiles); docs/mini-apps.md › §1 How the document is built
- (was `APPS-19`) A custom app icon must be a small SVG subset: at most 4 KB, only whitelisted shapes and attributes, and no `url(`, scripts, links, text or filters. It is drawn natively with Skia, never in a WebView. Why: even a bad SVG then has no script and no network. · Where: In the app: src/apps/manifest.ts (checkSvgIcon); docs/mini-apps.md › §1 SVG icon subset

**File, import and backup**

- How it works, phase 2: export from My apps or the runner's ⋮ menu via the share sheet (APPS-31); import from My apps, a `.qutaiapp` opened from Files, mail or AirDrop, or a tapped download (Downloads closes first: iOS shows one sheet at a time) (APPS-34); the review (APPS-35); arrives off until **Turn on** (APPS-2, APPS-3); **Apps** and **Apps' data** in Settings › Backup and the server backup's "What goes in", with the size; restored elsewhere, off (APPS-38, APPS-39).
- (was `APPS-30`) The export file `.qutaiapp` is one readable JSON object, not a zip. It holds:
  - the current version only;
  - a SHA-256 of the package, and of the data when included;
  - never the permission answers. Why: everything is text; JSON needs no archive parser (no zip-slip, no compression bombs, no extra library) and anyone can read the code first; versions are an undo aid that could reach 10 MB. · Where: In the app: src/apps/appFile.ts (buildAppFile, readAppFile); docs/mini-apps.md › §8; 83c8202
- (was `APPS-32`) An import is checked before anything is stored, in this order:
  - the file is at most 8 MB, refused before it is read;
  - it is JSON of the right shape and from a supported version;
  - the package passes its checks and its hash matches;
  - the data hash matches and the data stays within the 5 MB quota.

  A hash mismatch is refused as "damaged or changed after it was exported". Why: the file is untrusted input; a hash catches damage and careless edits but is not a signature, so trust comes from APPS-3. · Where: In the app: src/apps/appFile.ts (readAppFile, checkAppData, APP_FILE_MAX_BYTES); docs/mini-apps.md › §8 Limits; 83c8202

**Storage**

- (was `APPS-15`) Writes are all or nothing. Every write, `batch` and `setMany` is one SQLite transaction with the quota checked inside it. Writes for one app are queued so they can't interleave. Why: an app that awaits its writes loses nothing if the system kills Qutai; a failed batch leaves nothing behind. · Where: docs/mini-apps.md › §3 Atomic writes; src/apps/store.ts (serial, batch)

**Runner**

- (was `APPS-25`) A crash shows "stopped" with Reload and Close. A hang is caught by a ping every 5 seconds and shows "isn't responding" when no answer comes; the code waits 12 s. Qutai itself keeps working. Why: an endless loop or a crashed web process must not freeze Qutai. · Where: docs/mini-apps.md › §2 Lifecycle; src/components/runnerSession.ts (PING_MS, HANG_MS)
- (was `APPS-48`) A file opened from outside goes only to the import screen, over a normal tab, with the panel and My apps closed. On iOS, Qutai deletes its copy of the file in `Documents/Inbox` after reading it. Why: nothing imports by itself; incognito leaves nothing behind; reason for deleting the copy not recorded beyond "Qutai's to remove". · Where: In the app: App.tsx (entry kind `appFile`), src/device/entryPoints.ts, src/device/appFile.ts; docs/mini-apps.md › §8 Import; 92097ab

## Why it is designed this way

The owner accepted the frame on 19 Nov 2026: one package, its own isolated WebView, offline, a small versioned bridge, sharing only by file, every build, and versions kept. The design then treats every app as untrusted code, even one the assistant wrote, because the next step (import) brings code from strangers.

Protection is layered:
- an engine-enforced policy;
- a native navigation refusal (on iOS also a native network rule list, and on Android the patched sandbox's `blockNetworkLoads`);
- a lockdown script for clear error messages;
- a per-device seal, so nothing runs that the user did not make or approve on this phone.

A hash is deliberately not treated as trust: the switched-off arrival and the review screen are. Contract 1 already lists every call of all four phases, so later phases add features without breaking existing apps.

## Limits and what is not built

- Phase 2 is tried in the iOS simulator and on the Android emulator, not on a real phone. Only unit tests cover a restore on another phone and a server backup over the limit. Untried: importing from Qutai's own Downloads, Replace, and export and backup on Android.
- Untested on a device: TalkBack and VoiceOver; large text and landscape; the Android back button inside an app; the hang and crash screens.
- On an Android System WebView older than 119 (no multi-profile), apps use the default profile. Only `domStorageEnabled={false}`, the cookie settings and the lockdown separate them from browsing data.
- Phase 3 bridges and phase 4 network and home-screen shortcut (planned).
- Not planned: a gallery or store (owner: file sharing only); author signatures (no keys, no false trust); binary assets in format 1 (a later file version may use zip); the assistant reading app data (privacy).
- Queries run in JavaScript over one collection, with no joins: "enough for notes, lists, trackers and simple journals".

## Where it lives

- Design and contract: [docs/mini-apps.md](../../docs/mini-apps.md). Test steps: [docs/test-checklist.md](../../docs/test-checklist.md) › 18 (phase 1) and 19 (phase 2, with the 19 Nov results). docs/server-backup.md: the server needs no change for apps (one opaque blob).
- Core, `src/apps/`: `manifest.ts` (format, checks, seal), `contract.ts` (calls, limits, checkCall), `document.ts` (policy, lockdown, frame guard, `qutai.js`, origin, navigation rule), `bridge.ts`, `store.ts` (SQLite, versions, quota, import), `query.ts`, `guide.ts`, `appFile.ts` (`.qutaiapp`), `appBackup.ts` (backup and restore).
- Runner and UI, `src/components/`: `AppRunner.tsx`, `runnerSession.ts`, `MyApps.tsx`, `AppCard.tsx`, `appActions.ts`, `AppImport.tsx` (import screen and the review used by the approval screen), `openDownload.ts` (a tapped download); `plugins/withAppFiles.js` (file association), `src/device/appFile.ts` (pick, share, read an opened file); the runner is mounted in `App.tsx`.
- Android sandbox: `patches/react-native-webview+14.0.1.patch` (`appSandbox`).
- Assistant: `src/agent/appTools.ts`, `src/agent/appTool.ts`, the prompt line in `src/agent/systemPrompt.ts`.
- Backup: `src/backup/payload.ts`, `src/backup/database.ts`.
- Tests: `npm run test:apps`; the break-out app `scripts/app-tests/breakoutApp.mjs` (71 cases since 19 Nov 2026 with 25 frame routes, all blocked in desktop Chromium through `scripts/page-tests/serve.mjs` › `/app-breakout`; earlier, with 8fe931c's `window[0]` and busy-thread race cases: 46/46 blocked in the iOS simulator, 45/46 on the Android emulator); `sandbox.test.ts`; `export-fixtures.ts` writes `.qutaiapp` files for phone checks.

## Disagreements between sources

- **Hang timeout:** docs/mini-apps.md §2 says 10 seconds without an answer. The code waits 12 s (`HANG_MS` in src/components/runnerSession.ts).
- **iOS rule list name:** the doc calls it `qutai-apps-offline-v1`; the code uses `qutaiapps-offline-v1` (`IOS_OFFLINE_RULE_LIST_ID`). It is a name only.
- **"Opaque origin":** TODO.md › Phase 1, the comment at the top of src/components/AppRunner.tsx and commit 649a542 still say "opaque origin". 453107e replaced it with an own origin under `.invalid`, and the code follows 453107e.
- **Data entry limit:** doc §8 allows at most 20,000 data entries in an import. The code allows 100,000 (`APP_DATA_MAX_ENTRIES` in src/apps/appFile.ts).
- **Website limits:** the website (441b6d1) lists "not in backups, no export" as limits. Since 92097ab, apps are in backups and can be exported, so these website limits are out of date.
- **Passwords in dialogs:** doc §6 says Qutai's dialogs "never take passwords". Nothing in the code stops an app's `ui.prompt` from asking for one; only the import warning tells the user not to.
- **Undocumented header:** the built document also sets `<meta name="referrer" content="no-referrer">`, which the doc's document outline doesn't mention.
- **Open-source builds:** "every build" comes from the doc ("not only pro mode"). No source names the open-source build explicitly. The code has no build gate.
