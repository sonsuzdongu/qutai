# Working mode: where the assistant acts and what it is doing

While a task runs the user should see **where** on the page the assistant acts and **read** what it is doing,
whether the panel was open (typed task) or closed (voice from the Q logo, a saved task's reminder). Three pieces,
all drawn by the app above the WebView; nothing is injected into the page's DOM and nothing is added to what is sent
to the AI or stored.

## Layers (bottom to top)

| Layer | What | Where in the tree | Touches |
| --- | --- | --- | --- |
| 1. Tabs | the WebViews (`BrowserView`) | inside the safe area, under/over the address bar | page's |
| 2. Action marker | ring / field frame / scroll trace / read sweep | `ActionMarkerLayer`, root of the browser screen, absolute | none |
| 3. Panel | `AssistantPanel` (slides in from the right) | root | its own |
| 4. Glow | aurora edge light (`WorkingGlow`), screen level | root, after the panel | none |
| 5. Step strip / answer card | `StepStrip` | root, after the glow | strip only |
| 6. Dialogs | approvals, questions (`DialogHost`, a Modal) | own window | modal |

An approval is a Modal (layer 6), so it is never behind the strip; the strip also expands into the panel while one
waits. The marker and the glow live outside the tab's container, so the assistant's screenshots
(`device/screenshot.ts` captures the container) never contain them.

## 1. Action marker ("where")

`src/agent/actionMarker.ts` is called by `executeTool` just before `click`, `type`, `select_option`, `click_at`,
`scroll`, `scroll_to` and `read_page`. For a ref it runs the page command `actionRect` (page script), which:

- scrolls the element into view exactly as the action itself will (`scrollIntoView({block:'center'...})`,
  `behavior:'instant'`), so the later action's own scroll is a no-op and the ring does not jump;
- returns the element's box as fractions of the **visual viewport** after adding the offsets of every same-origin
  frame it sits in (`frameElement` chain). Fractions of the visual viewport are pinch-zoom and scroll safe: the
  visual viewport is exactly what the WebView view shows.

`src/agent/markerGeometry.ts` (pure, tested) maps those fractions onto the tab container's rectangle measured with
`measureInWindow`, minus the marker layer's own window origin. That covers the address bar at the top or the bottom,
the keyboard, the safe areas and the status bar. Boxes larger than the view are clipped to it; boxes outside it are
dropped (no marker, no dwell).

`click_at` already has its point (fractions of the screenshot = of the visual viewport): the ring is drawn there,
which also works over cross-origin iframes. Elements inside cross-origin iframes have no refs, so nothing else is
needed there.

The marker shows and then the action waits `MARKER_DWELL_MS` (320 ms, one constant) before it runs: click → ring
with a ripple; type / select → the field framed; scroll → a short trace in the scroll direction at the right edge
(no dwell); scroll_to → the element framed after the scroll (no dwell); read_page → one faint sweep down the page
(no dwell).

No marker and no dwell when: the setting "Show where the assistant acts" is off, the app is not in the foreground
(background runs), the agent's tab is not the one on screen, the panel is open over the page, reader mode / new tab
page, or the rectangle can't be found (the step then runs as before and reports its own error).

## 2. Step strip ("what")

One floating line at the bottom (above a bottom address bar): activity mark · current step line · Stop.
The line is the latest chat step line of the running conversation (`describeToolCall` / `stepLine`, already in the
user's language), never tool text; before the first step "Thinking…", while the answer is written "Writing the
answer…". A coalescer (`src/chat/stripLine.ts`, pure) keeps each line at least `MIN_LINE_MS` (900 ms) on screen
and skips lines that were replaced in the meantime, so fast steps don't flicker. When the agent works in a tab that
is not on screen the strip says so and offers "Show".

### Panel ↔ strip state machine (`src/chat/workingView.ts`, pure, tested)

State: `{ phase: 'idle' | 'working' | 'asking' , panel: boolean, pinned: boolean, autoOpened: boolean,
origin: 'panel' | 'closed' }`.

```
idle ──task starts (panel open)──▶ working, panel=false        (panel drops into the strip)
idle ──task starts (panel closed)─▶ working, panel=false        (strip appears alone)
working ──user opens panel (tap strip, Q button)──▶ pinned=true, panel=true   (stays open until the end)
working ──user closes panel──▶ pinned=false, panel=false (strip)
working ──approval / question waits──▶ asking, panel=true, autoOpened=!pinned&&!panel
asking ──answered──▶ working, panel = pinned || !autoOpened
working|asking ──task ends──▶ idle and:
   stopped by the user ............ nothing opens (strip goes)
   failed / needs an answer ....... panel opens
   done, origin panel ............. panel opens
   done, origin closed (voice) .... answer card (the answer's text, "Open chat", close)
```

With a screen reader on, a task started from the open panel doesn't collapse (focus would be lost); the strip is
still used when the panel was closed. The strip's line is announced politely (live region on Android,
`announceForAccessibilityWithOptions(queue)` on iOS); focus never moves to it.

## 3. Glow

The glow moves from `BrowserView` (page only, agent tab only) to screen level: shown while a task runs and the app
is in the foreground, except while the user answers a dialog. It is a Skia runtime shader (`AURORA` family, already
used by `src/ui/Aurora.tsx`) drawn in four thin edge canvases only (not a full-screen layer), animated by a
Reanimated frame clock on the UI thread (no JS per frame): slow drifting bands of blue with a little teal and violet,
following rounded screen corners, alpha fading to 0 within ~36 dp. Reduce motion: the same shader with a fixed time,
no clock (static soft frame).

## 3a. Trial looks (to be settled before launch)

Settings › Assistant › "Asistan görünümü (deneme)" (`assistantLook`, `src/ui/assistantLook.ts`; not translated, not in
the assistant's `settings` tool) switches listening and working between today's look and two trials drawn in
`src/components/AssistantGlass.tsx`, so they can be compared on real phones. The default is `curtain` (the owner's choice on 2026-11-17); the other two
and the switch stay until the looks are settled.

| Look | Listening (Q held) | Working |
| --- | --- | --- |
| `classic` | dark bubble next to the button | aurora glow around the screen, plain strip |
| `band` | a glass sheet attached to the bar's page-side edge, full width, the words at 20 pt in it; aurora smoke inside, a bright line on its free edge that swells with the voice | glass strip with a thread of light around it, glass answer card, no screen glow |
| `curtain` | the page dims from the bar's edge (dark scrim, no blur) and rays of light rise with the voice; the words in white at 24 pt | a line of light travelling around the screen edge (four thin edge canvases), plain strip |

Blur: on iOS the glass is the system material (`expo-blur`, a `UIVisualEffectView`, which blurs a web page behind it).
On Android `expo-blur` only blurs the content of a `BlurTargetView`, which would mean wrapping the tabs, and whether a
WebView's and a video's pixels come through is untested; so Android's glass is a 95 % tint with the aurora on it (text
never sits on the page). `curtain` never blurs and is identical on both. Bubbles with buttons (busy, a screen reader's
Send / Cancel) stay the classic bubble in every look. The marker and the approval dialog are unchanged so far.

## 4. Settings and accessibility

- Settings › Assistant › "Show where the assistant acts" (`showActionMarker`, on): off = no marker and no dwell.
  No second switch for the auto-collapse: the user's own open/close always wins for the rest of the task, and
  screen-reader users keep the panel (see above).
- Not added to the assistant's `settings` tool: its keys are listed in the tool description, so it would change the
  agent profile.
- Reduce motion: no ripple, no slide, no sweep; static ring/frame; strip and panel swap instantly.
- Large text: the strip's line wraps to two lines (whole words) and the strip grows.

## Not covered

- Cross-origin iframes: only `click_at` points (no refs exist inside them).
- PDF viewer, reader mode (actions leave reader mode first; read_page in reader mode shows no sweep), the new tab
  page and app screens: no marker.
- Background runs (Android "keep working"): nothing is drawn, no dwell.
- A page that moves the element right after it was measured (animations, late layout) shows the ring where the
  element was 320 ms earlier.
