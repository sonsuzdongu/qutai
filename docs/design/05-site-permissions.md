# 5. Site permissions and approvals

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

What the assistant may do on each site, and when it must ask the user first: per-site levels, the "Ask before every
action" setting, the confirmation dialogs, "Don't ask again", and the actions that always ask.

## How it works

1. Each site has a level for the assistant. The page menu item "Qutai’s permission on this site: {level}" opens
   "What Qutai may do on this site"; its "All sites with their own permissions" opens the "Site permissions" list
   (tap a site to change it, ✕ goes back to the default).
2. The levels: **Default** (follows "Ask before every action"), **Always allow** (acts without asking), **Ask every
   time** (asks before every click, entry or page change), **Read only** (reads, never clicks, types or selects),
   **Blocked** (doesn't read or use the site at all).
3. Settings › Assistant › "Ask before every action" is off by default. When on, the assistant asks before it clicks,
   types, selects, opens a page or saves a screenshot on every "Default" site.
4. The confirmation ("Qutai wants to do this") shows the step with its icon and the site, with Deny / Allow and a box
   "Always allow on {site}", which sets that site to "Always allow".
5. Phone actions (a notification, a calendar event, a reminder, reading the calendar, the location, an ordinary
   download) instead offer "Don't ask again for …". Settings › Assistant › "Allowed without asking" lists all six with
   a switch each; reading the calendar and the location say there that the data then goes to the AI provider without
   asking. A "Deny" is never remembered.
6. Some actions always ask, whatever the site's level: posting and paying ([section 7](07-posting-and-paying.md)), uploading an image or file to a
   page, typing a hidden saved value, changing a page's style, deleting cookies, running a script, saving site rules,
   deleting a bookmark folder or removing more than three bookmarks in one task, and a risky download or any download
   in an incognito conversation.
7. Each site also has "Your personal information" (Ask / Allow / Block). Example: "book a table here" → the assistant
   types your phone number → "Enter your personal information on example.com?" appears once for that site and task,
   with "Allow once", "Always allow on this site" and "Don’t allow".
8. If Qutai is in the background when a step needs the user, the task pauses (on Android with a notification) and the
   question waits; nothing is approved while the user is away. A declined step shows as an info line ("You declined
   this"), not as an error.

## The rules

- **`SITE-1`** A site's level is one of Default, Always allow, Ask every time, Read only, Blocked (code: `default`, `allow`, `ask`, `readonly`, `blocked`), checked on every tool call.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/sitePolicy.ts (decide); src/agent/executeTool.ts (executeUnredacted) · Source: 647fbd5
- **`SITE-4`** On a Blocked site every call is refused, reading included, and the assistant can't navigate there.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/sitePolicy.ts (decide) · Source: 647fbd5
- **`SITE-5`** On a Read only site, click, click by position, type, select, download, upload, posting/paying approval, applying a style, deleting cookies and scripts are refused; reading and opening pages are not.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/sitePolicy.ts (WRITE_ACTIONS, policyName) · Source: 647fbd5; docs/page-customisation.md
- **`SITE-6`** Only opening a page, opening a tab, clicking, clicking by position, typing, selecting and saving a screenshot go through the per-site confirmation.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/sitePolicy.ts (ACTIONS_NEEDING_CONFIRMATION) · Source: 647fbd5
- **`SITE-7`** "Ask before every action" is off by default; it decides only for Default sites, and it is restored from a backup.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/storage/settings.ts (DEFAULT_SETTINGS.confirmActions); src/backup/backup.ts · Source: 843b394
- **`SITE-8`** Ticking "Always allow on {site}" in the confirmation and tapping Allow sets the site to Always allow for good. The box is never offered in incognito (an incognito tab, or a conversation that touched one), and neither is "Don't ask again"; removing site rules never offers it either (it would raise the site's level). Changed 19 Nov 2026: before, the box was offered and saved from incognito.
  Status: Default (manager or implementing session; open to change) · Why: incognito leaves no trace (owner principle); the incognito case followed the site prompts (`INC-13`) · Enforced: In the app: src/agent/alwaysAllow.ts (rememberOffer), App.tsx (askConfirmation), src/agent/executeTool.ts (marks the conversation incognito before asking), src/agent/siteRulesTool.ts · Source: 647fbd5; 19 Nov 2026 security pass
- **`SITE-9`** "Don't ask again" is offered only for six phone kinds: scheduled notifications, calendar events, reminders, reading the calendar, the location and an ordinary download.
  Status: Default (manager or implementing session; open to change) · Why: first offered only for notifications, events and reminders because they "stay on the phone, undoable"; extended the same day to calendar reading, location and downloads, with Settings saying the data then goes to the AI provider without asking (who asked for the change is not recorded) · Enforced: In the app: src/agent/alwaysAllow.ts (ALWAYS_ALLOW_KINDS); src/agent/runAgent.ts (a remembered kind skips the dialog) · Source: c6ad335; 289a687
- **`SITE-10`** "Don't ask again" is never offered for anything that acts on a web page or leaves the phone (clicks, typing, forms, purchases, messages, sign-in, sharing, uploads, personal details) or deletes the user's data.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded beyond the list · Enforced: In the app: src/agent/alwaysAllow.ts (only ALWAYS_ALLOW_KINDS can be remembered) · Source: 289a687
- **`SITE-11`** A risky download (apps, installers, archives) or a download in a conversation that touched an incognito tab always asks, even after "Don't ask again for downloads".
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/alwaysAllow.ts (kindForDownload); src/agent/executeTool.ts (downloadFileTool) · Source: 289a687
- **`SITE-12`** A denial is never remembered; only Allow with the box ticked is.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/alwaysAllow.ts (afterAnswer); App.tsx (askConfirmation) · Source: c6ad335
- **`SITE-13`** "Allowed without asking" is not in backups and can't be changed by the assistant.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: absent from src/backup/backup.ts and from src/agent/settingsTool.ts (CHANGEABLE) · Source: c6ad335
- **`SITE-14`** Adding calendar events, reminders and notifications, reading the calendar and getting the location always confirm with the details (unless allowed for good), whatever "Ask before every action" says.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/executeTool.ts (schedulingTool, readCalendarTool, locationTool) · Source: 5e51edb; 64cd8c6; e60fa84
- **`SITE-15`** Text the assistant types or selects that contains a remembered personal detail (name, phone, email, address, ID, travel details) is checked against the site's "Your personal information": Ask (default) asks once per site and task, Allow enters it, Block refuses.
  Status: Default (manager or implementing session; open to change) · Why: "checked here in the app, not left to the prompt" · Enforced: In the app: src/agent/executeTool.ts (personalGate); src/agent/personalData.ts (findPersonalData); App.tsx (askPersonalData) · Source: README; src/agent/personalData.ts
- **`SITE-16`** Hidden saved values (for example an ID or passport number) are typed by Qutai itself, only on https pages, never where personal information is blocked, after a question the first time per value, site and task, with no "always".
  Status: Default (manager or implementing session; open to change) · Why: the AI never sees the value; the question applies "even if the site may always get your other details" · Enforced: In the app: src/agent/executeTool.ts (hiddenForType, hiddenGate); App.tsx (askHiddenValue) · Source: 530b106
- **`SITE-17`** Every tool result is cleaned of hidden values before it goes to the model or a log; a screenshot masks fields holding one and is refused if one shows as page text.
  Status: Default (manager or implementing session; open to change) · Why: so no hidden memory's value reaches the model, the conversation or the "sent to the AI" log · Enforced: In the app: src/agent/executeTool.ts (executeTool redaction wrapper, maskHiddenForCapture); src/agent/hiddenValues.ts · Source: 530b106
- **`SITE-19`** Uploading an image or file to a page asks every time, with the picture, its size and the site, never covered by a site's "Always allow".
  Status: Default (manager or implementing session; open to change) · Why: an image can be personal, whatever the site's setting · Enforced: In the app: src/agent/imageTools.ts; App.tsx (askImageConfirmation) · Source: README › Edited images and uploads
- **`SITE-20`** Saving site rules asks every time with what will be hidden or blocked and where; never "don't ask again".
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: App.tsx (askSiteRules); src/agent/siteRulesTool.ts · Source: 9ba5dbb
- **`SITE-21`** Deleting a bookmark folder, or removing more than three bookmarks in one task, asks first; a single removal shows Undo.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/bookmarkTool.ts (bookmarkNeedsUser) · Source: 77bfe07
- **`SITE-22`** A confirmation is never answered for the user: while Qutai is in the background the task pauses and waits until the user is back.
  Status: Default (manager or implementing session; open to change) · Why: "nothing is approved because the user is away" · Enforced: In the app: src/agent/runAgent.ts (confirm wrappers); src/agent/executeTool.ts (backgroundBlocker) · Source: 0b5f332
- **`SITE-23`** Every action goes to the activity history (30 days, at most 2000 entries), refused and declined ones included; typed text is never recorded ("typed into field [3]"), and nothing from incognito tabs.
  Status: Default (manager or implementing session; open to change) · Why: typed text can be personal · Enforced: In the app: src/agent/executeTool.ts (executeUnredacted record) · Source: 647fbd5

## Details

**How a site is identified**

- (was `SITE-2`) A site is its host in lower case without "www.", plus the port when it isn't the scheme's default ("192.168.1.2:3000"). · Why: two local apps on different ports of one machine are two sites, as they are two origins for the web · Where: In the app: src/agent/sitePolicy.ts (siteKey) · 647fbd5; 06b61bb
- (was `SITE-3`) The site a call is checked against is the destination for navigation, the tab being read for `read_tab`, and the assistant's tab for everything else. · Where: In the app: src/agent/executeTool.ts (actionTarget) · 647fbd5

**How dialogs are shown**

- (was `SITE-18`) When the personal-information question or the posting/paying dialog was just asked for a step, the generic confirmation is not asked again for it. · Why: asking twice in a row for one step · Where: In the app: src/agent/executeTool.ts (executeUnredacted) · 4d97c4d
- (was `SITE-24`) A step the user declined shows as an info line ("You declined this"), not as an error. · Where: e267272

## Limits and what is not built

- Levels apply to web pages only; on the new tab page there is no site, so Blocked and Read only don't apply there.
- Personal-detail checks find only details Qutai remembers; `select_option` can't enter hidden values.
- "Irreversible or sensitive" actions beyond these gates (deleting things on a site, account settings) rely on the
  prompt (see `UNTR-19`).

## Where it lives

- `src/agent/sitePolicy.ts`, `src/agent/alwaysAllow.ts`, `src/agent/executeTool.ts`, `src/agent/runAgent.ts`,
  `src/agent/personalData.ts`, `src/agent/hiddenValues.ts`, `src/storage/sitePermissions.ts`, `App.tsx` (dialogs).
- Read next: README › How does it work?

## Disagreements between sources

- The 16 Nov hand-over note on "Don't ask again" says reading the calendar, the location and downloads are not
  offered it; commit 289a687 the same day offers it for all three. The code follows 289a687.
