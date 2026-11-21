# 11. The assistant's memory

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Facts about the user that the assistant keeps on the phone between conversations ("Phone: +90 555 …", "Vegetarian"),
what it refuses to keep, memories hidden from the AI, and the per-site question before personal details are typed.

## How it works

1. When the user tells a lasting fact ("my delivery address is …", "I'm allergic to nuts"), the assistant calls
   `remember` with one short fact and a category: identity, addresses, shopping, travel, food, budget or general.
2. Every request lists the memories by category in the assistant's instructions, within 8,000 characters (the
   categories forms need come first, newest first in each; the instructions say how many were left out). The assistant
   uses them when they help, for example to fill a checkout form, and applies shopping preferences there (payment
   method, courier note) and says what it applied.
3. Settings › Assistant › Memory: sections by category with counts, search, add and edit, "Organise for me", delete a
   category, and a lock on each memory, "Hide from the AI". The memory switch turns the whole feature off.
4. Some things are never kept, even if the user asks: passwords and PINs, card security codes, one-time codes, card
   numbers and expiry dates, bank account numbers (IBAN), the location's coordinates, a copied calendar; and ID or
   passport numbers outside identity and travel.
5. **Hidden memories.** National ID and passport numbers are hidden automatically; any memory can be locked. The AI
   sees only "[id] national ID number (saved; value hidden)". To fill a form it asks Qutai to type that memory; Qutai
   asks "Enter your national ID number on example.com?" and types it itself. Anything the assistant later reads that
   would show the value shows "[hidden: national ID number]"; a screenshot blanks such fields.
6. **Personal information per site.** Before the assistant types a remembered name, phone, email, address, ID or
   travel detail into a site, the site's "Your personal information" setting decides: Ask (default: Don't allow / Allow
   once / Always allow on this site), Allow or Block. It is in the site's sheet (address bar menu) and in All sites.
7. Incognito conversations can use memories but cannot add or remove any.

## The rules

- **`MEM-1`** Memory is on by default; when it is off, the memory tools and the memory section are never sent to the AI.
  Status: Default (manager or implementing session; open to change) · Why: the user decides what is kept · Enforced: In the app: App.tsx (memory passed only when memoryEnabled); src/agent/runAgent.ts (systemPrompt, MEMORY_TOOLS only with memory) · Source: 09f1190
- **`MEM-3`** At most 100 memories, each one line of at most 300 characters; saving the same text again (ignoring case) refreshes it instead of adding a copy.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/agent/memory.ts (MAX_MEMORIES, MAX_MEMORY_CHARS); src/storage/memory.ts (addMemory)
- **`MEM-4`** The memory section has an 8,000-character budget; with Qutai Credits the server's `maxMemoryChars` may shorten it, oldest left out first.
  Status: Default (manager or implementing session; open to change) · Why: cost of every request · Enforced: In the app: src/agent/memory.ts (memoriesForPrompt, memoryPrompt) · Source: TODO.md › Assistant
- **`MEM-5`** Never stored in any category, even when asked: passwords, passcodes and PINs; card security codes; one-time codes; card expiry dates; card numbers (13–19 digits passing the Luhn check); IBANs (passing the mod-97 check).
  Status: Default (manager or implementing session; open to change) · Why: for IBANs "shopping never needs it, and a leak of it is costly" · Enforced: In the app: src/agent/memory.ts (sensitiveReason), checked on every save path: src/storage/memory.ts (checkText, moveMemories), src/backup/payload.ts, src/intro/extract.ts · Source: 09f1190, d2a78fd
- **`MEM-6`** National ID and passport numbers may be kept only in identity and travel (the Memory screen shows a warning line there); elsewhere they are refused.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/memory.ts (sensitiveReason, ID_NUMBER_CATEGORIES) · Source: d2a78fd; item 29 hand-over note
- **`MEM-7`** `remember` refuses coordinates and text with two or more calendar date-times.
  Status: Default (manager or implementing session; open to change) · Why: "a location is not something to remember"; "the user's schedule … is never kept in memory" · Enforced: In the app: src/agent/tools/memory.ts (memoryTool) · Source: src/agent/executeTool.ts
- **`MEM-8`** The assistant saves only what the user said in their own messages, never information from web pages.
  Status: Default (manager or implementing session; open to change) · Why: a page must not plant facts about the user · Enforced: Prompt only: src/agent/memory.ts (memoryPrompt); the app does not check it · Source: 09f1190
- **`MEM-9`** Incognito conversations read memories but `remember` and `forget` are refused there.
  Status: Default (manager or implementing session; open to change) · Why: "Incognito conversations leave nothing behind, memories included" · Enforced: In the app: src/agent/tools/memory.ts (memoryTool); src/agent/runAgent.ts (memoryPrompt canWrite) · Source: 09f1190
- **`MEM-10`** National ID and passport numbers (named as such, or a valid Turkish ID number) are saved hidden automatically, whether saved by the assistant, the Memory screen, setup or a backup; an update hid those saved earlier.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/storage/memory.ts (addMemory, updateMemory); src/storage/db.ts (migration) · Source: 530b106
- **`MEM-11`** Saving a hidden memory again never makes it visible.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/storage/memory.ts (addMemory) · Source: src/storage/memory.ts
- **`MEM-12`** The AI is told only what a hidden memory is (its detected kind or the user's label), never anything taken from the value; a user label is at most 40 characters, has no run of 4 digits and does not contain the value.
  Status: Default (manager or implementing session; open to change) · Why: a label must not give the value away · Enforced: In the app: src/agent/memory.ts (hiddenLabel, hiddenLabelProblem) · Source: 530b106
- **`MEM-13`** Full addresses and dates of birth get a hint suggesting the lock; they are never hidden automatically.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/agent/memory.ts (suggestsHiding)
- **`MEM-14`** Every tool result is scanned for hidden values before it goes back to the AI, into the conversation, an error line or the "What was sent to the AI" log, and each is replaced by "[hidden: …]" (also when written with spaces, dashes, dots or URL escapes; values shorter than 4 letters or digits are not looked for).
  Status: Default (manager or implementing session; open to change) · Why: a page may print the value back (a field, the HTML, an error message) · Enforced: In the app: src/agent/executeTool.ts (executeTool wraps executeUnredacted); src/agent/hiddenValues.ts (redactHidden) · Source: 530b106
- **`MEM-15`** A hidden value is typed only on https pages, never on a blocked site or where personal details are blocked, and only after a question the first time each hidden value goes to a site in a task, even where personal details are always allowed; that question has no "always".
  Status: Default (manager or implementing session; open to change) · Why: the value is the most sensitive kind · Enforced: In the app: src/agent/tools/gates.ts (hiddenGate); App.tsx (askHiddenValue) · Source: 530b106; item 34 hand-over note
- **`MEM-16`** A screenshot for the AI makes fields showing a hidden value transparent, and is refused when the value appears in the page's text; no hidden value is sent into the page to look for it.
  Status: Default (manager or implementing session; open to change) · Why: chosen to "mask, not refuse" for fields · Enforced: In the app: src/agent/tools/page.ts (maskHiddenForCapture) · Source: item 34 hand-over note
- **`MEM-17`** Before `type` or `select_option` enters text that contains remembered personal details, the site's "Your personal information" setting decides: Allow runs, Block refuses, Ask (default) asks once per site and task with Don't allow / Allow once / Always allow on this site; "Always" saves Allow and is not offered in incognito.
  Status: Default (manager or implementing session; open to change) · Why: checked "in the app", not left to the instructions · Enforced: In the app: src/agent/tools/gates.ts (personalGate); App.tsx (askPersonalData); src/browser/sitePrompt.ts · Source: e7414e3
- **`MEM-19`** Once the personal-information question was answered, the general "ask before actions" question is not asked again for the same step.
  Status: Default (manager or implementing session; open to change) · Why: asking twice for one step · Source: item 29 hand-over note; src/agent/executeTool.ts
- **`MEM-20`** Typed text is never written to the activity history; it only says where something was typed.
  Status: Default (manager or implementing session; open to change) · Why: typed text can be personal · Enforced: In the app: src/agent/executeTool.ts (record: action.typeRedacted) · Source: 647fbd5
- **`MEM-21`** Personal details are entered only on sites the task is about; a page asking for them is never a reason.
  Status: Default (manager or implementing session; open to change) · Why: page content is untrusted · Enforced: Prompt only: src/agent/memory.ts (memoryPrompt); the app asks per site (MEM-17) but does not judge relevance · Source: 09f1190
- **`MEM-22`** At checkout the assistant applies shopping preferences without being asked and says so; a preference is never permission to order or pay.
  Status: Default (manager or implementing session; open to change) · Why: preferences save the user time; paying needs its own approval (see [section 7](07-posting-and-paying.md)) · Enforced: Prompt only: src/agent/memory.ts (memoryPrompt); payment itself is checked by the app · Source: TODO.md › Assistant
- **`MEM-24`** The assistant cannot switch memory on or off or hide or show memories; it can only remember and forget single facts.
  Status: Default (manager or implementing session; open to change) · Why: "what the assistant keeps about the user is theirs to decide" · Enforced: In the app: src/agent/settingsTool.ts (CHANGEABLE) · Source: febcdb4
- **`MEM-25`** When the assistant saves an ID number, the chat line and the activity history do not repeat the value.
  Status: Default (manager or implementing session; open to change) · Why: the value must not appear on screen or in logs · Enforced: In the app: src/agent/tools/describe.ts (describeToolCall: action.rememberHidden) · Source: 530b106

## Details

**Categories and storage**

- (was `MEM-2`) Seven categories with stable ids, in this order: identity, addresses, shopping, travel, food, budget, general; memories from before categories became general. Why: the order is the one forms need first. Where: src/agent/memory.ts (MEMORY_CATEGORIES); d2a78fd.
- (was `MEM-23`) "Organise for me" moves memories between categories; each move is checked like a new memory and keeps the memory's time. Why: moving is not new information, so "newest first" stays as it was. Where: src/storage/memory.ts (moveMemories); src/storage/memory.ts.

**Matching personal details**

- (was `MEM-18`) What counts as a personal detail: phone-like numbers (7–15 digits, compared on the last 10) and emails in any memory; letter-and-digit codes of 6+ characters in identity and travel; parts of identity, address and travel memories (6+ characters with two words or a digit); a single name word only when it is the whole typed text. A city, district or postal code on its own never asks. Why: a search for "İstanbul" must not ask. Where: src/agent/personalData.ts (personalNeedles, findPersonalData); src/agent/personalData.ts header.

## Why it is designed this way

The AI provider sees memories in every request, so the app (not the AI) decides what may be kept, which values the
AI never sees, and when a remembered detail may reach a site. Only "save only what the user said" and "only on relevant
sites" are left to the instructions, because the app cannot judge them.

## Limits and what is not built

- A hidden value that a page shows reformatted, escaped, split over several elements or in an image is not recognised.
- A hidden value went to the AI once, in the message where the user told it; anything typed in the chat is sent like any message.
- Details typed in the chat but never saved are not protected by the per-site question.
- `select_option` cannot use a hidden memory.
- A date of birth, or a number written differently from how it was saved, is not recognised as personal.

## Where it lives

- `src/agent/memory.ts`, `hiddenValues.ts`, `personalData.ts`, `organiseMemory.ts`, `executeTool.ts` (memoryTool, hiddenGate, personalGate, maskHiddenForCapture)
- `src/storage/memory.ts`, `src/storage/db.ts`, `src/components/MemoryScreen.tsx`, `App.tsx` (askPersonalData, askHiddenValue)
- TODO.md › Assistant (categorised memory, personal information, hidden memories); README intro (hidden memories)
