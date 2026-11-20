# Qutai Credits tests (pro mode)

Tests for `src/credits/` and the agent profile, with Node's built-in test runner (`node --test`, Node 22.18+ / 24)
and its TypeScript support; no test framework is added to the app. The shared loader (`scripts/test-support/`)
resolves the app's extensionless imports and stands in for the native modules the request code touches
(`react-native`: `Platform`, `AppState`; `expo-localization`: the language), so the real adapters
(`src/ai/anthropic.ts`, `openai.ts`, `gemini.ts`) run here as they do in the app. The folder is left out of the
app's `tsc`.

```bash
npm run test:credits          # profile check, client, provider, setup and purchases: against fakes (fake.ts)
npm run test:credits:server   # against a local API Worker (QUTAI_TEST_API_URL, default http://localhost:8790)
```

- `profile.test.ts`: the committed `agent-profile/profile.json` and `src/credits/agentProfileId.ts` match the app's
  prompt and tools (fails after a change until `npm run profile:export`), the export is byte-for-byte stable, its shape
  is what the server accepts, and the server's wrapping of custom instructions gives the app's own text.
- `client.test.ts`: request headers and body, the stream with `qutai.settlement` / `qutai.error`, an adapter failing
  mid-stream, a stream without settlement, the JSON answer, every refusal code, the messages in English and Turkish,
  waits, token renewal, signed out, network errors, abort, the parsers.
- `provider.test.ts`: Anthropic, OpenAI and Gemini through the relay with the real adapters (what is sent, what is
  read, the charge as the cost), Gemini's non-streaming fallback and thought-signature fallback, raw output never
  replayed across own-key and credits, checks before sending, charges of failed requests, credits in the answer's
  figures, formatting.
- `tiers.test.ts`: credit-mode tiers and paused answers: `/config` tiers parsed (order, default, limits, malformed
  ones dropped), an older server's fallback, names and the approximate cost in English and Turkish, choices saved
  before tiers mapped, the tier form of the request, the `X-Qutai-*` headers, the route kept and sent back, a tier
  switch, `tier_moved` retried once (not twice) in the other format without the other provider's raw output,
  `tier_unknown` / `tier_unavailable`, an answer in the wrong format, a paused Anthropic answer continued (streamed and
  not, paused twice, each charge once), and the ways a continuation ends (none, expired, step limit,
  `continuation_invalid`, a tier move, a stop).
- `safe-area-root.test.ts`: regression for the crash when Qutai was picked during setup: App's tree starts with the
  `SafeAreaProvider`, which holds setup and the browser (dialogs read the insets from it).
- `gate.test.ts`: Qutai Credits only while signed in (`src/credits/gate.ts`) and setup's Qutai step
  (`src/credits/setupFlow.ts`): disclosure, sign-in, account; declining, cancelling and failing go back to the choice
  with a note; Qutai is never saved without an account.
- `purchases.test.ts`: buying credits (`src/purchases/`) against a fake store and the fake server's
  `POST /purchases/verify`: offers priced only by the store, credited, cancelled / pending / failed, retries after
  `Retry-After`, purchases kept and reported later, held / rejected / refunded / suspended / signed out, the client's
  request and answers; the RevenueCat adapter against a fake SDK (configured only signed in with the account id,
  `logIn` / `logOut`, non-subscription products, every error code).
- `server/relay-server.test.ts`: the account session (test sign-in), the client and the provider against the real
  Worker: `GET /config`, `GET /credits`, refusals before the provider; with no provider keys, "unavailable" and no
  charge. With `QUTAI_TEST_FAKE_PROVIDERS=1` (a server whose outgoing provider requests are answered by a fake
  provider, see below) also streamed answers from all three providers, charges and balance, unknown profile, step
  limit, memory too large, and not enough credits (test-1 needs a few credits granted beforehand, or
  `QUTAI_TEST_GRANT_URL`; test-2 none).

The server test needs `QUTAI_TEST_DEV_LOGIN_SECRET` (the server's `DEV_SIGN_IN_SECRET`, with `DEV_SIGN_IN=true`),
`seed:local` and the profile registered (README.md › Qutai Credits › Agent profile).

The server has no setting to send its provider requests elsewhere, so the fake-provider run used wrangler's own
`unstable_startWorker` with the API's real `wrangler.jsonc` and a `dev.outboundService` handler answering
`api.anthropic.com`, `api.openai.com` and `generativelanguage.googleapis.com` with small SSE answers (a script kept
outside the repository). With real keys in `.dev.vars`, `npm run test:credits:server` with
`QUTAI_TEST_FAKE_PROVIDERS=1` runs the same tests against the real providers, except that the fake's reply text is
checked: expect those three to fail on the text only.
