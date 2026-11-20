# 27. Interface

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The look-and-feel rules that apply across the app: icons, dialogs, labels, the address bar, the Qutai button, haptics, the launch screen and the new tab page.

## How it works

1. **Icons** come from one set: SF Symbols on iOS, Material Symbols on Android, in the theme's colours. There are no emoji in menus, chips, confirmations, step lines, the tab switcher, downloads, bookmarks, the lock screen or the error page.
2. **Dialogs** (alerts, confirmations, text prompts) are Qutai's own, in the app's light or dark theme: a card with a title, a scrolling message, an optional checkbox and text field, and up to three buttons. The main button is filled (red when it deletes); Cancel sits on the left; buttons stack when there are three, when text is large or when a label would wrap.
3. **Labels** never break inside a word. Screen headers keep their buttons whole and let the title shrink; long option labels shrink a little before they would split a word.
4. **The assistant panel.** An answer bubble always spans 90% of the column (the whole column with a table). Under the title: "Anthropic · Claude Sonnet 5.5"; when that doesn't fit, only "Claude Sonnet 5.5". With Qutai Credits the balance shows in full with the tier name. The cost of an answer sits in the answer's row of icons.
5. **Address bar** at the bottom by default; Settings › Appearance › Address bar: Top / Bottom. Swipe sideways on the bar to switch tabs.
6. **The Qutai button** (the logo in the address bar): tap opens the assistant, hold talks. It can be hidden in Settings; then "Ask Qutai" at the top of the page menu opens the assistant. The logo sparkles once on appearing, every ~10 s, and continuously while a task runs.
7. **Haptics** (Settings › Appearance › "Haptic feedback", on): light ticks on switches, choices and the tab swipe; a clear short vibration for things the user needs to notice without looking (the microphone turning on, a voice message sent, a confirmation waiting, a task done or failed, Stop).
8. **Launch.** A plain screen in the theme's background colour, no logo; on a cold start the Qutai mark fades and grows in over 450 ms, then the app appears.
9. **New tab page.** A search box, "Ask Qutai", most visited sites (last 30 days, a coloured letter instead of the site's icon), bookmarks and recent pages, and My apps. In an incognito tab only an explanation of incognito mode.
10. **Option cards.** When the assistant found several things to choose between, they come as cards with a picture, title, price and the site, in a row to swipe, in the panel and in the answer card over the page (`UI-23`…`UI-26`).
11. **Empty assistant panel** suggests a few tasks that fit the page ("Is this a good buy?" on a product, "Help me fill this in" on a form), chosen on the phone without an AI request.
12. **Tablets.** Sheets stay at most 560 pt wide; full-screen lists centre at 680 pt.

## The rules

- **`UI-1`** Interface icons come only from the app's icon set (SF Symbols / Material Symbols); emoji and Unicode marks are never used as icons, and menu icon names are typed so emoji cannot be put in a menu.
  Status: Default (manager or implementing session; open to change) · Why: a UI review found coloured emoji, monochrome marks and plain-text icons side by side; one uniform, single-colour set · Source: 72b92ae, 2ae02cc, d91ee23 (2026-11-14), d0f62c2 (2026-11-16); ROADMAP.md › Phase 3.5
- **`UI-4`** Every alert and confirmation goes through Qutai's themed dialog, never React Native's `Alert`.
  Status: Default (manager or implementing session; open to change) · Why: the native alert ignores the app's theme (a Material dialog on Android, the system alert on iOS) · Source: a2c10d7 (2026-11-14); src/components/Dialog.tsx
- **`UI-9`** An answer's bubble is 90% of the message column wide (100% with a table) whatever its content; a question with options too; the user's own bubbles fit their text.
  Status: Default (manager or implementing session; open to change) · Why: shrink-wrapped rows made list answers half-width with two or three words per line; the width no longer changes while streaming · Source: 7957f1b
- **`UI-10`** The line under the panel title shows "provider · model"; if it doesn't fit, the model alone without its maker, cut at the end; " · this chat" goes first; the screen reader hears the whole line; a Qutai Credits balance is never shortened.
  Status: Default (manager or implementing session; open to change) · Why: "Anthropi…net 5.5" (cut in the middle) was unreadable · Source: 8782493, b211327; src/components/statusFit.ts
- **`UI-12`** The address bar is at the bottom by default (new installs and anyone who never saved settings); a stored choice stays.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 4184785 (2026-11-15)
- **`UI-14`** The Qutai button can be hidden (on by default); with it hidden, "Ask Qutai" at the top of the page menu opens the assistant.
  Status: Default (manager or implementing session; open to change) · Why: Comet reviews complained "the glowing AI button cannot be turned off" · Source: 9b2ae17; ROADMAP.md › Phase 3.5
- **`UI-15`** The logo always animates (still under the system's Reduce motion); the "Animate the logo" switch was removed and the assistant can no longer change it.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 0484264 (2026-11-16)
- **`UI-16`** Haptics are on by default and the app's switch turns all of them off; decorative ticks follow Android's touch-feedback setting, and signals the user must notice without looking use a short vibration.
  Status: Default (manager or implementing session; open to change) · Why: the old vibrator ignored the phone's setting; the system's long-press effect was weak or absent on some phones, and the owner had felt the earlier vibration · Source: 243f34b, e0bdea8, 1846cd1; src/device/haptics.ts (signal)
- **`UI-17`** Launch shows no logo: the native splash is the theme's background colour; the mark fades in over 450 ms on a cold start, not under Reduce motion; under the app lock only the colour shows; a forced light or dark theme is kept for the next launch's splash on Android 12+.
  Status: Default (manager or implementing session; open to change) · Why: before, older Android stretched a stale template image, newer Android showed the icon on a system colour and iOS was blank white or black · Source: 02f97c3; item33-launch-splash note
- **`UI-18`** The new tab page is Qutai's own screen (no web page loaded); it loads no site icons from third parties (a coloured letter instead) and shows no personal data in incognito.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/components/NewTabPage.tsx (NewTabPage, incognito) · Source: 1def27f
- **`UI-19`** Suggestions in the empty panel are chosen on the phone from a few markers in the page's code (structured data, forms, video, tables), never its text; no AI request, nothing sent until tapped; blocked sites get none, read-only sites no form filling, incognito nothing needing location or calendar.
  Status: Default (manager or implementing session; open to change) · Why: no page content leaves the phone for a suggestion · Enforced: In the app: src/agent/pageSuggestions.ts · Source: e19a721; README overview
- **`UI-21`** Today Settings › Assistant › "Asistan görünümü (deneme)" switches between three trial looks, default "curtain"; the switch and the other two looks are to be removed before launch.
  Status: Owner, 2026-11-17 · Why: the owner compared the looks on a phone and chose "curtain" ("Işık") · Source: e971db7; docs/working-mode.md › 3a; owner's fix-before-launch memory note

- **`UI-22`** The address bar's suggestion list never empties between letters: what it shows stays until the next answer lands, and an older answer never replaces a newer one. History and bookmarks are looked up 120 ms after the last letter (at once after a pause or a cleared field, at least every 360 ms while typing on); the typed text goes to the search engine only after typing has paused for 200 ms (a word typed without a pause is one request, with the finished text; a cleared field sends nothing), and its rows join when they land; until then its earlier rows that still contain the text stay, the others go. "Ask Qutai" and one "go" row (the typed address, or a search for the typed words) sit at the top and never move; rows that stay keep their place; new rows fade in and the list resizes over about 150 ms (at once with reduce motion); nothing changes while a finger is on the list.
  Status: Default, except the 200 ms pause before the search engine request: Owner, 2026-11-19 · Why: the owner saw the list blank and refill on every letter on an Honor 90 (19 Nov 2026); 120 ms skips letters typed faster than that while a lookup takes well under it (about 3 ms at 5,000 visits on a Mac, est. 10 to 25 ms on a phone, after a covering history index halved it) · Enforced: In the app: src/browser/omniboxResults.ts (LOOKUP_DEBOUNCE_MS, REMOTE_DEBOUNCE_MS); src/components/OmniboxSuggestions.tsx; src/storage/db.ts (history_url_title_visited); scripts/omnibox-tests · Source: docs/test-checklist.md › 19 Kasım'da bildirilenler

- **`UI-23`** The assistant can show options to choose between (products, places, hotels, flights, articles, search results) as cards with the `show_options` tool: one shape for all of them, each card a title, the link it opens, an optional picture, the price as the page shows it, one detail line and the site's name. In the chat panel and in the answer card over the page (compact) the cards sit in one horizontal row, two cards and the edge of a third at phone width, wider with larger text; a tap opens the link like a chat link (in the tab's group), a long press offers the chat link menu (open in new tab, in incognito, copy, share). While a picture loads its place pulses (still under reduce motion); a picture that fails or isn't allowed becomes the site's letter in a badge of its colour, so no card has a hole; when no card has a picture the row has no picture area. Screen readers hear each card as a link with title, price, detail and site. The message also keeps a plain line per option, which older versions show instead of the cards; the model is told to end with a sentence or two that makes sense without them, and not to say the cards show a price or picture the tool result says was left out (cards from web search alone have no picture and usually no checked price; asking the model to open the shop's page each time was declined by the owner on 20 Nov 2026 for its cost). The prompt asks for cards when there are several things to choose between and not for a single answer, a summary or a question (`ask_user`).
  Status: Owner, 2026-11-20 (asked for visual cards with the product's picture in the panel and the band's menu); the tool's shape, the row layout and the fallbacks are Default · Why: "bana kırmızı bir kazak bul dediğimde şu anda trendyol linki veriyor… o kazağın resmi ile kutular halinde verirse süper olur"; one small, forgiving schema so a small model (Claude Haiku 5.5 on Qutai Credits) fills it reliably · Enforced: In the app: src/agent/tools.ts (show_options), src/agent/systemPrompt.ts, src/agent/runAgent.ts, src/agent/optionsTool.ts, src/components/OptionCards.tsx, src/components/AssistantPanel.tsx ('options'), src/components/StepStrip.tsx (AnswerCard) · Tests: scripts/assistant-tests/optionCards.test.ts · Source: docs/test-checklist.md › 20 Kasım'da bildirilenler
- **`UI-24`** What a card may contain is checked in the app, not only asked in the prompt: links and pictures https only, with a real domain name (no IP address, no single-label host, no user name or password in the address, no spaces), at most 2048 characters; the site shown is the host of the card's own link (www. dropped, an IDN shown in punycode), never a name from the model or the page; title (120), price (40) and detail (120) are plain single-line text with control, zero-width and direction-override characters removed, rendered as text, never Markdown; at most 8 cards, duplicates dropped. The link is the page's own address for the element (found by the model's link, or by its read_page ref), else the model's link made absolute against the page. Pictures never come from the model: the app looks each option up on the open pages (the assistant's tab, then up to three tabs of its group in the same mode) and takes the largest `<img>` of the link or of the card around it, or for the page itself its og:image; read-only, nothing is clicked or loaded. A price is kept only when its number appears in what the task read or in the card's own text on the page. So that the model sees prices at all, read_page adds `prices="…"` (up to two amounts) to a link whose text was cut at 80 characters. Cards are checked again when a saved conversation or a backup is read.
  Status: Default (manager or implementing session; open to change) · Why: everything on a card comes from web pages (`UNTR-20`); a small model must not be able to invent a picture address or a price · Enforced: In the app: src/chat/optionCards.ts (safeHttpsUrl, displayHost, plainField, parseOptionsInput, buildCards, priceSeen, storedCards, checkedOptionItem), src/browser/pageScript.ts (optionDetails, cutPrices), src/storage/chat.ts (loadChat), src/backup/payload.ts (parseChatItem) · Tests: scripts/assistant-tests/optionCards.test.ts
- **`UI-25`** Card pictures are fetched by the app itself, not by React Native's image loader: XMLHttpRequest with credentials off (no cookies sent or stored: OkHttp's no-cookie jar on Android, HTTPShouldHandleCookies off on iOS) and no Referer (the request comes from no page); the download stops past 600 KB; the bytes must be a JPEG, PNG, GIF or WebP by their own first bytes (no SVG, HTML, AVIF or anything active) of at most 24 megapixels; a redirect must end on https; they are shown as a data: address and kept in memory only (at most about 6 MB, never written to the phone), at most three at a time. With "Block ads and trackers" on, a picture whose host is on the built-in ad and tracker list is not loaded (the downloaded filter lists live in the native blockers and are not consulted). A picture never triggers an approval, a navigation or a tool. The User-Agent is the platform's default (`DATA-23`).
  Status: Default (manager or implementing session; open to change) · Why: React Native's `<Image>` on Android shares the WebView's cookie store, so a card would have sent the user's cookies for that site; the image component in the build has no referrer or cookie control of its own (its `referrerPolicy` only adds a header) · Enforced: In the app: src/chat/cardImages.ts, src/chat/imageSniff.ts · Tests: scripts/assistant-tests/optionCards.test.ts (formats, sizes, a decompression bomb, base64)
- **`UI-26`** In an incognito conversation (or one that touched an incognito tab) card pictures are not loaded automatically: the cards show a still placeholder and a "Show images" button above the row loads that answer's pictures, for this app session only; a picture already in memory from another answer waits too.
  Status: Default (manager or implementing session; open to change), left for the owner to confirm · Why: showing a picture asks that site's server for it (`DATA-24`), also for options the user never opens; incognito should not do that unasked · Enforced: In the app: src/agent/runAgent.ts ('options' event with incognito), src/chat/Conversation.ts (optionsItem, imagesOnTap), src/components/OptionCards.tsx (imagesOnTap, revealed)

## Details

**Icons**

- (was `UI-2`) Kept on purpose: typographic characters in running text (…, ›, ·, ×, →), the task-list boxes inside the model's Markdown, and folder marks in the bookmark tool's results (read by the model, not shown as interface); older saved steps are shown without their leading emoji. · Why: these are text, not interface icons · Where: d0f62c2
- (was `UI-3`) Icons are decorative for screen readers; the text beside them says the same. · Where: d0f62c2

**Dialogs, headers and labels**

- (was `UI-5`) The dialog's backdrop, Android back and VoiceOver's escape gesture act as Cancel only when the dialog has a cancel button; otherwise they do nothing. · Why: a dialog without Cancel must be answered · Where: a2c10d7
- (was `UI-6`) Full-screen pages use one shared header whose action buttons never shrink before the title, with 44 pt targets, text capped at 1.4× the system size, and an icon-only back button with a spoken label. · Why: long titles squeezed side labels letter by letter ("Tümünü sil") · Where: 015b930; header-labels-wrap-audit note; src/components/ScreenHeader.tsx
- (was `UI-7`) Segmented options and menu items shrink (to at most 60%) instead of ending a line inside a word. · Why: "Désact/ivé", "Desktop-Vers/ion" at 2× text · Where: 015b930; src/components/WholeWordsText.tsx
- (was `UI-8`) Every pop-up screen uses `AppModal`; importing React Native's `Modal` anywhere else fails a test. · Why: iOS's default modal forces the app back to portrait · Where: dbe7010; docs/landscape.md (`npm run test:layout`)

**Panel and address bar layout**

- (was `UI-11`) The answer's cost sits beside its row of icons and never wraps or pushes them away: the token count goes first, then the amount is cut with "…". · Where: 780ea8a; README › Approximate cost
- (was `UI-13`) With the bar at the bottom, it rises with the keyboard, suggestions open upward, the loading bar is on the top edge and the selection strip sits above the bar; a sideways swipe on the bar switches to the previous or next tab in the same mode. · Where: 243f34b

**Tablets**

- (was `UI-20`) Sheets are at most 560 pt wide and full-screen lists centre at 680 pt. · Why: keep a phone-sized column on tablets · Where: ff0b7b4

## Limits and what is not built

- At 2× text the time column of the sent log and action log wraps; tab card titles and memory values split addresses mid-word (content, not controls).
- There is no vector or ≥ 1024 px master of the logo (TODO.md › Other).
- Option cards: a product that sits only in a lazy carousel (no picture address until it scrolls into view) gets the letter tile; pictures in CSS backgrounds are not found; options from the provider's web search have no picture; the answer card over the page with cards was not seen on screen yet (it needs a voice task).

## Where it lives

- `src/ui/Icon.tsx`, `src/agent/toolIcons.ts`, `src/components/Dialog.tsx`, `ScreenHeader.tsx`, `WholeWordsText.tsx`, `src/ui/AppModal.tsx`
- `src/components/AnswerCost.tsx`, `statusFit.ts`, `src/device/haptics.ts`, `LaunchIntro.tsx`
- `src/agent/pageSuggestions.ts`, `src/ui/assistantLook.ts`, `src/components/AssistantGlass.tsx`
- Option cards: `src/agent/optionsTool.ts`, `src/chat/optionCards.ts`, `cardImages.ts`, `imageSniff.ts`, `src/components/OptionCards.tsx`; the page lookup in `src/browser/pageScript.ts` (optionDetails)

## Disagreements between sources

- d91ee23 describes a logo drawn in code with an orbit; the same day 1ff8ba1 replaced it with `assets/logo.png` and sparks. The app uses the image with sparks.
