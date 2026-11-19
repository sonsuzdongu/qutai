# 8. Incognito and locks

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Incognito (private) tabs save nothing and keep their cookies and site data apart; the assistant works in them with
fewer powers. Two locks protect Qutai and its incognito tabs from other people holding the phone.

## How it works

1. An incognito tab writes nothing: no history, no recently closed tab, no restored tab, no chat on disk, no memory,
   no activity history, and "What was sent to the AI" keeps its entries in memory only. A conversation that touches
   an incognito tab counts as incognito from then on, and its earlier saved entries are removed.
2. The assistant still reads and acts on pages there, but refuses the calendar, reminders, notifications, location,
   contacts and saving memories. Example: "add this concert to my calendar" from an incognito tab → "this conversation
   involves incognito tabs, so nothing is added…". Page suggestions that need location or the calendar are not shown,
   and the address bar asks no search engine for suggestions.
3. Isolation: on iOS each incognito tab has its own temporary data store, gone when the tab closes. On Android all
   incognito tabs open at the same time share one separate WebView profile (one private session); closing the last
   one empties it, and leftovers are deleted at the next start. On Android phones whose System WebView is too old for
   profiles, incognito tabs share cookies with normal tabs, and the app says so where incognito tabs are shown.
4. Screenshots and screen recording are blocked while incognito content is on screen, and the app switcher shows a
   blank (Android) or blurred (iOS) preview.
5. Settings › Privacy and security › "Lock Qutai" asks for Face ID, fingerprint or the phone's passcode when Qutai
   opens and whenever it comes back from the background. "Lock incognito tabs" hides incognito tabs after the user
   leaves Qutai until they unlock again; the lock screen offers "Go to normal tabs".
6. When a site asks for the location, camera or microphone in an incognito tab, "Always allow" is not offered and
   "Allow once" covers that one request.

## The rules

- **`INC-1`** Incognito tabs are never written to history, never remembered as recently closed and never restored.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/Browser.ts (history listener skips incognito; closed and restorable tabs exclude them) · Source: 58b50dd; 7dd25a5; 04d94f1
- **`INC-2`** A conversation that touches an incognito tab is never written to disk, and its earlier "sent to the AI" entries are removed from disk.
  Status: Default (manager or implementing session; open to change) · Why: incognito leaves nothing behind · Enforced: In the app: src/chat/Conversation.ts; src/agent/executeTool.ts (touchedIncognito); src/storage/sentLog.ts (recordSent) · Source: 0df7b0e; ee5960d
- **`INC-3`** Nothing is saved to memory from an incognito conversation (memory can still be read).
  Status: Default (manager or implementing session; open to change) · Why: "Incognito conversations leave nothing behind, memories included" · Enforced: In the app: src/agent/executeTool.ts (memoryTool) · Source: 09f1190
- **`INC-4`** Calendar events, reminders, notifications, reading the calendar and the location are refused in incognito conversations, before any question.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/executeTool.ts (schedulingTool, readCalendarTool, locationTool) · Source: 5e51edb; 64cd8c6; e60fa84
- **`INC-5`** Contacts are off in incognito conversations.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/contactTool.ts (findContactTool) · Source: de0d0a2
- **`INC-6`** No action from an incognito tab is recorded in the activity history.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/executeTool.ts (executeUnredacted record) · Source: 647fbd5
- **`INC-7`** Remote search suggestions are always off in incognito.
  Status: Owner, date not recorded · Why: reason not recorded · Enforced: In the app: src/components/OmniboxSuggestions.tsx (remoteAllowed) · Source: ROADMAP.md › 5. Decisions
- **`INC-9`** On Android, incognito tabs open at the same time share one WebView profile of their own (cookies, site storage, cache, service workers, location permissions); each incognito session gets a new profile, emptied when its last tab closes and deleted at the next start.
  Status: Default (manager or implementing session; open to change) · Why: WebView can't delete a profile the running app has used, so a new name per session · Enforced: In the app: src/device/webviewProfile.ts (newIncognitoProfile, endIncognitoProfile, deleteLeftoverIncognitoProfiles); patches/react-native-webview+14.0.1.patch · Source: 86eace5
- **`INC-10`** On Android WebViews without profile support, incognito tabs share cookies and site data with normal tabs (cache and form saving off), and the tab switcher, the new incognito tab page and Settings say so and suggest updating Android System WebView.
  Status: Default (manager or implementing session; open to change) · Why: be honest where isolation isn't possible · Enforced: In the app: src/device/webviewProfile.ts (incognitoIsolated, incognitoInfoKey) · Source: 58b50dd; 86eace5
- **`INC-11`** On iOS each incognito tab has its own temporary data store, gone when the tab closes.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: the WebView's incognito prop (src/device/webviewProfile.ts note) · Source: README › Known limitations
- **`INC-12`** System screenshots and screen recording are blocked while incognito content is on screen (also the tab switcher showing incognito tabs); the app switcher preview is blank on Android and blurred on iOS; screenshots the user saves from the menu still work.
  Status: Default (manager or implementing session; open to change) · Why: "Like Chrome" · Enforced: In the app: src/device/useIncognitoProtection.ts (useIncognitoProtection) · Source: 97af904
- **`INC-13`** In incognito, location, camera, microphone and personal-information prompts never offer "Always allow", "Allow once" covers that one request, a stored "allow" is ignored (asks) and a stored "block" still applies.
  Status: Default (manager or implementing session; open to change) · Why: incognito never remembers · Enforced: In the app: src/browser/sitePrompt.ts (askSitePermission); src/browser/geolocation.ts and src/browser/mediaCapture.ts (settingFor) · Source: e60fa84; 0e8b19f
- **`INC-14`** No approval given in incognito is remembered: the assistant's action confirmation offers neither "Always allow on {site}" nor "Don't ask again" for an incognito tab or a conversation that touched one, like the site prompts (`INC-13`); the publish, pay, personal-information, hidden-value, script, style, cookie and download questions never offer it there. Changed 19 Nov 2026 (before: the action confirmation offered and saved "Always allow").
  Status: Default (manager or implementing session; open to change) · Why: incognito leaves no trace (owner principle) · Enforced: In the app: src/agent/alwaysAllow.ts (rememberOffer), App.tsx (askConfirmation) · Source: 647fbd5; 19 Nov 2026 security pass
- **`INC-15`** "Keep working in the background" never runs for incognito conversations.
  Status: Default (manager or implementing session; open to change) · Why: its notification would show incognito use · Enforced: In the app: src/device/backgroundTask.ts (forbidBackground) · Source: 0b5f332
- **`INC-16`** Today the short "finishing a reply" keep-alive for an own-key request is not used for incognito conversations on Android; iOS holds anyway.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: it shows a notification, and "nothing about incognito use may appear in" one · Enforced: In the app: src/device/requestHoldLogic.ts (mayHold) · Source: 488c3e0
- **`INC-17`** Tabs opened from an incognito tab, and links in an incognito conversation's answers, stay incognito.
  Status: Default (manager or implementing session; open to change) · Why: "like in regular browsers"; tab groups never mix modes · Enforced: In the app: src/agent/executeTool.ts (open_tab); src/browser/chatLinks.ts (chatLinkPlan) · Source: 0c8ab8d
- **`INC-18`** Nothing arriving from outside the app opens in an incognito tab, except the explicit `qutai://new-private-tab` (behind the incognito lock if it is on).
  Status: Default (manager or implementing session; open to change) · Why: outside input is untrusted · Enforced: In the app: src/device/entryPoints.ts (entryFromAppLink) · Source: 6928cb1
- **`INC-19`** Picture-in-picture is not offered for incognito tabs or while the app lock is on; the media notification shows "Private tab" with no artwork; incognito tabs never go to sleep.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: README › Known limitations
- **`INC-20`** Styles and scripts are never kept from an incognito tab and kept scripts never run there; kept styles and hide rules do apply there.
  Status: Default (manager or implementing session; open to change) · Why: nothing is written from incognito; the user's own rules apply in every tab · Enforced: In the app: per docs/page-customisation.md › Injection, Kept scripts · Source: docs/page-customisation.md
- **`INC-21`** A download from an incognito tab is listed only while the incognito session lasts and uses the incognito cookies; the file itself is kept.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/Browser.ts (onIncognitoEnd); src/storage/downloads.ts · Source: fix 9 hand-over
- **`INC-22`** A certificate exception made in an incognito tab belongs to that tab and goes with it.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/certificateExceptions.ts; src/browser/Browser.ts · Source: 06b61bb
- **`INC-23`** Online speech recognition (Apple's or Google's service) is never used in incognito conversations.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/permissions.md (speech recognition row)
- **`INC-24`** A notification the assistant scheduled carries only a random in-memory key for an incognito tab, so an incognito tab is never reopened from it.
  Status: Default (manager or implementing session; open to change) · Why: no URL or title in a notification · Source: README › Known limitations; fix 10 hand-over
- **`INC-25`** "Lock Qutai" asks for Face ID, fingerprint or the device passcode on start and on every return from the background; "Lock incognito tabs" hides incognito tabs after leaving Qutai until unlocked, with "Go to normal tabs".
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: App.tsx (appLocked, incognitoUnlocked, unlock); src/device/biometric.ts (authenticate) · Source: a365175
- **`INC-26`** A lock can be turned on only when the phone has a screen lock, after one verification; settings load before the app draws, so tabs never show for a moment behind a lock.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/device/biometric.ts (canAuthenticate) · Source: a365175
- **`INC-27`** Both locks are off by default, are not in backups and can't be changed by the assistant.
  Status: Default (manager or implementing session; open to change) · Why: "locks protect the user's data from other people" · Enforced: In the app: src/storage/settings.ts (DEFAULT_SETTINGS); src/agent/settingsTool.ts (PROTECTED); src/backup/backup.ts (absent) · Source: a365175; 7eae6a1; febcdb4
- **`INC-28`** With the app lock on, things arriving from other apps wait until the user unlocks.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/device/entryPoints.ts (useEntryPoints) · Source: 6928cb1

## Details

- (was `INC-8`) Page suggestions in incognito leave out anything that needs the location or the calendar. Why: incognito conversations never share the location. Where: src/agent/pageSuggestions.ts (pageSuggestions); e19a721.

## Limits and what is not built

- The assistant panel's search widget uses the normal WebView profile even in incognito conversations (known, not fixed).
- iOS keeps a camera or microphone grant for the page, so a page that goes around Qutai's wrapper could reuse it in
  incognito without a new question.
- Android isolation depends on the phone's System WebView supporting profiles; no minimum version is documented.
- Saved tasks can be used from incognito conversations.

## Where it lives

- `src/browser/Browser.ts`, `src/device/webviewProfile.ts`, `src/device/useIncognitoProtection.ts`,
  `src/device/biometric.ts`, `App.tsx` (locks), `src/agent/executeTool.ts`, `src/storage/sentLog.ts`.
- Read next: README › Known limitations (Private mode isolation).

## Disagreements between sources

- Saving site rules from an incognito tab is allowed (the dialog only adds a note), while styles and scripts are never
  kept from incognito; no source explains the difference.
