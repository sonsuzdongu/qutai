# Qutai backend (pro mode): design

This folder will hold the server for pro mode (`EXPO_PUBLIC_PRO_MODE=on`, `src/config/features.ts`): accounts,
Qutai Credits, purchases, an admin panel, and later sync. Builds without pro mode never talk to it.
It extends `docs/server-plan.md` (the platform decision and the ledger rules); where the two differ, this file
wins. Nothing here is built yet.

Before writing code against any Cloudflare, Apple, Google or RevenueCat API named here, read its current
documentation: limits, bindings and prices change.

## Decisions

| Topic | Decision |
|---|---|
| Platform | Cloudflare only: Workers, Durable Objects (SQLite storage), D1, Analytics Engine, Queues, Cron Triggers, Access; R2 later for sync |
| Location | `backend/` in this repository (changed from "its own private repository"). No secret is ever committed; limits and abuse thresholds live in D1 / secrets, not in code, because the repository may be public |
| Deploy | Wrangler, two environments (`dev`, `production`) with separate D1 databases, secrets and provider keys |
| Admin sign-in | Cloudflare Access in front of the admin Worker (allowed emails only). The Worker also verifies the Access JWT itself; the panel has no password system of its own |
| App analytics | Our own consented, anonymous events to the API, stored in Analytics Engine. No Firebase in the first version; the event layer in the app is an interface so Firebase can be added later |
| Language | TypeScript everywhere; the admin UI is React + Vite served as the admin Worker's static assets |

Open (owner): payments through RevenueCat or the store APIs directly (see Purchases); credit pricing, pack sizes
and trial credits (all are data in D1, not code); sign-in providers beyond Apple and Google.

## Layout

```
backend/
  package.json            npm workspaces; scripts: dev, test, typecheck, lint, migrate, deploy:dev, deploy:prod
  packages/shared/        types and schemas shared by api and admin (and later the app): API shapes, money maths
  apps/api/               Worker `qutai-api` + Durable Object `UserAccount`
    src/routes/           auth, credits, relay, purchases, webhooks, events, account
    src/providers/        Anthropic, OpenAI, Gemini relays (adapters shared with the app's `src/ai/` where possible)
    src/account/          the Durable Object: ledger, reservations, lock, rate counters
    migrations/           D1 migrations
    wrangler.jsonc
  apps/admin/             Worker `qutai-admin`: /api/* (admin API) + the React panel as static assets
    wrangler.jsonc
  README.md               setup, local dev, secrets, deploy, key rotation
```

The root `tsconfig.json` and `eslint.config.js` exclude `backend/` (as they do `webpage/`); it has its own.

## API Worker

Endpoints, request flow, the ledger and the rules that must hold are in `docs/server-plan.md` and stay as written.
Additions:

- `GET /config`: what the app needs to show (credit packs, allowed models with their credit price, limits,
  minimum app version, a maintenance flag). Cached.
- `POST /events`: consented anonymous usage events (see Analytics).
- Tokens: access token is a short-lived signed JWT (15 min); refresh tokens are random, stored hashed, rotated on
  use, and a reused old token revokes the whole device chain.
- Rate limits: per user in the `UserAccount` Durable Object; per IP with the Workers rate limiting binding before
  any work is done.
- Writes to D1 that mirror the ledger (purchases, `usage_daily`) go through a Queue so a failed reporting write
  never fails or delays the user's request; consumers are idempotent on the ledger entry id.
- Cron: daily roll-up of usage and cost, expiry of dead refresh tokens, a spending check per provider against the
  monthly limit (alert by email/webhook, and a hard stop flag in `settings`).
- A kill switch per provider and globally (`settings` table, read through a short cache) that makes `/relay`
  answer "temporarily unavailable" without touching credits.

### Data added to the plan's tables

- `users`: + `status` (active / suspended), `email` (nullable; from the identity token, may be an Apple relay
  address), `country` (from the store, nullable), `last_seen_at`.
- `credit_packs` (product id per store, credits, active).
- `ledger_mirror` (entry id unique, user_id, kind, amount, ref, at): the reporting copy of each Durable Object
  ledger entry.
- `settings` (key, value, updated_by, updated_at): allowed models, limits, kill switches, margins.
- `admin_audit` (id, admin email, action, target user, before, after, reason, at): every admin write.
- `abuse_flags` (user_id, kind, detail, at).

Never stored anywhere: conversations, page contents, prompts, URLs, memory. Logs carry user id, model, token
counts, cost, timing and error class only.

## Purchases

Credits are consumable in-app products on both stores. The server adds credits only after its own verification;
each store transaction id is accepted once; refunds and revocations take credits back (the balance may go
negative, which blocks spending until topped up).

The code talks to a `PurchaseVerifier` interface with two possible implementations:

| | RevenueCat | Store APIs directly |
|---|---|---|
| App | `react-native-purchases` | `expo-iap` or similar |
| Verification | RevenueCat REST + one signed webhook | App Store Server API (JWS) and Google Play Developer API |
| Refunds | the same webhook | App Store Server Notifications V2; Play RTDN through Pub/Sub push |
| Cost | free tier, then a share of revenue | none |
| Work and risk | least; a third party sees purchase data | most; two stores' edge cases are ours |

Recommended: RevenueCat for the first version, behind the interface, so a move to the store APIs later is a
change in one place.

## Admin panel

A separate Worker, reachable only through Cloudflare Access. It reads D1 directly and never writes balances
itself: credit changes go to the user's `UserAccount` Durable Object through a service binding to the API Worker,
so the ledger keeps one source of truth.

Screens:

- **Overview:** new and active users (day / week / month), revenue, provider cost, margin, credits sold vs spent,
  credits outstanding (our liability), error rate, today's spend against each provider's monthly limit.
- **Users:** search by id or email; filters (status, has purchased, flagged). Detail: sign-in providers, created
  and last seen, balance, ledger, purchases, usage by day and model, devices, flags.
  Actions (each asks for a reason and is written to `admin_audit`): grant or remove credits, suspend / restore,
  revoke sessions, delete the account.
- **Payments:** every purchase with store, product, amount, status (verified, refunded, revoked), user; filters
  and CSV export; totals by day, store and pack.
- **Usage and cost:** tokens and cost by model and day, average cost per task, top spenders, relay errors.
- **Prices and packs:** the provider price table (with `effective_from`), credit packs, margin; changes are dated,
  never edited in place.
- **Abuse:** rate-limit hits, flagged accounts, failed attestations (later).
- **Settings:** allowed models, limits, kill switches, maintenance message, minimum app version.
- **Audit log:** who did what and when.
- **Product analytics:** the consented events (below) as simple charts.

The panel can never show what a user asked or browsed: the server doesn't have it.

## Analytics

- Only in pro mode and only after the user agrees (the onboarding step described in `TODO.md`); off by default,
  changeable in Settings › Privacy; never in incognito.
- The app sends a small fixed vocabulary of events (feature used, setup finished, task finished / failed with an
  error class, purchase screen opened) with app version, platform and locale. No URLs, page content, search
  terms, chat text, memory, advertising id, or stable device id; an install id that resets when consent is
  withdrawn.
- `POST /events` validates against the allowlist and writes to Analytics Engine; the panel queries it with the
  SQL API. Unknown event names and extra fields are dropped.
- Crash reports are a separate question (not covered by this; decide before launch).

## Security

- Provider keys, signing keys and webhook secrets are Worker secrets, different per environment; a written
  rotation procedure in `backend/README.md`.
- Every credit-moving write carries an idempotency key; webhooks are verified by signature before parsing.
- The admin Worker rejects any request without a valid Access JWT for the configured audience, even if routing
  is misconfigured. Admin writes need a reason and are audited. No admin action can read or set a provider key.
- CORS: the API accepts the app only (no browser origin); the admin API accepts its own origin only.
- Account deletion removes D1 rows, the Durable Object's storage and sync data; purchases are kept only as the
  anonymised records the law requires.

## Order of work (one session per step, reviewed before the next)

1. Scaffold: workspaces, both Workers, D1 migrations, environments, tests (Vitest with the Workers pool),
   typecheck, lint, deploy scripts, README.
2. Auth: Apple and Google token verification, our tokens, refresh rotation, account deletion.
3. `UserAccount` Durable Object: ledger, reserve / settle / refund, expiry alarm, lock, rate counters, with
   concurrency and replay tests.
4. Relay: Anthropic with streaming and server-side request rules; then OpenAI and Gemini; price table and cost.
5. Purchases: the verifier interface, the chosen implementation, webhooks, refunds.
6. Admin panel: Access check, read screens first (Overview, Users, Payments, Usage), then the audited actions.
7. Analytics events and the panel's charts.
8. App side (pro mode only): sign-in, the "Qutai Credits" provider, the balance indicator, the purchase screen,
   the consent step, the screen that says page content goes through our server in credit mode.
9. Abuse protection: App Attest and Play Integrity, trial credit limits.
10. Legal before launch (see `TODO.md` › Legal). Sync comes after launch.

The owner needs, before step 1 can deploy: a Cloudflare account (Workers Paid for Durable Objects and Queues at
this scale should be checked), a domain for the API and the panel, and Access set up with the admin email.
Before step 5: Apple Developer and Play Console products, and the payments decision.
