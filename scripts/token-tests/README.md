# Token measurement

`npm run measure:tokens` replays six scripted assistant tasks (`tasks.ts`: a plain question, summarising a long
article, filling in a form, comparing two tabs, a saved task with memory and a follow-up, a long 18-step task with
screenshots) through the app's own request code and prints, per task and provider (Anthropic, OpenAI, Gemini):

- prompt tokens by part: system prompt, tool definitions, conversation history, page content, other tool results,
  images;
- the billing view: uncached input, cache reads, cache writes, output, and the cost at the list prices of
  `src/ai/prices.ts`.

How (`simulate.ts`): the history is kept as `runAgent` keeps it and compacted by `src/agent/history.ts`; the system
prompt and tools are `src/agent/`'s; the requests are built by the real adapters (`callAnthropic`, `callOpenAI`,
`callGemini`) over a fake wire that records each body and answers with the scripted step in the provider's own format.
Nothing is sent anywhere. Page snapshots (`fixtures.ts`) are generated in read_page's exact format from a seeded word
list, so every run gives the same numbers.

Tokens are estimated (`tokens.ts`; no tokenizer package, no token-counting call), so absolute numbers can be off by
10–20 %; comparisons between two versions are what it is for. Prompt caching is simulated with each provider's rules
(header of `simulate.ts`; read 17 Nov 2026).

```bash
npm run measure:tokens -- --json /tmp/before.json      # save a baseline
npm run measure:tokens -- --compare /tmp/before.json   # after a change: before → after per task and provider
npm run measure:tokens -- --requests                   # every request of every task
TOKENS_BATCH=3 npm run measure:tokens                  # try another compaction batch size
```

The rules it led to are tested in `scripts/assistant-tests/tokenRules.test.ts`; the findings are in
`docs/performance-2026-11.md`.
