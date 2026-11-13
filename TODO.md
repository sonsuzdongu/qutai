# To Do

For the feature inventory comparison and the phased plan, see `ROADMAP.md`.

## ALPAI Credits (paid usage)

Besides their own API keys, users should also be able to pay to use our AI credits.

Core rule: **Our provider keys never go into the app.** All requests in credit mode go through our
server. Requests the user makes with their own key go directly from the device to the provider, as they do today;
we do not store other people's keys on the server.

```
App ──(session token)──► ALPAI server ──(our key)──► Anthropic / OpenAI / Gemini
                                 ├─ identity and device verification
                                 ├─ credit check and reservation
                                 ├─ request rules (model, length, rate limit)
                                 └─ measure actual usage and deduct from credits
```

### Pending decisions
- [ ] Server platform: Cloudflare Workers + Durable Objects / Supabase / our own Node.js server
- [ ] Payments: RevenueCat, or the App Store and Play Billing APIs directly?
- [ ] Sign-in methods: Apple / Google / email (on iOS, "Sign in with Apple" is usually required if there is another social sign-in)
- [ ] Credit pricing: profit margin on top of token cost, pack sizes, will trial credits be given?

### 1. Server
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

### 2. App
- [ ] Sign-in screen; session tokens in `SecureStore`
- [ ] "ALPAI Credits" provider as a fourth option in Settings (an adapter that sends requests to the server)
- [ ] Remaining credits indicator in the panel; a clear message and a prompt to buy when credits run out
- [ ] A screen that clearly tells the user that in credit mode page content goes through our server

### 3. Purchases
- [ ] Credit packs as consumable in-app products (App Store IAP, Google Play Billing)
- [ ] Credits are added to the account after the purchase is verified with Apple's or Google's servers; the app's report is not trusted
- [ ] Listen for refund notifications (App Store Server Notifications, Play Real-time Developer Notifications) and take back refunded credits
- [ ] Before release, check the current version of the stores' rules on digital goods and external payments

### 4. Abuse protection
- [ ] Device verification: Apple App Attest and Google Play Integrity (requires a development build, does not work with Expo Go)
- [ ] If trial credits are given, limits against creating multiple accounts
- [ ] Monthly spending limit and alerts on provider accounts

### 5. Legal
- [ ] Privacy policy (KVKK / GDPR): in credit mode the content of visited pages, including private tabs, goes through the server
- [ ] Terms of use
- [ ] Check the commercial terms of use of Anthropic, OpenAI and Google; we are responsible for end-user usage

## Once we move to our own build (development build)

Expo Go can only run the native modules bundled with it. The items below require an app we build
ourselves; they will all be handled together during the switch.

- [ ] Development build setup (EAS); an Apple Developer account is required for iOS
- [ ] Voice commands (speech-to-text): the device's own speech recognition engine; free, works offline on most devices. Microphone button in the panel
  - Decision: The paid "audio recording + AI transcription" route will not be used; until then the keyboard's microphone key is enough
- [ ] Real cookie isolation for private tabs on Android (WebView profile API)
- [ ] App attestation (App Attest, Play Integrity; `expo-app-integrity`), see ALPAI Credits / Abuse protection
- [ ] "Share to ALPAI" from other apps, Siri / Shortcuts (`expo-app-intents`), home screen widget (`expo-widgets`)

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
- [x] Keep the screen on while a task is running (`expo-keep-awake`)
- [x] Block screenshots and the app switcher preview in private tabs (`expo-screen-capture`)
- [ ] File download support
- [ ] Before submitting to the stores: review the legacy storage permissions (`READ_EXTERNAL_STORAGE`, `READ_MEDIA_VISUAL_USER_SELECTED`) that the `expo-media-library` plugin adds on Android
- [ ] Later: location, camera and QR, calendar, email and SMS drafts, biometric authentication, haptics
- [ ] Security: tools that send data out (location, etc.) ask for user confirmation every time; clipboard reading and contacts are not given as tools. An iOS usage description string in `app.json` for each permission

## Other

- [ ] Test on a real device: keyboard behavior (especially Android), tab thumbnails, private mode, Android back button and back gesture, PDF, saving to the gallery (especially Android in Expo Go), read aloud (on iOS there is no sound in silent mode), screenshot blocking in private tabs, session restore (by force-closing and reopening the app), date formats on the history/bookmarks screen (Hermes Intl), external app links (tel:, mailto:, WhatsApp, Android intent://), error page (airplane mode), tapping the address bar suggestion list (with the keyboard open), iOS paste button
- [ ] End-to-end test with real API keys on all three providers
- [ ] Clicking by coordinates (for canvas, maps and image-heavy sites; together with the screenshot tool)
- [ ] Running in the background: a foreground service for Android or a server-side browser (decision pending)
- [ ] Streaming responses, storing chat history
