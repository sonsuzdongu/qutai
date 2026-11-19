# 13. "What was sent to the AI" and the cost display

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

A list of every request the app sent to the AI, with what was new in it, and an approximate cost under each answer.

## How it works

1. Settings › Assistant › "What was sent to the AI", or "ⓘ Sent" under an answer, lists every request, newest first by
   day: time, provider and model, the site, and what was new in it (the message, page text with its site and size, page
   source, screenshots, another tab's text, history matches, memory, that a location was sent, calendar details,
   bookmarks, settings, PDF text, attached images, other tool results), the size of the earlier conversation sent again,
   and the fixed instructions and tool list (with the user's custom instructions).
2. Opening an entry shows the exact text that left the phone, as long as the app still has it in memory.
3. The last answer of each task shows "≈ $0.012 · 3.4k tokens" in its row of icons. Tapping it shows the model, the
   requests, tokens by kind, web searches, where the figure comes from and the conversation's total. The list shows the
   same per request and a total per day.
4. Settings › Assistant › "Show approximate cost" hides it (on by default).
5. With Qutai Credits it shows what the server charged ("0.42 credits · 1.5k tokens"), never dollars.

## The rules

- **`LOG-1`** Every request is recorded in one place, the provider wrapper, before it leaves; the API key is never read; recording never fails a request.
  Status: Default (manager or implementing session; open to change) · Why: "nothing reaches Anthropic, OpenAI or Gemini without being logged" · Enforced: In the app: src/ai/providers.ts (recorded); src/ai/audit.ts (recordRequest) · Source: ee5960d
- **`LOG-2`** On disk only the outline is kept (time, provider, model, site, kinds and sizes, and the cost numbers), for 30 days and at most 2,000 entries, pruned at start.
  Status: Default (manager or implementing session; open to change) · Why: "so page text is never copied to disk a second time" · Enforced: In the app: src/storage/sentLog.ts (KEEP_DAYS, KEEP_ROWS, pruneSent) · Source: ee5960d
- **`LOG-3`** The content of requests is kept only in memory until the app closes: the latest 60 requests, 2,000,000 characters and 4 images; the in-memory list holds up to 500 entries.
  Status: Default (manager or implementing session; open to change) · Why: page text, messages and screenshots should not be stored again · Enforced: In the app: src/storage/sentLog.ts (CONTENT_REQUESTS, CONTENT_CHARS, CONTENT_IMAGES, SESSION_REQUESTS) · Source: ee5960d
- **`LOG-4`** The location's coordinates are never kept in the log; the entry only says a location was sent.
  Status: Default (manager or implementing session; open to change) · Why: location is sensitive · Enforced: In the app: src/ai/audit.ts (recordRequest: location content left empty) · Source: README intro
- **`LOG-5`** Requests from incognito conversations, or ones that touched an incognito tab, stay in memory only; when a conversation touches incognito, its earlier entries are removed from disk.
  Status: Default (manager or implementing session; open to change) · Why: incognito leaves nothing behind (see [section 8](08-incognito.md)) · Enforced: In the app: src/storage/sentLog.ts (recordSent) · Source: README intro
- **`LOG-6`** Hidden memory values and custom endpoint header values never appear in the log.
  Status: Default (manager or implementing session; open to change) · Why: secrets · Enforced: In the app: src/agent/executeTool.ts (executeTool redaction); src/ai/customHeaders.ts · Source: 530b106, 2543bc9
- **`LOG-8`** The log is never in a backup; Clear browsing data has its own item for it.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/storage/sentLog.ts header; src/storage/clearData.ts
- **`LOG-9`** The activity history (what the assistant did) is kept the same way: 30 days and at most 2,000 rows, never for incognito, never with typed text.
  Status: Default (manager or implementing session; open to change) · Why: typed text can be personal · Enforced: In the app: src/storage/actionLog.ts (KEEP_DAYS, KEEP_ROWS); src/agent/executeTool.ts (record) · Source: 647fbd5
- **`LOG-10`** With an own key, the cost is the tokens the provider reported times the list prices in `src/ai/prices.ts` (standard tier, read on the date shown as "prices as of", today 16 Nov 2026), computed exactly in whole numbers and rounded once; prompt-size price tiers and announced price changes are applied by date.
  Status: Default (manager or implementing session; open to change) · Why: an estimate the user can trust; the provider's invoice is what counts · Source: src/ai/cost.ts; src/ai/prices.ts (PRICES_AS_OF); 575129d
- **`LOG-11`** Where the app has no price it shows tokens only, never a guess: the custom endpoint, models not in the table, and OpenRouter unless OpenRouter reports the cost itself (then its figure, plus the provider's charge when the user's own provider key was used at OpenRouter).
  Status: Default (manager or implementing session; open to change) · Why: never show a made-up price · Source: README › Approximate cost; src/ai/cost.ts (priceRequest)
- **`LOG-12`** OpenRouter's reported cost is read as US dollars.
  Status: Default (manager or implementing session; open to change) · Why: assumption: OpenRouter's pages don't state the ratio · Source: approximate-cost hand-over note
- **`LOG-13`** Today Gemini's tool-use tokens are priced as input and its cached tokens are taken as part of the input.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#assistant): "Decide whether Gemini's `total_tool_use_tokens` are billed at the input price … and whether `total_cached_tokens` is part of `total_input_tokens`") · Why: Google's documentation does not say · Source: TODO.md › Assistant
- **`LOG-14`** The price table is checked against the providers' pricing pages whenever prices change and at least monthly; a model without a published price stays out of it.
  Status: Default (manager or implementing session; open to change); a recurring open task in TODO.md › Assistant · Why: announced changes (Gemini 4 Carbon on 1 Dec 2026, Gemini 3.8 Flash on 1 Jan 2027) are already in the table · Source: TODO.md › Assistant; README › Approximate cost
- **`LOG-15`** Only numbers are stored with the conversation (provider and model ids, request counts, tokens by kind, the cost, the price date and its source), never content; never for incognito; they go into a backup that includes conversations.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: README › Approximate cost
- **`LOG-16`** "Show approximate cost" is on by default and hides the figure both under answers and in the log.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/storage/settings.ts (showCost); 575129d
- **`LOG-17`** With Qutai Credits, the server's own charge is shown and kept as it is (never recomputed from prices), and a request that failed part-way still records what it was charged.
  Status: Default (manager or implementing session; open to change) · Why: the server's settlement is the real charge · Enforced: In the app: src/ai/providers.ts (recorded: reply.cost kept, failedRequestCost) · Source: 3d6b3f7
- **`LOG-18`** The figure is an estimate: discounts, batch prices, free allowances (Google's 5,000 free searches a month), taxes and credits are not known to the app; stopped or failed requests report nothing and the breakdown says how many.
  Status: Default (manager or implementing session; open to change) · Why: only the provider's invoice is exact · Source: README › Approximate cost

## Details

- (was `LOG-7`) The memory section is listed when it is first sent or changes, and the custom instructions once with the fixed instructions, not with every request. Why: avoid repeating the same text in every entry. Where: ee5960d; src/ai/audit.ts (lastMemory).

## Limits and what is not built

- Maybe later: a running total in the panel's header and a monthly total in Settings (TODO.md › Assistant; not decided).
- The server's price file and the app's table differed on Gemini 4 Hydrogen when checked (approximate-cost hand-over note).

## Where it lives

- `src/ai/audit.ts`, `src/storage/sentLog.ts`, `src/storage/actionLog.ts`, `src/components/SentLogScreen.tsx`
- `src/ai/usage.ts`, `src/ai/prices.ts`, `src/ai/cost.ts`, `src/components/AnswerCost.tsx`; `npm run test:cost`
- README intro and › Approximate cost (how to update the prices)

## Disagreements between sources

- README › Approximate cost says reading the server's charge "is a later job", and `src/ai/cost.ts` says that code is "not written yet"; commit 3d6b3f7 reads the server's settlement and the app shows "0.42 credits · 1.5k tokens" per answer and per request (README › Qutai Credits). The code shows the server's charge.
