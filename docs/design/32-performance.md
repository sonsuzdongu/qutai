# 32. Performance

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

What was measured and changed in the November 2026 performance pass (the cost of the assistant's requests, start-up time and memory), and the two choices still open.

## How it works

1. Every assistant step re-sends the conversation so far. Providers keep a cheap copy (a "cache") of the part of a request that is the same as last time; reading from it costs about a tenth of the normal price.
2. Old page readings in the conversation are shortened to 300 characters, two at a time, so the conversation stays identical on every other step and the provider's cache keeps working. Two to three of the newest readings stay in full.
3. With Anthropic the conversation itself is now cached (not only the fixed instructions and tool list), with an own key and with Qutai Credits.
4. On six scripted test tasks this cut the cost by 39% on Anthropic, 8% on OpenAI and 5% on Gemini, while the number of tokens sent rose 3–5%.
5. Start-up was already in good shape: the app's own code takes about 150 ms on the iOS simulator; the rest (about 1.8 s) is native start-up. The working glow's drawing code is now prepared the first time it shows, not at start-up.

## The rules

- **`PERF-3`** The system prompt and tool list stay byte-identical within a task (time, tab and identity go in the user's message; tool order fixed); only the newest screenshot is sent.
  Status: Default (manager or implementing session; open to change) · Why: any change in the fixed part ends the cache · Source: docs/performance-2026-11.md › A
- **`PERF-4`** A task has at most 40 steps (research 80), which bounds the conversation's size.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/performance-2026-11.md › A
- **`PERF-5`** Answer-length limits stay as they are (Anthropic 8,192 tokens with no thinking; OpenAI and Gemini 32,000).
  Status: Default (manager or implementing session; open to change) · Why: providers bill what is generated, not the limit, so there is no saving · Source: docs/performance-2026-11.md › A
- **`PERF-6`** Not done: a one-hour cache, OpenAI's cache key, sending page changes instead of full readings, and changes to images.
  Status: Default (manager or implementing session; open to change) · Why: a one-hour cache costs twice as much to write and pays only for users who return within the hour (and the relay accepts only the default cache from the app); the cache key only separates accounting; page differences make the page harder for the model to read; screenshots are rare · Source: docs/performance-2026-11.md › Not done, and why
- **`PERF-7`** Today every request sends the full tool list (about 10,000 tokens) with the full descriptions; sending fewer tools or shorter descriptions is open.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#assistant)) · Why: this is the remaining per-task cost (about $0.03 on Sonnet for the first write of each task); it changes the agent profile, risks the model not finding a tool, and the behaviour tests must stay green · Source: TODO.md › Assistant › Open decisions from the November performance pass; docs/performance-2026-11.md › Not done
- **`PERF-8`** Today none of the bigger start-up ideas is tried (static linking of iOS libraries, replacing the Skia graphics library, which is 13.6 MB per Android CPU type, loading pdf.js only when a PDF opens (about 2.3 MB), Metro's delayed module loading, settings in one record); first measure start-up on a real phone.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#assistant)) · Why: on iOS about 1.8 s pass before the app's own code (about 150 ms) runs; nothing else was clearly wrong · Source: TODO.md › Assistant › Open decisions from the November performance pass; docs/performance-2026-11.md › B
- **`PERF-10`** The step strip names elements instead of "ref 1" (the third item of the performance pass).
  Status: Owner, 2026-11-18 · Why: see [section 30](30-working-mode.md) (WORK-7) · Source: TODO.md › Assistant; ba63602
- **`PERF-11`** A long conversation gets a bounded request. The current message and every step of its task are sent whole (compacted as in Details), so within a task each step's request starts with the previous one and keeps the prompt cache; the system prompt and tools are never touched. When the history before the current message passes 300,000 characters (its JSON text, an image counted as 6,000), the results of tools in earlier messages are cut to 200 characters first, then whole earlier exchanges are left out from the oldest, down to 150,000 characters at once, so the start of the history (and the cache with it) moves only every few dozen long messages; a cut is only ever before a user message, so a tool call never loses its result, and the first message kept starts with "[Earlier messages of this conversation were left out to keep the request small.]". Which exchanges go is worked out from the history alone, so the same history always gives the same request. Notes the assistant took (`take_notes`) in a left-out exchange go with it. Only the newest screenshot is held in memory: older ones lose their image data in place with the same note the request gives them, so no request changes. The full conversation stays on screen and on the phone (storage keeps its own 1 MB limit).
  Status: Default (implementing session; owner's 20 Nov 2026 code-review request) · Why: before, the history was only compacted, never trimmed, so a long conversation's requests grew without limit (cost, latency, the model's context), and every screenshot stayed in memory for the conversation's life · Enforced: In the app: src/agent/history.ts (boundHistory, requestHistory, releaseOldImages; MAX_HISTORY_CHARS, TRIMMED_HISTORY_CHARS, OLD_RESULT_CHARS, IMAGE_CHARS); src/agent/runAgent.ts; scripts/task-tests/history.test.ts (Anthropic, OpenAI, Gemini and the chat-completions format) · Source: 20 Nov 2026 code review

## Details

**Keeping the provider cache**

- (was `PERF-1`) Old page readings are shortened in batches of two (`COMPACT_BATCH = 2`); only results over 1,500 characters count; which results are cut depends only on the conversation, so compacting again changes nothing. · Why: cutting one result per step changed the middle of the conversation on 27 of 29 steps, which ends every provider's cache there; batch sizes 1–4 were measured and 2 was best for all three providers · Where: In the app: src/agent/history.ts (COMPACT_BATCH); docs/performance-2026-11.md › A; 685da33
- (was `PERF-2`) With Anthropic, a cache marker sits on the last block of the last user message; never on a final assistant message or on raw output kept with the history; the server's relay passes it on. · Why: the conversation was never cached on Anthropic, so every step paid full price for the whole history · Where: In the app: src/ai/anthropic.ts (withHistoryBreakpoint); docs/performance-2026-11.md › A; 685da33

**Start-up**

- (was `PERF-9`) The working glow's shader is compiled the first time it shows, not at start-up. · Why: correct and free, though the saving is a few milliseconds · Where: 820af68

## Why it is designed this way

Caching only works while the start of a request stays the same, so every change was judged by whether it keeps the conversation identical between steps. Changes that would touch the prompt or tool list were left alone, because they change the registered agent profile and risk the assistant's behaviour; the profile id did not change in this pass.

## Limits and what is not built

- Prompt tokens rise 3–5% on tasks with many page reads; this costs about 5% more only where nothing is cached (OpenRouter models without caching, custom endpoints).
- Measured only on the iOS simulator and Android emulator (iOS cold start about 1.9 s, warm about 0.8 s, 68 MB after launch; Android first frame about 0.5 s, 112 MB); real-phone numbers are still to take (commands in docs/performance-2026-11.md › On a phone).
- Open iOS findings O1–O6 are listed in docs/performance-2026-11.md › C.

## Where it lives

- [docs/performance-2026-11.md](../../docs/performance-2026-11.md)
- `src/agent/history.ts`, `src/ai/anthropic.ts`; tests `scripts/assistant-tests/tokenRules.test.ts`; measurement `npm run measure:tokens`
