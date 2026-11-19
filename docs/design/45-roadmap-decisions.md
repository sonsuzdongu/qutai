# 45. Roadmap decisions

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The decisions recorded in `ROADMAP.md` › 5. Decisions, and the features ROADMAP §3 recommends not building. The rest of the roadmap (phases and the Comet comparison) is a plan, not decisions.

## How it works

`ROADMAP.md` compared a feature inventory of mobile browsers with Qutai and put the work into phases: browser foundation, AI front and centre, modern browser, things that need a custom build, and things that need a server. Section 5 records the choices the owner made along the way, and section 3 lists features recommended not to build. A ticked item there is decided. An unticked one is still open.

## The rules

- **`RMAP-1`** Work started with Phase 1, the browser foundation.
  Status: Owner, 2026-11-14 · Why: reason not recorded · Source: ROADMAP.md › 5. Decisions; b86129c
- **`RMAP-2`** Search suggestions are on by default and always off in private (incognito) tabs.
  Status: Owner, 2026-11-14 · Why: reason not recorded (the privacy policy adds that typed text goes to the search engine, never from incognito) · Enforced: In the app: address-bar suggestions (see the browser section) · Source: ROADMAP.md › 5. Decisions; b86129c
- **`RMAP-3`** The interface comes in ten languages and uses the device's language by default, with a choice in Settings › Language. Today the eight newer languages have not been reviewed by native speakers.
  Status: Owner, 2026-11-14 · Why: reason not recorded. The decision started as Turkish and English (b86129c) and grew to ten languages on 2026-11-16 (dd4c1a5, b8e367d). The native-speaker review is still waiting (owner's open question 26) · Source: ROADMAP.md › 5. Decisions
- **`RMAP-4`** AI search is on by default and can be turned off in Settings › Assistant. Each search's extra charge goes to the user's own key.
  Status: Owner, 2026-11-14 · Why: reason not recorded · Source: ROADMAP.md › 5. Decisions; f7f6bfb, 7cab11d
- **`RMAP-5`** Should sync be end-to-end encrypted? The roadmap recommends yes. Today there is no sync. The server backup (pro mode) stores the same password-encrypted backup file the phone exports, and the server cannot read it.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#sync--server-backup)) · Why: recommended so the server never sees the user's browsing data · Source: ROADMAP.md › 5. Decisions; TODO.md › Sync → server backup ("Later, real sync: end-to-end encrypted record-level sync")
- **`RMAP-6`** Qutai does not build its own password manager or password sync.
  Status: Default (manager or implementing session; open to change) · Why: the security risk and responsibility are too great, and the iOS and Android system autofill already works in the WebView · Source: ROADMAP.md › 3. Things we recommend not doing
- **`RMAP-7`** Qutai does not offer its own DNS over HTTPS.
  Status: Default (manager or implementing session; open to change) · Why: the WebView does not control DNS, and the system's "Private DNS" setting does the same job · Source: ROADMAP.md › 3
- **`RMAP-8`** Qutai does not support browser extensions.
  Status: Default (manager or implementing session; open to change) · Why: not possible with the WebView architecture. User styles, scripts and apps inside Qutai (19 Nov) cover some of the same needs under Qutai's own approvals · Source: ROADMAP.md › 3
- **`RMAP-9`** Qutai does not offer undo for actions on the web.
  Status: Default (manager or implementing session; open to change) · Why: a submitted form or a completed payment cannot be undone from the browser. Prior confirmation and per-site permissions are used instead · Source: ROADMAP.md › 3

## Limits and what is not built

- (planned) Real sync, waiting on RMAP-5.

## Where it lives

- `ROADMAP.md` (§2 phases, §3 not recommended, §4 Comet comparison, §5 decisions)
