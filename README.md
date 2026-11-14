# Qutai

An AI-powered mobile browser for iOS and Android: an agent that can read and use the page for you,
tabs and private mode. Works with Anthropic (Claude), OpenAI and Google Gemini models.

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
caches and thumbnails, and the app/incognito lock settings. Importing checks the password and the whole file first,
shows what it contains, then merges it with the phone's data (keeping what is there) or replaces each kind it contains,
in one database transaction, and restarts the app. The file is encrypted with XChaCha20-Poly1305 under a key derived
from the password with scrypt (`src/backup/crypto.ts` documents the format); the password cannot be recovered.

The UI is in Turkish and English; it matches the device language (English by default). Strings live under `src/i18n/`.

From the page menu (⋮) and by asking the agent: save the page as PDF (from its HTML, or from screenshots for pages
that come out wrong), save a screenshot of the visible area or the whole page (scrolled and stitched) to Photos,
read the page aloud, share/copy the link. When needed, the agent can also look at a screenshot of the page.

Reader mode (page menu, or the page icon in the address bar on article pages) shows just the article: title, byline,
text, headings, images and links, in light, dark or sepia, serif or sans, with an easier-reading spacing option and the
same text size as pages. Read aloud in reader mode reads exactly that article, highlighting the paragraph being read.
The page stays loaded underneath, so closing reader mode (or Android back) returns to it as it was.

## Running

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone. All the native modules used come bundled with Expo Go.

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

You need Node.js (LTS) and npm, and either the **Expo Go** app on your phone or, for a native build,
Android Studio with the Android SDK or Xcode on a Mac.

```bash
git clone https://github.com/sonsuzdongu/qutai.git
cd qutai
npm install
cp .env.example .env      # leave EXPO_PUBLIC_PRO_MODE=off
npx expo start            # scan the QR code with Expo Go
```

For a native build on a connected phone or emulator (needed for things Expo Go can't do, such as showing
up in the list of default browsers):

```bash
npx expo run:android      # or: npx expo run:ios
```

You can also build in the cloud with your own Expo account: `npx eas-cli build --profile development`.
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
| `src/components/BrowserView.tsx` | Draws the WebViews of all tabs stacked on top of each other; hidden tabs keep running |
| `src/ai/` | Provider-independent conversation model and the Anthropic, OpenAI, Gemini adapters |
| `src/storage/` | Persistent data: SQLite database and its migrations, session, history, bookmarks, chat, settings |
| `src/i18n/` | Turkish and English UI strings, date formats |
| `src/device/` | Device features: PDF, screenshot, read aloud, share/copy, private mode protection, opening system settings, location |
| `src/browser/geolocation.ts` | Web pages' `navigator.geolocation`, answered by the app with a per-site location permission (ask / allow / block) |
| `src/agent/tools.ts` | Tools exposed to the model (`read_page`, `read_source`, `click`, `type`, `navigate`, `open_tab`, `view_screenshot`, `save_pdf`, `read_aloud`, `open_settings`, `offer_call`, `get_location`…) |
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
while in use (per-site), local notifications. Web pages get no camera or microphone. The full list per platform, with
the feature, when the user is asked, the config line that declares it and what is blocked, is in
[docs/permissions.md](docs/permissions.md); use it for the App Store privacy labels and the Play Data safety form.

## Known limitations / next steps

- **Private mode is not fully isolated on Android.** The `incognito` prop of `react-native-webview` is not used because
  on Android it deletes all cookies; private tabs share cookies with normal tabs. Real isolation requires the
  Android WebView profile API (development build). On iOS, each private tab uses its own separate, non-persistent data
  store.
- **The agent can see the screen but cannot click by coordinates.** It can look at the page with `view_screenshot`, but
  clicking only works through DOM elements (`ref`); it cannot click elements inside a canvas or map. What the model
  sees (`view_screenshot`) covers only the visible area.
- **The PDF is generated from a snapshot.** On very dynamic pages (content drawn by scripts) the PDF may look different
  from what is on screen; "PDF from screenshots" is the fallback (images only, text not selectable).
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
- **Tabs consume memory.** Each tab stays open as a separate WebView.
- **Cross-origin iframes** (e.g. payment forms, some captchas) cannot be read.
- **Location goes to the site in the address bar only.** Pages ask through Qutai's own prompt (per-site setting: ask,
  allow, block; https only). Frames, such as an embedded map on another site, are always refused, and nothing is
  shared in the background (watches stop when the app or tab goes away). Location needs `expo-location`, which is not
  in older development builds: **a new development build is needed**.
- **Prompt injection** is a risk. The system prompt marks page content as untrusted data and asks for confirmation
  for sensitive actions. The "Ask before every action" option in Settings provides extra protection.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

The license covers the code, not the Qutai name, logo or icons. See [TRADEMARKS.md](TRADEMARKS.md) before publishing a fork.
