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
4. Analytics (built 22 Nov 2026, off on the server until the owner switches it on): in pro builds only, once setup is
   done, a one-time question "Help improve Qutai?" with Allow / Don't allow of equal weight and nothing pre-ticked,
   changeable in Settings › Privacy and security; a small fixed list of events goes to Qutai's own server (Analytics
   Engine), not Firebase, never from incognito, with a random install id that is deleted when the user says no.
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
  Status: Default (manager or implementing session; open to change) · Changed 2026-11-22: built (`SRV-31`) · Why: reason not recorded · Enforced: In the app: src/analytics/analytics.ts (AnalyticsSink); Server: backend/apps/api/src/routes/events.ts · Source: backend/DESIGN.md › Decisions, › Analytics; [TODO.md](../../TODO.md#analytics-with-consent)
- **`SRV-11`** Analytics only in pro builds and only after the user agrees, off by default, changeable in Settings › Privacy, never from incognito tabs.
  Status: Default (manager or implementing session; open to change) · Changed 2026-11-22: built; the question is a one-time dialog after setup, not a setup step (`SRV-31`) · Why: privacy · Enforced: In the app: src/analytics/index.ts, consentPrompt.ts, src/components/SettingsModal.tsx (AnalyticsSwitch) · Source: backend/DESIGN.md › Analytics; [TODO.md](../../TODO.md#analytics-with-consent); a9e83e4
- **`SRV-12`** Analytics events are a small fixed list (feature used, setup finished, task finished or failed with an error kind, purchase screen opened) with app version, platform and language; never web addresses, page content, search terms, chat text, memory, an advertising id or a lasting device id; an install id resets when consent is withdrawn; unknown events and fields are dropped.
  Status: Default (manager or implementing session; open to change) · Changed 2026-11-22: built (`SRV-32`) · Why: anonymous usage only · Enforced: In the app: src/analytics/events.ts; Server: backend/packages/shared/src/events.ts, apps/api/src/routes/events.ts (cleanEvents); tests scripts/analytics-tests, backend/apps/api/test/events.test.ts · Source: backend/DESIGN.md › Analytics; [TODO.md](../../TODO.md#analytics-with-consent)
- **`SRV-13`** No advertising id is collected (so no App Tracking Transparency prompt on iPhone, ad id off on Android).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: No advertising-id library in the app; the events carry none (src/analytics/events.ts) · Source: [TODO.md](../../TODO.md#analytics-with-consent)
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
- **`SRV-28`** Rate-limit refusals (per IP, per IP on sign-in routes, and the user's own task limits) are counted in each server instance's memory and written to the database as daily totals at most once a minute per instance, never one row per request; only the route is kept, never an IP address; kept 30 days; the admin panel's Abuse screen shows them with the flags (`CRED-34`).
  Status: Default (backend step 9, part 1, 2026-11-22) · Why: an attack that is being refused must not turn into a database write per request · Enforced: Server: backend/apps/api/src/abuse/hits.ts; migration 0016 · Source: backend/DESIGN.md › Abuse protection (step 9)
- **`SRV-29`** Pro builds prove to the server that sign-in and AI requests come from Qutai as the App Store or Google Play installed it on a real device (Apple App Attest: a key attested once per install, an assertion per request; Google Play Integrity: a token per request, or once an hour per signed-in session). The server's switch is off / log only / enforce, **log only by default**: it checks and counts on the Abuse screen but refuses nothing; enforce refuses failed or missing proofs; a request the server can't check always goes through.
  Status: Default (backend step 9, part 2, 2026-11-22; enforce is the owner's switch) · Why: Qutai Credits cost real money per request, and a scripted client or a modified app shouldn't be able to spend them freely; log only first so nothing breaks before the new app version is out · Enforced: Server: backend/apps/api/src/device/; In the app: src/account/deviceProof.ts, deviceCheck.ts; plugins/withProDeviceCheck.js · Source: backend/DESIGN.md › Abuse protection (step 9) › Part 2; backend/README.md › Device verification
- **`SRV-30`** What device verification sends: to Apple and Google, only what their own services need on the phone (Apple: an attestation of a key and assertions; Google: a request hash, Google's integrity verdict about the app, the device and the install); to Qutai's server, the key id, assertions and Google's token, never linked to the account (keys are deleted after 180 days unused; per-day counts are kept 30 days). The app sends proofs only when the server's `/config` asks, never in the open-source build, and a proof it can't make never blocks a request on the phone.
  Status: Default (backend step 9, part 2, 2026-11-22) · Why: data minimisation; the open-source build talks to no server · Enforced: In the app: src/account/deviceProof.ts (headers, error header), plugins/proBuild.js (PRO_ONLY_PACKAGES); Server: migration 0017 · Source: backend/README.md › Device verification
- **`SRV-34`** When the app can't make a device proof, `X-Qutai-Device-Error` says where and why in one short word, `<stage>_<cause>` (at most 30 lowercase letters and underscores; the server records it as `app_<word>` on the Abuse screen): the stage is Android `prep` (preparing Play Integrity) or `req` (the token), iOS `keygen`, `challenge` / `register` (our server), `attest` or `assert`; the cause is only the native module's error code mapped to a fixed word (Google's Play Integrity codes such as `api_not_available`, `play_store_missing`, `play_services_outdated`, `network_error`, `invalid_project`, `too_many_requests`; Apple's DCError codes `feature_unsupported`, `invalid_key`, `apple_unavailable`, `system_failure`, `invalid_input`; `unknown`), `failed` for any other error. Never the error message, a URL or anything about the device or account. iOS keeps sending the last attestation's word while it waits an hour to try again. Before the platform steps: `config_failed` (the server's `/config` couldn't be read), `nonce_failed` (no secure random source), `setup_failed` (anything else, such as the key store). Besides these: `unsupported`, `not_configured`, `timeout`. The nonce comes from expo-crypto (src/utils/secureRandom.native.ts): React Native has no global `crypto`, which made every proof in 0.1.13 and 0.1.14 fail before it started (`app_failed`).
  Status: Default (2026-11-22; every Android request from the 0.1.13 internal test showed only `app_failed`) · Why: the owner can see why a proof is missing without any free text leaving the phone · Enforced: In the app: src/account/deviceProof.ts (deviceErrorToken), src/account/deviceCheck.ts (random from fillRandom); Server: backend/apps/api/src/device/deviceCheck.ts accepts `^[a-z_]{1,30}$` (unchanged) · Tests: scripts/account-tests/device.test.ts (every native code of `@expo/app-integrity` has a word that fits) · Source: backend/README.md › Device verification

- **`SRV-31`** Product analytics in pro builds: the server's `analytics` switch is **off by default** (while off the app neither asks nor sends). When on, the app asks once after setup and the legal step, when nothing else is in front and the tab isn't incognito: "Help improve Qutai?" with what is and isn't sent, Allow / Don't allow of equal weight, nothing preselected; no answer asks again on a later start. The answer and a random install id (made at Allow, deleted at Don't allow or when switched off in Settings › Privacy and security) stay on the phone, outside Settings and backups. Events wait in memory only and go in batches without the account; nothing is recorded from an incognito tab or conversation. "Setup finished" is held for that run and sent only if the user then allows.
  Status: Default (backend step 7, 2026-11-22; switching the server on is the owner's, after the policy that describes it is published) · Why: TODO.md › Analytics, with consent; a question in setup itself would come before the user knows the app, and an event can't be sent before the answer anyway · Enforced: In the app: src/analytics/ (index.ts, analytics.ts, consentPrompt.ts), App.tsx (askAnalyticsConsentOnce, setIncognitoProbe), src/components/Dialog.tsx (equalButtons); Server: backend/apps/api/src/routes/events.ts (analyticsEnabled) · Source: backend/DESIGN.md › Analytics
- **`SRV-32`** The events and what they carry: `setup_finished`, `feature_used` (one of nine feature words), `task_finished` and `task_failed` (provider `qutai` / `own`, and for a failure one of seven error kinds read from status codes and our own error kinds, never the message), `purchase_screen_opened`; each batch has the app version, platform, interface language and the install id. Instrumented today: setup, assistant tasks, Buy credits, voice input. The server drops anything else and stores per event only those words plus the first 32 hex characters of SHA-256 of the install id, in Analytics Engine for three months.
  Status: Default (backend step 7, 2026-11-22) · Why: the fixed list in backend/DESIGN.md › Analytics, made checkable · Enforced: src/analytics/events.ts, errorClass.ts; backend/packages/shared/src/events.ts; a test compares the two lists · Source: backend/README.md › Product analytics
- **`SRV-33`** The admin panel's Product analytics screen reads the events through Cloudflare's Analytics Engine SQL API with fixed queries (only the number of days, 7 / 30 / 90, is put in) and an API token with Account Analytics: Read; besides Anthropic's pricing page (`SRV-24`) and Access's keys, it is the panel's only outbound request.
  Status: Default (backend step 7, 2026-11-22) · Why: Analytics Engine is read only through its SQL API · Enforced: Server: backend/apps/admin/worker/api/analytics.ts · Source: backend/README.md › Product analytics; backend/DEPLOY-prod.md › Ürün analitiği
## Details

- (was `SRV-14`) If Firebase is added later, its config files stay out of the public repository. Why: the repository is open source. Where: [TODO.md](../../TODO.md#analytics-with-consent).
- (was `SRV-19`) Android release builds are signed with Qutai's upload key; a build signed with another key fails Google sign-in and can't be installed over the old app. Why: Google's Android sign-in is tied to the signing certificate. Where: docs/pro-test-builds.md; docs/google-sign-in.md; 740ac38.

## Limits and what is not built

- Production is deployed (19 Nov 2026, `SRV-22`); never tried with real purchases (no RevenueCat yet) and only one provider.
- Analytics events and the panel's charts (server step 7): built 22 Nov 2026, off on the server (`SRV-31`…`SRV-33`);
  waiting for the owner's switch, the Analytics Engine set-up, and the published policy text. Abuse protection (step 9): flags and
  rate-limit hits built (22 Nov 2026, `SRV-28`, `CRED-34`); device verification built in "log only" (`SRV-29`, `SRV-30`;
  enforce, and the owner's Apple / Google set-up, open); no trial credits, so no trial limits. Legal
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
