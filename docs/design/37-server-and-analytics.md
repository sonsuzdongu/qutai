# 37. The server, analytics and pro test builds

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Qutai's own server exists only for the official (pro) builds: accounts, Qutai Credits, purchases, server backups and an
admin panel. This section covers what the server is, what it keeps about a person, the planned consent-based
analytics, and how the owner makes pro test builds.

## How it works

1. Builds from this repository never talk to Qutai's server. Official builds are the same code with pro mode switched
   on at build time and a server address.
2. The server runs on Cloudflare (Workers for the code, one Durable Object per user for credits, D1 as the database,
   R2 for backup files, Access in front of the admin panel). It lives in its own repository, checked out at
   `backend/`, with a development and a production environment, each with its own database, secrets and provider keys.
3. It keeps the account, how the person signs in, sessions per phone, the credit ledger and per-request counts
   (model, tokens, cost), purchases and encrypted backups. It never keeps conversations, page content, prompts, web
   addresses or memory. Deleting the account deletes the person's data; purchase records stay without the person.
4. Analytics are not built. Planned: in pro builds only, a setup question "Help improve Qutai: may we collect anonymous
   usage data?" with Allow / Don't allow of equal weight, nothing pre-ticked, changeable later in Settings › Privacy;
   events go to Qutai's own server, not Firebase.
5. The owner tests pro mode with a phone build that points at the server on their own computer through a tunnel (a
   public address forwarding to local port 8000).

## The rules

- **`SRV-1`** Qutai's server exists only for pro mode; builds without pro mode never contact it and must keep working exactly as before.
  Status: Owner, date not recorded · Why: the open-source build stays own-key, no account, nothing sent to Qutai (TODO.md › Pro mode; a9e83e4) · Enforced: In the app: src/config/features.ts (features.pro, accountsEnabled) · Source: TODO.md › Pro mode; docs/server-plan.md
- **`SRV-2`** The server runs on Cloudflare only (Workers, Durable Objects, D1, Queues, scheduled jobs, Access, and R2 for backups; Analytics Engine once consented analytics are built, `SRV-10`), with separate development and production environments.
  Status: Owner, date not recorded (marked decided in TODO.md › Pending decisions) · Changed 2026-11-20: the unused Analytics Engine binding and the `POST /events` stub were removed until analytics are built · Why: reason not recorded · Source: backend/DESIGN.md › Decisions; docs/server-plan.md
- **`SRV-3`** The server lives in its own repository, checked out at `backend/` as a git submodule; the app reaches it only through `EXPO_PUBLIC_QUTAI_API_URL`.
  Status: Owner, 2026-11-15 · Why: reason not recorded · Source: docs/server-plan.md; 41b767b
- **`SRV-4`** No secret is ever committed; limits and abuse thresholds live in the database or secrets, not in code, because the repository may be public.
  Status: Default (manager or implementing session; open to change) · Why: as stated · Enforced: Server: `npm run check:dev-vars` in backend/ · Source: backend/DESIGN.md › Decisions
- **`SRV-5`** The server keeps: the account (id, status, created, last seen), its sign-in methods and address (with who verified it), hashed renewal passes per phone, an encrypted Apple token for revocation, the credit ledger and per-request usage (model, tokens, cost, outcome, tier), purchases, email codes only as hashes for 24 hours, encrypted backups with their metadata, abuse flags and admin audit rows; never conversations, page content, prompts, web addresses or memory.
  Status: Default (manager or implementing session; open to change) · Why: needed for accounts and billing; content is not needed, so the admin panel "can never show what a user asked or browsed" · Enforced: Server: backend/apps/api/migrations/; backend/apps/api/src/lib/log.ts (ALLOWED, sanitize) · Source: backend/DESIGN.md › Data added to the plan's tables; 1e08428
- **`SRV-6`** Server logs carry a fixed list of fields only (ids, counts, cost, timing, a fixed reason); bodies, headers, web addresses with queries, prompts, page content and tokens are dropped.
  Status: Default (manager or implementing session; open to change) · Why: privacy; tests check it · Enforced: Server: backend/apps/api/src/lib/log.ts (ALLOWED, sanitize) · Source: backend/README.md › Notes
- **`SRV-7`** Deleting the account deletes the server's data for it (database rows, the credit ledger, backups, the payment-service customer); purchases stay without the person, and the admin audit keeps only the bare id.
  Status: Default (manager or implementing session; open to change) · Why: the App Store requires in-app deletion; tax law requires sales records · Enforced: Server: backend/apps/api/src/auth/users.ts (deleteAccount) · Source: backend/README.md › Account deletion; backend/DESIGN.md › Security
- **`SRV-8`** The API accepts the app only (no web-page origins), and the admin API only its own page.
  Status: Default (manager or implementing session; open to change) · Why: the app is not a browser page · Enforced: Server: backend/apps/admin/worker/index.ts (same-origin checks) · Source: backend/DESIGN.md › Security
- **`SRV-9`** Provider keys, signing keys and notification secrets are server secrets, different per environment, with a written rotation procedure.
  Status: Owner, date not recorded (server plan rule) · Why: separate test and production; a leaked key can be replaced · Source: docs/server-plan.md › Rules that must hold; backend/README.md › Key rotation (outline)
- **`SRV-10`** Analytics in the first version are Qutai's own anonymous events sent to its server, not Firebase; the app's event layer is an interface so Firebase can be added later.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: Designed, not built (the server has no events address yet; its 501 stub was removed on 20 Nov 2026) · Source: backend/DESIGN.md › Decisions, › Analytics; [TODO.md](../../TODO.md#analytics-with-consent)
- **`SRV-11`** Analytics only in pro builds and only after the user agrees, off by default, changeable in Settings › Privacy, never from incognito tabs.
  Status: Default (manager or implementing session; open to change) · Why: privacy · Enforced: Designed, not built · Source: backend/DESIGN.md › Analytics; [TODO.md](../../TODO.md#analytics-with-consent); a9e83e4
- **`SRV-12`** Analytics events are a small fixed list (feature used, setup finished, task finished or failed with an error kind, purchase screen opened) with app version, platform and language; never web addresses, page content, search terms, chat text, memory, an advertising id or a lasting device id; an install id resets when consent is withdrawn; unknown events and fields are dropped.
  Status: Default (manager or implementing session; open to change) · Why: anonymous usage only · Enforced: Designed, not built · Source: backend/DESIGN.md › Analytics; [TODO.md](../../TODO.md#analytics-with-consent)
- **`SRV-13`** No advertising id is collected (so no App Tracking Transparency prompt on iPhone, ad id off on Android).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: Designed, not built · Source: [TODO.md](../../TODO.md#analytics-with-consent)
- **`SRV-15`** Before the server goes live, every "no servers of ours" promise (setup welcome and legal summary, privacy texts, store listings, README) must be rewritten and the legal version raised; pro builds already show their own documents.
  Status: Default (manager or implementing session; open to change) · Why: no longer true once requests pass through Qutai's server · Source: TODO.md › 5. Legal; src/legal/proDocuments.ts; 1e08428
- **`SRV-16`** A server-side browser for background research is not part of this platform.
  Status: Default (manager or implementing session; open to change) · Why: Workers can't run a browser; not needed while Android uses a foreground service · Source: docs/server-plan.md › Not covered by this platform
- **`SRV-17`** The tunnel address for pro test builds is passed only at build time and never committed.
  Status: Owner, 2026-11-16 · Why: real domains stay out of commits · Source: memory pro-mode-test-api-url; docs/pro-test-builds.md
- **`SRV-18`** Pro test APKs are built without the test sign-in values since 17 Nov 2026.
  Status: Owner, 2026-11-17 · Why: the owner said to turn test sign-in off · Enforced: In the app: src/config/features.ts (devLoginEnabled) · Source: memory fix-before-launch
- **`SRV-20`** The app's version (and the build number derived from it) changes only when the owner asks; test builds never change it.
  Status: Owner, 2026-11-17 · Why: the owner controls when the build number moves · Source: docs/versioning.md; memory version-bump-only-on-request
- **`SRV-21`** The Apple sign-in key shared in chat on 16 Nov 2026 is replaced by a separate key for production.
  Status: Owner, 2026-11-17 (on the fix-before-launch list) · Why: the key left a secure channel · Source: memory fix-before-launch
- **`SRV-22`** Production runs on Cloudflare since 19 Nov 2026, deployed with one command (`backend/scripts/deploy-prod.mjs`, runbook `backend/DEPLOY-prod.md`). First production values: Anthropic only with a 100 USD monthly limit, example pricing (100 credits per USD, 30 % margin) until the owner's pricing decisions, no purchases until RevenueCat (credits are granted in the admin panel), and fake purchases impossible in production.
  Status: Owner, 2026-11-19 · Changed 2026-11-20 (owner): the script's first values are now Claude Haiku 5.5 only (one tier) and a 100 % margin at 100 credits per dollar (`CRED-40`, `CRED-42`); it still never overwrites a setting that exists, so production is switched in the panel (backend/DEPLOY-prod.md) · Why: the owner's values for the first deploy · Enforced: Server: backend/scripts/deploy-prod.mjs (CONFIG); backend/apps/api/src/purchases/fake.ts · Source: backend cff36cc, ff5bbf9; 2801f70, 39289c6
- **`SRV-23`** Production hostnames and the admin address are written in the backend repository (deploy script and runbook) by the owner's decision; this app repository still never contains them (a pro build gets the server address at build time, `BUILD-10`), and the test tunnel's address stays out of both (`SRV-17`).
  Status: Owner, 2026-11-19 · Why: the deploy needs them; the backend runbook says to remove them first if that repository is ever made public · Source: backend/DEPLOY-prod.md; owner's memory note on the pro-mode API URL

- **`SRV-24`** The admin Worker makes one outbound request of its own (besides fetching Cloudflare Access's signing keys): `GET https://platform.claude.com/docs/en/about-claude/pricing.md`, only when the owner presses "Check prices", with no account data, a 10-second timeout and a 2 MB cap; the answer is treated as untrusted text (`CRED-41`).
  Status: Owner, 2026-11-20 (the check button) · Why: there is no pricing API; nothing else leaves the panel · Enforced: Server: backend/apps/admin/worker/api/model.ts (fetchPricingPage, checkPrices) · Source: backend/README.md › Admin panel › Model, prices and margin

- **`SRV-25`** One settings schema (`backend/packages/shared/src/settingsSchema.ts`) gives every numeric field of `relay_rules`, `credit_limits`, `pricing`, `backup_limits` and `email_limits` a default and bounds, plus the checks across fields (timeouts within the longest request; the drain at most 25 s, inside the 30 s Workers keep work alive after a disconnect; reservations outliving the longest request plus the drain plus 15 s). Every reader, the admin API and its forms, the deploy's first values and the seed check use it; reading fills and clamps (logged), saving is strict.
  Status: Default (code review, 20 Nov 2026) · Why: settings were parsed all-or-nothing with no bounds, so a new field in code could make production answer 503 · Enforced: Server: settingsSchema.ts; apps/api/src/relay/config.ts; apps/admin/worker/api/settings.ts; scripts/deploy-prod.mjs, scripts/check-seed-prices.mjs; tests backend/apps/api/test/settings-schema.test.ts (values the 19 Nov production deploy stored) · Source: backend/DESIGN.md › Review fixes (20 Nov 2026); code review of 20 Nov 2026
- **`SRV-26`** The production deploy script checks before anything remote that `backend/` is committed (or `--allow-dirty`), typechecks and runs the tests; a successful deploy records the deployed server commit, app commit and agent profile (setting `deployment`), shown on the panel's Overview. `--dry-run` stays remote-free and fast.
  Status: Default (code review, 20 Nov 2026) · Why: what runs in production should be known and tested · Enforced: Server: scripts/deploy-prod.mjs (preflight, deployRecord); apps/admin/worker/api/overview.ts · Source: backend/DESIGN.md › Review fixes (20 Nov 2026); code review of 20 Nov 2026
- **`SRV-27`** ~~Test ("fake") purchases exist only through one seam (`TEST_STORES` and its helpers in `backend/packages/shared/src/purchases.ts`), so removing them before launch is taking back their credits, one migration and one delete (written in backend/DESIGN.md › Review fixes › Fake purchases seam). Nothing is removed yet.~~ Withdrawn 2026-11-21: the removal was done through the seam as planned (migration 0015; `TEST_STORES`, `RECORDED_STORES`, `isTestStore` and `testStoreSql` are gone, `realStoreSql` stays as a plain Apple-or-Google guard; backend/DESIGN.md › Fake purchases removed).
  Status: Withdrawn 2026-11-21 (owner); was: Default (code review, 20 Nov 2026) · Why: `fake` was spelled out in a D1 CHECK, the account's reference check, shared types, SQL filters and the panel · Enforced: Server: purchases.ts; a test ties the D1 CHECK to `RECORDED_STORES` · Source: backend/DESIGN.md › Review fixes (20 Nov 2026); code review of 20 Nov 2026

## Details

- (was `SRV-14`) If Firebase is added later, its config files stay out of the public repository. Why: the repository is open source. Where: [TODO.md](../../TODO.md#analytics-with-consent).
- (was `SRV-19`) Android release builds are signed with Qutai's upload key; a build signed with another key fails Google sign-in and can't be installed over the old app. Why: Google's Android sign-in is tied to the signing certificate. Where: docs/pro-test-builds.md; docs/google-sign-in.md; 740ac38.

## Limits and what is not built

- Production is deployed (19 Nov 2026, `SRV-22`); never tried with real purchases (no RevenueCat yet) and only one provider.
- Analytics events and the panel's charts (server step 7): not built (planned). Abuse protection (step 9) and legal
  work (step 10) open.
- A crash-report service: not decided (see CRED-37).
- App Store privacy labels and Play Data safety must describe the account data (identifiers and email linked to the
  person) and, later, analytics (planned).
- A lawyer's review of the pro privacy policy and terms (KVKK / GDPR, Turkish consumer law) (planned).
- Pro test builds: Gradle can keep an old JavaScript bundle when only build values changed; force the bundle step and
  check the tunnel host is inside the APK ([docs/pro-test-builds.md](../../docs/pro-test-builds.md)).

## Where it lives

- `backend/` (its [backend/README.md](../../backend/README.md) for setup, secrets, deploy and key rotation;
  [backend/DESIGN.md](../../backend/DESIGN.md) › Decisions, › Analytics, › Security, › Order of work).
- [docs/server-plan.md](../../docs/server-plan.md) (the earlier plan; backend/DESIGN.md wins where they differ).
- [docs/pro-test-builds.md](../../docs/pro-test-builds.md), [docs/release-signing.md](../../docs/release-signing.md),
  [docs/versioning.md](../../docs/versioning.md); `src/config/features.ts`; `src/legal/proDocuments.ts`.

## Disagreements between sources

- docs/server-plan.md still lists payments as open (decided 15 Nov 2026) and plans separate Apple and Google notification addresses and `/sync` routes; backend/DESIGN.md (which says it wins) replaced them with one purchase notification address and server backups.
- backend/DESIGN.md › Layout says the server is in "this repository"; docs/server-plan.md, TODO.md and the repository itself have it as its own repository checked out as a submodule.
