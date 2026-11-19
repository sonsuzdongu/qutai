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
10. **Empty assistant panel** suggests a few tasks that fit the page ("Is this a good buy?" on a product, "Help me fill this in" on a form), chosen on the phone without an AI request.
11. **Tablets.** Sheets stay at most 560 pt wide; full-screen lists centre at 680 pt.

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

- **`UI-22`** The address bar's suggestion list never empties between letters: what it shows stays until the next answer lands, and an older answer never replaces a newer one. History and bookmarks are looked up 120 ms after the last letter (at once after a pause or a cleared field, at least every 360 ms while typing on); search engine suggestions are asked at the same moments and the two land together unless the engine takes over 150 ms. "Ask Qutai" and one "go" row (the typed address, or a search for the typed words) sit at the top and never move; rows that stay keep their place; new rows fade in and the list resizes over about 150 ms (at once with reduce motion); nothing changes while a finger is on the list.
  Status: Default (manager or implementing session; open to change) · Why: the owner saw the list blank and refill on every letter on an Honor 90 (19 Nov 2026); 120 ms skips letters typed faster than that while a lookup takes well under it (about 3 ms at 5,000 visits on a Mac, est. 10 to 25 ms on a phone, after a covering history index halved it) · Enforced: In the app: src/browser/omniboxResults.ts; src/components/OmniboxSuggestions.tsx; src/storage/db.ts (history_url_title_visited); scripts/omnibox-tests · Source: docs/test-checklist.md › 19 Kasım'da bildirilenler

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

## Where it lives

- `src/ui/Icon.tsx`, `src/agent/toolIcons.ts`, `src/components/Dialog.tsx`, `ScreenHeader.tsx`, `WholeWordsText.tsx`, `src/ui/AppModal.tsx`
- `src/components/AnswerCost.tsx`, `statusFit.ts`, `src/device/haptics.ts`, `LaunchIntro.tsx`
- `src/agent/pageSuggestions.ts`, `src/ui/assistantLook.ts`, `src/components/AssistantGlass.tsx`

## Disagreements between sources

- d91ee23 describes a logo drawn in code with an orbit; the same day 1ff8ba1 replaced it with `assets/logo.png` and sparks. The app uses the image with sparks.
