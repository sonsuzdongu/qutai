# 42. The website

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Qutai's marketing site lives in `webpage/`, a separate project inside this repository. It describes the app, compares it with other mobile browsers, shows the app's privacy policy, and hosts the page that the sign-in email's link opens.

## How it works

1. The site is a single long page in English (`/en/`) and Turkish (`/tr/`). It is written in React, turned into static HTML at build time, and served by Cloudflare Workers. A small Worker answers only `/`: it sends the visitor to `/en/` or `/tr/` by the `lang` cookie, then by the browser's language, and otherwise to English.
2. The page has these parts: the hero, a statement beside a phone mock drawn from the app's own strings and colours, scenarios, memory, privacy, the browser, a comparison table with eight mobile browsers, getting started, open source, status, and the footer. The illustrations are robot "miniature" paintings (`webpage/ART.md`).
3. The app's privacy policy has its own pages (`/en/privacy-policy/`, `/tr/privacy-policy/`). The text is copied from the store build's policy (`src/legal/proDocuments.ts`) with `npm run legal`, and `npm run check` fails when the copy no longer matches the app.
4. `/intent/sign-in/email?token=…` is where the sign-in email links, because mail apps such as Gmail don't make a `qutai://` link tappable. On a phone the page opens Qutai once by itself and always shows an "Open Qutai" button. On a computer it says the link is for the phone. It signs nothing in, removes the token from the address bar, and logs nothing. The Worker also serves the App Link and Universal Link files (404 until they are set up).
5. The site loads nothing from other websites (no fonts, analytics or CDNs), and its only cookie is `lang`.
6. When an app feature lands, a session updates the site and the comparison column, for example d14bd7a, 0d51a9e, 2767fae, 3dc3119 and 441b6d1.

## The rules

- **`WEB-1`** The website states only true facts about the app. Qutai's comparison column follows the code and the owner's checklist, and missing features (sync, desktop, store release today) stay "no".
  Status: Default (manager or implementing session; open to change) · Why: "Keep it honest". The paid Qutai service is described as it is, not as "not offered yet" (0d51a9e) · Source: webpage/README.md › Updating the comparison; 33e911e ("an honest status")
- **`WEB-2`** Each competitor cell comes only from the vendor's own current pages about its mobile app, with the URL and the date it was checked. A cell no such page settles is "unknown" and shows as "Not confirmed", never "No". A desktop-only feature is "no" with a note, and notes are in our own words, never copied text.
  Status: Default (manager or implementing session; open to change) · Why: claims about competitors must be checkable and fair · Source: webpage/README.md › Updating the comparison; 670c6dd, a988ff9
- **`WEB-4`** Other products' names appear in plain text only, without logos or brand colours. A "Report a correction" link goes to the repository's issues.
  Status: Default (manager or implementing session; open to change) · Why: product names are their owners' trademarks · Source: webpage/README.md
- **`WEB-5`** The site makes no requests to other websites, and its only cookie is `lang`, which the language switch sets.
  Status: Default (manager or implementing session; open to change) · Why: the privacy story of the app applies to its site too · Enforced: In the app: webpage `npm run check` (fails on any third-party load), `_headers` Content-Security-Policy · Source: webpage/README.md › Privacy of the site itself
- **`WEB-6`** The site's privacy policy is the app's own store-build text, never edited on the site. After the app's policy changes, someone runs `npm run legal` and rebuilds.
  Status: Default (manager or implementing session; open to change) · Why: one source for the policy. This replaced a link to a .ts file on GitHub · Enforced: In the app: webpage `npm run check` (fails when the copy differs) · Source: 06b800c
- **`WEB-7`** The sign-in link page never uses up the one-time token, signs nothing in, removes the token from the address bar and history, and logs nothing. It answers with no-store, no-referrer, noindex and its own Content-Security-Policy.
  Status: Default (manager or implementing session; open to change) · Why: the token is a single-use sign-in secret, so a mail scanner opening the link must not use it up · Enforced: In the app: webpage/worker/intent.ts · Source: 2a06fbd
- **`WEB-8`** Demo videos are real recordings made on brand-free demo sites, under written honesty rules. Qutai is pronounced "Kutay", and Turkish suffixes follow that pronunciation (Qutai’ı, Qutai’a, Qutai’ın).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded beyond honesty and correct pronunciation · Source: dd36792, 52347da, 8460500
- **`WEB-9`** The brand line and page title are "Qutai: Agentic Browser". The site always uses the light parchment look and has no Trademarks links.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 3ea22b7, eb6e651, f25fa0b, a1d1ca6
- **`WEB-11`** Today three sentences on the site are out of date: "No account needed and no sync", the planned end-to-end sync, and the comparison's sync note. The owner updates them.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: listed among the set-up tasks only the owner can do · Source: TODO.md › Set-up only the owner can do

## Details

- (was `WEB-3`) A competitor without a mobile browser, or one shutting down, is listed under "excluded" with the reason (for example Arc Search and Hyperweb), not in the table. Where: webpage/README.md; webpage/src/data/comparison.ts (`EXCLUDED`).
- (was `WEB-10`) A feature still waiting for an owner decision is left off the website (for example the Cloudflare Workers AI hint on 16 Nov). Why: the site must not promise what may change (WEB-1). Where: d14bd7a and its hand-over note.

## Limits and what is not built

- (planned) The first deploy: the owner sets `SITE_URL` and the domain in `wrangler.jsonc`, then runs `npm run deploy`.
- The comparison table has about 16 rows. Cells that no primary source settles stay "Not confirmed".

## Where it lives

- `webpage/README.md` (read first), `webpage/src/data/comparison.ts`, `webpage/src/i18n/en.ts` and `tr.ts`, `webpage/worker/`, `webpage/ART.md`

## Disagreements between sources

- TODO.md › Contacts still says to add contacts to the website, but 3dc3119 (19 Nov) added contacts, scripts, page styles, the cookie list and image filters to the site. The TODO item looks stale.
- The owner's note says real domains stay out of commits, yet README.md and some commit messages (75e2294, 1c50bc1) contain the website's public domain. The note was written about the private tunnel address, and no source says whether the public site domain is exempt.
