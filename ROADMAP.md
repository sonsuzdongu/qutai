# Qutai Roadmap

Source: the "Mobile Web Browser – Feature Inventory" document. Each item was compared with Qutai's current state
and classified by the infrastructure it can be built with. For task-level tracking see `TODO.md`.

**Status:** ✅ done · 🟡 partial · ⬜ missing
**Infrastructure:** **Go** = can be done in Expo Go · **Build** = requires our own build (development build) ·
**Server** = requires a backend · **✕** = not possible or not recommended with the WebView architecture
**Size:** S = a few hours · M = 1–2 days · L = several days or more

## Key finding

The document suggests the classic order: browser first, then modern features, AI last. Qutai came the opposite
way; the AI agent (the core of Phase 3) is ready, but **some basic browser expectations are missing**.
The biggest gap is **persistence**: when the app closes, tabs, chat and browsing data are lost. History,
bookmarks and autocomplete depend on this too. So the plan is built on completing this foundation first and then
putting the AI experience front and center.

---

## 1. Current state (by the document's sections)

### Core browser and address bar (sections 1–2)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Address bar, URL / search distinction | ✅ | | |
| Multiple tabs, tab switching, private mode | ✅ | | No cookie isolation on Android (see Build) |
| Back, reload, share, copy URL | ✅ | | |
| Forward, stop loading | ✅ | | In the icon row at the top of the menu |
| History, bookmarks, recently closed tabs | ✅ | | `expo-sqlite`; private tabs are not saved; bookmark folders, HTML import/export |
| Session restore (tabs when the app opens) | ✅ | | Restored tabs start asleep and load when opened |
| Autocomplete from history / bookmarks / most visited | ✅ | | Suggestion list; domain matches first |
| Live suggestions from the search engine | ✅ | | On by default, can be turned off in settings; off in private mode. Bing has no suggestion service |
| Search engine choice | ✅ | | Google, DuckDuckGo, Bing, Yandex |
| Start page and speed dial | ✅ | | New tab screen: most visited, bookmarks, recent visits, Ask Qutai |
| Paste and go, clearing the field | ✅ | | System paste button on iOS |
| HTTPS indicator, domain info | ✅ | | 🔒 / ⚠︎ Not secure; WebView cannot access certificate details |
| Find in page | ⬜ | Go · M | No WebView API; highlighting via page script |
| Desktop site | ⬜ | Go · S | Per-tab `userAgent` + reload |
| Reader mode | ✅ | | Readability-style extraction in the page script, shown in a script-free WebView over the page; light/dark/sepia, serif/sans, easier-reading spacing; read aloud with the paragraph highlighted |
| QR code scanning / generation | ⬜ | Go · S | `expo-camera`; pure JS library for generation |
| Voice search | ⬜ | Build | Decision: the device's speech recognition engine |
| Download manager | ⬜ | Go/Build · L | See section 6 |
| Detecting natural-language AI commands | 🟡 | Go · M | "Ask Qutai" is at the top of the suggestion list; automatic detection is Phase 2 |

### Tab management (section 3)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Grid view, close, close all, private tabs | ✅ | | |
| Reopening a closed tab | ✅ | | Undo bar + recently closed list |
| Search across tabs | ⬜ | Go · S | |
| Tab groups, naming, moving | ⬜ | Go · M | |
| Drag to reorder | ⬜ | Go · M | `react-native-gesture-handler` + `reanimated` |
| Putting unused tabs to sleep | ⬜ | Go · M | **Important:** every tab is currently an open WebView, a memory problem. A sleeping tab is kept as a URL and thumbnail |
| Cross-device sync | ⬜ | Server · L | Together with the account system |

### Privacy and security (section 4)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Private browsing | 🟡 | | Full on iOS; Build needed for cookie isolation on Android |
| Screenshot restriction in private mode | ✅ | | |
| Hiding cookie banners and ad slots (visual) | ⬜ | Go · M | CSS injection into the page (EasyList cosmetic rules) |
| Network-level ad / tracker blocking | ⬜ | Build · L | iOS: WKContentRuleList; Android: request interception. WebView does not expose this |
| Clearing history and data | ⬜ | Go/Build · M | History and cache in Go; clearing cookies requires a native module |
| Cookie management, third-party cookies | ⬜ | Go/Build · S–M | Android has `thirdPartyCookiesEnabled`; iOS WebKit already blocks them |
| HTTPS indicator | ✅ | | |
| HTTPS-only | ⬜ | Go · S | `http` → `https` upgrade on main-frame navigations; subresources out of scope |
| Malicious site warning | 🟡 | Server · M | Android System WebView has its own Safe Browsing protection; Safe Browsing API for a full solution |
| Site permissions (camera, microphone, location) | 🟡 | Build · M | Location done: per-site ask / allow / block, answered by the app (`src/browser/geolocation.ts`), frames refused. Camera and microphone not handled yet |
| Password manager, form filling | ⬜ | ✕ / Go | **I do not recommend writing our own password manager.** Relying on iOS and Android system autofill is safer; an AI-powered form assistant only for info like address and name |
| Biometric lock | ⬜ | Go · S | `expo-local-authentication`; also for locking private tabs |
| DNS over HTTPS | ⬜ | ✕ | WebView uses the system DNS; the user can turn on the OS "Private DNS" setting |

### Content and media (section 5)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Save as PDF | ✅ | | From the page's HTML, or from full-page screenshots for very dynamic pages |
| Printing | ⬜ | Go · S | `Print.printAsync` with the same page copy |
| Offline saving | ⬜ | Go · M | The page copy written for PDF is saved to a file |
| Reader mode | ✅ | | Page menu and an address bar icon on article pages; see Phase 2 item 7 |
| Text size, zoom | ⬜ | Go · S | Android `textZoom`; via CSS on iOS |
| Translation | ⬜ | Go · M | With AI, in place without breaking the layout |
| Select text to share, ask | ⬜ | Go · M | Native menu on iOS (`menuItems`); page script + on-screen button on Android |
| Open link in new tab, save image | ⬜ | Go · M | Long-press menu via page script |
| Open in external app (tel:, mailto:, app links) | ✅ | | By asking the user; iframes cannot open apps; Android `intent://` and web fallback supported |
| Error page (no connection, site not found) | ✅ | | Explanation by error type and "Try again"; in two languages |
| Fullscreen video | 🟡 | Go · S | Default on iOS; `allowsFullscreenVideo` must be enabled on Android |
| Picture-in-Picture | ⬜ | Go/Build | Feature exists on iOS; native for Android |
| Background audio | ⬜ | Build | iOS background audio mode setting |
| File and image download | ⬜ | See section 6 | |

### Download manager (section 6)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Download, list, open, share | ⬜ | Go · L | iOS: `onFileDownload` + `expo-file-system` download tasks (progress, cancel). Android: system download manager |
| Progress, pause / resume, cancel | ⬜ | Go/Build | Possible on iOS; not under the app's control on Android |
| Downloads requiring login | ⬜ | Build | Needs native access to session cookies |
| Choosing download location | ⬜ | Go · S | Share menu / Android storage access |

### User experience (section 7)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Dark / light / system theme | ⬜ | Go · M | App UI + dark mode for sites on Android (`forceDarkOn`) |
| Bottom / top toolbar choice | ⬜ | Go · M | Bottom bar for one-handed use |
| Gestures | 🟡 | Go · M | iOS edge swipe and Android back exist; no swiping on the address bar to switch tabs |
| Haptic feedback | ⬜ | Go · S | |
| Language selection | ✅ | | Turkish and English, matches the device language; iOS and Android per-app language settings supported |
| Accessibility | 🟡 | Go · M | Labels partly present; no screen reader testing done |
| Being the default browser | ⬜ | Build · M | Android: intent filters. iOS: requires a special entitlement from Apple |
| Home screen widgets | ⬜ | Build | `expo-widgets` |

### Account and sync (section 8)

All **Server · L**. Should be handled together with the account infrastructure to be built for the credit system. Suggestion: history,
tabs and bookmarks should sync **end-to-end encrypted**; the server should not be able to see the content. Password sync
should not be done; leave it to the system password manager.

### AI features (sections 9–10)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Asking about the page, summarizing, open tab context | ✅ | | |
| Web agent, multi-step tasks, information gathering | ✅ | | |
| Confirmation and cancel for agent actions | ✅ | | Confirmation for sensitive actions + "confirm every action" mode + stop |
| Follow-up questions | ✅ | | Chat history is kept |
| Voice assistant | 🟡 | Build | Read-aloud exists; voice commands in Build |
| Multi-tab analysis | 🟡 | Go · M | The agent can switch between tabs; missing: reading without switching to the tab (`read_tab`) and a "compare these tabs" selection |
| Citing sources, tabs used | ⬜ | Go · M | Clickable source links in the answer + list of tabs used; needs link support in chat |
| AI search (answers with sources) | ⬜ | Go · M | Providers' own web search tools (Anthropic web search, OpenAI web search, Gemini Google Search grounding). No need for our own search infrastructure; there is an extra charge per search |
| Deep research | ⬜ | Go · L | Existing agent + multiple sources + synthesis; Server later because of the background problem with long tasks |
| Smart address bar | ✖️ | – | Will not be done, per user decision |
| Shopping and travel assistant | 🟡 | Go · M | The agent can do this; missing: ready-made flows and a comparison table |
| Form assistant | 🟡 | Go · M | The agent can fill forms; no profile (name, address) stored on the device |
| Email assistant | ⬜ | Go · S | Draft with `expo-mail-composer`; the user presses the send button |
| Searching history in natural language | ⬜ | Go · M | Depends on history; search is done on the device, only matching results go to the model |
| Action preview and undo | 🟡 | | Preview and cancel exist. **Actions on the web generally cannot be undone** (a submitted form, a completed payment). The right approach is confirming the action beforehand; undo is only possible for browser actions (closing tabs, navigation) |
| Action history | ⬜ | Go · S | A log of what the agent did on which site |
| Per-site agent permissions | ⬜ | Go · M | Not in the list, but the most effective protection against prompt injection: "May click on this site", "do nothing on banking sites" |

---

## 2. Phases

Ordering criteria: the gap the user will notice most → least effort → infrastructure dependency.

### Phase 1 – Browser foundation (Expo Go)

Goal: Qutai can be used as an everyday browser.

1. ✅ **Persistent data layer** (`expo-sqlite`): session restore, history, bookmarks and their screen, recently closed tabs, chat. Private tabs write nothing
2. ✅ **New tab screen:** speed dial sites, bookmarks, recently visited
3. ✅ **Address bar:** autocomplete from history and bookmarks, search suggestions (off in private mode), search engine choice, paste and go, clear, HTTPS indicator
4. ✅ **Navigation:** forward, stop, reliable opening of external app links (tel:, mailto:, `intent://`), error page in Turkish
5. ✅ **Page tools:** find in page, desktop site, text size, print
6. ✅ **Long-press menu:** open link in new tab / private tab, copy/share link, summarize with Qutai, save image
7. ✅ **Tabs:** reopen closed tab, search in tabs, **putting unused tabs to sleep** (at most 5 open WebViews; private tabs are not put to sleep)

### Phase 2 – Putting AI front and center (Expo Go)

Goal: a Comet-like experience; easy access to AI and reliable answers.

1. ✅ **Quick action chips:** Summarize, Translate, Key points, Is this product good?, Compare
2. ✅ **Ask about selected text:** Ask, Explain, Translate, Share (page script and a strip at the bottom of the page on both platforms)
3. ~~**Smart address bar:** natural language commands go to Qutai~~ (will not be done)
4. ✅ **Sources:** pages read, shown below answers (switches to its tab if open, otherwise opens in a new tab)
   - ✅ Intermediate step: answers are rendered as markdown, links are clickable
   - ✅ Each tab has its own chat, and a tab group shares one, so a task keeps one context across the windows it opens (persistent; the chat comes back with a reopened tab; one task at a time)
   - ✅ **Clickable options:** when a choice is needed, the agent presents options as buttons via the `ask_user` tool
5. ✅ **AI search:** answers with sources using the providers' web search tools (searches are visible in chat, citations in source cards; can be turned off in settings)
6. ✅ **Multi-tab:** `read_tab` tool (reads other tabs without bringing them to the front), "compare selected tabs" in the tab switcher
7. ⏸ **Page translation** (in place) · M (postponed per user decision); ✅ **reader mode** (brought back with read-aloud, see Phase 4 notes)
8. ✅ **Per-site agent permissions** (default, always allow, ask on every action, read only, blocked) and **action history** (30 days; private tabs and typed text are not logged)
9. ✅ **Searching history in natural language** (`search_history`), **email draft** (`draft_email`), **form profile** (via memory)
   - ✅ **Memory** (in place of the form profile): the agent stores lasting information the user tells it on the phone and
     uses it in tasks; it can be viewed, edited, deleted and turned off in settings. Passwords/cards/one-time codes
     are not stored, nothing is recorded from private chats
10. ✅ **Deep research** (in the foreground, with the existing agent; 80 steps, markdown report with sources, share as PDF)

### Phase 3 – Modern browser (mostly Expo Go)

1. ✅ Cookie banner hiding and URL-based ad/tracker blocking (the part doable in Expo Go: navigations, iframes, pop-ups, resources and requests added later by scripts; resources hard-coded in the HTML are in Phase 4)
2. ✅ Dark theme (app + sites), bottom address bar option, swiping on the address bar to switch tabs, haptics
3. ✅ Tab groups (colored, nameable, collapsible; saved with the session), drag to reorder and add to group
4. ✅ Download manager (iOS: downloading with cookies and a Downloads screen; Android: the system download manager)
5. ✅ Clearing browsing data (by time range; cookies in Phase 4), HTTPS-only, third-party cookie setting
6. ✅ Biometric lock (app and private tabs; device passcode instead of iOS Face ID in Expo Go), QR scanning/generation
7. ✅ Offline saving and a Saved pages screen, fullscreen video (Android)
8. ✅ Accessibility review (screen reader announcements, reduce motion, text scaling limits, VoiceOver focus)

### Phase 3.5 – UI review and Comet reviews (Expo Go)

1. ✅ Name: Kutai → Qutai. Shared theme layer (dark theme on every screen, measured contrast), consistent icons (SF/Material Symbols), fixed address suggestions overlapping the bar
2. ✅ Logo drawn in code (Skia): gradient Q and an orbit that spins now and then; spins continuously while working. Aurora background (new tab, first launch)
3. ✅ First-launch setup: introduction, Privacy Policy and Terms of Use (acceptance required, versioned), AI key, protection settings, default browser
4. ✅ Tab groups with tasks: windows opened by the page and the assistant's tabs are grouped; the assistant can close a group at once (close_tabs)
5. ✅ Pull to refresh, screen does not dim while the app is open, full-width tables in chat, 'Rate Qutai'
6. ✅ From Comet reviews: undo clearing in the address bar, hiding the Qutai button and turning off the logo animation, persistent chat draft, force zoom, Chrome's user agent on Android (verification loops) and leaving verification to the user, note-taking in long tasks and a status summary at the last step, crash protection
7. ✅ Sites cannot ask 'Open in another app?' on their own (only after a tap; does not ask again after Cancel)

### Phase 4 – Things that require our own build

Merged with the "Once we switch to our own build" section in `TODO.md`:
voice commands, Android private tab isolation, network-level ad and tracker blocking (with URL lists; iOS
WKContentRuleList, Android request interception), cookie management and cookie deletion, Face ID on iOS, downloads
requiring login, Android PiP, background audio, being the default browser, widgets, "Share with Qutai",
app verification.

Added from Comet reviews:
- Ready-made filter lists for ad blocking (EasyList etc.) and letting the user add lists
- Voice commands, with the assistant going quiet when the user starts speaking (barge-in)
- Passwords: instead of our own manager, verify and fix that the system's (Google, iCloud Keychain) autofill works in the WebView
- Background audio and headphone media keys, site shortcut on the home screen
- ✅ Reader mode, together with read-aloud: the article only, in a themed view (light, dark, sepia; serif or sans; easier-reading spacing for dyslexic readers; the shared text size and the system font size); read aloud reads exactly what is shown, paragraph by paragraph, with play/pause/stop and the paragraph highlighted. Offered only on pages with enough article text (600 characters and 3 paragraphs)
- iOS default browser: applying for Apple's `com.apple.developer.web-browser` entitlement

Done in the development build:
- ✅ Calendar, reminders and notifications: after a booking the assistant offers (via `ask_user`) to add it to the calendar
  (`add_calendar_event`), set a reminder (`add_reminder`: iOS Reminders, on Android a calendar event with an alarm) or
  schedule a local notification (`schedule_notification`). Every write is confirmed with its details; permissions are
  asked on first use; never from incognito conversations. Reading the calendar is not done
- ✅ Bookmark folders (nested) and importing the HTML bookmark file that Chrome, Firefox, Safari and Edge export, into
  its own dated folder (duplicates and non-web addresses skipped and counted); exporting in the same format through
  the share sheet. Uses `expo-document-picker`, which Expo Go includes but an existing development build does not:
  **a new development build is needed** (an older build says import needs a newer version instead of crashing)
- ✅ Geolocation: web pages' `navigator.geolocation` (current position, watching, `permissions.query`) goes through
  Qutai, which asks per site ("Allow once", "Always allow on this site", "Don't allow"; block from the site's
  permissions), https only, forgotten with incognito tabs; and the assistant's `get_location` tool, confirmed every
  time and refused in incognito conversations. Foreground location only (`expo-location`, no background or
  foreground-service permissions): **a new development build is needed**

### Phase 5 – Things that require a server

Account system (shared with the credit system), end-to-end encrypted sync (including memory; deletion markers must be
kept for deletions), Qutai credits, background
deep research, price and page tracking, Safe Browsing checks.

---

### Ideas from Comet reviews (not yet scheduled)

- Serverless backup: while there is no sync, exporting/importing an encrypted backup file
- "What was sent to the AI" log: showing the user the page content sent with each request (a direct answer to privacy concerns)
- An optional 'Summarize results' chip on search results pages, keeping the results list intact

## 3. Things we recommend not doing

| Feature | Why |
|---|---|
| Our own password manager and password sync | The security risk and responsibility are too great; iOS and Android system autofill works in the WebView |
| DNS over HTTPS | WebView does not control DNS; the OS "Private DNS" setting does the same job |
| Extension support | Not possible with the WebView architecture |
| Undoing web actions | A submitted form or a completed payment cannot be undone from the browser; instead, prior confirmation and per-site permissions |

## 4. Comet comparison: our answers today

| Question | Qutai today |
|---|---|
| How many taps to reach the AI? | 1 (✦). With the Phase 2 chips and the selected text menu, contextual access also comes down to 1 tap |
| Single tab or multiple tabs? | Multiple tabs (opening, switching, listing tabs); reading without switching to the tab is Phase 2 |
| What can the agent complete? | Clicking, typing, selecting, navigating via the DOM, PDF, screenshots, read-aloud. It cannot click inside canvas and maps |
| How is permission obtained? | Mandatory confirmation for sensitive actions + optional confirmation for every action. Per-site permissions are Phase 2 |
| Are sources transparent? | Yes: pages read and AI search citations below the answer |
| Free / paid limits | Unlimited with your own key; Qutai credits are planned |
| iOS / Android differences | Private mode isolation, text selection menu, download and PiP behaviors differ |

## 5. Decisions

- [x] Start: Phase 1 (browser foundation)
- [x] Search suggestions on by default; always off in private mode
- [x] UI language: Turkish and English; matches the device language, English by default (done)
- [x] AI search: on by default, can be turned off in settings (the extra per-search charge goes to the user's own key)
- [ ] Should sync be end-to-end encrypted? (Recommended: yes)
