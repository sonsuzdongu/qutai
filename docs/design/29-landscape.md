# 29. Landscape

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

How Qutai behaves when the phone or tablet is turned on its side.

## How it works

1. Qutai turns with the device, following Android's auto-rotate and the rotation lock in iOS's Control Center. Phones: upright and both sideways positions, never upside down. Tablets: all four, and iPad Split View / Stage Manager at any window size.
2. Turning the phone keeps everything as it was: tabs, pages, scroll positions, a running task and open dialogs.
3. The assistant panel stays on the right side at about half the screen width, with the page visible (dimmed) on the left; tap the page to close the panel. On a short window the panel's header is lower (44 pt).
4. While typing in the panel, the address bar or the find bar, Android doesn't take over the whole screen with its landscape keyboard; the conversation and page stay in view.
5. The tab switcher shows more columns on wider windows; previews take the window's shape.
6. The step strip and the answer card keep clear of a side notch.
7. If the screen turns during a task, the action marker disappears and comes back at the right spot on the next step; a click by screen position from a screenshot taken before the turn is refused and the assistant takes a new screenshot.
8. The QR scanner's frame and Close button fit a short screen.

## The rules

- **`LAND-1`** The app follows the system's rotation: iPhone upright and both landscapes (never upside down), iPad all four, Android left to the system (`orientation: "default"`).
  Status: Default (manager or implementing session; open to change) · Why: iPad multitasking needs all four, and layout follows the window's size rather than its orientation · Source: docs/landscape.md › Decisions; 0474a9d (2026-11-17)
- **`LAND-2`** Today there is no in-app "lock to portrait" setting; the system's rotation lock is the way to stop turning.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: both systems have a one-tap rotation lock every app follows; an in-app lock needs another native module (`expo-screen-orientation`) and cannot lock on iOS 27 or Android 16 large screens anyway; revisit if users ask · Source: docs/landscape.md › Decisions
- **`LAND-3`** Today the assistant panel in landscape is a side panel on the trailing edge, about half the width (320–420 pt; 420 on tablets), with the page visible beside it.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: a phone on its side has about 330 pt of height, so a bottom sheet would leave a sliver of page and conversation; the side panel keeps the full height for the conversation and input · Source: docs/landscape.md › Decisions; 7c8a29c
- **`LAND-5`** Android's full-screen landscape keyboard is turned off for the panel's input, the address bar and the find bar.
  Status: Default (manager or implementing session; open to change) · Why: keep the conversation and page in view while typing · Source: docs/landscape.md › Decisions
- **`LAND-7`** When the window changes size the action marker is cleared, and a `click_at` using a screenshot taken before the change is refused with a request for a new screenshot; the prompt and tool definitions are unchanged.
  Status: Default (manager or implementing session; open to change) · Why: positions from an old screenshot would click a different spot · Enforced: In the app: src/ui/layout.ts (screenshotStillValid) and src/agent/actionMarker.ts (clearMark) · Source: docs/landscape.md; 12d9fa4
- **`LAND-12`** Android declares the portrait and landscape screen features as optional (`uses-feature … required="false"`), so Google Play offers Qutai on tablets, desktops and Android XR too. ML Kit's invisible scanner activities (QR and document scanning, from expo-camera) are fixed to portrait in their own manifests, which made Play infer a required portrait screen and refuse the 0.1.10 release.
  Status: Default (manager session, 2026-11-22, after the Play Console refused 0.1.10) · Why: Qutai needs no particular orientation; a required feature hides the app from devices without it · Enforced: plugins/withOrientations.js (withOptionalScreenFeatures)

## Details

**Layout in a short or wide window**

- (was `LAND-4`) The panel's header is 44 pt instead of 56 pt when the window is under 480 pt high. · Why: save height on a sideways phone · Where: docs/landscape.md; src/ui/layout.ts
- (was `LAND-6`) Every pop-up screen allows all orientations through `AppModal`. · Why: 24 pop-ups defaulted to portrait and forced iOS back to portrait when opened sideways · Where: docs/landscape.md; dbe7010
- (was `LAND-8`) The keyboard height is measured again when the window changes size. · Why: a turn with the keyboard open kept the old height · Where: docs/landscape.md; cff6614
- (was `LAND-9`) The tab switcher has 2 columns below 600 pt of width, 3 below 900 pt, 4 above; previews follow the window's shape. · Where: docs/landscape.md; src/ui/layout.ts
- (was `LAND-10`) The step strip and answer card keep clear of side notches, and the answer card is never taller than the room above it (360 pt cap). · Why: a 360 pt card was the whole height of a small phone on its side · Where: docs/landscape.md
- (was `LAND-11`) The QR scanner's frame is at most half the short side and its Close button sits lower on short screens. · Why: frame, hint and Close overlapped on a 360 dp tall screen · Where: docs/landscape.md

## Limits and what is not built

- Not yet checked on a device; the owner's checklist is in [docs/landscape.md](../../docs/landscape.md) › Checks on a device and [docs/test-checklist.md](../../docs/test-checklist.md) § 13.
- Needs a native rebuild (Android manifest and iOS Info.plist changed).
- In-app rotation lock: not built (waiting, LAND-2).

## Where it lives

- [docs/landscape.md](../../docs/landscape.md)
- `src/ui/layout.ts` (tested by `npm run test:layout`), `src/ui/AppModal.tsx`, `plugins/withOrientations.js`, `app.json`

## Disagreements between sources

- Commit ff0b7b4 (2026-11-16) says "Orientation stays locked to portrait"; 0474a9d (2026-11-17) unlocked rotation. The app now rotates.
