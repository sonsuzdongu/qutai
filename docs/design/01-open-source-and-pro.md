# 1. The open-source build and pro mode

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Qutai is one open-source code base (Apache-2.0). A build made from the repository works on its own with the user's own
AI; the official store builds are meant to be the same code with one build-time switch, pro mode, which adds a Qutai
account, Qutai Credits and backups kept in the account.

## How it works

1. **Built from the repository (the default).** `EXPO_PUBLIC_PRO_MODE` is off. The user brings their own AI: an
   Anthropic, OpenAI, Gemini or OpenRouter key, or their own OpenAI-compatible server (see [section 2](02-ai-providers.md)). There is no
   Settings › Account, no Qutai Credits provider and no backup in an account. Data goes only to the phone, the AI
   service the user set up and, for the features they use, the search engine (suggestions), Apple's or Google's address
   lookup ("Use my location") and speech service (voice input off the device), and the publishers of filter lists.
2. **Pro mode.** The switch is on and a server address (`EXPO_PUBLIC_QUTAI_API_URL`) is set. This adds:
   - Settings › Account: Sign in with Apple, Google or email; sign out, sign out of all devices, delete the account.
   - A sixth AI provider, **Qutai Credits**: no key; requests go through Qutai's server and are paid with credits. The
     user picks a tier (Qutai Fast, Qutai, Qutai Pro), not a model.
   - Buying credits. Today the test server accepts every purchase without a real store check (a deliberate stand-in).
   - Settings › Backup › Qutai account: the encrypted backup file kept in the account (see [section 3](03-data-on-the-phone.md)).
   - Its own privacy policy and terms.
3. **Test sign-in.** A third switch (`EXPO_PUBLIC_DEV_LOGIN`) is used only for builds made against a local test server.
4. **Forks.** Anyone may fork, change and publish the code. A published fork must use its own name, logo, icons and
   bundle id. If it turns on pro features, it must run its own server and never point at Qutai's.

## The rules

- **`PROD-1`** Pro features exist only when `EXPO_PUBLIC_PRO_MODE` is on (`on`, `true`, `1` or `yes`); it is off unless set.
  Status: Default (manager or implementing session; open to change) · Why: builds from the repository "use only the user's own AI key and keep everything on the device" · Enforced: In the app: src/config/features.ts (features.pro) · Source: src/config/features.ts; README › Official builds and building it yourself; d95ab3e
- **`PROD-2`** Accounts, Qutai Credits and the account backup need both pro mode and a server address; without either, none of them is shown.
  Status: Default (manager or implementing session; open to change) · Why: "Off, the provider isn't offered and nothing about credits ever contacts the server" · Enforced: In the app: src/config/features.ts (accountsEnabled, creditsEnabled); src/backup/server/index.ts (serverBackupEnabled); src/ai/providers.ts (PROVIDER_ORDER) · Source: README › Qutai Credits (pro mode); 3d6b3f7
- **`PROD-3`** The open-source build never contacts Qutai's server: only the account session, the credits client and the account backup read the server address, and each is switched off without pro mode.
  Status: Default (manager or implementing session; open to change) · Why: README: "A build without the switch has no Account section and never contacts Qutai's server" · Enforced: In the app: src/account/index.ts, src/credits/index.ts, src/backup/server/index.ts (each returns early without accountsEnabled) · Source: README › Official builds and building it yourself; 3d6b3f7
- **`PROD-4`** A backup that names Qutai Credits as the provider does not switch a build without pro mode to it; the phone's provider stays as it is.
  Status: Default (manager or implementing session; open to change) · Why: "A provider this build doesn't offer (Qutai Credits outside pro mode) is left as it is here" · Enforced: In the app: src/backup/backup.ts (mergeSettings) · Source: src/backup/backup.ts
- **`PROD-6`** Pro-only parts must keep the repository build working without them.
  Status: Default (manager or implementing session; open to change) · Why: the open-source build is the whole app · Source: TODO.md › Pro mode; a9e83e4
- **`PROD-7`** Test sign-in exists only with accounts on, `EXPO_PUBLIC_DEV_LOGIN` on and the test server's secret; without them the secret is not put into the app; no EAS profile turns it on; such a build is never shared or shipped, and pro test builds are made without it.
  Status: Owner, 2026-11-17 (test sign-in turned off in pro test builds: "test girişini kapat") · Why: the secret is readable by anyone who has the build · Enforced: In the app: src/config/features.ts (devLoginSecret, devLoginEnabled) · Source: src/config/features.ts; 3249723; memory note "Fix before launch"
- **`PROD-8`** Fake purchases (the server accepts every credit purchase) are a temporary stand-in, only on a development server, and must be removed before release.
  Status: Owner, 2026-11-17 ("şimdilik bu payment aşamasını fake yap") · Why: the owner wants to test the whole flow now and fix it later · Enforced: Server: fake purchases only when the server is a development one with fake purchases turned on (see [section 7](07-posting-and-paying.md)) · Source: TODO.md › Before launch: remove fake purchases; e521581
- **`PROD-9`** The open-source build and pro mode have separate privacy policies and terms with separate version numbers (open-source 3, pro 5 today); the version shown follows pro mode, and a new version asks the user to accept again.
  Status: Owner, 2026-11-19 (the last bump, 2 → 3 and 4 → 5, "on the owner's word") · Why: each text must say what that build really sends; a changed text must be accepted again · Enforced: In the app: src/legal/documents.ts (OPEN_SOURCE_LEGAL_VERSION, PRO_LEGAL_VERSION, LEGAL_VERSION) · Source: 1e08428, d9e446b, 94f9391, 040c537
- **`PROD-10`** The open-source privacy policy says: "Qutai has no servers of its own: we do not collect, store or sell your data", and lists what leaves the phone (see [section 3](03-data-on-the-phone.md)); any change to what leaves the phone needs a change to that text and a version bump.
  Status: Default (manager or implementing session; open to change); lawyer review pending (TODO.md › Other) · Why: the claims must stay true for the open-source build · Source: src/legal/documents.ts; TODO.md › Other; d9e446b
- **`PROD-11`** The code is licensed under Apache-2.0; the licence covers the code only, not the name "Qutai", its logo or icons.
  Status: Owner, 2026-11-14 · Why: Apache-2.0 section 6 gives no right to the trade names; a fork must not look official · Source: LICENSE; TRADEMARKS.md; a7884fd, e966c69
- **`PROD-12`** A published fork changes the name everywhere (`app.json`, `src/i18n/`, `locales/`, README, `src/legal/documents.ts`), replaces the logo and icons, uses its own bundle id and Android package name, and runs its own server if it turns on server features.
  Status: Default (manager or implementing session; open to change) · Why: avoid suggesting the fork is the official app; the legal texts describe Qutai's own practices · Source: TRADEMARKS.md › If you publish a fork; README › Forking
- **`PROD-13`** Building and running the code for personal use, development and testing is allowed without renaming it.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: TRADEMARKS.md › What you may do without asking
- **`PROD-14`** Trademark statements do not name an owner; the website shows only the Apache-2.0 note and no trademark links.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 8a61c46, 0f2bd8f, a1d1ca6
- **`PROD-15`** Settings › About › Open source licences lists every third-party component in the app with its licence text (134 entries, loaded the first time the screen opens).
  Status: Default (manager or implementing session; open to change) · Why: licences such as PDF.js (Apache-2.0) and the bundled BSD decoders require their notices to be shown · Source: 2275af2; src/legal/licences.json

## Details

- (was `PROD-5`) Pro-only native settings (the Sign in with Apple entitlement, the Google sign-in URL scheme) are added to the app only in pro builds. · Where: In the app: plugins/withProAccounts.js · d95ab3e

## Limits and what is not built

- No live sync in either build. Pro has encrypted backups in the account only.
- Analytics (consented, anonymous, pro only) is planned but not built (TODO.md › Analytics, with consent).
- Credit prices, the model behind each tier, pack sizes, credit expiry and per-user limits are open questions for the owner.
- No EAS build profile builds pro mode yet; pro test builds are made locally ([docs/pro-test-builds.md](../../docs/pro-test-builds.md)).
- Lawyer review of both sets of legal texts is pending (TODO.md › Other).

## Where it lives

- `src/config/features.ts`, `src/legal/documents.ts`, `src/legal/proDocuments.ts`, `plugins/withProAccounts.js`, `eas.json`
- [TRADEMARKS.md](../../TRADEMARKS.md), [LICENSE](../../LICENSE), README › Official builds and building it yourself, › Forking
- [docs/pro-test-builds.md](../../docs/pro-test-builds.md); sections 33 to 36 for the pro parts

## Disagreements between sources

- README › Official builds says "credits and sync are not in the code yet" and lists Qutai credits as "planned"; Qutai Credits (3d6b3f7) and account backups (bd6743e) are in the code. There is still no sync.
- `src/config/features.ts` says the official store builds set pro mode in their EAS build profile; `eas.json` sets `EXPO_PUBLIC_PRO_MODE` to `off` in every profile, production included.
- The comment in `src/config/features.ts` lists "sync" among pro features; there is no sync.
- TODO.md › Decisions waiting › Contacts still says the legal versions were not bumped; commit 040c537 bumped them (open-source 3, pro 5).
