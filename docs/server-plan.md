# Qutai server plan

The server exists only for pro mode (`EXPO_PUBLIC_PRO_MODE=on`, see `src/config/features.ts`). Builds from
the public repository never talk to it. It lives in its own private repository; the app reaches it through
`EXPO_PUBLIC_QUTAI_API_URL`. Task-level tracking stays in `TODO.md` › Pro mode.

Decided: **Cloudflare Workers + Durable Objects + D1**, with R2 for sync blobs if they outgrow D1.
Still open: payments (RevenueCat or the store APIs directly), sign-in providers beyond Apple and Google,
credit pricing and trial credits.

## Pieces

| Piece | Role |
|---|---|
| Worker (`api`) | HTTP API: auth, relay, purchases, webhooks, sync. Stateless. |
| Durable Object `UserAccount` (one per user, SQLite storage) | The user's credit ledger, reservations, the "one task at a time" lock and rate-limit counters. Every request that spends credits goes through it, so they are handled one at a time per user. |
| D1 | Users, identities, refresh tokens, devices, purchases, the price table, usage summaries for reporting. |
| R2 (later) | Sync ciphertext, if rows get large. |
| Worker secrets | Provider keys and signing keys, separate per environment. |

The ledger has one source of truth: the user's Durable Object. D1 holds a copy for reporting, written
afterwards and keyed by the same entry id, so a replayed write changes nothing.

## Request flow in credit mode

```
App ── access token ──► Worker ──► UserAccount DO: lock task, reserve max cost
                          │
                          ├──► provider (our key), response streamed back to the app
                          │
                          └──► UserAccount DO: settle with real token usage, refund the rest, unlock
```

- The app sends only the conversation turns. The system prompt, the tool list, the allowed models, the
  maximum response length and the step limit are set on the server.
- A reservation that is never settled (the Worker died, the client vanished) expires through a Durable
  Object alarm and is refunded.
- Page contents and conversations are not stored and not logged. Logs keep user id, model, token counts,
  cost and timing.

## Endpoints (first version)

| Endpoint | Purpose |
|---|---|
| `POST /auth/apple`, `POST /auth/google` | Verify the provider's identity token, create or find the user, issue our access token (short-lived) and refresh token |
| `POST /auth/refresh`, `POST /auth/signout` | Rotate or revoke the refresh token |
| `DELETE /account` | Delete the account and all server-side data (required by the App Store) |
| `GET /credits` | Balance and recent ledger entries |
| `POST /relay` | One model request; streamed response; reserves and settles credits |
| `POST /purchases/verify` | Verify a purchase with Apple or Google and add credits |
| `POST /webhooks/apple`, `POST /webhooks/google` | Refund and revocation notifications; take refunded credits back |
| `POST /attest/...` | App Attest and Play Integrity (after the first version) |
| `GET/PUT /sync/...` | End-to-end encrypted sync (Phase 5; ciphertext only, deletions as tombstones) |

## Data

D1:

- `users` (id, created_at, deleted_at)
- `identities` (provider, subject, user_id): unique on provider + subject
- `refresh_tokens` (hash, user_id, device_id, expires_at, revoked_at): only hashes are stored
- `purchases` (store, transaction_id unique, user_id, product, credits, status, verified_at)
- `prices` (provider, model, input, output, cache, thinking per million tokens, effective_from)
- `usage_daily` (user_id, day, model, tokens, cost): for reporting and spending alerts

`UserAccount` Durable Object (SQLite):

- `ledger` (entry id unique, kind: purchase / reserve / settle / refund / revoke, amount, ref, at)
- `balance` (derived from the ledger; kept in a row for speed)
- `active_task` (reservation id, started_at, expires_at)
- rate counters per minute and per day

Amounts are integers (micro-credits), never floating point.

## Rules that must hold

- Our provider keys never reach the app. Other people's keys never reach the server: own-key requests keep
  going straight from the phone to the provider.
- Two concurrent requests can never spend the same credit: the Durable Object handles one request at a time.
- Credits are added only after the store confirms the purchase; the app's report is not trusted. Each store
  transaction id is accepted once.
- Every write that moves credits carries an idempotency key.
- Rate limits per user and per IP; one task at a time per user.
- Separate provider keys and D1 databases for test and production; a written key rotation procedure;
  a monthly spending limit and alerts on each provider account.

## Order of work

1. Repository, environments (dev, production), CI deploy with Wrangler, D1 migrations.
2. Auth: Apple and Google token verification, our tokens, account deletion.
3. `UserAccount` Durable Object: ledger, reservation, settlement, expiry alarm, with tests for concurrency
   and replays.
4. Relay for one provider (Anthropic) with streaming and server-side request rules; then OpenAI and Gemini.
   The provider adapters in the app's `src/ai/` are split so both sides can share them.
5. Purchases: verification, webhooks, refunds.
6. App side: sign-in screens, the "Qutai Credits" provider, the remaining-credits indicator, the screen
   that says page content goes through our server in credit mode.
7. Abuse protection: App Attest and Play Integrity, limits on trial credits.
8. Legal before launch: privacy policy and terms rewritten, every "no servers of ours" promise in the app
   updated (`TODO.md` › Legal lists the places), `LEGAL_VERSION` bumped.
9. Sync (Phase 5).

## Not covered by this platform

- A server-side browser for background research. Workers cannot run one; it would be a separate service.
  Not needed while Android uses a foreground service.
- Limits and prices of D1, Durable Objects and R2 change; check Cloudflare's current pages before sizing.
