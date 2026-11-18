# Qutai

An AI-powered mobile browser for iOS and Android: an agent that can read and use the page for you,
tabs and private mode. Works with Anthropic (Claude), OpenAI and Google Gemini models, with the models on OpenRouter, and with a self-hosted OpenAI-compatible server. Besides the page, the assistant
can add calendar events, reminders and notifications, read the calendar when asked about the user's schedule, use the phone's location, offer a Call button and open the
phone's settings, each confirmed or tapped by the user.

Open tabs, history, bookmarks, recently closed tabs and chats are stored on the device (`expo-sqlite`); private tabs
and chats that touch a private tab save nothing. Each tab has its own chat with Qutai; the tabs of a group share one.

While a task works on its own, the panel's input is closed: dimmed, not editable, "Qutai is working…", with the
attach, microphone and one-tap task buttons disabled and Stop in place of Send (stopping is always possible). Typing
or sending during a task was never possible (the field was already read-only and a message is not queued or passed to
the running task); text already in the field stays there, dimmed, to send afterwards. The input opens again as soon as
the task needs the user (a confirmation), and when it ends: finished, a question with choices or free text, paused
answers, stopped, failed, or a message handed back to the input. A screen reader hears "Qutai is working…" once. The
page the task works on shows a soft brand-blue glow fading in from its edges, pulsing slowly (static with Reduce
motion), only on that tab and only while it is on screen and the task works; off while a confirmation waits and when
Qutai leaves the screen (picture-in-picture). It is drawn over the tabs, not inside the tab's view, so the assistant's
screenshots and saved page images never contain it, and it takes no touches (`src/components/WorkingGlow.tsx`).

The empty Qutai panel suggests a few things that fit the page on screen: "Is this a good buy?" and "Find it cheaper"
on a product, the ingredients of a recipe, "Help me fill this in" on a form, "Which result fits best?" on a search
results page, "Save this table as CSV", and so on, with general examples on the new tab page. They are picked on the
phone from a few flags in the page's markup (structured data, forms, video, tables; never its text), with no AI
request; nothing is sent until one is tapped. A blocked site gets no page suggestions, a read-only site no form
filling, and incognito tabs nothing that needs the location or the calendar (`src/agent/pageSuggestions.ts`).

Bookmarks can be sorted into folders (Library › Bookmarks: long-press or ⋯ to rename, move or delete) and imported
from the HTML file that Chrome, Firefox, Safari and Edge export (on a computer, Chrome's Bookmark manager › ⋮ › Export
bookmarks); an import lands in its own dated folder and skips addresses that are already bookmarked. Export writes the
same format, so bookmarks can always be taken to another browser. The assistant can manage them from the chat too (`bookmarks` tool: add the current page or a link, remove, list, search and open, move, rename, create and delete folders): it changes bookmarks only when asked, removing one shows Undo, and deleting a folder with contents or removing more than three in a task asks first.

The assistant can also read and change Qutai's appearance and browsing settings when asked (`settings` tool: theme, dark sites, address bar position, text size, search engine and suggestions, haptics, force zoom, the Qutai button, reader mode colours, typeface and easier reading, background playback, picture-in-picture, blocking ads and trackers, hiding cookie banners, third-party cookies, and turning HTTPS-only on). Changes go through the same path as the Settings screen, show as a line in the chat and in the activity history, and the assistant says how to undo them. Everything else (asking before actions, site permissions, memory, custom instructions, provider, model, keys, endpoint, web search, background work, locks, voice consent, turning HTTPS-only off, backup, clearing data, filter lists) is refused with an offer to open Settings: a web page that manages to instruct the assistant must not be able to remove the user's protections. The allowlist is `CHANGEABLE` in `src/agent/settingsTool.ts`; a new setting is not changeable from the chat unless it is added there.

There is no sync, so Settings › Backup exports everything to one password-protected file
(`qutai-backup-YYYY-MM-DD.qutai`, saved through the share sheet to Files, Drive…) and imports it on this or another
phone. Always in a backup: bookmarks and folders, history, the assistant's memory (with its categories and which memories are hidden from the AI), site permissions (assistant level, personal information and
location) and preferences (including reader mode, appearance and custom instructions). Optional: open tabs and tab groups (on by default),
the assistant's conversations (off) and its activity history (off), and the AI provider keys (off; only with an explicit
"Include my AI provider keys"). Never in a backup: incognito data (it is never stored), downloads and saved pages,
the "What was sent to the AI" list,
caches and thumbnails, and the app/incognito lock settings. Importing checks the password and the whole file first,
shows what it contains, then merges it with the phone's data (keeping what is there) or replaces each kind it contains,
in one database transaction, and restarts the app. The file is encrypted with XChaCha20-Poly1305 under a key derived
from the password with scrypt (`src/backup/crypto.ts` documents the format); the password cannot be recovered.

In pro builds, signed in, the same file can also be kept in the Qutai account (Settings › Backup › Qutai account):
"Back up now", the account's backups with Restore and Delete, an optional daily automatic backup while the app is open
(off by default; Wi-Fi only by default; never in the background or with an incognito tab in front), and the backup
password, set once and kept on the phone (cleared on sign-out). The server stores only the encrypted file and keeps the
newest 3; a restore goes through the same import screen. After signing in on a new phone the app offers the newest
backup once. Details: `docs/server-backup.md`; the server: `backend/README.md` › Server backup.

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

### Approximate cost

The last answer of each task shows what the task used and, when the price is known, about what it cost:
"≈ $0.012 · 3.4k tokens", in the answer's row of icons (copy, read aloud, share, more), beside them. It never wraps
and never pushes the icons away: with less room (a narrow panel, a large text size) the tokens go first ("≈ $0.012"),
then the amount is cut short with "…"; a screen reader always hears the full text. An error, a stopped task or a
question with choices has no row of icons, so there the figure keeps its own small line under the item. Tapping it shows the model, the requests the task made (an agent task makes one per step),
the tokens by kind (input, read from the cache, written to the cache, output with its thinking part), web searches,
where the figure comes from and the conversation's total so far. "What was sent to the AI" shows the same per
request, with a breakdown in the request's page and a total per day. Settings › Assistant › "Show approximate cost"
hides it (on by default).

**It is an estimate.** Own-key mode multiplies the tokens the provider reported for each request by the list prices
in `src/ai/prices.ts` (standard tier, read from the providers' pricing pages; the date is shown as "prices as of").
The provider's invoice is what counts: discounts, batch pricing, free allowances (Google's 5,000 free searches a
month), taxes and credits are not known to the app. Where the app has no price, it shows tokens only and never a
guess: the custom endpoint, models missing from the table, and OpenRouter unless OpenRouter reports the cost itself
(it does with every response, and then its figure is shown, with the provider's charge added when the request used
your own provider key at OpenRouter). Requests that were stopped or failed report nothing, and the breakdown says
how many.

How it works: each adapter reads the provider's usage (`src/ai/usage.ts`: Anthropic's `usage` from the response or
from `message_start` and `message_delta` in a stream, cache writes split by lifetime, web search requests; OpenAI's
Responses `usage` with cached, cache-write and reasoning tokens and one search per `web_search_call`; Gemini's
interaction `usage`, thinking added to output at the output price, Google Search queries from `grounding_tool_count`;
Chat Completions `usage` for OpenRouter and the custom endpoint, which is asked for it in a stream with
`stream_options.include_usage` and repeated without it if the server refuses the field). The provider wrapper in
`src/ai/providers.ts` prices each reply (`src/ai/cost.ts`: whole micro-dollars per million tokens times tokens, in
BigInt, rounded once to nano-dollars; prompt-size tiers such as Claude Haiku 5.5 over 100,000 tokens or OpenAI over
272,000, and dated price changes) and the agent adds up a task's requests.

What is stored: with the conversation, the last item of each task gets the numbers (provider and model ids, request
counts, token counts by kind, the cost in nano-dollars, the price table's date and where the figure came from), no
content. It goes where the conversation goes: saved on the phone, in an encrypted backup that includes chats and
restored with it, never written for incognito conversations. "What was sent to the AI" keeps the same numbers per
request in its SQLite outline for its 30 days (memory only for incognito).

Updating the prices: open `src/ai/prices.ts`, read each provider's pricing page (the URL is on every row), change
or add rows (micro-dollars per million tokens: $2.50 = `usd('2.50')`; `above` for a prompt-size tier, `from` /
`until` for an announced change), set `read` on the rows you checked and `PRICES_AS_OF` to that date, and run
`npm run test:cost`. A model you can't find a published price for stays out of the table.

Pro mode: requests that go through Qutai's server will show the server's own charge instead. The seam is ready (a
reply that already carries a `cost` with `source: 'server'` is kept by the wrapper, and the breakdown has its text);
reading the server's settlement event is a later job.

"Tell me about yourself" (setup's "Let me get to know you a little" step, and Settings › Assistant › Memory ›
"Introduce yourself"; `src/components/VoiceIntro.tsx`, logic in `src/intro/`, design in
[docs/voice-introduction.md](docs/voice-introduction.md)): the user talks freely (the panel's voice input, listening
through pauses) or types, edits the transcript, and one request to their AI turns it into notes. The answer is
strict JSON that is checked, not trusted: every value must come with the user's own words, found in the transcript, so
an inferred age, gender or diet is refused. Qutai then asks at most three fixed, translated follow-up questions about
food, the name, shopping, the city or the answer style (never age or gender), answered by voice, typing, chips or
Skip; typed or spoken answers cost one more request. Nothing is saved before the review page, where every note can
be edited, deleted, and for age, gender, allergies and health hidden from the AI. Without an AI, or when the request
or its answer fails, it says so and continues with the typed questions (`ProfileQuestions`), the transcript shown
above them. Cost: about 450 tokens in and 400 out per introduction with an own key (`npm run measure:intro`).

Hidden memories: national ID and passport numbers, and any memory the user locks on the Memory screen, are never
sent to the AI provider by value. The prompt names them only ("[id] national ID number (saved; value hidden)"); the
model asks for one with `type`'s `memory` parameter, the app asks the user the first time each hidden value goes to a
site in a task (even where personal details are always allowed; never on blocked sites or http pages) and types the
value itself. Tool results are scanned for hidden values (also spaced or dashed) and show "[hidden: …]" instead, and
a screenshot for the model blanks fields that show one and is refused when one is in the page's text. Limits: the site
receives the value (that is the point); a page that shows it reformatted, escaped or in an image is not recognised;
it went to the provider once, in the message where the user told the assistant; and anything typed or pasted into
the chat is sent like any message.

The UI is in English, Turkish, German, Spanish, Portuguese (Brazil), French, Japanese, Korean, Russian and Indonesian
(`src/i18n/`, one file per language with exactly the keys of `en.ts`; English is the fallback; only the active
language is loaded). By default it follows the phone's language (region variants map to the language: es-MX → es,
pt-PT → pt-BR); *Settings › Language* picks one: on Android 13+ that is the system's per-app language (the same setting
as Settings › Apps › Qutai › Language, so the two stay in step, and the widget follows); on
older Android Qutai keeps the choice itself and applies it to its screens, notifications and widget; on iOS
the row opens Qutai's page in the Settings app, where iOS keeps the per-app language (and restarts the app). The
interface switches without restarting, so tabs and conversations stay. The privacy policy and terms exist in English
and Turkish only; other languages show the English text with a translated note. Text sent to the model stays English.
Translations into the eight newer languages have not been reviewed by native speakers yet.

Voice input: the microphone button next to the message field turns speech into text with the phone's own speech
recognition (`expo-speech-recognition`: iOS `SFSpeechRecognizer`, Android `SpeechRecognizer`). Hold it to talk and
lift the finger to stop (the same gesture as holding the Qutai button, `src/components/useHoldGesture.ts`; sliding
away before lifting stops without sending), or tap it to start and tap again or pause to stop. It listens in the
language of the user's last message in that conversation, typed or spoken, so an English phone hears Turkish in a
Turkish chat (`src/chat/messageLanguage.ts`: a small on-phone guess per message from the user's own messages, never
the assistant's, in any of the ten interface languages: letters only one of them uses, Cyrillic, kana or Hangul,
frequent words and endings, ignoring URLs, numbers, code, quotes and names; a
message without a clear language keeps the one before). The recogniser needs the language before it starts, so the
first sentence spoken in a new language may still be heard in the old one. The order is: a language picked in that
conversation (the TR/EN tag next to the microphone while listening), the Settings › Assistant › "Listening language"
default when it isn't Automatic,
the conversation's language, the language last used, the app's language, then the phone's own language, each mapped to the device's regional
variant when it has one (`tr-TR`, `en-GB`); a language the phone's recogniser lacks is skipped and the user is told
which one is used instead (`src/device/voiceLanguage.ts`). Words appear as they are recognised, are added to what is already
typed and stay editable; nothing is sent until the user taps send (Settings › Assistant › "Send automatically after
speaking" changes that; with it on, lifting the finger after a hold sends). Starting to talk stops read-aloud, and read-aloud never starts
while the microphone is on. Recognition runs on the phone when it can (iOS on-device dictation for the language;
Android 13+ with the language downloaded); otherwise the phone's speech service (Apple's or Google's) receives the
audio, which Qutai explains and asks about once, before first use. Incognito conversations use on-device recognition
only. Nothing is recorded to disk, and no audio goes to Qutai or the AI provider. The microphone turns off when the
panel closes, another tab or a dialog comes up, the app leaves the screen, a call comes in or a site starts using the
microphone; what was heard stays in the field.

Push-to-talk: holding the Qutai button in the address bar for 0.4 s (Android's own long-press time; a vibration)
starts listening without opening the panel. Everything the start needs (the recogniser's languages, on-device or
online, the language) is worked out when the button is touched and when the panel opens (`warmVoice`), so the
recogniser is started the moment the hold registers; the microphone itself stays off until then. "Getting ready…"
shows (the listening look at less than full strength) until audio is really heard: on Android 13+ a held session
records the microphone itself and hands the audio to the recogniser through a pipe that keeps it until the
recogniser has loaded, so listening shows, and the first words count, from that moment; elsewhere from the
recogniser's "ready". If the recogniser ends a held session by itself (a silence, its time limit) it starts again
with what was heard kept (at most 4 times), and if the on-device recogniser can't start the same language goes
online when that is allowed. Each start logs its timings (`[voice-timing] press +0 · begin · plan · start · audio ·
ready · words`, never words themselves; `adb logcat -s ReactNativeJS`). A bubble next to the button (above it when the bar is at the bottom, below and to its left when at
the top) shows the listening dot, the TR/EN tag and the live transcript; lifting the finger waits up to a second for the
final words and sends them to the conversation of the tab on screen through the same path as a typed message (a lighter
haptic and a "Sent: …" toast with Open). Sliding the finger away turns the bubble red ("Release to cancel"); an
interruption (app left, a call, a dialog, a system prompt) also sends nothing, as does silence. While a task is running
nothing is recorded: the bubble says Qutai is busy and offers Open. The first hold asks for the microphone (or the
online speech service) instead of listening. With a screen reader, the button has "Start voice message", then "Send"
and "Cancel" actions instead of the hold. Settings › Assistant › "Hold the Qutai button to talk" (on by default) turns
it off (`src/components/AssistantButton.tsx`, `src/components/PushToTalk.tsx`).

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

Editing images (`edit_image`): the assistant makes edited copies of an attached image (or of an earlier edit) on
the phone, with no AI request and nothing sent anywhere: crop (a rectangle in source pixels, or an aspect ratio
placed by gravity or centred on a focus point), rotate by quarter turns and flip, resize (fit within a box, cover a box
exactly by cropping the overflow, stretch to exact dimensions, or one side keeping the ratio; never enlarged unless
asked), JPEG/PNG/WebP at a quality with a background colour under transparency for JPEG, and a largest file size met by
lowering quality and then scaling down. Steps always run in that order; the rounding rules are in
`src/chat/imageEdit.ts` (pure geometry and size-budget search). `src/device/imageEdit.ts` decodes with
expo-image-manipulator (orientation applied, decoded smaller when the result needs less detail, 50 MP at most, a clear
error above it), crops, rotates and flips there, and resamples with Skia on a CPU surface: halving steps (exact 2×2
averages) down to within 2× of the output, then one bicubic draw (Mitchell; Catmull-Rom when enlarging), so a 4000 px
photo made 256 px is not aliased. Skia's encoders write no EXIF or GPS. Results are 16 MP at most. Each result is an
attachment of its own (new id, `derivedFrom` its source, the same folders, pruning, incognito and backup rules) shown in
the chat as a card with a preview, size, format and bytes, Save to Photos and Share; the model gets text only and can
look with `view_attachment`. A conversation keeps its 12 newest edited images; older ones nothing depends on lose their
files and their cards say so. Without the assistant, the full-screen preview of an image has "Resize or crop": shape
(original, square, 4:3, 16:9, following the photo's orientation), longest side (2048, 1024, 512) or an exact size
(cropped to fill), and a largest file size; the copy is attached to the message being written.

Uploading images (`upload_image`): the assistant puts an image of the conversation (attached, or an edit) into a
page's file field. The page script (`src/browser/pageScript.ts`) resolves the target: the file input itself, its label,
the input inside the element, the one its `aria-controls` names, or the only one in its wrapper (a styled button over a
hidden input; `read_page` now lists hidden file inputs as "(hidden)" and labels that open one); failing that it clicks
the element with the file chooser held back and catches the input the click would open (pages that create one on the
fly); failing that it treats the element as a drop zone. The bytes go to the page in 384 KB base64 pieces over the tab's
authenticated command channel, after the user has confirmed, into a closure of the page script under a one-time token;
the page sees nothing until a `File` is built and assigned with a `DataTransfer` (`input.files`, then `input` and
`change` events) or dropped (`dragenter`, `dragover`, `drop` with the same `DataTransfer`). After 0.8 s it reports
whether the field still holds the file, a new preview image, the file name on the page, and the field's and form's
validation errors (the same reporting as `read_page`). It never submits. Checked in headless Chromium 147 and WebKit
26.4 (Playwright) against a fixture: plain input, label over a hidden input, button next to a hidden input, an input
made on click, a drop zone, a zone that ignores drops, `accept` mismatch, a disabled input, a same-origin frame, a
cross-origin frame. Every upload asks "Give this image to <site>?" with the image, its size and bytes, every time,
whatever the site's setting. Refused: ids not in this conversation (screenshots and other tabs have no id), PDFs,
read-only and blocked sites, an incognito image into a normal tab or the reverse, a disabled field, an `accept` that
doesn't take the format (the error names the accepted types and the edit_image format to use). Not https, a frame
from another site, or an uploader that ignores the file: the user may save the prepared image to Photos under its name
and pick it with the site's button. Attached images are re-encoded for the upload (no EXIF); edits are clean already.
On Android in the background, the confirmation pauses the task with a notification like other confirmations.

Sending files to other apps (`src/chat/shareable.ts`, `src/device/outgoing.ts`, `src/agent/shareTools.ts`): one
place decides what may leave a conversation: images and PDFs the user attached, `edit_image` results, PDFs Qutai made
(`save_pdf` and an answer saved as a PDF now stay with the conversation as attachments with ids and cards, Save on
Android and Share) and `save_file` files (`file-…` ids). Screenshots, downloads and anything else on the phone have no
id, so page content can't make the assistant hand them out. Each hand-out is a fresh folder of copies under readable
names in the cache; images the user attached go out re-encoded without EXIF (the original only when the user asks),
at most 10 files and 20 MB. Copies stay 30 minutes for the receiving app, all go at the next start, incognito ones when
the incognito session ends. The routes, the user always sending:
- `draft_email` with `attachments`: the system composer with the files (iOS reads them in at once; Android's
  mail-composer module turns them into content URIs). Without a mail account it never falls back to `mailto:` with
  files: the share sheet opens with the files, subject and body, and the result tells the model so. A card lists the
  files that went.
- `share` (app `whatsapp` or `any`): a card with thumbnails or file names, the text and a "Share to WhatsApp" /
  "Share…" button. The tap prepares the files and calls `QutaiEntry.shareFiles`: on Android `ACTION_SEND` /
  `ACTION_SEND_MULTIPLE` with content URIs from the module's own FileProvider (`${applicationId}.qutai.share`, only
  the hand-out folders), `EXTRA_TEXT` (WhatsApp's caption), sent to `com.whatsapp`, then `com.whatsapp.w4b`, else the
  chooser; on iOS the share sheet with the text (and subject) and every file. Where text may not travel with files
  (iOS, and Android to an app the user picks) the tap also copies it and the card says so. No chat can be preselected
  with files: there is no documented way, so the card shows the number the user gave and says they pick the chat.
  `draft_whatsapp` stays text-only (click-to-chat with the number).
- `upload_file`: a PDF or composed file into a page's file field (webmail attach controls), same page-side transfer as
  `upload_image`, confirmed every time with the file name and the site; on failure the result points at the file's card.

From the page menu (⋮) and by asking the agent: save the page as PDF (from its HTML, or from screenshots for pages
that come out wrong), save a screenshot of the visible area or the whole page (scrolled and stitched) to Photos,
read the page aloud, share/copy the link. When needed, the agent can also look at a screenshot of the page.

Reader mode (page menu, or the page icon in the address bar on article pages) shows just the article: title, byline,
text, headings, images and links, in light, dark or sepia, serif or sans, with an easier-reading spacing option and the
same text size as pages. Read aloud in reader mode reads exactly that article, highlighting the paragraph being read.
The page stays loaded underneath, so closing reader mode (or Android back) returns to it as it was.

Downloads are Qutai's own on both platforms, with one Downloads screen (menu › Library › Downloads): in progress and
finished sections, search, an icon by type, the site, size, progress with speed and time left, and per item Pause /
Resume / Cancel / Retry, Open, Share, Show in Downloads folder (Android), Copy link, Remove from list and Delete file
(confirmed); "Clear finished" only empties the list. A small pill over the page shows running downloads (tap:
Downloads) and, for a few seconds, one that just finished, with Open; its close button, a sideways swipe or the
screen reader's "Hide" action hide it without stopping anything (the list keeps the download). "Open" never fails
silently: a file deleted elsewhere, no app for its type, no access any more or a refusal each get a message saying what
to do instead (share it, or open it from the Files app). On Android an APK goes to the system's installer, which asks
"allow from this source" itself the first time (`REQUEST_INSTALL_PACKAGES`, see `docs/permissions.md`). A file
a page starts without a recent tap on the page asks first ("<site> wants to download <file>"), a second one from the
same site also offers to block that site's downloads for the session; apps, installers, scripts and archives get a
warning before they start; `content:` and `file:` addresses are refused. Files a page generates (`blob:` and `data:`
addresses, such as an exported CSV) are read from the page in 512 KB slices and saved the same way.

- **Android** (`modules/qutai-downloads`, `src/storage/androidDownloads.ts`): Qutai fetches the file itself (OkHttp,
  which React Native already ships) with the tab's user agent, referrer and the cookies of the tab's own WebView
  profile (an incognito tab's own), read again for every host a redirect leads to, and writes it to the public
  Downloads folder: a pending `MediaStore.Downloads` row on Android 10+ (published only once every byte arrived and
  the size matched `Content-Length`), a hidden partial file renamed when done on Android 9 and older (storage
  permission asked at the first download). Names come from `Content-Disposition` or the address, made safe, unique
  ("name (1).ext") and fixed from the response's type when the WebView guessed wrong. Three at a time, the rest queue;
  pause and resume with a range request guarded by `If-Range` (without range support or when the file changed it
  starts again and says so); network errors retry with backoff and wait for a network while offline; a free-space
  check before large files. In the background a user-initiated data transfer job (Android 14+) or a `dataSync`
  foreground service (Android 8 to 13, and the fallback) keeps it going, with one notification (progress, speed or
  time left, Pause / Resume, Cancel; tap: Downloads) and one per finished file (tap: open it). After the app is
  killed or the phone restarts, unfinished downloads show as interrupted and resumable. The system `DownloadManager`
  is no longer used.
- **iOS** (`src/storage/iosDownloads.ts`): into Qutai's own Downloads folder; the page fetches the file first (with
  the site's cookies), larger ones download directly with progress. Cancel only (no resume in `expo-file-system`).
- **Incognito** (both): listed only while the incognito session lasts and never written down; when it ends,
  unfinished ones are cancelled and finished ones leave the list. The files stay: the user asked for them.

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
  (Android: static shortcuts, there right after install, in the phone's language; when Qutai's own language differs
  they stay in the phone's, since Android lets an app neither change nor hide them and dynamic copies would show
  twice; the widget follows Qutai's language. iOS Home Screen quick actions. In all ten interface languages).
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

On first launch the setup asks for a provider and API key; later, change them in Settings › Assistant (or the gear in the Qutai panel, opened with the Q logo in the address bar). After setup, a one-time tour dims the browser around the Qutai button and says that a tap opens the assistant and holding it talks (`src/components/AssistantIntro.tsx`; Settings › Assistant › "Show the Qutai button tour" shows it again). Settings › Assistant › "Calendar for the assistant" chooses which calendar the assistant adds events to (and on iOS the Reminders list); see [docs/permissions.md](docs/permissions.md).

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
user's, not logged) and reports one line each, green only for what a request showed (`src/ai/customTest.ts`, error
bodies read by `src/ai/serverError.ts`): server reachable (any HTTP answer); key accepted (`/models` listed models,
the chat request succeeded, or an OpenAI-style refusal of the request itself, which comes after authentication;
otherwise "not checked"); model found (listed by `/models`, or answering; "not listed, but answering" otherwise;
"not checked" when nothing got that far); tool calling (a `ping` tool the model is asked to call: red only when the
server says it can't take tools, amber when a 200 answer has no tool call); streaming; images (a 1×1 PNG; the result
sets "Model accepts images", which the user can change: off, `view_screenshot` returns a tool error telling the model
to use `read_page`). A chat request that fails for another reason gets its own line with the server's short message:
"This address has no /chat/completions here" for a wrong path (404, a 400/405 saying the URI has no route, an HTML
page, or another API's error envelope such as Cloudflare's `{"success":false,"errors":[…]}`), with the URL tried and
the `/v1` hint; rate limited (429); server error (5xx); the server refused the test request (other 4xx); an answer
that isn't a chat reply. In a conversation the same failures show the server's short message (`API error 400: No route
for that URI`, with a pointer to the address for a wrong path) instead of the status alone. Messages shown from a
server are cut to 200 characters with the key, header values, bearer tokens and common key shapes removed.
The assistant needs tool calling, so there is no chat-only mode. The settings say in one sentence that the user's
messages, pages, screenshots and memory go to the server they entered; "What was sent to the AI" shows the endpoint's
host for each request. The key is kept in SecureStore like the others; the base URL is a setting and goes into
backups (the key only with "Include my AI provider keys"). No web search with a custom endpoint, and no output limit
is sent (servers differ in which field they read).

Optional extra headers (`src/ai/customHeaders.ts`, up to 5 name/value rows under the API key) go with every request
to the custom endpoint: chat (streaming or not), "Fetch models" and every step of "Test connection"; no other provider
gets them. Values can be tokens, so they are treated like the keys: one SecureStore entry per row, shown masked, never
in "What was sent to the AI", logs or error messages, and in a backup only with "Include my AI provider keys" (inside
the encrypted file). Names must be HTTP tokens (letters, digits, ``!#$%&'*+-.^_`|~``), unique ignoring case; values
plain ASCII without line breaks. Names the app or the network layer sets are refused (`content-type`, `accept`,
`host`, `content-length`, `cookie`, `user-agent`, `proxy-*`, `sec-*` and similar). `authorization` is refused while
the API key is set (the key is sent as `Authorization: Bearer`); with the key empty it may be set here, for a server
that wants another scheme.

Cloudflare (not yet tried against a real account): the OpenAI-compatible chat address is
`https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1`, with a Cloudflare API token that has the Workers AI
Read permission as the API key. Models are named as Cloudflare documents them for that address: Workers AI models as
`@cf/author/model` (these also need an extra header `cf-aig-gateway-id`, for example `default`), other providers'
models as `author/model` such as `anthropic/…`, billed by Cloudflare (Unified Billing or a key stored in AI Gateway)
([REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/),
[Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/)). Tool calling on that address
is not documented by Cloudflare; "Test connection" shows whether it works. When the address field holds another path
under `https://api.cloudflare.com/client/v4/accounts/<32-hex account id>/` (`/ai/run`, `/ai/run/@cf/<model>`,
`/ai/v1/run`, `/ai`, `/ai/v1/responses`, `/ai/v1/embeddings`, `/ai/v1/messages` and the like; `src/ai/cloudflare.ts`,
matched exactly on host and path after the normaliser), a warning says it isn't the chat address Qutai needs, with
"Use the chat address" (changes it to `…/accounts/<account id>/ai/v1`) and "Keep as is" (until the address changes or
the screen is reopened; not saved). A model named in a `/ai/run/<model>` path is shown in the hint for the user to put
in the model field, never filled in by itself; key and model are left alone, with a hint on what they must be. The
`…/ai/v1` address itself gets one informational line. An existing AI Gateway address
(`https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat`, the provider's key as the API key,
`cf-aig-authorization: Bearer <gateway token>` as an extra header for an authenticated gateway, `provider/model` IDs)
keeps working and triggers no notice; Cloudflare calls `/compat` deprecated for single-model chat
([chat completion](https://developers.cloudflare.com/ai-gateway/usage/chat-completion/)).

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
| Account and sync | None | An optional Qutai account (Sign in with Apple or Google, or email) with encrypted backups kept in it; no live sync |
| Where your data goes | Your device and the AI service you set up; for the features you use, also your search engine (suggestions), Apple's or Google's address and speech services ("Use my location" in setup, voice input off the device) and the filter lists' publishers (list downloads) | Also Qutai's servers, for the pro features you use |

Pro features are shown only when the switch is on (`src/config/features.ts`). So far that is the account:
Settings › Account (sign in, sign out, sign out of all devices, delete the account), when
`EXPO_PUBLIC_QUTAI_API_URL` is also set; credits and sync are not in the code yet. A build without the switch
has no Account section and never contacts Qutai's server. Qutai's server is a separate repository, checked
out as a submodule at `backend/` (its `README.md` has the setup).

### Accounts (pro mode)

| Piece | Where |
|---|---|
| API client (typed requests, the server's error codes mapped to messages, 15 s timeout, nothing logged) | `src/account/api.ts`, `types.ts` (the server's shapes, copied from `backend/packages/shared/src/auth.ts` so the app builds without the submodule) |
| Session: tokens in SecureStore ("this device only"), refresh before expiry with one refresh at a time, signed out when the server refuses the refresh token (reuse detection, revoked, deleted), suspended accounts kept with a notice, a random device id per install | `src/account/session.ts`, `storage.ts` |
| Sign in with Apple (iOS): `expo-apple-authentication`; the nonce's SHA-256 goes to Apple, the raw nonce to the server | `src/account/providers.ts` |
| Sign in with Google, Android: Credential Manager's "Sign in with Google" flow with the nonce, in the local module `modules/qutai-auth` (the legacy Google Sign-In SDK is deprecated, and the free `@react-native-google-signin` module can't pass a nonce on Android) | `modules/qutai-auth`, `src/account/providers.ts` |
| Sign in with Google, iOS: `expo-auth-session` in the system's sign-in browser with the iOS OAuth client, PKCE and the nonce; the code is exchanged for the ID token at Google | `src/account/providers.ts` |
| Native setup only in pro builds: the Sign in with Apple entitlement and the Google iOS URL scheme | `plugins/withProAccounts.js` |
| Sign-in by email: a 6-digit code and a link in one message (`POST /auth/email/start` / `verify`); the pending address in memory and SecureStore (never the code or link), every server reason as a sentence | `src/account/emailSignIn.ts`, `session.ts`, `src/components/EmailSignIn.tsx` |
| The mail's link `qutai://sign-in/email?token=…`, at a cold start and while running; never opened as a page | `src/components/AccountLinks.tsx`, `src/device/entryPoints.ts` |
| Settings › Account (the account's sign-in methods from `GET /me`) | `src/components/AccountScreen.tsx`, `accountLabels.ts` |
| Add, re-check and remove sign-in methods; combine two accounts (below) | `src/components/AccountMethods.tsx`, `src/account/methodRules.ts`, `session.ts` |
| Sign in with Apple on Android: Apple's web flow in a Custom Tab, run by the server, offered only when `GET /config` says `auth.appleWeb` | `src/account/appleWeb.ts`, `providers.ts`, `src/components/SignInOptions.tsx`; owner's setup `docs/apple-sign-in.md` |
| The mail's https link as an App Link / Universal Link, only with `EXPO_PUBLIC_APP_LINK_HOST` | `plugins/withProAccounts.js`, `src/account/emailSignIn.ts`; `docs/app-links.md` |
| Backups in the Qutai account: the export's encrypted file uploaded, listed, restored through the import screen, deleted; the daily automatic run; the kept password (`docs/server-backup.md`) | `src/backup/server/` (`logic.ts` pure rules, `client.ts` HTTP, `index.ts` storage and runs, `useServerBackupLifecycle.ts`), `src/components/ServerBackupSection.tsx`, `ServerRestoreOffer.tsx` |

**Making a pro build.** Set the variables in `.env` (local builds) or in an EAS build profile's `env`
(`eas.json` keeps all three profiles `off`; add your own profile or override with EAS environment variables):

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_PRO_MODE` | `on` |
| `EXPO_PUBLIC_QUTAI_API_URL` | The server: Android emulator `http://10.0.2.2:8790`, iOS simulator `http://localhost:8790`, a phone on the same Wi-Fi `http://<the computer's LAN address>:8790`, or the deployed API's https address |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth **Web** client id (Android sends it to Credential Manager; it is the ID token's audience) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth **iOS** client id |
| `EXPO_PUBLIC_APP_LINK_HOST`, `EXPO_PUBLIC_APP_LINK_PATH` | Optional: the sign-in link's host and path as an App Link / Universal Link (`docs/app-links.md`); empty, nothing changes |

Then regenerate the native projects, because the entitlement and URL scheme are written there:
`npx expo prebuild --clean` (or `npx expo run:android|ios`, which does it), and restart Metro with
`npx expo start -c`. Plain http to the local server works on Android (Qutai allows cleartext for browsing) and
on iOS to local-network addresses (App Transport Security's local-networking exception).

To run the server locally: `cd backend && npm install && npm run migrate:local`, create
`backend/apps/api/.dev.vars` from its example with at least `ACCESS_TOKEN_SIGNING_KEY` and `REFRESH_TOKEN_PEPPER`
(`node scripts/generate-secret.mjs access-token-key` / `pepper`), then `npm run dev`. Real sign-in also needs the
Apple and Google client ids in the server's `APPLE_CLIENT_IDS` / `GOOGLE_CLIENT_IDS` (see `backend/README.md` ›
Auth); without them the sign-in routes answer "unavailable", which the app shows as such.

#### Sign-in by email

The third button, "Continue with email" (Settings › Account and setup's sign-in step), works in every pro build: no
client id or native code is involved. The user types an address; the server (`backend/README.md` › Auth ›
Sign-in by email) mails one message with a 6-digit code and a link, in the app's language (all ten). Either one finishes the sign-in, **only on the phone that asked**:

- **Code:** typed or pasted (only the digits count), sent by itself at the last digit. iOS offers a code from Mail
  above the keyboard (`textContentType="oneTimeCode"`); Android gets the one-time-code autofill hint, which
  autofill services use for SMS codes and may not fill from mail.
- **Link:** the mail links to the website, `https://qutai.sonsuzdongu.com/intent/sign-in/email?token=…` (the
  server's `MAIL_INTENT_DOMAIN`), because mail apps such as Gmail don't make a `qutai://` link tappable. That page
  (`webpage/worker/intent.ts`) opens the app with `qutai://sign-in/email?token=…` (on Android an `intent://` URL
  naming the package), trying once by itself and always offering an "Open Qutai" button; it signs nothing in itself.
  When Qutai is the browser that gets the https link (the default browser on Android, or the page opened in a tab),
  the app takes the token from it directly and never loads the page. The app sends the token with the address it
  is waiting for. The app keeps that address (not the code) in memory and SecureStore, so the link and the code screen still
  work after the system closed the app while the user read the mail; it is forgotten on success, "Use another
  address", "Other ways to sign in", a sign-in by Apple or Google, and when the code has expired (10 minutes).
  The link is handled before the browser sees it: it never becomes a tab, a history entry, a search or text for
  the assistant, and nothing logs it. A link opened on a phone with no sign-in waiting says to enter the code on the
  phone that asked or ask for a new code here. The code always works too.
- "Send again" is offered after the server's `resendAfter` (30 s), with a countdown; only the newest code works.
  Refusals (wrong code, expired, too many tries, the rate limits with their wait, the address belonging to two
  accounts, no mail sender on the server) show a plain sentence with the server's code under "Details".
- After a sign-in that joined an existing account (`emailLink: "linked"`, also after Apple or Google), the app says
  once which ways to sign in the account now has. `untrusted` and `conflict` sign in quietly; Settings › Account
  lists the real methods (`GET /me` `methods`, the address for email).
- The app sends its interface language as `locale` on the email routes and on the Apple and Google sign-ins (the
  server writes the sign-in mail and the "sign-in method added" notice in it).

Trying it locally: run the server with `EMAIL_SENDER=log` (it prints each message, code and link, to its terminal
instead of sending it; `backend/README.md` › Trying it locally) and point a pro build at it. To open a link by hand:

```bash
adb shell am start -a android.intent.action.VIEW -d 'qutai://sign-in/email?token=<token from the server output>'
adb shell am start -a android.intent.action.VIEW -d 'https://qutai.sonsuzdongu.com/intent/sign-in/email?token=<token>' com.sonsuzdongu.qutai
xcrun simctl openurl booted 'qutai://sign-in/email?token=<token from the server output>'
```

A development build started with a link at a cold start shows the development launcher first; opening the app
from it passes the link on.

#### Sign-in methods and combining accounts

Settings › Account, signed in (`src/components/AccountMethods.tsx`; the server's rules: `backend/README.md` › Auth ›
Sign-in methods and › Merging accounts):

- **Ways to sign in** lists each method with a remove control (×) when the account has more than one. Removing asks
  for confirmation (the sentence says devices that are signed in stay signed in, and to use "Sign out of all devices"
  if someone else used the method). The server wants a recent sign-in on this phone with the method itself or one added
  before it: when it answers `reauth_required` the app offers exactly those methods that this phone can use, proves one
  (`purpose: "reauth"`) and removes. Removing Apple on an iPhone first asks Apple again (its fresh code lets the server
  revoke Apple's authorization).
- **Add a sign-in method**: Google (when the build has its client id), Apple (iPhone; Android when the server offers
  the web flow) and email. Email asks for the address, mails a **confirm** code (a different mail from the sign-in
  one) and asks for it; tapping the mail's link on this phone while the code dialog is open finishes it too (the
  pending address is kept in memory only). The account's addresses get a "method added" mail.
- If the method already belongs to **another Qutai account**, nothing changes; the app offers to combine that account
  into this one.
- **Combine with another account**: the user signs in to the other account (any of its methods) on this phone; the app
  shows both accounts' methods and balances, says it can't be undone, and combines on an explicit "Combine". The other
  account's methods, credits, purchases and usage move here and its sessions end. A notice appears above the section
  when the server kept a same-address account apart (`mergeSuggested`).
- **Sign in with Apple on Android** (`docs/apple-sign-in.md`): a "Sign in with Apple" button in the sign-in options
  when the server is set up for it. It opens Apple's page in a Custom Tab; Apple returns to the server, which sends the
  browser back to `qutai://auth/apple/done` with a flow id and a one-time value; the app finishes with a verifier
  that never left the phone. No native module or rebuild is needed for it (the `qutai` scheme exists).

**Not built yet** (each needs work outside the app): adding or removing a sign-in method while signed in (server
routes to link a method to the signed-in account and to remove one, plus a screen); merging two existing accounts
(a server merge of ledgers, purchases and identities, with proof of both; the server records the conflicts for it);
verified App Links / Universal Links, so the https link opens the app without the page in between
(`assetlinks.json` and `apple-app-site-association` on the site, and the app's `autoVerify` intent filter and
associated domain, which is a native change); the message in the other eight languages
(`backend/apps/api/src/auth/email/message.ts`).

#### Test sign-in (a local test server, before real sign-in exists)

For trying pro mode on a phone before the Apple and Google client ids exist: the server's test sign-in
(`POST /auth/dev`, `backend/README.md` › Test sign-in) signs in as one of three fixed test users, and everything
after that (account details, sign out, sign out of all devices, delete account) is the real code. The Account
screen then shows the account as a test account. It is off unless both sides switch it on: the server in its
uncommitted `.dev.vars` (never in production), the app with two build-time variables. With
`EXPO_PUBLIC_DEV_LOGIN` off (the default, and every `eas.json` profile) the control isn't shown and the secret isn't
read into the bundle.

**Warning:** `EXPO_PUBLIC_` values are readable inside the app, the test secret included. A build made this way is
for your own local test server only: don't share, upload or ship it; make a new server secret if one leaves your
hands.

The server runs on your computer on port 8000 and a tunnel gives it a public `https` address (written
`https://api.example.test` here; use your own). Nothing in the app or the API refuses a non-local `https` address
behind a tunnel or reverse proxy: the API has no host, origin or CORS check, and `https` needs no cleartext
exception (plain `http` is only allowed to local addresses on iOS).

1. Server (from `backend/`; details and what protects it in `backend/README.md` › Test sign-in):

   ```bash
   npm install && npm run migrate:local
   node scripts/generate-secret.mjs dev-sign-in        # the shared test secret, used on both sides
   # apps/api/.dev.vars: ACCESS_TOKEN_SIGNING_KEY, REFRESH_TOKEN_PEPPER, DEV_SIGN_IN=true, DEV_SIGN_IN_SECRET=<secret>
   API_PORT=8000 npm run dev -w @qutai/api
   ```

2. App: in `.env` (git-ignored), or exported in the shell for one build:

   ```bash
   EXPO_PUBLIC_PRO_MODE=on
   EXPO_PUBLIC_QUTAI_API_URL=https://api.example.test
   EXPO_PUBLIC_DEV_LOGIN=on
   EXPO_PUBLIC_DEV_LOGIN_SECRET=<the same secret>
   ```

   Then build as for any pro build (above): `npx expo run:android` / `npx expo run:ios` for a development build,
   or a local release build. Metro inlines the values when it bundles: restart it with `npx expo start -c` after
   changing them. Check the address first: `curl https://api.example.test/health` answers
   `{"ok":true,"environment":"dev"}`.
3. On the phone: Settings › Account › Test sign-in › `test-1`, `test-2` or `test-3`. "The test sign-in isn't
   switched on at this server, or this build's test secret doesn't match" means the server answered 404: check
   `DEV_SIGN_IN=true`, that both secrets match, and restart the server after editing `.dev.vars`.

Through a tunnel every caller may share one address, so the server's per-address limit on its auth routes (about
20 calls a minute) and the test sign-in's own limit (10 a minute) are shared: "Too many attempts" clears after a
minute.

Tests: `npm run test:account` (the client, the session and sign-in by email against a fake server) and, with the local server running,
`npm run test:account:server` (refresh and rotation, reuse detection, `GET /me`, sign-out, sign-out everywhere,
`DELETE /account`, suspended accounts; with `QUTAI_TEST_DEV_LOGIN_SECRET` set and the server's test sign-in on, also
the test sign-in and everything after it; with `QUTAI_TEST_EMAIL_LOG` pointing at the output of a server running with
`EMAIL_SENDER=log`, a sign-in by email: wrong code, code, resend wait, replaced code, link on another device, link).
Both use Node's built-in test runner; see
`scripts/account-tests/README.md`.

**What the owner sets up for real sign-in** (none of it is in the repository):
- Apple Developer: the App ID `com.sonsuzdongu.qutai` with the *Sign in with Apple* capability (the provisioning
  profile must include it; EAS regenerates profiles when capabilities change), plus the server-side key described
  in `backend/README.md` › Auth.
- Google Cloud console (the app's project): the OAuth consent screen; a **Web** client (→
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and the server's `GOOGLE_CLIENT_IDS`); an **Android** client per signing
  certificate with package `com.sonsuzdongu.qutai` and that certificate's SHA-1 (the debug keystore for development
  builds, the EAS or upload key, and Play App Signing's key for store installs: `npx eas-cli credentials` or Play
  Console › App integrity show them); an **iOS** client with bundle id `com.sonsuzdongu.qutai` (→
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and also `GOOGLE_CLIENT_IDS`).

### Qutai Credits (pro mode)

With pro mode and a server address, Settings › Assistant offers a sixth provider, **Qutai Credits**: no API key; the
assistant's requests go through Qutai's relay (`POST /relay`, `backend/README.md` › Relay) and are paid with the
signed-in account's credits. Without pro mode nothing of it exists: the provider isn't listed and the app never
contacts the server for it.

| Piece | Where |
|---|---|
| Client: `GET /config`, `GET /credits`, `POST /relay` (streamed and not), the server's `qutai.settlement` / `qutai.error` events kept apart from the provider's, refusals mapped to messages, short waits (`task_active`, `rate_limited`, a busy provider) waited out, one token renewal on 401 | `src/credits/client.ts`, `errors.ts`, `types.ts` (the server's shapes, copied like the account's) |
| The provider: the same adapters as own-key mode build the request and read the answer; only the wire differs (`src/ai/wire.ts`): the relay wire sends the conversation from the adapter's body, never its headers, so no own key reaches Qutai's server | `src/credits/provider.ts` |
| The agent profile (system prompt parts and tools, as the server builds them) and its SHA-256 | `src/credits/profile.ts`, `agent-profile/profile.json`, `src/credits/agentProfileId.ts` |
| Configuration cache (a minute; an hour-old copy when the server can't be reached), balance, ledger entries | `src/credits/store.ts`, `index.ts` |
| Disclosure before first use (an explicit choice, remembered per phone), settings, balance and history | `src/components/CreditsDisclosure.ts`, `CreditsFields.tsx`, `CreditsScreen.tsx` |
| Setup's AI step in pro mode (Qutai first, sign-in, account and balance), as a tested state machine | `src/components/QutaiSetup.tsx`, `src/credits/setupFlow.ts` |
| Only while signed in: the rules, the prompt to sign in or choose another provider | `src/credits/gate.ts`, `App.tsx` (send, account changes), `AiProviderFields.tsx` |
| The pro-mode privacy policy and terms (own legal version; the open-source build keeps its own), and setup's legal summary | `src/legal/proDocuments.ts`, `documents.ts` |
| Buying credits: the screen, the flow (store, `POST /purchases/verify`, retries, purchases kept until credited), the store interface | `src/components/BuyCredits.tsx`, `src/purchases/` |
| Tiers: names and lines, mapping a stored choice to a tier, the format / model / route of the next request, paused answers continued | `src/credits/tiers.ts`, `pause.ts`, `provider.ts`, `src/agent/runAgent.ts` |

What the user sees: picking Qutai Credits first shows what changes about where data goes (conversation, page
content, attachments, memory and custom instructions pass through Qutai's server, which doesn't store or log them)
with "Use Qutai Credits" / "Not now". The provider's page shows the balance, the server's **tiers** (below), and
"Buy credits" (below). Under each
answer: what the server charged ("0.42 credits · 1.5k tokens"), never a dollar figure; the same per request in
"What was sent to the AI", whose hint then says requests pass through Qutai's server. The balance is under the
panel's title while Qutai Credits is in use, and in Settings › Account › Qutai Credits with the ledger's latest
entries. Each refusal (signed out, not enough credits, a task running elsewhere, rate limited, model no longer
offered, too large, step limit, suspended, maintenance, unavailable, update needed, server unreachable) has its own
message; when the first request of a message is refused before anything reached the AI, the message goes back into
the input.

**Tiers** (owner decision, 16 Nov 2026; `backend/README.md` › Relay › Tiers). In credit mode the customer picks a
tier, never a provider model: **Qutai Fast** ("Qutai Hızlı": everyday questions, fewest credits), **Qutai** (most
tasks, the server's default) and **Qutai Pro** (hard, many-step work, more credits), listed from `GET /config` ›
`tiers` in the server's order with one line each and "about N credits per step" from `approxCreditsPerStep` (one
reference step on the tier's current model, so a hint; the hint under the list says a task takes one or more steps
and the real charge is under each answer). This is the list in Settings › Assistant, setup's AI step and the
per-conversation menu under the panel title; the header shows the tier's name. "Which AI models these use" (in
Settings and the menu, not in the list itself) shows the model serving each tier now (`servedBy`), its step limit,
and that Qutai may change it. A tier id the app has no text for is shown as "Qutai <Id>". Own-key providers keep
their model lists exactly as before.

- **Stored choices:** the tier id is stored where the Qutai model was (Settings' model for `qutai`, a conversation's
  own choice). A provider model saved before tiers reads as the tier that model serves now, else by what it was in
  the own-key lists (fastest → `fast`, recommended → `standard`, strongest → `pro`), else the default tier, and is
  rewritten as that tier when the next message is sent; the conversation and its history stay. A tier the server no
  longer lists uses the default without overwriting the choice.
- **Requests:** `{ tier, provider: <format>, route? }`, no `model`. A new conversation (or one switched to another
  tier) is built in the tier's `format` without a route. The answer's `X-Qutai-Provider` / `-Model` / `-Tier` /
  `-Route` are read before any event reaches the adapter (an answer in another format than the request's is never
  parsed: `bad_response`, its charge kept) and kept on the assistant turn, so the next request of the conversation
  on the same tier goes in that provider's format with that route, and the turn's raw output is tied to the model
  that really made it (it is replayed only to that model, the rule own-key mode uses). Kept with the history, so
  never on disk for incognito conversations; backups leave raw output and routes out.
- **`409 tier_moved`:** rebuilt for `error.tier.provider` with that provider's adapter (the neutral history, no other
  provider's raw output), sent once more without a route, with a note under the answer that the conversation goes
  on with another AI; a second move in a row is an error ("send it again"). **`tier_unknown`**: `/config` is read
  again (past the platform's HTTP cache, which otherwise keeps it the minute the server allows) and the message asks to pick a Qutai model again; **`tier_unavailable`**: "temporarily unavailable, try
  again or pick another"; both put the message back into the input (nothing was sent).
- The tier's own `limits` (steps, images, memory, custom instructions) replace the top-level ones.
- Costs and logs: the answer's cost and "What was sent to the AI" name the tier; their details add "Answered by
  <model>".
- **An older server** (no `tiers` in `/config`): the direct form with the model list and its prices, as before.

**Rules from the server that change behaviour in credit mode:** the step limit is the server's
(`limits.maxSteps` / `maxResearchSteps`; it adds the last-step note itself); the memory section is shortened to
`limits.maxMemoryChars` (older memories left out first, as when they don't fit the usual budget) and attached images
to `limits.maxImages` minus one screenshot; web search only for models (tiers) the server allows it for. An
Anthropic web search the provider pauses (`pause_turn`) is continued at once as the next step: the relay signs a
continuation (`qutai.paused`, or the `X-Qutai-Continuation` headers), and the app sends the same request with step + 1,
the same options and route, the continuation, and the paused turn appended exactly as received as its own assistant
message (never joined to the one before: the relay compares the last message with the paused turn). It may pause
again; each part is charged and counted once in the answer's total, and stopping during it is an ordinary stop. When
there is no continuation (a turn the server can't sign), it expired (15 minutes, e.g. while the task waited in the
background), the next step would pass the step limit, or the relay answers `continuation_invalid`, the task ends with
the note to send "continue".

#### Setup in pro mode

Setup's AI step leads with **Qutai Credits** (what it is, that it needs an account and uses credits, and that page
content passes through Qutai's server, in the disclosure's words); **"Use my own AI provider key"** is a separate,
quieter card that opens the same key fields as before (without the Qutai tab), and **"Decide later"** skips. "Continue
with Qutai" goes: the disclosure (unless accepted before on this phone) → sign in (Apple where the phone offers it,
Google when the build has its client id, the test sign-in in test builds; with none of Apple and Google the screen
says so) → "You're signed in" with the account, the balance and **Buy credits** → the rest of setup. Declining,
cancelling ("Choose another way", the back arrow) or a failed sign-in go back to the choice with a note saying why;
Qutai Credits is chosen only on the account screen, and setup never saves it without an account
(`providerToSave`). Builds without pro mode show the AI step exactly as before.

#### Only while signed in

Qutai Credits can only be the provider in use while signed in. Signing out, deleting the account, a session the
server ended and a backup restored on a new phone (sessions aren't in backups) all leave the provider set to Qutai
Credits with no account, and then:
- sending a message keeps it in the input with its attachments, adds the error with a "Sign in or choose another AI"
  button, and asks "Sign in / Use my own key / Not now" (Settings › Account or Settings › Assistant);
- losing the account while it is in use (outside Settings) asks the same once;
- Settings › Account says Qutai Credits need the account; Settings › Assistant doesn't let Qutai be picked signed out
  (it offers to sign in first) and shows a Sign in button on the provider's page.

#### Buying credits

**Buy credits** (from setup's account screen, Settings › Account › Qutai Credits and the "not enough credits" error)
shows the balance, what credits are, the packs the server offers for this phone's store (`GET /config` › `packs`)
with their credits and **the store's own price** (never one of ours; a pack the store doesn't sell isn't shown, and
store products without a pack never are), a store note, Terms and Privacy, and "Check for missing credits". States:
loading, no packs, configuration unreachable (with Try again), store prices unavailable, purchases unavailable in this
build, purchase in progress, pending (Ask to Buy, cash payments), cancelled, failed (not allowed, network, product
unavailable, other), paid but not yet credited, held or refused (support), refunded, suspended, signed out, and
credited with the new balance.

The flow (`src/purchases/flow.ts`, tested in Node): the store is told the account id before anything is bought; after
a purchase the store transaction id is kept on the phone **before** it's reported with `POST /purchases/verify`;
`404 purchase_not_found` / `503` / no answer are asked again after `Retry-After` (at most 15 s, three tries), then the
purchase stays saved and is reported again when the screen opens, on "Check for missing credits" and after signing in
(the server's webhook credits it anyway). `held` and `422 purchase_rejected` point to support; refunds say so;
`403 account_suspended` shows that buying isn't possible. Consumables can't be restored at the stores and credits
live in Qutai's ledger, so there's no "Restore purchases" button; "Check for missing credits" is the way to recover a
purchase that didn't arrive.

**Fake purchases (temporary, local servers only).** While Qutai's server runs with `FAKE_PURCHASES=true`
(`backend/README.md` › Fake purchases; a local development server only, the production server refuses it), its
`GET /config` says `purchases: { mode: 'fake' }` and the app uses the **fake store** (`src/purchases/fake.ts`) instead
of the unavailable one: no build flag, no store, nothing charged. The buy screen then shows a test-mode notice
("Test mode: nothing is charged"), every pack of this phone's store without a price, and a "Get (test)" button; the
store note is hidden. Buying makes a transaction id (`fake-` + a random id), keeps it in the same pending-purchase queue
as a real purchase, and reports it to `POST /purchases/fake` with its pack (`src/credits/client.ts`); the answer is
the usual one, so the balance in the header, the account screen and the low-credit note update as after a real
purchase. A lost answer is reported again with the same id and credited once; the server's daily allowance
(`purchase_limit`) and a server no longer in fake mode (`404`) are final, nothing kept. The real stores' report is
unchanged (`{ store, transactionId }` to `/purchases/verify`). Remove all of it before launch: `TODO.md` › Before
launch: remove fake purchases.

**The store today: unavailable.** RevenueCat's `react-native-purchases` isn't a dependency yet: it adds native code
and the billing permission to every build, including builds without pro mode, and no RevenueCat project, keys or store
products exist to try it with. Every build uses the clearly marked unavailable store (`src/purchases/unavailable.ts`):
the screen shows balance and packs and says buying isn't available in this build. The RevenueCat implementation is
written and tested against a fake SDK (`src/purchases/revenuecat.ts`: configured only after sign-in with **Qutai's
account id as the App User ID**, `logIn` on another account, `logOut` on sign-out, packs fetched as non-subscription
products, bought with `purchaseStoreProduct`, every SDK error mapped to an outcome). To switch it on:

1. `npx expo install react-native-purchases` (11.x today; Expo SDK 54 or later, no config plugin needed for SDK 58;
   needs a development build, Expo Go only runs its preview mode). **Builds without pro mode must not contain it at
   all** (owner's decision, 16 Nov 2026): no native code, no billing permission, no JavaScript. So, read from
   `EXPO_PUBLIC_PRO_MODE` at build time: exclude it from autolinking when off (`react-native.config.js`
   `dependencies['react-native-purchases'].platforms` set to `null` for both platforms, or Expo's autolinking
   `exclude`), and in `metro.config.js` resolve `react-native-purchases` to an empty stub when off, so the bundle has
   none of it either. Check both APKs: the open-source one must have no `com.revenuecat` classes and no
   `com.android.vending.BILLING` permission (`aapt dump permissions`, `apkanalyzer dex packages`), and the iOS build
   no RevenueCat pod.
2. In `src/purchases/index.ts` `purchaseStore()`: when `revenueCatKey()` gives a key,
   `createRevenueCatStore(Purchases, key)` (import `Purchases` from `react-native-purchases`).
3. Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (RevenueCat's public SDK keys, per build;
   `.env.example`), make a development build, buy a pack in the sandbox (TestFlight / a Play internal test track
   with a licence tester) and check the transaction id the app reports (below).
4. Owner setup (also `backend/README.md` › Purchases): the RevenueCat project with restore behaviour "Keep with
   original App User ID"; **consumable** products in App Store Connect and Play Console, added in RevenueCat (not
   attached to an entitlement, no In-App Currency) and as packs in the admin panel **before** they go on sale; App
   Store Server Notifications V2 and Play real-time developer notifications to RevenueCat; the webhook to the API.
   Store rules this follows: purchases of digital credits only through the store's in-app purchase (no link or
   button to pay elsewhere), prices only as the store gives them, consumables need no restore, the purchase terms
   reachable from the screen. Declare the in-app products in the store listings, and update the privacy texts and
   Google Play's Data safety form for purchase history (RevenueCat as a processor).

**The transaction id on Android:** an old forum answer said the hybrid SDKs give RevenueCat's own id, but the
current mapping in RevenueCat's `purchases-hybrid-common` (`StoreTransactionMapper.kt`) sets `transactionIdentifier`
to the purchase's Google Play **order id** (`GPA.…`), the id RevenueCat's v2 purchase search
(`GET /v2/projects/{id}/purchases?store_purchase_identifier=`) takes; `purchaseToken` comes separately. So the app
reports `transaction.transactionIdentifier` as it does now and the server needs no change. If a purchase has no
order id (the mapping then gives null), the app says the credits will come shortly and the server's webhook credits
it. Still confirm with the first sandbox purchase on Play (README › Qutai Credits, TODO).

#### Agent profile

The relay builds the system prompt and tool list from a registered **agent profile**, so the app's prompt and tools
must be exported whenever they change:

```bash
npm run profile:export   # writes agent-profile/profile.json and src/credits/agentProfileId.ts, prints the id
npm run profile:check    # fails when the prompt or tools changed without a new export (also run by npm run test:credits)
```

Commit both files. Register the profile on every server the release talks to **before** the release ships (an
unknown profile answers "update Qutai"); keep the profiles of every app version still allowed by `min_app_version`:

```bash
cd backend
node scripts/agent-profile-sql.mjs ../agent-profile/profile.json <app version> > /tmp/profile.sql   # prints the id
npx wrangler d1 execute DB -c apps/api/wrangler.jsonc --env dev --local --persist-to .wrangler/state/api --file /tmp/profile.sql   # local
npx wrangler d1 execute DB -c apps/api/wrangler.jsonc --env dev --remote --file /tmp/profile.sql   # deployed dev (owner)
npx wrangler d1 execute DB -c apps/api/wrangler.jsonc --env production --remote --file /tmp/profile.sql   # production (owner)
```

#### Trying it end to end (local server, test sign-in, a phone)

Follows the test sign-in steps above (server on port 8000 behind a tunnel, `https://api.example.test` standing for
its address).

1. Server, once (from `backend/`): `npm install && npm run migrate:local && npm run seed:local` (the seed sets
   example `allowed_models`, `relay_rules`, `pricing`, `credit_limits` and the prices), then register the profile
   locally (above). Put **your own** provider keys in `apps/api/.dev.vars` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
   `GEMINI_API_KEY`; never committed); without them every relay request answers "temporarily unavailable".
2. Credits: the admin panel normally keeps its own local state, which the API on port 8000 doesn't see. Run the
   panel on the **API's** state instead, grant, then stop it (two processes can't share the state at once):

   ```bash
   cd backend/apps/admin && npx vite build
   npx wrangler dev -c wrangler.jsonc -c ../api/wrangler.jsonc --env dev --port 8791 --infer-origin-from-routes=false --persist-to ../../.wrangler/state/api
   ```

   With `ADMIN_DEV_BYPASS=true` in `apps/admin/.dev.vars`, open http://localhost:8791 › Users › the test user (it
   exists once the phone has signed in as it) › Grant credits. Then stop it and start the API again:
   `API_PORT=8000 npm run dev -w @qutai/api`. A request reserves its worst case (the model's whole output limit)
   before it runs, so grant comfortably more than one answer costs: with the seed's example pricing one
   GPT-5.6 Terra request held about 57 credits in the local test, a Claude Sonnet 5.5 one about 28, a Gemini 3.8 Flash one about 18.
3. App: the test sign-in build from above (`EXPO_PUBLIC_PRO_MODE=on`, `EXPO_PUBLIC_QUTAI_API_URL`,
   `EXPO_PUBLIC_DEV_LOGIN=on`, `EXPO_PUBLIC_DEV_LOGIN_SECRET`); no native change is needed for credits.
4. Phone: Settings › Account › Test sign-in › `test-1`; Settings › Account › Qutai Credits shows the balance;
   Settings › Assistant › Qutai › "Use Qutai Credits" › a model › Save; ask something in the panel.

Tests: `npm run test:credits` (profile check, client, provider with the real adapters, against a fake server) and,
with a local server, `npm run test:credits:server` (`scripts/credits-tests/README.md`).

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
| `src/ai/` | Provider-independent conversation model and the Anthropic, OpenAI, Gemini adapters; `chatWire.ts` / `chatCompletions.ts` speak the OpenAI Chat Completions format (OpenRouter and the custom endpoint), `openrouterCatalog.ts` / `openrouterModels.ts` the model catalogue, `customEndpoint.ts` / `customTest.ts` / `serverError.ts` / `cloudflare.ts` the custom endpoint's address rules, "Test connection", reading error answers and the Cloudflare address warning (tests: `npm run test:custom`) |
| `src/storage/` | Persistent data: SQLite database and its migrations, session, history, bookmarks, chat, saved tasks, settings (in SecureStore); `installCheck.ts` / `installState.ts` make delete-and-reinstall a clean start on iOS, whose Keychain outlives the app: on the first launch with neither the install marker (`<documents>/.qutai-install`) nor the database, every SecureStore entry is cleared before anything reads it; an installation from before the marker (database present) keeps everything (tests: `npm run test:install`) |
| `src/i18n/` | UI strings in ten languages (one file each, English fallback), plural rules, date and number formats, the language setting |
| `src/device/` | Device features: PDF, screenshots (also full page), read aloud, voice input (`voiceInput.ts`), share/copy, downloads, private mode protection, calendar and reminders, notifications, location, opening system settings, the phone dialer |
| `src/browser/geolocation.ts` | Web pages' `navigator.geolocation`, answered by the app with a per-site location permission (ask / allow / block) |
| `src/content/filterLists.ts`, `src/content/blocking.ts` | Ad and tracker blocking: filter lists reduced to domains (pure parser and matcher), their download, updates and per-platform compilation; `src/content/adBlock.ts` is the built-in script blocker |
| `src/backup/` | The encrypted backup file: what goes in it, the encryption, and merging or replacing on import |
| `src/ai/audit.ts`, `src/storage/sentLog.ts` | "What was sent to the AI": the entry recorded for each request and how long it is kept |
| `src/ai/usage.ts`, `src/ai/prices.ts`, `src/ai/cost.ts` | Approximate cost: each provider's usage, the dated price table, the cost maths (tests: `npm run test:cost`) |
| `src/agent/tools.ts` | Tools exposed to the model: reading (`read_page`, `read_source`, `read_tab`, `view_screenshot`, `view_attachment`, `read_pdf`), images (`edit_image`, `upload_image`), acting (`click`, `click_at`, `type`, `select_option`, `scroll`, `navigate`, tabs), saving (`save_pdf`, `save_screenshot`, `download_file`, `save_file`), memory, `ask_user`, `draft_email`, `search_history`, `bookmarks`, saved tasks (`list_saved_tasks`, `get_saved_task`, read only), `settings` (Qutai's appearance and browsing preferences), and the phone (`add_calendar_event`, `add_reminder`, `schedule_notification`, `read_calendar`, `get_location`, `offer_call`, `draft_sms`, `draft_whatsapp`, `open_settings`) |
| `src/agent/executeTool.ts` | Runs tool calls in the browser, asks for user confirmation if enabled |
| `src/agent/outwardApproval.ts`, `src/agent/approvalTool.ts` | Posting and paying: `request_approval`, the single-use grant, the checks before the approved press, final payment buttons, card numbers (see "Posting and paying" below) |
| `src/agent/runAgent.ts` | Agent loop and trimming of old page outputs |
| `src/agent/systemPrompt.ts` | Behavior and safety rules |
| `src/agent/memory.ts` | The assistant's memory: categories, what is never stored (`sensitiveReason`) and the memory part of the prompt |
| `src/agent/hiddenValues.ts` | Hidden memories: finds their values (and formatted variants) in tool results and replaces them with "[hidden: …]" before anything goes back to the model or a log |
| `src/agent/personalData.ts` | Finds remembered personal details in what the assistant is about to type, so the app asks before they reach a site (per-site "Your personal information": ask / allow / block) |
| `src/utils/foreground.ts` | Pauses the agent when the app goes to the background, resumes it when it comes back to the foreground |
| `src/device/backgroundTask.ts`, `modules/qutai-agent` | "Keep working in the background" (Android): the `specialUse` foreground service and its notifications, the headless JS task that keeps timers running, and page commands sent natively to the tab's WebView while React Native is paused |
| `src/storage/downloads.ts`, `src/browser/downloadRequests.ts`, `modules/qutai-downloads` | Downloads: one model and screen over two back ends (iOS in the app, Android a native engine with MediaStore, pause/resume, the background job and notifications); the decisions before a download starts (asking, warnings, blob:/data:) |

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

### Posting and paying

When the user asks the assistant to post, comment, reply, review, send a message or an email on a site, or submit a
public form, it fills it in and then calls `request_approval` (kind `publish`) right before pressing the site's own
button. Qutai's dialog shows the site, the kind of action and what Qutai itself reads on the page: the field's exact
text (the model's copy must match it, or nothing is asked) or the form's filled values. The final step of a payment is
kind `pay`, available only with Settings › Assistant › "Let the assistant complete payments" (off by default; turning
it on asks once more; not changed by the assistant's `settings` tool and not restored from a backup). Its dialog
shows the site, the total as found on the page and the line it is on, the order, the payment method as the page names
it, and any subscription or renewal. Both dialogs are shown every time (never "Don't ask again", whatever the site's
permission) and say that only the dialog can approve; read-only and blocked sites never get there.

Approve grants one press of that button, in that tab, on that page (the address without its fragment), during that
task. Just before the press the app reads the page again: the same page, the field's text unchanged (or the form's
values), the total still on its line, payments still on; otherwise nothing is pressed and the model has to ask again.
The press uses the grant up. The tool result after Approve tells the model that the user approved and that it must now
press the button and report the outcome without asking again in chat; after Cancel, to stop.

Enforced in the app, whatever the model does: a click (or `click_at`) on a button whose whole label is a final payment
step ("Pay", "Pay €24.99", "Place your order", "Siparişi onayla", "注文を確定する"…, ten languages,
`isFinalPaymentLabel`) without a grant is refused, and while payments are off the result tells the model to hand the
order to the user and say which button to press. Typing a payment card number (13–19 digits passing the Luhn check)
is refused. The assistant never types card numbers, security codes, passwords or one-time codes, never changes a
payment method or address on its own, and leaves logins and bank checks (3-D Secure) to the user. A publish button is
not recognised by its label (too many words mean too many things), so pressing one without an approval is refused only
by the prompt; the approval's own checks apply whenever one was given. There is no per-payment limit: totals come in
any currency and Qutai has no exchange rates (see TODO.md › Decisions).

Typing and tapping copy what a phone's browser sends (`src/browser/pageScript.ts`): text goes to the field inside a
custom element or its shadow root, rich editors get `beforeinput` (and a paste when they only take that), input events
are composed and followed by keyup, taps are pointer and touch events before the mouse events and the click (none of
those when the page handled the touch), and a disabled button is reported instead of "Clicked". A control that checks
`event.isTrusted` can't be pressed by any page script. The local test pages are `scripts/page-tests/` (`node
scripts/page-tests/serve.mjs`, then open `http://localhost:8811/`; `?script=head` runs the last commit's page script);
the fake AI server's `post`, `pay` and `sneakpay` scripts drive the dialog on a device against them.

## Permissions

Nothing is asked at launch. The first-run setup has an optional step, "What Qutai may use", with a switch per
permission the assistant can use (location, the microphone for talking to the assistant, calendar, Reminders on iOS,
notifications) and what each is for; a switch asks the system only when the user turns it on and then shows the real
state (with "Open settings" when refused for good). The microphone switch asks exactly what voice input asks on its
first use (the microphone, and on iOS speech recognition too), so the panel's microphone asks nothing more later; the
one-time question about the phone's online speech service is still asked separately, before that service is first
used. On iOS, the microphone allowed without speech recognition shows as limited: only languages the phone recognises
itself work. Whatever is left off is asked the first time a feature needs it: camera (QR codes, photos for
upload fields), add-only Photos (saving screenshots and images), Face ID, write-only calendar and reminders (full calendar access when the assistant first reads it, or from setup or the calendar chooser to choose a calendar), location
while in use (per-site), local notifications, camera and microphone for sites you allow (per site, each asked separately), microphone and (iOS)
speech recognition on the first tap of the panel's microphone button. The full list per platform, with
the feature, when the user is asked, the config line that declares it and what is blocked, is in
[docs/permissions.md](docs/permissions.md); use it for the App Store privacy labels and the Play Data safety form.

## Known limitations / next steps

- **Downloads a WebView can't describe.** Android's download listener gives the address, user agent,
  `Content-Disposition`, type and length, never the request method or body: a file a form `POST` produced is fetched
  again with `GET`, which many servers answer differently (an error page or another file). Servers that don't support
  ranges (or send no `ETag` / `Last-Modified`) can't resume: the download starts again from zero and the list says so.
  A `blob:` address made inside a frame can't be read from the main page. Whether a page download followed a tap is
  judged by a touch on the page in the 10 seconds before. iOS has no pause/resume.

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
- **Full-page captures have limits.** At most the first 25 screens (endless feeds are cut off, with a notice). The
  page is saved as one JPEG, captured narrower (down to 720 px) when a 1080 px wide image would take more than the
  stitching memory budget (192 MB on Android, 256 MB on iOS) or exceed JPEG's 65,535 px limit; only if that is not
  enough, or the bitmap can't be allocated, is it split between screens into several images, with a notice. Pages
  that scroll an inner element instead of the window come out as a single screen.
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
- **Background tasks are Android only, opt-in, and partial.** With "Keep working in the background" on (Android, off by
  default; chosen in the first-run setup or Settings › Assistant), a task the user started goes on when they leave Qutai or lock the screen,
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
- **The assistant runs a saved task by name.** "Run the task called X" makes it read the task's text
  (`get_saved_task`: name without regard to case or Turkish i/İ/ı/I, then without accents, then part of a name; several
  matches are put to the user) and carry it out as if typed. `list_saved_tasks` gives names and a short preview.
  Creating, editing, deleting and scheduling tasks stay with the user. Incognito conversations can use them too, as the
  saved tasks list itself can be used there.
- **A notification the assistant scheduled leads back to where it was asked.** Tapping it (also when Qutai was closed,
  after the app lock) opens the tab the user asked from; if that tab was closed, the first tab of its group; otherwise
  the first tab, with a short toast saying the page couldn't be found. The notification carries only internal ids (the
  tab's random uid and its group's id), never a URL or title; for an incognito tab only a random key, matched in memory
  while that incognito session lasts, so an incognito tab is never reopened. Notifications scheduled before this just
  open Qutai.
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
- **Ad and tracker blocking is domain-based.** Filter lists the user picks (EasyList, EasyPrivacy, regional lists — AdGuard Turkish, on in Turkish; AdGuard
  German, Spanish/Portuguese, French, Japanese and Russian and ABPindo, off until switched on —
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
  controls WebKit provides. WebKit pauses `<video>` elements when the app leaves the foreground (unless they are in
  picture-in-picture); the page script plays such a video again, so its sound goes on without the picture, and
  while sound plays it keeps the page from seeing that the app left (`document.hidden` stays false, the
  visibilitychange events are stopped), so sites that pause their own player when hidden (YouTube's mobile site)
  go on too. Incognito tabs don't do this. Note: background play is a paid feature on YouTube; whether this is
  acceptable for YouTube's terms and App Review is an open question. Android: a `mediaPlayback` foreground service with a media notification runs
  while a tab plays sound (local module `modules/qutai-media`), and that tab's WebView keeps being told its window is
  visible while the app is in the background (Chromium would otherwise pause its `<video>`, sound included, and pages
  that pause themselves on visibilitychange would stop); other tabs, and this one once playback has ended, see the
  real state. Media inside frames isn't seen, and whether headphone buttons reach it is untested. Phone makers'
  battery managers (Honor, Huawei, Xiaomi, Samsung) may still stop it; Settings › Appearance › Media says so and
  opens Qutai's app settings, Qutai never asks for a battery exemption itself. Picture-in-picture on Android works
  for a playing full-screen video and for a video playing inline with sound: the inline video is made full screen
  as PiP starts (one tap sent to the page natively gives the Fullscreen API its user activation), and that full
  screen is left again when the window is expanded or closed. A page that leaves full screen or pauses itself in PiP
  ends PiP and its sound goes on. YouTube's mobile site refuses PiP without Premium (it leaves full screen and pauses
  in a small window), so on YouTube PiP is offered only when its player says the video may play in the background,
  otherwise Home keeps the sound only. Videos inside frames don't go into PiP. Incognito tabs show "Private tab" in the notification and on the lock screen.
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
  for sensitive actions. Posting and paying go through Qutai's own approval dialog, which no page text can answer, and
  a final payment button can't be pressed without it (README › Posting and paying). Publishing buttons are not
  recognised by the app, so their approval rests on the prompt. The "Ask before every action" option in Settings
  provides extra protection.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

Third-party software in the app is listed, with each licence's full text, in Settings › About › Open source licences.
The data is `src/legal/licences.json`, committed and written by a script you run by hand after adding, removing or
upgrading a dependency:

```bash
node scripts/generate-licences.js
```

It bundles the app (`expo export`, Android and iOS) and takes every npm package whose code or assets end up in the
bundle, every autolinked native module, `pdfjs-dist` and the prebuilt Skia binaries, with the licence files from
`node_modules`. What the bundle can't show is in `scripts/licences-manual.js`: the decoders and polyfills inside
PDF.js's build, SQLite, Skia's own third-party code, and the Gradle and CocoaPods libraries of React Native and the
Expo modules; their upstream licence files are copied verbatim into `scripts/licences/`. Identical texts are stored
once. The script warns about a package without a licence file, a copyleft licence or one it doesn't recognise.

The license covers the code, not the Qutai name, logo or icons. See [TRADEMARKS.md](TRADEMARKS.md) before publishing a fork.
