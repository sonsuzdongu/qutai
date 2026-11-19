# 2. AI providers and how requests reach them

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Which AI answers the assistant, how a request travels from the phone to it, where keys are kept, and the switches
that change a request (model per chat, streaming, web search, the custom endpoint).

## How it works

1. Settings › Assistant picks the provider: Anthropic (Claude), OpenAI, Google Gemini, OpenRouter (many models from one
   key), or a **custom endpoint** (the user's own OpenAI-compatible server, such as Ollama, LM Studio, vLLM or a company
   gateway). In pro mode a sixth choice appears: Qutai Credits (see [section 1](01-open-source-and-pro.md)).
2. **Own key:** the request goes from the phone straight to the provider with the user's key. Each key is kept in the
   phone's secure storage (iOS Keychain / Android Keystore through `expo-secure-store`).
3. **Qutai Credits:** the same code builds the request, but only its body is sent to Qutai's server, which picks the
   model for the chosen tier and charges credits. Before first use a notice says what passes through Qutai's server.
   Server details are in [section 34](34-credits-and-relay.md).
4. **Model per chat:** the model name under the panel's title opens a sheet; "use Gemini for this chat" sets a provider
   and model for this conversation only. Settings keeps the default. A task already running keeps its model.
5. **Streaming:** Anthropic, OpenAI and OpenRouter answers appear as they are written. Gemini does so only with
   Settings › Assistant › "Stream Gemini responses (experimental)", off by default.
6. **Web search** (Settings › Assistant › AI search, on by default): the assistant may use the provider's own search
   (Anthropic web search, OpenAI web search, Google Search for Gemini). Each search is billed to the user's key.
   OpenRouter and the custom endpoint have none; there the assistant searches in the browser.
7. **Custom endpoint:** the user enters a base address (for example `https://gateway.example/v1`), an optional key, up
   to 5 extra headers and a model, and taps "Test connection", which says what worked and what didn't (address,
   sign-in, model, tools). Pasting a Cloudflare address that is not the chat address shows a notice with the right one.
8. **Leaving mid-answer:** with an own key, if the user leaves Qutai while a request is still running, Qutai asks the
   phone to let that request finish (Android: a quiet "finishing a reply" notification, at most 3 minutes; iOS: a
   short background time), so it is not cut, sent again and billed twice.

## The rules

- **`AI-1`** Every request to any provider passes through one wrapper that records it for "What was sent to the AI" before it leaves; recording never fails a request and never reads the API key.
  Status: Default (manager or implementing session; open to change) · Why: "so nothing reaches Anthropic, OpenAI or Gemini without being logged" · Enforced: In the app: src/ai/providers.ts (recorded, PROVIDERS) · Source: ee5960d; README intro
- **`AI-2`** With an own key, requests go from the phone directly to the chosen provider; Qutai's server is not involved.
  Status: Default (manager or implementing session; open to change) · Why: the open-source build has no server ([section 1](01-open-source-and-pro.md)) · Enforced: In the app: src/ai/anthropic.ts, openai.ts, gemini.ts, openrouter.ts, custom.ts (direct wire, src/ai/wire.ts) · Source: README intro; TODO.md › Other
- **`AI-4`** The default provider is Anthropic; default models are Claude Sonnet 5.5, GPT-5.6 terra, Gemini 4 Hydrogen, OpenRouter's first recommended model; the custom endpoint has none until the user enters one.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/storage/settings.ts (DEFAULT_SETTINGS); each adapter's defaultModel
- **`AI-5`** API keys, the custom endpoint's header values and all settings are kept in the phone's secure storage, never in the database.
  Status: Default (manager or implementing session; open to change) · Why: keys are secrets; header values "can be tokens, so they are treated like the API keys" · Enforced: In the app: src/storage/settings.ts (loadSettings, saveSettings via SecureStore) · Source: src/ai/customHeaders.ts; README › Known limitations ("API keys are on the device")
- **`AI-6`** Qutai Credits never has a key in the app: only the request body goes to Qutai's server, never its headers, so no own key reaches the server and the server's key never reaches the phone.
  Status: Default (manager or implementing session; open to change) · Why: stated in 3d6b3f7 · Enforced: In the app: src/ai/providers.ts (requestTarget: empty key for qutai); src/ai/wire.ts; src/credits/provider.ts · Source: README › Qutai Credits; 3d6b3f7
- **`AI-7`** Qutai Credits can be used only while signed in and after the user accepted its notice once on this phone; signed out, a sent message stays in the field and the app offers Sign in / Use my own key / Not now.
  Status: Default (manager or implementing session; open to change) · Why: credits belong to an account · Enforced: In the app: src/ai/providers.ts (isConfigured → creditsReady); src/credits/gate.ts · Source: README › Only while signed in; 0d0c889
- **`AI-8`** In credit mode the user picks a tier (Qutai Fast, Qutai, Qutai Pro), never a provider model.
  Status: Owner, 2026-11-16 · Why: see [section 34](34-credits-and-relay.md) · Source: README › Qutai Credits › Tiers
- **`AI-9`** A conversation's own model is saved with the conversation, read when a message is sent (so a running task keeps its model) and cleared by "New chat"; it never changes the default in Settings.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/chat/Conversation.ts (model); d09f015
- **`AI-13`** Today Gemini streams only with "Stream Gemini responses (experimental)" on (off by default); a broken stream is repeated once without streaming; a refusal over a thought signature after a streamed answer is repeated once as text and turns Gemini streaming off until the app restarts.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#assistant): "decide whether streaming becomes the default for Gemini") · Why: rebuilding thought signatures from pieces "is not fully defined in the documentation"; not yet tried against the live service · Source: 632472a, f2204eb; src/ai/geminiStream.ts
- **`AI-14`** AI search is on by default and can be turned off in Settings › Assistant; when off, neither the search tool nor its instructions are sent.
  Status: Owner, date not recorded (ROADMAP.md › 5. Decisions) · Why: each search costs extra on the user's own key · Enforced: In the app: src/agent/runAgent.ts (systemPrompt adds the search part only with webSearch); each adapter adds the tool only when req.webSearch · Source: ROADMAP.md › 5. Decisions; 7cab11d
- **`AI-15`** Anthropic web search allows at most 5 searches per request, 20 in deep research.
  Status: Default (manager or implementing session; open to change) · Why: searches are billed per use · Source: src/ai/anthropic.ts (webSearchTool, max_uses); 7cab11d
- **`AI-16`** OpenRouter has no web search in Qutai; Settings shows a note.
  Status: Default (manager or implementing session; open to change) · Why: OpenRouter's search plugin "runs on every request" (billed per agent step), and its newer server tool is documented for another API only · Source: src/ai/openrouter.ts (webSearch: false)
- **`AI-17`** The custom endpoint has no web search.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/ai/custom.ts (webSearch: false)
- **`AI-18`** Sources cited by web search open in a private tab when the chat is private.
  Status: Default (manager or implementing session; open to change) · Why: a private chat must not leave traces in normal tabs · Source: 7cab11d
- **`AI-19`** Custom endpoint address: https always; plain http only to the phone's own or local network (127.x, 10.x, 172.16–31.x, 192.168.x, link-local, `localhost`, `*.local`; not 100.64/10) and only on iPhone; no user name or password, no `?query` or `#fragment` in it; a pasted `/chat/completions` and trailing slashes are removed; a path without `/v1` gets a hint.
  Status: Default (manager or implementing session; open to change) · Why: Android release builds allow no unencrypted traffic and its network settings can't name private address ranges; iOS has a local-network exception · Enforced: In the app: src/ai/customEndpoint.ts (normalizeBaseUrl, isPrivateHost); src/ai/custom.ts (ALLOW_CLEARTEXT) · Source: a74e1b5; item 30 hand-over note
- **`AI-21`** Extra headers for the custom endpoint: at most 5; names are plain HTTP names up to 100 characters and unique; values up to 1,000 plain characters; headers the app or network sets are refused; `authorization` is refused while a key is set; values are never logged and go into a backup only with the keys.
  Status: Default (manager or implementing session; open to change) · Why: e.g. `cf-aig-authorization` for a Cloudflare AI Gateway; values can be secrets · Enforced: In the app: src/ai/customHeaders.ts (MAX_CUSTOM_HEADERS, RESERVED_HEADERS, cleanCustomHeaders) · Source: 2543bc9
- **`AI-22`** The custom endpoint always gets the assistant's tools: there is no chat-only mode, and `tool_choice` is never sent.
  Status: Default (manager or implementing session; open to change) · Why: some servers reject `tool_choice` · Source: item 30 hand-over note; README › Known limitations
- **`AI-24`** "Test connection" says honestly which checks passed, failed or were not checked, and removes keys, header values and tokens from any server error it shows (at most 200 characters).
  Status: Default (manager or implementing session; open to change) · Why: a server's error text can echo secrets · Enforced: In the app: src/ai/serverError.ts (serverMessage), src/ai/customTest.ts · Source: 6b5485f
- **`AI-25`** A Cloudflare API address that is not the `…/ai/v1` chat address gets a notice with the right address; a pasted `…/ai/run/<model>` names the model in the hint but never fills it in.
  Status: Owner, 2026-11-16 (notice targets `…/ai/v1` and warns on `/run`) · Why: Cloudflare's other paths are other APIs with no chat route · Source: src/ai/cloudflare.ts (detectCloudflareApi); 6b5485f; memory note "Open questions for the owner"
- **`AI-26`** With an own key, a request still running when the user leaves Qutai is kept alive until it ends: on Android the assistant's foreground service runs in a short "finishing a reply" mode with a quiet notification; on iOS the app asks for background time. This holds even with "Keep working in the background" off, and only finishes the request already sent.
  Status: Owner, 2026-11-17 (the owner accepted the fix) · Why: the phone cut the connection while away, the app sent the request again on return, and the provider billed twice · Enforced: In the app: src/device/requestHoldLogic.ts (mayHold), src/device/requestHold.ts (whileRequestInFlight), modules/qutai-agent · Source: TODO.md › Other; 488c3e0
- **`AI-27`** Today one such hold lasts at most 3 minutes on Android.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026): "the keep-alive … holds at most 3 minutes … Longer?") · Why: very long answers can still be cut · Enforced: In the app: src/device/requestHoldLogic.ts (REQUEST_HOLD_MAX_MS); native side in modules/qutai-agent · Source: 488c3e0
- **`AI-28`** Today there is no hold for incognito conversations on Android; iOS holds them (its background time is invisible).
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026): "no keep-alive for incognito conversations on Android … OK?") · Why: the hold shows a notification, and nothing about incognito use may appear in one · Enforced: In the app: src/device/requestHoldLogic.ts (mayHold) · Source: 488c3e0
- **`AI-29`** Qutai Credits requests are never held; the server charges a re-sent step only once.
  Status: Default (manager or implementing session; open to change) · Why: each step carries a step key the server settles at 0 when re-sent · Enforced: In the app: src/device/requestHoldLogic.ts (mayHold: own key only) · Source: 6ae9cf0
- **`AI-30`** The assistant's settings tool cannot change the provider, model, keys, custom endpoint, its headers or web search.
  Status: Default (manager or implementing session; open to change) · Why: "they handle the user's secrets and where their conversations are sent"; web search "is billed to the user's API key" · Enforced: In the app: src/agent/settingsTool.ts (CHANGEABLE) · Source: febcdb4
- **`AI-31`** Gemini's search suggestions box is shown under the answer; Anthropic and OpenAI citations are shown as tappable source cards.
  Status: Default (manager or implementing session; open to change); legal check pending (TODO.md › Other) · Why: the providers' terms require showing them · Source: e7e8aeb; TODO.md › Other

## Details

**Provider list**

- (was `AI-3`) The providers, in this order: Anthropic, OpenAI, Gemini, OpenRouter, custom endpoint; Qutai Credits sixth, only in pro mode with a server address. · Where: src/ai/providers.ts (PROVIDER_ORDER); d1223b4, 821b40d, a74e1b5
- (was `AI-20`) The custom endpoint's key is optional; it is ready once it has an address and a model. · Why: local servers often need no key · Where: src/ai/providers.ts (isConfigured)
- (was `AI-23`) Whether the custom endpoint's model takes images is set by "Test connection" and can be changed by the user; without image input, a message with images stays in the field and the chat says why. · Where: src/storage/settings.ts (customImages); README › Attachments

**Reasoning data, streaming and retries**

- (was `AI-10`) The provider's own reasoning data (Claude's thinking, OpenAI's encrypted reasoning, Gemini's thought signatures, OpenRouter's reasoning details) is kept with each answer and sent back unchanged only to the same provider and model; after a switch the history is rebuilt from text and tool calls. · Why: the providers expect their reasoning back unchanged · Where: README › How does it work?
- (was `AI-11`) OpenRouter: a request refused (400) while it sends reasoning details back is repeated once with those turns rebuilt from text. · Why: reasoning details are not checked against every model family behind OpenRouter · Where: README › How does it work?; 821b40d
- (was `AI-12`) Anthropic, OpenAI and OpenRouter answers always stream; a request is retried only if it was cut before the first piece arrived; OpenRouter repeats a broken stream once without streaming (not after a lost connection or an HTTP error). · Why: a retry after text was shown "would repeat" it · Where: 632472a; README › How does it work?

## Why it is designed this way

Keys stay on the phone and requests go straight to the provider so that the open-source build needs no server. The
README says plainly that this is "fine for personal use" and that distribution needs a server that holds the keys;
Qutai Credits is that server in pro mode, and it is built so an own key can never reach it.

## Limits and what is not built

- Providers' native PDF input is not used; PDFs are read as text on the phone ([section 15](15-tools-and-phone-actions.md)).
- No per-model history budget: old page contents are trimmed by count for every model; OpenRouter's context length is only shown in the picker.
- A strict custom server may want a string instead of an empty content on tool-call turns.
- On Android the custom endpoint must be https, including on the local network.
- End-to-end tests with real keys on every provider and a local server are still to do (TODO.md › Other).
- Open owner question: the exact path of the Cloudflare address the owner pasted.

## Where it lives

- `src/ai/providers.ts`, `anthropic.ts`, `openai.ts`, `gemini.ts`, `geminiStream.ts`, `openrouter.ts`, `openrouterCatalog.ts`, `chatWire.ts`, `chatCompletions.ts`, `custom.ts`, `customEndpoint.ts`, `customHeaders.ts`, `customTest.ts`, `cloudflare.ts`, `serverError.ts`, `wire.ts`, `http.ts`
- `src/credits/` (Qutai Credits), `src/device/requestHold.ts`, `requestHoldLogic.ts`
- `src/chat/Conversation.ts`, `src/components/ModelSheet.tsx`, `AiProviderFields.tsx`, `CustomEndpointFields.tsx`
- README › How does it work?, › Qutai Credits (pro mode); backend/README.md › Relay

## Disagreements between sources

- No source says why AI keys use the secure store's default protection, while the account session, the backup password and the script key are stored "this device only" (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). On iOS this may let keys travel in encrypted device backups. The code stores keys with the default.
