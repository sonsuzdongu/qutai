# 14. Tabs, tab groups and conversations

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

How conversations with the assistant belong to tabs and tab groups, how they are saved, how tabs sleep, and what the
assistant panel does while a task works.

## How it works

1. Each tab that is not in a group has its own conversation with Qutai. The tabs of a group share one conversation
   (messages, the half-typed message, the running task). Tabs the assistant opens and windows a page opens join the
   current tab's group, so a task's tabs and its chat stay together. Links in an answer or on a "Sources" card open in
   the conversation's group too.
2. A tab joining a group gets the group's chat (a new group takes over the chat of its first tab). A tab leaving keeps
   the group's chat with the group and gets its own back. Ungrouping moves the chat to the active (or first) tab.
   Closing the last tab keeps the chat with that tab, so reopening it from Recently closed brings it back.
3. Conversations are saved on the phone with the half-typed message and the conversation's own model ([section 2](02-ai-providers.md)).
   "New chat" starts over.
4. At most five tabs keep a live page; the others "sleep" as an address and a thumbnail and reload when opened.
5. While a task works the input is closed: dimmed, "Qutai is working…", the attach, microphone and one-tap buttons
   off, Stop in place of Send. Text already typed stays, to send afterwards. The input stays closed while a dialog waits and opens
   again when the task ends. A light moves around the screen's edge while the task works (`30-working-mode.md`).
6. Only one task runs at a time in the whole app; asking in another tab shows that Qutai is busy elsewhere.

## The rules

- **`TABS-1`** An ungrouped tab has its own conversation; all tabs of a group share one conversation.
  Status: Default (manager or implementing session; open to change) · Why: the chat stayed with the starting tab, so another tab of the group "showed a different (usually empty) conversation"; one context for the whole job · Source: 0df7b0e, d3d3e3b; TODO.md › Assistant
- **`TABS-2`** Joining: the group's conversation wins (a new group takes the first tab's); leaving: the conversation stays with the group and the tab gets its own back; ungrouping: it moves to the active (or first) tab; closing the last tab: it stays with that tab and returns with Recently closed.
  Status: Default (manager or implementing session; open to change) · Why: the task that opened a window carries on in the group · Source: d3d3e3b; TODO.md › Assistant
- **`TABS-6`** A group that ever held an incognito tab never saves its conversation, like an incognito tab.
  Status: Default (manager or implementing session; open to change) · Why: incognito leaves nothing on disk (see [section 8](08-incognito.md)) · Enforced: In the app: src/browser/Browser.ts, src/storage/chat.ts · Source: d3d3e3b
- **`TABS-7`** A saved conversation keeps at most 300 items and about 1,000,000 characters of history (the oldest exchanges go first, cut only at the user's turns), and a half-typed message of up to 20,000 characters; screenshots are dropped and page contents shortened before saving.
  Status: Default (manager or implementing session; open to change) · Why: storage size; cuts at user turns keep tool calls with their results · Source: src/storage/chat.ts (MAX_ITEMS, MAX_TURNS_JSON, MAX_DRAFT, prepareForStorage)
- **`TABS-9`** Recently closed keeps at most 25 tabs.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/browser/Browser.ts (MAX_RECENTLY_CLOSED)
- **`TABS-10`** At most 5 tabs have a live page; the least recently viewed sleep first; never put to sleep: the active tab, the tab the task works in and tabs it reads, incognito tabs, tabs using the camera or microphone, tabs playing sound; on a low-memory warning all but the active and the task's tab sleep; a tab whose navigation is still pending never sleeps (sleeping would drop the load the user asked for, `TABS-18`).
  Status: Default (manager or implementing session; open to change) · Why: memory; incognito tabs' cookies "live only in their own WebView", so sleeping would lose them · Source: 5196cd6; src/browser/Browser.ts (MAX_AWAKE_TABS, sleepInactive)
- **`TABS-11`** Only one task runs at a time in the app; closing a tab stops the task running in it.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 0df7b0e; App.tsx (chat.busyElsewhere)
- **`TABS-12`** While a task works, the input is closed: nothing typed is queued or passed to the task, dictation into the field is off, and Stop is always available; it opens again for a confirmation, a question, a pause, a stop, a failure, the end, or a message handed back.
  Status: Default (manager or implementing session; open to change) · Why: sending during a task was already impossible; only dictation was possible, and it is off now · Source: 2a90ca9, af24ab6; README intro
- **`TABS-13`** The working glow shows only on the task's tab, only while it is on screen and working; off while a confirmation waits and in picture-in-picture; drawn above the tabs, so the assistant's screenshots never contain it; still with Reduce motion.
  Status: Default (manager or implementing session; open to change) · Why: screenshots for the AI must show the page as it is · Source: README intro (src/components/WorkingGlow.tsx)
- **`TABS-14`** Links in an answer, the search box and Sources cards open in the conversation's tab group; an incognito conversation's links open incognito.
  Status: Default (manager or implementing session; open to change) · Why: before, such links opened outside the group the conversation belongs to · Source: 0c8ab8d; src/browser/chatLinks.ts
- **`TABS-15`** A task that ends while the user is in Qutai but looking at another tab shows a toast with Show and a dot on the Qutai button.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: f428134; README › Known limitations
- **`TABS-16`** When a task has ended, its runs of 3 or more steps fold into one summary line; a running task stays live.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 7ef397d
- **`TABS-17`** On long tasks the assistant keeps notes (`take_notes`) that are never trimmed while old page contents are; at the step limit (40 steps, 80 in deep research) it writes what it did, what it found and what remains, and the user can say "continue".
  Status: Default (manager or implementing session; open to change) · Why: reviews said agents "forget context" and "stop halfway" · Source: 3dc00a6; src/agent/runAgent.ts (MAX_STEPS, MAX_RESEARCH_STEPS)
- **`TABS-18`** A navigation is pending from the moment the app lets a top-frame navigation through for the user's tap (iOS: a link or form; Android: a touch on the page in the last 3 s) or starts one itself (address bar, bookmark, history, new tab page, back, forward, reload, waking a tab), until the site answers and then the page loads; it ends on load end, error, Stop, a download, the web process ending, or the tab closing or sleeping. Each navigation has its tab's next number: timers and late events from an older one never change a newer one, and a tab's events only reach its own tracker.
  Status: Default (manager or implementing session; open to change) · Why: on a slow connection nothing changed between a tap and the site's first byte (Android reports the load start only after the answer) · Enforced: In the app: src/browser/pendingNavigation.ts (NavigationTracker), src/browser/Tab.ts, src/components/BrowserView.tsx; tests scripts/navigation-tests/ · Source: owner's report 20 Nov 2026 (docs/test-checklist.md › 20 Kasım'da bildirilenler)
- **`TABS-19`** The progress line (3 pt, was 2) starts at once at 10 %, creeps towards 30 % ever more slowly while the site hasn't answered, then follows the WebView's real progress, never moves backwards within one navigation, fills and fades out when the page has loaded, and vanishes at once on Stop or an error; with Reduce motion it steps once a second without sliding. The page menu's Reload becomes Stop while a navigation is pending or loading.
  Status: Default (manager or implementing session; open to change) · Why: the owner asked for Chrome's behaviour · Enforced: In the app: src/browser/pendingNavigation.ts (waitingProgress, lineTarget), src/components/AddressBar.tsx (ProgressLine), App.tsx · Source: owner's report 20 Nov 2026 (docs/test-checklist.md › 20 Kasım'da bildirilenler)
- **`TABS-20`** While a navigation the page started (a link tap, a script, a redirect) waits for its site, the address bar and lock keep showing the page on screen and a line under the bar names the destination ("example.com opening…", after 0.4 s); a navigation the user started in the app shows its address at once; back and forward keep the page on screen until the WebView names the address; after Stop or an error the bar shows the page on screen.
  Status: Default (manager or implementing session; open to change) · Why: Chrome's rule against address spoofing: a page must not make the bar show an address whose content isn't on screen (iOS reported the destination at once before) · Enforced: In the app: src/browser/pendingNavigation.ts (shownAddress), src/browser/Tab.ts (committedUrl, address), src/components/NavigationStatus.tsx · Source: owner's report 20 Nov 2026 (docs/test-checklist.md › 20 Kasım'da bildirilenler)
- **`TABS-21`** After 4 s without an answer the line says the site isn't answering yet, with Stop; after 25 s it says the connection is very slow, with Try again (asks for the same address again) and Stop. The app never cancels a load on its own. With no connection at all (expo-network) the line says so at once instead.
  Status: Default (manager or implementing session; open to change) · Why: the wait was invisible and the user couldn't tell a slow site from a stuck app · Enforced: In the app: src/browser/pendingNavigation.ts (SLOW_AFTER_MS, VERY_SLOW_AFTER_MS, slowness), src/device/connectivity.ts · Source: owner's report 20 Nov 2026 (docs/test-checklist.md › 20 Kasım'da bildirilenler)
- **`TABS-22`** The page on screen stays until the new one commits; a tab leaving the new tab page keeps showing the new tab page, and a woken tab its last thumbnail, until the site answers (no blank white screen).
  Status: Default (manager or implementing session; open to change) · Why: a blank page looked like a broken app on slow connections · Enforced: In the app: src/browser/Tab.ts (cover), src/components/BrowserView.tsx · Source: owner's report 20 Nov 2026 (docs/test-checklist.md › 20 Kasım'da bildirilenler)
- **`TABS-23`** A window a page opens comes to the front only when that page is on screen and the user touched it in the last 3 s; otherwise it opens behind the tab on screen and a toast says a page opened a new tab, with Show.
  Status: Default (manager or implementing session; open to change) · Why: guard for the report that a slow load seemed to land in the tab opened meanwhile: on Android a window a page opens late (after a slow answer) used to take the screen from whatever tab the user had gone to; the report itself was not reproduced (iOS simulator and the scenario tests show each load staying in its tab; the Android emulator could not run on this machine) · Enforced: In the app: src/browser/pendingNavigation.ts (windowOpensInFront), src/components/BrowserView.tsx (onOpenWindow), App.tsx · Source: owner's report 20 Nov 2026 (docs/test-checklist.md › 20 Kasım'da bildirilenler)
- **`TABS-24`** A tab whose page failed because the phone was offline reloads by itself once when the connection returns, and only if it still shows that error; the offline error page says so. Host-not-found and timeout errors keep their own pages (existing).
  Status: Default (manager or implementing session; open to change) · Why: Chrome does the same; nothing to do for the user but wait · Enforced: In the app: src/browser/offlineReload.ts, src/device/connectivity.ts, App.tsx, src/components/ErrorPage.tsx · Source: owner's report 20 Nov 2026 (docs/test-checklist.md › 20 Kasım'da bildirilenler)
- **`TABS-25`** iOS: reloading, or going back or forward to, the result of a sent form asks "Send the form again?" first (it can repeat an order or a payment). Android: its WebView never sends a form again and gives no JavaScript hook to ask, so there is no warning there (a native patch would be needed).
  Status: Default (manager or implementing session; open to change) · Why: a silent resubmission can repeat a purchase · Enforced: In the app: src/components/BrowserView.tsx (navigationType formresubmit), src/browser/Tab.ts (allowResubmitUntil) · Source: owner's report 20 Nov 2026 (docs/test-checklist.md › 20 Kasım'da bildirilenler)
- **`TABS-26`** A woken tab comes back at the scroll position it had on the same page (the page reports it half a second after scrolling stops; memory only, never saved, not in incognito tabs, which never sleep).
  Status: Default (manager or implementing session; open to change) · Why: waking a tab lost the reading position · Enforced: In the app: src/browser/scrollMemory.ts, src/browser/Tab.ts (noteScroll, takeScrollRestore) · Source: owner's report 20 Nov 2026 (docs/test-checklist.md › 20 Kasım'da bildirilenler)

- **`TABS-27`** When the user closes the tab the assistant works in during a task, the assistant's next call that needs that tab (reading, clicking, typing, navigating, downloading a link, reading the PDF open there) fails with "The tab you were working in was closed, so nothing was done" and a step line; it never acts on whichever tab is on screen with element numbers from the closed page. Listing, switching to and opening tabs still work, and switching or opening is how the assistant goes on. When the assistant closes its own tab, it goes on in the tab on screen as before (the tab list it gets back says where it is). Before 20 Nov 2026 it silently went on in the tab on screen.
  Status: Default (implementing session; owner's 20 Nov 2026 code-review request) · Why: a click by element number on another page presses something else · Enforced: In the app: src/agent/executeTool.ts (tabClosed, currentTab, tabsTool), src/agent/fileTools.ts, src/agent/bookmarkTool.ts, src/agent/toolTable.ts (each tool's tab need) · Tests: scripts/injection-tests/pipeline.test.ts · Source: 20 Nov 2026 code review

## Details

**Conversations on disk and in memory**

- (was `TABS-3`) A task running in a tab's own conversation stays with that tab until it ends, so it is never hidden, cut off or started twice. Why: as stated. Where: d3d3e3b.
- (was `TABS-4`) When a tab and a group join before both conversations were read from disk, the decision waits for both; the group keeps the first non-empty one, and an empty group conversation gives way to the joining tab's. Why: a conversation not yet read must not be lost. Where: 666c98e; src/browser/Browser.ts (joinGroupChat, settleGroupChat).
- (was `TABS-5`) Conversations are saved under the tab's id or the group's id; conversations of tabs and groups that no longer exist are deleted (open tabs, groups and recently closed tabs are kept). Where: src/storage/chat.ts (deleteOrphanChats); d3d3e3b.
- (was `TABS-8`) The half-typed message survives closing the app; text typed since the tab opened wins over the saved one, and a model chosen since wins over the saved one. Where: 4d07c46; src/chat/Conversation.ts.

## Limits and what is not built

- Known gap: if a group is founded on a tab not shown since the app started and a tab with a conversation then joins, that conversation stays hidden until the tab leaves the group (README › Known limitations).
- There is no separate list of past conversations: a conversation lives with its tab or group (and Recently closed).

## Where it lives

- `src/browser/Browser.ts`, `src/browser/Tab.ts`, `src/browser/pendingNavigation.ts`, `src/components/NavigationStatus.tsx`, `src/device/connectivity.ts`, `scripts/navigation-tests/`, `scripts/slow-server/`, `src/browser/chatLinks.ts`, `src/chat/Conversation.ts`, `src/storage/chat.ts`, `src/storage/session.ts`
- `src/components/BrowserView.tsx`, `AssistantPanel.tsx`, `WorkingGlow.tsx`, `StepStrip.tsx`
- [docs/working-mode.md](../../docs/working-mode.md); TODO.md › Assistant
