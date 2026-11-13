# Claude Browser (mobile)

A prototype of the "Claude in Chrome" idea for iOS and Android: a built-in browser and a Claude agent that can read
and use the page for you.

## Running

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone. All the native modules used (`react-native-webview`,
`expo-secure-store`) come bundled with Expo Go. Once the app opens, enter your Anthropic API key via the ⚙︎ icon.

## How does it work?

```
User ──► ChatPanel ──► runAgent ──► Claude Messages API (tool use)
                                │
                                ▼ tool call
                           executeTool ──► Browser ► Tab ──injectJavaScript──► WebView
                                ▲                                                    │
                                └──────────── onMessage (result) ◄─────────── pageScript (window.__claudeAgent)
```

| File | Role |
|---|---|
| `src/browser/pageScript.ts` | JS injected into the page: converts the DOM to text, gives elements a `ref` number, clicks and types |
| `src/browser/Tab.ts` | A single tab: sends commands to the WebView, matches responses, waits for page loads |
| `src/browser/Browser.ts` | Tab manager (open, close, switch) and change notifications to React |
| `src/components/BrowserView.tsx` | Draws the WebViews of all tabs stacked on top of each other; hidden tabs keep running |
| `src/agent/tools.ts` | Tools exposed to Claude (`read_page`, `click`, `type`, `navigate`, `open_tab`…) |
| `src/utils/foreground.ts` | Pauses the agent when the app goes to the background, resumes it when it comes back to the foreground |
| `src/agent/executeTool.ts` | Runs tool calls in the browser, asks for user confirmation if enabled |
| `src/agent/runAgent.ts` | Agent loop, retries and trimming of old page snapshots |
| `src/agent/systemPrompt.ts` | Behavior and safety rules |

## Known limitations / next steps

- **No screenshots.** For now the agent only sees the DOM text. It struggles with canvas, maps and image-heavy
  sites. Next step: a screenshot tool and clicking by coordinates.
- **The API key is on the device.** Fine for personal use. Distribution requires a backend proxy that holds the key.
- **Does not run in the background.** iOS and Android freeze the app within a few seconds in the background, and the
  WebView stops too. The task pauses and resumes where it left off when the app comes back to the foreground.
- **Tabs consume memory.** Each tab stays open as a separate WebView. If many tabs are open, the system may close the
  app on older Android devices.
- **Cross-origin iframes** (e.g. payment forms, some captchas) cannot be read.
- **Prompt injection** is a risk. The system prompt marks page content as untrusted data and asks for confirmation
  for sensitive actions. The "Ask before every action" option in Settings provides extra protection.
