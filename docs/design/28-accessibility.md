# 28. Accessibility

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

How Qutai works with screen readers (TalkBack, VoiceOver), the system's Reduce motion setting, large text, and page zoom.

## How it works

1. **Screen readers.** Every button and tappable row says it is a button. When a task starts the reader says "Qutai is working…" once; when it ends, "Qutai finished the task"; when the assistant offers choices, the question is read. While the panel is open VoiceOver's focus stays in it. The step strip's line is announced politely, without moving focus.
2. **Holding gestures** are replaced by actions: the Qutai button offers "Start voice message", then "Send" and "Cancel".
3. **Reduce motion** (the phone's setting): the panel opens without sliding, the loading bar stands still, the logo doesn't sparkle, the working glow is a still frame, the action marker has no ripple, dialogs appear without fading, the launch mark is skipped.
4. **Text size.** Settings › Appearance › Text size (or the page menu): A− / percentage / A+, 50% to 200%, applied to every tab at once. Chat and page text follow the phone's font size without limit; the address bar and headers stop growing at 1.4×; one-line fields grow instead of cutting letters.
5. **Reader mode** has an "easier reading" option with wider spacing, serif or sans text, and light, dark or sepia colours.
6. **Force zoom** (Settings › Appearance, off): lets the user pinch-zoom pages that forbid zooming, like Chrome's accessibility option.

## The rules

- **`A11Y-1`** Every tappable element with a label or text announces itself as a button.
  Status: Default (manager or implementing session; open to change) · Why: 64 buttons were read without "button" · Source: 0d9c2f4
- **`A11Y-2`** Screen readers hear when a task ends and the question when the assistant offers options; "Qutai is working…" is said once at the start.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: ab4f883, 2a90ca9
- **`A11Y-5`** Every hold gesture has a screen-reader alternative (push-to-talk actions Start / Send / Cancel; the panel's microphone is tap-only; the download pill has a "Hide" action).
  Status: Default (manager or implementing session; open to change) · Why: holds and swipes don't work with screen-reader gestures · Source: README › Push-to-talk; 21d43e3
- **`A11Y-6`** Reduce motion is honoured wherever something moves: panel, loading bar, logo, glow (still frame), marker (no ripple, slide or sweep), strip (instant swap), dialogs, the Qutai button tour (no pulse) and the launch mark.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: ab4f883, a2c10d7, 02f97c3; docs/working-mode.md › 4
- **`A11Y-7`** Text size runs from 50% to 200% in steps of 10 (default 100%), applies to all tabs at once and is saved; the assistant may change it when asked.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 51b0e45; src/storage/settings.ts (DEFAULT_SETTINGS); src/agent/settingsTool.ts (CHANGEABLE)
- **`A11Y-9`** Page and chat text scale with the phone's font size without limit; the fixed-height address bar and screen headers stop at 1.4×.
  Status: Default (manager or implementing session; open to change) · Why: the bar would overflow at very large sizes · Source: ab4f883; 015b930
- **`A11Y-12`** Force zoom is off by default; when on, it removes a page's zoom limits so the user can pinch-zoom up to 10×.
  Status: Default (manager or implementing session; open to change) · Why: requested in Comet reviews · Source: ROADMAP.md › Phase 3.5; src/browser/forceZoom.ts (FORCE_ZOOM_SCRIPT)
- **`A11Y-13`** Reader mode's "easier reading" is off by default; reader colours have measured contrast and use the shared text size times the phone's font size.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 6336779; src/storage/settings.ts (DEFAULT_SETTINGS)

## Details

**Screen readers**

- (was `A11Y-3`) While the panel is open, VoiceOver's focus stays inside it. · Where: ab4f883
- (was `A11Y-4`) With a screen reader on, a task started from the open panel doesn't collapse into the step strip; the strip's line is announced politely and focus never moves to it. · Why: focus would be lost · Where: docs/working-mode.md › Panel ↔ strip state machine

**Text size and touch targets**

- (was `A11Y-8`) Android sets the page text size with the WebView's text zoom; iOS, which has none, injects a CSS text-size rule while the page loads and when the setting changes. · Why: iOS has no text zoom setting · Where: 51b0e45
- (was `A11Y-10`) One-line text fields keep their height as a minimum and grow with large text. · Why: at 2× the server address, key, model, password and search fields cut their letters · Where: 7166dc6
- (was `A11Y-11`) Header buttons and dialog buttons have 44 pt touch targets. · Where: a2c10d7; 015b930

## Limits and what is not built

- Accessibility is reviewed in code only; no screen-reader test on a device yet (ROADMAP marks it partial).
- The ten languages at the largest text size on a narrow phone are not checked yet.
- On Android, React Native reads Reduce motion from the animation-scale setting (`transition_animation_scale`), not a separate switch.

## Where it lives

- `src/utils/useReduceMotion.ts`, `src/components/ScreenHeader.tsx`, `src/components/PushToTalk.tsx`, `src/components/StepStrip.tsx`
- `src/browser/forceZoom.ts`, `src/browser/reader.ts`, the text size sheet
- [TODO.md](../../TODO.md) › To try on the phone › Appearance and accessibility
