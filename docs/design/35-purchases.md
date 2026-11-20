# 35. Purchases

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Buying Qutai Credits in the official (pro) builds: packs sold as one-time ("consumable") in-app products on the App
Store and Google Play, checked through RevenueCat (a payments service that talks to both stores) before any credit is
added. Since 20 Nov 2026 Google Play is connected in the app through RevenueCat's SDK (pro builds with the key only);
the App Store comes later through the same code. A deliberate, temporary "fake purchases" mode still lets the owner
test the whole flow on a local server, and a production switch lets the owner's own test purchases add credits.

## How it works

1. **Buy credits** opens from setup's account screen, Settings › Account › Qutai Credits and the "not enough credits"
   message. It shows the balance, what credits are, the packs the server offers for this phone's store with **the
   store's own price**, a store note, Terms and Privacy, and **Check for missing credits**.
2. The flow: the payments library is told the Qutai account id before anything is bought; after a purchase the
   store's transaction id is saved on the phone first, then reported to the server; the server asks RevenueCat itself
   and only then adds the pack's credits, and the new balance is shown from the server's answer. If the report gets
   lost, RevenueCat's notification to the server credits it anyway, and the phone reports saved purchases again when
   Buy credits opens, on "Check for missing credits" and after sign-in; a purchase the phone never got to save (killed
   app, no transaction id, "already owned") is found in the store's list of recent purchases and reported then.
3. A refund at the store takes the credits back; the balance may go below zero, which stops spending until the user
   buys again.
4. Which store: RevenueCat in a pro build with RevenueCat's key for the platform (Android today), its native module in
   the build and the server in store mode; otherwise an "unavailable" store: Buy credits shows the balance and packs
   and says buying isn't available in this build (every iOS build today, a pro build without the key, Expo Go).
5. Fake purchases (temporary): when the owner's local server runs with fake purchases on, Buy credits says "Test
   mode: nothing is charged" and each pack has a **Get (test)** button that adds its credits without any store.
6. There is no "Restore purchases" button: one-time products can't be restored at the stores and credits live in
   Qutai's ledger; "Check for missing credits" is the recovery path.
7. Test purchases in production (owner, 20 Nov 2026): panel › Settings › Test purchases in production lets store test
   purchases add credits on the production server, only for the accounts listed there and only while it is on.

## The rules

- **`BUY-1`** Payments go through RevenueCat (its app library, server-side lookups and one signed notification address), behind an interface so moving to the stores' own APIs later is a change in one place.
  Status: Owner, 2026-11-15 · Why: least work and risk; the trade-off (a third party sees purchase data and takes a share of revenue; the store APIs mean two stores' edge cases are Qutai's) is in backend/DESIGN.md › Purchases · Enforced: Server: backend/apps/api/src/purchases/verifier.ts (purchaseVerifier), revenuecat.ts (revenueCatVerifier) · Source: backend/DESIGN.md › Decisions, › Purchases; 2d44e7b
- **`BUY-2`** Credits are added only after the server has looked the purchase up with RevenueCat itself; the app's report is never trusted.
  Status: Owner, date not recorded · Why: an app's claim can be forged · Enforced: Server: backend/apps/api/src/routes/purchases.ts (verifyPurchase); backend/apps/api/src/purchases/service.ts (applyPurchase) · Source: docs/server-plan.md › Rules that must hold; backend/README.md › Purchases › Flow
- **`BUY-3`** Each store transaction is accepted once across all users; the first to report it fixes its owner and credits, and anyone else's report is refused.
  Status: Default (manager or implementing session; open to change) · Why: one purchase can't credit two accounts · Enforced: Server: database rule UNIQUE (store, transaction_id) in backend/apps/api/migrations/0001_initial.sql; backend/apps/api/src/routes/purchases.ts (verifyPurchase) · Source: backend/DESIGN.md › How "once" holds
- **`BUY-4`** A purchase is credited and refunded at most once, in any order; a refund that arrives first blocks the credit for good.
  Status: Default (manager or implementing session; open to change) · Why: the app's report, the store notification and a refund can arrive in any order or at once · Enforced: Server: backend/apps/api/src/account/UserAccount.ts (creditPurchase, reversePurchase) · Source: backend/DESIGN.md › How "once" holds
- **`BUY-5`** The development server accepts only test (sandbox) purchases and the production server only real ones, except the production switch for listed test accounts (`BUY-26`).
  Status: Default (manager or implementing session; open to change); changed 2026-11-20 by the owner's decision behind `BUY-26` · Why: a production build pointed at the development server can't add credits there · Enforced: Server: backend/apps/api/src/purchases/service.ts (acceptedEnvironment, environmentAllowed); backend/apps/api/src/routes/purchases.ts (verifyPurchase, purchasesWebhook) · Source: backend/DESIGN.md › Purchases (step 5) › Decisions
- **`BUY-6`** Credits are bought only through the store's in-app purchase at the store's own price; the app never shows its own price or a link to pay elsewhere, and hides packs the store doesn't sell.
  Status: Default (manager or implementing session; open to change) · Why: App Store and Play rules on digital goods · Enforced: In the app: src/purchases/flow.ts (packOffers); src/components/BuyCredits.tsx · Source: README.md › Buying credits
- **`BUY-7`** A pack's credits are fixed once it exists, and a purchase keeps the credits it had when first recorded; a product sold without a pack is held, not credited, until support grants it.
  Status: Default (manager or implementing session; open to change) · Why: a report of an old purchase must always give the same amount · Enforced: Server: backend/apps/api/src/purchases/service.ts (applyPurchase) · Source: backend/README.md › Credit packs; backend/DESIGN.md › How "once" holds
- **`BUY-8`** A refund or revocation at the store takes the credits back, even into a negative balance.
  Status: Default (manager or implementing session; open to change) · Why: credits already spent must still be repaid · Enforced: Server: backend/apps/api/src/purchases/service.ts (applyReversal) · Source: backend/README.md › Webhook
- **`BUY-9`** Today a refund that Apple later cancels does not give the credits back automatically; support can grant them by hand.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#1-server)) · Why: automating it means un-blocking the reversal in the ledger; "worth doing if it happens" · Enforced: Server: backend/apps/api/src/routes/purchases.ts (purchasesWebhook ignores the event) · Source: backend/DESIGN.md › Purchases (step 5) › Decisions, › Open
- **`BUY-10`** RevenueCat's notifications are checked by signature (within 5 minutes) before they are read, are limited to 64 KB, and each is handled once.
  Status: Default (manager or implementing session; open to change) · Why: forged or repeated notifications change nothing · Enforced: Server: backend/apps/api/src/purchases/revenuecat.ts (SIGNATURE_HEADER, SIGNATURE_TOLERANCE_SECONDS); backend/apps/api/src/routes/purchases.ts (purchasesWebhook) · Source: backend/README.md › Webhook
- **`BUY-11`** A suspended account can't buy; a store notification for it is held and credited after the account is restored.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: Server: backend/apps/api/src/routes/purchases.ts (verifyPurchase); backend/apps/api/src/purchases/service.ts (applyPurchase) · Source: backend/DESIGN.md › Purchases (step 5) › Decisions
- **`BUY-12`** The payments library gets Qutai's account id after sign-in, switches on another sign-in and logs out on sign-out; purchases are never offered while signed out.
  Status: Default (manager or implementing session; open to change); switched on 2026-11-20 · Why: anonymous payment ids can't be matched to an account · Enforced: In the app: src/purchases/revenuecat.ts (setUser: configure once signed in, logIn, logOut; a failed logIn leaves no account set), src/purchases/index.ts (follow) · Tests: scripts/credits-tests/purchases.test.ts (RevenueCat: configured only once signed in…, a failed switch…) · Source: backend/DESIGN.md › What the app-side purchase screen must do; README.md › Buying credits
- **`BUY-13`** RevenueCat is set to keep each purchase with its original account ("Keep with original App User ID") and the packs are not set up as RevenueCat's own in-app currency.
  Status: Default (manager or implementing session; open to change) · Why: "Transfer" would move a purchase to another user; the in-app currency was rejected because Qutai needs holds and negative balances next to the balance · Source: backend/DESIGN.md › RevenueCat's own in-app currency; backend/README.md › What to set up in RevenueCat
- **`BUY-15`** Builds without pro mode must not contain the payments library at all: no native code, no billing permission, no JavaScript, checked in both APKs.
  Status: Owner, 2026-11-16 · Why: the open-source build stays free of store and billing code · Enforced: plugins/proBuild.js (the one pro test), react-native.config.js (not autolinked on Android or iOS), metro.config.js (empty module), plugins/withProPurchases.js (BILLING `tools:node="remove"` without pro mode; the autolinking cache dropped when the build kind changes), scripts/build/release.mjs with scripts/build/bundleCheck.mjs (bundle and AAB manifest checked in every package) · Tests: node --test scripts/build/bundleCheck.test.mjs; checked 2026-11-20 without building through `npx expo config --type introspect` and `npx expo-modules-autolinking react-native-config` in both variants · Not checked yet: the APKs themselves (`aapt`, `apkanalyzer`; docs/test-checklist.md § 30) · Source: README.md › Buying credits; 1e08428
- **`BUY-16`** Fake purchases are a deliberate temporary stand-in: with fake purchases switched on at a local server, Buy adds credits without any store and nothing is charged; they must be removed before launch.
  Status: Owner, 2026-11-17 · Why: the owner said "make the payment step fake for now, add it to the things to fix later" so the whole flow can be tested before RevenueCat exists · Enforced: Server: backend/apps/api/src/purchases/fake.ts (fakePurchase); In the app: src/purchases/index.ts (fakePurchasesOn, purchaseStore) · Source: [TODO.md](../../TODO.md#before-launch-remove-fake-purchases); memory fix-before-launch; 6c5d76b, e521581
- **`BUY-17`** Fake purchases exist only on a development server with the switch set exactly to true; anywhere else the address answers "not found" like one that doesn't exist, and the production server logs an error if the switch is ever present.
  Status: Default (manager or implementing session; open to change) · Why: fake credits must never reach production · Enforced: Server: backend/apps/api/src/purchases/fake.ts (fakePurchasesEnabled, fakePurchasesMisconfigured); backend/apps/api/src/index.ts · Source: backend/README.md › Fake purchases
- **`BUY-18`** Today fake purchases allow 10 new per account in any 24 hours and 30 a minute across everyone, one pack each, active packs only, each test transaction credited once.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Double charge and payments) · Why: limits a test account to 10 × the largest pack a day · Enforced: Server: backend/packages/shared/src/purchases.ts (FAKE_PURCHASES_PER_DAY); backend/apps/api/src/purchases/fake.ts (FAKE_PURCHASES_PER_MINUTE) · Source: backend/README.md › Fake purchases › Limits
- **`BUY-19`** Fake purchases are recorded as store "fake" with no revenue, and the admin panel leaves them out of revenue, credits sold and the payments export and shows a banner while they exist.
  Status: Default (manager or implementing session; open to change) · Why: keep test data out of business figures · Source: backend/README.md › Fake purchases › Admin panel
- **`BUY-21`** Before launch: connect RevenueCat and the stores and buy a pack in the sandbox; remove or hard-disable every fake path on the server and in the app (including its texts in ten languages and tests); purge fake purchase rows and the credits they gave on every database that had them; drop "fake" from the database's store list; re-check the panel's figures; make sure the fake switch exists in no production or deployed development server.
  Status: Owner, 2026-11-17 · Why: fake credits must never reach a store release or production · Source: [TODO.md](../../TODO.md#before-launch-remove-fake-purchases)
- **`BUY-22`** Deleting an account keeps its purchase records without the user and asks RevenueCat to delete its customer record (a failure is logged and doesn't stop the deletion).
  Status: Default (manager or implementing session; open to change) · Why: tax law requires the sales record; privacy · Enforced: Server: backend/apps/api/src/purchases/service.ts (forgetPurchasesCustomer) · Source: backend/README.md › Records and reporting
- **`BUY-23`** Purchase logs never carry a transaction id, product id, email or key, and nothing else from RevenueCat (emails, attributes, country) is stored.
  Status: Default (manager or implementing session; open to change) · Why: privacy; a test checks it · Enforced: Server: backend/apps/api/src/lib/log.ts (ALLOWED, sanitize) · Source: backend/README.md › Records and reporting
- **`BUY-24`** Today Qutai only asks RevenueCat to delete a deleted user's customer record; whether to require more is open.
  Status: Waiting for the owner (backend/DESIGN.md › Purchases (step 5) › Open for the owner) · Why: RevenueCat's documents don't say what they keep after a deletion · Source: backend/DESIGN.md › Purchases (step 5) › Open
- **`BUY-25`** Today the packs are decided (Android first: `com.sonsuzdongu.qutai.packs.100`, `.500`, `.1000` for 100, 500 and 1000 credits; suggested prices 0.99, 4.99, 9.99 USD) but the RevenueCat project, the Play products, the store notifications and the packs in the panel are still being created; no trial credits.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#2-app)); packs decided 2026-11-20 · Why: the owner's business decisions and set-up · Source: TODO.md › 2. App, › Pending decisions; backend/DEPLOY-prod.md › Satın almaları açmak; backend/README.md › What to set up in RevenueCat
- **`BUY-26`** A production setting (panel › Settings › Test purchases in production, `sandbox_purchases`) lets store test (sandbox) purchases add credits on the production server: off by default, only while on and only for the accounts it lists (user ids; emails are resolved to ids when saved; an empty list credits nobody), read at every purchase without a cache, for the app's report and the store notification alike; such purchases stay marked sandbox in the purchase record and the ledger reference (`<store>:sandbox:<id>`), are logged, never count as revenue or credits sold, and are taken back on refund even after the switch is off. A red banner shows on the Overview while it is on.
  Status: Owner, 2026-11-20 (no separate dev server on Cloudflare; "a production setting that lets test purchases be credited, which I can switch on and off"); the narrowing (listed accounts, logs, never revenue) is the implementing session's default · Why: test credits are free AI on the owner's bill, so the hole is kept as small as possible · Enforced: Server: backend/packages/shared/src/purchases.ts (readSandboxPurchases, checkSandboxPurchases, paidSql), backend/apps/api/src/purchases/service.ts (environmentAllowed, sandboxPurchases, purchaseRef), backend/apps/api/src/routes/purchases.ts (reversalAllowed), backend/apps/admin/worker/api/settings.ts (resolveSandboxAccounts), overview.ts, payments.ts · Tests: backend/apps/api/test/sandbox-purchases.test.ts, backend/apps/admin/test/sandbox-purchases.test.ts · Source: backend/README.md › Test purchases in production; backend/DESIGN.md › Test purchases in production
- **`BUY-27`** The app buys through RevenueCat only when the build is pro, has RevenueCat's public key for the platform, has the SDK's native module and the server says store mode; Android first, iOS later through the same code once its key and products exist. Packs are the server's product ids that the store returns, with the store's localised price; RevenueCat consumes them (product type Consumable) so they can be bought again; no RevenueCat offering is needed.
  Status: Owner, 2026-11-20 (Android first); the conditions are the implementing session's default · Why: one code path for both stores; the server stays the list of what is sold · Enforced: In the app: src/purchases/index.ts (purchaseStore, revenueCat, revenueCatSdk), src/purchases/revenuecat.ts, src/purchases/flow.ts (packOffers) · Tests: scripts/credits-tests/purchases.test.ts · Source: README.md › Buying credits
- **`BUY-28`** Every ending of a purchase is said plainly and none loses or doubles a pack: cancelled, pending (Play's cash and delayed payments: credited when the store completes it; open Qutai within three days), already owned (the earlier purchase is looked for and reported), billing unavailable on the device (checked before showing Buy), not allowed, network, product unavailable, store problem, paid but not yet confirmed (kept and reported again), held or refused (support). A purchase the phone never got to report is found in the store's list of the customer's recent one-time purchases (30 days, at most 10) and reported; what the server answered for good is remembered on the phone (the last 200 ids) and a credit the server had already given isn't counted again. The store's list is read on the buy screen, on "Check for missing credits", after "already owned" or a purchase without an id, and at app start only on a phone that has used the buy screen.
  Status: Default (implementing session, 2026-11-20) · Why: a consumable must not be lost or credited twice, and RevenueCat should not be contacted at start on phones that never buy · Enforced: In the app: src/purchases/flow.ts (recover, reportAll, settle, afterLost), src/purchases/index.ts (settledStorage, noteStoreUsed, reportPendingPurchases), src/components/BuyCredits.tsx (statusFor, canPay) · Tests: scripts/credits-tests/purchases.test.ts (lost answer, already owned, held, retry tests)
- **`BUY-29`** What the app gives RevenueCat: the Qutai account id as App User ID, the pack product ids, the purchase, and requests for the customer's recent purchases; diagnostics and automatic device-identifier collection are off and no email, name or attributes are set. RevenueCat's SDK also sends, with each request, the IP address and basic device and app information (platform, versions, store country and locale).
  Status: Default (implementing session, 2026-11-20) · Why: the least RevenueCat needs to sell and confirm a pack · Enforced: In the app: src/purchases/revenuecat.ts (configure) · Tests: scripts/credits-tests/purchases.test.ts (configured with diagnostics and device-identifier collection off) · Privacy policy: the pro policy names RevenueCat, the account number and the purchase record; it doesn't mention the IP and device information or the price and recent-purchase lookups: proposed sentence for the owner in [41](41-legal-texts.md)'s open list (not edited, it would need another legal bump)
- **`BUY-30`** A pro Android store package must be able to sell credits: `scripts/build/release.mjs` reads `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`) from the environment or `.build.local.env` and stops without it unless `--without-purchases` is given; a pro IPA uses `EXPO_PUBLIC_REVENUECAT_IOS_KEY` when present; plain builds get both keys empty; every package's bundle and the AAB's manifest are checked against `BUY-15`.
  Status: Owner's task, 2026-11-20 · Why: a pro build without purchases by accident would silently sell nothing · Enforced: scripts/build/release.mjs, scripts/build/bundleCheck.mjs (bundleProblems, manifestProblems) · Tests: node --test scripts/build/bundleCheck.test.mjs
- **`BUY-31`** The order of the packs is set in the admin panel at any time (Prices and packs › a pack's **Order…**; audited, with a reason): one number per product, smaller first, applied to every store's row of that product id so it has one place in both stores; ties keep the order the packs were added in; credits never change. The app shows the packs in the server's order (`GET /config`, `sort_order` then id) and never re-sorts, so no app change is needed; a change reaches phones within about two minutes (`/config` is cached 60 s by HTTP and 60 s in the app).
  Status: Owner, 2026-11-20 ("backend'de, bu pack'leri sort edebilmek istiyorum, önyüzde de bu sort edilmiş haliyle göstermek istiyorum", without touching the app); one change moving both stores' rows is the implementing session's default · Why: production listed 500, 100, 1000 and the order could only be set when a pack was added · Enforced: Server: backend/apps/admin/worker/api/actions.ts (setPackOrder), backend/apps/api/src/routes/config.ts (ORDER BY sort_order, id); panel: backend/apps/admin/src/screens/Prices.tsx (PackOrderDialog); In the app: src/purchases/flow.ts (packOffers keeps the order) · Tests: backend/apps/admin/test/actions.test.ts (changes a pack's order in both stores…)

## Details

**In the app**

- (was `BUY-14`) The app saves the store transaction before reporting it, asks again after the server's wait (at most 15 s, three tries), then keeps it and reports it later. Why: "a crash or a lost connection right now can't lose it". Where: In the app: src/purchases/flow.ts (createPurchaseFlow); src/purchases/index.ts (reportPendingPurchases); README.md › Buying credits.
- (was `BUY-20`) The app switches to the fake store because the server's configuration says so, not because of a build setting. Why: no build flag needed. Where: In the app: src/purchases/index.ts (fakePurchasesOn); README.md › Fake purchases.
- No "Restore purchases" for consumables (checked 20 Nov 2026): Google Play's billing guide asks apps to process purchases on start and resume, not for a restore button; RevenueCat says `restorePurchases` should only follow a user's tap and consumables restore only with custom App User IDs. "Check for missing credits" covers it (`BUY-28`).
- Android `launchMode` stays `singleTask` although RevenueCat says it can cancel a purchase when the user leaves and returns through the launcher icon (nothing is charged then); `singleTop` is the fix if it shows up. Where: README.md › Buying credits › Android launch mode; docs/native-code.md.

## Limits and what is not built

- No real (sandbox) purchase has been made yet: the RevenueCat project and the Play products are being created; the
  steps to try are in [docs/test-checklist.md](../test-checklist.md) § 30. iOS isn't connected (no key, no App Store
  products).
- On Android the reported transaction id should be Google Play's order id; to be confirmed with the first sandbox
  purchase. If it is missing, the app looks for it in the store's list and the store notification credits it.
- The admin panel has no refund action; test credits are taken back with "Remove credits" or by resetting the account.
- Before release: check the stores' current rules on digital goods and outside payments; update privacy texts and the
  Play Data safety form for purchase history (planned).

## Where it lives

- App: `src/purchases/` (`index.ts`, `flow.ts`, `revenuecat.ts`, `fake.ts`, `unavailable.ts`),
  `src/components/BuyCredits.tsx`; build: `plugins/proBuild.js`, `plugins/withProPurchases.js`, `react-native.config.js`,
  `metro.config.js`, `scripts/build/release.mjs`.
- Server: `backend/apps/api/src/purchases/`, `backend/apps/api/src/routes/purchases.ts`.
- Read next: [README.md](../../README.md) › Buying credits; [backend/README.md](../../backend/README.md) › Purchases (Flow,
  Webhook, Records and reporting, Test purchases in production, Fake purchases, Credit packs, What to set up);
  [backend/DEPLOY-prod.md](../../backend/DEPLOY-prod.md) › Satın almaları açmak; [backend/DESIGN.md](../../backend/DESIGN.md)
  › Purchases (step 5); [TODO.md](../../TODO.md#before-launch-remove-fake-purchases).

## Disagreements between sources

- backend/DESIGN.md › Merging two accounts relies on RevenueCat's default restore setting ("transfer to new App User ID") moving a receipt to the surviving account; backend/DESIGN.md › Purchases and backend/README.md tell the owner to set "Keep with original App User ID". The merge code resolves merged account ids itself, so it does not depend on either.
- backend/DESIGN.md › API Worker says purchase writes go through a queue; backend/DESIGN.md › How "once" holds says the first purchase write is direct (a queue can't refuse a second claimant). The code writes it directly.
- README.md › Fake purchases calls the limit a "daily allowance"; the server counts any 24 hours.
