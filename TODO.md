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
- [ ] Server platform: Cloudflare Workers + Durable Objects / Supabase / our own Node.js server
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

## Once we move to our own build (development build)

Expo Go can only run the native modules bundled with it. The items below require an app we build
ourselves; they will all be handled together during the switch.

- [ ] Development build setup (EAS); an Apple Developer account is required for iOS
- [ ] Voice commands (speech-to-text): the device's own speech recognition engine; free, works offline on most devices. Microphone button in the panel
  - Decision: The paid "audio recording + AI transcription" route will not be used; until then the keyboard's microphone key is enough
- [ ] Real cookie isolation for private tabs on Android (WebView profile API)
- [ ] App attestation (App Attest, Play Integrity; `expo-app-integrity`), see Qutai Credits / Abuse protection
- [ ] "Share to Qutai" from other apps, Siri / Shortcuts (`expo-app-intents`), home screen widget (`expo-widgets`)

## Device integrations (work in Expo Go)

Both as a tool the agent can use and as a button the user can tap in the panel.

- [x] Page menu (⋮), loading bar, notification (toast)
- [x] Turn the page into a PDF (`expo-print`); images and readable CSS are embedded in the page, save/send via the share menu
  - [ ] Fallback: PDF from screenshots (for very dynamic pages)
- [x] Screenshot: save the visible area to the gallery (`expo-media-library`, add-only permission)
- [x] The agent can look at a screenshot (`view_screenshot`; tool result with an image on all three providers)
  - [ ] Full-page screenshot (scroll and stitch)
- [x] Read aloud (`expo-speech`): the page's main content, the agent's text, chat messages
- [x] Share / copy link; copy / share chat messages (`expo-clipboard`)
  - Decision: The agent was not given a clipboard-writing tool (attack that swaps a copied IBAN or wallet address)
- [x] Keep the screen on while the app is open (`expo-keep-awake`)
- [x] Block screenshots and the app switcher preview in private tabs (`expo-screen-capture`)
- [ ] File download support
- [ ] Before submitting to the stores: review the legacy storage permissions (`READ_EXTERNAL_STORAGE`, `READ_MEDIA_VISUAL_USER_SELECTED`) that the `expo-media-library` plugin adds on Android
- [ ] Later: location, camera and QR, calendar, email and SMS drafts, biometric authentication, haptics
- [ ] Security: tools that send data out (location, etc.) ask for user confirmation every time; clipboard reading and contacts are not given as tools. An iOS usage description string in `app.json` for each permission
- [x] Calendar, reminders and notifications: the assistant can put things on the user's calendar and set reminders
  - [x] Example: after buying a cinema ticket or booking anything with a time, the assistant offers "Shall I remind you?" (via `ask_user`) and, if yes, adds a calendar event and/or a reminder with an alert before it (system prompt)
  - [x] Tools: `add_calendar_event` (title, start, end, location, notes, alert), `add_reminder` (iOS Reminders; on Android a calendar event with an alarm), `schedule_notification` (a local notification from Qutai itself) (`src/agent/scheduling.ts`, `src/device/calendar.ts`, `src/device/notifications.ts`)
  - [x] Packages: `expo-calendar` (events and iOS reminders) and `expo-notifications` (local notifications only: `enableRemoteNotifications: false`, no push token). Expo Go does not include `expo-calendar`: **a new development build is needed** for both native modules (`eas build --profile development` or `npx expo run:ios|android`); an older build reports the tools as unavailable instead of crashing
  - [x] Every write asks for confirmation and shows exactly what will be added (whatever the "ask before actions" setting or a site's "always allow"); permissions are requested only on first use, with usage strings in `app.json` and `locales/` (iOS write-only calendar access, `NSRemindersFullAccessUsageDescription`; Android `READ_CALENDAR`/`WRITE_CALENDAR`, notification permission on Android 13+). Refused in conversations that touched an incognito tab; the action history only says what kind of thing was added
  - [ ] Not verified on a device yet: adding an event with write-only access on iOS 17+, the Android calendar choice (primary writable calendar), notifications at the right time (without `SCHEDULE_EXACT_ALARM` Android may deliver them a little late)
  - [ ] Reading the calendar (e.g. "am I free on Friday?") only with explicit consent; never from incognito tabs; not kept in memory unless the user asks

## Assistant

- [x] The Qutai panel's conversation should belong to the tab group, not to a single tab. Windows a task opens already gather in the tab's group; the chat should follow, so the assistant keeps one context for the whole job whichever of the group's tabs is shown
  - [x] Ungrouped tabs keep their own conversation, as today
  - [x] Decide what happens when a tab leaves or joins a group, a group is dissolved or its last tab closes: joining, the group's chat wins (a new group takes over its first tab's chat); leaving, the chat stays with the group and the tab gets its own back; dissolving, the chat moves to the active (or first) tab; the last tab closing keeps it like a closed tab's chat, so reopening the tab brings it back
  - [x] Saved chats are keyed by tab `uid` today (`src/storage/chat.ts`): add group keys and migrate (`chat:group:<id>`; on upgrade a group takes the chat of one of its tabs, the one with the newest messages)
  - [x] Incognito groups still never write to disk
- [x] "Look at the source code": the assistant tries to open `view-source:` URLs, which the WebView in Expo Go can't show. Read the source from the DOM instead (e.g. a `read_source` tool returning `document.documentElement.outerHTML`, split into chunks like `read_page`; or scripts and styles on request), and make `navigate` refuse `view-source:` with a hint to use it. Mention it in the system prompt

## Other

- [ ] Before release: legal review of the Privacy Policy and Terms of Use (`src/legal/documents.ts`; if the text changes, `LEGAL_VERSION` must be bumped), add a contact address
- [ ] After release: `ios.appStoreUrl` and `android.playStoreUrl` in `app.json` (so 'Rate Qutai' can open the store page)
- [ ] App icon: a 1024 px PNG should be generated from `src/ui/markGeometry.ts` (the script that draws it with CanvasKit is ready; see design notes)
- [ ] To try on the phone (added in this round): first-launch onboarding (every step, back, opening the terms, the default apps screen on Android), aurora (light/dark), logo animation and with 'Animate the logo' off, 'Ask Qutai' in the menu when the Qutai button is hidden, pull to refresh (pages with inner scroll areas, maps), 'Open in another app?' not appearing on its own on pages like Google Play, tables in chat, undo clear in the address bar, chat draft after closing and reopening the app, force zoom, Google sign-in and verification pages on Android (new user agent), tab groups (windows opened by the page, the assistant's close_tabs), crash screen, screen not dimming
- [ ] The Expo server must be restarted with `npx expo start -c` after installing new packages with native/Babel plugins (Reanimated, Worklets) (otherwise a 'bytecode of undefined' error)

- [ ] Before submitting to the stores, AI search terms: Gemini's search suggestions box is now shown below the response (check on a device that it follows Google's display rules); Anthropic and OpenAI require citations to be shown to the user in a clickable way (done with source cards, should be confirmed legally)
- [ ] Test on a real device: keyboard behavior (especially Android), tab thumbnails, private mode, Android back button and back gesture, PDF, saving to the gallery (especially Android in Expo Go), read aloud (on iOS there is no sound in silent mode), screenshot blocking in private tabs, session restore (by force-closing and reopening the app), date formats on the history/bookmarks screen (Hermes Intl), external app links (tel:, mailto:, WhatsApp, Android intent://), error page (airplane mode), tapping the address bar suggestion list (with the keyboard open), iOS paste button, find in page bar, desktop site (iOS contentMode, Android viewport), text size on iOS (-webkit-text-size-adjust), printing, long-press menu (not opening while scrolling, a short tap opening the link, the system menu not appearing on Android), saving images (on sites that require sign-in), tab sleeping and tabs reloading after a memory warning, selected text bar (not clashing with the system copy menu, disappearing when the selection is cleared), quick action chips, markdown responses (tables, code blocks, opening links), per-tab and per-group chat (when switching tabs, when closing and reopening the app, when reopening a closed tab, a tab joining or leaving a group, ungrouping, closing a group's last tab, upgrading with existing grouped chats), memory (use in form filling, editing/deleting from Settings), option buttons (fading after selection), source cards (switching to an open tab), AI search (real keys with all three providers; search rows and citation sources), read_tab (reading background and sleeping tabs, especially off-screen WebViews on iOS), tab comparison mode, streaming responses (scrolling on long responses), site permissions and 'always allow' in the confirmation dialog, activity history, history search, email draft (phones with and without an account set up), deep research and report PDF, click_at (map/canvas), Gemini search suggestions box, file downloads (iOS list, Android notification; on sites that require sign-in), cookie banner hiding and ad blocking (on real sites, are any sites broken), dark theme (app, inverted sites on iOS, Android force-dark), bottom address bar (with the keyboard, suggestion list), switching tabs by swiping on the address bar, haptics, tab groups and dragging (especially long-press-drag on Android), clear data, HTTPS-only downgrade warning, app and private tab lock (returning from the background), QR scanning and sharing, offline pages, full-screen video, VoiceOver/TalkBack and large text
- [ ] End-to-end test with real API keys on all three providers
- [ ] Clicking by coordinates (for canvas, maps and image-heavy sites; together with the screenshot tool)
- [ ] Running in the background: a foreground service for Android or a server-side browser (decision pending)
- [x] Streaming responses (Anthropic and OpenAI)
- [ ] Streaming for Gemini: once it is verified that thought signatures are rebuilt exactly from the stream chunks
- [x] Storing chat history (per tab, persistent)
