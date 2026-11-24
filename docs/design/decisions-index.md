# Decisions index

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md)

Every decision, one row per id, grouped by area; the area file has the reason, where it is enforced and the source. "Waiting" rows are open questions for the owner (details in [TODO.md](../../TODO.md)). Ids moved to an area's Details are listed after its table: they are retired and never reused.

Totals: 869 decisions (137 owner, 650 default, 82 waiting); 163 ids moved to Details.

## Waiting for the owner

The open questions, in one place (each row says what the app does today).

| Id | Today | Area |
|---|---|---|
| `AI-13` | Today Gemini streams only with "Stream Gemini responses (experimental)" on (off by default); a broken stream is repeated once without… | [2](02-ai-providers.md) |
| `AI-27` | Today one such hold lasts at most 3 minutes on Android. | [2](02-ai-providers.md) |
| `AI-28` | Today there is no hold for incognito conversations on Android; iOS holds them (its background time is invisible). | [2](02-ai-providers.md) |
| `DATA-7` | Today new backups use scrypt N = 2^14, r = 8, p = 1 (16 MiB). | [3](03-data-on-the-phone.md) |
| `SEC-9` | Today the sensitive-page lists are a starting set: payment and sign-in hosts, a short bank list (banks in Türkiye included), any host… | [6](06-secrets.md) |
| `INC-16` | Today the short "finishing a reply" keep-alive for an own-key request is not used for incognito conversations on Android; iOS holds anyway. | [8](08-incognito.md) |
| `BLK-18` | Today kept styles also apply on sites set to "Blocked" (the site levels govern the assistant, styles are the user's own). | [9](09-blocking-and-my-rules.md) |
| `LOG-13` | Today Gemini's tool-use tokens are priced as input and its cached tokens are taken as part of the input. | [13](13-sent-to-ai-and-cost.md) |
| `TOOL-10` | Today "Show where the assistant acts" is not in the settings tool. | [15](15-tools-and-phone-actions.md) |
| `CON-2` | A lookup runs only for a name the user typed or said. Every word of the name must start a word in the user's own messages in this… | [17](17-contacts.md) |
| `CON-3` | A lookup returns at most 5 people. | [17](17-contacts.md) |
| `CON-4` | Qutai's picker shows at most 8 rows (people × their numbers or addresses). Rows beyond 8 are left out. | [17](17-contacts.md) |
| `CON-5` | A handle works only in the conversation that made it, and for 30 minutes after the lookup. A forged, foreign or expired handle is… | [17](17-contacts.md) |
| `CON-24` | Store forms are still open: the App Store privacy label (Contacts › App Functionality, not linked, no tracking), Play Data safety… | [17](17-contacts.md) |
| `STY-21` | Style cards in restored chats still offer Keep, while script cards don't. | [18](18-page-styles.md) |
| `STY-22` | Kept styles on sites set to "Blocked" still apply wherever their scope says. | [18](18-page-styles.md) |
| `SCR-7` | The sensitive-page lists are a first version. | [20](20-page-scripts.md) |
| `SCR-12` | Scripts may not press buttons, submit forms, navigate or open windows. One-off live-page scripts may not touch site storage… | [20](20-page-scripts.md) |
| `SCR-19` | Scripts run in the page's main JavaScript world on both platforms. iOS's isolated content world (`WKContentWorld`) is not used. | [20](20-page-scripts.md) |
| `SCR-20` | Kept scripts have two run times: `end` (DOMContentLoaded, the default) and `idle` (after load). There is no "document start". | [20](20-page-scripts.md) |
| `SCR-24` | Imported scripts always arrive switched off and unsealed, listed with their flags. The import dialog offers only "Skip" or "Import… | [20](20-page-scripts.md) |
| `SCR-35` | App Review notes for scripts, and whether Qutai needs Google Play's in-app way to report AI output, are open. The proposed review notes… | [20](20-page-scripts.md) |
| `APPS-14` | Each app may store up to 5 MB of data, counted in UTF-8 bytes. One value or document may be up to 256 KB, a batch up to 100 operations,… | [22](22-apps.md) |
| `APPS-17` | The 20 newest versions plus the current one are kept, and older ones are deleted when a new one is saved. Today: 20. | [22](22-apps.md) |
| `APPS-43` | Phase 3 phone features are each declared and asked per app. `assistant.ask` shows each question and its cost source first, and links ask… | [22](22-apps.md) |
| `APPS-46` | The privacy policies say nothing about apps yet, and the legal version is not bumped. The proposed sentence: apps are stored only on the… | [22](22-apps.md) |
| `MEDIA-7` | Whether iOS background play of YouTube is acceptable under YouTube's terms and App Review is open; today it works as in MEDIA-6. | [24](24-reader-and-media.md) |
| `MEDIA-20` | On Android an APK opens in the system installer, which asks "allow from this source" itself; Qutai declares `REQUEST_INSTALL_PACKAGES`… | [24](24-reader-and-media.md) |
| `LANG-17` | Today the eight newer translations are unreviewed by native speakers; brand names "Qutai Credits" / "Qutai Fast" / "Qutai Pro" stay in… | [26](26-languages.md) |
| `LANG-18` | Today translate prompts say "into <interface language>" and examples use local cities. | [26](26-languages.md) |
| `LAND-2` | Today there is no in-app "lock to portrait" setting; the system's rotation lock is the way to stop turning. | [29](29-landscape.md) |
| `LAND-3` | Today the assistant panel in landscape is a side panel on the trailing edge, about half the width (320–420 pt; 420 on tablets), with the… | [29](29-landscape.md) |
| `WORK-6` | Today "Show where the assistant acts" cannot be changed by the assistant from the chat. | [30](30-working-mode.md) |
| `WORK-16` | Today the scroll step's line shows the English direction word ("Scrolling: down"). | [30](30-working-mode.md) |
| `INTRO-18` | Today, with Qutai Credits, the introduction's instructions travel at the start of the user's message, adding the assistant's… | [31](31-onboarding.md) |
| `INTRO-20` | Today own-key users get no sign-in step in setup. | [31](31-onboarding.md) |
| `INTRO-21` | Today the welcome and legal summary say "Private by design" / "we have no servers"; these must be rewritten together with the privacy… | [31](31-onboarding.md) |
| `PERF-7` | Today every request sends the full tool list (about 10,000 tokens) with the full descriptions; sending fewer tools or shorter… | [32](32-performance.md) |
| `PERF-8` | Today none of the bigger start-up ideas is tried (static linking of iOS libraries, replacing the Skia graphics library, which is 13.6 MB… | [32](32-performance.md) |
| `ACC-28` | Today adding a sign-in method needs only the session and the new method's own sign-in, no re-check of an existing method. | [33](33-accounts.md) |
| `ACC-30` | Today removing a method needs a sign-in on this phone in the last 5 minutes with that method or one added before it; otherwise the… | [33](33-accounts.md) |
| `ACC-32` | Today removing a method leaves other phones signed in; the confirmation and the "method removed" mail (to the account's addresses and… | [33](33-accounts.md) |
| `ACC-36` | Today someone who controls one method of another account (for example a stolen Google account) can combine its credits into their own… | [33](33-accounts.md) |
| `ACC-49` | Today setup offers sign-in only on the Qutai Credits path; own-key users get no optional "Sign in" step. | [33](33-accounts.md) |
| `ACC-50` | Today Sign in with Apple on Android is built but stays off until the owner creates Apple's Services ID and return address. | [33](33-accounts.md) |
| `ACC-51` | Today the sign-in methods are Apple, Google and email; no other provider. | [33](33-accounts.md) |
| `CRED-25` | Today the deployed relay rules must allow memory of at least about 10 000 characters and 9 images per request; the local seed has these… | [34](34-credits-and-relay.md) |
| `CRED-26` | Today a step holds its whole output limit and room for search results, so a small balance refuses cheaper requests (Haiku: ~2.2 / 13 / 71 credits)… | [34](34-credits-and-relay.md) |
| `CRED-33` | Today the panel shows revenue gross (before the store's share), "active" means seen, and there is one admin role. | [34](34-credits-and-relay.md) |
| `CRED-34` | Today the server raises abuse flags (task limits hit often, refund debt, many refunds) and the panel resolves them; thresholds are guesses. | [34](34-credits-and-relay.md) |
| `CRED-35` | Today credit prices are the model's token price plus a margin; pack sizes, trial credits and per-user limits are open (credits never expire… | [34](34-credits-and-relay.md) |
| `CRED-37` | Today there is no crash-report service. | [34](34-credits-and-relay.md) |
| `CRED-38` | Today, with an own key, a request still running when the user leaves the app is kept alive for at most 3 minutes, and not for incognito… | [34](34-credits-and-relay.md) |
| `BUY-9` | Today a refund that Apple later cancels does not give the credits back automatically; support can grant them by hand. | [35](35-purchases.md) |
| `BUY-24` | Today Qutai only asks RevenueCat to delete a deleted user's customer record; whether to require more is open. | [35](35-purchases.md) |
| `BUY-25` | Today the packs are decided (three Android packs) but the RevenueCat project, Play products, notifications and panel packs are still being created; no trial credits. | [35](35-purchases.md) |
| `BACK-4` | Today new files use scrypt (a slow password-to-key function) with N = 2^14, r = 8, p = 1 and XChaCha20-Poly1305 encryption; files asking… | [36](36-server-backup.md) |
| `BACK-5` | Today the backup contents are not compressed. | [36](36-server-backup.md) |
| `BACK-7` | Today the kept password is cleared on sign-out and account deletion, kept when the server ended the session, and cleared by the iPhone… | [36](36-server-backup.md) |
| `BACK-9` | Today a server backup includes open tabs and leaves out conversations, activity and AI keys unless the user switches them on. | [36](36-server-backup.md) |
| `BACK-10` | Today the automatic backup is off by default and, when on, runs once a day, only while Qutai is open (never from a background service),… | [36](36-server-backup.md) |
| `BACK-18` | Today "Delete all backups" needs no recent sign-in. | [36](36-server-backup.md) |
| `BACK-22` | The pro privacy policy describes server backups, and its version was raised so every pro user accepts again (now version 5). | [36](36-server-backup.md) |
| `OSPERM-8` | Today the proposed store answers for contacts are: App Store "Contacts › App Functionality, not linked to identity, not used for… | [38](38-phone-permissions.md) |
| `OSPERM-19` | Today the Play Console foreground-service declaration still has the old text; the owner must update it and record the video for the 17… | [38](38-phone-permissions.md) |
| `BUILD-22` | Today Android declares REQUEST_INSTALL_PACKAGES, so that "Open" on a downloaded APK reaches the system installer. Whether to fill in… | [40](40-signing-and-builds.md) |
| `LEGAL-9` | Before Qutai's server goes live for everyone, every "no servers of ours" sentence in the onboarding, the legal texts, store listings and… | [41](41-legal-texts.md) |
| `LEGAL-10` | A lawyer reviews the open-source and pro texts (KVKK/GDPR, Turkish consumer law on digital content) before any store release. Today they… | [41](41-legal-texts.md) |
| `LEGAL-26` | The terms name no governing law or court. Open for the owner: which law governs and which courts or consumer boards hear disputes… | [41](41-legal-texts.md) |
| `LEGAL-27` | Open source licences lists only this platform's components; no "Android only" / "iOS only" labels. | Owner | 2026-11-21 |
| `WEB-11` | Today three sentences on the site are out of date: "No account needed and no sync", the planned end-to-end sync, and the comparison's… | [42](42-website.md) |
| `NOT-9` | Today there is no sync; whether a future sync must be end-to-end encrypted (so the server cannot read it) is open, recommended yes. | [44](44-not-built.md) |
| `NOT-15` | Today there is no in-app "lock to portrait"; the system's rotation lock is used (section 29). | [44](44-not-built.md) |
| `RMAP-5` | Should sync be end-to-end encrypted? The roadmap recommends yes. Today there is no sync. The server backup (pro mode) stores the same… | [45](45-roadmap-decisions.md) |

# All decisions by area

## [1. The open-source build and pro mode](01-open-source-and-pro.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `PROD-1` | Pro features exist only when `EXPO_PUBLIC_PRO_MODE` is on (`on`, `true`, `1` or `yes`); it is off unless set. | Default |  |
| `PROD-2` | Accounts, Qutai Credits and the account backup need both pro mode and a server address; without either,… | Default |  |
| `PROD-3` | The open-source build never contacts Qutai's server: only the account session, the credits client and the… | Default |  |
| `PROD-4` | A backup that names Qutai Credits as the provider does not switch a build without pro mode to it; the… | Default |  |
| `PROD-6` | Pro-only parts must keep the repository build working without them. | Default |  |
| `PROD-7` | Test sign-in exists only with accounts on, `EXPO_PUBLIC_DEV_LOGIN` on and the test server's secret;… | Owner | 2026-11-17 |
| `PROD-8` | ~~Fake purchases are a temporary stand-in, only on a development server~~ (withdrawn: removed). | Withdrawn | 2026-11-21 |
| `PROD-9` | The open-source build and pro mode have separate privacy policies and terms with separate version numbers… | Owner | 2026-11-19 |
| `PROD-10` | The open-source privacy policy says: "Qutai has no servers of its own: we do not collect, store or sell… | Default |  |
| `PROD-11` | The code is licensed under Apache-2.0; the licence covers the code only, not the name "Qutai", its logo or… | Owner | 2026-11-14 |
| `PROD-12` | A published fork changes the name everywhere (`app.json`, `src/i18n/`, `locales/`, README,… | Default |  |
| `PROD-13` | Building and running the code for personal use, development and testing is allowed without renaming it. | Default |  |
| `PROD-14` | Trademark statements do not name an owner; the website shows only the Apache-2.0 note and no trademark links. | Default |  |
| `PROD-15` | Settings › About › Open source licences lists every third-party component in the app with its licence text… | Default |  |

Moved to Details (ids retired, not reused): `PROD-5`

## [2. AI providers and how requests reach them](02-ai-providers.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `AI-1` | Every request to any provider passes through one wrapper that records it for "What was sent to the AI"… | Default |  |
| `AI-2` | With an own key, requests go from the phone directly to the chosen provider; Qutai's server is not involved. | Default |  |
| `AI-4` | The default provider is Anthropic; default models are Claude Sonnet 5.5, GPT-5.6 terra, Gemini 4 Hydrogen,… | Default |  |
| `AI-5` | API keys, the custom endpoint's header values and all settings are kept in the phone's secure storage,… | Default |  |
| `AI-6` | Qutai Credits never has a key in the app: only the request body goes to Qutai's server, never its headers,… | Default |  |
| `AI-7` | Qutai Credits can be used only while signed in and after the user accepted its notice once on this phone;… | Default |  |
| `AI-8` | In credit mode the user picks no provider model and, since 20 Nov, no tier (changed; `CRED-39`). | Owner | 2026-11-16, changed 2026-11-20 |
| `AI-9` | A conversation's own model is saved with the conversation, read when a message is sent (so a running task… | Default |  |
| `AI-13` | Today Gemini streams only with "Stream Gemini responses (experimental)" on (off by default); a broken… | **Waiting** |  |
| `AI-14` | AI search is on by default and can be turned off in Settings › Assistant; when off, neither the search… | Owner | not recorded |
| `AI-15` | Anthropic web search allows at most 5 searches per request, 20 in deep research. | Default |  |
| `AI-16` | OpenRouter has no web search in Qutai; Settings shows a note. | Default |  |
| `AI-17` | The custom endpoint has no web search. | Default |  |
| `AI-18` | Sources cited by web search open in a private tab when the chat is private. | Default |  |
| `AI-19` | Custom endpoint address: https always; plain http only to the phone's own or local network (127.x, 10.x,… | Default |  |
| `AI-21` | Extra headers for the custom endpoint: at most 5; names are plain HTTP names up to 100 characters and… | Default |  |
| `AI-22` | The custom endpoint always gets the assistant's tools: there is no chat-only mode, and `tool_choice` is… | Default |  |
| `AI-24` | "Test connection" says honestly which checks passed, failed or were not checked, and removes keys, header… | Default |  |
| `AI-25` | A Cloudflare API address that is not the `…/ai/v1` chat address gets a notice with the right address; a… | Owner | 2026-11-16 |
| `AI-26` | With an own key, a request still running when the user leaves Qutai is kept alive until it ends: on… | Owner | 2026-11-17 |
| `AI-27` | Today one such hold lasts at most 3 minutes on Android. | **Waiting** |  |
| `AI-28` | Today there is no hold for incognito conversations on Android; iOS holds them (its background time is… | **Waiting** |  |
| `AI-29` | Qutai Credits requests are never held; the server charges a re-sent step only once. | Default |  |
| `AI-30` | The assistant's settings tool cannot change the provider, model, keys, custom endpoint, its headers or web… | Default |  |
| `AI-31` | Gemini's search suggestions box is shown under the answer; Anthropic and OpenAI citations are shown as… | Default |  |
| `AI-32` | With an own key, nothing goes to a provider before the user accepted, on this phone, a screen that names… | Owner | 2026-11-21 |
| `AI-33` | AI keys and custom header values are kept "this device only" like the other secrets; older ones rewritten once | Default | 2026-11-21 |
| `AI-34` | Own-key requests retry after 1, 2, 4 s or a longer Retry-After (20 s at most); Stop ends the wait at once | Default | 2026-11-21 |
| `AI-35` | In pro mode Qutai Credits is listed first among the providers. | Owner | 2026-11-22 |
| `AI-36` | Sending with no AI set up says "choose an AI provider in Settings" and names no provider. | Owner | 2026-11-23 |

Moved to Details (ids retired, not reused): `AI-3`, `AI-20`, `AI-23`, `AI-10`, `AI-11`, `AI-12`

## [3. What is stored on the phone, and what leaves it](03-data-on-the-phone.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `DATA-1` | Tabs, history, bookmarks, recently closed tabs and conversations are stored only on the phone; there is no… | Default |  |
| `DATA-2` | Settings and AI keys live in secure storage, not in the database. | Default |  |
| `DATA-3` | A backup always contains bookmarks with folders, history, memory (categories and hidden flags), site… | Default |  |
| `DATA-4` | Open tabs and groups are in a backup by default; conversations and the activity history only when ticked;… | Default |  |
| `DATA-5` | Never in a backup: incognito data, downloads and saved pages, the "What was sent to the AI" list, caches… | Default |  |
| `DATA-6` | The backup file is encrypted with XChaCha20-Poly1305 under a key made from the password with scrypt; the… | Default |  |
| `DATA-7` | Today new backups use scrypt N = 2^14, r = 8, p = 1 (16 MiB). | **Waiting** |  |
| `DATA-8` | A file that asks for more than 256 MiB of memory (log2 N 10–20, r 1–16, p 1–4) is refused before any work. | Default |  |
| `DATA-9` | The backup password has at least 10 characters and cannot be recovered. | Default |  |
| `DATA-10` | Every field in a backup is checked as untrusted input; a newer app reads older backups, an older app… | Default |  |
| `DATA-11` | Merge takes a preference from the backup only where this phone still has the default; replace takes the… | Default |  |
| `DATA-12` | Export asks for Face ID or fingerprint first when the app lock is on. | Default |  |
| `DATA-13` | On iPhone, the first launch with neither the install marker (`<documents>/.qutai-install`) nor the… | Default |  |
| `DATA-14` | Each AI request carries the conversation so far, attachments, the custom instructions and, while memory is… | Default |  |
| `DATA-15` | Calendar details and the location reach the AI only after a confirmation each time (or the user's own… | Default |  |
| `DATA-16` | Sites receive only the details the assistant types at the user's request, behind the per-site… | Default |  |
| `DATA-17` | "Use my location" sends the approximate position once to the phone's address lookup (Apple's, or Google's on most… | Default |  |
| `DATA-18` | Voice audio never goes to Qutai or the AI provider; it goes to Apple's or Google's speech service only… | Default |  |
| `DATA-19` | Filter lists are downloaded from their publishers while blocking is on, and search suggestions go to the… | Default |  |
| `DATA-20` | Any change to what leaves the phone needs the privacy policy (`src/legal/documents.ts`) changed and its… | Default |  |
| `DATA-21` | Clear browsing data offers history, cache, recently closed, conversations, activity, the AI request list,… | Default |  |
| `DATA-22` | The account backup (pro) is the same encrypted file; the server stores only that file and keeps the newest… | Default |  |
| `DATA-23` | Only requests to Qutai's server send `Qutai/<version> (<platform>) qutai.<build>`; web views and every third… | Owner | 2026-11-20 |
| `DATA-24` | Card pictures are requested from the sites showing them (also for options not opened), without cookies or Referer; not in incognito until asked; policies name it, versions not bumped | Default | 2026-11-20 |
| `DATA-25` | Each migration step and its version bump in one transaction; a step left half done by an older version recovers; a failed open is tried again | Default | 2026-11-20 |
| `DATA-26` | Storage failures reported in one place (fine, record, user); unreadable saved values kept aside; unreadable site permissions mean Ask | Default | 2026-11-20 |
| `DATA-27` | One secure source for every random value (expo-crypto), 128-bit nonces for bridges and tokens, ids keep their stored shape; no Math.random | Default | 2026-11-20 |
| `DATA-28` | Every settings change is a patch on the live settings, never a render-time copy; writes go one after another with the latest settings | Default | 2026-11-20 |
| `DATA-29` | Pro builds only: buying talks to RevenueCat and Google Play Billing (account id, products, purchases, IP and device info); RevenueCat contacted only around Buy credits | Default | 2026-11-20 |
| `DATA-30` | A failed clearing or profile save is said and the screen stays usable (no silent close, no stuck "saving") | Default | 2026-11-21 |

## [4. Page content is untrusted](04-untrusted-content.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `UNTR-1` | Web page content, PDF text and attached files are untrusted data, not instructions; they arrive between markers (`UNTR-21`)… | Default | 2026-11-20 |
| `UNTR-2` | Every approval is a native Qutai dialog that only the user can answer; a page, a file or the model cannot… | Default |  |
| `UNTR-4` | The `settings` tool may change only an allowlist of appearance and browsing preferences; everything else… | Owner | 2026-11-15 |
| `UNTR-5` | Refused by the settings tool: "Ask before every action", every site permission (assistant level, location,… | Default |  |
| `UNTR-6` | HTTPS-only can be turned on by the assistant, never off. | Default |  |
| `UNTR-7` | "Let the assistant complete payments" and "Let the assistant run scripts on pages" cannot be changed by… | Owner | 2026-11-19 |
| `UNTR-8` | The settings tool can never weaken a protection: blocking, cookie banners, third-party cookies and HTTPS-only on only… | Default | 2026-11-19 |
| `UNTR-9` | The assistant changes settings only when the user asks in their own words; a page, file or tool result… (app check: `UNTR-25`) | Default | 2026-11-20 |
| `UNTR-10` | Bookmarks, site rules, page styles, cookie deletion and apps change only when the user asks, never because… | Default |  |
| `UNTR-11` | `find_contact` looks up only a name the user typed or said in this conversation. | Default |  |
| `UNTR-12` | Calls, text messages, WhatsApp messages and emails are only prepared as cards or drafts; the user taps to… | Default |  |
| `UNTR-13` | Only the user's attachments, `edit_image` results, `save_pdf` PDFs and `save_file` files may leave a… | Default |  |
| `UNTR-14` | The assistant has no tool that writes to the clipboard; only the user copies. | Default |  |
| `UNTR-15` | The assistant never tries to solve a CAPTCHA or "are you human?" check; it asks the user to do it. | Default |  |
| `UNTR-16` | Scripts are never used to send, post, pay, read passwords, codes or cookies, or because a page asks; their… | Default |  |
| `UNTR-17` | The certificate error page and its "Continue anyway" are native views the assistant's tools cannot reach. | Default |  |
| `UNTR-18` | The user's custom instructions are placed below the safety rules and say they never override them. | Default |  |
| `UNTR-19` | Deleting and account or security changes on a site go through Qutai's change approval (`PAY-26`); sharing personal data is asked in chat… | Default | 2026-11-19 |
| `UNTR-20` | Option cards are page data: links, pictures, text, count and prices checked by the app, also when read back | Default | 2026-11-20 |
| `UNTR-21` | Pages, titles, sources, PDFs and script results reach the model between untrusted-content markers with a random id the page can't forge or close | Default | 2026-11-20 |
| `UNTR-22` | An address the model writes that carries memory details, the user's references or another site's codes to a site the user didn't name or have open is asked in Qutai's dialog | Default | 2026-11-20 |
| `UNTR-23` | A memory that isn't in what the user wrote is asked in Qutai's dialog before it is saved | Default | 2026-11-20 |
| `UNTR-24` | Resistance to instructions in pages is measured with the injection test set (opt-in, billed, capped); claims say only what it shows | Default | 2026-11-20 |
| `UNTR-25` | A settings change the user's own messages don't name is asked in Qutai's dialog before it applies; protections towards safe never asked | Default | 2026-11-20 |
| `UNTR-26` | Qutai's page script is installed once per document under a secret, frozen, non-configurable name, before the page's scripts on iOS and Android; commands carry only the call | Default | 2026-11-20 |
| `UNTR-27` | Saved details unreadable: an address to a site the user didn't name or have open is asked about in Qutai's dialog (refused where nothing can be asked); its card isn't shown | Owner | 2026-11-21 |

Moved to Details (ids retired, not reused): `UNTR-3`

## [5. Site permissions and approvals](05-site-permissions.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `SITE-1` | A site's level is one of Default, Always allow, Ask every time, Read only, Blocked (code: `default`,… | Default |  |
| `SITE-4` | On a Blocked site every call is refused, reading included, and the assistant can't navigate there. | Default |  |
| `SITE-5` | On a Read only site, click, click by position, type, select, download, upload, posting/paying approval,… | Default |  |
| `SITE-6` | Only opening a page, opening a tab, clicking, clicking by position, typing, selecting and saving a… | Default |  |
| `SITE-7` | "Ask before every action" is off by default; it decides only for Default sites, and it is restored from a… | Default |  |
| `SITE-8` | Ticking "Always allow on {site}" in the confirmation sets the site to Always allow for good; never offered in incognito… | Default | 2026-11-19 |
| `SITE-9` | "Don't ask again" is offered only for six phone kinds: scheduled notifications, calendar events,… | Default |  |
| `SITE-10` | "Don't ask again" is never offered for anything that acts on a web page or leaves the phone (clicks,…; except `PAY-29`, `SCR-36` | Default | 2026-11-23 |
| `SITE-11` | A risky download (apps, installers, archives) or a download in a conversation that touched an incognito… | Default |  |
| `SITE-12` | A denial is never remembered; only Allow with the box ticked is. | Default |  |
| `SITE-13` | "Allowed without asking" is not in backups and can't be changed by the assistant. | Default |  |
| `SITE-14` | Adding calendar events, reminders and notifications, reading the calendar and getting the location always… | Default |  |
| `SITE-15` | Text the assistant types or selects that contains a remembered personal detail (name, phone, email,… | Default |  |
| `SITE-16` | Hidden saved values (for example an ID or passport number) are typed by Qutai itself, only on https pages,… | Default |  |
| `SITE-17` | Every tool result is cleaned of hidden values before it goes to the model or a log; a screenshot masks… | Default |  |
| `SITE-19` | Uploading an image or file to a page asks every time, with the picture, its size and the site, never… | Default |  |
| `SITE-20` | Saving site rules asks every time with what will be hidden or blocked and where; never "don't ask again". | Default |  |
| `SITE-21` | Deleting a bookmark folder, or removing more than three bookmarks in one task, asks first; a single… | Default |  |
| `SITE-22` | A confirmation is never answered for the user: while Qutai is in the background the task pauses and waits… | Default |  |
| `SITE-23` | Every action goes to the activity history (30 days, at most 2000 entries), refused and declined ones… | Default |  |
| `SITE-25` | One URL module, read as the WebView reads addresses, for every site decision and every host shown; site key (host) vs registrable domain defined there | Default | 2026-11-20 |
| `SITE-26` | A site setting changed while the stored ones load wins over disk, for every kind, also back to the default | Default | 2026-11-21 |
| `SITE-27` | The site's settings show "Posting without asking" and "Scripts without asking" with "Ask every time again"; the list shows them and ✕ resets them; only their dialogs turn them on | Default | 2026-11-23 |

Moved to Details (ids retired, not reused): `SITE-2`, `SITE-3`, `SITE-18`, `SITE-24`

## [6. Passwords, card numbers and one-time codes](06-secrets.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `SEC-1` | Typing text that contains a payment card number (13 to 19 digits, spaced or dashed, passing the Luhn… | Default |  |
| `SEC-2` | Qutai never types passwords, one-time codes, card numbers or security codes: the app refuses typing into such fields… | Default | 2026-11-20 |
| `SEC-3` | The value of a secret field (password, code, card) is never shown to the model: page text, approvals, script copy, screenshots… | Default | 2026-11-20 |
| `SEC-4` | A password field can never be the text of a posting approval. | Default |  |
| `SEC-5` | The payment method named in a payment approval may never be a card number. | Default |  |
| `SEC-6` | Memory refuses passwords, passcodes and PINs, card security codes, one-time codes, card expiry dates, card… | Default |  |
| `SEC-7` | ID and passport numbers the user saves become hidden values: the model sees only a label and Qutai types… | Default |  |
| `SEC-8` | Scripts are refused on pages with a password, one-time-code or card field, and on sign-in, payment and… | Default |  |
| `SEC-9` | Today the sensitive-page lists are a starting set: payment and sign-in hosts, a short bank list (banks in… | **Waiting** |  |
| `SEC-10` | Scripts may not read cookies, storage or passwords. | Default |  |
| `SEC-11` | Cookie values never go to the AI: the assistant gets cookie names, domains, paths, expiry, size and flags… | Default |  |
| `SEC-12` | An email sign-in link opened inside Qutai is never loaded as a page, so its token never becomes a tab, a… | Default |  |
| `SEC-13` | Qutai has no password manager of its own; the phone's own autofill is relied on. | Default |  |

## [7. Posting and paying](07-posting-and-paying.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `PAY-1` | Posting, commenting, replying, reviewing, sending a message or an email on a site, or submitting a public… | Default |  |
| `PAY-2` | The publish dialog shows what Qutai reads on the page (the field's exact text, or the form's filled… | Default |  |
| `PAY-3` | An approval allows one press of one button, in one tab, on one page address (without its #fragment),… | Default |  |
| `PAY-4` | Just before an approved press, Qutai checks the page again: same page, same text or form values, the total… | Default |  |
| `PAY-5` | Settings › Assistant › "Let the assistant complete payments" is off by default. | Owner | 2026-11-19 |
| `PAY-6` | Turning payments on asks once more; turning them off never asks. | Default |  |
| `PAY-7` | The payments setting is not restored from a backup and can't be changed by the assistant. | Default |  |
| `PAY-8` | With payments off, pressing a final payment button is refused and the assistant tells the user the order… | Default |  |
| `PAY-9` | The final payment button needs an approval: recognised by its label or by context (payment step, its form, a total)… | Default | 2026-11-19 |
| `PAY-11` | The pay dialog shows the site, the total exactly as found on the page and the line it is on, the order,… | Default |  |
| `PAY-12` | The payments setting is read again when the dialog closes and before the press; turned off meanwhile,… | Default |  |
| `PAY-13` | The pay and change dialogs are shown every time, never "Don't ask again"; publish too unless the site is remembered (`PAY-29`) | Default / Owner | 2026-11-23 |
| `PAY-14` | Read only and Blocked sites never reach the dialog. | Default |  |
| `PAY-15` | There is no spending limit per payment or per currency. | Owner | 2026-11-19 |
| `PAY-16` | The pay dialog shows no picture of the order summary. | Owner | 2026-11-19 |
| `PAY-17` | A press that would send free text the assistant typed during the task (a comment, reply, review, message,… | Default |  |
| `PAY-23` | Scripts are refused in a tab while a publish or pay approval waits there. | Default |  |
| `PAY-24` | Before a purchase or sign-up the assistant names any subscription, automatic renewal, free trial turning… | Default |  |
| `PAY-25` | The activity history records only what was asked (post, comment, pay), never the text or the total. | Default |  |
| `PAY-26` | Deleting something or changing account or security settings on a site needs Qutai's own approval (request_approval kind "change")… | Default | 2026-11-19 |
| `PAY-27` | A button with an amount and a billing period or subscribe word in its visible text is a payment press (pay approval and the payments setting) | Default | 2026-11-20 |
| `PAY-28` | Every in-app check before a press, typing or an approval fails closed: no answer, an error or a wrong-shaped answer from the page refuses the step | Default | 2026-11-20 |
| `PAY-29` | The publish dialog's box "Post on {site} without asking" (off) skips the dialog there later; text match, re-check and one-press grant stay; not pay/change, incognito, Read only, Blocked, background or backups | Owner | 2026-11-23 |

Moved to Details (ids retired, not reused): `PAY-10`, `PAY-18`, `PAY-19`, `PAY-20`, `PAY-21`, `PAY-22`

## [8. Incognito and locks](08-incognito.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `INC-1` | Incognito tabs are never written to history, never remembered as recently closed and never restored. | Default |  |
| `INC-2` | A conversation that touches an incognito tab is never written to disk, and its earlier "sent to the AI"… (tab lists hide incognito tabs in normal conversations) | Default | 2026-11-20 |
| `INC-3` | Nothing is saved to memory from an incognito conversation (memory can still be read). | Default |  |
| `INC-4` | Calendar events, reminders, notifications, reading the calendar and the location are refused in incognito… | Default |  |
| `INC-5` | Contacts are off in incognito conversations. | Default |  |
| `INC-6` | No action from an incognito tab is recorded in the activity history. | Default |  |
| `INC-7` | Remote search suggestions are always off in incognito. | Owner | not recorded |
| `INC-9` | On Android, incognito tabs open at the same time share one WebView profile of their own (cookies, site… | Default |  |
| `INC-10` | On Android WebViews without profile support, incognito tabs share cookies and site data with normal tabs… | Default |  |
| `INC-11` | On iOS each incognito tab has its own temporary data store, gone when the tab closes. | Default |  |
| `INC-12` | System screenshots and screen recording are blocked while incognito content is on screen (also the tab… | Default |  |
| `INC-13` | In incognito, location, camera, microphone and personal-information prompts never offer "Always allow",… | Default |  |
| `INC-14` | No approval given in incognito is remembered: no "Always allow" or "Don't ask again" there… | Default | 2026-11-19 |
| `INC-15` | "Keep working in the background" never runs for incognito conversations. | Default |  |
| `INC-16` | Today the short "finishing a reply" keep-alive for an own-key request is not used for incognito… | **Waiting** |  |
| `INC-17` | Tabs opened from an incognito tab, and links in an incognito conversation's answers, stay incognito. | Default |  |
| `INC-18` | Nothing arriving from outside the app opens in an incognito tab, except the explicit… | Default |  |
| `INC-19` | Picture-in-picture is not offered for incognito tabs or while the app lock is on; the media notification… | Default |  |
| `INC-20` | Styles and scripts are never kept from an incognito tab and kept scripts never run there; kept styles and… | Default |  |
| `INC-21` | A download from an incognito tab is listed only while the incognito session lasts and uses the incognito… | Default |  |
| `INC-22` | A certificate exception made in an incognito tab belongs to that tab and goes with it. | Default |  |
| `INC-23` | Online speech recognition (Apple's or Google's service) is never used in incognito conversations. | Default |  |
| `INC-24` | A notification the assistant scheduled carries only a random in-memory key for an incognito tab, so an… | Default |  |
| `INC-25` | "Lock Qutai" asks for Face ID, fingerprint or the device passcode on start and on every return from the… | Default |  |
| `INC-26` | A lock can be turned on only when the phone has a screen lock, after one verification; settings load… | Default |  |
| `INC-27` | Both locks are off by default, are not in backups and can't be changed by the assistant. | Default |  |
| `INC-28` | With the app lock on, things arriving from other apps wait until the user unlocks. | Default |  |
| `INC-29` | Incognito conversations load no card pictures until "Show images" | Default (owner to confirm) | 2026-11-20 |
| `INC-30` | Incognito leftovers: failed removals recorded and retried, the sent-log purge waits for writes on their way, unknown state counts as incognito | Default | 2026-11-21 |

Moved to Details (ids retired, not reused): `INC-8`

## [9. Blocking and My rules](09-blocking-and-my-rules.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `BLK-1` | "Block ads and trackers" is on by default. | Default |  |
| `BLK-2` | Filter lists are never bundled: downloaded from the publisher's official https address, or its own mirror (AdGuard: FiltersRegistry on GitHub) when that times out, refuses or fails. | Default; mirror Owner | 2026-11-23 |
| `BLK-3` | EasyList and EasyPrivacy are on by default; AdGuard Turkish is on when the app language is Turkish; the… | Default |  |
| `BLK-4` | The Turkish hosts list "turk-adlist" is not offered. | Default |  |
| `BLK-6` | Limits: one list at most 15 MB, 400,000 domains in total, at most 10 custom lists; lists update at most… | Default |  |
| `BLK-7` | A custom list must be an https address. | Default |  |
| `BLK-11` | "Block ads and trackers here" in a site's sheet turns all blocking off for that site; it is kept with the… | Default |  |
| `BLK-12` | Hide rules and blocked domains are part of ad blocking (off when blocking is off or off for the site);… | Default |  |
| `BLK-13` | A hide rule applies to this page, pages under this path, this site, or this site and its subdomains (the… | Default |  |
| `BLK-14` | Limits for My rules: 500 rules, 50 per site, selectors up to 300 characters; 200 styles; 50 scripts. | Default |  |
| `BLK-15` | The assistant saves rules only for the current tab's site, never blocks the site's own domain, and the… | Default |  |
| `BLK-17` | Imported styles are checked again and listed, and the user chooses "Import switched on" or "Import… | Default |  |
| `BLK-18` | Today kept styles also apply on sites set to "Blocked" (the site levels govern the assistant, styles are… | **Waiting** |  |
| `BLK-19` | "Hide cookie banners" is on by default and only hides banners with a style (and unlocks scrolling the… | Default |  |
| `BLK-20` | "Block third-party cookies" is on by default (Android; iOS blocks them anyway). | Default |  |
| `BLK-21` | HTTPS-only is off by default. Note: docs/permissions.md says "on by default"; the code says off. | Default |  |
| `BLK-22` | With HTTPS-only on, http pages open over https; if that fails, the user is asked, and an exception lasts… | Default |  |
| `BLK-23` | The assistant can turn HTTPS-only on, never off; certificate and insecure-site exceptions are only made by… | Default |  |
| `BLK-24` | The assistant can switch ad blocking, cookie-banner hiding, video-ad blocking and third-party-cookie blocking on, never off… | Default | 2026-11-21 |
| `BLK-26` | Android allows plain http for the whole app and keeps http in check inside the app (HTTPS-only, "Not… | Default |  |
| `BLK-27` | On a certificate error (Android), "Continue anyway (not secure)" allows that one certificate on that site… | Default |  |
| `BLK-28` | Android's local network permission is not declared at target API 36; it must be declared and asked for… | Default |  |
| `BLK-29` | "Block video ads" is off by default; in Settings › Privacy and security and setup's protection step; kept in backups; named "video ads" everywhere, no site named. | Owner | 2026-11-21 |
| `BLK-30` | Video ads: a document-start page script on the rules table's hosts (frames too) removes the ad plan from the player's data and hides ad boxes; not on off sites; incognito too; nothing leaves the phone; all site data in one table. | Default | 2026-11-21 |
| `BLK-31` | An ad that plays anyway is muted, sent to its end and skipped (checked every 300 ms); the sound comes back after, unless the user had muted it. | Owner | 2026-11-21 |
| `BLK-32` | "Block third-party cookies" is shown and offered on Android only; iOS has no row (WebKit always blocks them). | Owner | 2026-11-21 |
| `BLK-33` | "Block ads on this site" in the ⋮ menu (checked while on) turns blocking off or on for the site and reloads; same setting as `BLK-11`. | Owner | 2026-11-23 |
| `BLK-34` | List downloads: 15 s to start answering, 60 s in all, 3 s between requests to one host, retries after 1 h / 4 h / daily; per-row spinner, switching off cancels, a never-downloaded failure switches back off with "Try again", the alert names the lists. | Owner | 2026-11-23 |

Moved to Details (ids retired, not reused): `BLK-5`, `BLK-8`, `BLK-9`, `BLK-10`, `BLK-16`, `BLK-25`

## [10. What web pages may use](10-web-page-permissions.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `WPERM-1` | Location, camera and microphone are each set per site: Ask (default, not stored), Allow or Block. | Default |  |
| `WPERM-2` | Only the tab's own site, over https, may ask; frames from other sites are always refused. | Default |  |
| `WPERM-3` | "Allow once" is the highlighted choice; "Always allow" is secondary and not offered in incognito; closing… | Default |  |
| `WPERM-4` | In incognito a stored "allow" is ignored (Qutai asks) and a stored "block" still applies. | Default |  |
| `WPERM-5` | The location is answered by Qutai, not the WebView: the page's `navigator.geolocation` is replaced in the… | Default |  |
| `WPERM-6` | A "Don’t allow" for the location is remembered for that page only, not stored. | Default |  |
| `WPERM-7` | Camera and microphone are enforced natively: the patched WebView grants only the main frame of exactly the… | Default |  |
| `WPERM-9` | Screen sharing (`getDisplayMedia`) is always refused. | Default |  |
| `WPERM-10` | Capture pauses while another tab is shown or Qutai is in the background; "Stop camera and microphone"… | Default |  |
| `WPERM-12` | The assistant can't grant a site the location, camera or microphone or change these settings; when a site… | Default |  |
| `WPERM-13` | The assistant's own location request (`get_location`) is separate from sites: confirmed each time unless… | Default |  |
| `WPERM-14` | Web pages can't show notifications: there is no web notification or push support. | Default |  |

Moved to Details (ids retired, not reused): `WPERM-8`, `WPERM-11`

## [11. The assistant's memory](11-memory.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `MEM-1` | Memory is on by default; when it is off, the memory tools and the memory section are never sent to the AI. | Default |  |
| `MEM-3` | At most 100 memories, each one line of at most 300 characters; saving the same text again (ignoring case)… | Default |  |
| `MEM-4` | The memory section has an 8,000-character budget; with Qutai Credits the server's `maxMemoryChars` may… | Default |  |
| `MEM-5` | Never stored in any category, even when asked: passwords, passcodes and PINs; card security codes;… | Default |  |
| `MEM-6` | National ID and passport numbers may be kept only in identity and travel (the Memory screen shows a… | Default |  |
| `MEM-7` | `remember` refuses coordinates and text with two or more calendar date-times. | Default |  |
| `MEM-8` | The assistant saves only what the user said in their own messages, never information from web pages. | Default |  |
| `MEM-9` | Incognito conversations read memories but `remember` and `forget` are refused there. | Default |  |
| `MEM-10` | National ID and passport numbers (named as such, or a valid Turkish ID number) are saved hidden… | Default |  |
| `MEM-11` | Saving a hidden memory again never makes it visible. | Default |  |
| `MEM-12` | The AI is told only what a hidden memory is (its detected kind or the user's label), never anything taken… | Default |  |
| `MEM-13` | Full addresses and dates of birth get a hint suggesting the lock; they are never hidden automatically. | Default |  |
| `MEM-14` | Every tool result is scanned for hidden values before it goes back to the AI, into the conversation, an… | Default |  |
| `MEM-15` | A hidden value is typed only on https pages, never on a blocked site or where personal details are… | Default |  |
| `MEM-16` | A screenshot for the AI makes fields showing a hidden value transparent, and is refused when the value… | Default |  |
| `MEM-17` | Before `type` or `select_option` enters text that contains remembered personal details, the site's "Your… | Default |  |
| `MEM-19` | Once the personal-information question was answered, the general "ask before actions" question is not… | Default |  |
| `MEM-20` | Typed text is never written to the activity history; it only says where something was typed. | Default |  |
| `MEM-21` | Personal details are entered only on sites the task is about; a page asking for them is never a reason. | Default |  |
| `MEM-22` | At checkout the assistant applies shopping preferences without being asked and says so; a preference is… | Default |  |
| `MEM-24` | The assistant cannot switch memory on or off or hide or show memories; it can only remember and forget… | Default |  |
| `MEM-25` | When the assistant saves an ID number, the chat line and the activity history do not repeat the value. | Default |  |
| `MEM-26` | "Organise for me" sends only ids and texts (hidden: label), ≤60; with Qutai Credits via the server's own organise request, not the relay. | Owner | 2026-11-23 |

Moved to Details (ids retired, not reused): `MEM-2`, `MEM-23`, `MEM-18`

## [12. Personal profile, custom instructions and page suggestions](12-profile-and-suggestions.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `PROF-1` | The voice introduction's answer is checked, not trusted: each value must come with the user's own words… | Default |  |
| `PROF-2` | Follow-up questions are fixed and translated, chosen by code, at most 3, from food, name, shopping and city (answer style removed 20 Nov). | Owner | not recorded, changed 2026-11-20 |
| `PROF-3` | Nothing from the introduction is saved before the review page; age, gender, allergy and health rows have a… | Default |  |
| `PROF-5` | The introduction tells the user before the microphone: no audio is stored or sent by Qutai; the text goes… | Default |  |
| `PROF-6` | Without an AI, or when the request or its answer fails, the introduction says so and continues with the… | Default |  |
| `PROF-7` | The typed questions make no AI request; their privacy text says "your AI provider" (no provider name) and… | Default |  |
| `PROF-8` | Withdrawn 2026-11-20: no answer-style question any more (`INTRO-29`). | Default (withdrawn) |  |
| `PROF-9` | Custom instructions: at most 500 characters, blank-line runs shortened; added last to every request,… | Default |  |
| `PROF-10` | Custom instructions never override the safety, confirmation, memory and personal-information rules; on a… | Default |  |
| `PROF-11` | The old example line "Always reply in Turkish" / "Her zaman Türkçe yanıt ver" is removed once, only when… | Owner | 2026-11-16 |
| `PROF-12` | Custom instructions can be written only by the user, never by the assistant. | Default |  |
| `PROF-13` | The Turkish interface addresses the user as "siz"; texts the user sends to the assistant (suggestion… | Owner | 2026-11-16 |
| `PROF-14` | Page suggestions are picked on the phone from a few flags in the page's markup (structured data, forms,… | Default |  |
| `PROF-15` | Three to five suggestions are shown; without a fitting page they fall back to Summarize / What can I do… | Default |  |
| `PROF-16` | A blocked site gets no page suggestions (general examples instead), a read-only site no form filling, and… | Default |  |

Moved to Details (ids retired, not reused): `PROF-4`, `PROF-17`

## [13. "What was sent to the AI" and the cost display](13-sent-to-ai-and-cost.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `LOG-1` | Every request is recorded in one place, the provider wrapper, before it leaves; the API key is never read;… | Default |  |
| `LOG-2` | On disk only the outline is kept (time, provider, model, site, kinds and sizes, and the cost numbers), for… | Default |  |
| `LOG-3` | The content of requests is kept only in memory until the app closes: the latest 60 requests, 2,000,000… | Default |  |
| `LOG-4` | The location's coordinates are never kept in the log; the entry only says a location was sent. | Default |  |
| `LOG-5` | Requests from incognito conversations, or ones that touched an incognito tab, stay in memory only; when a… | Default |  |
| `LOG-6` | Hidden memory values and custom endpoint header values never appear in the log. | Default |  |
| `LOG-8` | The log is never in a backup; Clear browsing data has its own item for it. | Default |  |
| `LOG-9` | The activity history (what the assistant did) is kept the same way: 30 days and at most 2,000 rows, never… | Default |  |
| `LOG-10` | With an own key, the cost is the tokens the provider reported times the list prices in `src/ai/prices.ts`… | Default |  |
| `LOG-11` | Where the app has no price it shows tokens only, never a guess: the custom endpoint, models not in the… | Default |  |
| `LOG-12` | OpenRouter's reported cost is read as US dollars. | Default |  |
| `LOG-13` | Today Gemini's tool-use tokens are priced as input and its cached tokens are taken as part of the input. | **Waiting** |  |
| `LOG-14` | The price table is checked against the providers' pricing pages whenever prices change and at least… | Default |  |
| `LOG-15` | Only numbers are stored with the conversation (provider and model ids, request counts, tokens by kind, the… | Default |  |
| `LOG-16` | "Show approximate cost" is on by default and hides the figure both under answers and in the log. | Default |  |
| `LOG-17` | With Qutai Credits, the server's own charge is shown and kept as it is (never recomputed from prices), and… | Default |  |
| `LOG-18` | The figure is an estimate: discounts, batch prices, free allowances (Google's 5,000 free searches a… | Default |  |

Moved to Details (ids retired, not reused): `LOG-7`

## [14. Tabs, tab groups and conversations](14-tabs-and-conversations.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `TABS-1` | An ungrouped tab has its own conversation; all tabs of a group share one conversation. | Default |  |
| `TABS-2` | Joining: the group's conversation wins (a new group takes the first tab's); leaving: the conversation… | Default |  |
| `TABS-6` | A group that ever held an incognito tab never saves its conversation, like an incognito tab. | Default |  |
| `TABS-7` | A saved conversation keeps at most 300 items and about 1,000,000 characters of history (the oldest… | Default |  |
| `TABS-9` | Recently closed keeps at most 25 tabs. | Default |  |
| `TABS-10` | At most 5 tabs have a live page; the least recently viewed sleep first; never put to sleep: the active… | Default |  |
| `TABS-11` | Only one task runs at a time, claimed in the same moment as the send; a send turned away keeps its text; Stop or closing a tab frees the… | Default | 2026-11-20 |
| `TABS-12` | While a task works, the input is closed: nothing typed is queued or passed to the task, dictation into the… | Default |  |
| `TABS-13` | The working glow shows only on the task's tab, only while it is on screen and working; off while a… | Default |  |
| `TABS-14` | Links in an answer, the search box and Sources cards open in the conversation's tab group; an incognito… | Default |  |
| `TABS-15` | A task that ends while the user is in Qutai but looking at another tab shows a toast with Show and a dot… | Default |  |
| `TABS-16` | When a task has ended, its runs of 3 or more steps fold into one summary line; a running task stays live. | Default |  |
| `TABS-17` | On long tasks the assistant keeps notes (`take_notes`) that are never trimmed while old page contents are;… | Default |  |
| `TABS-18` | A navigation is pending from the moment the app lets a top-frame navigation through for the user's tap… | Default | 2026-11-20 |
| `TABS-19` | The progress line (3 pt, was 2) starts at once at 10 %, creeps towards 30 % ever more slowly while the… | Default | 2026-11-20 |
| `TABS-20` | While a navigation the page started (a link tap, a script, a redirect) waits for its site, the address… | Default | 2026-11-20 |
| `TABS-21` | After 4 s without an answer the line says the site isn't answering yet, with Stop; after 25 s it says… | Default | 2026-11-20 |
| `TABS-22` | The page on screen stays until the new one commits; a tab leaving the new tab page keeps showing the new… | Default | 2026-11-20 |
| `TABS-23` | A window a page opens comes to the front only when that page is on screen and the user touched it in the… | Default | 2026-11-20 |
| `TABS-24` | A tab whose page failed because the phone was offline reloads by itself once when the connection… | Default | 2026-11-20 |
| `TABS-25` | Re-sending a submitted form asks first on both platforms (Android through the patched WebView, "don't send" after 30 s… | Default | 2026-11-20 |
| `TABS-26` | A woken tab comes back at the scroll position it had on the same page (the page reports it half a second… | Default | 2026-11-20 |
| `TABS-27` | After the user closes the assistant's tab, its next call on that tab fails clearly instead of acting on the tab on screen | Default | 2026-11-20 |
| `TABS-28` | A conversation is saved on send, after each completed step, at the end and on leaving the foreground; a killed task shows as… | Default | 2026-11-20 |
| `TABS-29` | Typing in the chat input is saved per conversation 800 ms after typing stops, and at once on a switch or on leaving the foreground | Default | 2026-11-20 |
| `TABS-30` | A page whose process ends reloads once; the same page again within a minute shows "This page stopped working"… | Default | 2026-11-20 |

Moved to Details (ids retired, not reused): `TABS-3`, `TABS-4`, `TABS-5`, `TABS-8`

## [15. The assistant's tools and phone actions](15-tools-and-phone-actions.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `TOOL-1` | The assistant never sends a message itself: `offer_call`, `draft_sms` and `draft_whatsapp` only add a card… | Default |  |
| `TOOL-2` | `draft_email` opens the phone's mail composer with recipients, subject, body and files; the user decides… | Default |  |
| `TOOL-3` | `share` (WhatsApp or any app) shows a card; only the user's tap prepares the files and opens the target; a… | Default |  |
| `TOOL-5` | A text message is at most 1,000 characters and a WhatsApp message at most 2,000; WhatsApp needs an… | Default |  |
| `TOOL-6` | `find_contact` gives the AI only names, labels ("mobile", "work email") and short-lived codes, never… | Default |  |
| `TOOL-7` | The `settings` tool may change only these: theme, address bar position, text size (50–200 %,… | Owner | 2026-11-15 |
| `TOOL-8` | Refused by the `settings` tool, with the reason and an offer to open Settings: ask before every action;… | Default |  |
| `TOOL-9` | A new setting is not changeable from the chat unless someone deliberately adds it to `CHANGEABLE` after… | Default |  |
| `TOOL-10` | Today "Show where the assistant acts" is not in the settings tool. | **Waiting** |  |
| `TOOL-11` | Settings changes need no confirmation; each shows a line in the chat and in the activity history, and the… | Default |  |
| `TOOL-12` | The assistant changes settings and bookmarks only when the user asks in their own words; a page, file or… | Default |  |
| `TOOL-13` | `bookmarks`: adding, moving, renaming and new folders run without asking; a removal shows "Bookmark… | Default |  |
| `TOOL-14` | In incognito conversations `bookmarks` can only add a page at the top level and remove one; listing,… | Default |  |
| `TOOL-15` | `search_history` searches the history on the phone and sends only matching pages to the AI (one per… | Default |  |
| `TOOL-16` | Calendar events, reminders and notifications are confirmed with their details each time; reading the… | Default |  |
| `TOOL-17` | "Don't ask again" is offered only for device kinds (a notification, a calendar event, a reminder, reading… | Default |  |
| `TOOL-19` | "Ask before every action" is off by default. | Default |  |
| `TOOL-20` | The assistant has no tool for writing to the clipboard; only the user copies. | Default |  |
| `TOOL-21` | Qutai never types a payment card number, whatever the AI was told; final payment buttons and presses that… | Owner | 2026-11-19 |
| `TOOL-22` | Only files that belong to the conversation can leave it: images and PDFs the user attached, edited images,… | Default |  |
| `TOOL-23` | Up to 4 images per message; the original stays untouched and a copy for the AI is made once (turned… | Default |  |
| `TOOL-24` | Pasting an image into the message field is not supported. | Default |  |
| `TOOL-25` | `read_pdf` reads PDFs on the phone with a bundled PDF.js in a hidden page that may make no network… | Default |  |
| `TOOL-26` | `upload_image` and `upload_file` ask "Give this image to <site>?" every time, whatever the site's setting;… | Default |  |
| `TOOL-27` | `edit_image` works on the phone with no AI request; results are at most 16 megapixels; a conversation… | Default |  |
| `TOOL-29` | If a page shows a CAPTCHA, the assistant does not solve it; it asks the user to. | Default |  |
| `TOOL-30` | One table row per tool (target, tab need, address, background, history, own dialog, checks) and one ordered check pipeline; a tool without a row is refused | Default | 2026-11-20 |
| `TOOL-31` | A tool's uncaught error is that call's error result (only Stop throws); a cut-off Anthropic tool call gets an empty input | Default | 2026-11-21 |
| `TOOL-32` | "Ask before actions" is read at every tool call; a change during a task applies from its next step | Default | 2026-11-21 |
| `TOOL-33` | `open_settings` `default_browser` is Android only; on iOS it refuses and opens nothing; profile id changed. | Owner | 2026-11-21 |

Moved to Details (ids retired, not reused): `TOOL-4`, `TOOL-18`, `TOOL-28`

## [16. Saved, scheduled and background tasks](16-tasks.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `TASK-1` | A scheduled task is only a reminder: a local notification at the time; it never runs without the user's… | Default |  |
| `TASK-3` | Only the task's id travels in its notification; a private task's notification shows only its name, never… | Default |  |
| `TASK-4` | Task reminders use at most 48 pending notifications (soonest first), leaving room within iOS's limit of 64… | Default |  |
| `TASK-5` | A saved task has a name of up to 80 characters and a request of up to 4,000; at most 200 tasks; new tasks… | Default |  |
| `TASK-6` | A saved task carries no model of its own. | Owner | 2026-11-15 |
| `TASK-7` | The assistant may only list and read saved tasks (`list_saved_tasks`, `get_saved_task`: by name, ignoring… | Default |  |
| `TASK-8` | "Keep working in the background" exists only on Android and is off by default. | Default |  |
| `TASK-9` | The background run uses an Android foreground service of the "special use" kind with an ongoing… | Default |  |
| `TASK-10` | In the background nothing is approved for the user: confirmations, questions (and so CAPTCHAs),… | Default |  |
| `TASK-11` | Incognito conversations never continue in the background. | Default |  |
| `TASK-12` | The assistant cannot turn background work or its notification on or off. | Default |  |
| `TASK-13` | A task notification is never posted while Qutai is on screen, for an incognito conversation, when the… | Default |  |
| `TASK-15` | A notification the assistant scheduled carries only internal ids (the tab's and the group's; for an… | Default |  |
| `TASK-16` | Calendar events, reminders and notifications are never added from incognito conversations. | Default |  |
| `TASK-17` | A task has its own identity; the shared state it sets records it, and its end clears only what it still owns | Default | 2026-11-20 |
| `TASK-18` | Stop interrupts a running tool's waits and ends the step within about a second; every tool call keeps a result in the history | Default | 2026-11-20 |

Moved to Details (ids retired, not reused): `TASK-2`, `TASK-14`

## [17. Contacts](17-contacts.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `CON-1` | Contact numbers and email addresses never reach the AI. The model gets only names, labels ("mobile", "work… | Default |  |
| `CON-2` | A lookup runs only for a name the user typed or said. Every word of the name must start a word in the… | **Waiting** |  |
| `CON-3` | A lookup returns at most 5 people. | **Waiting** |  |
| `CON-4` | Qutai's picker shows at most 8 rows (people × their numbers or addresses). Rows beyond 8 are left out. | **Waiting** |  |
| `CON-5` | A handle works only in the conversation that made it, and for 30 minutes after the lookup. A forged,… | **Waiting** |  |
| `CON-6` | A handle is `ct-` plus 8 random characters (a–z, 0–9) from the platform's secure random source, plus `.N`… | Default |  |
| `CON-7` | Lookups with fewer than 2 letters, with wildcards (`* ? % _`) or with more than 4 words are refused. | Default |  |
| `CON-8` | Only `offer_call`, `draft_sms`, `draft_whatsapp` and `draft_email` turn a handle into a real value. A… | Default |  |
| `CON-9` | Nothing is called or sent automatically. The user taps Call, and sends the text, WhatsApp message or email… | Default |  |
| `CON-10` | There is no approval dialog for each lookup. | Default |  |
| `CON-11` | The contacts permission is offered in setup (an optional row) and otherwise asked at the first lookup as before… | Owner | 2026-11-19 |
| `CON-12` | In a conversation that involves an incognito tab, `find_contact` and every use of a handle are refused,… | Default |  |
| `CON-13` | Saved conversations and backups keep a card's name, label and message text, never the number. A restored… | Default |  |
| `CON-14` | The action history records only who a card was for (for example "Offered a call button: Ahmet Yılmaz"),… | Default |  |
| `CON-15` | Contacts put nothing into memory automatically. "Ayşe is my sister" goes through `remember` like any other… | Default |  |
| `CON-16` | Contacts are read only. Android's `WRITE_CONTACTS` permission is blocked. | Default |  |
| `CON-19` | The model sees standard labels as given. A custom label is passed only if it has no digits and no "@" (cut… | Default |  |
| `CON-20` | A WhatsApp number saved without a country code gets the code of the phone's region, without the trunk… | Default |  |
| `CON-21` | With iOS 18 limited access, lookups see only the contacts the user shared. When nothing matches, the… | Default |  |
| `CON-23` | Both privacy policies (open-source and pro, English and Turkish) have a "Your contacts / Kişileriniz"… | Owner | 2026-11-19 |
| `CON-24` | Store forms are still open: the App Store privacy label (Contacts › App Functionality, not linked, no… | **Waiting** |  |

Moved to Details (ids retired, not reused): `CON-17`, `CON-18`, `CON-22`

## [18. Page styles](18-page-styles.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `STY-1` | Every style is approved in Qutai's dialog, every time, with the description, the site and the CSS under… | Default |  |
| `STY-2` | The CSS is parsed and written back from the parse, not pattern-matched. Only the written-back CSS is… | Default |  |
| `STY-3` | These are allowed: | Default |  |
| `STY-4` | The whole stylesheet is refused, with the reason, if it contains any of these: | Default |  |
| `STY-6` | Applying a style is refused on sites set to "Read only" or "Blocked". Listing and undoing are refused on… | Default |  |
| `STY-7` | Nothing is kept from an incognito tab: the card shows no Keep, and keeping is refused. Kept styles still… | Default |  |
| `STY-8` | The model can't keep, edit or delete kept styles. It can only apply (with approval), undo the trial and… | Default |  |
| `STY-9` | "Everywhere" (`*`) is a scope for styles only. Hide rules can't have it. | Default |  |
| `STY-10` | Keep offers this page, pages under this path, this site, this site and its subdomains, or everywhere. The… | Default |  |
| `STY-12` | There are at most 200 kept styles in all and 20 per site. | Default |  |
| `STY-13` | Styles apply whatever "Block ads and trackers" and "Don't block on this site" say. They have their own… | Default |  |
| `STY-14` | Whenever a kept or trial style applies, the page menu offers "Styles off for this page". This lasts for… | Default |  |
| `STY-16` | Styles reach the main frame only. They never reach frames, the reader view, the PDF view, the new tab page… | Default |  |
| `STY-17` | The trial style lasts until the tab loads another page. Undo removes it at once; after a page change, Undo… | Default |  |
| `STY-18` | In the rules file, each style is a block of comment lines (`! [style] {json}`, `! \| css`, `! [end]`), so… | Default |  |
| `STY-19` | Kept styles are in the encrypted backup and the server backup (`sites.styles`), checked again on restore.… | Default |  |
| `STY-20` | The action history records only that a style was applied, never the CSS. | Default |  |
| `STY-21` | Style cards in restored chats still offer Keep, while script cards don't. | **Waiting** |  |
| `STY-22` | Kept styles on sites set to "Blocked" still apply wherever their scope says. | **Waiting** |  |
| `STY-23` | The model is told to use `restyle_page` with short, specific CSS for look changes. Qutai-wide text size… | Default |  |
| `STY-24` | Page styles are covered by the legal-version bump of 19 Nov 2026: open-source 2 → 3 (its comment names… | Owner | 2026-11-19 |

Moved to Details (ids retired, not reused): `STY-5`, `STY-11`, `STY-15`

## [19. Cookies](19-cookies.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `COOK-1` | Cookie values never reach the AI. The model gets only names, domains, paths, expiry, size and flags. | Default |  |
| `COOK-2` | Cookie values exist only in the Cookies view's memory while it is open. They are never logged, never in… | Default |  |
| `COOK-3` | The assistant deletes cookies only by handles from its last list of this tab and page (at most 50), and… | Default |  |
| `COOK-4` | Listing is refused on sites set to "Blocked". Deleting is refused on "Read only" and "Blocked" sites. | Default |  |
| `COOK-5` | The assistant should list cookies only for "which cookies" questions and delete them only when the user… | Default |  |
| `COOK-6` | Nothing read from the native cookie store is ever put into a page or given to a page script. "Which… | Default |  |
| `COOK-8` | On an Android WebView without the cookie-info feature, the list has names only. The model and the view say… | Default |  |
| `COOK-9` | An incognito tab lists and deletes in its own store: on iOS the tab's non-persistent store, on Android the… | Default |  |
| `COOK-12` | The action history records only that cookies were deleted, never cookie names or values. Listing is not… | Default |  |
| `COOK-13` | The privacy policies say the assistant gets cookie names, sites and settings, never values. The legal… | Owner | 2026-11-19 |
| `COOK-14` | Third-party cookies are blocked by default on Android (Settings › Privacy and security › "Block… | Default |  |

Moved to Details (ids retired, not reused): `COOK-11`, `COOK-7`, `COOK-10`

## [20. Page scripts](20-page-scripts.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `SCR-1` | Scripts are off by default. Turning them on asks once more. The assistant's `settings` tool can't change… | Default |  |
| `SCR-2` | While the setting is off, no script runs at all, one-off or kept. | Default |  |
| `SCR-3` | Every run is approved in Qutai's dialog, every time, unless the site is remembered (`SCR-36`); dialog shows description, site, where… | Default / Owner | 2026-11-23 |
| `SCR-4` | The code that runs is the code that was shown, checked against its hash right before the run. Nothing runs… | Default |  |
| `SCR-5` | Sites set to "Read only" or "Blocked", or with scripts switched off, never run scripts, one-off or kept. | Default |  |
| `SCR-6` | Sensitive pages are refused by default, in both modes. A page is sensitive if it has any of these: | Default |  |
| `SCR-7` | The sensitive-page lists are a first version. | **Waiting** |  |
| `SCR-8` | Scripts can run on one sensitive site only if the user sets that site to "Allowed on sensitive pages" in… | Default |  |
| `SCR-9` | No script runs while a publish or pay approval is waiting in the tab. | Default |  |
| `SCR-10` | A static check (a JavaScript tokenizer plus rules) refuses code that does any of these, with the reason… | Default |  |
| `SCR-12` | Scripts may not press buttons, submit forms, navigate or open windows. One-off live-page scripts may not… | **Waiting** |  |
| `SCR-14` | Inside a script, `fetch` is Qutai's guarded version: same origin as the page only, GET or HEAD only, no… | Default |  |
| `SCR-15` | `copy` is the default. The copy is a snapshot of the page's main frame, loaded into a hidden WebView… | Default |  |
| `SCR-16` | A run has a 10-second limit. A copy is then destroyed. On the live page, the app stops waiting but can't… | Default |  |
| `SCR-17` | A script's result is untrusted page data. It is JSON, cut at 64 KB in the page and 16 KB for the model,… | Default |  |
| `SCR-18` | Scripts reach the main frame only and can't reach frames. | Default |  |
| `SCR-19` | Scripts run in the page's main JavaScript world on both platforms. iOS's isolated content world… | **Waiting** |  |
| `SCR-20` | Kept scripts have two run times: `end` (DOMContentLoaded, the default) and `idle` (after load). There is… | **Waiting** |  |
| `SCR-21` | A kept script runs only on the site it was kept for (page, path, site, or site and subdomains), never… | Default |  |
| `SCR-22` | Keep is offered only after a successful live-page run, never from incognito, and only on cards made in… | Default |  |
| `SCR-23` | Each kept script carries a seal: an HMAC-SHA-256 of its code under a device key in secure storage (this… | Default |  |
| `SCR-24` | Imported scripts always arrive switched off and unsealed, listed with their flags. The import dialog… | **Waiting** |  |
| `SCR-27` | Kept scripts never run in incognito tabs, and nothing is kept from incognito. One-off scripts may run in… | Default |  |
| `SCR-29` | The page menu's **Scripts off for this page** stops kept scripts in that tab. It is kept in memory, and… | Default |  |
| `SCR-30` | A kept script's last run is stored only as ok, error kind (for example `TypeError`), skipped (sensitive… | Default |  |
| `SCR-31` | In My rules, the code editor runs the check on save, and refused code is not saved. Saving changed code… | Default |  |
| `SCR-32` | There are at most 50 kept scripts, 10 per site, names of at most 80 characters and descriptions of at most… | Default |  |
| `SCR-33` | The model is told to use `run_script` only when reading and the other tools can't answer, to use `copy`… | Default |  |
| `SCR-34` | The privacy policies list "the result of a script you approved on a page" among what goes to the AI. The legal version went up… | Owner | 2026-11-20 |
| `SCR-35` | App Review notes for scripts, and whether Qutai needs Google Play's in-app way to report AI output, are… | **Waiting** |  |
| `SCR-36` | The script dialog's box "Run scripts on {site} without asking" (off) skips the dialog there later; every other check stays; not incognito, Read only, Blocked, background or backups | Owner | 2026-11-23 |

Moved to Details (ids retired, not reused): `SCR-11`, `SCR-13`, `SCR-25`, `SCR-26`, `SCR-28`

## [21. Image editing and filters](21-image-editing.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `IMG-1` | `edit_image` works only on the phone. It makes no AI request and sends nothing anywhere. | Default |  |
| `IMG-3` | An image is never enlarged unless the request explicitly allows it (`allow_upscale`). | Default |  |
| `IMG-6` | Edited images carry no EXIF or GPS data, because Skia's encoders write none. Attached originals are… | Default |  |
| `IMG-8` | An edit made in a conversation that touched incognito, or an edit of an incognito image, lives only as… | Default |  |
| `IMG-9` | A conversation keeps its 12 newest edited images. Older ones that nothing depends on lose their files, and… | Default |  |
| `IMG-15` | `upload_image` asks every time, whatever the site's setting. The dialog shows the image, its size, bytes… | Default |  |
| `IMG-16` | Only images from this conversation can be uploaded: ones the user attached, or edits of them. Screenshots,… | Default |  |
| `IMG-17` | The assistant never uploads because a page asks. It only uploads when the user wants it. | Default |  |
| `IMG-18` | An image never crosses the incognito boundary. An incognito image can't go into a normal tab, and a normal… | Default |  |
| `IMG-19` | Images go only to https pages. A non-https page, an uploader in a frame from another site, or an uploader… | Default |  |
| `IMG-20` | `upload_image` is refused in these cases: | Default |  |
| `IMG-21` | `upload_image` never submits the form. Submitting is a separate step under the usual confirmation rules. | Default |  |
| `IMG-23` | The action history records only that an image was given to a site and where, never the image. | Default |  |
| `IMG-24` | Video editing (the other half of the 18 Nov media request) is postponed. | Owner | 2026-11-19 |

Moved to Details (ids retired, not reused): `IMG-2`, `IMG-4`, `IMG-5`, `IMG-7`, `IMG-10`, `IMG-11`, `IMG-12`, `IMG-13`, `IMG-14`, `IMG-22`

## [22. Apps inside Qutai](22-apps.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `APPS-1` | An app runs only when its current version carries this phone's seal, its state is active, and its contract… | Default |  |
| `APPS-2` | Only the user's **Turn on** approves an unsealed or switched-off app. It re-checks the package, seals it… | Default |  |
| `APPS-3` | An imported app arrives switched off and unsealed, with no grants and with the author set to "imported… | Default |  |
| `APPS-4` | Apps are offline: no network at all in phases 1 to 3. Three layers enforce this: | Owner | 2026-11-19 |
| `APPS-5` | Each app runs in its own WebView, created when it opens and destroyed when it closes. It has its own data… | Owner | 2026-11-19 |
| `APPS-7` | Web storage, cookies and the browser's powerful APIs are refused inside apps: | Default |  |
| `APPS-8` | An app never navigates. Only its own document (and `#fragment` links inside it) is allowed. Links,… | Default |  |
| `APPS-9` | Frames and plugins are not allowed: no script API can add a frame, frame markup is neutralised at build… | Default | 2026-11-19 |
| `APPS-10` | The app's WebView has file access, location, camera and microphone switched off. Mixed content, form… | Default |  |
| `APPS-11` | The app reaches the phone only through bridge contract 1. Every call is checked in this order: known call,… | Owner | 2026-11-19 |
| `APPS-12` | Permissions work as follows: | Default |  |
| `APPS-13` | Only one Qutai dialog is open at a time (the next call gets `E_BUSY`), and at most 32 calls can be in… | Default |  |
| `APPS-14` | Each app may store up to 5 MB of data, counted in UTF-8 bytes. One value or document may be up to 256 KB,… | **Waiting** |  |
| `APPS-16` | Every create, change, rename, restore and import is a new version. Undo moves back to the previous kept… | Owner | 2026-11-19 |
| `APPS-17` | The 20 newest versions plus the current one are kept, and older ones are deleted when a new one is saved.… | **Waiting** |  |
| `APPS-18` | An app package is one manifest plus files: | Owner | 2026-11-19 |
| `APPS-21` | The `apps` tool cannot be used from an incognito conversation or one that touched an incognito tab. It… | Default |  |
| `APPS-22` | The assistant makes or changes an app only when the user asks; "a page asking is never a reason". It stops… | Default |  |
| `APPS-23` | "Ask Qutai to fix this" puts the report in the input for the user to send; console values only as types and lengths… | Default | 2026-11-19 |
| `APPS-24` | Diagnostics work as follows: | Default |  |
| `APPS-26` | An app never starts by itself. It opens only from My apps, the chat card, or a preview the assistant asked… | Default |  |
| `APPS-27` | Deleting an app removes every version, its permission answers and all its data, after a confirmation that… | Default |  |
| `APPS-28` | Apps are available in every build, not only pro mode. Writing one is an ordinary assistant request;… | Owner | 2026-11-19 |
| `APPS-29` | Sharing is by file only. There is no gallery, store or catalogue of apps. | Owner | 2026-11-19 |
| `APPS-31` | Export is without data by default; "with my data" is the user's choice, and the file name then ends in "… | Default |  |
| `APPS-33` | Format 1 has no author signatures. | Default |  |
| `APPS-34` | Imports start only from a user's tap: My apps › Import an app, opening a `.qutaiapp` from outside (after… | Default |  |
| `APPS-35` | The import screen and the approval screen show the same review: | Default |  |
| `APPS-36` | When an import clashes by id or name, the user picks **Keep both** (a new id, name " 2") or **Replace**… | Default |  |
| `APPS-37` | On Android, Qutai opens files sent as `application/vnd.qutai.app+json` and also… | Owner | not recorded |
| `APPS-38` | Backups (the encrypted file and the server backup) carry each app's current version with its seal, state… | Default |  |
| `APPS-39` | Restore re-checks each app and skips one that fails, never the whole restore. | Default |  |
| `APPS-40` | If a server backup with apps' data is over the account's per-backup limit, it is made again without apps'… | Default |  |
| `APPS-41` | On Android, apps run in a native sandbox (a patched WebView prop, `appSandbox`, runner only). It blocks… | Default |  |
| `APPS-42` | Residual app risks accepted: WebRTC can't be switched off in a WebView (the `window[0]` frame route is closed, `APPS-9`); DNS prefetch… | Default | 2026-11-19 |
| `APPS-43` | Phase 3 phone features are each declared and asked per app. `assistant.ask` shows each question and its… | **Waiting** |  |
| `APPS-44` | Phase 4 network goes only through Qutai's `network.fetch`, to https hosts listed in the manifest, with no… | Default |  |
| `APPS-45` | Apps have ⋮ › Report in My apps and in the running app's menu, in builds with Qutai's server (`SAFE-1`,… | Owner | 2026-11-21 |
| `APPS-46` | The privacy policies say nothing about apps yet, and the legal version is not bumped. The proposed… | **Waiting** |  |
| `APPS-47` | The App Review notes describe apps as personal tools written at the user's request: | Default |  |
| `APPS-49` | The file backup and the server backup each keep their own Apps and Apps' data choice. Apps' data can only… | Default |  |
| `APPS-50` | The approval screen of an app made with Qutai but not sealed here (restored elsewhere, or changed) leaves… | Default |  |

Moved to Details (ids retired, not reused): `APPS-6`, `APPS-20`, `APPS-19`, `APPS-30`, `APPS-32`, `APPS-15`, `APPS-25`, `APPS-48`

## [23. Downloads and opening Qutai from other apps](23-downloads-and-links.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `DL-1` | Only http, https, blob and data addresses can be downloaded; others are refused with a notice. | Default |  |
| `DL-2` | A download a page starts without a recent tap (10 seconds) asks first, with a warning if the file is risky. | Default |  |
| `DL-3` | From the second automatic download of a site in a session, the question offers "Block downloads from this… | Default |  |
| `DL-4` | A risky file (apps, installers, executables, scripts, disk images, archives; a generic binary without an… | Default |  |
| `DL-5` | The assistant's download is confirmed with name, site, type, size and any risk warning, unless "Don't ask… (a model-written address: nothing requested before the answer, always asked) | Default | 2026-11-20 |
| `DL-6` | The assistant may download only http(s) files, and not from a site set to "Read only" or "Blocked". | Default |  |
| `DL-7` | The assistant never opens or reads a downloaded file, and never downloads something the user didn't ask for. | Default |  |
| `DL-8` | Android 9 and older ask for the storage permission at the first download; Android 13 and newer ask for the… | Default |  |
| `DL-9` | "Open" on a downloaded app file (APK) hands it to the system installer; Qutai never installs anything… | Default |  |
| `DL-10` | Everything that reaches Qutai from outside is untrusted: a web link opens in a normal tab; other text is… | Default |  |
| `DL-11` | `qutai://` links are read strictly (exact names, no unknown or repeated parameters) and never act by… | Default |  |
| `DL-13` | Each item from outside is handled once, and waits behind the app lock until the user unlocks. | Default |  |
| `DL-14` | An email sign-in link is never opened as a page or treated as a `qutai://` action. | Default |  |
| `DL-15` | A page may ask to open another app (tel:, mailto:, whatsapp:, intent://) only within 3 seconds of a user… | Default |  |
| `DL-16` | The home screen widget shows no history, tabs or other personal data. | Default |  |
| `DL-17` | "Add to home screen" is not offered for incognito tabs. | Default |  |

Moved to Details (ids retired, not reused): `DL-12`

## [24. Reader mode, media and downloads on screen](24-reader-and-media.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `MEDIA-2` | The reader view is an inert copy of the article built through an allowlist (no scripts, styles, frames,… | Default |  |
| `MEDIA-3` | Reader mode settings: theme follows the app ("auto"), serif typeface, easier reading off by default; all… | Default |  |
| `MEDIA-4` | Assistant actions that look at or act on the page leave reader mode first; `read_page` still reads the… | Default |  |
| `MEDIA-5` | "Keep playing in the background" and "Picture-in-picture" are both on by default. | Default |  |
| `MEDIA-6` | iOS: when Qutai leaves the screen, a video WebKit paused is played again (sound only) and, while sound… | Default |  |
| `MEDIA-7` | Whether iOS background play of YouTube is acceptable under YouTube's terms and App Review is open; today… | **Waiting** |  |
| `MEDIA-10` | Qutai never asks for a battery-optimisation exemption; Settings › Appearance › Media shows an Android hint… | Default |  |
| `MEDIA-11` | Android PiP on youtube.com is offered only when YouTube's player says the video may play in the… | Default |  |
| `MEDIA-12` | YouTube without Premium not opening PiP is expected and accepted. | Owner | 2026-11-16 |
| `MEDIA-14` | No PiP for incognito tabs or while the app lock is on; incognito tabs show "Private tab" in the media… | Default |  |
| `MEDIA-15` | Android downloads use Qutai's own engine (not the system DownloadManager): the tab's user agent, referrer… | Default |  |
| `MEDIA-17` | iOS saves into Qutai's own Downloads folder (then Save to Files) with progress and cancel only, no resume. | Default |  |
| `MEDIA-18` | The download pill's close button, a sideways swipe or the screen reader's "Hide" action hide it without… | Default |  |
| `MEDIA-19` | "Open" on a download never fails silently: a file deleted elsewhere, no app for its type, lost access or a… | Default |  |
| `MEDIA-20` | On Android an APK opens in the system installer, which asks "allow from this source" itself; Qutai… | **Waiting** |  |
| `MEDIA-23` | Incognito downloads are listed only while the incognito session lasts and never written down; unfinished… | Default |  |
| `MEDIA-24` | Downloads always go to the Downloads folder (Android) or Qutai's Downloads (iOS); there is no "Ask where… | Default |  |
| `MEDIA-25` | A page gets the camera or microphone only for the site in the address bar (main frame of exactly that… | Default |  |
| `MEDIA-26` | Each site has ask / allow / block per kind; "Allow once" lasts for the page; incognito tabs keep a stored… | Default |  |
| `MEDIA-27` | Screen sharing (`getDisplayMedia`) is always refused; http pages get no camera or microphone. | Default |  |
| `MEDIA-28` | Capture is paused while another tab is shown or Qutai is in the background; revoking reloads the page. | Default |  |

Moved to Details (ids retired, not reused): `MEDIA-1`, `MEDIA-8`, `MEDIA-9`, `MEDIA-13`, `MEDIA-16`, `MEDIA-21`, `MEDIA-22`

## [25. Voice input and read-aloud](25-voice.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `VOICE-1` | Speech becomes text only through the phone's system speech recogniser (on-device, or Apple's / Google's… | Default |  |
| `VOICE-2` | Recognition runs on the phone whenever that can be enforced; Qutai decides "on-device" itself (iOS only… | Default |  |
| `VOICE-3` | Online recognition (Apple's or Google's service) is used only after a one-time explicit agreement naming… | Default |  |
| `VOICE-4` | Incognito conversations never use online recognition; without on-device recognition voice input is off… | Default |  |
| `VOICE-5` | No audio is written to disk (`persist: false`) and no audio goes to Qutai or the AI provider; only the… | Default |  |
| `VOICE-6` | Voice consent and the voice settings are not changeable by the assistant from the chat. | Default |  |
| `VOICE-7` | Dictated text is not sent automatically: "Send automatically after speaking" is off by default and never… | Default |  |
| `VOICE-8` | The listening language follows the order in "How it works"; only the user's own messages are judged, never… | Default |  |
| `VOICE-9` | A language the phone's recogniser lacks is skipped and the user is told which one is used instead; it is… | Default |  |
| `VOICE-11` | Push-to-talk records nothing while a task runs (the bubble says Qutai is busy and offers Open); an… | Default |  |
| `VOICE-13` | "Hold the Qutai button to talk" is on by default and is in backups. | Default |  |
| `VOICE-14` | With a screen reader there is no hold: the Qutai button offers "Start voice message", then "Send" and… | Default |  |
| `VOICE-15` | The microphone stops (keeping the words) when the panel closes, another conversation comes on screen, a… | Default |  |
| `VOICE-17` | Barge-in: starting to talk stops read-aloud; read-aloud turns the microphone off before it starts; a… | Default |  |
| `VOICE-19` | Read-aloud uses the most natural installed voice (iOS Premium › Enhanced › Siri › compact; Android by the… | Default |  |
| `VOICE-21` | A language with no installed voice is read with the phone's default voice and Qutai says so once per… | Default |  |
| `VOICE-24` | Read-aloud stays on the phone's own speech engine; an on-device neural voice (Supertonic-3) was evaluated and… | Owner | 2026-11-19 |

Moved to Details (ids retired, not reused): `VOICE-10`, `VOICE-12`, `VOICE-16`, `VOICE-18`, `VOICE-20`, `VOICE-22`, `VOICE-23`

## [26. Languages](26-languages.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `LANG-1` | The interface ships in exactly ten languages; English is the source and the fallback for any missing text. | Owner | not recorded |
| `LANG-2` | The default interface language is the first of the phone's languages that Qutai has, otherwise English. | Owner | not recorded |
| `LANG-3` | Settings › Language uses the system's per-app language on Android 13+ (both ways), Qutai's own stored… | Default |  |
| `LANG-24` | iOS: Settings › Language lists the languages and switches at once, writing the same per-app value as iOS Settings; iOS's own texts follow next launch. | Owner | 2026-11-24 |
| `LANG-5` | Turkish interface text addresses the user as "siz", including the setup questions, legal texts, iOS… | Owner | 2026-11-16 |
| `LANG-6` | Exceptions to "siz": texts the user sends to the assistant (suggestion prompts, custom-instruction… | Default |  |
| `LANG-22` | Turkish suffixes on "Qutai" follow its pronunciation "Kutay": Qutai'ın, Qutai'ı, Qutai'a, Qutai'da, Qutai'dan (no buffer consonant, back… | Owner | 2026-11-20 |
| `LANG-23` | Every key in en.ts is reached by the code or a declared key template; dead keys are removed from all ten languages (a test enforces it) | Default | 2026-11-20 |
| `LANG-7` | The assistant replies in the language the user writes in, even when it differs from the interface… | Default |  |
| `LANG-8` | The assistant addresses the user formally where the language distinguishes (siz, Sie, vous, usted, вы;… | Default |  |
| `LANG-9` | Every user message carries the interface language, and tool results name Qutai's buttons, screens and… | Default |  |
| `LANG-10` | What the AI reads stays English (tool results, prompts); the user sees a translated step line, and a… | Default |  |
| `LANG-16` | The privacy policy and terms are shown in the interface language in all ten languages; the eight translations say English… | Owner | 2026-11-20 |
| `LANG-17` | Today the eight newer translations are unreviewed by native speakers; brand names "Qutai Credits" / "Qutai… | **Waiting** |  |
| `LANG-18` | Today translate prompts say "into <interface language>" and examples use local cities. | **Waiting** |  |
| `LANG-19` | Android launcher shortcuts are dynamic, published in Qutai's language (start, language change, update); no static ones; pinned static copies… | Owner | 2026-11-20 |
| `LANG-21` | Setup starts with the language, preselected to the one Qutai already shows; a pick switches at once and is stored where Settings ›… | Owner | 2026-11-19 |
| `LANG-20` | The custom-instruction line "Always reply in Turkish" / "Her zaman Türkçe yanıt ver" added by older builds… | Owner | 2026-11-16 |

Moved to Details (ids retired, not reused): `LANG-4`, `LANG-11`, `LANG-12`, `LANG-13`, `LANG-14`, `LANG-15`

## [27. Interface](27-interface.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `UI-1` | Interface icons come only from the app's icon set (SF Symbols / Material Symbols); emoji and Unicode marks… | Default |  |
| `UI-4` | Every alert and confirmation goes through Qutai's themed dialog, never React Native's `Alert`. | Default |  |
| `UI-9` | An answer's bubble is 90% of the message column wide (100% with a table) whatever its content; a question… | Default |  |
| `UI-10` | The line under the panel title shows "provider · model"; if it doesn't fit, the model alone without its… | Default |  |
| `UI-12` | The address bar is at the bottom by default (new installs and anyone who never saved settings); a stored… | Default |  |
| `UI-14` | The Qutai button can be hidden (on by default); with it hidden, "Ask Qutai" at the top of the page menu… | Default |  |
| `UI-15` | The logo always animates (still under the system's Reduce motion); the "Animate the logo" switch was… | Default |  |
| `UI-16` | Haptics are on by default and the app's switch turns all of them off; decorative ticks follow Android's… | Default |  |
| `UI-17` | Launch shows no logo: the native splash is the theme's background colour; the mark fades in over 450 ms on… | Default |  |
| `UI-18` | The new tab page is Qutai's own screen (no web page loaded); it loads no site icons from third parties (a… | Default |  |
| `UI-19` | Suggestions in the empty panel are chosen on the phone from a few markers in the page's code (structured… | Default |  |
| `UI-21` | One look for listening and working: the light ("Işık"); the trial switch and the other two looks removed | Owner | 2026-11-21 |
| `UI-22` | The address bar's suggestion list never empties between letters; the search engine is asked only after a 200 ms typing… | Owner (engine pause) | 2026-11-19 |
| `UI-23` | The assistant's options as cards (`show_options`): picture, title, price as on the page, one detail line, site; a swipeable row in the panel and the answer card; tap opens like a chat link, long press the link menu… | Owner (cards); Default (shape, layout) | 2026-11-20 |
| `UI-24` | Card contents checked in the app: https only, the link's own host shown, plain cut text, at most 8, pictures only from the page, prices only when read; read_page adds `prices=` to cut links | Default | 2026-11-20 |
| `UI-25` | Card pictures fetched without cookies or Referer, ≤ 600 KB, JPEG/PNG/GIF/WebP by their bytes, ≤ 24 MP, memory only; ad and tracker hosts skipped while blocking is on | Default | 2026-11-20 |
| `UI-26` | Incognito: card pictures wait for "Show images" | Default (owner to confirm) | 2026-11-20 |
| `UI-27` | Corner radii from one token set (`radii` in theme.ts): windows 14, sheet 18, menus and bubbles 12, cards 12, main buttons 14, controls 8, inner 5; circles, chips, browser chrome fields and web content stay as they were; repeated style pieces from `common()` | Owner (lower); Default (values) | 2026-11-20 |
| `UI-28` | Text buttons have a minimum height, never a fixed one; one Button with a busy guard (a double tap can't run its action twice); shared settings rows and fact row; repeats from `common()` | Default | 2026-11-20 |
| `UI-29` | A streamed answer and typing redraw only the panel and the changed row: the conversation notifies its panel, the browser only for what the app shows; memoised rows, stable handlers | Default | 2026-11-20 |
| `UI-30` | The chat follows its end only while the user is at it; scrolling up shows "Jump to the latest message" | Default | 2026-11-20 |
| `UI-31` | One full screen open at a time, from one state (AppScreens); a late close shuts a screen only if still open | Default | 2026-11-20 |
| `UI-32` | Tab switcher and cookies screen virtualised; tab cards redrawn only when what they show changes | Default | 2026-11-20 |
| `UI-33` | Backup password fields: one PasswordField with an eye inside the field (own eye per field), 44 pt, announced; keyboard and cursor kept; new/current autofill hints; AI key fields unchanged | Owner (eye); Default (rest) | 2026-11-20 |
| `UI-34` | Address bar: registrable domain emphasised, the rest subdued, no https scheme, IDN in Unicode only when safe… | Default | 2026-11-20 |
| `UI-35` | Tapping the address bar selects the whole address on both platforms (focused from code, not autoFocus) | Default | 2026-11-20 |
| `UI-36` | The address bar slides away on scroll down and back on a small scroll up, unless something holds it; setting to keep it… | Default | 2026-11-20 |
| `UI-37` | A tap on the address suggestions or the dimmed area around them never reaches the page behind (drawn in a page-sized layer) | Default | 2026-11-21 |
| `UI-38` | The page menu fits the screen: fills the room between the bars (UI-47), list scrolls under a fixed icon row, opens above a bottom bar, side margins | Default | 2026-11-21 |
| `UI-39` | Android: tapping the address bar always opens the keyboard; asked for again at 60/250/600 ms while focused with none showing | Default | 2026-11-21 |
| `UI-40` | "Rate Qutai" opens the store's review page, never the in-app rating sheet. | Owner | 2026-11-22 |
| `UI-41` | Pro mode asks for the system rating sheet on its own on the 3rd and the 30th day of use, once each. | Owner | 2026-11-23 |
| `UI-42` | Android text without its own font family gets sans-serif (patched Text.js), so bold labels are measured and drawn alike. | Default | 2026-11-23 |
| `UI-43` | The status bar follows the tab switcher: dark icons on the light switcher, light on dark and incognito. | Default | 2026-11-23 |
| `UI-44` | The page menu scrolls only when its items are taller than its room (2 px rounding allowed). | Default | 2026-11-23 |
| `UI-45` | Icons filled on iOS (`.fill`) are filled on Android with the filled Material Symbols font; the rest stay outlined. | Default | 2026-11-23 |
| `UI-46` | A live theme switch measures and draws Android labels anew: family alias and view key follow the native scheme. | Default | 2026-11-23 |
| `UI-47` | The page menu is a fixed 230 pt wide and laid out in the room between the bars, so its rows are measured as drawn and it scrolls only when the room is full. | Default | 2026-11-23 |
| `UI-48` | Everything follows the app's theme through the palette (incognito always dark); toasts sit above every bar; listed exceptions over photos, video, camera and brand art; a test stops new literal colours. | Default | 2026-11-23 |
| `UI-49` | Android draws each text from the layout that was measured (prepared text layout, config plugin), so text never comes out wider than its box. | Default | 2026-11-23 |
| `UI-50` | Qutai never darkens pages: `prefers-color-scheme` follows the app's theme (live); the "Dark sites in dark mode" switch is gone. | Owner | 2026-11-23 |
| `UI-51` | ⋮ menu: no Copy link, Read aloud or visible-part screenshot; Cookies and Block ads moved up; Reader mode and Add to Home screen under More; Settings last. | Owner | 2026-11-23 |
| `UI-52` | "Ask Qutai" in the address bar suggestions only for more than one word, never for a lone address or word. | Owner | 2026-11-23 |
| `UI-53` | New tab page: no search box or Ask Qutai button; the aurora drifts slowly while on screen (still with Reduce Motion). | Owner | 2026-11-23 |
| `UI-54` | Settings pages are grouped: headed groups of rows in cards, the main page in four cards; pages open at the top, back returns to where they were. | Default | 2026-11-24 |
| `UI-55` | Settings › Assistant: provider, Answers, Memory and instructions on the page; Permissions, Voice input, Tasks and history as their own pages; the tour link closes Settings. | Default | 2026-11-24 |
| `UI-56` | Settings › Account: Apple's and Google's own sign-in buttons; signed in: identity, credits, ways to sign in (no add, `ACC-55`), then rare and destructive actions last. | Default | 2026-11-24 |
| `UI-57` | Filter lists opens at the top; grouped into publishers' lists, my lists, my rules, styles, scripts. | Default | 2026-11-24 |
| `UI-58` | "Make Qutai your default browser" moved from Settings › Search to Settings › About under Rate Qutai (Android only). | Owner | 2026-11-24 |
| `UI-59` | Backup's "What's included" (file and account backups), password and automatic backups are grouped cards with notes above and below. | Owner | 2026-11-24 |
| `UI-60` | Buy credits is a paywall: aurora, mark, gradient name, balance pill, three facts, pack cards with gradient price buttons and a "Most credits" badge, all on the first screen. | Owner | 2026-11-24 |
| `UI-61` | "Show the Qutai button tour" is in Settings › About, not Assistant. | Owner | 2026-11-24 |
| `UI-62` | Buy credits messages are floating notices (90 % opacity) in their tone's colour; they go on tap or after 4–10 s, "finishing" stays. | Owner | 2026-11-24 |
| `UI-63` | Credit packs show whole credits ("100") in smaller text and button; the balance keeps decimals. | Owner | 2026-11-24 |
| `UI-64` | ~~"Open Qutai's app settings" in About~~ (withdrawn: stays under Appearance › Media). | Withdrawn | 2026-11-24 |
| `UI-65` | No "Translate" quick action in the assistant panel; translation is asked for in words. | Owner | 2026-11-24 |

Moved to Details (ids retired, not reused): `UI-2`, `UI-3`, `UI-5`, `UI-6`, `UI-7`, `UI-8`, `UI-11`, `UI-13`, `UI-20`

## [28. Accessibility](28-accessibility.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `A11Y-1` | Every tappable element with a label or text announces itself as a button. | Default |  |
| `A11Y-2` | Screen readers hear when a task ends and the question when the assistant offers options; "Qutai is… | Default |  |
| `A11Y-5` | Every hold gesture has a screen-reader alternative (push-to-talk actions Start / Send / Cancel; the… | Default |  |
| `A11Y-6` | Reduce motion is honoured wherever something moves: panel, loading bar, logo, glow (still frame), marker… | Default |  |
| `A11Y-7` | Text size runs from 50% to 200% in steps of 10 (default 100%), applies to all tabs at once and is saved;… | Default |  |
| `A11Y-9` | Page and chat text scale with the phone's font size without limit; the fixed-height address bar and screen… | Default |  |
| `A11Y-12` | Force zoom is off by default; when on, it removes a page's zoom limits so the user can pinch-zoom up to 10×. | Default |  |
| `A11Y-13` | Reader mode's "easier reading" is off by default; reader colours have measured contrast and use the shared… | Default |  |

Moved to Details (ids retired, not reused): `A11Y-3`, `A11Y-4`, `A11Y-8`, `A11Y-10`, `A11Y-11`

## [29. Landscape](29-landscape.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `LAND-1` | The app follows the system's rotation: iPhone upright and both landscapes (never upside down), iPad all… | Default |  |
| `LAND-2` | Today there is no in-app "lock to portrait" setting; the system's rotation lock is the way to stop turning. | **Waiting** |  |
| `LAND-3` | Today the assistant panel in landscape is a side panel on the trailing edge, about half the width (320–420… | **Waiting** |  |
| `LAND-5` | Android's full-screen landscape keyboard is turned off for the panel's input, the address bar and the find… | Default |  |
| `LAND-7` | When the window changes size the action marker is cleared, and a `click_at` using a screenshot taken… | Default |  |
| `LAND-12` | Android's portrait and landscape screen features are optional, so Play doesn't hide Qutai from tablets, desktops and XR… | Default | 2026-11-22 |

Moved to Details (ids retired, not reused): `LAND-4`, `LAND-6`, `LAND-8`, `LAND-9`, `LAND-10`, `LAND-11`

## [30. Working mode](30-working-mode.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `WORK-1` | The marker, strip and glow are drawn by the app above the page; nothing is injected into the page, sent to… | Default |  |
| `WORK-2` | The marker and glow live outside the tab's container, so the assistant's screenshots never contain them,… | Default |  |
| `WORK-3` | Before a tap, typing, choosing or a tap by position, the marker shows and the action waits 320 ms;… | Default |  |
| `WORK-5` | "Show where the assistant acts" is on by default. | Default |  |
| `WORK-6` | Today "Show where the assistant acts" cannot be changed by the assistant from the chat. | **Waiting** |  |
| `WORK-7` | The strip's line is the chat's step line in the user's language, naming the element by what the page calls… | Owner | 2026-11-18 |
| `WORK-9` | (changed 20 Nov: or the question bubble) The panel and strip follow one state machine: a task drops the panel into the strip; the user's own open… | Default |  |
| `WORK-10` | Approvals and questions are dialogs above the strip and the glow, never behind them. | Default |  |
| `WORK-12` | The panel's input is closed for the whole task, including while an approval waits: read-only, dimmed,… | Default |  |
| `WORK-15` | When Qutai leaves the screen during a task, a "paused" notification is scheduled 8 s later and cancelled… | Default |  |
| `WORK-16` | Today the scroll step's line shows the English direction word ("Scrolling: down"). | **Waiting** |  |
| `WORK-17` | A task ending with a short question (≤ 140 characters, 2–4 short options) asks it in a bubble over the page instead of opening the panel | Owner (bubble); Default (limits) | 2026-11-20 |

Moved to Details (ids retired, not reused): `WORK-4`, `WORK-8`, `WORK-11`, `WORK-13`, `WORK-14`

## [31. Onboarding and the voice introduction](31-onboarding.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `INTRO-1` | Setup order is language, welcome, legal, AI, permissions, get-to-know-you (only with memory on),… | Default |  |
| `INTRO-2` | The privacy policy and terms must be accepted to continue; a new legal version asks everyone again. | Default |  |
| `INTRO-3` | The permissions step asks the system only when the user turns a switch on; every row is optional; there is… | Default |  |
| `INTRO-4` | The microphone row asks exactly what voice input asks on first use (microphone, and on iOS speech… | Default |  |
| `INTRO-5` | The chosen calendar is stored only on the phone (not in backups); a calendar that is gone falls back to… | Default |  |
| `INTRO-6` | "Use my location" sends the position to the platform's place-name service (Apple's on iOS, usually… | Default |  |
| `INTRO-8` | The Qutai button tour shows once after setup (existing installs once too), waits while the panel,… | Default |  |
| `INTRO-9` | The introduction uses one request with its own short prompt and no tools, recorded in "What was sent to… | Default |  |
| `INTRO-10` | The AI's answer is checked, not trusted: every note needs the user's own words, which must be found in the… | Default |  |
| `INTRO-11` | Age and gender are never asked; they are saved only when the user volunteers them. | Owner | 2026-11-17 |
| `INTRO-12` | At most three fixed, translated follow-up questions, chosen by code in the order food, name, shopping,… | Default |  |
| `INTRO-14` | Nothing is saved before Save on the review page; age, gender, allergy and health rows can be hidden from… | Default |  |
| `INTRO-16` | The privacy note sits right under the microphone and says: speech is turned into text on the phone or by… | Default |  |
| `INTRO-17` | The get-to-know-you step runs only with memory on; "Introduce yourself" on the Memory screen is offered… | Default |  |
| `INTRO-18` | Today, with Qutai Credits, the introduction's instructions travel at the start of the user's message,… | **Waiting** |  |
| `INTRO-19` | In official builds setup leads with Qutai Credits; Qutai Credits is saved only from the signed-in account… | Default |  |
| `INTRO-20` | Today own-key users get no sign-in step in setup. | **Waiting** |  |
| `INTRO-21` | Today the welcome and legal summary say "Private by design" / "we have no servers"; these must be… | **Waiting** |  |
| `INTRO-23` | Official builds ask about anonymous usage data once, right after setup, only while the server collects. | Default | changed 2026-11-22 |
| `INTRO-33` | With Qutai Credits the introduction is free (3 per account, server-owned prompt, facts only); any refusal falls back to the credits relay. | Owner | 2026-11-22 |
| `INTRO-32` | iOS: Settings › About (was Search, `UI-58`) has no "Make Qutai your default browser" row until Apple grants the web-browser entitlement; Android unchanged. | Owner | 2026-11-21 |
| `INTRO-31` | The city question has "Use my location" wherever setup asks it; the permission only on that tap; district, city… | Owner | 2026-11-20 |
| `INTRO-30` | Setup has no "Make Qutai your default browser" step; protection is the last step; the option is in Settings › About since `UI-58` (was Search). | Owner | 2026-11-20 |
| `INTRO-29` | Setup never asks for an answer style; a finished first-run setup adds "Answer briefly and to the point." to the custom… | Owner | 2026-11-20 |
| `INTRO-28` | In pro builds the AI step is an accordion: both headings visible at first sight on 360 x 640 dp, at the largest text sizes too; Qutai… | Owner | 2026-11-20 |
| `INTRO-27` | Setup never says the assistant reads every page: the first feature reads "Reads the page when you ask" and the tagline ends "when you… | Owner | 2026-11-20 |
| `INTRO-26` | "Tell me about yourself" opens on three choices (speak, type, "Ask me questions"); the microphone only after choosing to speak;… | Owner | 2026-11-19 |
| `INTRO-25` | Example people and sample sentences in setup use common names of the interface language (contacts row,… | Owner | 2026-11-19 |
| `INTRO-24` | The welcome and legal screens use smaller type (tighter under 760 dp and in landscape); text grows up to 1.4× then scrolls; the… | Owner | 2026-11-19 |

Moved to Details (ids retired, not reused): `INTRO-7`, `INTRO-13`, `INTRO-15`, `INTRO-22`

## [32. Performance](32-performance.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `PERF-3` | The system prompt and tool list stay byte-identical within a task (time, tab and identity go in the user's… | Default |  |
| `PERF-4` | A task has at most 40 steps (research 80), which bounds the conversation's size. | Default |  |
| `PERF-5` | Answer-length limits stay as they are (Anthropic 8,192 tokens with no thinking; OpenAI and Gemini 32,000). | Default |  |
| `PERF-6` | Not done: a one-hour cache, OpenAI's cache key, sending page changes instead of full readings, and changes… | Default |  |
| `PERF-7` | Today every request sends the full tool list (about 10,000 tokens) with the full descriptions; sending… | **Waiting** |  |
| `PERF-8` | Today none of the bigger start-up ideas is tried (static linking of iOS libraries, replacing the Skia… | **Waiting** |  |
| `PERF-10` | The step strip names elements instead of "ref 1" (the third item of the performance pass). | Owner | 2026-11-18 |
| `PERF-11` | Long conversations get a bounded request: the current task whole, earlier tool results cut, oldest exchanges left out in blocks; only the newest… | Default | 2026-11-20 |
| `PERF-12` | Page script forgets elements that left the page and stops timed-out or oversized fetches; tab switcher rows aren't remounted | Default | 2026-11-21 |

Moved to Details (ids retired, not reused): `PERF-1`, `PERF-2`, `PERF-9`

## [33. Accounts and sign-in](33-accounts.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `ACC-1` | Accounts, sign-in and Settings › Account exist only when pro mode is on and a server address is set;… | Owner | not recorded |
| `ACC-2` | Accounts join automatically only through a trustworthy address: an address proved with Qutai's own code, a… | Owner | 2026-11-16 |
| `ACC-3` | Unverified provider addresses and test-sign-in users never join accounts. | Owner | 2026-11-16 |
| `ACC-4` | Google and Apple sign-ins never join each other by address; they join only through an email sign-in method. | Default |  |
| `ACC-5` | A trustworthy address stored on an account is never replaced by an untrustworthy one from a later sign-in,… | Default |  |
| `ACC-6` | An email sign-in to an address that is the trustworthy address of two existing accounts is refused… | Owner | 2026-11-16 |
| `ACC-7` | A Google or Apple sign-in to an identity that already exists is never refused because of an address clash;… | Owner | 2026-11-16 |
| `ACC-8` | A suspended account is refused on every sign-in path, a deleted one too, and an address is never handed to… | Default |  |
| `ACC-10` | The server accepts an Apple or Google token only after checking its signature, issuer, audience (the… | Default |  |
| `ACC-11` | Sign in with Apple is offered on iPhone whenever Google is, and its capability is added only to pro builds. | Default |  |
| `ACC-13` | The access pass lasts 15 minutes and every request checks in the database that the session is live, so… | Default |  |
| `ACC-14` | Renewal passes are random, stored only as a keyed hash, last 60 days and work once; presenting a used one… | Default |  |
| `ACC-15` | The app keeps its passes in secure storage readable only on this phone, keeps no Apple or Google token,… | Default |  |
| `ACC-17` | An email sign-in sends one mail with a 6-digit code and a separate long link; using either ends both, and… | Owner | 2026-11-16 |
| `ACC-18` | Asking for an email code answers the same way for every address and never looks at whether an account exists. | Default |  |
| `ACC-19` | Email limits per address, phone and network address, and since 20 Nov caps on all mails (60/h, 200/day) and per network (20/day)… | Owner | 2026-11-16, changed 2026-11-20 |
| `ACC-20` | The code and the link work only on the phone that asked; a link opened elsewhere is refused without being… | Default |  |
| `ACC-22` | The mail links to an https page on Qutai's website that opens the app; the page never signs anyone in by… | Owner | 2026-11-17 |
| `ACC-23` | A sign-in link opened inside Qutai's own browser is never loaded: it never becomes a tab, a history entry,… | Default |  |
| `ACC-24` | Mails go through Mailjet with open and click tracking switched off per message; with no sender configured… | Owner | 2026-11-16 |
| `ACC-25` | Account mails (sign-in code, confirm code, method added, method removed, accounts combined) exist in all… | Owner | 2026-11-16 |
| `ACC-26` | When a sign-in method is joined to an existing account, every address on the account gets a notice mail;… | Owner | 2026-11-16 |
| `ACC-27` | Every change while signed in (add, re-check, combine) starts with a full sign-in with one method on the… | Default |  |
| `ACC-28` | Today adding a sign-in method needs only the session and the new method's own sign-in, no re-check of an… | **Waiting** |  |
| `ACC-29` | An address that is only another account's Google or Apple address can be added by proving it with a code;… | Default |  |
| `ACC-30` | Today removing a method needs a sign-in on this phone in the last 5 minutes with that method or one added… | **Waiting** |  |
| `ACC-31` | The last sign-in method can never be removed, checked inside the delete itself. | Default |  |
| `ACC-32` | Today removing a method leaves other phones signed in; the confirmation and the "method removed" mail (to… | **Waiting** |  |
| `ACC-33` | Removing an email method ends its pending codes and stops it joining sign-ins; removing Apple withdraws… | Default |  |
| `ACC-34` | Only the signed-in account can start a combine, by a full sign-in to one of the other account's own… | Default |  |
| `ACC-35` | The signed-in account survives a combine; the combine is final, the other account never signs in again and… | Default |  |
| `ACC-36` | Today someone who controls one method of another account (for example a stolen Google account) can combine… | **Waiting** |  |
| `ACC-37` | A combine moves the whole balance including a debt, purchase records (a later refund is taken from the… | Default |  |
| `ACC-39` | "Sign out of all devices" ends every session of the account and kills pending email codes for its addresses. | Default |  |
| `ACC-40` | Deleting the account ends its sessions, withdraws Sign in with Apple, wipes the credit ledger, deletes its… | Default |  |
| `ACC-41` | The server keeps Apple's renewal token only encrypted and only to withdraw access at deletion or removal;… | Default |  |
| `ACC-42` | A suspended account can't sign in, renew or use the service but can still sign out and delete itself. | Default |  |
| `ACC-43` | Sign in with Apple on Android runs Apple's web flow through the server in a browser tab and is on only… | Default |  |
| `ACC-45` | Test sign-in exists on the server only on a local test server switched on with a secret of at least 32… | Owner | 2026-11-16 |
| `ACC-46` | The app shows Test sign-in only when built with `EXPO_PUBLIC_DEV_LOGIN=on` and the secret; such a build… | Owner | 2026-11-17 |
| `ACC-47` | A failed sign-in shows a plain sentence and a "Details" line that never contains a token, nonce, client id… | Default |  |
| `ACC-48` | Sign-in logs carry only a request id, user id, provider and a fixed reason; never a token, nonce, code,… | Default |  |
| `ACC-49` | Today setup offers sign-in only on the Qutai Credits path; own-key users get no optional "Sign in" step. | **Waiting** |  |
| `ACC-50` | Today Sign in with Apple on Android is built but stays off until the owner creates Apple's Services ID and… | **Waiting** |  |
| `ACC-51` | Today the sign-in methods are Apple, Google and email; no other provider. | **Waiting** |  |
| `ACC-52` | Each sign-in method shows its address (Google and Apple from their own token, kept per method on the server); an Apple relay… | Owner | 2026-11-19 |
| `ACC-53` | A sign-in or rotated token the phone can't save: three tries, kept in memory, saved before every request, the user told once; a failed sign-out clear told | Default | 2026-11-20 |
| `ACC-54` | A store-review account signs in by email with a fixed code while the server's review_login switch is on (off by default; sign-in only… | Owner | 2026-11-21 |
| `ACC-55` | Settings › Account has no "Add a sign-in method"; a second way in comes from Combine with another account. | Owner | 2026-11-24 |
| `ACC-56` | Combine with another account adds a sign-in that has no Qutai account yet to this one (server, one step); another account's still needs the combine confirmation. | Owner | 2026-11-24 |

Moved to Details (ids retired, not reused): `ACC-9`, `ACC-12`, `ACC-16`, `ACC-21`, `ACC-38`, `ACC-44`

## [34. Qutai Credits, tiers, the relay and the agent profile](34-credits-and-relay.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `CRED-1` | Qutai's provider keys never go into the app; credit-mode requests go through Qutai's server; own-key… | Owner | not recorded |
| `CRED-2` | Qutai Credits exist only with pro mode and a server address; otherwise the provider isn't listed and… | Owner | not recorded |
| `CRED-3` | Qutai Credits can be the provider in use only while signed in; setup and Settings › Assistant never save… | Default |  |
| `CRED-4` | The disclosure that page content passes through Qutai's server must be accepted on the phone before first… | Default |  |
| `CRED-5` | The server, not the app, decides the system prompt, the tool list, the model, the output limit, effort,… | Default |  |
| `CRED-6` | Only registered agent profiles (named by the SHA-256 of the app's exported prompt and tools) are accepted;… | Default |  |
| `CRED-7` | The conversation is checked against a per-provider allowlist: no system or developer turns, no remote web… | Default |  |
| `CRED-8` | Conversations, page content, prompts, web addresses and memory are never stored or logged; relay logs keep… | Owner | not recorded |
| `CRED-9` | In credit mode the server keeps tiers (one since 20 Nov, old ids as aliases) and the customer never sees provider models; the owner… | Owner | 2026-11-16, changed 2026-11-20 |
| `CRED-10` | A running conversation stays on the model that answered it through a signed route for 30 days after its… | Default |  |
| `CRED-11` | ~~The old request form naming a provider model is still accepted~~ (withdrawn: removed; every app from 0.1.0 sends a tier). | Withdrawn | 2026-11-20 |
| `CRED-12` | Credits are whole numbers of micro-credits (1 credit = 1 000 000); a charge is the provider's cost ×… | Default |  |
| `CRED-13` | Each account's balance has one source of truth, its own Durable Object (a per-user server object that… | Owner | not recorded |
| `CRED-14` | Before each step the server reserves the most it can cost (output limit, searches and their results, dearest tier)… | Default | changed 2026-11-22 |
| `CRED-15` | A provider error or the app leaving before any output costs nothing; a cut answer is charged on what was seen plus an… | Default | changed 2026-11-20 |
| `CRED-16` | A charge that arrives after the hold expired still charges the real cost, even if the balance goes negative. | Default |  |
| `CRED-17` | An identical re-send of a step within 15 minutes is free once only if a charged attempt was cut or estimated… | Default | changed 2026-11-20 |
| `CRED-18` | A balance may go negative after a refund, and a negative balance blocks spending until topped up. | Default |  |
| `CRED-19` | Without per-user limits, relay rules or pricing the relay refuses (fail closed); a missing field reads its default… | Default | changed 2026-11-20 |
| `CRED-22` | An Anthropic answer paused mid-search continues only with a continuation the server signed (tied to the… | Default |  |
| `CRED-23` | The step limit is the server's; the app shortens the memory section and attached images to the server's… | Default |  |
| `CRED-24` | The relay refuses app versions below the server's minimum version ("update Qutai"); the seeded minimum is… | Default |  |
| `CRED-25` | Today the deployed relay rules must allow memory of at least about 10 000 characters and 9 images per… | **Waiting** |  |
| `CRED-26` | Today a step holds its whole output limit and room for search results, so a small balance refuses cheaper requests… | **Waiting** | changed 2026-11-20 |
| `CRED-27` | The low-credit note shows once when the balance falls below 5 × the default tier's "credits per step" and… | Default |  |
| `CRED-28` | Charges are shown only in credits, never as money, and the balance under the panel title is always shown… | Default |  |
| `CRED-29` | Only models with a price in force are offered; prices are added as new dated rows, never edited, and never… | Default |  |
| `CRED-30` | ~~Users are charged for every Gemini search~~ (withdrawn: the server no longer relays Gemini). | Withdrawn | 2026-11-20 |
| `CRED-31` | Kill switches (per provider and global) make the relay "temporarily unavailable" without touching credits;… | Default |  |
| `CRED-32` | The admin panel is reachable only through Cloudflare Access, checks the token itself (not its audience since 19 Nov) and, since 20 Nov, its own allowlist… | Default (audience: Owner) | 2026-11-19, changed 2026-11-20 |
| `CRED-33` | Today the panel shows revenue gross (before the store's share), "active" means seen, and there is one… | **Waiting** |  |
| `CRED-34` | Today the server raises abuse flags (task limits hit often, refund debt, many refunds) and the panel resolves them; thresholds are guesses. | **Waiting** | changed 2026-11-22 |
| `CRED-35` | Today credit prices are the model's token price plus a margin; pack sizes, trial credits, per-user limits… | **Waiting** | changed 2026-11-20 |
| `CRED-36` | ~~The model that served an answer shows only in its cost details and the sent log~~ (withdrawn; `CRED-44`). | Withdrawn | 2026-11-20 |
| `CRED-37` | Today there is no crash-report service. | **Waiting** |  |
| `CRED-38` | Today, with an own key, a request still running when the user leaves the app is kept alive for at most 3… | **Waiting** |  |
| `CRED-39` | No tier choice in the app: every Qutai Credits request uses the tier `/config` marks as default; stored… | Owner | 2026-11-20 |
| `CRED-40` | One model for every task (Claude Haiku 5.5), one tier `standard` with aliases `fast` and `pro`; switched in the panel only (searchable list), priced first… | Owner | 2026-11-20 |
| `CRED-41` | "Check prices" reads Anthropic's pricing page as a proposal only; strict parser, refuses when unsure, saves nothing until accepted. | Owner | 2026-11-20 |
| `CRED-42` | Margin set in the panel as a percentage with a live example; first values 100 credits per dollar and 100 %. | Owner | 2026-11-20 |
| `CRED-43` | Every panel setting is a form in human units with "What will change"; JSON only under Advanced; emergency controls first. | Owner | 2026-11-20 |
| `CRED-44` | The app never shows which model is behind Qutai Credits (no "Answered by" in the cost details or the sent log, no model label). | Owner | 2026-11-20 |
| `CRED-45` | One reservation scope inside waitUntil: exactly one settle or cancel; the app leaving can't keep the hold and the lock. | Default | 2026-11-20 |
| `CRED-46` | The account prunes retry-only rows daily: relay keys and finished reservations after 30 days, other keys after 400; never the ledger. | Default | 2026-11-20 |
| `CRED-47` | Qutai's server relays Anthropic only (seam kept); own OpenAI, Gemini, OpenRouter and custom keys in the app are unaffected. | Owner | 2026-11-20 |
| `CRED-48` | A step the balance can't hold is shortened to fit (fewer searches down to 1, then output down to `minOutputTokens`), refused only below that. | Owner | 2026-11-22 |
| `CRED-49` | The free introduction runs on its own key and table: no credits, apart from paid usage, counted in the spend limit; own Usage section. | Owner | 2026-11-22 |
| `CRED-50` | `POST /relay/organise-memory`: server-owned instructions, facts in, `{ moves }` out; paid like a relay step, usage `purpose` in the panel. | Owner | 2026-11-23 |

Moved to Details (ids retired, not reused): `CRED-20`, `CRED-21`

## [35. Purchases](35-purchases.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `BUY-1` | Payments go through RevenueCat (its app library, server-side lookups and one signed notification address),… | Owner | 2026-11-15 |
| `BUY-2` | Credits are added only after the server has looked the purchase up with RevenueCat itself; the app's… | Owner | not recorded |
| `BUY-3` | Each store transaction is accepted once across all users; the first to report it fixes its owner and… | Default |  |
| `BUY-4` | A purchase is credited and refunded at most once, in any order; a refund that arrives first blocks the… | Default |  |
| `BUY-5` | The development server accepts only test (sandbox) purchases and the production server only real ones, except the switch for listed… | Default | 2026-11-20 |
| `BUY-6` | Credits are bought only through the store's in-app purchase at the store's own price; the app never shows… | Default |  |
| `BUY-7` | A pack's credits are fixed once it exists, and a purchase keeps the credits it had when first recorded; a… | Default |  |
| `BUY-8` | A refund or revocation at the store takes the credits back, even into a negative balance. | Default |  |
| `BUY-9` | Today a refund that Apple later cancels does not give the credits back automatically; support can grant… | **Waiting** |  |
| `BUY-10` | RevenueCat's notifications are checked by signature (within 5 minutes) before they are read, are limited… | Default |  |
| `BUY-11` | A suspended account can't buy; a store notification for it is held and credited after the account is restored. | Default |  |
| `BUY-12` | The payments library gets Qutai's account id after sign-in, switches on another sign-in and logs out on… | Default | 2026-11-20 |
| `BUY-13` | RevenueCat's restore behaviour is "Transfer to new App User ID"; each store transaction is still credited once (changed). | Owner | 2026-11-21 |
| `BUY-15` | Builds without pro mode must not contain the payments library at all: no native code, no billing… | Owner | 2026-11-16 |
| `BUY-16` | ~~Fake purchases are a deliberate temporary stand-in~~ (withdrawn: removed from the app and the server). | Withdrawn | 2026-11-21 |
| `BUY-17` | ~~Fake purchases exist only on a development server with the switch set to true~~ (withdrawn: no server has them). | Withdrawn | 2026-11-21 |
| `BUY-18` | ~~Today fake purchases allow 10 new per account in any 24 hours~~ (withdrawn: no fake purchases, no limits). | Withdrawn | 2026-11-21 |
| `BUY-19` | ~~Fake purchases are recorded as store "fake" and left out of the panel's figures~~ (withdrawn: migration 0015 removes the store value). | Withdrawn | 2026-11-21 |
| `BUY-21` | Before launch: remove every fake purchase path, text, test and row; removal done 2026-11-21 (migration 0015 reaches production with the next deploy). | Owner | 2026-11-17, done 2026-11-21 |
| `BUY-22` | Deleting an account keeps its purchase records without the user and asks RevenueCat to delete its customer… | Default |  |
| `BUY-23` | Purchase logs never carry a transaction id, product id, email or key, and nothing else from RevenueCat… | Default |  |
| `BUY-24` | Today Qutai only asks RevenueCat to delete a deleted user's customer record; whether to require more is open. | **Waiting** |  |
| `BUY-25` | Today the packs are decided (three Android packs); the RevenueCat project, Play products and panel packs… | **Waiting** | 2026-11-20 |
| `BUY-26` | A production switch lets listed accounts' store test purchases add credits: off by default, never revenue,… | Owner | 2026-11-20 |
| `BUY-27` | RevenueCat only in a pro build with the platform key, the native module and a signed-in account;… | Owner | 2026-11-20, changed 2026-11-21 |
| `BUY-28` | Every ending said plainly, none loses or doubles a pack; unreported purchases found in the store's list;… | Default | 2026-11-20 |
| `BUY-29` | RevenueCat gets the account id, product ids, purchases and recent-purchase lookups; diagnostics and… | Default | 2026-11-20 |
| `BUY-30` | A pro Android package needs the RevenueCat key (or --without-purchases); every package's bundle and… | Owner | 2026-11-20 |
| `BUY-31` | Pack order is changed in the admin panel (Order…), one number per product for both stores; the app keeps the server's order… | Owner | 2026-11-20 |
| `BUY-32` | Test purchases in production: off, listed accounts only, or an explicit "everyone" (all live accounts; loud banner);… | Owner | 2026-11-21 |
| `BUY-33` | A pro IPA needs the RevenueCat iOS key (or --without-purchases), like a pro AAB. | Owner | 2026-11-21 |
| `BUY-34` | The buy screen and the rating message name only the phone's own store (or none); ten languages. | Owner | 2026-11-21 |
| `BUY-35` | The kept list of uncredited purchases is never written over when it couldn't be read; unsaved changes stay in memory | Default | 2026-11-21 |
| `BUY-36` | The missing-credits check asks about all kept purchases at once, once each, no waits; no waiting count on the screen. | Owner | 2026-11-24 |

Moved to Details (ids retired, not reused): `BUY-14`, `BUY-20`

## [36. Server backup](36-server-backup.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `BACK-1` | There is no live sync for now: "sync" means the export's encrypted file kept in the Qutai account and… | Owner | 2026-11-17 |
| `BACK-3` | The password never leaves the phone and the server has no recovery or key copy; the server sees only the… | Default |  |
| `BACK-4` | Today new files use scrypt (a slow password-to-key function) with N = 2^14, r = 8, p = 1 and… | **Waiting** |  |
| `BACK-5` | Today the backup contents are not compressed. | **Waiting** |  |
| `BACK-6` | The backup password has at least 10 characters and is kept in the phone's secure storage, readable only on… | Default |  |
| `BACK-7` | Today the kept password is cleared on sign-out and account deletion, kept when the server ended the… | **Waiting** |  |
| `BACK-8` | Changing the backup password affects only the next backup; copies already on the server keep the old… | Default |  |
| `BACK-9` | Today a server backup includes open tabs and leaves out conversations, activity and AI keys unless the… | **Waiting** |  |
| `BACK-10` | Today the automatic backup is off by default and, when on, runs once a day, only while Qutai is open… | **Waiting** |  |
| `BACK-11` | The automatic backup never runs while an incognito tab is in front. | Default |  |
| `BACK-12` | A backup never contains downloads, saved pages, caches, site data, incognito data, the "What was sent to… | Default |  |
| `BACK-13` | Server limits by default: 50 MiB per backup, 3 kept per account, 12 uploads a day (failed attempts count),… | Default |  |
| `BACK-15` | A failed upload never replaces a good backup: older copies are removed only after the new one is complete… | Default |  |
| `BACK-17` | Uploading needs an active account; listing, downloading and deleting work while suspended. | Default |  |
| `BACK-18` | Today "Delete all backups" needs no recent sign-in. | **Waiting** |  |
| `BACK-19` | Combining two accounts moves the other account's backups to the surviving one; deleting the account… | Default |  |
| `BACK-20` | Stored files are named by a random id, never the user id; the admin panel shows only how many backups an… | Default |  |
| `BACK-21` | The restore offer appears once after each fresh sign-in to an account with a backup, counted only once answered; asked in setup right after signing in… | Owner | 2026-11-20 |
| `BACK-22` | The pro privacy policy describes server backups, and its version was raised so every pro user accepts… | **Waiting** |  |
| `BACK-23` | A failed removal of the kept backup password is retried, and marked so the next start removes it | Default | 2026-11-21 |

Moved to Details (ids retired, not reused): `BACK-2`, `BACK-16`, `BACK-14`

## [37. The server, analytics and pro test builds](37-server-and-analytics.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `SRV-1` | Qutai's server exists only for pro mode; builds without pro mode never contact it and must keep working… | Owner | not recorded |
| `SRV-2` | The server runs on Cloudflare only (Workers, Durable Objects, D1, Queues, scheduled jobs, Access, R2; Analytics Engine with analytics)… | Owner | not recorded, changed 2026-11-20 |
| `SRV-3` | The server lives in its own repository, checked out at `backend/` as a git submodule; the app reaches it… | Owner | 2026-11-15 |
| `SRV-4` | No secret is ever committed; limits and abuse thresholds live in the database or secrets, not in code,… | Default |  |
| `SRV-5` | The server keeps: the account (id, status, created, last seen), its sign-in methods and address (with who… | Default |  |
| `SRV-6` | Server logs carry a fixed list of fields only (ids, counts, cost, timing, a fixed reason); bodies,… | Default |  |
| `SRV-7` | Deleting the account deletes the server's data for it (database rows, the credit ledger, backups, the… | Default |  |
| `SRV-8` | The API accepts the app only (no web-page origins), and the admin API only its own page. | Default |  |
| `SRV-9` | Provider keys, signing keys and notification secrets are server secrets, different per environment, with a… | Owner | not recorded |
| `SRV-10` | Analytics in the first version are Qutai's own anonymous events sent to its server, not Firebase; the app's layer is an interface. | Default | changed 2026-11-22 (built) |
| `SRV-11` | Analytics only in pro builds and only after the user agrees, off by default, changeable in Settings › Privacy, never from incognito. | Default | changed 2026-11-22 (built) |
| `SRV-12` | Analytics events are a small fixed list with app version, platform and language; unknown events and fields dropped; install id resets on withdrawal. | Default | changed 2026-11-22 (built) |
| `SRV-13` | No advertising id is collected (so no App Tracking Transparency prompt on iPhone, ad id off on Android). | Default |  |
| `SRV-15` | Before the server goes live, every "no servers of ours" promise (setup welcome and legal summary, privacy… | Default |  |
| `SRV-16` | A server-side browser for background research is not part of this platform. | Default |  |
| `SRV-17` | The tunnel address for pro test builds is passed only at build time and never committed. | Owner | 2026-11-16 |
| `SRV-18` | Pro test APKs are built without the test sign-in values since 17 Nov 2026. | Owner | 2026-11-17 |
| `SRV-20` | The app's version (and the build number derived from it) changes only when the owner asks; test builds… | Owner | 2026-11-17 |
| `SRV-21` | The Apple sign-in key shared in chat on 16 Nov 2026 is replaced by a separate key for production. | Owner | 2026-11-17 |
| `SRV-22` | Production runs on Cloudflare since 19 Nov, one-command deploy; first values: Anthropic only, 100 USD a month, Haiku only and 100 % margin (since 20 Nov), no purchases. | Owner | 2026-11-19, changed 2026-11-20 |
| `SRV-23` | Production hostnames are written in the backend repository only; this app repository never contains them. | Owner | 2026-11-19 |
| `SRV-24` | The admin Worker's only outbound request: Anthropic's pricing page, only when "Check prices" is pressed. | Owner | 2026-11-20 |
| `SRV-25` | One settings schema with defaults, bounds and cross-checks; reading fills and clamps, saving is strict. | Default | 2026-11-20 |
| `SRV-26` | The deploy runs a preflight (committed, typecheck, tests) and records the deployed commits, shown on the Overview. | Default | 2026-11-20 |
| `SRV-27` | ~~Test purchases only through one seam, so their removal is one migration and one delete~~ (withdrawn: removed that way). | Withdrawn | 2026-11-21 |
| `SRV-28` | Rate-limit refusals are counted in memory and written as daily totals about once a minute per instance; no IP kept; 30 days. | Default | 2026-11-22 |
| `SRV-29` | Pro builds prove sign-in and AI requests come from the real app (App Attest, Play Integrity); server switch off / log / enforce, log only by default. | Default | 2026-11-22 |
| `SRV-30` | Device verification sends only what Apple's and Google's checks need; proofs are not linked to the account; never in the open-source build, never blocks on the phone. | Default | 2026-11-22 |
| `SRV-31` | Product analytics: server switch off by default; one-time equal-weight question after setup; consent and install id on the phone only; never from incognito. | Default | 2026-11-22 |
| `SRV-32` | Five event names with fixed-word fields; the server keeps only those words and a hash prefix of the install id, three months. | Default | 2026-11-22 |
| `SRV-33` | The panel reads the events through the Analytics Engine SQL API with fixed queries; its only other outbound request besides SRV-24. | Default | 2026-11-22 |
| `SRV-34` | A missing device proof's error header names the stage and the native error code as a fixed word (`prep_api_not_available`, `nonce_failed`, `setup_failed`), never the message; the nonce comes from expo-crypto. | Default | 2026-11-22 |

Moved to Details (ids retired, not reused): `SRV-14`, `SRV-19`

## [38. Phone permissions and store forms](38-phone-permissions.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `OSPERM-1` | Nothing is asked at launch; the setup step "What Qutai may use" is optional, shows the phone's question… | Default |  |
| `OSPERM-2` | Qutai never asks for a permission twice once the phone has answered; taking one back is done in the… | Default |  |
| `OSPERM-3` | Photos: add-only; Qutai can't see the photo library; attaching images uses the system picker, which needs… | Default |  |
| `OSPERM-4` | Calendar: adding events uses write-only access on iOS 17+; full access is asked only for the calendar… | Default |  |
| `OSPERM-5` | Reminders: iOS has no write-only access; Qutai only writes and reads only list names and colours for the… | Default |  |
| `OSPERM-6` | Location is foreground only and approximate is accepted; background location is blocked. Setup's "Use my… | Default |  |
| `OSPERM-7` | Contacts are read only (adding or editing is blocked), looked up only for a name the user said, at most 5… | Default |  |
| `OSPERM-8` | Today the proposed store answers for contacts are: App Store "Contacts › App Functionality, not linked to… | **Waiting** |  |
| `OSPERM-9` | Notifications are local only: no push (no push entitlement on iOS, the push permission blocked on Android). | Default |  |
| `OSPERM-10` | Voice input uses on-device recognition when the phone supports the language; otherwise Apple's or Google's… | Default |  |
| `OSPERM-11` | Face ID and fingerprint are used only for the app lock and the incognito lock. | Default |  |
| `OSPERM-12` | iOS background audio is used only for sound the user started on a web page; Qutai plays no sound of its… | Default |  |
| `OSPERM-13` | iOS App Transport Security: arbitrary loads off, local networking on (for a custom AI endpoint on the home… | Default |  |
| `OSPERM-14` | Android allows plain http for the app because Qutai is a browser (see `BLK-26`); the app's own requests… | Default |  |
| `OSPERM-16` | Storage: write access only up to Android 10 (for saving and downloads there); read access to storage and… | Default |  |
| `OSPERM-17` | Also blocked on Android: Wi-Fi state, the overlay permission (development only), the install referrer and… | Default |  |
| `OSPERM-18` | Foreground services: media playback only while a tab plays (and 2 minutes after a pause); "Keep working in… | Default |  |
| `OSPERM-19` | Today the Play Console foreground-service declaration still has the old text; the owner must update it and… | **Waiting** |  |
| `OSPERM-20` | `REQUEST_INSTALL_PACKAGES` is declared only so "Open" on a downloaded APK reaches the system installer; a… | Default |  |
| `OSPERM-23` | Ways in from other apps (share, text selection menu, web search, shortcuts, widget) need no permission;… | Default |  |
| `OSPERM-24` | Store notes: page content, chats and screenshots go from the phone to the AI provider the user chose with… | Default |  |
| `OSPERM-25` | Export compliance: `ITSAppUsesNonExemptEncryption` left out, App Store Connect asks for each build (standard algorithms); France out of availability until its declaration. | Owner | 2026-11-21 |
| `OSPERM-26` | A pro build's iOS privacy manifest lists six collected data types (app functionality, linked) and product interaction (analytics, not linked); open source: none. | Owner | 2026-11-21, changed 2026-11-22 |

Moved to Details (ids retired, not reused): `OSPERM-15`, `OSPERM-21`, `OSPERM-22`

## [39. Versioning](39-versioning.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `VER-1` | The build number is always `major*10000 + minor*100 + patch` of the version, and it is the same on Android… | Owner | 2026-11-17 |
| `VER-2` | The version is raised only when the owner explicitly says so. Test APKs, simulator builds and commits… | Owner | 2026-11-17 |
| `VER-3` | Only `npm run version:bump` writes `version`, `buildNumber` and `versionCode`. Nobody edits them by hand. | Owner | 2026-11-17 |
| `VER-9` | The server's minimum app version must never be above the version of the builds people are using. Check it… | Default |  |
| `VER-11` | Settings › About shows only the version, never the build number. | Owner | 2026-11-22 |

Moved to Details (ids retired, not reused): `VER-5`, `VER-6`, `VER-7`, `VER-4`, `VER-8`, `VER-10`

## [40. Signing and builds](40-signing-and-builds.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `BUILD-2` | `ios/` and `android/` are generated, git-ignored and never edited by hand. Native behaviour goes into… | Owner | not recorded |
| `BUILD-4` | Packages are added with `npx expo install`, and Expo's own modules are preferred over third-party libraries. | Owner | not recorded |
| `BUILD-5` | Every EAS profile builds with pro mode off, and `eas.json` has no pro profile. | Default |  |
| `BUILD-7` | Packages are named `builds/qutai-<version>-<build>.aab\|ipa`, with `-pro-mode` before the extension for pro… | Owner | 2026-11-16 |
| `BUILD-9` | A store package never contains the test sign-in: the variables are set off for the build and the bundle is checked… | Owner | 2026-11-17, changed 2026-11-20 |
| `BUILD-10` | A pro build's server address and the Apple team id are never committed. They come from the environment or… | Owner | 2026-11-16 |
| `BUILD-11` | The pro test tunnel's address is passed only at build time. It is never written into the app or backend… | Owner | 2026-11-16 |
| `BUILD-12` | Android release builds are signed with Qutai's own upload key, read from a properties file outside the… | Default |  |
| `BUILD-13` | Keystores, keys and local env files are never committed. `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.pem`,… | Default |  |
| `BUILD-14` | `EXPO_PUBLIC_*` values are built into the app where anyone can read them, so they are never secrets. | Default |  |
| `BUILD-15` | The native setup for accounts (the Sign in with Apple entitlement, Google's URL scheme, App Links and… | Default |  |
| `BUILD-16` | Builds without pro mode contain no RevenueCat SDK at all. | Default |  |
| `BUILD-21` | Builds from the repository are the same code with pro mode off. Forks use their own name, logo, bundle id… | Default |  |
| `BUILD-22` | Today Android declares REQUEST_INSTALL_PACKAGES, so that "Open" on a downloaded APK reaches the system… | **Waiting** |  |
| `BUILD-23` | Pro store packages (AAB, IPA, release APK) use the production server since 19 Nov; the tunnel only for local testing. | Owner | 2026-11-19 |

Moved to Details (ids retired, not reused): `BUILD-1`, `BUILD-3`, `BUILD-6`, `BUILD-8`, `BUILD-20`, `BUILD-17`, `BUILD-18`, `BUILD-19`

## [41. Legal texts](41-legal-texts.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `LEGAL-1` | Anyone whose accepted legal version is lower than the current one must accept again before the browser opens. | Default |  |
| `LEGAL-2` | Today the open-source legal version is 5 and the pro legal version is 7, both dated 2026-11-21. | Owner | 2026-11-21 |
| `LEGAL-3` | Pro-mode builds show their own texts with their own version, and changing one set never re-asks users of… | Default |  |
| `LEGAL-4` | The version goes up when the policy or terms change in substance. Only the owner decides a bump: a session… | Owner | 2026-11-19 |
| `LEGAL-5` | The privacy policies' "the result of a script you approved on a page" is covered by the bump to open source 4 / pro 6… | Owner | 2026-11-20 |
| `LEGAL-6` | The privacy policies say apps are stored only on the phone (and in backups), and an app's code and errors… | Default | 2026-11-21 |
| `LEGAL-7` | The legal texts describe only what the app actually does, checked against the code. When something about… | Default |  |
| `LEGAL-8` | The open-source policy promises: (calendar and location asked each time unless "Don't ask again"; incognito keeps only downloads;… | Default |  |
| `LEGAL-9` | Before Qutai's server goes live for everyone, every "no servers of ours" sentence in the onboarding, the… | **Waiting** |  |
| `LEGAL-10` | A lawyer reviews the open-source and pro texts (KVKK/GDPR, Turkish consumer law on digital content) before… | **Waiting** |  |
| `LEGAL-11` | The pro terms: credits have no cash value, cannot be transferred, do not expire, are refunded only as the law… | Owner | 2026-11-21 |
| `LEGAL-12` | The legal texts exist in all ten interface languages; the eight translated from English say the English version prevails… | Owner | 2026-11-20 |
| `LEGAL-13` | Turkish legal texts address the user as "siz". Short button labels keep the bare imperative ("Kabul et ve… | Owner | 2026-11-16 |
| `LEGAL-14` | Ad-blocking filter lists are downloaded only after the terms have been accepted at least once. | Default |  |
| `LEGAL-15` | Settings › About › Open source licences lists every third-party component whose code or assets ship in the… | Default |  |
| `LEGAL-19` | Turkish and English are both originals; Turkish does not say that English prevails, only the eight translations do. | Owner | 2026-11-20 |
| `LEGAL-20` | The pro privacy policies (ten languages) say what a report of an answer or an app sends to Qutai's server… | Default | 2026-11-21 |
| `LEGAL-21` | The legal texts' contact address and the website's account deletion page use qutai@sonsuzdongu.com, not a… | Owner | 2026-11-21 |
| `LEGAL-22` | The terms of both builds (ten languages) have protective clauses: websites, the assistant's actions, AI answers,… | Owner | 2026-11-21 |
| `LEGAL-23` | "As is" with liability limited only as far as the law allows (never intent, gross negligence, death or injury);… | Default | 2026-11-21 |
| `LEGAL-24` | The privacy policies (both builds, ten languages) say what blocking, styles, scripts and apps do with data… | Default | 2026-11-21 |
| `LEGAL-25` | The legal versions went to open source 5 / pro 7 on 2026-11-21 for the protective clauses, reports, contact and… | Owner | 2026-11-21 |
| `LEGAL-26` | The terms name no governing law or court; which law governs and which courts or boards hear disputes is open… | **Waiting** |  |
| `LEGAL-28` | Each legal text names only its platform's store and services (`{{ios:…\|android:…\|web:…}}`); the website copy names both; no legal bump. | Owner | 2026-11-22 |
| `LEGAL-29` | The pro privacy policy describes analytics and device verification in ten languages; pro legal version 8 (2026-11-22), open source stays 5. | Owner | 2026-11-22 |
| `LEGAL-30` | No person is named in the legal texts: "Qutai is developed as open source"; the Qutai team is responsible for the data; legal version not raised. | Owner | 2026-11-23 |
| `LEGAL-18` | Qutai's code is Apache-2.0. The licence does not cover the Qutai name, logo or icons, and trademark… | Default |  |

Moved to Details (ids retired, not reused): `LEGAL-16`, `LEGAL-17`

## [42. The website](42-website.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `WEB-1` | The website states only true facts about the app. Qutai's comparison column follows the code and the… | Default |  |
| `WEB-2` | Each competitor cell comes only from the vendor's own current pages about its mobile app, with the URL and… | Default |  |
| `WEB-4` | Other products' names appear in plain text only, without logos or brand colours. A "Report a correction"… | Default |  |
| `WEB-5` | The site makes no requests to other websites, and its only cookie is `lang`, which the language switch sets. | Default |  |
| `WEB-6` | The site's privacy policy is the app's own store-build text, never edited on the site. After the app's… | Default |  |
| `WEB-7` | The sign-in link page never uses up the one-time token, signs nothing in, removes the token from the… | Default |  |
| `WEB-8` | Demo videos are real recordings made on brand-free demo sites, under written honesty rules. Qutai is… | Default |  |
| `WEB-9` | The brand line and page title are "Qutai: Agentic Browser". The site always uses the light parchment look… | Default |  |
| `WEB-11` | Today three sentences on the site are out of date: "No account needed and no sync", the planned end-to-end… | **Waiting** |  |
| `WEB-12` | The features page describes only what the code does today, from the design record, with limits stated… | Default |  |
| `WEB-13` | The site has an account deletion page (`/en/delete-account/`, `/tr/delete-account/`, and `/delete-account`… | Owner | 2026-11-21 |
| `WEB-14` | The site has a terms-of-use page (`/en/terms/`, `/tr/terms/`, `/terms` redirects) with the pro build's terms… | Owner | 2026-11-21 |

Moved to Details (ids retired, not reused): `WEB-3`, `WEB-10`

## [43. Working on this repository](43-working-on-the-repo.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `HOUSE-1` | `DESIGN.md` is the single record of how Qutai works. Every piece of work that changes behaviour, a… | Owner | 2026-11-19 |
| `HOUSE-2` | Before writing code against an Expo, EAS or React Native API, check the Expo version in `package.json` and… | Owner | not recorded |
| `HOUSE-3` | Lint (`npx expo lint`) and typecheck (`npx tsc --noEmit`) pass before any task is called done (`npm run check:all` runs all checks). | Owner | not recorded |
| `HOUSE-4` | Sessions commit on `main` and never push. The owner pushes. | Default |  |
| `HOUSE-5` | Commit messages have no attribution trailers, such as Co-Authored-By. | Default |  |
| `HOUSE-6` | Stage and commit by path, taking only your own files or hunks, never the whole index. | Default |  |
| `HOUSE-7` | Commit messages say what changed and why in plain sentences, often starting with the area's name. A… | Default |  |
| `HOUSE-8` | No secrets or private identifiers in the repository: no keys, passwords, test secrets, tunnel address or… | Owner | 2026-11-16 |
| `HOUSE-9` | Nobody raises the version without the owner's explicit word (see VER-2). | Owner | 2026-11-17 |
| `HOUSE-10` | All Turkish app text addresses the user as "siz". Every brief that adds or edits Turkish text says so, and… | Owner | 2026-11-16 |
| `HOUSE-11` | Problems the owner reports go into the test checklist first. A fix starts only after the owner says "düzelt". | Owner | 2026-11-18 |
| `HOUSE-12` | Every feature that has not been seen on a phone gets a numbered section in `docs/test-checklist.md`, in… | Default |  |
| `HOUSE-13` | When a decision for the owner comes up, it goes into `TODO.md` › "Decisions waiting for the owner", and… | Owner | 2026-11-19 |
| `HOUSE-14` | When the owner asks what is open, list the open questions with the numbers used on 2026-11-16, and remove… | Owner | 2026-11-16 |
| `HOUSE-15` | ~~Today credit purchases are fake~~ (withdrawn: fake purchases removed; real purchases through RevenueCat). | Withdrawn | 2026-11-21 |
| `HOUSE-16` | The test sign-in (Settings › Account › Test sign-in) stays off in every build that leaves the owner's… | Owner | 2026-11-17 |
| `HOUSE-17` | Before release, a new Apple sign-in key is made for production, because the current one was pasted into… | Owner | 2026-11-17 |
| `HOUSE-18` | Retired: the trial assistant-look switch (curtain is the only look, `UI-21`) | Owner | 2026-11-21 |
| `HOUSE-19` | Before any store release or production deploy, the owner is reminded of every stand-in in HOUSE-15 to… | Owner | 2026-11-17 |
| `HOUSE-20` | The backend is changed only in its own repository (the submodule `backend/`), which the app's typecheck… | Default |  |
| `HOUSE-21` | One test loader and runner: `npm test` runs every server-free suite and fails on any failure; `npm run check:all` runs every check of the app and backend/ | Default | 2026-11-20 |
| `HOUSE-22` | Patched dependencies are pinned and excluded from `expo install`'s version fixes; a patch that doesn't apply fails the install; docs/native-code.md describes every patch and native module with its manual check | Default | 2026-11-20 |

## [44. Deliberately not built](44-not-built.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `NOT-1` | No password manager or password sync of Qutai's own; the phone's system autofill (iOS and Android) works… | Default |  |
| `NOT-2` | No DNS over HTTPS setting. | Default |  |
| `NOT-3` | No browser extensions. | Default |  |
| `NOT-4` | No "undo" for web actions; instead a confirmation before sensitive actions and per-site permissions. | Default |  |
| `NOT-5` | No in-place page translation; translation is asked for in the chat (no chip since UI-65). | Owner | 2026-11-15 |
| `NOT-6` | No separate model per saved task; a saved task runs with the conversation's model. | Owner | 2026-11-15 |
| `NOT-7` | No "smart address bar" that sends natural-language text to the assistant by itself; "Ask Qutai" is at the… | Owner | not recorded |
| `NOT-8` | No live sync between devices for now; in official builds the encrypted backup file can be kept in the… | Owner | 2026-11-17 |
| `NOT-9` | Today there is no sync; whether a future sync must be end-to-end encrypted (so the server cannot read it)… | **Waiting** |  |
| `NOT-10` | No video editing for now; image editing and filters exist. | Owner | 2026-11-19 |
| `NOT-11` | No audio recording or AI transcription service of Qutai's own ("cloud speech"); speech becomes text only… | Default |  |
| `NOT-12` | Messages are never sent by the assistant on its own: SMS, WhatsApp and email are drafts the user sends… | Default |  |
| `NOT-13` | No gallery, store or catalogue of apps made in Qutai; apps are shared only by exporting and importing a… | Owner | 2026-11-19 |
| `NOT-14` | The assistant has no tool to write to the clipboard; only the user copies. | Default |  |
| `NOT-15` | Today there is no in-app "lock to portrait"; the system's rotation lock is used (section 29). | **Waiting** |  |
| `NOT-16` | No voice search in the address bar (voice input is in the assistant panel and on the Qutai button). | Default |  |
| `NOT-17` | Downloads have no "Ask where to save" and no "ask before large files on mobile data"; POST downloads are… | Default |  |
| `NOT-18` | No pasting an image into the message field. | Default |  |
| `NOT-19` | No "Add to home screen" for a page on iOS (Android has it). | Default |  |
| `NOT-20` | No Siri / App Intents for now; `qutai://` links cover automation from the Shortcuts app. | Default |  |
| `NOT-21` | The payment approval has no per-payment or per-currency spending limit and no picture of the order summary. | Owner | 2026-11-19 |
| `NOT-22` | Qutai never asks for a battery-optimisation exemption for background playback. | Default |  |
| `NOT-23` | No preconnecting to sites while the user types in the address bar. | Default | 2026-11-20 |
| `NOT-24` | No harmful-site lookup service (like Safe Browsing) for now; it stays on the roadmap as planned later. | Owner | 2026-11-20 |

## [45. Roadmap decisions](45-roadmap-decisions.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `RMAP-1` | Work started with Phase 1, the browser foundation. | Owner | 2026-11-14 |
| `RMAP-2` | Search suggestions are on by default and always off in private (incognito) tabs. | Owner | 2026-11-14 |
| `RMAP-3` | The interface comes in ten languages and uses the device's language by default, with a choice in Settings… | Owner | 2026-11-14 |
| `RMAP-4` | AI search is on by default and can be turned off in Settings › Assistant. Each search's extra charge goes… | Owner | 2026-11-14 |
| `RMAP-5` | Should sync be end-to-end encrypted? The roadmap recommends yes. Today there is no sync. The server backup… | **Waiting** |  |
| `RMAP-6` | Qutai does not build its own password manager or password sync. | Default |  |
| `RMAP-7` | Qutai does not offer its own DNS over HTTPS. | Default |  |
| `RMAP-8` | Qutai does not support browser extensions. | Default |  |
| `RMAP-9` | Qutai does not offer undo for actions on the web. | Default |  |

## [46. Reporting answers and apps](46-reports.md)

| Id | Decision | Status | Date |
|---|---|---|---|
| `SAFE-1` | Every assistant answer and every app has ⋮ › Report in builds with Qutai's server (pro mode with a server… | Owner | 2026-11-21 |
| `SAFE-2` | Reporting is one dialog with the reason and an "Include the text" box, ticked, that says the text goes to… | Default |  |
| `SAFE-3` | An app's report includes, when ticked, its name and the files of its current version, never its data. | Default |  |
| `SAFE-4` | A report carries only the kind, reason, note (Other only), the text when ticked (at most 20 000… | Default |  |
| `SAFE-5` | The server takes at most 20 reports a day per account and per sender address (stored only as a keyed… | Default |  |
| `SAFE-6` | The admin panel lists reports (open first) and resolving one asks for a reason and is audited. | Default |  |
| `SAFE-7` | Today nobody is alerted when a report arrives; the owner reads the panel's Reports screen. | Default |  |
