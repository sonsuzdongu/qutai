# Qutai: how it works and the decisions behind it

This is the entry point to the record of how Qutai behaves and why. Every design decision taken so far is written down
as a short, testable rule with a stable id (for example `APPS-7` or `PAY-3`), its status and its reason, in one file per
area under [docs/design/](docs/design/). This page has the map, the five-minute overview, the principles and the known
gaps. The server's internals are in [backend/DESIGN.md](backend/DESIGN.md); the design files link to it rather than
copying it.

**Keeping it current** (rule in [AGENTS.md](AGENTS.md) › Rules). Any change to behaviour, a decision, a default, a
limit, a permission or what leaves the phone is written down in the same piece of work: edit the area file for the
feature you touch (a new decision gets the next free id in that area), update its row in
[docs/design/decisions-index.md](docs/design/decisions-index.md), and add one line to the changelog below. Read this page
for the map, then only the area files you need; never load all of them at once.

## Changelog

Last updated: 2026-11-19

Newest first, one line per change to the design. What happened before 19 Nov 2026 is in
[docs/design/history.md](docs/design/history.md).

- **2026-11-19:** Apps: no script API can add a frame any more and frame markup is neutralised at build, which closes
  the Android WebRTC route through `window[0]` (`APPS-9`, `APPS-42`, no longer waiting for the owner).
- **2026-11-19:** Deleting and account or security changes on a site get Qutai's own approval (`PAY-26`, request_approval
  kind "change"; `UNTR-19` no longer a chat question), and the final payment button is also recognised by context (`PAY-9`).
- **2026-11-19:** The app refuses typing into password, one-time-code, card-number and security-code fields and never
  shows their values to the AI (`SEC-2`, `SEC-3`; was prompt-only).
- **2026-11-19:** "Ask Qutai to fix this" fills the message box instead of sending, and console lines carry only the
  types and lengths of values, never the app's data (`APPS-23`, decided from the open question).
- **2026-11-19:** The settings tool can no longer weaken a protection: blocking, cookie banners, third-party cookies and
  HTTPS-only on only, search suggestions off only (`UNTR-8`, `BLK-24`, `TOOL-7`, `TOOL-8`).
- **2026-11-19:** Incognito never remembers an approval: the action confirmation offers no "Always allow" or "Don't ask
  again" there (`SITE-8`, `INC-14`); removing site rules no longer offers "Always allow".
- **2026-11-19:** The iPhone clean-install check now also clears the script and app seal key and the pending email
  sign-in request (`03-data-on-the-phone.md`), so after delete-and-reinstall restored scripts and apps arrive off.
- **2026-11-19:** Apps phase 2 tried in the iOS simulator and on the Android emulator (`22-apps.md`): the runner no longer
  crashes on Android (`dataDetectorTypes` as an array, APPS-10), the Android sandbox lets `data:`, `blob:` and `about:`
  through (APPS-41, `903a3f6`), and APPS-42 now names the one open case, WebRTC via `window[0]` on Android.
- **2026-11-19:** Split into this entry page and one file per area under `docs/design/`, with the decisions index and the
  history in their own files. Each area now separates **Rules** (decisions, with ids) from **Details** (how it is built,
  no id): 825 ids remain as rules (110 owner, 630 default, 85 waiting for the owner); 163 ids
  moved to Details are retired and listed in the index. Apps (`22-apps.md`) updated for `ea68c52` (the Android app sandbox,
  the frame guard, DNS prefetching off) and `768e14a`.
- **2026-11-19:** Design document created (`2fd0ab9`) from README.md, TODO.md, ROADMAP.md, docs/, backend/README.md,
  backend/DESIGN.md, the legal texts, the sessions' hand-over notes and the whole git log up to `92097ab`: 987 rules.

## How to read the design files

**Shape of every area file.** "How it works" (what the user sees, step by step), "The rules" (each decision as one
testable sentence with an id), "Details" (plain facts about how it is built; an item that used to be a rule says
"(was `ID`)"), "Why it is designed this way", "Limits and what is not built", "Where it lives" (the files and the
detailed doc to read next), and, where sources conflict, "Disagreements between sources".

**Rules versus Details.** A Rule is something someone decided that would surprise a user or a reviewer if it changed:
every owner decision and open question, defaults and limits the user notices, what reaches the AI or leaves the phone,
approvals, refusals and permissions, security and privacy guarantees, money, and what is deliberately not done. A Detail
is how it is built: formats, algorithms, libraries, internal thresholds, exact word lists, and the mechanism behind a
guarantee that a Rule already states. Details are kept in full; they just have no id and no status.

**Each rule** has two lines: the rule itself, then its status, the reason ("Why"), where it is enforced, and the source.

| Status | Meaning |
|---|---|
| `Owner, 2026-11-17` | Decided by the owner on that date (or "date not recorded"). Change only with the owner. |
| `Default (manager or implementing session; open to change)` | Chosen by the manager session or the session that built it. The owner can change it. |
| `Waiting for the owner (TODO.md)` | Not decided yet. The rule says what the app does **today**, and links to the open question in [TODO.md](TODO.md). |

**"Enforced"** (given for security, privacy, money, approvals, scripts, apps and sign-in) says where the rule is kept:

- `In the app: file (function)`: the app's code checks it, whatever the AI model does.
- `Server: file (function)`: Qutai's server checks it.
- `Prompt only`: the AI model is told the rule in its instructions (`src/agent/systemPrompt.ts`), but the app does not
  check it. A model that is tricked or makes a mistake can break such a rule. This difference matters: an app check is a
  guarantee, a prompt rule is a strong request.
- `Designed, not built`: written down, not in the code yet.

**Why.** Only reasons the sources give are written. Where no source says why, the rule says "reason not recorded". No
reason has been guessed.

**Ids are stable.** A rule keeps its id forever. A changed rule keeps its id and the changelog says what changed; a
removed rule stays in place marked "Withdrawn (date): reason"; an id moved to Details is retired. A new rule takes the
next free number in its area (look in the area file and in the index's "Moved to Details" list). Never renumber or reuse.

## Overview: Qutai in five minutes

### What Qutai is

Qutai is a web browser for iPhone and Android with an AI assistant built in. Besides browsing normally (tabs, private
tabs, bookmarks, downloads, reader mode, ad blocking), the user can ask the assistant, in their own words or by voice,
to read and use the page for them: "find this cheaper", "fill in this form", "post this comment", "make the links red",
"call Ahmet", "build me a notes app". The assistant reads the page, clicks and types like a person would, and can also
add calendar events, reminders and notifications, prepare calls and messages that the user sends, edit images, run small
page scripts and build small apps that live inside Qutai.

There are two builds of the same open-source code ([section 1](docs/design/01-open-source-and-pro.md)):

- **The open-source build** (anyone can build it from this repository): the user brings their own key for an AI provider
  (Anthropic, OpenAI, Google Gemini, OpenRouter, or their own compatible server). There is no account and no Qutai server.
- **Pro mode** (the official App Store and Google Play builds, one build switch): adds an optional Qutai account (Apple,
  Google or email sign-in), Qutai Credits (pay-as-you-go AI through Qutai's server, so no key is needed), and encrypted
  backups kept in the account. The user's own key keeps working.

Qutai speaks ten languages, follows the phone's language by default, and addresses Turkish users formally ("siz").

### The principles that recur everywhere

These ideas explain most of the rules below. Each points to the sections that apply it, and says honestly where it is
only partly enforced.

1. **The user's own key, or the optional paid service.** AI requests go from the phone straight to the provider the user
   chose, with the user's key. In pro builds the user may instead use Qutai Credits, which pass through Qutai's server
   (the relay) to the provider. ([2](docs/design/02-ai-providers.md),
   [34](docs/design/34-credits-and-relay.md))
2. **Data stays on the phone unless stated.** Tabs, history, bookmarks, conversations, memory, site rules, styles,
   scripts and apps are stored only on the phone. There is no live sync. Moving to another phone uses a password-encrypted
   backup file; in pro builds the same encrypted file can be kept in the account, and the password never leaves the
   phone. What does leave the phone is listed in [section 3](docs/design/03-data-on-the-phone.md) and in
   the privacy policies ([41](docs/design/41-legal-texts.md)). Any change to that list needs the privacy policy changed.
3. **The AI gets labels, never secrets.** Contacts reach the AI as names and opaque handles, never numbers or email
   addresses ([17](docs/design/17-contacts.md)); cookies as names and settings, never values ([19](docs/design/19-cookies.md)); ID and passport
   numbers as "[hidden: …]" labels ([11](docs/design/11-memory.md)); password fields as "(filled)"; the API key is never
   in the "What was sent to the AI" log ([13](docs/design/13-sent-to-ai-and-cost.md)). The app
   refuses to type card numbers and to type into password, one-time-code, card and security-code fields
   ([section 6](docs/design/06-secrets.md), `SEC-2`).
4. **Nothing irreversible without Qutai's own approval.** Posting, sending and paying on a site need Qutai's own dialog,
   which shows what Qutai itself reads on the page and allows one press of one button ([7](docs/design/07-posting-and-paying.md)).
   Payments are off by default, have no spending limit and never offer "Don't ask again". Calls and messages to people
   are only prepared; the user taps Call or Send ([15](docs/design/15-tools-and-phone-actions.md)). Every page script
   run shows its code first ([20](docs/design/20-page-scripts.md)). Deleting things and changing account or security settings on a site
   have their own app approval (`PAY-26`), and a final payment button is recognised by its label or its context
   (`PAY-9`); a press the app can't recognise falls back to the prompt.
5. **Page content is untrusted.** Web pages, PDFs and files are data, never instructions. Only the user can answer
   Qutai's dialogs; a page cannot approve anything, cannot trigger a contact lookup, and cannot make the assistant change
   protective settings ([4](docs/design/04-untrusted-content.md)).
6. **Risky powers are off by default.** Completing payments, running page scripts, working in the background, putting AI
   keys in a backup, streaming Gemini: all off until the user turns them on. Imported or restored scripts and apps arrive
   switched off and need the user's approval before they run ([20](docs/design/20-page-scripts.md), [22](docs/design/22-apps.md)).
7. **The open-source build never needs Qutai's server.** Every server feature is behind the pro switch; without it the app
   has no account section and never contacts Qutai ([1](docs/design/01-open-source-and-pro.md)).
8. **Private means private.** Incognito tabs and any conversation that touched one are never written to disk, and get no
   location, calendar, contacts or apps ([8](docs/design/08-incognito.md)).
9. **The owner's house rules.** Turkish text uses "siz" ([26](docs/design/26-languages.md)); icons are drawn, never emoji
   ([27](docs/design/27-interface.md)); the version number changes only when the owner says so ([39](docs/design/39-versioning.md)); fake purchases and
   test sign-in are deliberate stand-ins to remove before launch ([35](docs/design/35-purchases.md), [43](docs/design/43-working-on-the-repo.md)).

### What leaves the phone (summary)

| Goes to | What | When |
|---|---|---|
| The AI provider the user chose | The conversation, page text and screenshots the assistant reads for a task, memory (hidden values as labels), custom instructions, tool results | Each assistant request ([3](docs/design/03-data-on-the-phone.md), [13](docs/design/13-sent-to-ai-and-cost.md)) |
| Qutai's server (pro only) | Account sign-in details; with Qutai Credits, the AI requests on their way to the provider; the encrypted backup file | Only when signed in and using those features ([33](docs/design/33-accounts.md)–[37](docs/design/37-server-and-analytics.md)) |
| The search engine | Search suggestions as the user types | Not in private tabs |
| Apple or Google | Address lookup for "Use my location"; speech recognition when the phone can't do it itself (after a one-time question, never in incognito) | [25](docs/design/25-voice.md) |
| Filter list publishers | Downloads of the blocking lists | While blocking is on ([9](docs/design/09-blocking-and-my-rules.md)) |
| Web sites | What the user or the assistant types and sends, after the approvals above | — |

Never sent anywhere: contact numbers and addresses to the AI, cookie values, the backup password, voice audio to Qutai
or the AI provider, incognito data to disk.

### Known gaps and contradictions

The sections list every disagreement they found; these are the ones the owner should see first.

- **Prompt-only protections.** Deletes, account changes and payment buttons that Qutai can't recognise from their label
  or context fall back to the prompt (`PAY-9`, `PAY-26`). An app's "change only when the user asks" and "at most 3 fix rounds" are prompt-only.
- **Stale documents.** README › Official builds still says credits and sync are "not in the code yet" (credits and server
  backup are built; live sync is not); README › Sign-in methods says adding, removing and merging are "not built yet"
  (built on 17 Nov); README's opening describes the old per-tab glow and an input that reopens during approvals; README
  says EAS raises the build number (it comes from `app.json` since `bf46838`); TODO.md says the legal versions for
  contacts and cookies were not raised (they were, in `040c537`: open-source 3, pro 5) and that the pro version is "now 4";
  docs/pro-test-builds.md still turns test sign-in on, which the owner turned off on 17 Nov; docs/permissions.md says
  HTTPS-only is on by default (it is off) and that Android uses the system download manager (replaced).
- **Code comments that disagree with the build.** `src/config/features.ts` says store builds turn pro mode on in an EAS
  profile, but every profile in `eas.json` has it off. AI keys are stored without the "this device only" option the session tokens use (reason not
  recorded).
- **Apps.** docs/mini-apps.md's numbers differ from the code in places (hang timeout 10 s vs 12 s; import data entries
  20,000 vs 100,000) ([22](docs/design/22-apps.md)).
- **Privacy policy vs "Don't ask again".** The open-source policy says calendar and location are sent only after a
  confirmation "each time", but "Don't ask again" allows a standing permission ([41](docs/design/41-legal-texts.md)).

## Contents

One file per area. "Rules" counts the decisions with ids; "Waiting" the ones still open for the owner.

| # | Area | Rules | Waiting | What it covers |
|---|---|---|---|---|
| 1 | [The open-source build and pro mode](docs/design/01-open-source-and-pro.md) | 14 | 0 | Qutai is one open-source code base (Apache-2.0). |
| 2 | [AI providers and how requests reach them](docs/design/02-ai-providers.md) | 25 | 3 | Which AI answers the assistant, how a request travels from the phone to it, where keys are kept, and the switches that change a request (model per chat,… |
| 3 | [What is stored on the phone, and what leaves it](docs/design/03-data-on-the-phone.md) | 22 | 1 | Where Qutai keeps the user's data on the phone, the password-protected backup file that moves it to another phone, how a reinstall and "Clear browsing data"… |
| 4 | [Page content is untrusted](docs/design/04-untrusted-content.md) | 18 | 0 | Web pages, PDFs, attached files and script results can contain text written to steer the assistant ("ignore your instructions and…"). |
| 5 | [Site permissions and approvals](docs/design/05-site-permissions.md) | 20 | 0 | What the assistant may do on each site, and when it must ask the user first: per-site levels, the "Ask before every action" setting, the confirmation… |
| 6 | [Passwords, card numbers and one-time codes](docs/design/06-secrets.md) | 13 | 1 | What the assistant does with secrets: passwords, one-time codes, card numbers and security codes, bank checks, and sign-in pages. |
| 7 | [Posting and paying](docs/design/07-posting-and-paying.md) | 20 | 0 | How the assistant posts, comments, sends messages on a site and completes a payment: always through Qutai's own approval dialog, one press at a time, and… |
| 8 | [Incognito and locks](docs/design/08-incognito.md) | 27 | 1 | Incognito (private) tabs save nothing and keep their cookies and site data apart; the assistant works in them with fewer powers. |
| 9 | [Blocking and My rules](docs/design/09-blocking-and-my-rules.md) | 22 | 1 | Blocking ads and trackers, hiding cookie banners, third-party cookies, the user's own rules ("My rules") and their file, HTTPS-only, local network pages and… |
| 10 | [What web pages may use](docs/design/10-web-page-permissions.md) | 12 | 0 | What a web site itself may use on the phone: the location, the camera and the microphone, each decided per site by the user. |
| 11 | [The assistant's memory](docs/design/11-memory.md) | 22 | 0 | Facts about the user that the assistant keeps on the phone between conversations ("Phone: +90 555 …", "Vegetarian"), what it refuses to keep, memories… |
| 12 | [Personal profile, custom instructions and page suggestions](docs/design/12-profile-and-suggestions.md) | 15 | 0 | How Qutai gets to know the user (the voice introduction and the setup questions), the user's standing instructions for the assistant, and the suggestions… |
| 13 | ["What was sent to the AI" and the cost display](docs/design/13-sent-to-ai-and-cost.md) | 17 | 1 | A list of every request the app sent to the AI, with what was new in it, and an approximate cost under each answer. |
| 14 | [Tabs, tab groups and conversations](docs/design/14-tabs-and-conversations.md) | 13 | 0 | How conversations with the assistant belong to tabs and tab groups, how they are saved, how tabs sleep, and what the assistant panel does while a task works. |
| 15 | [The assistant's tools and phone actions](docs/design/15-tools-and-phone-actions.md) | 26 | 1 | What the assistant can do besides reading and using pages: change some of Qutai's own settings, manage bookmarks, prepare calls, texts, WhatsApp messages… |
| 16 | [Saved, scheduled and background tasks](docs/design/16-tasks.md) | 14 | 0 | Tasks the user saves to run again, reminders that bring a saved task back at a set time, tasks that keep working when the user leaves Qutai (Android), and… |
| 17 | [Contacts](docs/design/17-contacts.md) | 21 | 5 | The assistant can find a person the user names ("call Ahmet", "WhatsApp Ayşe that I'll be late", "email this page to Mehmet Bey") in the phone's address book. |
| 18 | [Page styles](docs/design/18-page-styles.md) | 21 | 2 | The user can change how a site looks by asking: "make the links red", "bigger text on this site", "dark background here". |
| 19 | [Cookies](docs/design/19-cookies.md) | 11 | 0 | The user can ask "Which cookies does this page have?". |
| 20 | [Page scripts](docs/design/20-page-scripts.md) | 30 | 7 | When reading the page isn't enough ("how many links are on this page", "collect this table"), the assistant can run a small piece of JavaScript on the page. |
| 21 | [Image editing and filters](docs/design/21-image-editing.md) | 14 | 0 | The assistant can make edited copies of an image the user attached, entirely on the phone. |
| 22 | [Apps inside Qutai](docs/design/22-apps.md) | 42 | 5 | The assistant can build small personal apps on request ("build me an app where I can keep my notes"). |
| 23 | [Downloads and opening Qutai from other apps](docs/design/23-downloads-and-links.md) | 16 | 0 | The decisions taken before a download starts (who asked, which files warn, which addresses work), and what a link, a shared text or a `qutai://` link from… |
| 24 | [Reader mode, media and downloads on screen](docs/design/24-reader-and-media.md) | 21 | 2 | What the user sees when reading an article, playing a video or audio, and downloading a file, and how web pages get the camera and microphone. |
| 25 | [Voice input and read-aloud](docs/design/25-voice.md) | 16 | 0 | Speaking to Qutai instead of typing (the panel's microphone and holding the Qutai button), and Qutai reading text out loud. |
| 26 | [Languages](docs/design/26-languages.md) | 14 | 3 | The languages of Qutai's interface, how the interface language is chosen, and which language the assistant answers in. |
| 27 | [Interface](docs/design/27-interface.md) | 12 | 0 | The look-and-feel rules that apply across the app: icons, dialogs, labels, the address bar, the Qutai button, haptics, the launch screen and the new tab page. |
| 28 | [Accessibility](docs/design/28-accessibility.md) | 8 | 0 | How Qutai works with screen readers (TalkBack, VoiceOver), the system's Reduce motion setting, large text, and page zoom. |
| 29 | [Landscape](docs/design/29-landscape.md) | 5 | 2 | How Qutai behaves when the phone or tablet is turned on its side. |
| 30 | [Working mode](docs/design/30-working-mode.md) | 11 | 2 | What the user sees while the assistant carries out a task: where on the page it acts, what it is doing right now, and that the input is closed until it… |
| 31 | [Onboarding and the voice introduction](docs/design/31-onboarding.md) | 19 | 3 | The first-launch setup, and "Tell me about yourself": the user talks freely and Qutai turns it into memory notes the user checks before anything is saved. |
| 32 | [Performance](docs/design/32-performance.md) | 7 | 2 | What was measured and changed in the November 2026 performance pass (the cost of the assistant's requests, start-up time and memory), and the two choices… |
| 33 | [Accounts and sign-in](docs/design/33-accounts.md) | 45 | 7 | The optional Qutai account in the official (pro) builds: signing in with Apple, Google or an email code, the rules that decide when two sign-ins are the… |
| 34 | [Qutai Credits, tiers, the relay and the agent profile](docs/design/34-credits-and-relay.md) | 36 | 10 | Qutai Credits let a signed-in user of an official (pro) build use the assistant without their own AI key: requests go through Qutai's server (the "relay"),… |
| 35 | [Purchases](docs/design/35-purchases.md) | 23 | 4 | Buying Qutai Credits in the official (pro) builds: packs sold as one-time ("consumable") in-app products on the App Store and Google Play, checked through… |
| 36 | [Server backup](docs/design/36-server-backup.md) | 19 | 7 | "Back up to your Qutai account" (official pro builds, signed in): the same password-encrypted backup file that Settings › Backup can export is uploaded to… |
| 37 | [The server, analytics and pro test builds](docs/design/37-server-and-analytics.md) | 19 | 0 | Qutai's own server exists only for the official (pro) builds: accounts, Qutai Credits, purchases, server backups and an admin panel. |
| 38 | [Phone permissions and store forms](docs/design/38-phone-permissions.md) | 22 | 2 | Every permission Qutai declares on iOS and Android, when the user is asked, which ones are blocked on purpose, and the texts prepared for the App Store and… |
| 39 | [Versioning](docs/design/39-versioning.md) | 4 | 0 | How Qutai's version (for example 0.1.1) and its store build number (for example 101) are set, and who may change them. |
| 40 | [Signing and builds](docs/design/40-signing-and-builds.md) | 14 | 1 | How Qutai is built (development builds, EAS profiles, store packages, pro-mode test builds), how Android release builds are signed, and the native patches… |
| 41 | [Legal texts](docs/design/41-legal-texts.md) | 16 | 6 | The privacy policy and terms of use shown in the app (one set for the open-source build, another for pro-mode builds), when users must accept them again,… |
| 42 | [The website](docs/design/42-website.md) | 9 | 1 | Qutai's marketing site lives in `webpage/`, a separate project inside this repository. |
| 43 | [Working on this repository](docs/design/43-working-on-the-repo.md) | 20 | 0 | House rules for anyone who changes Qutai, whether a person or an AI session: how to check work, keep the record, commit, handle secrets, test on phones, and… |
| 44 | [Deliberately not built](docs/design/44-not-built.md) | 22 | 2 | Features Qutai decided not to build, or postponed, with where the decision is written down. |
| 45 | [Roadmap decisions](docs/design/45-roadmap-decisions.md) | 9 | 1 | The decisions recorded in `ROADMAP.md` › 5. |

Also: [docs/design/decisions-index.md](docs/design/decisions-index.md) (every decision on one page, with status and date)
and [docs/design/history.md](docs/design/history.md) (the dated history from the git log).
