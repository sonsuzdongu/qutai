# Qutai

An AI-powered mobile browser for iOS and Android: an agent that can read and use the page for you,
tabs and private mode. Works with Anthropic (Claude), OpenAI and Google Gemini models. Besides the page, the assistant
can add calendar events, reminders and notifications, use the phone's location, offer a Call button and open the
phone's settings, each confirmed or tapped by the user.

Open tabs, history, bookmarks, recently closed tabs and chats are stored on the device (`expo-sqlite`); private tabs
and chats that touch a private tab save nothing. Each tab has its own chat with Qutai; the tabs of a group share one.

Bookmarks can be sorted into folders (Library › Bookmarks: long-press or ⋯ to rename, move or delete) and imported
from the HTML file that Chrome, Firefox, Safari and Edge export (on a computer, Chrome's Bookmark manager › ⋮ › Export
bookmarks); an import lands in its own dated folder and skips addresses that are already bookmarked. Export writes the
same format, so bookmarks can always be taken to another browser.

There is no account and no sync, so Settings › Backup exports everything to one password-protected file
(`qutai-backup-YYYY-MM-DD.qutai`, saved through the share sheet to Files, Drive…) and imports it on this or another
phone. Always in a backup: bookmarks and folders, history, the assistant's memory, site permissions (assistant level and
location) and preferences (including reader mode and appearance). Optional: open tabs and tab groups (on by default),
the assistant's conversations (off) and its activity history (off), and the AI provider keys (off; only with an explicit
"Include my AI provider keys"). Never in a backup: incognito data (it is never stored), downloads and saved pages,
the "What was sent to the AI" list,
caches and thumbnails, and the app/incognito lock settings. Importing checks the password and the whole file first,
shows what it contains, then merges it with the phone's data (keeping what is there) or replaces each kind it contains,
in one database transaction, and restarts the app. The file is encrypted with XChaCha20-Poly1305 under a key derived
from the password with scrypt (`src/backup/crypto.ts` documents the format); the password cannot be recovered.

Requests to the AI go from the phone straight to the provider chosen in Settings, with the user's own key.
"What was sent to the AI" (Settings › Assistant, or "ⓘ Sent" under an answer) lists every request, newest first:
time, provider and model, the site, and what was new in it (the message, page text with its site and size, page source,
screenshots, another tab's text, history matches, memory, that a location was sent, calendar details, other tool
results), plus the size of the earlier conversation that is resent with each request and the fixed instructions and
tool list. Every request is recorded at one place, the provider wrapper in `src/ai/providers.ts` (`src/ai/audit.ts`
builds the entry; the API key is never touched). Retention (`src/storage/sentLog.ts`): the outline (time, provider,
model, site, kinds and sizes) stays in SQLite for 30 days / 2000 entries like the activity history; the content itself
is kept only in memory until the app closes (the latest 60 requests, 2M characters, 4 images), so page text is never
copied to disk again, and location coordinates are never kept. Incognito conversations, and ones that touched an
incognito tab, stay in memory only and their earlier entries are removed from disk. Clear browsing data has its own
item for it.

The UI is in Turkish and English; it matches the device language (English by default). Strings live under `src/i18n/`.

From the page menu (⋮) and by asking the agent: save the page as PDF (from its HTML, or from screenshots for pages
that come out wrong), save a screenshot of the visible area or the whole page (scrolled and stitched) to Photos,
read the page aloud, share/copy the link. When needed, the agent can also look at a screenshot of the page.

Reader mode (page menu, or the page icon in the address bar on article pages) shows just the article: title, byline,
text, headings, images and links, in light, dark or sepia, serif or sans, with an easier-reading spacing option and the
same text size as pages. Read aloud in reader mode reads exactly that article, highlighting the paragraph being read.
The page stays loaded underneath, so closing reader mode (or Android back) returns to it as it was.

## Running

Qutai needs a **development build**: several native modules it uses (`expo-calendar` among them) are not in
Expo Go, and Expo Go is not supported. Build and install it once, then start the development server:

```bash
npm install
npx expo run:android      # or: npx expo run:ios (builds natively and installs on a phone or emulator)
npx expo start            # later: the installed build connects to this server
```

Or build in the cloud with your own Expo account (`eas.json`; the first build links the project to your account):

| Profile | What it builds |
|---|---|
| `development` | The development build (`expo-dev-client`), installed directly on your devices (internal distribution) |
| `preview` | A release build to install directly on test devices (internal distribution) |
| `production` | The build for the stores; the build number (iOS) and version code (Android) are kept by EAS and go up by one on each build |

```bash
npx eas-cli build --profile development --platform android   # or ios, or all
```

All three keep `EXPO_PUBLIC_PRO_MODE=off`. `submit.production` is a skeleton (`npx eas-cli submit`): Android goes
to the internal testing track; the store accounts and app ids are not in the repository and are asked for (or set
in your own copy). iOS device builds need an Apple Developer account. Install a new build whenever a native module is
added: `expo-calendar`, `expo-notifications`, `expo-document-picker`, `expo-location` and `expo-crypto` came after the
first development builds. An older build still starts: the calendar, reminder and notification tools, location (for
sites and the assistant), bookmark import and backup export and import say that a newer build is needed.

On first launch the setup asks for a provider and API key; later, change them in Settings › Assistant (or the gear in the Qutai panel, opened with the Q logo in the address bar):

| Provider | API | Key |
|---|---|---|
| Anthropic | Messages API | https://platform.claude.com/settings/keys |
| OpenAI | Responses API | https://platform.openai.com/api-keys |
| Google Gemini | Interactions API | https://aistudio.google.com/apikey |

## Official builds and building it yourself

Qutai is open source, and the code here is the whole app. The official builds in the App Store and
Google Play are made from this same code with one build-time switch turned on:

| | Built from this repository (default) | Official store builds |
|---|---|---|
| `EXPO_PUBLIC_PRO_MODE` | `off` | `on` |
| AI | Your own Anthropic, OpenAI or Gemini key | Your own key, or Qutai credits (planned) |
| Account and sync | None | Through Qutai's servers (planned) |
| Where your data goes | Your device, and the AI provider you choose | Also Qutai's servers, for the pro features you use |

The pro features (accounts, sync, Qutai credits) are not in the code yet. The switch is there so they
can be added to this same codebase, shown only when it is on (`src/config/features.ts`). Qutai's server
is not part of this repository.

### Build it yourself

You need Node.js (LTS) and npm, and Android Studio with the Android SDK or Xcode on a Mac (or an Expo account to
build in the cloud with EAS, see Running).

```bash
git clone https://github.com/sonsuzdongu/qutai.git
cd qutai
npm install
cp .env.example .env      # leave EXPO_PUBLIC_PRO_MODE=off
npx expo run:android      # or: npx expo run:ios, on a connected phone or emulator
```

Values in `.env` are read when the app is bundled: after changing them, restart with `npx expo start -c`.

### Forking

The Apache License lets you fork, change and publish the code. Please give your fork its own name, logo,
icons and bundle identifier, as described in [TRADEMARKS.md](TRADEMARKS.md). If you want pro features in
your fork, run your own server and set `EXPO_PUBLIC_QUTAI_API_URL` to it; do not point forks at Qutai's
servers.

## How does it work?

```
User ──► AssistantPanel ──► runAgent ──► provider adapter ──► Anthropic / OpenAI / Gemini
                                     │
                                     ▼ tool call
                                executeTool ──► Browser ► Tab ──injectJavaScript──► WebView
                                     ▲                                                  │
                                     └────────── onMessage (result) ◄────────── pageScript (window.__qutaiAgent)
```

| File | Role |
|---|---|
| `src/browser/pageScript.ts` | JS injected into the page: converts the DOM to text, gives elements a `ref` number, clicks and types, extracts the article for reader mode |
| `src/browser/reader.ts`, `src/components/ReaderView.tsx` | Reader mode: thresholds, colours, the script-free reader document and its view over the tab |
| `src/browser/Tab.ts` | A single tab: sends commands to the WebView, matches responses, waits for page loads |
| `src/browser/Browser.ts` | Tab manager (open, close, switch, private tabs) and change notifications to React |
| `src/components/BrowserView.tsx` | Draws the WebViews of the awake tabs stacked on top of each other; at most five stay awake, the rest sleep as a URL and thumbnail |
| `src/chat/Conversation.ts` | A conversation with the assistant: one per tab, or one shared by a tab group |
| `src/components/Dialog.tsx`, `src/components/BottomSheet.tsx` | Themed dialogs (instead of native alerts) and the bottom sheet the menus use, kept inside the safe area |
| `src/ai/` | Provider-independent conversation model and the Anthropic, OpenAI, Gemini adapters |
| `src/storage/` | Persistent data: SQLite database and its migrations, session, history, bookmarks, chat, settings |
| `src/i18n/` | Turkish and English UI strings, date formats |
| `src/device/` | Device features: PDF, screenshots (also full page), read aloud, share/copy, downloads, private mode protection, calendar and reminders, notifications, location, opening system settings, the phone dialer |
| `src/browser/geolocation.ts` | Web pages' `navigator.geolocation`, answered by the app with a per-site location permission (ask / allow / block) |
| `src/backup/` | The encrypted backup file: what goes in it, the encryption, and merging or replacing on import |
| `src/ai/audit.ts`, `src/storage/sentLog.ts` | "What was sent to the AI": the entry recorded for each request and how long it is kept |
| `src/agent/tools.ts` | Tools exposed to the model: reading (`read_page`, `read_source`, `read_tab`, `view_screenshot`), acting (`click`, `click_at`, `type`, `select_option`, `scroll`, `navigate`, tabs), saving (`save_pdf`, `save_screenshot`), memory, `ask_user`, `draft_email`, `search_history`, and the phone (`add_calendar_event`, `add_reminder`, `schedule_notification`, `get_location`, `offer_call`, `draft_sms`, `open_settings`) |
| `src/agent/executeTool.ts` | Runs tool calls in the browser, asks for user confirmation if enabled |
| `src/agent/runAgent.ts` | Agent loop and trimming of old page outputs |
| `src/agent/systemPrompt.ts` | Behavior and safety rules |
| `src/utils/foreground.ts` | Pauses the agent when the app goes to the background, resumes it when it comes back to the foreground |

Along with each assistant response, the provider's raw output is also stored (Claude's thinking blocks, OpenAI's
encrypted reasoning content, Gemini's thought signatures) and sent back unchanged to the same model. If the
provider or model changes mid-chat, the history is rebuilt from the text and tool calls.

## Permissions

Each permission is asked for the first time a feature needs it, never at launch: camera (QR codes, photos for
upload fields), add-only Photos (saving screenshots and images), Face ID, write-only calendar and reminders, location
while in use (per-site), local notifications, camera and microphone for sites you allow (per site, each asked separately). The full list per platform, with
the feature, when the user is asked, the config line that declares it and what is blocked, is in
[docs/permissions.md](docs/permissions.md); use it for the App Store privacy labels and the Play Data safety form.

## Known limitations / next steps

- **Private mode is not fully isolated on Android.** The `incognito` prop of `react-native-webview` is not used because
  on Android it deletes all cookies; private tabs share cookies with normal tabs. Real isolation requires the
  Android WebView profile API (development build). On iOS, each private tab uses its own separate, non-persistent data
  store.
- **Clicking by coordinates works only on what the agent has seen.** `click_at` clicks a point of the latest
  `view_screenshot`, which covers only the visible area; everything else is clicked through DOM elements (`ref`).
- **The PDF is generated from a snapshot.** On very dynamic pages (content drawn by scripts) the PDF may look different
  from what is on screen; "PDF from screenshots" (page menu, or `save_pdf` with `from_screenshots`) is the fallback
  (images only, text not selectable).
- **Full-page captures have limits.** At most 25 screens / 20,000 CSS pixels (endless feeds are cut off, with a
  notice); images taller than 8192 px are split into several. Pages that scroll an inner element instead of the
  window come out as a single screen.
- **The agent is deliberately not given a tool for writing to the clipboard.** Only the user copies.
- **API keys are on the device.** Fine for personal use. Distribution requires a backend proxy that holds the keys.
- **Model quality varies.** Browser tasks are multi-step; small models may click the wrong element.
- **Old page outputs are trimmed.** This lowers cost, but on OpenAI previous reasoning items may not be reused
  because the history changes.
- **Does not run in the background.** iOS and Android freeze the app in the background. The task pauses and resumes
  where it left off when the app comes back to the foreground.
- **Tabs sleep.** At most five tabs keep a live WebView; the others sleep as a URL and thumbnail and reload
  when opened. Private tabs are never put to sleep.
- **Cross-origin iframes** (e.g. payment forms, some captchas) cannot be read.
- **Location goes to the site in the address bar only.** Pages ask through Qutai's own prompt (per-site setting: ask,
  allow, block; https only). Frames, such as an embedded map on another site, are always refused, and nothing is
  shared in the background (watches stop when the app or tab goes away). Location needs `expo-location`, which is not
  in older development builds: **a new development build is needed**. On Android the location script is injected
  before the page's own, but may run too late for a page that asks the moment it loads; it is installed again after
  the load.
- **Camera and microphone for web pages** (`getUserMedia`, video calls) work per site, like location: ask, allow or
  block for each, "Allow once" for the page, https only, the site in the address bar only (frames from other sites
  are refused). This relies on a small patch to react-native-webview (`patches/`, applied by `postinstall`) that lets
  the WebView grant only the origin and kinds the user allowed: **a new development build is needed**. Capture is
  paused while another tab is shown or Qutai is in the background, and screen sharing (`getDisplayMedia`) is refused.
- **Backups leave things out.** Downloads, saved pages, the "What was sent to the AI" list, caches and the lock
  settings are never in a backup file.
- **Reader mode is a heuristic.** It is offered only on pages with enough article text (600 characters, 3 paragraphs)
  and can miss or include the wrong parts on unusual layouts.
- **Group conversations have one known gap.** If a group is founded on a tab that hasn't been shown since the app
  started and a tab with a conversation then joins, that conversation stays hidden until the tab leaves the group.
- **Nothing recent has been tested on a device.** The features added since the move to a development build (and many
  before it) are implemented but not yet tried on a phone; `TODO.md` has the checklist.
- **Prompt injection** is a risk. The system prompt marks page content as untrusted data and asks for confirmation
  for sensitive actions. The "Ask before every action" option in Settings provides extra protection.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

The license covers the code, not the Qutai name, logo or icons. See [TRADEMARKS.md](TRADEMARKS.md) before publishing a fork.
