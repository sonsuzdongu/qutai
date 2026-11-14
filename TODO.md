# To Do

For the feature inventory comparison and the phased plan, see `ROADMAP.md`.

## Pro mode (official builds: `EXPO_PUBLIC_PRO_MODE=on`)

Everything in this section exists only when `features.pro` is on (`src/config/features.ts`): the
official App Store and Google Play builds. Builds from this repository keep it off and must work exactly
as today: the user's own AI key, no account, nothing sent to our servers. Each item below is shown,
requested and initialised only in pro mode, and the code path is excluded from the bundle when it's off.

### Accounts and OAuth sign-in
- [ ] Sign-in screen with OAuth providers: Sign in with Apple and Google first (others such as Microsoft or
  GitHub later if needed); an email magic link as a fallback is optional
  - [ ] iOS: when any third-party sign-in is offered, Sign in with Apple must be offered too (App Store
    guideline 4.8); `expo-apple-authentication`
  - [ ] Google and other providers: `expo-auth-session` with PKCE (system browser via `expo-web-browser`),
    never an embedded WebView; Android may use Credential Manager in a development build
  - [ ] The server verifies the provider's identity token and issues our own short-lived access token and
    a refresh token; tokens live in `SecureStore`; no provider tokens are kept on the device
- [ ] Account screen in Settings: who is signed in, sign out, and **delete account** inside the app
  (required by the App Store when accounts can be created in the app; also deletes server-side data)
- [ ] Signing out leaves the app usable with the user's own key; nothing local is lost
- [ ] Onboarding in pro mode: an optional "Sign in" step (skippable); the open-source build never shows it

### Qutai Credits (paid usage)

Besides their own API keys, users should also be able to pay to use our AI credits.

Core rule: **Our provider keys never go into the app.** All requests in credit mode go through our
server. Requests the user makes with their own key go directly from the device to the provider, as they do today;
we do not store other people's keys on the server.

```
App ──(session token)──► Qutai server ──(our key)──► Anthropic / OpenAI / Gemini
                                 ├─ identity and device verification
                                 ├─ credit check and reservation
                                 ├─ request rules (model, length, rate limit)
                                 └─ measure actual usage and deduct from credits
```

#### Pending decisions
- [x] Server platform: Cloudflare Workers + Durable Objects + D1 (R2 for sync blobs if needed). The server lives in its own repository; plan in `docs/server-plan.md`
- [ ] Payments: RevenueCat, or the App Store and Play Billing APIs directly?
- [ ] Sign-in providers beyond Apple and Google (see Accounts and OAuth sign-in above)
- [ ] Credit pricing: profit margin on top of token cost, pack sizes, will trial credits be given?

#### 1. Server
- [ ] User account and sign-in; short-lived access token and refresh token
- [ ] Split the provider adapters (`src/ai/`) so they can be shared between the app and the server
- [ ] Relay endpoint: the app sends only the conversation history; the system prompt, tool list and model are set on the server
- [ ] Request rules: allowed models, maximum response length, context limit per request, step limit per task
- [ ] Rate limit: per minute and per day, per user and per IP; one task at a time per user
- [ ] Credit ledger:
  - [ ] Prepaid balance (buy first, then spend)
  - [ ] Before the request, reserve the highest possible cost, finalize it with the actual token usage in the response, refund the remainder
  - [ ] Balance operations must be atomic; two concurrent requests must not be able to spend the same credit twice
  - [ ] Per-model price table only on the server (input, output, cache and thinking tokens)
- [ ] Page contents and conversations are not stored; logs keep only usage and cost
- [ ] Separate provider keys per environment (test, production) and a key rotation procedure

#### 2. App
- [ ] Credits need an account (see Accounts and OAuth sign-in above)
- [ ] "Qutai Credits" provider as a fourth option in Settings (an adapter that sends requests to the server)
- [ ] Remaining credits indicator in the panel; a clear message and a prompt to buy when credits run out
- [ ] A screen that clearly tells the user that in credit mode page content goes through our server

#### 3. Purchases
- [ ] Credit packs as consumable in-app products (App Store IAP, Google Play Billing)
- [ ] Credits are added to the account after the purchase is verified with Apple's or Google's servers; the app's report is not trusted
- [ ] Listen for refund notifications (App Store Server Notifications, Play Real-time Developer Notifications) and take back refunded credits
- [ ] Before release, check the current version of the stores' rules on digital goods and external payments

#### 4. Abuse protection
- [ ] Device verification: Apple App Attest and Google Play Integrity (requires a development build, does not work with Expo Go)
- [ ] If trial credits are given, limits against creating multiple accounts
- [ ] Monthly spending limit and alerts on provider accounts

#### 5. Legal
- [ ] Privacy policy (KVKK / GDPR): in credit mode the content of visited pages, including private tabs, goes through the server
- [ ] Terms of use
- [ ] Check the commercial terms of use of Anthropic, OpenAI and Google; we are responsible for end-user usage
- [ ] Before the server goes live, rewrite every "no servers of ours" promise. It is true today, but not once requests can go through our server. Update the onboarding together with the privacy policy and terms (bump `LEGAL_VERSION` so everyone accepts again):
  - Onboarding welcome: "Private by design" (`onboarding.f3Title`, `onboarding.f3Body`: "no servers of ours"). Say what stays on the phone and when data goes through our server (credit mode only; own key: still direct to the provider)
  - Onboarding legal summary: `onboarding.legal1` ("we have no servers") and `onboarding.legal2`
  - `src/legal/documents.ts` (EN and TR): the privacy intro ("Qutai has no servers of its own") and "What leaves your phone, and to whom"; what our server receives, keeps (and how long), and who processes it
  - Store listings and the README if they repeat the claim

### Sync
- [ ] End-to-end encrypted sync of bookmarks, history, open tabs and the assistant's memory across the
  user's devices (keys derived on the device; the server stores only ciphertext); deletions kept as
  tombstones. Incognito data is never synced. See ROADMAP Phase 5

### Analytics (Firebase), with consent
- [ ] Firebase Analytics only in pro mode, and only after the user agrees
  - [ ] New onboarding step in pro mode only: "Help improve Qutai: may we collect anonymous usage data?"
    with Allow / Don't allow (equal weight, no pre-ticked choice) and a short list of what is and isn't
    collected; the choice can be changed later in Settings › Privacy
  - [ ] Collection off by default: start with analytics collection disabled and enable it only after
    consent (`setAnalyticsCollectionEnabled`); Firebase consent mode set accordingly
  - [ ] Anonymous app usage only: which features are used, setup completion, errors and performance.
    Never URLs, page content, search terms, chat text, memory or anything from incognito tabs
  - [ ] No advertising ID (no IDFA, so no App Tracking Transparency prompt; disable ad ID collection on
    Android too)
- [ ] Needs a development build: `@react-native-firebase/app` and `/analytics` are not in Expo Go. Keep
  `GoogleService-Info.plist` and `google-services.json` out of the public repository (EAS file
  environment variables)
- [ ] Privacy policy (bump `LEGAL_VERSION`), App Store privacy labels and Google Play Data safety form
  updated to describe analytics in pro builds

## Our own build (development build)

Qutai now runs as a development build: Expo Go can only run the native modules bundled with it, and several
features use modules it doesn't have. The items below need native work beyond what the current build has.

- [x] Development build setup, the repository side: app IDs (`com.sonsuzdongu.qutai`), the `qutai` URL scheme,
  `expo-dev-client`, `expo-system-ui`, and `npm run android` / `npm run ios` build natively (`expo run:*`)
  - [x] EAS: `eas.json` with development (dev client), preview (internal) and production profiles, all with
    `EXPO_PUBLIC_PRO_MODE=off`; versions kept remotely by EAS (`appVersionSource: remote`, production auto-increments
    from `buildNumber` 1 / `versionCode` 1); a `submit.production` skeleton without account ids. Not run yet: the
    first build links the project to an Expo account (adds `extra.eas.projectId` to `app.json`); an Apple Developer
    account is required for iOS device builds
- [x] Voice input (speech-to-text) in the assistant panel with the device's own speech recognition: a microphone button in the input row. **A new development build is needed**
  - [x] Module: `expo-speech-recognition` 58.0.1 (jamsch; Expo SDK 58 doesn't ship speech-to-text, `expo-speech` is text-to-speech only). Chosen for: an Expo module (new architecture), versions per SDK (58.x for SDK 58), a config plugin, iOS `SFSpeechRecognizer` and Android `SpeechRecognizer`, interim results, `requiresOnDeviceRecognition` (Android 13+ uses `createOnDeviceSpeechRecognizer`), language choice and supported/installed locale lists, volume events, regular releases. `@react-native-voice/voice` was the alternative (older bridge module, no config plugin, no on-device mode). Limits: iOS reports on-device support only for the phone's own language, and quietly falls back to the server when asked for on-device in a language without it, so Qutai counts other languages as online; Android 12 and older can only hint "prefer offline"; Android's online recogniser can't list its languages (a missing one shows up as an error); no audio-focus events on Android
  - [x] Behaviour (`src/device/voiceInput.ts`, `AssistantPanel`): tap to listen, tap again or pause to stop; filled red button and a ring following the voice level (still under Reduce motion), "Listening…" in the empty field; interim words land in the field, appended to the draft, final text replaces them; typing while listening stops it. Not sent unless Settings › Assistant › "Send automatically after speaking" is on (off by default; not while a task runs). Language: the UI language with the device's regional variant (`tr-TR`, `en-GB`…); a missing language is said, never swapped. Barge-in: starting stops read-aloud, and read-aloud turns the microphone off before it starts; a streaming answer keeps going. Stops (keeping the text) when the panel closes, another conversation comes on screen, a dialog or a screen over the panel opens, the app leaves the foreground (calls, app switcher), iOS interrupts the audio session, or a site starts capturing the microphone (and won't start while one is). Errors: no speech, network, recogniser off, microphone busy, permission ("Open settings" when final)
  - [x] Privacy: on-device whenever enforced (iOS on-device dictation for the phone's language; Android 13+ with the language installed); otherwise a one-time question naming Apple's / Google's speech service, remembered in settings (`voice_online`: ask / allowed / declined; Settings › Assistant shows the mode on this phone and switches it; not in backups, each phone asks); on Android 13+ the question offers downloading the language for offline use. Incognito conversations: on-device only, otherwise voice input is off with an explanation. Nothing recorded (`persist: false`); only the text is ever sent, as a normal message. Permissions on the first tap: microphone and, on iOS, speech recognition; `NSSpeechRecognitionUsageDescription` added and `NSMicrophoneUsageDescription` reworded (EN/TR); Android: `RECORD_AUDIO` as before, plus `<queries>` for the Google speech services (plugin)
  - [ ] Remaining: device verification (see "To try on the phone › Voice input"). Address-bar voice search would reuse `startVoiceInput` with a different `write`; not built
  - Decision: The paid "audio recording + AI transcription" route will not be used
- [ ] Real cookie isolation for private tabs on Android (WebView profile API)
- [ ] App attestation (App Attest, Play Integrity; `expo-app-integrity`), see Qutai Credits / Abuse protection
- [ ] "Share to Qutai" from other apps, Siri / Shortcuts (`expo-app-intents`), home screen widget (`expo-widgets`)

## Device integrations

Both as a tool the agent can use and as a button the user can tap in the panel.

- [x] Page menu (⋮), loading bar, notification (toast)
- [x] Turn the page into a PDF (`expo-print`); images and readable CSS are embedded in the page, save/send via the share menu
  - [x] Fallback: PDF from screenshots (for very dynamic pages)
- [x] Screenshot: save the visible area to the gallery (`expo-media-library`, add-only permission)
- [x] The agent can look at a screenshot (`view_screenshot`; tool result with an image on all three providers)
  - [x] Full-page screenshot (scroll and stitch): page menu and `save_screenshot` with `full_page`; Skia stitching, capped at 25 screens / 20,000 px, split above 8192 px
- [x] Read aloud (`expo-speech`): the page's main content, the agent's text, chat messages
- [x] Reader mode: the article in a themed, script-free view over the page, read aloud paragraph by paragraph with a highlight
- [x] Share / copy link; copy / share chat messages (`expo-clipboard`)
  - Decision: The agent was not given a clipboard-writing tool (attack that swaps a copied IBAN or wallet address)
- [x] Keep the screen on while the app is open (`expo-keep-awake`)
- [x] Block screenshots and the app switcher preview in private tabs (`expo-screen-capture`)
- [x] File download support: iOS saves into the app's own Downloads folder (the page fetches the file with the site's
  cookies, so downloads behind a login work) with a Downloads screen (tap to share or save to Files, delete); Android hands them to
  the system download manager with the site's cookies (`src/device/download.ts`, `src/components/DownloadsScreen.tsx`)
  - [x] iOS: progress and cancel while a file downloads: a small indicator over the page (tap: Downloads) and rows at the top of the Downloads screen, with a cancel button that removes the partial file (`File.downloadFileAsync` `onProgress` and `signal`). A file the page fetches itself (with the site's cookies) shows no percentage. Pause/resume left out: its resume state lasts only while the app runs
- [x] Before submitting to the stores: review the legacy storage permissions (`READ_EXTERNAL_STORAGE`, `READ_MEDIA_VISUAL_USER_SELECTED`) that the `expo-media-library` plugin adds on Android
  - Saving is add-only: on Android 11+ it goes through MediaStore with no permission; on Android 10 and older it needs `WRITE_EXTERNAL_STORAGE`, now declared only up to API 29 (`plugins/withLegacyStorageWrite.js`; it also covers WebView downloads on Android 9 and older). `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES` and `READ_MEDIA_VISUAL_USER_SELECTED` are blocked. Full list: `docs/permissions.md`
- [x] Permission audit: every usage key and Android permission matches a feature (`docs/permissions.md`); microphone key only for videos recorded for upload fields; unused push, badge, install referrer and overlay permissions blocked; privacy manifest with the libraries' required-reason APIs
- [x] Camera and microphone for web pages (`getUserMedia`) with a per-site prompt, like location (below, under Device integrations)
- [x] Android upload fields with `capture` (e.g. "take a photo" buttons) did nothing until Qutai held `CAMERA` (react-native-webview leaves the camera out while the declared permission isn't granted). A page script holds back the first tap on such a field, the app asks for the camera (only after the user's own tap), then taps it again; without the camera, `capture` is left out for the tap so the file picker opens; "Open settings" once after a permanent refusal (`src/browser/fileCapture.ts`, no native change). Not verified on a device: if the re-tap comes too late for the WebView, the user taps once more
- [ ] Not verified on a device yet: saving a screenshot on Android 10 (asks for storage) and 11+ (asks nothing); a download on Android 9; recording a video with sound in an upload field on iOS (microphone prompt, no crash); Face ID / calendar / location prompts show the Turkish strings on a Turkish device
- [ ] Before the first Play upload: check the release merged manifest (`android/app/build/intermediates/merged_manifest/release/`) against `docs/permissions.md`; libraries' permissions are only merged by Gradle
- [x] Camera and QR (`src/components/QrScanner.tsx`, `QrCodeSheet.tsx`), calendar (below), email drafts (`draft_email`), biometric authentication (`src/device/biometric.ts`), haptics (`src/device/haptics.ts`), location (below)
  - [x] SMS drafts (`draft_sms`, `src/device/sms.ts`): a chat card with the full number and text and an "Open in Messages" button (an `sms:` URL, body after `&` on iOS and `?` on Android); nothing opens or is sent without the user's tap, and the history names only who it was for. No new native module. Not verified on a device: the body arriving filled in on both platforms
- [x] Security: tools that send data out or write to the phone ask for confirmation every time (`get_location`, the calendar, reminder and notification tools, whatever the "ask before actions" setting; `src/agent/executeTool.ts`); clipboard reading and contacts are not given as tools. Every iOS usage description is set in `app.json` through the config plugins and translated in `locales/` (`docs/permissions.md`)
- [x] Calendar, reminders and notifications: the assistant can put things on the user's calendar and set reminders
  - [x] Example: after buying a cinema ticket or booking anything with a time, the assistant offers "Shall I remind you?" (via `ask_user`) and, if yes, adds a calendar event and/or a reminder with an alert before it (system prompt)
  - [x] Tools: `add_calendar_event` (title, start, end, location, notes, alert), `add_reminder` (iOS Reminders; on Android a calendar event with an alarm), `schedule_notification` (a local notification from Qutai itself) (`src/agent/scheduling.ts`, `src/device/calendar.ts`, `src/device/notifications.ts`)
  - [x] Packages: `expo-calendar` (events and iOS reminders) and `expo-notifications` (local notifications only: `enableRemoteNotifications: false`, no push token). Expo Go does not include `expo-calendar`: **a new development build is needed** for both native modules (`eas build --profile development` or `npx expo run:ios|android`); an older build reports the tools as unavailable instead of crashing
  - [x] Every write asks for confirmation and shows exactly what will be added (whatever the "ask before actions" setting or a site's "always allow"); permissions are requested only on first use, with usage strings in `app.json` and `locales/` (iOS write-only calendar access, `NSRemindersFullAccessUsageDescription`; Android `READ_CALENDAR`/`WRITE_CALENDAR`, notification permission on Android 13+). Refused in conversations that touched an incognito tab; the action history only says what kind of thing was added
  - [ ] Not verified on a device yet: adding an event with write-only access on iOS 17+, the Android calendar choice (primary writable calendar), notifications at the right time (without `SCHEDULE_EXACT_ALARM` Android may deliver them a little late)
  - [x] Reading the calendar (e.g. "am I free on Friday?") only with explicit consent; never from incognito tabs; not kept in memory unless the user asks: `read_calendar` (start and end as local ISO date-times, at most 31 days, at most 100 events with a note when cut; title, times, all-day, location, calendar, busy/free; notes only with `details`). Confirmed every time with the range, the provider and whether notes are included; refused in incognito conversations; the action history records only the range; `remember` refuses text with two or more event times. iOS 17+ asks for full access on first use (`NSCalendarsFullAccessUsageDescription` through `ios.infoPlist`), the add tools stay write-only; recurring events come back once per occurrence (EventKit, Android `Instances`); hidden Android calendars and iOS Reminders lists are not read
- [x] Camera and microphone for web pages (`getUserMedia`): video calls, in-page camera and QR readers, voice input on sites. Rule: no site gets the camera or the microphone unless the user allowed that site for that device; where that can't be enforced, the request is refused
  - [x] Findings (react-native-webview 14.0.1). iOS: WebKit asks `WKUIDelegate requestMediaCapturePermissionForOrigin:initiatedByFrame:type:` at request time, with the requesting origin, whether it is the main frame and the kind (camera, microphone, both); the library answers only from `mediaCapturePermissionGrantType` (prompt / grant / deny / same host), ignoring the frame and the kind, so it can't say "camera yes, microphone no". The prop is read at request time and a change applies without reloading. WebKit keeps a grant for the rest of the document. Android: `onPermissionRequest` maps the resources to `CAMERA` / `RECORD_AUDIO` and grants any origin, any frame, once the app holds the OS permission; `mediaCapturePermissionGrantType` is a no-op there and no prop or event lets JS decide. So a page script alone can't enforce the rule on either platform (frames, `about:blank` frames and native grants bypass it)
  - [x] Design: a small `patch-package` patch (`patches/react-native-webview+14.0.1.patch`, re-applied by `postinstall` on every `npm install`, so also on EAS) adds a `mediaCaptureGrant` prop, "<origin> camera microphone". iOS grants only the main frame of exactly that origin and only the named kinds; Android grants only when the requesting frame's origin matches and only the named kinds; everything else is refused without a prompt (the patched WebView never asks the OS on its own for a request it wouldn't grant). The prop is empty except while one request the user approved is being answered. A script injected before the page's own (`src/browser/mediaCapture.ts`) wraps `getUserMedia` in the main frame and asks the app over the tab's authenticated channel; the app checks the site, prompts, asks the OS (`expo-camera` permission APIs), opens the grant for that origin and those kinds, waits for the WebView to have it, lets the page call the real `getUserMedia` and closes the grant when it returns (15 s at most)
  - [x] Per-site settings camera and microphone, ask / allow / block each, default ask (`site_media` table, schema version 10), in the site's permission sheet and Settings › Site permissions, reset with ✕, in backups. Prompt: "<site> wants to use your camera / microphone / camera and microphone" (one prompt for a combined request, naming only what is undecided), "Don't allow", "Allow once" (emphasised; this page until it is left or reloaded), "Always allow on this site"; https only; the tab's own site only. Incognito: a stored block applies, a stored allow does not, "Allow once" covers that request only, nothing is saved. The prompt is shared with location (`src/browser/sitePrompt.ts`)
  - [x] While capturing: camera / microphone icons in the address bar (tap: the site's permission sheet, with "Stop camera and microphone"). Stopping, a block or taking back "Always allow" stops the page's tracks and reloads the page. Capture is paused (tracks disabled, black video and silence) while another tab is on screen or the app is in the background, and resumes on return; the prompt says so. A capturing tab is never put to sleep; closing it ends capture. `getDisplayMedia` (screen sharing) is always refused
  - [x] Android: once a page was allowed to capture, `mediaPlaybackRequiresUserAction` is off for that page so its preview can start after the prompt; iOS keeps its default (WebKit lets a capturing page play its stream). `RECORD_AUDIO` unblocked and declared by the `expo-camera` plugin (`recordAudioAndroid: true`); iOS camera and microphone texts cover sites the user allows (EN/TR). **A new development build is needed** (native patch and the permission)
  - [x] The assistant can't grant it: the prompt is the app's own dialog, which no tool can read, press or dismiss; a `click` by the assistant that makes a page call `getUserMedia` leads to the same prompt for the user
  - [ ] Remaining gaps, refused or narrowed rather than open: frames from another site are always refused (both platforms; on Android a same-origin frame of the allowed site could share the grant during the moment it is open); pages that play media before capture on Android still need a tap; a page that tampers with built-ins can hide its tracks from the address bar and pause (the OS camera/microphone indicators still show, and revoking reloads the page)
- [x] Location for web pages and for the assistant (owner's report: a route "from my current location" started somewhere else because the page got no location)
  - [x] Findings (react-native-webview 14.0.1): Android's `geolocationEnabled` grants every origin once Qutai holds the location permission (`onGeolocationPermissionsShowPrompt` answers `true` with no per-origin hook); iOS WKWebView shows WebKit's own prompt with no hook for the app. Neither gives per-site control, so native geolocation stays off (Android) or is shadowed (iOS) and a script injected before the page's own answers `getCurrentPosition`, `watchPosition`, `clearWatch` and `permissions.query({name: 'geolocation'})` over the tab's authenticated message channel (`src/browser/geolocation.ts`, `src/device/location.ts`)
  - [x] Per-site setting ask / allow / block (`site_location` table, schema version 8), default ask, in the site's permission sheet and Settings › Site permissions; "clear browsing data" leaves it alone, like the other site permissions. Prompt: "Allow once" (this page, until it is left or reloaded), "Always allow on this site", "Don't allow" (this page); https only. Incognito: a stored block still applies, a stored allow does not, "Allow once" covers that request only, nothing is saved
  - [x] Frames (an embedded map on another site) are always refused: the decision belongs to the site in the address bar. On iOS the script runs in every frame so they can't reach WebKit's own prompt; on Android frames hit the disabled native geolocation
  - [x] OS permission: foreground only, asked the first time a site or the assistant needs it, approximate location accepted; denied for good → `PERMISSION_DENIED` and an "Open settings" offer. `expo-location` plugin with only `NSLocationWhenInUseUsageDescription` (EN/TR in `locales/`); Android keeps `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION`, with `ACCESS_BACKGROUND_LOCATION` and `FOREGROUND_SERVICE_LOCATION` blocked. **A new development build is needed**; an older build answers pages with "position unavailable" and the tool reports it as unavailable
  - [x] Watches stop when the tab closes, sleeps, loads a new page or moves to another site, and pause while the app is in the background. A small pin in the address bar shows that the page has used the location (tap: the site's permissions)
  - [x] Assistant tool `get_location` (latitude, longitude, accuracy, time): confirmed every time, naming the AI provider and the current site; refused in incognito conversations; the action history only says the location was read; `remember` refuses coordinates; not retried after backgrounding. System prompt: use it for "near me / from where I am" instead of guessing
  - [ ] Not verified on a device yet: a maps site's "my location" button (Google Maps, OpenStreetMap), `watchPosition` while walking, approximate location on iOS and Android, the Android early-script timing (the script is installed again after load in case it ran too soon)

## Assistant

- [x] The Qutai panel's conversation should belong to the tab group, not to a single tab. Windows a task opens already gather in the tab's group; the chat should follow, so the assistant keeps one context for the whole job whichever of the group's tabs is shown
  - [x] Ungrouped tabs keep their own conversation, as today
  - [x] Decide what happens when a tab leaves or joins a group, a group is dissolved or its last tab closes: joining, the group's chat wins (a new group takes over its first tab's chat); leaving, the chat stays with the group and the tab gets its own back; dissolving, the chat moves to the active (or first) tab; the last tab closing keeps it like a closed tab's chat, so reopening the tab brings it back
  - [x] Saved chats are keyed by tab `uid` today (`src/storage/chat.ts`): add group keys and migrate (`chat:group:<id>`; on upgrade a group takes the chat of one of its tabs, the one with the newest messages)
  - [x] Incognito groups still never write to disk
  - [x] Conversations not read from disk yet (a tab or group not shown since the app started): a join waits until the
    group's and the tab's conversations are read, and joins are decided in order, so the group keeps the first
    non-empty one and a group conversation that turns out to be empty yields to a joining tab's
    (`Browser.joinGroupChat` / `settleGroupChat`)
- [x] "Look at the source code": the assistant tries to open `view-source:` URLs, which the WebView can't show. Read the source from the DOM instead (e.g. a `read_source` tool returning `document.documentElement.outerHTML`, split into chunks like `read_page`; or scripts and styles on request), and make `navigate` refuse `view-source:` with a hint to use it. Mention it in the system prompt

## Other

- [ ] Before release: legal review of the Privacy Policy and Terms of Use (`src/legal/documents.ts`; if the text changes, `LEGAL_VERSION` must be bumped), add a contact address
- [ ] After release: `ios.appStoreUrl` and `android.playStoreUrl` in `app.json` (so 'Rate Qutai' can open the store page)
- [ ] App icon: the icons in `assets/` (iOS 1024 px, Android adaptive foreground/background/monochrome within the safe zone, splash, favicon) were made from the raster logo `assets/logo.png` (384 px) when the drawn mark and `src/ui/markGeometry.ts` were removed (1ff8ba1); there is no CanvasKit script or vector source in the repository. Missing: a vector or ≥1024 px master of the logo, to redo the 1024 px icon and splash without upscaling
- [ ] The development server must be restarted with `npx expo start -c` after installing new packages with native/Babel plugins (Reanimated, Worklets) (otherwise a 'bytecode of undefined' error)

- [ ] Before submitting to the stores, AI search terms: Gemini's search suggestions box is now shown below the response (check on a device that it follows Google's display rules); Anthropic and OpenAI require citations to be shown to the user in a clickable way (done with source cards, should be confirmed legally)
- [ ] End-to-end test with real API keys on all three providers
- [x] Clicking by coordinates (for canvas, maps and image-heavy sites; together with the screenshot tool): `click_at` on a point of the latest `view_screenshot`
- [ ] Running in the background: a foreground service for Android or a server-side browser (decision pending)
- [x] Streaming responses (Anthropic and OpenAI)
- [ ] Streaming for Gemini: once it is verified that thought signatures are rebuilt exactly from the stream chunks
- [x] Storing chat history (per tab, or per tab group; persistent)

## To try on the phone

Nothing here has been run on a device yet. The "Not verified on a device yet" items above list the
platform-specific details for downloads, permissions, the calendar tools and location.

- [ ] First, a new development build (`npx expo run:ios|android` or `npx eas-cli build --profile development`):
  `expo-calendar`, `expo-notifications`, `expo-document-picker`, `expo-location` and `expo-crypto` were added after
  the last one. Without it the calendar, reminder and notification tools, location (for sites and `get_location`),
  bookmark import, and backup export and import report that a newer build is needed instead of working

### Browsing
- [ ] Keyboard behavior (especially Android); tapping the address bar suggestion list with the keyboard open; iOS paste button; undo clear in the address bar
- [ ] Bottom address bar (with the keyboard, suggestion list); switching tabs by swiping on the address bar
- [ ] Android back button and back gesture; session restore (by force-closing and reopening the app)
- [ ] External app links (tel:, mailto:, WhatsApp, Android intent://); 'Open in another app?' not appearing on its own on pages like Google Play
- [ ] Error page (airplane mode); HTTPS-only downgrade warning; Google sign-in and verification pages on Android (new user agent)
- [ ] Pull to refresh (pages with inner scroll areas, maps); force zoom; full-screen video
- [ ] Find in page bar; desktop site (iOS contentMode, Android viewport); text size on iOS (-webkit-text-size-adjust)
- [ ] Long-press menu (not opening while scrolling, a short tap opening the link, the system menu not appearing on Android); saving images (on sites that require sign-in); selected text bar (not clashing with the system copy menu, disappearing when the selection is cleared)
- [ ] Cookie banner hiding and ad blocking on real sites (are any sites broken)
- [ ] File downloads (iOS list, Android notification; on sites that require sign-in)
- [ ] PDF and printing; full-page screenshot and PDF from screenshots (long pages, seams between screens, fixed and sticky headers, scrollbars, cancel, endless feeds, very long pages split into several images)
- [ ] Reader mode on several kinds of article (news sites, blogs, Wikipedia; lazy images; the address bar icon on SPA navigations; links leaving it; find in page and the selection bar in it; Android back; large system font) and its read-aloud highlight (pause/resume on both platforms)
- [ ] Offline pages; history search; date formats on the history/bookmarks screen (Hermes Intl)
- [ ] Bookmark folders (create, rename, move, delete with contents; dialogs with the keyboard open; Android back while a dialog is open) and importing/exporting bookmark files (a real Chrome export with thousands of entries, picking from Files/Drive/email attachments, the share sheet for export)
- [ ] QR scanning and sharing

### Tabs and groups
- [ ] Tab thumbnails; tab sleeping (more than five tabs) and tabs reloading after a memory warning
- [ ] Tab groups and dragging (especially long-press-drag on Android); windows opened by the page; the assistant's close_tabs
- [ ] A group's close icon: "Remove group, keep tabs open" and "Close all tabs in the group", then undo from the undo bar (name, colour, tabs and conversation come back)
- [ ] Tab comparison mode

### Assistant and tools
- [ ] Per-tab chat: switching tabs, closing and reopening the app, reopening a closed tab
- [ ] Group conversations: a tab joining a group and leaving it, ungrouping, closing a group's last tab and reopening it, the conversation coming back after restarting the app, and the database migration on an existing install with grouped tabs that already have chats
- [ ] Quick action chips; streaming responses (scrolling on long responses); markdown responses (tables, code blocks, opening links); tables in chat; option buttons (fading after selection); chat draft after closing and reopening the app; 'Ask Qutai' in the menu when the Qutai button is hidden
- [ ] Source cards (switching to an open tab); AI search with real keys on all three providers (search rows and citation sources); Gemini search suggestions box
- [ ] Memory (use in form filling, editing/deleting from Settings); activity history; site permissions and 'always allow' in the confirmation dialog
- [ ] read_tab (reading background and sleeping tabs, especially off-screen WebViews on iOS); click_at (map, canvas); deep research and report PDF; email draft (phones with and without an account set up)
- [ ] `read_source` on a large page (chunks, a CSS selector for scripts or styles); `navigate` refusing `view-source:`
- [ ] `add_calendar_event`, `add_reminder`, `schedule_notification`: the confirmation shows exactly what will be added, permissions asked on first use, refused after an incognito tab, the notification arriving with the app closed
- [ ] `open_settings` and "Open settings" after a denied permission (Qutai's own page, notifications, the default browser on iPhone), and the task carrying on after coming back
- [ ] `offer_call`: the Call card, the dialer opening on both platforms (iOS asks first), a tablet that can't place calls
- [ ] `get_location`: the confirmation naming the provider and the site, refused in incognito conversations, "near me" questions
- [ ] `read_calendar`: iOS 17+ upgrade prompt after write-only access (and a "no" keeping write-only), iOS 16 one prompt, Android prompt; events found right after adding one in the same session (EventKit store refresh); all-day events on the right day east and west of UTC; recurring events; refused in incognito conversations

### Voice input
- [ ] First tap on each platform: iOS asks for the microphone and speech recognition (Turkish strings on a Turkish device); Android asks for the microphone; "Open settings" after a permanent refusal
- [ ] Turkish and English UI: recognised in that language, regional variant (e.g. en-GB); a language the phone lacks says so instead of using another
- [ ] Where the audio goes: Settings › Assistant shows "on the device" / "online"; the one-time question when only online is possible (Allow, Don't use, Android "Download for offline"), remembered; turning the switch off and on
- [ ] Offline (airplane mode): on-device works; online-only says it needs a connection
- [ ] Incognito tab: works only with on-device recognition, otherwise the explanation; nothing written to disk
- [ ] Interim words, appending to a draft, editing afterwards, typing while listening, auto-send on and off, auto-send skipped while a task runs, a long pause ending it, "Didn't hear anything"
- [ ] Interruptions: closing the panel, switching tabs, a dialog, Settings from the panel, app to background, an incoming call (iOS and Android), music or another app taking the microphone, a site starting a video call in a tab: microphone off (iOS orange dot / Android indicator gone), text kept
- [ ] Barge-in: tapping the microphone while an answer or the page is read aloud stops reading; "Read" while listening turns the microphone off first; the answer still streaming while listening
- [ ] The level ring and Reduce motion; VoiceOver/TalkBack labels; an older build without the module shows "needs a newer version"

### Device features
- [ ] Saving screenshots and images to the gallery (Android 10 asks for storage, 11+ asks nothing)
- [ ] Read aloud (on iOS there is no sound in silent mode); haptics; screen not dimming
- [ ] Encrypted backup: export on one phone and import on another (iOS to Android and back); how long "Encrypting…" (the scrypt key derivation) takes on a mid-range Android phone and whether the screen stays responsive; a backup with years of history; wrong password; merge twice; replace; the app reloading afterwards with the app lock on; an older build saying export needs a newer version

### Privacy and permissions
- [ ] Private mode; screenshot blocking in private tabs; app and private tab lock (returning from the background); clear data
- [ ] Geolocation on a maps site (Google Maps, OpenStreetMap): deny, allow once, always allow, block from the site's permissions, an incognito tab, `watchPosition` while walking, approximate location, pages that ask on load on Android (early-script timing), the pin in the address bar
- [ ] Camera and microphone for web pages: a WebRTC test page (e.g. webrtc.github.io/samples getUserMedia), a video-call site (Jitsi Meet, Google Meet), a QR reader site; deny / allow once / always allow, camera only vs both, the OS prompts the first time, "Open settings" after a permanent refusal; incognito (asks every time); the icons in the address bar, stopping from the sheet and blocking while capturing (page reloads, camera light off); switching tabs and backgrounding the app (paused, resumes); a cross-origin iframe asking for the camera (refused, no prompt); the local preview playing on Android after the prompt; an assistant `click` on a "Start camera" button (user prompt)
- [ ] Recording a video with sound in an upload field on iOS (microphone prompt, no crash)
- [ ] "What was sent to the AI": every kind of item appears with the right site and size, screenshots' thumbnails, "Show all" on a long page text, incognito entries gone after restarting, the per-conversation filter after a tab joins a group, clearing it from Clear browsing data
- [ ] Face ID, calendar, location, camera, microphone and speech recognition prompts show the Turkish strings on a Turkish device

### Appearance and accessibility
- [ ] First-launch onboarding (every step, back, opening the terms, the default apps screen on Android); aurora (light/dark); logo animation and with 'Animate the logo' off; crash screen
- [ ] Dark theme (app, inverted sites on iOS, Android force-dark)
- [ ] Themed dialogs over every modal screen and sheet (Settings, Library, Downloads, the lock screen…), with the keyboard open, and the iOS retry when another sheet is still sliding away
- [ ] Sheets and modal screens inside the safe areas on Android: portrait, landscape, with the keyboard open, large text
- [ ] VoiceOver/TalkBack (TalkBack headings in reader mode) and large text
