# 41. Legal texts

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The privacy policy and terms of use shown in the app (one set for the open-source build, another for pro-mode builds), when users must accept them again, and the open-source licences screen.

## How it works

1. There are two documents, a Privacy Policy and Terms of Use. People wrote them in English and Turkish; there is no machine translation. In the other eight interface languages the English text appears under the note "This document is available in English and Turkish. The English version is shown below."
2. Each build type has its own pair. The open-source build uses `src/legal/documents.ts`, which says Qutai has no servers of its own. Pro-mode builds (with accounts and Qutai Credits) use `src/legal/proDocuments.ts`, which describes the account, credits, purchases, server backups, who processes data, how long it is kept, and who is responsible, with a contact address.
3. Each pair has a version number. Today the open-source version is **3** and the pro version is **5**, both dated 19 Nov 2026.
4. The first time Qutai is set up, the "Privacy and terms" step must be accepted. Qutai stores the version that was accepted.
5. On each launch, if the accepted version is lower than the current one, Qutai shows only the legal step, titled "We updated our privacy policy and terms". The browser stays closed until the user accepts.
6. A change to the pro texts never asks users of the open-source build again, and a change to the open-source texts never asks pro users again.
7. Ad-blocking filter lists are downloaded only after the user has accepted the terms at least once.
8. Settings › About opens the full texts with their "Updated" date, and Settings › About › Open source licences lists every third-party component in the app (134 entries) with its version, licence and platform. The list is searchable, and tapping an entry shows the full licence text.
9. Version history:
   - Open source: 1 on 14 Nov, 2 on 16 Nov (what actually leaves the phone, and what the app enforces about passwords, cards, IBANs and ID numbers), 3 on 19 Nov (contacts, page styles, the cookie list).
   - Pro: 2 on 16 Nov (its own texts), 3 on 17 Nov (server backups), 4 on 17 Nov (who is responsible, contact, sign-in by email, purchases, processors, IP addresses and logs, retention, security), 5 on 19 Nov (contacts).

## The rules

- **`LEGAL-1`** Anyone whose accepted legal version is lower than the current one must accept again before the browser opens.
  Status: Default (manager or implementing session; open to change) · Why: users must have accepted the current text · Enforced: In the app: App.tsx (`onboarding` = not onboarded or `legalAcceptedVersion < LEGAL_VERSION`), src/components/Onboarding.tsx (`legalOnly`, stores `legalAcceptedVersion: LEGAL_VERSION`), src/storage/settings.ts (default 0) · Source: src/legal/documents.ts (comment above `OPEN_SOURCE_LEGAL_VERSION`)
- **`LEGAL-2`** Today the open-source legal version is 3 and the pro legal version is 5, both dated 2026-11-19.
  Status: Owner, 2026-11-19 · Why: the owner approved the bump for the new contacts section, which also covered page styles and the cookie list · Enforced: In the app: src/legal/documents.ts (`OPEN_SOURCE_LEGAL_VERSION`, `PRO_LEGAL_VERSION`, `LEGAL_VERSION`, `LEGAL_UPDATED`), src/legal/proDocuments.ts (`PRO_LEGAL_UPDATED`) · Source: 040c537
- **`LEGAL-3`** Pro-mode builds show their own texts with their own version, and changing one set never re-asks users of the other build.
  Status: Default (manager or implementing session; open to change) · Why: the pro texts describe a server, an account, credits and purchases that the open-source build does not have · Enforced: In the app: src/legal/documents.ts (`LEGAL_VERSION` chosen by `accountsEnabled`, `legalDocument`) · Source: 1e08428
- **`LEGAL-4`** The version goes up when the policy or terms change in substance. Only the owner decides a bump: a session that changes the wording writes "Legal version NOT bumped" and leaves it.
  Status: Owner, 2026-11-19 · Why: every bump interrupts every user with a re-acceptance screen, so it is the owner's call ("needs the owner's bump") · Source: 9c4ef02, cc45a62, 589d311, 040c537
- **`LEGAL-5`** Today the privacy policies (en and tr, open source and pro) already list "the result of a script you approved on a page" among what the AI receives, but the version was not raised for it, so users have not been asked to accept it.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: left for the owner on purpose (LEGAL-4) · Source: 589d311; TODO.md › Page customisation, step two — owner decisions
- **`LEGAL-6`** Today the privacy policies do not mention apps inside Qutai. The proposed sentence: apps are stored only on the phone, and an app's code (not its data) and its error messages go to the AI provider when the user asks Qutai to make or fix it.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: reason not recorded · Source: TODO.md › Apps inside Qutai — owner decisions
- **`LEGAL-7`** The legal texts describe only what the app actually does, checked against the code. When something about what leaves the phone changes, the text changes and the version goes up.
  Status: Default (manager or implementing session; open to change) · Why: the policy is a promise to users. Version 2 corrected claims that had become incomplete (OpenRouter, the user's own server, memory sent with every request, the geocoder, speech services, filter-list downloads) · Source: 72302a6 ("verified in code"), d9e446b
- **`LEGAL-8`** The open-source policy promises:
  - no servers of Qutai's own, and no analytics, tracking or advertising;
  - requests go with the user's own key straight to the provider they chose;
  - search suggestions are never sent from incognito tabs;
  - speech goes to an online speech service only after a one-time agreement, and never in incognito;
  - filter-list downloads carry nothing about the user's browsing;
  - the assistant gets cookie names, sites and settings, never their values.
  Status: Default (manager or implementing session; open to change) · Why: these are what the code does; see the privacy, AI and content sections for each enforcement point · Enforced: In the app: each claim in its own area (not repeated here) · Source: src/legal/documents.ts (`DOCUMENTS.en.privacy`)
- **`LEGAL-9`** Before Qutai's server goes live for everyone, every "no servers of ours" sentence in the onboarding, the legal texts, store listings and README must be rewritten and the legal version raised. Today pro builds already use their own texts without that claim, and the open-source build keeps it.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#qutai-credits-paid-usage)) · Why: the claim is true for the open-source build, but not once requests can pass through Qutai's server · Source: 3f340ce; TODO.md › Qutai Credits (paid usage)
- **`LEGAL-10`** A lawyer reviews the open-source and pro texts (KVKK/GDPR, Turkish consumer law on digital content) before any store release. Today they are unreviewed drafts written from the code.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#qutai-credits-paid-usage)) · Why: the texts are not legal advice. The first commit already called them drafts needing legal review · Source: 72302a6; TODO.md › Other ("Before release: legal review"); owner's open question 21
- **`LEGAL-11`** Today the pro terms say that credits have no cash value, cannot be transferred, are refunded only as the law or the store requires (a refund can make the balance negative), and are lost when the account is deleted. Whether credits expire is left out on purpose.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#qutai-credits-paid-usage)) · Why: a session wrote these business terms. The owner asked to confirm or change them later (open questions 4 and 5) · Source: 1e08428; src/legal/proDocuments.ts (Qutai Credits); owner's open questions note
- **`LEGAL-12`** The legal texts exist only in English and Turkish. The other eight languages show English with a translated note. Today there are no human translations.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#other)) · Why: legal texts are not machine-translated. The TODO says to translate after the lawyer's review, if wanted (open question 25) · Enforced: In the app: src/legal/documents.ts (`legalDocument`, `englishOnly`) · Source: TODO.md › Other
- **`LEGAL-13`** Turkish legal texts address the user as "siz". Short button labels keep the bare imperative ("Kabul et ve devam et").
  Status: Owner, 2026-11-16 · Why: the app mixed "sen" and "siz", and the owner picked "siz" · Source: 9cea977; owner's memory note on Turkish "siz"
- **`LEGAL-14`** Ad-blocking filter lists are downloaded only after the terms have been accepted at least once.
  Status: Default (manager or implementing session; open to change) · Why: a download to a third party should happen only after the user has seen the policy that describes it · Enforced: In the app: src/components/SettingsModal.tsx (`allowed={settings.blockAds && settings.legalAcceptedVersion > 0}`) · Source: e677bac
- **`LEGAL-15`** Settings › About › Open source licences lists every third-party component whose code or assets ship in the app, with its full licence text. The list (`src/legal/licences.json`) is committed and generated again by hand (`node scripts/generate-licences.js`) after a dependency is added, removed or upgraded.
  Status: Default (manager or implementing session; open to change) · Why: licences require their notices to ship. The list is built from the real Android and iOS bundles, the autolinked native modules and a manual list (PDF.js decoders, SQLite, Skia and its libraries, Gradle and CocoaPods libraries), so nothing shipped is missed · Source: 2275af2; README.md › License
- **`LEGAL-18`** Qutai's code is Apache-2.0. The licence does not cover the Qutai name, logo or icons, and trademark statements do not name an owner.
  Status: Default (manager or implementing session; open to change) · Why: forks may reuse the code but must not pass themselves off as Qutai · Source: a7884fd, e966c69, 8a61c46; TRADEMARKS.md

## Details

**Licences screen**

- (was `LEGAL-16`) The licence script warns about a package without a licence file, a copyleft licence or one it doesn't recognise. Nothing copyleft-only ships: FreeType is used under its FTL licence and Zstandard under BSD. Where: README.md › License; 2275af2.
- (was `LEGAL-17`) Qutai's own local modules are not listed, and PDF.js parts that are not shipped (QCMS, QuickJS) are not listed either. Why: only third-party code that ships needs a notice. Where: 2275af2.

## Limits and what is not built

- (in progress) Wording on approved scripts (LEGAL-5) and on apps (LEGAL-6) is not yet covered by a version bump.
- (planned) Lawyer review, store privacy labels and the Google Play Data safety form.
- Licences: Gradle's transitive libraries are not listed (no Android SDK on the machine that generated the list), two Expo Android libraries' licences are unconfirmed, and the screen has not been tried on a phone.

## Where it lives

- `src/legal/documents.ts`, `src/legal/proDocuments.ts`, `src/legal/licences.json`
- `src/components/LegalScreen.tsx`, `src/components/LicencesScreen.tsx`, `src/components/Onboarding.tsx`, `App.tsx`
- `scripts/generate-licences.js`, `scripts/licences-manual.js`, `scripts/licences/`
- Read next: README.md › License; TODO.md › Decisions waiting for the owner

## Disagreements between sources

- TODO.md still lists the legal bump for the cookie wording, and the one for the contacts section, as "not done, on purpose". Both were done by 040c537 (open source 3, pro 5), so these TODO items are stale.
- TODO.md › Server backup says the pro version "went up twice (now 4)". It is now 5.
- The open-source policy says calendar events and location "are sent only when you confirm, each time". Since 289a687 the user can tick "Don't ask again" for reading the calendar and the location, and Settings says the data then goes to the AI without asking. The code allows the standing permission, so the policy sentence is stricter than the app.
