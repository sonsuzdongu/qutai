# To Do

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

## Other

- [ ] Test on a real device: keyboard behavior (especially Android), tab thumbnails, private mode, Android back button and back gesture
- [ ] End-to-end test with real API keys on all three providers
- [ ] Real cookie isolation for private tabs on Android (WebView profile API, requires a development build)
- [ ] Screenshot tool and clicking by coordinates (for canvas, maps and image-heavy sites)
- [ ] Running in the background: a foreground service for Android or a server-side browser (decision pending)
- [ ] Streaming responses, storing chat history
