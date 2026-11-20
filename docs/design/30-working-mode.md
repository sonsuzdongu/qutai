# 30. Working mode

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

What the user sees while the assistant carries out a task: where on the page it acts, what it is doing right now, and that the input is closed until it finishes.

## How it works

1. **Marker ("where").** Just before the assistant taps, types or picks an option, the element scrolls into view and a blue ring with a ripple (tap) or a frame (typing, choosing) appears on it for 320 ms; then the action happens. Scrolling shows a short trace at the right edge; reading the page shows one faint sweep (no wait for these).
2. **Step strip ("what").** One line floats at the bottom (above a bottom address bar): an activity mark, the current step in the user's language ("Tapping the “Add to cart” button", "“Sepete ekle” düğmesine dokunuluyor") and Stop. Before the first step "Thinking…", at the end "Writing the answer…". If the assistant works in another tab: "In another tab" with Show.
3. **Panel and strip.** A task typed in the open panel: the panel drops away and the strip rises, so the user can watch the page. Tap the strip (or the Q button) to open the panel; it then stays open until the end. An approval or question opens the panel behind the dialog and drops back after the answer. At the end: stopped by the user → nothing opens; failed → the panel opens; needs an answer → a short question (2 to 4 short options) is asked over the page in a bubble with its buttons, "Open chat" and close, and a longer one opens the panel (`WORK-17`); finished from the panel → the panel opens; finished from voice with the panel closed → an answer card with the answer, "Open chat" and close.
4. **Glow.** While a task runs and Qutai is on screen, a light moves around the screen's edge (look "curtain"); it is off while a dialog waits and still under Reduce motion.
5. **Input closed.** During the whole task the panel's message field is dimmed and read-only ("Qutai is working…"); attach, the microphone and one-tap chips are disabled; Stop replaces Send. Text already typed stays, to send afterwards. Holding the Qutai button during a task records nothing.
6. Settings › Assistant › "Show where the assistant acts" (on) turns the marker off.

## The rules

- **`WORK-1`** The marker, strip and glow are drawn by the app above the page; nothing is injected into the page, sent to the AI or stored for them.
  Status: Default (manager or implementing session; open to change) · Why: the page and the AI's view stay untouched · Enforced: In the app: src/agent/actionMarker.ts, src/components/StepStrip.tsx, src/components/WorkingGlow.tsx (app layers, not page script) · Source: docs/working-mode.md (introduction)
- **`WORK-2`** The marker and glow live outside the tab's container, so the assistant's screenshots never contain them, and they take no touches.
  Status: Default (manager or implementing session; open to change) · Why: screenshots capture the tab container · Enforced: In the app: src/device/screenshot.ts captures only the tab container · Source: docs/working-mode.md › Layers
- **`WORK-3`** Before a tap, typing, choosing or a tap by position, the marker shows and the action waits 320 ms; scrolling and page reads show a mark without waiting.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded (so the user sees where the action lands) · Source: d83b3ef; src/agent/markerGeometry.ts (MARKER_DWELL_MS)
- **`WORK-5`** "Show where the assistant acts" is on by default.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/storage/settings.ts (DEFAULT_SETTINGS); docs/working-mode.md › 4
- **`WORK-6`** Today "Show where the assistant acts" cannot be changed by the assistant from the chat.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: the settings tool's keys are listed in its description, so adding one changes the agent profile · Enforced: In the app: src/agent/settingsTool.ts (CHANGEABLE) · Source: docs/working-mode.md › 4
- **`WORK-7`** The strip's line is the chat's step line in the user's language, naming the element by what the page calls it and its kind and a tab by its title, never the model's internal reference ("ref 1"); what the AI receives is unchanged.
  Status: Owner, 2026-11-18 · Why: "ref 1" meant nothing to the user (O3 in the performance report) · Source: TODO.md › Assistant (Open decisions from the November performance pass); ba63602; src/agent/stepTarget.ts
- **`WORK-9`** The panel and strip follow one state machine: a task drops the panel into the strip; the user's own open or close wins for the rest of the task; a waiting approval or question opens the panel; the end opens the panel, nothing, the answer card or the question bubble (`WORK-17`) as described in "How it works". Changed 20 Nov 2026 (the question bubble).
  Status: Default (manager or implementing session; open to change) · Why: no second switch for auto-collapse; the user's own choice always wins · Source: docs/working-mode.md › Panel ↔ strip state machine; src/chat/workingView.ts (workingStep)
- **`WORK-10`** Approvals and questions are dialogs above the strip and the glow, never behind them.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/working-mode.md › Layers
- **`WORK-12`** The panel's input is closed for the whole task, including while an approval waits: read-only, dimmed, "Qutai is working…", with Stop; nothing typed or said during a task is queued or passed to the running task.
  Status: Default (manager or implementing session; open to change) · Why: a message can't be sent before the task ends; the field looked open while an approval waited · Enforced: In the app: src/components/AssistantPanel.tsx (busy, editable) and App.tsx (send returns while running) · Source: 2a90ca9, af24ab6
- **`WORK-15`** When Qutai leaves the screen during a task, a "paused" notification is scheduled 8 s later and cancelled if the user returns or the task ends.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 8f13cd0
- **`WORK-16`** Today the scroll step's line shows the English direction word ("Scrolling: down").
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: listed as "a small translation fix, not a decision" · Source: TODO.md › Interface; src/agent/executeTool.ts (action.scroll)
- **`WORK-17`** A task that ends with a question (`ask_user`) while the panel is closed asks it over the page, in a bubble like the answer card, when it fits: the question at most 140 characters as plain text (no list, table, link, code or second paragraph), 2 to 4 options of at most 28 characters and 84 in all, the limits shrinking with larger text. A tapped option answers and the task goes on in the strip with the panel closed; "Open chat" opens the panel (to type another answer); the close button leaves the question in the chat. A longer question, or a panel the user kept open, keeps today's behaviour (the panel). A screen reader keeps the panel open during tasks, so it gets the panel. The `ask_user` tool asks for "one short sentence" so more questions fit.
  Status: Owner, 2026-11-20 (asked for short questions over the page without opening the panel); the limits are Default · Why: "eğer sorduğu metin ve bu butonlar paneli açmadan ana ekranda bir bubble'da gösterilebilecek seviyede ise panel açmadan da gösterebiliriz… daha güzel bir deneyim sunar" · Enforced: In the app: src/chat/questionBubble.ts (questionFitsBubble), src/chat/workingView.ts (question, dismissQuestion), src/components/StepStrip.tsx (QuestionCard), App.tsx (send with closed) · Tests: scripts/assistant-tests/workingMode.test.ts

## Details

**Marker**

- (was `WORK-4`) No marker and no wait when the setting is off, Qutai is in the background, the agent's tab is not on screen, the panel covers the page, in reader mode or on the new tab page, or when the element can't be found. · Where: docs/working-mode.md › 1

**Step strip**

- (was `WORK-8`) Each strip line stays at least 900 ms; lines replaced in the meantime are skipped. · Why: fast steps would flicker · Where: src/chat/stripLine.ts (MIN_LINE_MS)

**Glow**

- (was `WORK-11`) The glow covers the whole screen's edge only while a task runs and Qutai is in the foreground, and is off while the user answers a dialog; it is drawn in four thin edge strips by a shader on the UI thread (no JavaScript per frame), compiled the first time it shows. · Why: cheap to draw; compiling at start-up cost time before the first frame · Where: docs/working-mode.md › 3; d83b3ef, 820af68

**Restatements and background runs**

- (was `WORK-13`) Holding the Qutai button during a task records nothing; the bubble says Qutai is busy and offers Open. · Why: same as WORK-12 · Where: README › Push-to-talk
- (was `WORK-14`) Runs in the background (Android "Keep working in the background") draw nothing and have no wait. · Why: nothing is on screen · Where: docs/working-mode.md › Not covered

## Limits and what is not built

- Inside frames from other sites only taps by position get a marker.
- PDF viewer, reader mode, the new tab page and Qutai's own screens: no marker.
- An element that moves right after it was measured shows the ring where it was 320 ms earlier.
- Not checked on an Android screen yet; the checklist is in [docs/test-checklist.md](../../docs/test-checklist.md) § 13.

## Where it lives

- [docs/working-mode.md](../../docs/working-mode.md)
- `src/agent/actionMarker.ts`, `markerGeometry.ts`, `stepTarget.ts`; `src/chat/stripLine.ts`, `workingView.ts`
- `src/components/StepStrip.tsx`, `WorkingGlow.tsx`, `AssistantGlass.tsx`, `AssistantPanel.tsx`
- Tests: `scripts/assistant-tests/workingMode.test.ts`

## Disagreements between sources

- docs/test-checklist.md § 5 still describes the older per-tab glow.
