# 35. Purchases

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Buying Qutai Credits in the official (pro) builds: packs sold as one-time ("consumable") in-app products on the App
Store and Google Play, checked through RevenueCat (a payments service that talks to both stores) before any credit is
added. No store is connected yet; until then a deliberate, temporary "fake purchases" mode lets the owner test the
whole flow on a local server.

## How it works

1. **Buy credits** opens from setup's account screen, Settings › Account › Qutai Credits and the "not enough credits"
   message. It shows the balance, what credits are, the packs the server offers for this phone's store with **the
   store's own price**, a store note, Terms and Privacy, and **Check for missing credits**.
2. The planned real flow: the payments library is told the Qutai account id before anything is bought; after a
   purchase the store's transaction id is saved on the phone first, then reported to the server; the server asks
   RevenueCat itself and only then adds the pack's credits. If the report gets lost, RevenueCat's notification to the
   server credits it anyway, and the phone reports saved purchases again when Buy credits opens, on "Check for missing
   credits" and after sign-in.
3. A refund at the store takes the credits back; the balance may go below zero, which stops spending until the user
   buys again.
4. Today every build uses an "unavailable" store: Buy credits shows the balance and packs and says buying isn't
   available in this build.
5. Fake purchases (temporary): when the owner's local server runs with fake purchases on, Buy credits says "Test
   mode: nothing is charged" and each pack has a **Get (test)** button that adds its credits without any store.
6. There is no "Restore purchases" button: one-time products can't be restored at the stores and credits live in
   Qutai's ledger; "Check for missing credits" is the recovery path.

## The rules

- **`BUY-1`** Payments go through RevenueCat (its app library, server-side lookups and one signed notification address), behind an interface so moving to the stores' own APIs later is a change in one place.
  Status: Owner, 2026-11-15 · Why: least work and risk; the trade-off (a third party sees purchase data and takes a share of revenue; the store APIs mean two stores' edge cases are Qutai's) is in backend/DESIGN.md › Purchases · Enforced: Server: backend/apps/api/src/purchases/verifier.ts (purchaseVerifier), revenuecat.ts (revenueCatVerifier) · Source: backend/DESIGN.md › Decisions, › Purchases; 2d44e7b
- **`BUY-2`** Credits are added only after the server has looked the purchase up with RevenueCat itself; the app's report is never trusted.
  Status: Owner, date not recorded · Why: an app's claim can be forged · Enforced: Server: backend/apps/api/src/routes/purchases.ts (verifyPurchase); backend/apps/api/src/purchases/service.ts (applyPurchase) · Source: docs/server-plan.md › Rules that must hold; backend/README.md › Purchases › Flow
- **`BUY-3`** Each store transaction is accepted once across all users; the first to report it fixes its owner and credits, and anyone else's report is refused.
  Status: Default (manager or implementing session; open to change) · Why: one purchase can't credit two accounts · Enforced: Server: database rule UNIQUE (store, transaction_id) in backend/apps/api/migrations/0001_initial.sql; backend/apps/api/src/routes/purchases.ts (verifyPurchase) · Source: backend/DESIGN.md › How "once" holds
- **`BUY-4`** A purchase is credited and refunded at most once, in any order; a refund that arrives first blocks the credit for good.
  Status: Default (manager or implementing session; open to change) · Why: the app's report, the store notification and a refund can arrive in any order or at once · Enforced: Server: backend/apps/api/src/account/UserAccount.ts (creditPurchase, reversePurchase) · Source: backend/DESIGN.md › How "once" holds
- **`BUY-5`** The development server accepts only test (sandbox) purchases and the production server only real ones.
  Status: Default (manager or implementing session; open to change) · Why: a production build pointed at the development server can't add credits there · Enforced: Server: backend/apps/api/src/purchases/service.ts (acceptedEnvironment); backend/apps/api/src/routes/purchases.ts (verifyPurchase, purchasesWebhook) · Source: backend/DESIGN.md › Purchases (step 5) › Decisions
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
  Status: Default (manager or implementing session; open to change) · Why: anonymous payment ids can't be matched to an account · Enforced: In the app: src/purchases/revenuecat.ts (written and tested against a fake library, not switched on) · Source: backend/DESIGN.md › What the app-side purchase screen must do; README.md › The store today
- **`BUY-13`** RevenueCat is set to keep each purchase with its original account ("Keep with original App User ID") and the packs are not set up as RevenueCat's own in-app currency.
  Status: Default (manager or implementing session; open to change) · Why: "Transfer" would move a purchase to another user; the in-app currency was rejected because Qutai needs holds and negative balances next to the balance · Source: backend/DESIGN.md › RevenueCat's own in-app currency; backend/README.md › What to set up in RevenueCat
- **`BUY-15`** Builds without pro mode must not contain the payments library at all: no native code, no billing permission, no JavaScript, checked in both APKs.
  Status: Owner, 2026-11-16 · Why: the open-source build stays free of store and billing code · Enforced: Designed, not built (the library isn't added yet) · Source: README.md › Buying credits, step 1; 1e08428
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
- **`BUY-25`** Today no packs, prices, trial credits, RevenueCat project, store products or store notifications exist.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#2-app)) · Why: the owner's business decisions and set-up · Source: TODO.md › 2. App, › Pending decisions; backend/README.md › What to set up in RevenueCat

## Details

**In the app**

- (was `BUY-14`) The app saves the store transaction before reporting it, asks again after the server's wait (at most 15 s, three tries), then keeps it and reports it later. Why: "a crash or a lost connection right now can't lose it". Where: In the app: src/purchases/flow.ts (createPurchaseFlow); src/purchases/index.ts (reportPendingPurchases); README.md › Buying credits.
- (was `BUY-20`) The app switches to the fake store because the server's configuration says so, not because of a build setting. Why: no build flag needed. Where: In the app: src/purchases/index.ts (fakePurchasesOn); README.md › Fake purchases.

## Limits and what is not built

- The payments library isn't added and the RevenueCat store isn't switched on; no sandbox purchase has been made
  (planned, [README.md](../../README.md) › Buying credits, steps 1–4).
- On Android the reported transaction id should be Google Play's order id; to be confirmed with the first sandbox
  purchase. If it is missing, the store notification credits the purchase.
- The admin panel has no refund action; test credits are taken back with "Remove credits" or by resetting the account.
- Before release: check the stores' current rules on digital goods and outside payments; update privacy texts and the
  Play Data safety form for purchase history (planned).

## Where it lives

- App: `src/purchases/` (`index.ts`, `flow.ts`, `revenuecat.ts`, `fake.ts`, `unavailable.ts`),
  `src/components/BuyCredits.tsx`.
- Server: `backend/apps/api/src/purchases/`, `backend/apps/api/src/routes/purchases.ts`.
- Read next: [README.md](../../README.md) › Buying credits; [backend/README.md](../../backend/README.md) › Purchases (Flow,
  Webhook, Records and reporting, Fake purchases, Credit packs, What to set up); [backend/DESIGN.md](../../backend/DESIGN.md)
  › Purchases (step 5); [TODO.md](../../TODO.md#before-launch-remove-fake-purchases).

## Disagreements between sources

- backend/DESIGN.md › Merging two accounts relies on RevenueCat's default restore setting ("transfer to new App User ID") moving a receipt to the surviving account; backend/DESIGN.md › Purchases and backend/README.md tell the owner to set "Keep with original App User ID". The merge code resolves merged account ids itself, so it does not depend on either.
- backend/DESIGN.md › API Worker says purchase writes go through a queue; backend/DESIGN.md › How "once" holds says the first purchase write is direct (a queue can't refuse a second claimant). The code writes it directly.
- README.md › Fake purchases calls the limit a "daily allowance"; the server counts any 24 hours.
