# Performance, November 2026: tokens, start-up and memory, iOS run-through

Three parts, measured on 17 Nov 2026 on `main`. Each part says how it was measured, what was found, what was changed
and what was left alone, with the reason.

## A. Token consumption of the assistant

### How it is measured

`npm run measure:tokens` (`scripts/token-tests/`, README there). Six scripted tasks are replayed through the app's own
request code: the history kept as `runAgent` keeps it and compacted by `src/agent/history.ts`, the real system prompt and
tool list, and the real adapters (`callAnthropic`, `callOpenAI`, `callGemini`) over a fake wire that records each body
and answers with the scripted step in the provider's own format. Nothing leaves the machine and no provider is paid.
Page snapshots are generated in read_page's exact format (header, `[ref=N]` lines, the 20,000-character cut).

| Task | What it does | Requests |
|---|---|--:|
| plain | a question answered without tools | 1 |
| summarise | read a long article in two read_page calls, summarise | 3 |
| form | read a contact form, type five fields (one rejected and fixed), select, untick, read again | 10 |
| two-tabs | read search results, open two products in tabs, read_tab each, notes, close tabs | 7 |
| memory-task | memory on (eight memories, memory tools), run a saved task over three pages, remember; then a follow-up message that adds three items to the basket | 18 |
| long | 18 steps: six page reads, three tabs, notes, two screenshots | 18 |

Models: Claude Sonnet 5.5, GPT-5.6 Terra, Gemini 4 Hydrogen (the defaults), prices from `src/ai/prices.ts`
(as of 16 Nov 2026).

**Limits of the method.** Tokens are estimated (`scripts/token-tests/tokens.ts`): adding a tokenizer package was refused
by this machine's permission check, and the providers' token-counting endpoints need a key. The estimator follows BPE
splitting and gives about 4.1 characters per token on the system prompt and 3.5 on the tool JSON; absolute numbers can be
off by 10–20 % (Claude's tokenizer counts more than o200k), comparisons between versions are sound. Prompt caching is
simulated with each provider's rules as published on 17 Nov 2026:

- **Anthropic:** prefix order tools → system → messages; an entry is written at each `cache_control` breakpoint; a hit is
  looked for up to 20 blocks before a breakpoint; at least 512 tokens on the 5.5 models; writes 1.25× input, reads 0.1×.
- **OpenAI (GPT-5.6, implicit mode):** a breakpoint at the end of the latest message, writes billed (30 min: 1.25×),
  reads 0.1×, at least 1,024 tokens. Which mode is the default on GPT-5.6 is not stated on the page; implicit is
  assumed. The encrypted reasoning item each reply carries (`store: false`) is replayed and counted (900 characters
  assumed).
- **Gemini (implicit caching, the only kind on the Interactions API):** the longest prefix shared with an earlier request
  is read, at least 4,096 tokens; Gemini 4 re-processes the last 2,050 tokens when a request adds fewer; no write
  price. A thought signature (400 characters) per reply is replayed.

Each task starts with a cold cache (in real use the tools and system prompt stay cached between tasks a few minutes apart,
so the first request of a task is often cheaper than shown).

### Where the tokens go (before)

Prompt tokens of all the task's requests, by part:

| Task | Provider | Requests | System | Tools | History | Page | Tool results | Images | Total |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|
| plain | anthropic | 1 | 3.2k | 10k | 125 | 0 | 0 | 0 | 13k |
| plain | openai | 1 | 3.2k | 11k | 124 | 0 | 0 | 0 | 14k |
| plain | gemini | 1 | 3.2k | 10k | 135 | 0 | 0 | 0 | 14k |
| summarise | anthropic | 3 | 9.5k | 30k | 513 | 8.8k | 0 | 0 | 49k |
| summarise | openai | 3 | 9.5k | 32k | 1.2k | 8.8k | 0 | 0 | 51k |
| summarise | gemini | 3 | 9.5k | 31k | 822 | 8.8k | 0 | 0 | 50k |
| form | anthropic | 10 | 32k | 101k | 3.4k | 8.1k | 1.6k | 0 | 146k |
| form | openai | 10 | 32k | 105k | 13k | 8.1k | 1.6k | 0 | 160k |
| form | gemini | 10 | 32k | 103k | 7.7k | 8.3k | 2.2k | 0 | 152k |
| two-tabs | anthropic | 7 | 22k | 71k | 2.1k | 24k | 691 | 0 | 119k |
| two-tabs | openai | 7 | 22k | 74k | 6.9k | 24k | 691 | 0 | 127k |
| two-tabs | gemini | 7 | 22k | 72k | 4.2k | 24k | 929 | 0 | 123k |
| memory-task | anthropic | 18 | 70k | 186k | 9.3k | 58k | 5.1k | 0 | 328k |
| memory-task | openai | 18 | 70k | 194k | 44k | 58k | 5.1k | 0 | 370k |
| memory-task | gemini | 18 | 70k | 189k | 24k | 58k | 6.8k | 0 | 348k |
| long | anthropic | 18 | 57k | 181k | 9.1k | 71k | 3.7k | 24k | 346k |
| long | openai | 18 | 57k | 189k | 43k | 71k | 3.7k | 24k | 387k |
| long | gemini | 18 | 57k | 185k | 23k | 72k | 5.1k | 24k | 365k |

Per request the fixed part is about 13,000 tokens: the tool definitions (51 tools, about 10,000 tokens, 35 KB of JSON)
and the system prompt (about 3,100 tokens; 3,900 with the memory section). It is two thirds of a short task's tokens and
over half of a long one's. The page content is the next largest part.

### What was checked, and what was found

| Candidate | Finding |
|---|---|
| Size of the system prompt and tool list; all tools every time | Yes: 13k tokens per request, every request. Cached on all three providers after the first request (0.1×), so the real cost is the first write of each task (about $0.03 on Sonnet). Not changed: see "Not done". |
| Verbose / duplicated instructions | Checked by 6-word overlap between the system prompt and all tool descriptions: 94 shared 6-grams in 5,228 words, mostly in draft_email, get_location, read_calendar, settings. Too little to be worth the risk of changing behaviour. |
| Page snapshots re-sent in full every step | No: older snapshots were already cut to 300 characters, keeping the newest two in full. **But** the cut moved one result per step, changing the history in the middle on almost every step of a long task (27 of 29 steps in the test), which ends every provider's cache there. **Fixed** (batches). |
| Old tool results at full size | Only results over 1,500 characters are large; small ones (type, click) are kept and are 1–2 % of tokens. |
| Screenshots re-sent | No: only the newest screenshot is sent (`[Older screenshot removed]`). Left as is. |
| History never trimmed in long tasks | Trimmed as above (snapshots); the step limit (40, research 80) bounds the rest. Saved conversations are compacted the same way. |
| Prompt caching broken by a changing prefix | System prompt and tools are byte-stable within a task (no timestamps or ids in them; the time, tab and identity are in the user message; tool order fixed; memory re-read each step but the same unless it changes). **Anthropic: the conversation was never cached**: only the tools and system prompt had a breakpoint, so every step paid full price for the whole history. **Fixed.** OpenAI and Gemini cache automatically; they lost only to the moving compaction. |
| The relay and cache controls | The relay builds tools and system itself with a breakpoint on the system prompt, and passes the app's message-level `cache_control` through (it accepts two per request). The new breakpoint goes through unchanged (test updated). |
| `max_tokens` and thinking budgets | Billed on what is generated, not on the limit: no saving there. Direct Anthropic sends `max_tokens: 8192` and no thinking; OpenAI and Gemini 32,000. Left as is. |
| Title / summary side requests | None exist (the only other request is "Organise memories", started by the user). |

### What was changed

1. **Old page snapshots are compacted in batches of two** (`src/agent/history.ts`, `COMPACT_BATCH = 2`, moved out of
   `runAgent.ts`). Results are cut only when two more have arrived, so the history sent stays the same on every
   other step and the cache keeps working; between two and three snapshots are sent in full instead of exactly two.
   Which results are cut depends only on the turns (same history, same request), and compacting a saved conversation
   again changes nothing. Batch sizes 1–4 were measured; 2 was best for all three providers (3 and 4 add more full
   snapshots than the cache saves).
2. **The conversation is cached on Anthropic** (`src/ai/anthropic.ts`, `withHistoryBreakpoint`): a breakpoint on the last
   block of the last user message (the newest tool results). The next step reads everything before it at 0.1× and writes
   only the new part. Never on a final assistant message (a paused turn goes back exactly as received), never on the raw
   output kept with the history. Own key and Qutai Credits alike.

Tests: `scripts/assistant-tests/tokenRules.test.ts` (9 tests: the batch rule, the stable prefix, determinism,
idempotence, only large results counted, the breakpoint's place, two breakpoints in all, raw output untouched);
`scripts/credits-tests/provider.test.ts` updated for the breakpoint in the relay body. `test:assistant`,
`test:instructions`, `test:approvals`, `test:credits`, `test:custom`, `test:cost`, `test:text` all pass.
The prompt and tools did not change: **the profile id is unchanged** (`85146ff9…6637e85`).

### Before → after

| Task | Provider | Prompt tokens | Uncached / cache read / cache write, before | after | Cost before → after | Change |
|---|---|--:|---|---|--:|--:|
| plain | anthropic | 13k → 13k | 125 / 0 / 13k | 0 / 0 / 13k | $0.0338 → $0.0339 | 0 % |
| plain | openai | 14k → 14k | 0 / 0 / 14k | 0 / 0 / 14k | $0.0350 → $0.0350 | 0 % |
| plain | gemini | 14k → 14k | 14k / 0 / 0 | 14k / 0 / 0 | $0.0206 → $0.0206 | 0 % |
| summarise | anthropic | 49k → 49k | 9.3k / 26k / 13k | 0 / 31k / 18k | $0.0560 → $0.0495 | −11 % |
| summarise | openai | 51k → 51k | 0 / 32k / 19k | 0 / 32k / 19k | $0.0552 → $0.0552 | 0 % |
| summarise | gemini | 50k → 50k | 20k / 30k / 0 | 20k / 30k / 0 | $0.0339 → $0.0339 | 0 % |
| form | anthropic | 146k → 146k | 13k / 119k / 13k | 0 / 130k / 16k | $0.0736 → $0.0550 | −25 % |
| form | openai | 160k → 160k | 0 / 142k / 18k | 0 / 142k / 18k | $0.0766 → $0.0766 | 0 % |
| form | gemini | 152k → 152k | 35k / 117k / 0 | 35k / 117k / 0 | $0.0635 → $0.0635 | 0 % |
| two-tabs | anthropic | 119k → 126k | 27k / 79k / 13k | 0 / 105k / 21k | $0.0968 → $0.0647 | −33 % |
| two-tabs | openai | 127k → 133k | 0 / 101k / 26k | 0 / 111k / 22k | $0.0871 → $0.0810 | −7 % |
| two-tabs | gemini | 123k → 129k | 34k / 89k / 0 | 32k / 97k / 0 | $0.0599 → $0.0567 | −5 % |
| memory-task | anthropic | 328k → 342k | 72k / 242k / 14k | 0 / 312k / 30k | $0.2077 → $0.1101 | −47 % |
| memory-task | openai | 370k → 384k | 0 / 325k / 45k | 0 / 348k / 36k | $0.1827 → $0.1634 | −11 % |
| memory-task | gemini | 348k → 362k | 69k / 279k / 0 | 59k / 303k / 0 | $0.1274 → $0.1140 | −10 % |
| long | anthropic | 346k → 363k | 107k / 225k / 13k | 0 / 322k / 41k | $0.2760 → $0.1408 | −49 % |
| long | openai | 387k → 404k | 0 / 326k / 61k | 0 / 355k / 49k | $0.2254 → $0.2011 | −11 % |
| long | gemini | 365k → 383k | 80k / 286k / 0 | 75k / 308k / 0 | $0.1453 → $0.1397 | −4 % |
| **all six** | anthropic | 1,001k → 1,039k (+4 %) | | | $0.744 → $0.454 | **−39 %** |
| **all six** | openai | 1,109k → 1,146k (+3 %) | | | $0.662 → $0.612 | **−8 %** |
| **all six** | gemini | 1,052k → 1,089k (+4 %) | | | $0.451 → $0.428 | **−5 %** |

Qutai Credits with Anthropic behind a tier gets the same saving as own-key Anthropic (the relay passes the breakpoint
on); with OpenAI or Gemini behind it, the same as theirs. The server's charge follows the provider's usage, so credits
go further by the same share.

Prompt tokens rise 3–5 % in tasks with many page reads (one more snapshot kept in full half of the time). That costs
real money only where nothing is cached: OpenRouter models without caching and custom endpoints. A long task there
pays about 5 % more; every cached provider pays less.

### Not done, and why

- **Smaller or on-demand tool lists.** The tool list is 10k tokens per request, but cached it costs 1k-token-equivalents
  per step; the cost is the first write of each task (about $0.03 on Sonnet, $0.035 on GPT-5.6 Terra). Sending tools
  by need (a core set, the rest on request) would cut that write but changes the cached prefix whenever the set changes
  and risks the model not finding a tool; shortening descriptions risks behaviour, and the duplicated part is small. A
  candidate for later, with the behaviour tests extended first.
- **A one-hour cache on the tools and system prompt (Anthropic `ttl: "1h"`, OpenAI `12h`).** Writes cost 2× instead of
  1.25×; it pays only for a user who runs tasks more than 5 minutes apart but within the hour. Needs real usage data, and
  the relay accepts only `{type: "ephemeral"}` from the app (the server would have to set it).
- **`prompt_cache_key` for OpenAI.** On GPT-5.6 it only separates cache accounting; the relay builds its own body anyway.
- **Page diffs instead of full snapshots.** read_page after an action re-sends the page; a diff would save page tokens but
  makes refs and validation errors harder for the model to read, and the newest snapshots are what it needs most.
- **Images** (only the newest screenshot is kept; one dropped screenshot changes the history like a compaction does):
  screenshots are rare; left as is.

## B. Cold start and memory

### How it was measured

- **iOS:** a Release build for the simulator in pro mode (`xcodebuild -configuration Release`, Hermes bytecode),
  iPhone 17 Pro simulator on iOS 27.0, on this Mac (Apple silicon, 16 GB). Start-up from screen recordings
  (`simctl io recordVideo`, 30 frames a second, the frame where the picture changes) and from timestamps logged by
  temporary probes in a JS-only rebuild of the same app (the probes were removed afterwards and never committed).
  Memory is `phys_footprint` from `footprint <pid>` (the figure iOS's memory limit counts), for the app and, apart,
  for the WebKit processes (each WKWebView's pages run in their own processes).
- **Android:** the arm64 release APK already in `builds/` (pro mode, built 17 Nov 02:04, used read-only), emulator
  Medium Phone API 36.1 (Android 16, arm64, no window, 3 GB), airplane mode so the build's server address was not
  contacted. `am start -W`, a screen recording for time to content, `dumpsys meminfo`. The APK in
  `android/app/build/outputs/apk/release/` turned out to be a development-client build (it opens the Expo dev
  launcher), so it was not used.
- **Emulator and simulator numbers are not phone numbers.** The simulator runs on the Mac's CPU and disk with the
  Mac's memory; the emulator has no GPU here and its own System UI stalled ("isn't responding") under load. Use them to
  compare versions, not as what users see. Commands for a phone are at the end of this section.

### Results

| What | iOS simulator (Release) | Android emulator (release APK) |
|---|---|---|
| First launch after install | about 10 s to the onboarding (one-time Metal shader compiling and dyld cache); first JS module at +4.4–5.0 s | `am start -W` 1,047 ms to the first frame |
| Cold start, first frame | iOS launch animation +0.4 s (plain splash colour) | 484–593 ms (`TotalTime`, five runs) to the splash |
| Cold start, first JS module runs | +1.75–1.80 s after `simctl launch` (four runs) | – |
| Cold start, JS work until the first real frame | 130–150 ms: module loading 60–65 ms, settings (45 secure-storage reads) 13–20 ms, database and session 5 ms, first render 60–75 ms | – |
| Cold start to usable UI (address bar, restored tab drawn) | 1.87–1.93 s from the tap, with 20 tabs restored (video) | 1.43–1.57 s to the onboarding drawn (video, three runs) |
| Warm start (from background) | 0.77–0.83 s, most of it iOS's app-switch animation | – |
| Memory after launch, new tab page | 68 MB app, no WebKit process | 112 MB PSS, 227 MB RSS (onboarding) |
| 1 page tab | 74 MB app + WebKit | – |
| 5 page tabs | 89 MB app + 120 MB WebKit (7 processes) | – |
| 20 page tabs | 88 MB app + 119 MB WebKit (7 processes): only 5 tabs keep a WebView (`MAX_AWAKE_TABS`) | – |
| Cold start with 20 tabs restored | 63 MB app + 39 MB WebKit: restored tabs stay asleep until shown | – |
| Assistant panel open | 76–80 MB app + 42 MB WebKit | – |
| During a 6-step task (fake AI) | 89–100 MB app + 44–45 MB WebKit | – |
| After the task | 100 MB app + 45 MB WebKit | – |
| JS bundle | 11.2 MB (`main.jsbundle`, Hermes bytecode) | 9.6 MB in the APK (10.2 MB exported) |
| App size | 135 MB simulator `.app` (not thinned; 63 MB of it frameworks: React 24 MB, Hermes 12 MB, ExpoModulesCore 7.7 MB) | 57.5 MB arm64 APK; a universal APK 170 MB |

What dominates the bundle (share of Hermes source-map segments, `expo export` for Android): react-native 17 %,
react-native-reanimated 9.4 %, react-reconciler 5.2 %, @shopify/react-native-skia 4.4 %, expo 4.3 %, App.tsx 2.6 %,
marked 1.7 %, worklets 1.6 %, executeTool.ts 1.3 %, AssistantPanel.tsx 1.3 %. By size of text in the bundle, pdf.js
(`src/pdf/pdfjs.generated.json`, 2.3 MB) and the nine extra interface languages (about 1.4 MB of source) are the biggest
single items.

**Confirmed lazy:** the nine non-English dictionaries are `require`d inside functions (`src/i18n/index.ts`), so Hermes
loads their bytecode only when that language is used; pdf.js is `require`d inside `readerHtml()` only when a PDF is read;
restored tabs have no WebView until shown (`Tab.asleep`); the glow is unmounted while no task runs, and the action marker
layer is one empty view when idle.

Per CPU type in the APK: the Skia library 13.6 MB (used only by the working glow and the aurora background),
React Native 6.7 MB, the JS bundle 9.6 MB, classes.dex 8.7 MB, the ML Kit barcode library 5.6 MB (QR scanner).

### What was wrong and cheap, and what was done

The start path was checked for work at module load, eager requires, synchronous storage reads, WebViews for background
tabs and idle glow/marker layers. It is in good shape: the app's own JavaScript takes about 150 ms from its first module
to the first real frame on the simulator; the 45 secure-storage reads of the settings run in parallel and take 13–20 ms;
the only synchronous read is a one-line install marker file (iOS clean-start check).

- **Fixed:** the working glow compiled its SkSL shader when App's imports loaded, before the first frame, though the
  glow shows only during tasks (`820af68`). It is now compiled the first time the glow shows. The saving is a few
  milliseconds and not visible in the measurements above; kept because it is correct and free.

Nothing else was clearly wrong, so nothing else was changed; the before and after start-up numbers are the same within
noise. The time before JavaScript runs (1.75 s on the simulator, much less on a phone) is native: loading 16 dynamic
frameworks, React Native and Expo module set-up, mapping the 11 MB bundle.

### Bigger ideas, not done

1. **Measure the native start on a phone with Instruments' App Launch template** before changing anything; if dyld
   loading of the dynamic frameworks shows up, try static linking of pods.
2. **Replace Skia** (13.6 MB per Android CPU type, about 4 % of the bundle, its own init) with a gradient-based glow and
   aurora (Reanimated and plain views): the two shaders are its only use.
3. **pdf.js out of the bundle:** ship it as an asset file read when a PDF is first opened; the bundle drops by about 2.3 MB.
4. **`inlineRequires`** in Metro (off by default in Expo's config): delays loading of modules until first use. Needs
   care with modules that register things at load (background tasks, the i18n start-up order) and a full run-through.
5. **Settings in one record** instead of 45 secure-storage items: only matters on slow devices (13–20 ms here).

### On a phone (owner)

Android (USB debugging on, release APK installed):

```bash
adb shell am force-stop com.sonsuzdongu.qutai && adb shell am start -W -n com.sonsuzdongu.qutai/.MainActivity
```

```bash
adb shell dumpsys meminfo com.sonsuzdongu.qutai | grep -E "TOTAL PSS|TOTAL RSS"
```

```bash
adb shell dumpsys gfxinfo com.sonsuzdongu.qutai reset
```

Then scroll a long page for 10 s, with and without a task running, and:

```bash
adb shell dumpsys gfxinfo com.sonsuzdongu.qutai | grep -E "Janky|50th|90th"
```

Repeat the cold start five times and take the median; measure memory after launch, with 1, 5 and 20 tabs (open them
from the tab switcher), with the assistant panel open and during a task.

iPhone: Xcode › Open Developer Tool › Instruments › App Launch, choose the phone and Qutai (a Release build), record five
launches; Allocations or the Xcode memory gauge for memory at the same points as above.

## C. iOS run-through on the simulator

### Set-up

- The app: Release build for the simulator in pro mode (`ios/` regenerated with `npx expo prebuild --platform ios`, pods
  installed, `xcodebuild -configuration Release -sdk iphonesimulator`), with `EXPO_PUBLIC_PRO_MODE=on`,
  `EXPO_PUBLIC_QUTAI_API_URL=http://localhost:8792`, `EXPO_PUBLIC_DEV_LOGIN=on` and a throwaway test secret, all on the
  command line. Fixes made during the run were tried with JS-only rebuilds of the same app (bundle rebuilt with
  `expo export:embed` and `hermesc`, swapped into a copy of the `.app`, re-signed ad hoc).
- The server: a copy of the API Worker on port 8792 from a temporary copy of `wrangler.jsonc` in a scratch folder, with
  its own `.dev.vars` there (newly generated signing key, pepper and AES key; `DEV_SIGN_IN=true`, `FAKE_PURCHASES=true`,
  `EMAIL_SENDER=log`, no mail link domain so the link is `qutai://sign-in/email?token=…`) and its own local database
  (migrations and seed applied there). No provider keys: nothing could be spent. The owner's `.dev.vars` was not read or
  touched; ports 8000, 8790, 8791 were not used.
- The AI: the new fake AI server (`scripts/fake-ai/server.mjs`, port 8793) as the Custom endpoint, model "fake".
- Test pages: a local static server with long articles, a form and a PDF.
- Devices: a new **iPhone 17 Pro, iOS 27.0** simulator and a new **iPad Air 11-inch, iOS 27.0** simulator, created for
  this run and shut down afterwards. The iOS 26.5 iPhone simulator that another session uses for videos was not used;
  this session's own attempt to shut it down was refused by the permission check, and the manager shut it down.
- Screenshots: `docs/performance-2026-11/`.

### Results

| # | Check | Result | Screenshot |
|--:|---|---|---|
| 1 | First launch, onboarding in English (privacy, choose AI, own key › Custom, permissions, profile, browsing, default browser, assistant hint) | Pass | ios-01 |
| 2 | Onboarding in Turkish after delete and reinstall ("siz" throughout; Qutai Credits path, disclosure, sign-in, balance, buy credits from setup) | Pass | ios-03, ios-04, ios-43 |
| 3 | Browsing, opening links from `qutai://open` | Pass | ios-25 |
| 4 | Tabs and the tab switcher (21 tabs, search, incognito tab group) | Pass, one small issue (O6) | ios-02 |
| 5 | Reader mode | Pass | ios-05 |
| 6 | Find in page (1/106 matches, next/previous) | Pass | ios-06 |
| 7 | Downloads | Partly: a PDF link opens the PDF in the tab; a link with the `download` attribute also just opens it (O5). The downloads list was not exercised. | – |
| 8 | Bookmarks import/export | Not run (needs the iOS file picker and share sheet; no bookmarks in the test data) | – |
| 9 | Assistant click/type task: panel drops, step strip ("Thinking…", "Typing (ref 1): …", "Clicking (ref 3)"), field frame and click ring of the action marker, glow round the screen, result card and sources | Pass | ios-10…14 |
| 10 | Approval dialog (location, with "Don't ask again"), Deny shows "You declined this" | Pass | ios-15, ios-16 |
| 11 | Stop during a request (strip and glow go, "Stopped · 0 tokens") | Pass | ios-17 |
| 12 | In-flight keep-alive (new `qutai-agent` iOS module): app sent home 12 s into a 25 s request | Pass: compiles, no crash, the app stayed alive, the request was sent once and its answer was there on return | ios-18 |
| 13 | Landscape: browser, panel (right side), tab switcher (3 columns), working mode | Pass | ios-20, ios-21, ios-24, ios-25 |
| 14 | Rotation mid-task (landscape → portrait during a 5-step task) | Pass: the task went on, strip and glow followed | ios-22, ios-23 |
| 15 | Settings and sub-screens (Account, Assistant, Privacy and security, Appearance, Language, Search, Backup, About; English and Turkish) | Pass | ios-50, ios-52…56 |
| 16 | Language: Settings › Language › "Change in iOS Settings" | Partly: iOS Settings opens, but on its main page, not Qutai's page (O4) | ios-51 |
| 17 | Email sign-in by code | Pass | ios-30, ios-31 |
| 18 | Email by link (`xcrun simctl openurl "qutai://sign-in/email?token=…"` while the code dialog is open), adding a method | Pass | ios-33 |
| 19 | Add a second email, remove it | Pass after fix F2 (the add-email field had a capitalising text keyboard) | ios-32, ios-34 |
| 20 | Merge two test accounts (preview with both balances, combine; credits kept; both emails sign in to the result) | Pass | ios-35, ios-36 |
| 21 | Buying credits in fake mode from Settings › Account › Qutai Credits | **Failed, fixed (F1)**: the button did nothing on iOS. After the fix: test pack bought, balance 100.00 | ios-40, ios-41 |
| 22 | Server backup: password set, backup uploaded | Pass | ios-42 |
| 23 | Restore between two installs (delete app, reinstall, sign in): one-time restore offer, password, preview (21 tabs, 21 history entries, preferences), merge, restart | Pass: the tabs came back | ios-44, ios-45 |
| 24 | Incognito lock: switch on (Face ID), open an incognito tab, leave and return | Pass: "Incognito tabs are locked", Unlock | ios-56, ios-60, ios-61 |
| 25 | Delete the app and reinstall starts clean (onboarding again, no session, no remembered address) | Pass | ios-03 |
| 26 | iPad layout (onboarding) | Pass (content column centred, full-width button) | ipad-01 |

### Fixed during the run (own commits)

- **F1 `b09ed40` (severe on iOS): "Buy credits" in Settings › Account › Qutai Credits did nothing.** The buy-credits
  sheet was drawn by a host at the app's root; with Settings (itself a sheet) up, UIKit refused to present it
  ("Attempt to present … which is already presenting" in the system log). Settings now has its own host and the newest
  mounted host draws the sheet; the root host takes over again when Settings closes, and only one host ever shows it
  (Android stacks modals, so two would show twice). Checked on the simulator from Settings and from setup.
- **F2 `347d6c0` (minor): the add-email and code prompts used a plain text keyboard** (capital first letter,
  corrections). The shared dialog's text field takes an optional kind: email (email keyboard, no capitals or
  corrections, email autofill) or code (number pad, one-time-code autofill). Checked on the simulator.

### Open, ranked by severity

- **O1 (medium, needs a check by hand): the email field in onboarding's Qutai sign-in did not take focus** after
  delete-and-reinstall with the simulator in Turkish. Steps: delete Qutai; set the phone to Turkish; install; Başlayalım ›
  accept › Qutai ile devam edin › Qutai Kredilerini kullan › E-posta ile devam et › tap the address field. Seen: no caret,
  no keyboard, typed text lost, "Tam bir e-posta adresi girin" after Return. The same happened in every text field until
  the simulator was rebooted (the address bar too), and after switching the simulator back to English the field worked,
  so this is most likely the simulator's keyboard after a language change, not the app. Worth one try on a phone.
- **O2 (low): placeholder text in dialog fields looked letter-spaced** ("n a m e @ e x a m p l e . c o m") the first
  time the add-email prompt opened on iOS 27; after F2 it was normal. Watch for it on a phone.
- **O3 (low): the step strip names elements by ref** ("Typing (ref 1): …", "Clicking (ref 3)"). The model needs refs;
  the user would understand the field's or button's label better.
- **O4 (low): Settings › Language opens the iOS Settings app at its main page,** not at Qutai's page where the language
  is chosen (`Linking.openSettings()`). On the iOS 27.0 simulator, with the app freshly installed. Check on a phone; if
  it does the same there, add a line telling the user to scroll to Qutai › Language.
- **O5 (low): a link with the `download` attribute to a PDF opens the PDF in the tab** instead of offering a download.
  Steps: a page with `<a href="file.pdf" download>`, tap it.
- **O6 (low): one restored tab showed its address ("localhost:8794") instead of its title** in the tab switcher (the first
  tab opened from a `qutai://open` link, with the system's "Open in Qutai?" prompt in between).
- Not a bug: "126,6k tokens" and dates such as "17 November 2026 Tuesday" follow the simulator's region (en_TR).

### Not done, and why

- **Android emulator checks of working mode, landscape and fake purchases.** The app allows only https for its own
  requests on Android (`src/ai/custom.ts`, `src/ai/http.ts`), so it can't reach the local server copy or the fake AI over
  http, and a public tunnel was not allowed. The emulator was used for start-up and memory only (section B) and was shut
  down afterwards. A phone checklist is in `docs/test-checklist.md` § 13.
- **Bookmarks import/export, the downloads list:** need the iOS file picker and share sheet; left for a phone.
- **Simulated typing** drops characters while the keyboard slides in and with a non-English keyboard layout; every check
  above was repeated until the text was really in the field, and failures caused only by that are not reported as bugs.

### Native rebuild

Needed for the phone: the iOS project was regenerated here for the simulator (the `qutai-agent` iOS module and
`expo-network` were not in the last iOS build), and the new Android keep-alive and `expo-network` also need a fresh
Android build. This session's own changes (A, B, C) are JavaScript only.
