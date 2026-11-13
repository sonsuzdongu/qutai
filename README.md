# ALPAI

An AI-powered mobile browser for iOS and Android: an agent that can read and use the page for you,
tabs and private mode. Works with Anthropic (Claude), OpenAI and Google Gemini models.

The UI is in Turkish and English; it matches the device language (English by default). Strings live under `src/i18n/`.

From the page menu (⋮) and by asking the agent: save the page as PDF, save a screenshot to Photos,
read the page aloud, share/copy the link. When needed, the agent can also look at a screenshot of the page.

## Running

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone. All the native modules used come bundled with Expo Go.

Open the panel with the ✦ button in the top bar, then pick a provider via the ⚙︎ icon and enter your API key:

| Provider | API | Key |
|---|---|---|
| Anthropic | Messages API | https://platform.claude.com/settings/keys |
| OpenAI | Responses API | https://platform.openai.com/api-keys |
| Google Gemini | Interactions API | https://aistudio.google.com/apikey |

## How does it work?

```
User ──► AssistantPanel ──► runAgent ──► provider adapter ──► Anthropic / OpenAI / Gemini
                                     │
                                     ▼ tool call
                                executeTool ──► Browser ► Tab ──injectJavaScript──► WebView
                                     ▲                                                  │
                                     └────────── onMessage (result) ◄────────── pageScript (window.__alpaiAgent)
```

| File | Role |
|---|---|
| `src/browser/pageScript.ts` | JS injected into the page: converts the DOM to text, gives elements a `ref` number, clicks and types |
| `src/browser/Tab.ts` | A single tab: sends commands to the WebView, matches responses, waits for page loads |
| `src/browser/Browser.ts` | Tab manager (open, close, switch, private tabs) and change notifications to React |
| `src/components/BrowserView.tsx` | Draws the WebViews of all tabs stacked on top of each other; hidden tabs keep running |
| `src/ai/` | Provider-independent conversation model and the Anthropic, OpenAI, Gemini adapters |
| `src/device/` | Device features: PDF, screenshot, read aloud, share/copy, private mode protection |
| `src/agent/tools.ts` | Tools exposed to the model (`read_page`, `click`, `type`, `navigate`, `open_tab`, `view_screenshot`, `save_pdf`, `read_aloud`…) |
| `src/agent/executeTool.ts` | Runs tool calls in the browser, asks for user confirmation if enabled |
| `src/agent/runAgent.ts` | Agent loop and trimming of old page outputs |
| `src/agent/systemPrompt.ts` | Behavior and safety rules |
| `src/utils/foreground.ts` | Pauses the agent when the app goes to the background, resumes it when it comes back to the foreground |

Along with each assistant response, the provider's raw output is also stored (Claude's thinking blocks, OpenAI's
encrypted reasoning content, Gemini's thought signatures) and sent back unchanged to the same model. If the
provider or model changes mid-chat, the history is rebuilt from the text and tool calls.

## Known limitations / next steps

- **Private mode is not fully isolated on Android.** The `incognito` prop of `react-native-webview` is not used because
  on Android it deletes all cookies; private tabs share cookies with normal tabs. Real isolation requires the
  Android WebView profile API (development build). On iOS, each private tab uses its own separate, non-persistent data
  store.
- **The agent can see the screen but cannot click by coordinates.** It can look at the page with `view_screenshot`, but
  clicking only works through DOM elements (`ref`); it cannot click elements inside a canvas or map. The screenshot
  covers only the visible area.
- **The PDF is generated from a snapshot.** On very dynamic pages (content drawn by scripts) the PDF may look different
  from what is on screen.
- **The agent is deliberately not given a tool for writing to the clipboard.** Only the user copies.
- **API keys are on the device.** Fine for personal use. Distribution requires a backend proxy that holds the keys.
- **Model quality varies.** Browser tasks are multi-step; small models may click the wrong element.
- **Old page outputs are trimmed.** This lowers cost, but on OpenAI previous reasoning items may not be reused
  because the history changes.
- **Does not run in the background.** iOS and Android freeze the app in the background. The task pauses and resumes
  where it left off when the app comes back to the foreground.
- **Tabs consume memory.** Each tab stays open as a separate WebView.
- **Cross-origin iframes** (e.g. payment forms, some captchas) cannot be read.
- **Prompt injection** is a risk. The system prompt marks page content as untrusted data and asks for confirmation
  for sensitive actions. The "Ask before every action" option in Settings provides extra protection.
