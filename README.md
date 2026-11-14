# Qutai

An AI-powered mobile browser for iOS and Android: an agent that can read and use the page for you,
tabs and private mode. Works with Anthropic (Claude), OpenAI and Google Gemini models, with the models on OpenRouter, and with a self-hosted OpenAI-compatible server. Besides the page, the assistant
can add calendar events, reminders and notifications, read the calendar when asked about the user's schedule, use the phone's location, offer a Call button and open the
phone's settings, each confirmed or tapped by the user.

Open tabs, history, bookmarks, recently closed tabs and chats are stored on the device (`expo-sqlite`); private tabs
and chats that touch a private tab save nothing. Each tab has its own chat with Qutai; the tabs of a group share one.

Bookmarks can be sorted into folders (Library › Bookmarks: long-press or ⋯ to rename, move or delete) and imported
from the HTML file that Chrome, Firefox, Safari and Edge export (on a computer, Chrome's Bookmark manager › ⋮ › Export
bookmarks); an import lands in its own dated folder and skips addresses that are already bookmarked. Export writes the
same format, so bookmarks can always be taken to another browser.

There is no account and no sync, so Settings › Backup exports everything to one password-protected file
(`qutai-backup-YYYY-MM-DD.qutai`, saved through the share sheet to Files, Drive…) and imports it on this or another
phone. Always in a backup: bookmarks and folders, history, the assistant's memory (with its categories), site permissions (assistant level, personal information and
location) and preferences (including reader mode, appearance and custom instructions). Optional: open tabs and tab groups (on by default),
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
tool list (with the user's custom instructions from Settings › Assistant, which go with every request). Every request is recorded at one place, the provider wrapper in `src/ai/providers.ts` (`src/ai/audit.ts`
builds the entry; the API key is never touched). Retention (`src/storage/sentLog.ts`): the outline (time, provider,
model, site, kinds and sizes) stays in SQLite for 30 days / 2000 entries like the activity history; the content itself
is kept only in memory until the app closes (the latest 60 requests, 2M characters, 4 images), so page text is never
copied to disk again, and location coordinates are never kept. Incognito conversations, and ones that touched an
incognito tab, stay in memory only and their earlier entries are removed from disk. Clear browsing data has its own
item for it.

The UI is in Turkish and English; it matches the device language (English by default). Strings live under `src/i18n/`.

Voice input: the microphone button next to the message field turns speech into text with the phone's own speech
recognition (`expo-speech-recognition`: iOS `SFSpeechRecognizer`, Android `SpeechRecognizer`), in the app's language
(the device's regional variant when it has one). Words appear as they are recognised, are added to what is already
typed and stay editable; nothing is sent until the user taps send (Settings › Assistant › "Send automatically after
speaking" changes that). Tap again or pause to stop. Starting to talk stops read-aloud, and read-aloud never starts
while the microphone is on. Recognition runs on the phone when it can (iOS on-device dictation for the language;
Android 13+ with the language downloaded); otherwise the phone's speech service (Apple's or Google's) receives the
audio, which Qutai explains and asks about once, before first use. Incognito conversations use on-device recognition
only. Nothing is recorded to disk, and no audio goes to Qutai or the AI provider. The microphone turns off when the
panel closes, another tab or a dialog comes up, the app leaves the screen, a call comes in or a site starts using the
microphone; what was heard stays in the field.

Attachments: the paperclip next to the message field attaches up to 4 images per message, from Photos (the system
photo picker, no photo library permission) or the camera; they show as removable thumbnails above the field, then in
the sent message, and a tap opens them full screen with Share and Save (to Photos). The attach sheet says that
attachments go to the AI provider with the message. Each attachment gets a stable id (`att-…`, `inc-…` in incognito)
and a small manifest in the conversation (id, name, MIME type, width, height, size; `src/chat/attachments.ts`). On the
phone (`src/device/attachments.ts`) the original is kept as picked, untouched, and a copy for the model is made once:
orientation applied, metadata (EXIF location) stripped by re-encoding, longest side at most 1568 px, JPEG (PNG stays
PNG while under the cap), at most 1 MB. The message text the model gets lists them ("image 1: id=…, name, 4032×3024,
you see it at 1568×1176"). All five providers get the images with the message in their documented form (Anthropic
`image` blocks, OpenAI Responses `input_image`, Gemini `image` parts, Chat Completions `image_url` parts). Retention:
images ride along with the 3 most recent user messages, 8 at most; older ones are named in the text instead, and the
assistant can look again with `view_attachment`. A model without image input (OpenRouter's catalogue, the custom
endpoint's setting) gets nothing: the chat says so before sending and the message stays in the field. Normal
conversations keep the files with the chat and delete them when nothing refers to them (the chat cleared, Clear
browsing data › chats, and at start for conversations that are gone); incognito ones live in a cache folder emptied
when the incognito session ends and at every start. The encrypted backup leaves attachment files out (a restored chat
shows "Not available"). "What was sent to the AI" shows attached images with the message like screenshots. Pasting an
image into the field is not supported (React Native's text input doesn't expose pasted images).

Reading PDFs: the assistant's `read_pdf` reads a PDF as text, page by page with page markers, from the PDF open in the
tab, a PDF link on the page (by ref) or an address, or a PDF the user attached (attach sheet › "PDF from Files", or
"Ask Qutai" on a PDF in Qutai's Downloads on iOS). It returns the page count, the title and other metadata when the
file has them, and up to 20,000 characters of text per call, cut at a page boundary with a note saying which pages to
ask for next. Pages without a text layer (scanned) are said to be so, and `view_pages` draws up to 3 pages as images
for models that take images. The PDF is read on the phone for every provider by Mozilla PDF.js (`pdfjs-dist`,
Apache-2.0, the same licence as Qutai), bundled with the app rather than loaded from a CDN: `postinstall`
(`scripts/build-pdf-reader.js`) writes its legacy build (the one that supports Safari 18+ / iOS 18+ and Chrome 125+)
and its JBIG2 and JPEG 2000 decoders (BSD-licensed, from PDFium and OpenJPEG) into `src/pdf/pdfjs.generated.json`
(about 2.3 MB added to the app; not committed). It runs in a hidden WebView created only while PDFs are read
(`src/components/PdfReaderHost.tsx`, `src/pdf/reader.ts`), whose page allows no network request at all. PDFs are
fetched like downloads but into memory only: through the tab's page first (with the site's cookies), otherwise directly
(on Android with the WebView's cookies, on iOS without); at most 30 MB; never saved to Downloads; a blocked site is
refused, a read-only one may be read. Native PDF input of the providers (Anthropic `document` blocks, OpenAI
`input_file`, Gemini `document` parts, OpenRouter `file` parts) is not used: text extraction works the same for all
five, costs far less per page, and scanned pages go through `view_pages`. A long-pressed PDF link offers "Read with
Qutai" (Android's WebView can't show PDFs, so opening one still downloads it). PDF text is untrusted page content (the
system prompt's safety rules name it), and "What was sent to the AI" lists it as "PDF text".

From the page menu (⋮) and by asking the agent: save the page as PDF (from its HTML, or from screenshots for pages
that come out wrong), save a screenshot of the visible area or the whole page (scrolled and stitched) to Photos,
read the page aloud, share/copy the link. When needed, the agent can also look at a screenshot of the page.

Reader mode (page menu, or the page icon in the address bar on article pages) shows just the article: title, byline,
text, headings, images and links, in light, dark or sepia, serif or sans, with an easier-reading spacing option and the
same text size as pages. Read aloud in reader mode reads exactly that article, highlighting the paragraph being read.
The page stays loaded underneath, so closing reader mode (or Android back) returns to it as it was.

## Opening Qutai from other apps

Anything that reaches Qutai from outside the app is treated as untrusted: another app or a web page chose it. A web
(http/https) link opens in a normal tab like any link; other text is never searched, submitted or sent to the AI
provider by itself. With the app lock on, the lock screen comes first and the item is handled after unlocking; nothing
from outside opens in an incognito tab. Each item is handled once (`src/device/entryPoints.ts`).

- **Share to Qutai (Android):** Qutai appears in the share sheet for text and links, as "Qutai" in other apps'
  text-selection menu, and for web searches handed to a browser. A small chooser then offers *Open page* (when the
  text holds exactly one web link), *Search with* the engine from Settings, *Ask Qutai about this* (the text goes into
  the assistant's message field, unsent) and *Summarize this page* (opens the page with the assistant ready; the user
  taps Summarize). Images and files are not accepted. iOS has no share extension yet (see Known limitations).
- **Launcher shortcuts:** long-press the app icon for *New tab*, *New incognito tab*, *Ask Qutai* and *Scan QR code*
  (Android static shortcuts, iOS Home Screen quick actions; English and Turkish).
- **Add to home screen (Android):** page menu (⋮) › *Add to home screen* pins a launcher shortcut for the page, with
  the site's letter badge; it opens the page in Qutai like any link. Not offered in incognito tabs. iOS gives apps no
  way to add a page to the Home Screen (Safari's "Add to Home Screen" is its own), so there is none there.

- **Home screen widget (Android):** "Qutai search" in the launcher's widget list: a search bar (opens a new tab with
  the address field ready), the assistant button, and New tab / Incognito / Scan QR. Resizable down to the bar alone;
  light, dark and Material You colours. It shows no history, tabs or other personal data, since others see a home
  screen. iOS has no widget yet (see Known limitations).

### The `qutai://` URL scheme

For automation, for example the Shortcuts app's *Open URL* action on iPhone or any app that can open a link on
Android. Parsed strictly (exact names, no unknown or repeated parameters, percent-encoded values); anything else is
ignored. Nothing is ever submitted or sent by these links:

| Link | What happens |
|---|---|
| `qutai://open?url=https%3A%2F%2Fexample.com` | Opens the page in a normal tab. Only `http`/`https`; any other scheme (`javascript:`, `file:`, …) is shown as text in the share chooser |
| `qutai://search?q=weather%20istanbul` | A new tab with the text in the address field, not submitted: the user taps Go |
| `qutai://ask?text=what%20is%20this` | The assistant panel with the text in the message field, not sent (`qutai://ask` alone just opens it) |
| `qutai://new-tab` | A new tab with the address field ready |
| `qutai://new-private-tab` | A new incognito tab (the incognito lock asks first if it is on) |
| `qutai://scan` | The QR code scanner |

Any app or web page can open these links, which is why none of them acts by itself.

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
| OpenRouter | Chat Completions API | https://openrouter.ai/settings/keys |
| Custom (OpenAI-compatible) | Chat Completions API at the address the user enters | The server's own key, or none |

OpenRouter's models are picked from its own catalogue (`GET /api/v1/models?supported_parameters=tools`, fetched with
the user's key, cached on the phone, Refresh to update): only models that accept tools are listed, searchable, with
their context window, and those without image input are marked (with one, `view_screenshot` returns a tool error
that tells the model to use `read_page`). A short "Recommended" list sits on top (plain data in
`src/ai/openrouterCatalog.ts`, no prices), and any model ID can be typed in. Requests carry OpenRouter's app
attribution headers with the app's public name and repository URL only (`HTTP-Referer:
https://github.com/sonsuzdongu/qutai`, `X-OpenRouter-Title: Qutai`). AI search (the provider's own web search) is
off with OpenRouter: its web plugin searches on every request, so on every agent step, and its newer search tool is
documented for the Responses API only; the assistant searches by opening a search engine in a tab instead, and
Settings says so.

"Custom (OpenAI-compatible)" is for self-hosted servers and gateways (Ollama, LM Studio, vLLM, a company gateway): a
base URL, an optional API key (sent as `Authorization: Bearer` only when set) and a model ID, typed or picked with
"Fetch models" (`GET /models`, when the server has it). The address is checked and normalised before it is saved
(`src/ai/customEndpoint.ts`): https, or plain http only to loopback and private-network addresses (10/8, 172.16/12,
192.168/16, link-local, `localhost`, `.local`), shown with "not encrypted, local network only"; no user name or
password in it, no query; trailing slashes and a pasted `/chat/completions` removed; a hint when there is no `/v1`.
Plain http works on iOS only (App Transport Security's local-networking exception); Android connects over https only,
see [docs/permissions.md](docs/permissions.md). "Test connection" sends four tiny fixed requests (nothing of the
user's, not logged) and reports each: server reachable, key accepted, model found (against `/models` when listed),
tool calling (a `ping` tool the model is asked to call), streaming, images (a 1×1 PNG; the result sets "Model accepts
images", which the user can change: off, `view_screenshot` returns a tool error telling the model to use `read_page`).
The assistant needs tool calling, so there is no chat-only mode. The settings say in one sentence that the user's
messages, pages, screenshots and memory go to the server they entered; "What was sent to the AI" shows the endpoint's
host for each request. The key is kept in SecureStore like the others; the base URL is a setting and goes into
backups (the key only with "Include my AI provider keys"). No web search with a custom endpoint, and no output limit
is sent (servers differ in which field they read).

Each conversation can use another model than the default: the model shown under the panel's title opens a sheet
with the providers that are set up (a key, or the custom endpoint) and their models (OpenRouter's full catalogue
too), and "Use my default". The choice belongs to the conversation (a tab's, or a tab group's), is saved with it
(never for an incognito one, which saves nothing) and goes when the chat is cleared; it applies to the next message,
and a task that is running keeps the model it started with (the control is disabled meanwhile). The default in
Settings never changes from here. Switching mid-conversation rebuilds the earlier turns from their text and tool calls
for the new model, as any switch does, and "What was sent to the AI" records the provider and model each request
really used. If the chosen provider is no longer set up, the default is used and the chat says so. Saved tasks don't
carry a model.

## Official builds and building it yourself

Qutai is open source, and the code here is the whole app. The official builds in the App Store and
Google Play are made from this same code with one build-time switch turned on:

| | Built from this repository (default) | Official store builds |
|---|---|---|
| `EXPO_PUBLIC_PRO_MODE` | `off` | `on` |
| AI | Your own Anthropic, OpenAI, Gemini or OpenRouter key, or your own OpenAI-compatible server | Your own key, or Qutai credits (planned) |
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
User ──► AssistantPanel ──► runAgent ──► provider adapter ──► Anthropic / OpenAI / Gemini / OpenRouter / custom
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
| `src/chat/Conversation.ts` | A conversation with the assistant: one per tab, or one shared by a tab group, with its own model choice (`src/components/ModelSheet.tsx`) |
| `src/components/Dialog.tsx`, `src/components/BottomSheet.tsx` | Themed dialogs (instead of native alerts) and the bottom sheet the menus use, kept inside the safe area |
| `src/ai/` | Provider-independent conversation model and the Anthropic, OpenAI, Gemini adapters; `chatWire.ts` / `chatCompletions.ts` speak the OpenAI Chat Completions format (OpenRouter and the custom endpoint), `openrouterCatalog.ts` / `openrouterModels.ts` the model catalogue, `customEndpoint.ts` / `customTest.ts` the custom endpoint's address rules and "Test connection" |
| `src/storage/` | Persistent data: SQLite database and its migrations, session, history, bookmarks, chat, saved tasks, settings |
| `src/i18n/` | Turkish and English UI strings, date formats |
| `src/device/` | Device features: PDF, screenshots (also full page), read aloud, voice input (`voiceInput.ts`), share/copy, downloads, private mode protection, calendar and reminders, notifications, location, opening system settings, the phone dialer |
| `src/browser/geolocation.ts` | Web pages' `navigator.geolocation`, answered by the app with a per-site location permission (ask / allow / block) |
| `src/content/filterLists.ts`, `src/content/blocking.ts` | Ad and tracker blocking: filter lists reduced to domains (pure parser and matcher), their download, updates and per-platform compilation; `src/content/adBlock.ts` is the built-in script blocker |
| `src/backup/` | The encrypted backup file: what goes in it, the encryption, and merging or replacing on import |
| `src/ai/audit.ts`, `src/storage/sentLog.ts` | "What was sent to the AI": the entry recorded for each request and how long it is kept |
| `src/agent/tools.ts` | Tools exposed to the model: reading (`read_page`, `read_source`, `read_tab`, `view_screenshot`, `view_attachment`, `read_pdf`), acting (`click`, `click_at`, `type`, `select_option`, `scroll`, `navigate`, tabs), saving (`save_pdf`, `save_screenshot`, `download_file`, `save_file`), memory, `ask_user`, `draft_email`, `search_history`, and the phone (`add_calendar_event`, `add_reminder`, `schedule_notification`, `read_calendar`, `get_location`, `offer_call`, `draft_sms`, `draft_whatsapp`, `open_settings`) |
| `src/agent/executeTool.ts` | Runs tool calls in the browser, asks for user confirmation if enabled |
| `src/agent/runAgent.ts` | Agent loop and trimming of old page outputs |
| `src/agent/systemPrompt.ts` | Behavior and safety rules |
| `src/agent/memory.ts` | The assistant's memory: categories, what is never stored (`sensitiveReason`) and the memory part of the prompt |
| `src/agent/personalData.ts` | Finds remembered personal details in what the assistant is about to type, so the app asks before they reach a site (per-site "Your personal information": ask / allow / block) |
| `src/utils/foreground.ts` | Pauses the agent when the app goes to the background, resumes it when it comes back to the foreground |
| `src/device/backgroundTask.ts`, `modules/qutai-agent` | "Keep working in the background" (Android): the `specialUse` foreground service and its notifications, the headless JS task that keeps timers running, and page commands sent natively to the tab's WebView while React Native is paused; also the assistant's downloads through the system download manager |

Along with each assistant response, the provider's raw output is also stored (Claude's thinking blocks, OpenAI's
encrypted reasoning content, Gemini's thought signatures, OpenRouter's `reasoning_details`) and sent back unchanged to
the same model. If the provider or model changes mid-chat, the history is rebuilt from the text and tool calls. With
OpenRouter, a request rejected (400) while it replays reasoning details is repeated once with those turns rebuilt
from text and tool calls. In the Chat Completions format a `tool` message carries text only, so a screenshot a tool
returned follows the tool messages as one user message with `image_url` parts. Images the user attached are not in the
saved history: user turns keep their manifest, and each request adds the model copies of the images still in context
(`src/agent/attachedImages.ts`), whichever provider it goes to.

Anthropic, OpenAI and OpenRouter replies are streamed (OpenRouter: a stream that fails for any reason but a lost
connection or an HTTP error is repeated once without streaming). Gemini replies are streamed only with "Stream Gemini responses
(experimental)" in Settings › Assistant (off by default, not yet verified against the live API): `src/ai/geminiStream.ts`
rebuilds the same interaction a non-streamed request returns from the stream's step events, thought signatures
included. A stream that fails is repeated once without streaming; if Gemini rejects a request over a thought
signature after a streamed reply, the request is repeated once with the streamed replies sent as text and tool calls,
and streaming stays off until the app restarts.

## Permissions

Each permission is asked for the first time a feature needs it, never at launch: camera (QR codes, photos for
upload fields), add-only Photos (saving screenshots and images), Face ID, write-only calendar and reminders (full calendar access only when the assistant first reads it), location
while in use (per-site), local notifications, camera and microphone for sites you allow (per site, each asked separately), microphone and (iOS)
speech recognition on the first tap of the panel's microphone button. The full list per platform, with
the feature, when the user is asked, the config line that declares it and what is blocked, is in
[docs/permissions.md](docs/permissions.md); use it for the App Store privacy labels and the Play Data safety form.

## Known limitations / next steps

- **Private mode isolation differs per platform.** iOS: each private tab has its own non-persistent data store
  (cookies and site data), gone when the tab closes. Android: the private tabs open at the same time share one private
  session, a WebView profile of their own (cookies, localStorage/IndexedDB, cache, service workers), apart from normal
  tabs (androidx.webkit multi-profile API through the patched `react-native-webview`: `webviewProfile` prop,
  `RNCWebViewProfiles.java`, `src/device/webviewProfile.ts`). WebView can't delete a profile the running app has used,
  so each session gets a new profile: closing the last private tab empties it (once its last WebView is destroyed) and
  it is deleted at the next start, as is one left by an app that was killed. On phones whose Android System WebView
  lacks profile support, private tabs share cookies and site data with normal tabs (cache and form saving off); the
  tab switcher, the new private tab page and Settings say so and suggest updating Android System WebView.
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
- **OpenRouter models differ.** Whether a model takes tools and images comes from OpenRouter's catalogue; a model
  that rejects tools anyway gets "This model can't use Qutai's tools; pick another". Passing reasoning details back
  follows OpenRouter's docs but has not been checked against every model family behind it. No per-model history
  budget exists in the app (old page outputs are trimmed by count, the same for every model), so the catalogue's
  context length is only shown in the picker.
- **Custom endpoints vary.** Compatible servers implement different parts of Chat Completions: tool calling depends on
  the model and how the server parses its tool calls (Ollama and LM Studio need a model with tool support; vLLM needs
  its tool-call flags), some ignore streaming or `stream_options`, and some reject `tool_choice` (never sent). An
  assistant turn with tool calls is sent with `content: null`, as the specification allows; a strict server may want
  a string. Android connects to custom endpoints over https only.
- **Old page outputs are trimmed.** This lowers cost, but on OpenAI previous reasoning items may not be reused
  because the history changes.
- **Background tasks are Android only, opt-in, and partial.** With Settings › Assistant › "Keep working in the
  background" on (Android, off by default), a task the user started goes on when they leave Qutai or lock the screen,
  in a foreground service with an ongoing notification (title from the user's message, the current step, Stop and
  Open). Reading and acting on the task's open pages (read, click, type, scroll, navigate, back, other tabs that are
  awake) and the AI requests go on; steps that need the user or the screen pause the task with a notification saying
  what is needed: confirmations (nothing is approved while the user is away), `ask_user` questions (and so CAPTCHAs),
  screenshots and PDFs, opening a new tab, a sleeping tab, the email composer, settings. A stalled page (no reply twice,
  or no progress for 4 minutes) and 30 minutes in the background also pause it. Incognito conversations never continue
  in the background. iOS doesn't offer it: iOS gives an app only a short time to finish work after it leaves the screen
  and suspends WebKit's pages with it, so tasks pause there, and on Android with the setting off, and resume where they
  left off when the app comes back; nothing is announced for a paused task. A task that ends while the user is in
  Qutai but looking elsewhere shows a toast with Show and a dot on the Qutai button. Needs a new development build (local module `modules/qutai-agent`). Not tested on
  a phone yet.
- **Scheduled tasks are reminders.** There is no server and nothing runs while Qutai is closed, so a saved task's
  schedule (once, daily, weekly) is a local notification at that time; tapping it opens the task ready to run (or runs
  it, if the user chose that for the task). Never without the tap. Reminders are rescheduled each time Qutai opens.
- **Tabs sleep.** At most five tabs keep a live WebView; the others sleep as a URL and thumbnail and reload
  when opened. Private tabs, tabs using the camera or microphone, tabs playing sound, and the tabs a running task works in
  or reads are never put to sleep.
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
- **Ad and tracker blocking is domain-based.** Filter lists the user picks (EasyList, EasyPrivacy, AdGuard Turkish,
  or any list by https URL) are downloaded on the phone from their publishers, never bundled; only their rules that
  block a whole domain are used, so ads served from a site's own domain, path rules and element hiding are not
  covered. Resources hard-coded in a page's HTML are blocked too (Android: request interception; iOS: WebKit content
  rule lists, which don't report how many requests they blocked). It needs the react-native-webview patch: **a new
  development build is needed**; an older build keeps only the built-in script blocker, which stops what scripts add
  later and can't touch resources in the HTML. Qutai's own requests (AI providers, list downloads, search
  suggestions) never pass through the blocker. "Block ads and trackers here" in a site's permissions turns it off
  for that site.
- **Voice input needs a new development build** (`expo-speech-recognition` is a native module; older builds start
  and the button says a newer build is needed). On iOS, on-device support can only be read for the phone's own
  language, so dictating in the other UI language counts as online (asked first, refused in incognito). On Android
  12 and older there is no enforced on-device mode, so recognition there is always online. On Android, another app
  taking the microphone isn't reported as such; the recogniser's error ends listening.
- **Background playback differs per platform** ("Keep playing in the background", on by default; needs **a new
  development build**). iOS: sound from `<audio>` and audio-only players goes on with the lock screen and headphone
  controls WebKit provides, but WebKit pauses `<video>` elements (e.g. YouTube) when the app leaves the foreground,
  unless they are in picture-in-picture. Android: a `mediaPlayback` foreground service with a media notification runs
  while a tab plays sound (local module `modules/qutai-media`); media inside frames isn't seen, and whether
  headphone buttons reach it is untested. Picture-in-picture on Android works for a playing full-screen video only.
  Incognito tabs show "Private tab" in the notification and on the lock screen.
- **Backups leave things out.** Downloads, saved pages, the "What was sent to the AI" list, caches and the lock
  settings are never in a backup file.
- **Reader mode is a heuristic.** It is offered only on pages with enough article text (600 characters, 3 paragraphs)
  and can miss or include the wrong parts on unusual layouts.
- **Group conversations have one known gap.** If a group is founded on a tab that hasn't been shown since the app
  started and a tab with a conversation then joins, that conversation stays hidden until the tab leaves the group.
- **Ways in from other apps are partly Android-only** (needs **a new development build**). Sharing to Qutai works on
  Android only: an iOS share extension is a separate target with an App Group that needs the owner's Apple account
  (`TODO.md` has the next step). Only text and links are accepted, not images or files. There are no Siri / App
  Intents actions yet; the Shortcuts app can use the `qutai://` links. "Add to home screen" and the home screen
  widget are Android-only: an iOS widget is a WidgetKit extension that also needs an App Group.
- **Nothing recent has been tested on a device.** The features added since the move to a development build (and many
  before it) are implemented but not yet tried on a phone; `TODO.md` has the checklist.
- **Prompt injection** is a risk. The system prompt marks page content as untrusted data and asks for confirmation
  for sensitive actions. The "Ask before every action" option in Settings provides extra protection.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

The license covers the code, not the Qutai name, logo or icons. See [TRADEMARKS.md](TRADEMARKS.md) before publishing a fork.
