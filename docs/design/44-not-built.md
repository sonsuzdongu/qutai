# 44. Deliberately not built

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Features Qutai decided not to build, or postponed, with where the decision is written down. Small "left out" items that belong to one area are also listed in that area's section.

## How it works

Each rule below names something a user might expect and Qutai does not have, and what Qutai does instead. A rule is only reopened by a new decision recorded here and in TODO.md.

## The rules

- **`NOT-1`** No password manager or password sync of Qutai's own; the phone's system autofill (iOS and Android) works in the browser.
  Status: Default (manager or implementing session; open to change) · Why: the security risk and responsibility are too great · Source: ROADMAP.md › 3. Things we recommend not doing; ROADMAP.md › Account and sync
- **`NOT-2`** No DNS over HTTPS setting.
  Status: Default (manager or implementing session; open to change) · Why: the WebView does not control DNS; the phone's "Private DNS" setting does the same job · Source: ROADMAP.md › 3
- **`NOT-3`** No browser extensions.
  Status: Default (manager or implementing session; open to change) · Why: not possible with the WebView architecture · Source: ROADMAP.md › 3
- **`NOT-4`** No "undo" for web actions; instead a confirmation before sensitive actions and per-site permissions.
  Status: Default (manager or implementing session; open to change) · Why: a submitted form or a completed payment cannot be undone from the browser · Source: ROADMAP.md › 3
- **`NOT-5`** No in-place page translation; the user asks the assistant to translate in the chat (the Translate chip went in `UI-65`).
  Status: Owner, 2026-11-15 · Why: reason not recorded · Source: ROADMAP.md › Translation and Phase 2 item 7; TODO.md › Assistant ("Decided not to do")
- **`NOT-6`** No separate model per saved task; a saved task runs with the conversation's model.
  Status: Owner, 2026-11-15 · Why: reason not recorded · Source: ROADMAP.md › AI features; TODO.md › Assistant and Assistant and tools
- **`NOT-7`** No "smart address bar" that sends natural-language text to the assistant by itself; "Ask Qutai" is at the top of the suggestion list instead.
  Status: Owner, date not recorded · Why: reason not recorded ("Will not be done, per user decision") · Source: ROADMAP.md › Address bar, AI features and Phase 2 item 3
- **`NOT-8`** No live sync between devices for now; in official builds the encrypted backup file can be kept in the Qutai account and restored on any phone.
  Status: Owner, 2026-11-17 · Why: real sync needs keys shared between devices, per-record versions with deletion markers, merging and incremental upload · Source: docs/server-backup.md (introduction); ROADMAP.md › Account and sync
- **`NOT-9`** Today there is no sync; whether a future sync must be end-to-end encrypted (so the server cannot read it) is open, recommended yes.
  Status: Waiting for the owner ([ROADMAP.md](../../ROADMAP.md#5-decisions)) · Why: the server should not be able to see history, tabs or bookmarks · Source: ROADMAP.md › 5. Decisions and › Account and sync
- **`NOT-10`** No video editing for now; image editing and filters exist.
  Status: Owner, 2026-11-19 · Why: reason not recorded ("postponed by the owner") · Source: TODO.md › Device integrations; 2cc1a3d
- **`NOT-11`** No audio recording or AI transcription service of Qutai's own ("cloud speech"); speech becomes text only through the phone's system recogniser, on the phone or through Apple's or Google's service after a one-time agreement and never in incognito ([section 25](25-voice.md)).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded ("The paid 'audio recording + AI transcription' route will not be used") · Enforced: In the app: src/device/voiceInput.ts (begin) · Source: TODO.md › Our own build › Voice input (aafe153, 2026-11-13)
- **`NOT-12`** Messages are never sent by the assistant on its own: SMS, WhatsApp and email are drafts the user sends with their own tap, and on websites a press that sends text the assistant typed needs Qutai's approval dialog.
  Status: Default (manager or implementing session; open to change) · Why: "sending stays deliberately the user's tap in WhatsApp"; a web page could otherwise make the assistant post on the user's behalf · Enforced: In the app: src/device/sms.ts, src/device/whatsapp.ts (draft cards only) and src/agent/outwardApproval.ts · Source: TODO.md › Device integrations (draft_sms, draft_whatsapp); README › Posting and paying; 67a7b4b
- **`NOT-13`** No gallery, store or catalogue of apps made in Qutai; apps are shared only by exporting and importing a file (phase 2).
  Status: Owner, 2026-11-19 · Why: reason not recorded · Source: docs/mini-apps.md (decisions accepted by the owner)
- **`NOT-14`** The assistant has no tool to write to the clipboard; only the user copies.
  Status: Default (manager or implementing session; open to change) · Why: an attack could swap a copied IBAN or wallet address · Enforced: In the app: no such tool in src/agent/tools.ts · Source: TODO.md › Device integrations; README › Known limitations
- **`NOT-15`** Today there is no in-app "lock to portrait"; the system's rotation lock is used ([section 29](29-landscape.md)).
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: an in-app lock needs another native module and cannot lock on iOS 27 / Android 16 large screens · Source: docs/landscape.md
- **`NOT-16`** No voice search in the address bar (voice input is in the assistant panel and on the Qutai button).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: TODO.md › Voice input; ROADMAP.md › Voice search
- **`NOT-17`** Downloads have no "Ask where to save" and no "ask before large files on mobile data"; POST downloads are sent as GET.
  Status: Default (manager or implementing session; open to change) · Why: mobile-data question left out to keep the change smaller; the WebView doesn't hand over a request's method or body · Source: ROADMAP.md › Download manager; TODO.md › Device integrations
- **`NOT-18`** No pasting an image into the message field.
  Status: Default (manager or implementing session; open to change) · Why: not possible with React Native's text field without a native module · Source: TODO.md › Device integrations
- **`NOT-19`** No "Add to home screen" for a page on iOS (Android has it).
  Status: Default (manager or implementing session; open to change) · Why: iOS has no API for apps; documented, not faked · Source: TODO.md › Our own build
- **`NOT-20`** No Siri / App Intents for now; `qutai://` links cover automation from the Shortcuts app.
  Status: Default (manager or implementing session; open to change) · Why: Expo's `expo-app-intents` is alpha with frequent breaking changes · Source: TODO.md › Our own build
- **`NOT-21`** The payment approval has no per-payment or per-currency spending limit and no picture of the order summary.
  Status: Owner, 2026-11-19 · Why: not needed / not asked for · Source: TODO.md › Assistant posting and paying
- **`NOT-22`** Qutai never asks for a battery-optimisation exemption for background playback.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded; a hint in Settings › Appearance › Media opens the app settings instead · Source: fix-android-background-playback note; README › Known limitations
- **`NOT-23`** No preconnecting to sites while the user types in the address bar.
  Status: Default (manager or implementing session; open to change), decided by the manager on 2026-11-20 · Why: privacy: it would contact a site the user may never open, revealing what is being typed (Chrome does it for speed) · Source: navigation feedback task, 20 Nov 2026
- **`NOT-24`** No harmful-site lookup service (like Safe Browsing) for now; it stays on the roadmap as planned later.
  Status: Owner, 2026-11-20 ("şimdilik yapılmayacak ama dursun yol haritasında"; first written by the manager the same day) · Why: out of scope for now: it would send the addresses the user opens, or their hashes, to a third-party service · Source: navigation feedback task, 20 Nov 2026

## Limits and what is not built

- Planned later (ROADMAP Phase 5): end-to-end encrypted live sync (including memory, with deletion markers), deep research in the background on iOS and with the phone off, price and page tracking (planned). Safe Browsing checks stay listed as planned later in ROADMAP Phase 5 and are not built for now (`NOT-24`, owner, 20 Nov 2026).
- iOS share extension, iOS home screen widget and the iOS default-browser entitlement: open, they need work in the owner's Apple account (planned).
- Analytics with consent (official builds): designed, not built (planned).

## Where it lives

- [ROADMAP.md](../../ROADMAP.md) › 3. Things we recommend not doing and › 5. Decisions
- [TODO.md](../../TODO.md) (the "Decided not to do" line, Voice input, Device integrations)
- [docs/mini-apps.md](../../docs/mini-apps.md), [docs/server-backup.md](../../docs/server-backup.md), [docs/landscape.md](../../docs/landscape.md)

## Disagreements between sources

- ROADMAP.md › 3 items (NOT-1 to NOT-4) are written as recommendations; no source shows the owner confirming them, so they are recorded as Default.
