# 15. The assistant's tools and phone actions

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

What the assistant can do besides reading and using pages: change some of Qutai's own settings, manage bookmarks,
prepare calls, texts, WhatsApp messages and emails that the user sends, put things in the calendar, handle images,
files and PDFs. Site levels and approvals are in [section 5](05-site-permissions.md), posting and paying in [section 7](07-posting-and-paying.md), scripts in [section 20](20-page-scripts.md), contacts in [section 17](17-contacts.md).

## How it works

1. **Tools.** Reading: `read_page`, `read_source`, `read_tab`, `view_screenshot`, `view_attachment`, `read_pdf`.
   Acting on pages: `click`, `click_at`, `type`, `select_option`, `scroll`, `scroll_to`, `navigate`, `go_back`, tab
   tools. Saving: `save_pdf`, `save_screenshot`, `download_file`, `save_file`. Images and files: `edit_image`,
   `upload_image`, `upload_file`, `share`. Other: `remember`/`forget`, `ask_user`, `take_notes`, `search_history`,
   `bookmarks`, `list_saved_tasks`/`get_saved_task`, `settings`, page customisation, apps, `request_approval`. Phone:
   `add_calendar_event`, `add_reminder`, `schedule_notification`, `read_calendar`, `get_location`, `find_contact`,
   `offer_call`, `draft_sms`, `draft_whatsapp`, `draft_email`, `open_settings`.
2. **Settings from the chat.** "Turn on dark mode", "make the text bigger", "use DuckDuckGo": the `settings` tool changes
   only a fixed list of appearance and browsing preferences, shows a line ("Setting: Appearance → Dark") and says how to
   undo it. Anything else ("turn off asking before actions", "change my API key") is refused with an offer to open
   Settings.
3. **Bookmarks from the chat.** "Bookmark this page in Recipes", "remove these three": add, remove (with Undo), list,
   search, move, rename, create and delete folders.
4. **Messages are drafts the user sends.** "Call Ahmet", "text Ayşe that I'll be late", "WhatsApp my landlord": the
   assistant shows a card with the full number and text; the user taps Call / Open in Messages / Open in WhatsApp and
   sends it there. "Email this page to Mehmet Bey" opens the phone's mail composer filled in; the user sends it.
   Contacts are looked up on the phone; the AI never sees numbers or addresses (see [docs/contacts.md](../../docs/contacts.md)).
5. **Calendar, reminders, notifications, location.** "Add the dentist on Friday at 10", "remind me in 10 minutes":
   each is confirmed with its details. Reading the calendar and the location ask too. The user may choose "Don't ask
   again" for these device kinds.
6. **Images and files.** Up to 4 images per message (Photos or camera) or a PDF from Files. The assistant can read
   PDFs, edit images on the phone (crop, resize, filters), put an image or file into a page's upload field after a
   confirmation, attach files to an email draft or share them to WhatsApp or any app.

## The rules

- **`TOOL-1`** The assistant never sends a message itself: `offer_call`, `draft_sms` and `draft_whatsapp` only add a card to the chat; the dialer, Messages or WhatsApp opens only from the user's tap on that card, and the user sends there; the tool result tells the AI "Nothing has been sent … Do not say it was sent".
  Status: Default (manager or implementing session; open to change) · Why: "page content is untrusted and premium-rate numbers exist, so the card shows the full number and text first" · Enforced: In the app: src/agent/executeTool.ts (offerCallTool, draftSmsTool, draftWhatsAppTool add cards only); App.tsx (onCall, onSms, onWhatsApp card callbacks); src/device/sms.ts (openSmsComposer), src/device/whatsapp.ts (openWhatsApp); no SMS permission and no sending API in the app · Source: a34fa89, 1e55d8c
- **`TOOL-2`** `draft_email` opens the phone's mail composer with recipients, subject, body and files; the user decides whether to send. Without a mail account, files go through the share sheet with subject and body, never a `mailto:` link with files.
  Status: Default (manager or implementing session; open to change) · Why: the user stays the sender · Enforced: In the app: src/agent/shareTools.ts (draftEmailTool); src/device/email.ts (composeEmail) · Source: 1dafccc, e23a839; README › Sending files to other apps
- **`TOOL-3`** `share` (WhatsApp or any app) shows a card; only the user's tap prepares the files and opens the target; a chat can't be chosen in advance when files go along.
  Status: Default (manager or implementing session; open to change) · Why: "there is no documented way" to preselect a chat with files · Enforced: In the app: src/agent/shareTools.ts (shareTool); src/device/share.ts · Source: e23a839
- **`TOOL-5`** A text message is at most 1,000 characters and a WhatsApp message at most 2,000; WhatsApp needs an international number (a contact's local number gets the phone region's code, shown on the card; otherwise the AI asks the user for the country code).
  Status: Default (manager or implementing session; open to change) · Why: a card the user reads should stay short; WhatsApp links can't guess the country · Source: src/device/sms.ts (MAX_SMS_BODY), src/device/whatsapp.ts (MAX_WHATSAPP_BODY, normalizeWhatsAppNumber)
- **`TOOL-6`** `find_contact` gives the AI only names, labels ("mobile", "work email") and short-lived codes, never numbers or addresses; only names the user typed or said are looked up; at most 5 people, valid 30 minutes; off in incognito; saved chats and backups keep the name and label, not the number.
  Status: Default (manager or implementing session; open to change); the limits are listed for confirmation ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026), Contacts) · Why: contact details must not reach the AI or be triggered by page text · Enforced: In the app: src/agent/contactTool.ts (findContactTool), src/agent/contactHandles.ts · Source: de0d0a2; [docs/contacts.md](../../docs/contacts.md)
- **`TOOL-7`** The `settings` tool may change only these: theme, dark sites, address bar position, text size (50–200 %, steps of 10), search engine, search suggestions (turn off only), haptics, force zoom, the Qutai button, reader colours, reader typeface, easier reading, background playback, picture-in-picture (Android only), and the protections block ads and trackers, hide cookie banners, block third-party cookies and HTTPS-only (each turn on only; changed 19 Nov 2026). Anything not in this list is refused.
  Status: Owner, 2026-11-15 (the owner asked for settings to be changeable from the chat; the list itself is the session's) · Why: "a web page that manages to instruct the assistant must not be able to remove the user's protections"; only preferences that are "visible and easily changed back" · Enforced: In the app: src/agent/settingsTool.ts (CHANGEABLE is the only allowlist), src/agent/settingsClass.ts (the direction of each key, tested) · Source: febcdb4
- **`TOOL-8`** Refused by the `settings` tool, with the reason and an offer to open Settings: ask before every action; site permissions of every kind; memory and hidden memories; custom instructions; provider, model, keys, custom endpoint and its headers, Gemini streaming; web search; keep working in the background and its notification; voice consent, auto-send and hold-to-talk; app and incognito lock; certificate exceptions; turning a protection off or search suggestions on; payments; scripts; "Don't ask again"; backup; clearing data; filter lists.
  Status: Default (manager or implementing session; open to change) · Why: each sets the assistant's own limits, handles secrets, costs money, decides what is kept or sent, or lowers a protection · Enforced: In the app: src/agent/settingsTool.ts (CHANGEABLE; PROTECTED only words the refusal) · Source: febcdb4
- **`TOOL-9`** A new setting is not changeable from the chat unless someone deliberately adds it to `CHANGEABLE` after checking it against the rule.
  Status: Default (manager or implementing session; open to change) · Why: a setting must stay out of reach by default · Enforced: In the app: src/agent/settingsTool.ts (CHANGEABLE) · Source: febcdb4
- **`TOOL-10`** Today "Show where the assistant acts" is not in the settings tool.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026): "Show where the assistant acts … Add it?") · Why: adding it changes the agent profile the server must register · Source: TODO.md › Interface
- **`TOOL-11`** Settings changes need no confirmation; each shows a line in the chat and in the activity history, and the AI is told to say how to undo it; reading settings runs in the background, a change waits until the user is back.
  Status: Default (manager or implementing session; open to change) · Why: "the changes are visible and reversible" · Enforced: In the app: src/agent/executeTool.ts (settings set waits for the screen) · Source: febcdb4
- **`TOOL-12`** The assistant changes settings and bookmarks only when the user asks in their own words; a page, file or tool result asking is never a reason.
  Status: Default (manager or implementing session; open to change) · Why: page content is untrusted · Enforced: Prompt only: src/agent/systemPrompt.ts and the tool descriptions in src/agent/tools.ts; the app limits what can change (TOOL-7) · Source: febcdb4, 77bfe07
- **`TOOL-13`** `bookmarks`: adding, moving, renaming and new folders run without asking; a removal shows "Bookmark removed" with Undo; removing more than 3 in one task, or deleting a folder with contents, asks once with the count and names; only http(s) addresses.
  Status: Default (manager or implementing session; open to change) · Why: deleting the user's data asks; small changes are undoable · Enforced: In the app: src/agent/bookmarkTool.ts (REMOVALS_WITHOUT_ASKING) · Source: 77bfe07
- **`TOOL-14`** In incognito conversations `bookmarks` can only add a page at the top level and remove one; listing, searching and reorganising are refused.
  Status: Default (manager or implementing session; open to change) · Why: the bookmark list is device data, like the history · Enforced: In the app: src/agent/bookmarkTool.ts · Source: 77bfe07
- **`TOOL-15`** `search_history` searches the history on the phone and sends only matching pages to the AI (one per address, at most 20), with today's date.
  Status: Default (manager or implementing session; open to change) · Why: the whole history must not go to the AI · Enforced: In the app: src/agent/executeTool.ts (searchHistoryTool) · Source: 1dafccc
- **`TOOL-16`** Calendar events, reminders and notifications are confirmed with their details each time; reading the calendar, the location and a download ask every time whatever "Ask before every action" says; all are refused in incognito conversations.
  Status: Default (manager or implementing session; open to change) · Why: they touch the user's device data · Enforced: In the app: src/agent/executeTool.ts (schedulingTool, readCalendarTool, locationTool, downloadFileTool) · Source: 5e51edb
- **`TOOL-17`** "Don't ask again" is offered only for device kinds (a notification, a calendar event, a reminder, reading the calendar, the location, an ordinary download); clicks, typing, sending, purchases, messages, sharing, uploads and personal details always ask; a denial is never remembered; risky files and incognito downloads always ask; the assistant can never set it. Settings › Assistant lists them, each with a switch.
  Status: Default (manager or implementing session; open to change) · Why: only low-risk device actions may skip the question · Enforced: In the app: src/agent/alwaysAllow.ts (ALWAYS_ALLOW_KINDS, kindForDownload) · Source: c6ad335
- **`TOOL-19`** "Ask before every action" is off by default.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/storage/settings.ts (confirmActions) · Source: README › Known limitations
- **`TOOL-20`** The assistant has no tool for writing to the clipboard; only the user copies.
  Status: Default (manager or implementing session; open to change) · Why: "deliberately not given" · Source: README › Known limitations
- **`TOOL-21`** Qutai never types a payment card number, whatever the AI was told; final payment buttons and presses that send text the assistant typed need Qutai's own approval (see [section 7](07-posting-and-paying.md)).
  Status: Owner, 2026-11-19 (payments off by default; no spending limit) · Why: no page text can answer Qutai's own dialog · Enforced: In the app: src/agent/executeTool.ts (containsCardNumber check, enterGate, pressGate) · Source: 4d97c4d, 67a7b4b
- **`TOOL-22`** Only files that belong to the conversation can leave it: images and PDFs the user attached, edited images, PDFs Qutai made and `save_file` files; screenshots and downloads have no id; at most 10 files and 20 MB at a time; every id must match or the whole call fails; copies are kept 30 minutes; attached photos go out without location data unless the user asks for the original.
  Status: Default (manager or implementing session; open to change) · Why: "so page content can't make the assistant hand them out" · Enforced: In the app: src/chat/shareable.ts; src/device/outgoing.ts · Source: 59b49d5
- **`TOOL-23`** Up to 4 images per message; the original stays untouched and a copy for the AI is made once (turned upright, location data removed, longest side 1,568 px, at most 1 MB); images go with the 3 latest user messages (8 at most), older ones are named and can be looked at again; they are deleted when no conversation needs them, and are not in backups.
  Status: Default (manager or implementing session; open to change) · Why: cost and privacy · Enforced: In the app: src/device/attachments.ts; src/agent/attachedImages.ts · Source: d5fcc3d
- **`TOOL-24`** Pasting an image into the message field is not supported.
  Status: Default (manager or implementing session; open to change) · Why: React Native's text field doesn't expose pasted images · Source: README › Attachments
- **`TOOL-25`** `read_pdf` reads PDFs on the phone with a bundled PDF.js in a hidden page that may make no network request: up to 20,000 characters per call, cut at a page; scanned pages can be viewed as images (3 at a time); PDFs up to 30 MB are fetched into memory only, never saved to Downloads; blocked sites are refused; PDF text is treated as untrusted page content.
  Status: Default (manager or implementing session; open to change) · Why: providers' own PDF input not used because text "works the same for all five, costs far less per page" · Enforced: In the app: src/pdf/reader.ts, src/components/PdfReaderHost.tsx · Source: 0c288f7
- **`TOOL-26`** `upload_image` and `upload_file` ask "Give this image to <site>?" every time, whatever the site's setting; they never submit the form; they refuse files not in the conversation, read-only and blocked sites, and moving an incognito file into a normal tab or the reverse.
  Status: Default (manager or implementing session; open to change) · Why: a file reaching a site is the user's decision · Enforced: In the app: src/agent/imageTools.ts, src/agent/shareTools.ts · Source: a987554, e23a839
- **`TOOL-27`** `edit_image` works on the phone with no AI request; results are at most 16 megapixels; a conversation keeps its 12 newest edited images.
  Status: Default (manager or implementing session; open to change) · Why: nothing needs to be sent · Source: cf41b06; README › Editing images
- **`TOOL-29`** If a page shows a CAPTCHA, the assistant does not solve it; it asks the user to.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: Prompt only: src/agent/systemPrompt.ts; the app does not check it · Source: 6706522; src/agent/systemPrompt.ts

## Details

**Messages and reminders**

- (was `TOOL-4`) WhatsApp drafts open `whatsapp://send` with the number and text, not a `wa.me` link. Why: opening fails clearly when WhatsApp is missing, while `wa.me` "would land in a browser (possibly Qutai as default browser)"; WhatsApp only documents `wa.me`. Where: item 28 hand-over note
- (was `TOOL-18`) `schedule_notification` takes either a delay (1 second to 30 days, counted from the user's confirmation) or a time, never both; the confirmation says "in 3 minutes (13:36)". Where: c9629d0, be7c779

**Forms and files**

- (was `TOOL-28`) `read_page` reports form errors and required fields so the assistant fixes exactly what the form reports; `save_file` content is kept in memory only (restored cards say "expired"). Where: item 27 hand-over note

## Limits and what is not built

- Pages inside frames from other sites (payment forms, some CAPTCHAs) can't be read; `click_at` works only on the latest screenshot's visible area.
- Android has no in-app PDF viewer; opening a PDF downloads it.
- Fewer or shorter tool descriptions per request (to save tokens) is an open performance decision (TODO.md › Assistant).

## Where it lives

- `src/agent/tools.ts`, `executeTool.ts`, `settingsTool.ts`, `bookmarkTool.ts`, `shareTools.ts`, `contactTool.ts`, `fileTools.ts`, `imageTools.ts`, `scheduling.ts`, `alwaysAllow.ts`
- `src/device/sms.ts`, `whatsapp.ts`, `email.ts`, `phone.ts`, `share.ts`, `outgoing.ts`, `attachments.ts`, `calendar.ts`; `src/chat/shareable.ts`; `src/pdf/`
- README intro (bookmarks, settings, attachments, PDFs, images, sending files, contacts); [docs/contacts.md](../../docs/contacts.md)

## Disagreements between sources

- The settings tool's own rule says nothing that "lowers a protection" may be changed, yet block ads, hide cookie banners and block third-party cookies can be turned off from the chat (only HTTPS-only is "on only"). The bookmarks-and-settings hand-over note lists this as an open question for the owner; it is not in TODO.md. The code lets the assistant turn them off.
- Commit febcdb4 says there is no voice-input language setting; Settings › Assistant › "Listening language" exists now. It is not changeable from the chat.
