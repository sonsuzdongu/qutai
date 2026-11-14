# Qutai Roadmap

Source: the "Mobile Web Browser – Feature Inventory" document. Each item was compared with Qutai's current state
and classified by the infrastructure it can be built with. For task-level tracking see `TODO.md`.

**Status:** ✅ done (implemented in code; device testing is tracked in `TODO.md`, "To try on the phone") · 🟡 partial ·
⬜ missing
**Infrastructure:** **Go** = JavaScript only, with the native modules the app already has (the name comes from the
Expo Go days) · **Build** = needs a new native module or native code in our build · **Server** = requires a backend ·
**✕** = not possible or not recommended with the WebView architecture
**Size:** S = a few hours · M = 1–2 days · L = several days or more
Infrastructure and size are given only for what is still missing or partial; done rows leave them empty.

## Key finding

The browser foundation and the AI experience are both in place: data is stored on the device, the everyday browser
features are built, and the assistant reads, clicks (also by coordinates), uses other tabs and can add to the
calendar, share a location or offer a call. What is left is mostly what needs a server (accounts, sync, Qutai
credits, background tasks), native work in our own build (network-level blocking), and testing on real devices: most of it has never run on a phone.

---

## 1. Current state (by the document's sections)

### Core browser and address bar (sections 1–2)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Address bar, URL / search distinction | ✅ | | |
| Multiple tabs, tab switching, private mode | ✅ | | Android: private tabs share one profile of their own (WebView multi-profile API; old WebViews share cookies, and the app says so) |
| Back, reload, share, copy URL | ✅ | | |
| Forward, stop loading | ✅ | | In the icon row at the top of the menu |
| History, bookmarks, recently closed tabs | ✅ | | `expo-sqlite`; private tabs are not saved; bookmark folders, HTML import/export |
| Session restore (tabs when the app opens) | ✅ | | Restored tabs start asleep and load when opened |
| Autocomplete from history / bookmarks / most visited | ✅ | | Suggestion list; domain matches first |
| Live suggestions from the search engine | ✅ | | On by default, can be turned off in settings; off in private mode. Bing has no suggestion service |
| Search engine choice | ✅ | | Google, DuckDuckGo, Bing, Yandex |
| Start page and speed dial | ✅ | | New tab screen: most visited, bookmarks, recent visits, Ask Qutai |
| Paste and go, clearing the field | ✅ | | System paste button on iOS; clearing can be undone |
| HTTPS indicator, domain info | ✅ | | 🔒 / ⚠︎ Not secure; WebView cannot access certificate details |
| Find in page | ✅ | | Highlighting via page script (`FindBar`) |
| Desktop site | ✅ | | Per tab, from the page menu (`src/browser/desktopMode.ts`) |
| Reader mode | ✅ | | Readability-style extraction in the page script, shown in a script-free WebView over the page; light/dark/sepia, serif/sans, easier-reading spacing; read aloud with the paragraph highlighted |
| QR code scanning / generation | ✅ | | `expo-camera` scanner; generation with `qrcode-generator` |
| Voice search | 🟡 | Build | Voice input in the assistant panel with the device's speech recognition (on-device where possible, `expo-speech-recognition`); address-bar voice search not built. Needs testing on phones |
| Download manager | 🟡 | Go · S | See section 6: no progress or cancel on iOS |
| Detecting natural-language AI commands | 🟡 | – | "Ask Qutai" is at the top of the suggestion list; automatic detection will not be done (smart address bar decision) |

### Tab management (section 3)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Grid view, close, close all, private tabs | ✅ | | |
| Reopening a closed tab | ✅ | | Undo bar + recently closed list; closing a whole group can be undone |
| Search across tabs | ✅ | | `src/browser/tabSearch.ts` |
| Tab groups, naming, moving | ✅ | | Coloured, nameable, collapsible, saved with the session; a group shares one assistant conversation; its close icon offers "ungroup" or "close all" |
| Drag to reorder | ✅ | | Also drag into a group (`src/components/tabDrag.ts`) |
| Putting unused tabs to sleep | ✅ | | At most 5 open WebViews (`MAX_AWAKE_TABS`); a sleeping tab is kept as a URL and thumbnail; private tabs are not put to sleep |
| Cross-device sync | ⬜ | Server · L | Together with the account system; the encrypted backup file covers moving to a new phone until then |

### Privacy and security (section 4)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Private browsing | ✅ | | iOS: a data store per private tab. Android: one WebView profile per private session, emptied when the last private tab closes and deleted at the next start; WebViews without profile support share cookies with normal tabs (said in the app) |
| Screenshot restriction in private mode | ✅ | | |
| Hiding cookie banners and ad slots (visual) | ✅ | | CSS injection into the page (`src/content/`) |
| Network-level ad / tracker blocking | ✅ | Build · L | Domain-based, from filter lists the user picks (EasyList, EasyPrivacy, AdGuard Turkish; custom lists by URL), downloaded on the phone from their publishers and updated every few days. Android: native request interception (`shouldInterceptRequest`) with a blocked-request count per page; iOS: compiled WebKit content rule lists (no counts). Per-site off switch. Path, element-hiding and script rules of the lists are skipped. The built-in script blocker still catches what scripts add later. Not tested on a device; needs a new development build |
| Clearing history and data | 🟡 | Build · S | By time range: history, cache, recently closed, chats, activity, "sent to the AI", downloads, saved pages. Clearing cookies needs a native module |
| Cookie management, third-party cookies | 🟡 | Build · M | Third-party cookies blocked by default (Android setting; iOS WebKit blocks them anyway). No per-site cookie list or deletion |
| HTTPS indicator | ✅ | | |
| HTTPS-only | ✅ | | `http` → `https` upgrade on main-frame navigations, with a warning when a site falls back; subresources out of scope |
| Malicious site warning | 🟡 | Server · M | Android System WebView has its own Safe Browsing protection; Safe Browsing API for a full solution |
| Site permissions (camera, microphone, location) | ✅ | | Per-site ask / allow / block for each, frames refused. Location is answered by the app (`src/browser/geolocation.ts`); camera and microphone are gated natively per origin and kind by a small react-native-webview patch, with the prompt from the app (`src/browser/mediaCapture.ts`). Needs testing on phones |
| Password manager, form filling | ⬜ | ✕ / Go | **I do not recommend writing our own password manager.** Relying on iOS and Android system autofill is safer; the assistant fills forms from its memory (name, address) |
| Biometric lock | ✅ | | `expo-local-authentication`; app and private tabs; Face ID on iOS |
| DNS over HTTPS | ⬜ | ✕ | WebView uses the system DNS; the user can turn on the OS "Private DNS" setting |

### Content and media (section 5)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Save as PDF | ✅ | | From the page's HTML, or from full-page screenshots for very dynamic pages |
| Printing | ✅ | | `Print.printAsync` with the same page copy |
| Offline saving | ✅ | | Saved pages screen (`src/device/offline.ts`) |
| Reader mode | ✅ | | Page menu and an address bar icon on article pages; see Phase 4 |
| Text size, zoom | ✅ | | Text size sheet (Android `textZoom`, CSS on iOS); force zoom |
| Translation | ⬜ | Go · M | In place without breaking the layout: postponed (decision). The Translate chip translates in the chat |
| Select text to share, ask | ✅ | | Page script and a strip at the bottom of the page on both platforms |
| Open link in new tab, save image | ✅ | | Long-press menu via page script |
| Open in external app (tel:, mailto:, app links) | ✅ | | By asking the user; iframes cannot open apps; Android `intent://` and web fallback supported |
| Error page (no connection, site not found) | ✅ | | Explanation by error type and "Try again"; in two languages |
| Fullscreen video | ✅ | | Default on iOS; `allowsFullscreenVideo` on Android |
| Picture-in-Picture | ✅ | Build | iOS: the system player's PiP (not for incognito tabs). Android: a playing full-screen video when the user goes home (local module `modules/qutai-media`); setting; not for incognito tabs or with the app lock on. Not tested on a phone |
| Background audio | ✅ | Build | "Keep playing in the background" (on by default). iOS: audio background mode, WebKit handles the audio session and lock screen (videos pause when leaving, as WebKit does). Android: `mediaPlayback` foreground service with a media notification while a tab plays sound. Not tested on a phone |
| File and image download | ✅ | | See section 6; images are saved to Photos from the long-press menu |

### Download manager (section 6)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Download, list, open, share | ✅ | | iOS: the app's own Downloads folder and a Downloads screen (share, save to Files, delete). Android: the system download manager |
| Progress, pause / resume, cancel | 🟡 | Go · S | Android: the system download manager's notification. iOS: a file appears when it is finished; no progress or cancel |
| Downloads requiring login | ✅ | | iOS: the page fetches the file with the site's cookies; Android's download manager gets the cookies |
| Choosing download location | ✅ | | iOS: share sheet / Save to Files; Android: the system Downloads folder |

### User experience (section 7)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Dark / light / system theme | ✅ | | App UI + dark mode for sites (Android `forceDarkOn`, inverted pages on iOS) |
| Bottom / top toolbar choice | ✅ | | Address bar at the top or bottom (Settings) |
| Gestures | ✅ | | iOS edge swipe, Android back, swiping on the address bar to switch tabs, pull to refresh |
| Haptic feedback | ✅ | | `expo-haptics` |
| Language selection | ✅ | | Turkish and English, matches the device language; iOS and Android per-app language settings supported |
| Accessibility | 🟡 | Go · M | Reviewed in code (labels, announcements, reduce motion, text scaling, 44pt targets); no screen reader testing on a device yet |
| Being the default browser | 🟡 | Build · M | Android: intent filters for http/https, and a shortcut to the default apps settings. iOS: requires a special entitlement from Apple |
| Share to Qutai | 🟡 | Build · M | Android: share sheet, text-selection menu and web searches, with a chooser (open, search, ask as an unsent draft, summarize). iOS share extension open (needs an App Group in the Apple account; `expo-share-intent`) |
| Home screen widgets | ⬜ | Build | `expo-widgets` |

### Account and sync (section 8)

All **Server · L**. Should be handled together with the account infrastructure to be built for the credit system. Suggestion: history,
tabs and bookmarks should sync **end-to-end encrypted**; the server should not be able to see the content. Password sync
should not be done; leave it to the system password manager. Until then, an encrypted backup file (Settings › Backup)
moves everything to another phone.

### AI features (sections 9–10)

| Feature | Status | Infrastructure | Note |
|---|---|---|---|
| Asking about the page, summarizing, open tab context | ✅ | | Also the page's source (`read_source`) |
| Web agent, multi-step tasks, information gathering | ✅ | | Clicks by `ref`, or by coordinates on a screenshot (`click_at`) |
| Confirmation and cancel for agent actions | ✅ | | Confirmation for sensitive actions + "confirm every action" mode + stop |
| Follow-up questions | ✅ | | Chat history is kept, per tab or per tab group |
| Voice assistant | 🟡 | Build | Read-aloud and voice input in the panel (barge-in: talking stops read-aloud); no wake word or continuous conversation |
| Multi-tab analysis | ✅ | | `read_tab` reads other tabs without switching; "compare selected tabs" in the tab switcher |
| Citing sources, tabs used | ✅ | | Source cards below the answer (switch to the tab if open) |
| AI search (answers with sources) | ✅ | | Providers' own web search tools; can be turned off in settings. There is an extra charge per search |
| Deep research | ✅ | | In the foreground with the existing agent; markdown report with sources, PDF. In the background: Server |
| Smart address bar | ✖️ | – | Will not be done, per user decision |
| Shopping and travel assistant | 🟡 | Go · M | The agent can do this and adds bookings to the calendar; missing: ready-made flows and a comparison table |
| Form assistant | ✅ | | The agent fills forms, using what it keeps in memory (name, address); no passwords, cards or codes |
| Email assistant | ✅ | | Draft with `expo-mail-composer` (`draft_email`); the user presses the send button |
| Searching history in natural language | ✅ | | `search_history`: searched on the device, only matching results go to the model |
| Action preview and undo | 🟡 | | Preview and cancel exist. **Actions on the web generally cannot be undone** (a submitted form, a completed payment). The right approach is confirming the action beforehand; undo is only possible for browser actions (closing tabs, navigation) |
| Action history | ✅ | | What the agent did on which site, 30 days; plus "What was sent to the AI" |
| Per-site agent permissions | ✅ | | Default, always allow, ask on every action, read only, blocked |
| Device actions | ✅ | | Calendar events, reminders, local notifications, location (`get_location`), a Call button (`offer_call`), a text message to open in Messages (`draft_sms`), opening the phone's settings (`open_settings`); each confirmed or tapped by the user |

---

## 2. Phases

Ordering criteria: the gap the user will notice most → least effort → infrastructure dependency.

The app has since moved from Expo Go to a development build (several features use native modules Expo Go doesn't
have); "Expo Go" in the phase titles below is historical.

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
6. ✅ Biometric lock (app and private tabs; Face ID on iOS in our own build, the device passcode as a fallback), QR scanning/generation
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

Merged with the "Our own build (development build)" section in `TODO.md`:
Cookie management and cookie deletion, being the default browser on iOS, widgets, "Share with
Qutai" on iOS, app verification. Done since: "Share to Qutai" on Android, background audio and media controls, Android picture-in-picture, network-level ad and tracker blocking from filter lists (iOS WKContentRuleList,
Android request interception), Face ID on iOS, Android private tab isolation (WebView profiles), per-site camera and microphone for web pages, voice input in the assistant panel, downloads requiring login (the page's own cookies on iOS, the
system download manager on Android), Android default browser (intent filters).

Added from Comet reviews:
- ✅ Ready-made filter lists for ad blocking (EasyList, EasyPrivacy, AdGuard Turkish) and letting the user add lists by URL, with each list's home page and licence shown; domain rules only (the share each list contributes is shown per list). Not tested on a phone yet; needs a new development build
- ✅ Voice input in the assistant panel, with the assistant going quiet when the user starts speaking (barge-in): the phone's own speech recognition, on-device where the phone and language allow it, otherwise the phone's speech service only after the user agreed once (never in incognito). Not tested on a phone yet; needs a new development build
- Passwords: instead of our own manager, verify and fix that the system's (Google, iCloud Keychain) autofill works in the WebView
- ✅ Background audio and headphone media keys: "Keep playing in the background", the lock screen, notification (Android) and headphone buttons control the page's media through its Media Session (Android gets a small Media Session of its own, the WebView has none); a speaker in the tab switcher pauses a playing tab. Not tested on a phone yet; needs a new development build
- Site shortcut on the home screen
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

- ✅ Serverless backup: while there is no sync, exporting/importing an encrypted backup file (Settings › Backup;
  scrypt + XChaCha20-Poly1305 from `@noble`, randomness from `expo-crypto`, which needs **a new development build**
  for exporting; merge or replace on import, then the app reloads)
- ✅ "What was sent to the AI" log: every request recorded at the provider wrapper, listed with provider, model, site
  and what was new in it (exact text and screenshots while the app runs; only the outline is kept on disk, 30 days;
  incognito never written); Settings › Assistant and "ⓘ Sent" under answers; its own item in Clear browsing data
- ✅ A 'Summarize results' chip in the Qutai panel on Google, DuckDuckGo, Bing and Yandex results pages (detected from the URL, with the query); the results page itself is left intact (`searchResultsOf` in `src/browser/search.ts`)

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
| How many taps to reach the AI? | 1 (the Q in the address bar). Quick action chips and the selected text bar give contextual access in 1 tap too |
| Single tab or multiple tabs? | Multiple tabs (opening, switching, listing, closing); `read_tab` reads other tabs without switching; a tab group shares one conversation |
| What can the agent complete? | Clicking, typing, selecting, navigating via the DOM, clicking by coordinates on a screenshot (canvas, maps), reading the page source, PDF, screenshots (also full page), read-aloud, email drafts; on the phone: calendar events, reminders and notifications, the user's location, a Call button, opening the phone's settings |
| How is permission obtained? | Mandatory confirmation for sensitive actions + optional confirmation for every action + per-site agent permissions. Calendar, reminder, notification and location tools are confirmed every time; a call needs the user's tap. Sites get location only per site (ask / allow / block) |
| Are sources transparent? | Yes: pages read and AI search citations below the answer, and "What was sent to the AI" for every request |
| Free / paid limits | Unlimited with your own key; Qutai credits are planned |
| iOS / Android differences | Private mode isolation, downloads (the app's own folder on iOS, the system download manager on Android), reminders (iOS Reminders, a calendar event with an alarm on Android) and PiP behaviors differ |

## 5. Decisions

- [x] Start: Phase 1 (browser foundation)
- [x] Search suggestions on by default; always off in private mode
- [x] UI language: Turkish and English; matches the device language, English by default (done)
- [x] AI search: on by default, can be turned off in settings (the extra per-search charge goes to the user's own key)
- [ ] Should sync be end-to-end encrypted? (Recommended: yes)
