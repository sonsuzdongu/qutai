# 43. Working on this repository

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

House rules for anyone who changes Qutai, whether a person or an AI session: how to check work, keep the record, commit, handle secrets, test on phones, and which temporary stand-ins must be undone before launch.

## How it works

1. Read `AGENTS.md` first. Qutai is an Expo SDK 58 app, and Expo changes with every SDK, so any Expo, EAS or React Native API must be checked in the versioned docs (`docs.expo.dev/versions/v58.0.0/`, `docs.expo.dev/llms.txt`), never from memory.
2. Add packages with `npx expo install`. Before calling work done, run `npx expo lint` and `npx tsc --noEmit`, plus the matching `npm run test:*` scripts. The project uses npm (`package-lock.json`), so `npx` is the command to use, not `bunx`.
3. Every change to behaviour, a decision, a default, a limit, a permission or what leaves the phone also updates `DESIGN.md` in the same piece of work: the area's rules (a new id for a new decision, never reusing an old one), the decisions index and the changelog.
4. Sessions commit on `main` and do not push. They add no attribution trailers, and they stage only their own files or hunks, because several sessions edit the same working tree at once. Commit subjects are full sentences that say what changed and why, often with an area prefix ("Website:", "Docs:", "backend:", "Test checklist:", "Assistant:").
5. The server is a separate repository, checked out as the git submodule `backend/`. Its changes are committed there, and the app's typecheck and lint skip it.
6. Phone testing uses `docs/test-checklist.md`, written in Turkish. It lists what has been built but not yet seen on a real phone, in numbered sections (1 pro mode account and credits … 18 apps phase 1). The marks are `[x]` tried and works, `[ ]` not tried, and `[!]` tried with a problem (with a note). The owner tries the APKs in batches and writes problems under "Bulunan sorunlar". A fix starts only after the owner says "düzelt", and the fixed item is ticked with the fixing commit and a phone check to repeat.
7. Decisions waiting for the owner are listed at the top of `TODO.md`. Until the owner decides, the code's current behaviour is the default.
8. Some parts are temporary stand-ins the owner ordered. They are listed below (HOUSE-15 to HOUSE-18) and must be undone before any store release or production deploy.

## The rules

- **`HOUSE-1`** `DESIGN.md` is the single record of how Qutai works. Every piece of work that changes behaviour, a decision, a default, a limit, a permission or what leaves the phone updates it in the same change, with new rule ids that are never reused, plus the index and the changelog.
  Status: Owner, 2026-11-19 · Why: decisions were scattered over README, docs, TODO, commit messages and chat, and the owner wants one place that stays true ("sonrasında yaptığımız her şeyi de bu belgeye ekle & güncelle") · Source: AGENTS.md (rule "Keep DESIGN.md current"); owner's memory note on DESIGN.md
- **`HOUSE-2`** Before writing code against an Expo, EAS or React Native API, check the Expo version in `package.json` and read the matching versioned docs.
  Status: Owner, date not recorded · Why: "Expo ships breaking changes every SDK release", so APIs remembered from training are likely to be wrong · Source: AGENTS.md
- **`HOUSE-3`** Lint (`npx expo lint`) and typecheck (`npx tsc --noEmit`) pass before any task is called done. Since 20 Nov 2026 `npm run check:all` runs them with the profile check, `npm test` and the server's typecheck, lint and tests (`HOUSE-21`).
  Status: Owner, date not recorded · Why: reason not recorded · Source: AGENTS.md › Commands
- **`HOUSE-4`** Sessions commit on `main` and never push. The owner pushes.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: hand-over notes of every session ("not pushed")
- **`HOUSE-5`** Commit messages have no attribution trailers, such as Co-Authored-By.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: hand-over notes ("No attribution trailers"); none of the 524 commits has one
- **`HOUSE-6`** Stage and commit by path, taking only your own files or hunks, never the whole index.
  Status: Default (manager or implementing session; open to change) · Why: several sessions share one working tree. On 2026-11-16 a commit (e9ae431) swept in another session's staged hunks and left an App.tsx that did not compile, which e212c9c then fixed · Source: e9ae431, e212c9c and their hand-over notes
- **`HOUSE-7`** Commit messages say what changed and why in plain sentences, often starting with the area's name. A version bump is a commit of its own.
  Status: Default (manager or implementing session; open to change) · Why: commit messages are used as the history of decisions · Source: git log; VER-4
- **`HOUSE-8`** No secrets or private identifiers in the repository: no keys, passwords, test secrets, tunnel address or Apple team id. Docs use placeholders (`<tunnel URL>`, `<the password>`).
  Status: Owner, 2026-11-16 · Why: real domains and secrets must not be published with the code · Enforced: In the app: .gitignore (`.env`, `.env*.local`, `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.pem`, `*.mobileprovision`) · Source: owner's memory note on the pro-mode test URL; [docs/release-signing.md](../../docs/release-signing.md); BUILD-10, BUILD-13
- **`HOUSE-9`** Nobody raises the version without the owner's explicit word (see VER-2).
  Status: Owner, 2026-11-17 · Why: the owner controls when the version number moves · Source: [docs/versioning.md](../../docs/versioning.md) › When
- **`HOUSE-10`** All Turkish app text addresses the user as "siz". Every brief that adds or edits Turkish text says so, and review checks it.
  Status: Owner, 2026-11-16 · Why: the app mixed "sen" and "siz", and the owner picked "siz". This concerns the app's text, not how to address the owner in chat · Source: 9cea977, 33f5d6b; owner's memory note on Turkish "siz"
- **`HOUSE-11`** Problems the owner reports go into the test checklist first. A fix starts only after the owner says "düzelt".
  Status: Owner, 2026-11-18 · Why: the owner said "not et, ben düzelt deyince alt oturumlardaki Opus ajanlarına düzelttir" (note it, and have sub-session agents fix it when I say fix) · Source: docs/test-checklist.md › "18 Kasım'da bildirilenler"
- **`HOUSE-12`** Every feature that has not been seen on a phone gets a numbered section in `docs/test-checklist.md`, in Turkish, with concrete phone steps. Simulator results are recorded where a phone wasn't used, and fixed items are ticked with their commit.
  Status: Default (manager or implementing session; open to change) · Why: a great deal was built and only checked on simulators or not at all, so the owner tries everything in batches on a real phone · Source: 19fdd63; docs/test-checklist.md
- **`HOUSE-13`** When a decision for the owner comes up, it goes into `TODO.md` › "Decisions waiting for the owner", and until then the code's behaviour is the default. Once the owner decides, `DESIGN.md` is updated in the same change.
  Status: Owner, 2026-11-19 · Why: so open choices are visible in one list and never silently decided · Source: cdb3c1e; TODO.md header
- **`HOUSE-14`** When the owner asks what is open, list the open questions with the numbers used on 2026-11-16, and remove each one once it is answered. They cover tier models, step limits and pricing; packs and trial credits; credit expiry and the terms; showing which model serves a tier; when to retire direct model names; per-user limits; gross or net revenue; a read-only admin role; the pasted Cloudflare path; when picture-in-picture failed on the owner's phone; the Play declaration for installing packages; the lawyer review; legal translations; native-speaker review; house-style words; and localised prompt examples.
  Status: Owner, 2026-11-16 · Why: the owner said to keep them and remind them on request ("bunları hafızada tut, sonra sorunca tekrar hatırlatırsın") · Source: owner's memory note on open questions
- **`HOUSE-15`** ~~Today credit purchases are fake: with `FAKE_PURCHASES=true` on a local dev server, the Buy buttons add credits with no store and no charge (at most 10 test purchases per account in 24 hours). This must be replaced by real RevenueCat and store verification and must never be on in production.~~ Withdrawn 2026-11-21 (owner): fake purchases are removed; buying credits is real through RevenueCat (Google Play today, iOS later) ([35](35-purchases.md) › `BUY-21`).
  Status: Withdrawn 2026-11-21 (owner); was: Owner, 2026-11-17 · Why: the owner wants to test the whole flow now ("şimdilik bu payment aşamasını fake yap … sonra düzeltileceklere ekle"). Removal steps: connect RevenueCat and the stores; remove the fake paths and their ten-language texts; purge the fake purchase rows and the credits they granted; drop `'fake'` from the store check; re-check the admin panel's revenue; make sure `FAKE_PURCHASES` exists on no deployed Worker · Enforced: Server: backend/apps/api/src/purchases/fake.ts (`fakePurchasesEnabled`: only with `ENVIRONMENT` "dev" and `FAKE_PURCHASES` "true", else 404); In the app: src/purchases/index.ts (`fakePurchasesOn`) · Source: [TODO.md](../../TODO.md#before-launch-remove-fake-purchases); e521581, c382a28
- **`HOUSE-16`** The test sign-in (Settings › Account › Test sign-in) stays off in every build that leaves the owner's hands. Pro APKs have been built without its variables since 2026-11-17.
  Status: Owner, 2026-11-17 · Why: the owner said "test girişini kapat" (turn the test sign-in off). Anyone holding a build can read the test secret · Enforced: In the app: src/config/features.ts (`devLoginEnabled`); scripts/build/release.mjs (strips the variables) · Source: owner's memory note on fixes before launch; BUILD-9
- **`HOUSE-17`** Before release, a new Apple sign-in key is made for production, because the current one was pasted into chat on 2026-11-16.
  Status: Owner, 2026-11-17 · Why: a key that has appeared in a chat should not sign production · Enforced: Designed, not built (an owner task) · Source: owner's memory note on fixes before launch
- **`HOUSE-18`** Retired 2026-11-21: the trial switch "Asistan görünümü (deneme)" that compared the classic, band and curtain looks on a phone is gone; curtain ("Işık") is the only look (`UI-21`).
  Status: Owner, 2026-11-17; retired 2026-11-21 · Why: the owner picked "Işık" and asked for the switch to go before store review · Source: e971db7; [docs/working-mode.md](../../docs/working-mode.md) § 3a
- **`HOUSE-19`** Before any store release or production deploy, the owner is reminded of every stand-in in HOUSE-15 to HOUSE-18.
  Status: Owner, 2026-11-17 · Why: the owner asked for these shortcuts to be tracked and undone later · Source: owner's memory note on fixes before launch
- **`HOUSE-20`** The backend is changed only in its own repository (the submodule `backend/`), which the app's typecheck and lint skip.
  Status: Default (manager or implementing session; open to change) · Why: the server moved to its own repository on 15 Nov 2026 · Source: d3395ba, e4f1bae, 41b767b
- **`HOUSE-21`** The app's tests run through one loader and one runner (scripts/test-support/): `npm test` runs every server-free suite, four at a time (half the cores, at most 4; `QUTAI_TEST_JOBS` changes it), one line per suite and a total, and fails if any suite fails; `npm run test:<name>` runs one suite with node's full output; suites that need Qutai's local server are named `test:*:server` and never run in `npm test`; billed measurements (`measure:injection`) never run in a check. `npm run check:all` runs, one after the other, the app's typecheck, lint, profile check and `npm test`, then backend/'s typecheck, lint and tests, and exits non-zero on any failure. Tests don't assert absolute wall-clock times; a speed check compares with a reference measured in the same run.
  Status: Default (code review of 20 Nov 2026, the manager's brief) · Why: about 25 suites were run one by one by hand with four copies of the same loader; `test:text` failed once on a busy machine because of a 50 ms limit · Enforced: In the tooling: scripts/test-support/ (register.mjs, hooks.mjs, suites.mjs, run.mjs, README.md), scripts/check-all.mjs · Source: 20 Nov 2026 tooling clean-up
- **`HOUSE-22`** A dependency Qutai patches is pinned to the patched version (package.json exact version, an `overrides` entry for a patched transitive package) and listed in `expo.install.exclude`, so neither a fresh install nor `npx expo install --fix` moves it; `postinstall` runs `patch-package --error-on-fail`, so a patch that no longer applies fails the install. What each patch and each native module in `modules/` does, which JavaScript uses it, how to check it by hand, and what to do when a patched dependency is updated is in docs/native-code.md, kept current with every native change.
  Status: Default (code review of 20 Nov 2026, the manager's brief) · Why: `expo-dev-client ~58.0.20` let a patch release bring a new expo-dev-launcher under its patch, and the SDK already recommended 58.0.21; outside CI patch-package only printed an error and installed without the patch; the native code has no tests · Enforced: In the tooling: package.json (dependencies, overrides, expo.install.exclude, postinstall) · Source: 20 Nov 2026 tooling clean-up; docs.expo.dev › package.json (`install.exclude`)

## Limits and what is not built

- (not planned: no source) There is no CI. Checks run locally in each session (`npm run check:all`, about a minute on
  the owner's Mac).
- HOUSE-4 to HOUSE-6 are practice recorded in hand-over notes and the git log, not written in AGENTS.md.

## Where it lives

- `AGENTS.md`, `DESIGN.md`, `TODO.md` (top: decisions waiting; "Before launch: remove fake purchases", done 21 Nov 2026), `docs/test-checklist.md`
- The owner's memory notes (versions, "siz", fixes before launch, open questions, test URL, DESIGN.md)

## Disagreements between sources

- AGENTS.md says routes live in `src/app/` with Expo Router. This app has no `src/app/`: it is driven from `App.tsx` and its components. The AGENTS.md line is generic template text.
- AGENTS.md says to use `bunx` when `bun.lock` exists. There is no `bun.lock` (the project uses npm), so `npx` applies.
