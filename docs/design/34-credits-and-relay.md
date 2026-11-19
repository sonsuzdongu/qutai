# 34. Qutai Credits, tiers, the relay and the agent profile

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Qutai Credits let a signed-in user of an official (pro) build use the assistant without their own AI key: requests go
through Qutai's server (the "relay"), which calls Anthropic, OpenAI or Google with Qutai's key and charges the account's
prepaid credits. The server builds the system prompt and tools from a registered "agent profile" exported from the app.

## How it works

1. In a pro build, Settings › Assistant lists a sixth provider, **Qutai Credits**, with no key field.
2. The first time, Qutai shows what changes: the conversation, page content, attachments, memory and custom
   instructions pass through Qutai's server, which doesn't store or log them. "Use Qutai Credits" / "Not now". The
   answer is remembered on this phone.
3. Setup in a pro build leads with Qutai Credits (disclosure → sign in → "You're signed in" with the balance and Buy
   credits). "Use my own AI provider key" is a separate, quieter card; "Decide later" skips.
4. The user picks a **tier**, never a provider model: **Qutai Fast** (everyday questions, fewest credits), **Qutai**
   (most tasks, the default) and **Qutai Pro** (hard, many-step work). Each shows "about N credits per step". "Which AI
   models these use" shows the model behind each tier today. The per-conversation menu under the panel title offers
   the same list.
5. When the user asks "find me a flight to Izmir", the app builds each step exactly as with an own key but sends only
   the conversation, the memory section, the custom instructions, the options and the profile id. The server adds the
   system prompt and tools, picks the model for the tier, reserves the most the step can cost, streams the provider's
   answer back unchanged, then charges the real usage and returns the rest.
6. Under each answer: "0.42 credits · 1.5k tokens", never a dollar figure; the same per request in "What was sent to
   the AI". The balance shows under the panel title while Qutai Credits is in use, and in Settings › Account › Qutai
   Credits with the latest ledger entries.
7. When the balance would pay for fewer than 5 steps on the tier, a quiet note offers Buy credits, once per drop.
8. Only while signed in: after sign-out, account deletion, a session the server ended or a backup restored on a new
   phone, sending keeps the message (with attachments) in the input and asks "Sign in / Use my own key / Not now".
   Settings › Assistant won't let Qutai be picked while signed out.
9. If the phone cuts the connection while the user is away, the same step is sent again when they return, and the
   server charges it once.
10. Every refusal has its own message (not enough credits, a task running elsewhere, too many requests, too large,
    step limit, suspended, maintenance, unavailable, update needed, server unreachable). When nothing reached the AI,
    the message goes back into the input.
11. The owner runs an admin panel behind Cloudflare Access: users, payments, usage and cost, settings (models, tiers,
    limits, kill switches); grant or remove credits, suspend, end sessions, delete an account. Every action needs a
    reason and is logged.

## The rules

- **`CRED-1`** Qutai's provider keys never go into the app; credit-mode requests go through Qutai's server; own-key requests go straight from the phone to the provider and the server never stores anyone's own key.
  Status: Owner, date not recorded · Why: the "core rule" of Qutai Credits; own-key privacy unchanged · Enforced: In the app: src/ai/wire.ts (directWire); src/credits/provider.ts (relayWire, which sends the adapter's body and never its headers) · Source: TODO.md › Qutai Credits (core rule); docs/server-plan.md › Rules that must hold
- **`CRED-2`** Qutai Credits exist only with pro mode and a server address; otherwise the provider isn't listed and nothing about credits contacts the server.
  Status: Owner, date not recorded · Why: the repository build stays own-key only (a9e83e4) · Enforced: In the app: src/config/features.ts (creditsEnabled) · Source: README.md › Qutai Credits; 3d6b3f7
- **`CRED-3`** Qutai Credits can be the provider in use only while signed in; setup and Settings › Assistant never save Qutai without an account, and sending without one is stopped before the message is taken.
  Status: Default (manager or implementing session; open to change) · Why: credits live on the account's ledger · Enforced: In the app: src/credits/gate.ts (qutaiAccess, providerToSave, lostQutaiAccount) · Source: README.md › Only while signed in; 0d0c889
- **`CRED-4`** The disclosure that page content passes through Qutai's server must be accepted on the phone before first use; it is repeated in the provider's settings and the sent log's hint, and raising its version asks everyone again.
  Status: Default (manager or implementing session; open to change) · Why: users must know page content leaves through Qutai in credit mode · Enforced: In the app: src/credits/index.ts (credits_disclosure_accepted, creditsConsented, creditsReady) · Source: TODO.md › 2. App; README.md › Qutai Credits
- **`CRED-5`** The server, not the app, decides the system prompt, the tool list, the model, the output limit, effort, the search tool, provider-side storage off, prompt caching and the step limit; unknown request fields are refused.
  Status: Default (manager or implementing session; open to change) · Why: the relay must not be a general AI proxy; a hand-edited copy on the server was rejected (drifts), and letting the app send prompt and tools was rejected (any prompt would pass) · Enforced: Server: backend/apps/api/src/relay/request.ts (parseRelayRequest, buildSystem, toolsFor) · Source: backend/DESIGN.md › Relay (step 4) › Server-side request rules
- **`CRED-6`** Only registered agent profiles (named by the SHA-256 of the app's exported prompt and tools) are accepted; an unknown one answers "update Qutai", so every release that changes the prompt or tools must export and register its profile first.
  Status: Default (manager or implementing session; open to change) · Why: the profile comes from the app's source, so app and server never drift · Enforced: Server: backend/apps/api/src/relay/config.ts (agentProfile); In the app: src/credits/profile.ts, src/credits/agentProfileId.ts, `npm run profile:check` · Source: README.md › Agent profile; backend/README.md › Agent profiles; TODO.md › 2. App
- **`CRED-7`** The conversation is checked against a per-provider allowlist: no system or developer turns, no remote web or file references, tool calls only to the profile's tools, no pre-written model answer (except a signed pause continuation), at most two plain cache marks.
  Status: Default (manager or implementing session; open to change) · Why: "so the relay can't be pointed at other tasks than the agent's"; a user may still ask the assistant anything, which costs them credits · Enforced: Server: backend/apps/api/src/providers/anthropic.ts, openai.ts, gemini.ts (input checks) · Source: backend/README.md › Relay › Request; backend/DESIGN.md › Relay
- **`CRED-8`** Conversations, page content, prompts, web addresses and memory are never stored or logged; relay logs keep only ids, provider, model, token counts, searches, cost, timing and outcome.
  Status: Owner, date not recorded · Why: privacy; the admin panel "can never show what a user asked or browsed" · Enforced: Server: backend/apps/api/src/lib/log.ts (ALLOWED, sanitize), checked by a test · Source: backend/DESIGN.md › Data added to the plan's tables; backend/README.md › Relay › Logs; TODO.md › 1. Server
- **`CRED-9`** In credit mode the customer sees three tiers (working names Qutai Fast / Qutai Hızlı, Qutai, Qutai Pro), never provider models; which model serves each is set by the owner in the admin panel without an app release.
  Status: Owner, 2026-11-16 · Why: reason not recorded beyond the decision · Enforced: Server: backend/apps/api/src/relay/tiers.ts (resolveTarget); In the app: src/credits/tiers.ts · Source: backend/DESIGN.md › Tiers in credit mode; README.md › Tiers; fb223e9
- **`CRED-10`** A running conversation stays on the model that answered it through a signed route for 30 days after its last answer; when the tier moved to another provider, the app rebuilds the conversation once and retries.
  Status: Default (manager or implementing session; open to change) · Why: a model's raw output is replayed only to that model; a server-side conversation table (stores state) and an unsigned hint (any client could pin any model) were rejected · Enforced: Server: backend/apps/api/src/relay/tiers.ts (ROUTE_TTL_MS, issueRoute), signed.ts (signToken, verifyToken) · Source: backend/DESIGN.md › Tiers › Conversation consistency
- **`CRED-11`** Today the old request form that names a provider model is still accepted (`acceptDirectModels` on) because a released test APK uses it.
  Status: Waiting for the owner (backend/DESIGN.md › Tiers in credit mode › Open for the owner: when to switch it off) · Why: the test APK built 16 Nov 2026 sends it · Enforced: Server: backend/apps/api/src/relay/tiers.ts (resolveTarget) · Source: backend/DESIGN.md › Tiers in credit mode
- **`CRED-12`** Credits are whole numbers of micro-credits (1 credit = 1 000 000); a charge is the provider's cost × credits per dollar × (1 + margin), rounded up once.
  Status: Default (manager or implementing session; open to change) · Why: no floating-point money · Enforced: Server: backend/packages/shared/src/money.ts, credits.ts · Source: backend/README.md › Credits, › Prices
- **`CRED-13`** Each account's balance has one source of truth, its own Durable Object (a per-user server object that handles one call at a time), so two requests can never spend the same credit and only one task runs at a time per user.
  Status: Owner, date not recorded · Why: atomic balance operations ("Two concurrent requests can never spend the same credit") · Enforced: Server: backend/apps/api/src/account/UserAccount.ts (reserve, transactionSync) · Source: docs/server-plan.md › Rules that must hold; backend/README.md › Credits
- **`CRED-14`** Before each step the server reserves the most it can cost (the whole output limit and every allowed search) and then charges the real usage, never more than reserved; any overrun is Qutai's loss.
  Status: Default (manager or implementing session; open to change) · Why: prepaid balance; the user is never charged more than was held · Enforced: Server: backend/apps/api/src/account/UserAccount.ts (reserve, settle, settle_overrun) · Source: backend/README.md › Relay › Credits; notes backend-step3-credits
- **`CRED-15`** A provider error before any output costs nothing; a cut answer is charged on what was seen plus an estimate; if the server dies mid-step, the hold is returned and the provider cost is Qutai's.
  Status: Default (manager or implementing session; open to change) · Why: the user pays only for what they could have received · Enforced: Server: backend/apps/api/src/relay/relay.ts (postRelay); backend/apps/api/src/account/UserAccount.ts (cancel, expiry alarm) · Source: backend/DESIGN.md › Relay › Decisions; backend/README.md › Relay › Credits
- **`CRED-16`** A charge that arrives after the hold expired still charges the real cost, even if the balance goes negative.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: Server: backend/apps/api/src/account/UserAccount.ts (settle) · Source: backend/README.md › Credits › Expiry
- **`CRED-17`** A step sent again with the same step key and identical content within 15 minutes is run but charged 0, once; changed content, a second resend or no key is charged.
  Status: Default (manager or implementing session; open to change) · Why: the phone cuts the connection when the user leaves the app; a request was seen sent twice and would have been billed twice · Enforced: Server: backend/packages/shared/src/credits.ts (STEP_RESEND_WINDOW_MS), backend/apps/api/src/relay/relay.ts (postRelay); In the app: src/agent/runAgent.ts (newStepKey) · Source: backend/README.md › Re-sent steps; 6ae9cf0
- **`CRED-18`** A balance may go negative after a refund, and a negative balance blocks spending until topped up.
  Status: Default (manager or implementing session; open to change) · Why: refunds must take back credits already spent · Enforced: Server: backend/apps/api/src/account/UserAccount.ts (takeBack, reserve) · Source: backend/DESIGN.md › Purchases; backend/README.md › Credits
- **`CRED-19`** Without valid per-user limits every reservation is refused, and without relay rules or pricing the relay answers "unavailable" (fail closed).
  Status: Default (manager or implementing session; open to change) · Why: never run without limits · Enforced: Server: backend/apps/api/src/account/UserAccount.ts (reserve, not_configured); backend/apps/api/src/relay/config.ts (settingsFrom) · Source: backend/README.md › Credits › Limits, › Settings
- **`CRED-22`** An Anthropic answer paused mid-search continues only with a continuation the server signed (tied to the user, model, profile, options and the paused turn), valid 15 minutes; each part is charged.
  Status: Default (manager or implementing session; open to change) · Why: that request shape is otherwise refused as a pre-written answer; no state is kept on the server · Enforced: Server: backend/apps/api/src/relay/pause.ts (PAUSE_TTL_MS, issueContinuation, checkContinuation) · Source: backend/DESIGN.md › pause_turn continuation; README.md › Qutai Credits
- **`CRED-23`** The step limit is the server's; the app shortens the memory section and attached images to the server's limits.
  Status: Default (manager or implementing session; open to change) · Why: the server's request rules · Enforced: Server: backend/apps/api/src/relay/relay.ts (postRelay, step_limit); In the app: src/credits/rules.ts · Source: README.md › Rules from the server that change behaviour
- **`CRED-24`** The relay refuses app versions below the server's minimum version ("update Qutai"); the seeded minimum is 0.1.0.
  Status: Default (manager or implementing session; open to change) · Why: 1.0.0 made every request of the first versioned app (0.1.0) answer "update needed" · Enforced: Server: backend/apps/api/src/relay/relay.ts (APP_VERSION_HEADER, compareVersions) · Source: backend 278d542
- **`CRED-25`** Today the deployed relay rules must allow memory of at least about 10 000 characters and 9 images per request; the local seed has these values.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#2-app)) · Why: match own-key mode (the app otherwise shortens memory and drops older images) · Source: TODO.md › 2. App; 50d2289
- **`CRED-26`** Today a step holds its whole output limit, so a small balance refuses requests that would cost far less (in the seed: about 57 credits for GPT-5.6 Terra, 28 for Claude Sonnet 5.5, 18 for Gemini 3.8 Flash).
  Status: Waiting for the owner ([TODO.md](../../TODO.md#2-app)) · Why: worst-case reservation · Enforced: Server: backend/apps/api/src/account/UserAccount.ts (reserve) · Source: TODO.md › 2. App; notes qutai-credits-app
- **`CRED-27`** The low-credit note shows once when the balance falls below 5 × the tier's "credits per step" and again only after the balance rose above it; it is kept in memory only.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded beyond "a quiet low-credit note" · Source: src/credits/lowBalance.ts (LOW_BALANCE_STEPS, nextLowBalance); 2e3b657
- **`CRED-28`** Charges are shown only in credits, never as money, and the balance under the panel title is always shown in full.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: README.md › Qutai Credits; b211327
- **`CRED-29`** Only models with a price in force are offered; prices are added as new dated rows, never edited, and never back-dated more than 10 minutes.
  Status: Default (manager or implementing session; open to change) · Why: past charges are never re-priced · Enforced: Server: backend/apps/api/src/relay/config.ts (pricesFor); prices table triggers · Source: backend/README.md › Prices; backend/DESIGN.md › Admin panel (step 6)
- **`CRED-30`** Today users are charged for every Gemini search, including those inside Google's free monthly allowance.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#1-server)) · Why: the allowance is not deducted · Source: backend/DESIGN.md › Relay › Open for the owner; backend/README.md › Prices
- **`CRED-31`** Kill switches (per provider and global) make the relay "temporarily unavailable" without touching credits; a monthly spend limit per provider stops the relay and alerts at 80 % and 100 %.
  Status: Default (manager or implementing session; open to change) · Why: cost control; limits in the providers' own consoles are still the owner's · Enforced: Server: backend/apps/api/src/relay/spend.ts (checkSpending, sendAlert); backend/apps/api/src/relay/config.ts · Source: backend/DESIGN.md › API Worker; backend/README.md › Usage and spend
- **`CRED-32`** The admin panel is reachable only through Cloudflare Access and checks the Access token itself; writes must come from its own page; every action needs a reason and a request key and is audited; credits change only through the user's ledger, at most a million per action; no action can read or set a provider key.
  Status: Default (manager or implementing session; open to change) · Why: one ledger source of truth; a typo guard; the panel has no password system of its own · Enforced: Server: backend/apps/admin/worker/access.ts (ACCESS_HEADER); backend/apps/admin/worker/index.ts; backend/apps/admin/worker/api/actions.ts (MAX_CREDIT_CHANGE) · Source: backend/DESIGN.md › Admin panel (step 6); backend/README.md › Admin panel › Actions
- **`CRED-33`** Today the panel shows revenue gross (before the store's share), "active" means seen, and there is one admin role.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#1-server)) · Why: defaults of the panel session · Source: backend/DESIGN.md › Admin panel (step 6) › Open for the owner
- **`CRED-34`** Today abuse flags can't be marked resolved.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#1-server)) · Why: step 9 decides how flags are raised and cleared · Enforced: Designed, not built · Source: backend/DESIGN.md › Admin panel (step 6) › Open
- **`CRED-35`** Today credit prices are the model's token price plus a margin, with example values; pack sizes, trial credits, which model sits behind each tier, per-tier step limits, per-user limits and whether credits expire are not decided.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#pending-decisions)) · Why: business decisions; seed values are examples (owner's open questions 1–5 and 8, 16 Nov 2026) · Source: TODO.md › Pending decisions; backend/DESIGN.md › Tiers › Open; memory open-owner-questions
- **`CRED-36`** Today the app shows the model serving each tier ("Which AI models these use"), and the tier names are working names.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#2-app)) · Why: the provider is visible anyway through the answer format, so the question is only the model name · Source: TODO.md › 2. App; backend/DESIGN.md › Tiers › Open
- **`CRED-37`** Today there is no crash-report service.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#1-server)) · Why: "decide before launch" · Source: backend/DESIGN.md › Analytics; TODO.md › 1. Server
- **`CRED-38`** Today, with an own key, a request still running when the user leaves the app is kept alive for at most 3 minutes, and not for incognito conversations on Android (iPhone holds them anyway).
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Double charge and payments) · Why: avoids a cut answer being sent and billed twice; Android uses the existing background service, which shows a notification; very long answers can still be cut · Enforced: In the app: src/device/requestHoldLogic.ts (REQUEST_HOLD_MAX_MS, mayHold) · Source: notes fake-purchases-and-request-hold; 488c3e0

## Details

**Limits and counting**

- (was `CRED-20`) One relay request is one reservation, so the per-user limits count model steps, not messages; one task at a time per user. Why: matches the agent loop (one request at a time). Where: Server: backend/apps/api/src/account/UserAccount.ts (reserve, task_active, rate_limited); backend/DESIGN.md › Relay › Decisions.
- (was `CRED-21`) Per network address the server allows about 120 calls a minute (about 20 for sign-in), approximately and per Cloudflare location. Why: a cheap shield; the platform's limiter is approximate, so strict counts live elsewhere. Where: Server: backend/apps/api/src/index.ts (withinIpLimit); backend/README.md › Auth › Rate limits.

## Why it is designed this way

The relay must spend Qutai's money only on Qutai's assistant, so everything except the user's own words is fixed by
the server (CRED-5 to CRED-7), and the app's prompt and tools reach the server as a named, hashed profile instead of
being sent with each request. Money moves only inside one per-user object that handles one call at a time, with a
hold before each step and a settlement after it (CRED-13 to CRED-16). Details:
[backend/DESIGN.md](../../backend/DESIGN.md) › Relay (step 4) and › Relay additions; [backend/README.md](../../backend/README.md) ›
Credits and › Relay.

## Limits and what is not built

- Not deployed (needs the owner's Cloudflare account, domain, production secrets and provider keys) (planned).
- Never tried with real provider keys: real streams, a long paused search, a cut stream, stopping mid-answer, tiers on
  a server with keys (planned).
- Abuse protection (device checks with App Attest and Play Integrity, limits on trial credits) (planned, server step 9).
- A fallback model per tier is reserved, not built (planned, once a real outage pattern is known).
- A failed usage report loses that reporting row only, not the charge.
- An unreachable server takes about 20–40 s before "can't be reached" (no connect timeout).
- Release step: `npm run profile:export` and register the profile on every server before a build ships.
- A lawyer's review of the pro documents and a check of the providers' commercial terms (planned).

## Where it lives

- App: `src/credits/` (`client.ts`, `provider.ts`, `profile.ts`, `agentProfileId.ts`, `gate.ts`, `setupFlow.ts`,
  `tiers.ts`, `pause.ts`, `lowBalance.ts`, `rules.ts`, `index.ts`), `src/ai/wire.ts`, `agent-profile/profile.json`,
  `src/components/CreditsDisclosure.ts`, `CreditsFields.tsx`, `CreditsScreen.tsx`, `QutaiSetup.tsx`.
- Server: `backend/apps/api/src/relay/`, `backend/apps/api/src/providers/`, `backend/apps/api/src/account/UserAccount.ts`,
  `backend/apps/admin/`.
- Read next: [README.md](../../README.md) › Qutai Credits (pro mode), › Agent profile, › Trying it end to end;
  [backend/README.md](../../backend/README.md) › Credits, › Relay, › Admin panel; [backend/DESIGN.md](../../backend/DESIGN.md) ›
  Relay (step 4), › Relay additions (16 Nov 2026), › Admin panel (step 6).

## Disagreements between sources

- README.md › Official builds calls Qutai credits "planned" and says credits aren't in the code; they are built.
- docs/server-plan.md says the app's adapters are split so both sides share them; TODO.md › 1. Server and backend/DESIGN.md say they were not split (the server wraps what the app builds).
- backend/README.md lists `tier_unavailable` for a tier that can't be served; a session note found that a tier whose provider key is missing answers `unavailable` instead, and that a tier list without a default is silently treated as no tiers.
