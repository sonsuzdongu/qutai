# Landscape

Qutai turns with the device, following the system's auto-rotate setting (Android) and the rotation lock in
Control Center (iOS). Phones: portrait and both landscapes, never upside down. Tablets: all four.

## What was there (survey, 2026-11-17)

- `app.json` had `"orientation": "portrait"`: Android `screenOrientation="portrait"` on the main activity, iOS
  `UISupportedInterfaceOrientations` portrait only (iPad too, so no Split View / Stage Manager resizing).
- No `expo-screen-orientation`. The main activity already handles `orientation|screenSize|screenLayout`
  itself (Expo's default plus `plugins/withPictureInPicture.js`), so turning the phone does not recreate it:
  tabs, WebViews, scroll positions, the running task and open dialogs stay as they are.
- No module-level `Dimensions.get`. Sizes come from `useWindowDimensions` (panel, tab switcher, dialogs, glow,
  intro, push-to-talk) or from layout. One event-time read: `useKeyboardHeight` measures the keyboard against the
  window height when the keyboard moves, so a turn with the keyboard open kept the old height.
- 24 React Native `Modal`s, all with the iOS default `supportedOrientations={['portrait']}`. Opened in landscape,
  an iOS modal forces the app back to portrait. One (`AttachmentViews`) already allowed landscape.
- Bottom sheets already scroll, keep clear of a side notch and stay 560 pt wide; full-screen lists centre at
  680 pt (`ff0b7b4`). The address bar is 48 pt high. The page fills what is left in a `SafeAreaView` with all
  four edges, so it sits between the side cut-outs.
- Assistant panel: a side panel from the trailing edge, 88 % of the width up to 420 pt, over a dimmed page.
- Tab switcher: always two columns, previews 1.25 × the card's width (portrait shaped).
- Step strip and answer card: 12 pt from the screen's sides (ignoring a side notch); the answer card up to 360 pt
  high, which is the whole height of a 360 dp phone on its side.
- Action marker: positions are measured (page frame, element box) just before each step, so a turn between steps
  is fine. Two gaps: a marker on screen during the turn stays at its old place for up to a second, and `click_at`
  uses the fractions of a screenshot taken before the turn, so it would click a different spot.
- QR scanner: a 240 pt frame, a hint and a Close button 48 pt from the bottom overlap on a 360 dp tall screen.

## Decisions

- **Native**: `orientation: "default"` (Android `screenOrientation="unspecified"`: the system decides and follows
  auto-rotate; phones leave out upside-down unless the maker allows it, tablets turn all ways). A config plugin
  (`plugins/withOrientations.js`) writes the iOS lists: iPhone portrait + both landscapes, iPad all four (needed for
  iPad multitasking, where the window can be any size, so layout follows the window's size, never "orientation").
- **Every Modal** goes through `src/ui/AppModal.tsx`, which allows all orientations (the Info.plist still limits
  it). A test keeps `Modal` from being imported from `react-native` anywhere else.
- **Assistant panel in landscape: the trailing side panel stays, at about half the width** (320–420 pt; 420 on
  tablets). Why not a lower sheet: a phone on its side has ~330 pt of height, so a sheet would leave a sliver of
  page and of conversation; a side panel keeps the full height for the conversation and the input, and the page's
  left half stays in view beside it (dimmed, tap to close, as in portrait). The header is 44 pt instead of 56 pt
  when the window is short. Android's full-screen landscape keyboard ("extract" mode) is turned off for the
  panel's input, the address bar and the find bar, so the conversation and the page stay in view while typing;
  the panel's `KeyboardAvoidingContainer` keeps the input above the keyboard.
- **Step strip and answer card** keep clear of side notches; the answer card is at most half the window's height
  (360 pt cap as before). The glow already redraws from `useWindowDimensions`.
- **Marker**: the layer clears its marker when its size changes. A `click_at` after the window changed size since
  the screenshot is refused with a tool result asking for a new screenshot (no change to the prompt or the tool
  definitions; `npm run profile:check` stays the same).
- **Keyboard**: `useKeyboardHeight` measures again when the window changes size.
- **Tab switcher**: columns by width (2 below 600 pt, 3 below 900, else 4); preview shape follows the window's
  shape (thumbnails are captured at the page's shape).
- **QR scanner**: frame at most half the short side; Close button lower on short screens.
- **No "lock to portrait" setting.** Both systems already have a one-tap rotation lock that every app follows,
  and an in-app lock needs `expo-screen-orientation` (another native module) and, from iOS 27 / Android 16 on
  large screens, cannot lock anyway. Revisit if users ask for it.

## Pure parts and tests

`src/ui/layout.ts` holds the decisions (window class, panel width, compact header, tab columns, preview ratio,
answer card height, QR frame, stale screenshot); `npm run test:layout` tests them and the Modal rule.

## Checks on a device

See the commit message / report for what was run where. Owner's checklist on the phone:

1. Page loading, turn the phone: page fills the width between the cut-outs, address bar stays, page keeps its place.
2. Open the panel in landscape, type a message: panel on the right half, input above the keyboard.
3. Start a task, turn the phone mid-task: strip and glow follow, the marker shows on the right spot at the next step.
4. Settings, a sub-screen, the tab switcher (3 columns), the QR scanner, a bottom sheet and a dialog in landscape.
5. A video full screen, turned both ways; picture-in-picture from landscape.
6. iPad: Split View / Stage Manager at a narrow size; the app follows the window.
