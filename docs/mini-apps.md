# Apps inside Qutai ("mini apps")

The owner's request of 18 Nov 2026: users can have Qutai build small applications for them ("build me an app where I
can keep my notes"); Qutai writes the HTML, CSS and JavaScript, runs it on the phone, keeps its data on the phone, and
later exports it and includes it in backup and sync. This note is the design and the **contract** every later phase
builds on. Phase 1 is the runner, the storage bridge, the assistant writing and editing apps and "My apps"; phase 2
(§8) is export and import as a file, apps in the backup and the Android network block; phases 3 and 4 are listed at
the end.

Decisions accepted by the owner (19 Nov 2026):

- An app is **one package**: a manifest plus HTML, CSS and JavaScript files.
- It runs in **its own isolated WebView**, apart from browsing tabs: no other site's cookies, sessions or tabs, no
  other app's data.
- **Offline by default**: no network at all in phases 1 to 3; network to hosts the manifest declares is phase 4.
- It reaches the phone **only through a small versioned bridge** (the contract below).
- Sharing is **by file export and import only** (phase 2); no gallery, no store, no catalogue.
- Available in **every build**, not only pro mode. Writing an app is an ordinary assistant request (the user's own key
  or Qutai Credits); running one costs nothing.
- **Every version of an app is kept** (up to a limit) so the user can go back.

Code: `src/apps/` (pure: manifest and package checks, the contract table, the document builder, the query engine,
the store over SQLite, the bridge), `src/components/AppRunner.tsx`, `src/components/MyApps.tsx`,
`src/agent/appTools.ts` / `appTool.ts`. Tests: `npm run test:apps`. Break-out test apps: `scripts/app-tests/`.

## 1. The package

### Manifest

Stored as JSON with each version (and as `package.manifest` in the export file, §8).

| field | type | rules |
| ----- | ---- | ----- |
| `format` | `"qutai-app"` | fixed; anything else is not an app package |
| `formatVersion` | integer | `1`. A newer number is refused on import ("needs a newer Qutai") |
| `id` | string | `app-` + 12 characters `[a-z0-9]`, made by Qutai. An import keeps the file's id when it is free on this phone, otherwise the user chooses "keep both" (a new id: two copies never share data) or "replace" (§8) |
| `name` | string | 1 to 40 characters after trimming, no control characters |
| `description` | string | up to 200 characters, may be empty |
| `icon` | object | `{ "name": "<icon>", "color": "#rrggbb" }` with a name from the app icon set (`APP_ICONS` in `src/apps/manifest.ts`: notes, tasks, calendar, alarm, wallet, food, travel, home, person, photo, document, globe, …), or `{ "svg": "<svg …>", "color": … }` in the SVG subset below. Colour optional (a stable colour from the id otherwise) |
| `version` | integer ≥ 1 | the package version, counted by Qutai: each saved change is the next number |
| `contract` | integer | the bridge contract the app was written for: `1`. A bigger number than this Qutai has: the app is listed but won't open ("needs a newer Qutai") |
| `permissions` | string[] | declared permissions (§4), each at most once, from the known list. In phase 1 only those this Qutai can grant are accepted when the assistant writes an app (`storage`, `ui`, `app` are implicit and need not be listed; `clipboard-write`, `clipboard-read`) |
| `network` | `{ "hosts": string[] }` | phase 4; must be absent or empty before then |
| `entry` | string | the HTML file that opens: `index.html` |
| `language` | string | the language the app's text is written in (`tr`, `en`…), for `<html lang>` and screen readers |
| `createdAt`, `updatedAt` | ISO 8601 | when the app and this version were made |
| `author` | object | `{ "kind": "local" }` = "Made with Qutai on this phone"; `{ "kind": "imported", "file": "<name>", "importedAt": … }` (phase 2). Never a person's name or account |

**SVG icon subset** (`checkSvgIcon`): at most 4 KB; elements `svg g path circle ellipse rect line polyline polygon`
only; attributes `viewBox width height d cx cy r rx ry x y x1 y1 x2 y2 points fill stroke stroke-width stroke-linecap
stroke-linejoin fill-rule clip-rule opacity transform xmlns` only; values without `url(`, `javascript:`, `<`, `&`
entities or `@`. No `style`, `href`, `xlink`, `<script>`, `<image>`, `<foreignObject>`, `<use>`, text or filters.
Rendered natively with Skia (not in a WebView), so even a bad SVG has no script and no network.

### Files

- Flat names only: `^[a-z0-9][a-z0-9_-]{0,39}\.(html|css|js)$` (no folders, no `..`, lowercase).
- Exactly the `entry` file plus any number of `.css` and `.js` files, **at most 12 files**.
- Each file at most **256 KB**, the whole package at most **512 KB** (UTF-8 bytes); text must be valid UTF-8 (no lone
  surrogates) and contain no NUL.
- Images, fonts and sounds go inline (`data:` URLs, inline SVG); there is no other file type in format 1. A later
  format can add binary assets without changing the contract.

### How the document is built

Qutai never loads the files as they are. `buildAppDocument` (`src/apps/document.ts`) makes **one HTML document**:

```
<!doctype html><html lang="<language>" data-qutai-theme="light|dark"><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="<APP_CSP>">        ← always first
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>/* lockdown + qutai.js helper library, contract 1 */</script>
<style>/* Qutai's base stylesheet: theme variables, safe areas, text size */</style>
… the entry file's <head>, with <link rel=stylesheet href="x.css"> replaced by the file's text and
  <meta http-equiv>, <base>, other <link>s and <script src> to anything but a package file removed …
</head><body> … the entry file's <body>, <script src="x.js"> replaced by the file's text … </body></html>
```

The CSP comes before any byte of the app, so nothing the app writes can loosen it (a second policy only adds
restrictions). The removals are for clear error messages, not for safety: the policy and the native navigation rule
are what enforce. The builder keeps a **line map** (document line → file and line), so an error at document line 214
is reported as `app.js:37`.

### Versions

- Every create or change by the assistant, every restore and (phase 2) every import is a row in `app_versions` with
  the full manifest and files. `apps.current_version` points at the one that runs.
- **Undo** = the current pointer moves to the newest kept version below it; the undone version stays in the list
  ("Versions" in the runner's menu), so undo can be redone by choosing it. A new change after an undo gets the next
  number after the highest one.
- **Kept: the 20 newest versions** plus the current one; older ones are deleted when a new version is saved. Worst
  case per app: 21 × 512 KB ≈ 10.5 MB, typically a few hundred KB.
- App **data is per app, not per version**: going back to an older version keeps the notes. The guide tells the
  assistant to keep data compatible (read missing fields with defaults, never rename stored fields).

### Seal, integrity and "arrives disabled"

- `packageHash` = SHA-256 of the canonical package (the manifest's stable fields in a fixed key order, then each file
  as `name\nlength\ncontent`, files sorted by name). It is stored per version and written into an export file
  (phase 2) so a damaged or edited file is refused.
- `packageSeal` = HMAC-SHA-256 of `qutai-app-v1\n` + the hash under **this install's device key** (the same key in
  secure storage as kept scripts, `src/device/scriptKey.ts`; never in a backup). Every version Qutai writes on the
  user's request is sealed. **An app version runs only when its seal verifies.** A version without a valid seal (an
  import, a restore on another phone, or a database row changed behind Qutai's back) shows as **"Needs your
  approval"**: it doesn't open until the user has seen its name, author ("Imported from <file>"), permissions, size and
  file list and pressed "Turn on", which seals it. Phase 1 writes only sealed versions; the check and the state
  (`apps.state = 'disabled'`) exist so phase 2 needs no change here.
- A hash is not a signature: an export file proves nothing about who wrote it. Format 1 has no author signatures, on
  purpose (no keys to manage, no false sense of trust); the permission screen and isolation are the protection.

## 2. The runtime

### One WebView per open app

`AppRunner` opens one app at a time, full screen, with a slim Qutai header (the app's name; ⋮ menu: Edit with the
assistant, Versions, Permissions, Reload, Delete; Close). The WebView is created for the opened app and destroyed
when it closes (`key` = app id + version + reload counter), so nothing of one app is in memory when another opens.

| | iOS (WKWebView) | Android (System WebView) |
| --- | --- | --- |
| Origin | its own origin per app, `https://<app-id>.apps.qutai.invalid/` (`appBaseUrl`): `.invalid` never resolves (RFC 6761), so nothing can be loaded from it, and no two apps share one. Not an opaque `about:blank` origin: WebKit then reports every error of the app's own scripts as "Script error." with no message or line (found in the simulator run), which leaves the fix loop blind. The lockdown script removes what a real origin would bring: `localStorage`, `sessionStorage`, `indexedDB`, `caches` throw ("use qutai.storage"), `document.cookie` reads empty and ignores writes, and `navigator.clipboard`, `share`, `credentials`, `serviceWorker`, `mediaDevices`, `geolocation` and `Notification`, `PaymentRequest`, `BroadcastChannel` are gone | the same (`loadDataWithBaseURL` with that base) |
| Data store | `incognito`: its own **non-persistent** `WKWebsiteDataStore` per WebView: nothing written to disk, nothing shared with tabs or other apps | its own **WebView profile** `qutai-apps` (the patched module's `webviewProfile`, androidx.webkit multi-profile, WebView 119+): cookies, storage and cache apart from the browsing profile. On an older WebView the default profile: then only `domStorageEnabled={false}`, the cookie settings and the lockdown script (which make storage and cookies unusable on the app's own origin) keep it apart from browsing data. The `incognito` prop is never used on Android (it clears every cookie of the browsing tabs) |
| DOM storage | `domStorageEnabled={false}` | `domStorageEnabled={false}` |
| Files, location, camera | `allowFileAccess` off, `geolocationEnabled` off, media capture denied | same |
| Windows | `setSupportMultipleWindows={false}`, `javaScriptCanOpenWindowsAutomatically={false}` | same |
| Navigation | `onShouldStartLoadWithRequest` allows only the app's own document (its base address and `#fragment` links inside it, `appNavigationAllowed`); every other URL (links, `location =`, forms, `<meta refresh>`, `window.open`, other schemes such as `tel:` or `intent:`) is refused and reported to the diagnostics | same |
| Text size | the phone's text size through `--qutai-font-scale` (the base stylesheet sets the root font size; apps use `rem`) | same, `textZoom={100}` so it isn't applied twice |

The app's own JavaScript runs in the page's main world; there is no other content in that world (no browsing pages,
no frames), so there is nothing for it to reach.

### The network block

Layer 1, both platforms: the **Content Security Policy** (`APP_CSP` in `src/apps/document.ts`):

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:;
font-src data:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none';
manifest-src 'none'; form-action 'none'; base-uri 'none'
```

It stops `fetch`, XHR, `WebSocket`, `EventSource`, `sendBeacon`, `<img src=https://…>`, CSS `url()` to a host, web
fonts, media, frames, workers, `<object>`/`<embed>`, form submissions and `eval`/`new Function` (no `'unsafe-eval'`).
The engine enforces it, not Qutai's script.

Layer 2, native: **navigation refused** (above), on both platforms. iOS also gets a **WebKit content rule list**
(`qutai-apps-offline-v1`: block every `http`, `https`, `ws`, `wss` and `ftp` load) attached through the patched
module's `contentBlocking` / `contentRuleLists` props, compiled at the runner's first use. Android gets the native
app sandbox of phase 2 (§8 "The Android network block": `blockNetworkLoads`, every request answered with a 403,
navigations refused without waiting for JavaScript, the frame guard in every frame).

Layer 3, the lockdown script (first script in the document): `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
`RTCPeerConnection` and its relatives, `Worker`, `SharedWorker` replaced by stubs that throw "The network is off in
Qutai apps" (a clear error for the assistant instead of a CSP line), `navigator.sendBeacon` returns false,
`window.open` returns null, form submits and link clicks are cancelled and reported, `<iframe>`/`<frame>`/`<object>`/
`<embed>` elements are removed as soon as they are added and `contentWindow`/`contentDocument` return null.

**What can't be blocked (risks stated; checked with the break-out app on 19 Nov 2026: iOS simulator 46/46 blocked,
Android emulator, API 36, 45/46 blocked; the leak recorder got nothing on either):**

- **WebRTC**: CSP doesn't govern it, and neither platform lets an app turn WebRTC off in a WebView. ICE candidate
  gathering can send UDP packets to a STUN/TURN server named in code, which can carry a few bytes of data. The lockdown
  removes the constructors; the frame guard (§8) removes them in every frame too.
  - iOS: closed in the test. The guard runs as a user script in every frame, including a fresh `about:blank` one, so
    `window[0]` of such a frame has no `RTCPeerConnection`.
  - **Android: closed in the app document, 19 Nov 2026.** Its document-start scripts don't run in a frame's initial
    `about:blank` document, so before this a fresh frame's `window[0]` had a fresh `RTCPeerConnection`. Now no frame
    can exist: the lockdown refuses, *before* the insertion, every script API that would put an `iframe`, `frame`,
    `object`, `embed`, `portal` or `fencedframe` anywhere (the `Node`, `Element`, `Document`, `DocumentFragment`,
    `CharacterData`, `DocumentType`, `ShadowRoot` and `Range` insertion methods, checking the node, everything under
    it and open shadow roots; `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `setHTML`, `setHTMLUnsafe`,
    `createContextualFragment`, `DOMParser.parseFromString`, `Document.parseHTMLUnsafe` and `execCommand('insertHTML')`
    when the string holds a frame start tag, read once; `document.body =`), `document.write`, `writeln` and `open` are
    off, and frame tags in the app's own markup are turned into unknown elements when the document is built (the
    parser would otherwise create the frame before any script). Before the insertion matters: inserting a frame
    creates its window and can run its `onload` at once. Checked in desktop Chromium (no frame guard in frames, like
    Android) with 25 frame routes in the break-out app: all blocked; on the Android emulator: see the test checklist.
    What remains: an engine bug that creates a browsing context some other way, and the user's own paste of HTML into
    an app's editable area (the browser's paste is not a script API; it needs the user to paste a frame).
- **DNS prefetch**: switched off in every app document (`x-dns-prefetch-control: off`, which can't be switched back on;
  `<link rel=dns-prefetch>` is removed). An engine that ignores the switch could still resolve host names in links,
  and a DNS lookup can carry data in the host name to that domain's name server (low bandwidth, no answer reaches the
  app). Not observable with the leak recorder; not seen in either test.
- **Timing and visual channels** need the user: the app can show text that asks the user to type something into a
  website. The app can't open a website itself.
- **Android navigation decision timeout**: closed. Unpatched, react-native-webview lets a navigation through when
  Qutai's JavaScript thread doesn't answer within 250 ms. The app sandbox refuses every navigation natively before
  that wait, and the break-out app's busy-thread cases (`location =`, `location.replace`, meta refresh, an image while
  the thread is flooded) are all blocked on the emulator.
- **Android subresources**: closed natively too (`blockNetworkLoads` and a 403 from `shouldInterceptRequest`); only
  `data:`, `blob:` and `about:` pass, which never leave the phone. An Android System WebView without document-start
  scripts runs no frame guard at all (the lockdown still removes frames as they are added).

None of these reaches the browsing tabs' cookies, sessions, other apps' data or Qutai's own storage: those are not in
the WebView at all.

### Messages between the app and Qutai

- App → Qutai: `window.ReactNativeWebView.postMessage(JSON)`. Every message is parsed and checked natively
  (`parseBridgeRequest`): at most 512 KB, the shape `{ qutai: 1, id, call, args }`, a known call, args of the right
  types. Anything else is dropped (and counted in the diagnostics). The WebView only ever holds the app, so there is
  no other sender to tell apart; a nonce isn't needed.
- Qutai → app: `injectJavaScript("window.__qutaiReceive(<JSON>)")` with the answer or an event. `__qutaiReceive` is
  defined by the helper as non-writable and non-configurable.
- At most 32 calls in flight; more are refused with `E_BUSY`. Dialogs one at a time.

### Lifecycle

- **Launch**: the runner builds the document from the current version (after the seal check) and the theme, language,
  safe areas and text size of this moment, so `qutai.ready` resolves without a round trip. Opening is a user action
  only (My apps, the chat's app card, a preview the assistant asked for); an app never starts by itself.
- **Background / foreground**: the app gets `pause` and `resume` events; nothing else changes (the WebView stays
  while the runner is open). Writes are committed when their promise resolves, so an app that awaits its writes loses
  nothing when the system kills Qutai in the background.
- **Theme or rotation while open**: `theme` and `insets` events; the CSS variables update by themselves.
- **Back**: Android's back button and the header's close: if the app set `qutai.ui.setBackHandler(true)`, back sends
  a `back` event to the app (it closes its own sheet or editor); otherwise the runner closes.
- **Kill / crash / out of memory**: iOS `onContentProcessDidTerminate`, Android `onRenderProcessGone`: the overlay
  says the app stopped, with Reload and Close. Qutai itself is never affected (separate web content process).
- **Hang** (an endless loop): Qutai's own UI keeps working (the WebView's JavaScript runs on its own thread/process).
  A ping every 5 seconds; no answer for 10 seconds shows "<name> isn't responding" with Reload and Close.

### Errors and diagnostics

The helper captures `window.onerror`, unhandled promise rejections, `console.error`/`warn`/`log`/`info`, CSP
violations (`securitypolicyviolation`: "Blocked: a connection to https://…"), refused navigations, and bridge errors.
Each line is cut at 300 characters; at most 50 lines per run are kept in memory (never on disk, never in a backup:
they could hold the app's data).

- The user sees an **error overlay** for uncaught errors (not for console lines): "<name> ran into a problem." with
  the technical line under Details, and **Ask Qutai to fix this**, Reload, Dismiss. "Ask Qutai to fix this" closes the
  runner and puts a message in the assistant's input naming the app, its version and the report: each error's message,
  file, line and a stack of at most six lines; blocked attempts; console warnings and errors only as the types and
  lengths of their values (`<string 14> <object, 2 keys>`), never the values. The user sees exactly what will be sent
  and sends it (or edits it) themselves (decided 19 Nov 2026: the safer choice; src/apps/document.ts formatFixReport).
- The assistant sees the same diagnostics in the `preview` result (§5).

## 3. The bridge contract (version 1)

All calls are promises in the helper library, which wraps the wire format (`qutai.call(name, args)`). Every call is
checked in this order: known call → available in this Qutai (phase) → permission declared in the manifest → the user's
grant (asked at first use where §4 says so) → arguments → run. Each failure has its own code.

**Error codes**: `E_UNKNOWN_CALL` (no such call), `E_NOT_AVAILABLE` (a later phase or not on this platform),
`E_NOT_DECLARED` (the manifest doesn't list the permission: the message names it), `E_DENIED` (the user said no, or
revoked it), `E_BAD_ARGS`, `E_NOT_FOUND`, `E_TOO_LARGE` (one value or message over its cap), `E_QUOTA` (the app's
storage is full), `E_BUSY` (too many calls in flight, or a dialog is already open), `E_CANCELLED` (the user dismissed
a dialog or picker where that isn't an answer), `E_HOST_NOT_DECLARED` (phase 4), `E_OFFLINE` (phase 4), `E_INTERNAL`.

Rejected promises carry an `Error` with `.code` and a plain English `.message`.

| call | args → answer | permission | phase |
| ---- | ------------- | ---------- | ----- |
| **app** | | | |
| `app.info` | → `{ id, name, version, contract, language, uiLanguage, platform, permissions, granted, theme }` | implicit | 1 |
| `app.permissions` | → `{ declared: string[], granted: Record<string,'granted'\|'denied'\|'ask'> }` | implicit | 1 |
| `app.requestPermission` | `{ permission }` → `'granted'\|'denied'` (Qutai's dialog if not yet decided) | the one asked must be declared | 1 |
| `app.close` | → closes the runner | implicit | 1 |
| `app.openLink` | `{ url }` → opens an `https` page in a Qutai tab after the user confirms | `links` | 3 |
| `app.addShortcut` | → offers a home-screen shortcut | implicit | 4 |
| **storage** (key-value) | | | |
| `storage.get` | `{ key }` → value or `null` | implicit | 1 |
| `storage.set` | `{ key, value }` (JSON) → `true` | implicit | 1 |
| `storage.remove` | `{ key }` → `true` | implicit | 1 |
| `storage.keys` | `{ prefix? }` → `string[]` | implicit | 1 |
| `storage.getMany` / `storage.setMany` | `{ keys }` → object / `{ entries }` → `true` (atomic) | implicit | 1 |
| `storage.usage` | → `{ used, quota }` bytes | implicit | 1 |
| `storage.batch` | `{ ops: [{ op: 'set'\|'remove'\|'add'\|'put'\|'update'\|'delete', … }] }` → results; **all or nothing** | implicit | 1 |
| **storage** (documents) | | | |
| `docs.add` | `{ collection, doc }` → the doc with `id`, `createdAt`, `updatedAt` | implicit | 1 |
| `docs.get` | `{ collection, id }` → doc or `null` | implicit | 1 |
| `docs.put` | `{ collection, id, doc }` → doc (create or replace) | implicit | 1 |
| `docs.update` | `{ collection, id, patch }` → doc (shallow merge; `null` removes a field) or `E_NOT_FOUND` | implicit | 1 |
| `docs.delete` | `{ collection, id }` → `true`/`false` | implicit | 1 |
| `docs.query` | `{ collection, where?, search?, orderBy?, limit?, offset? }` → `{ docs, total }` | implicit | 1 |
| `docs.count` | `{ collection, where?, search? }` → number | implicit | 1 |
| `docs.clear` | `{ collection }` → number removed | implicit | 1 |
| `docs.collections` | → `[{ name, count }]` | implicit | 1 |
| **ui** | | | |
| `ui.theme` | → `{ dark, colors: { bg, surface, sunken, text, textSecondary, tint, onTint, danger, separator, border }, fontScale }` (also CSS variables) | implicit | 1 |
| `ui.insets` | → `{ top, right, bottom, left }` (also CSS variables) | implicit | 1 |
| `ui.toast` | `{ text }` (≤ 120 chars) → `true` | implicit | 1 |
| `ui.alert` | `{ title, message? }` → `true` | implicit | 1 |
| `ui.confirm` | `{ title, message?, confirmText?, destructive? }` → boolean | implicit | 1 |
| `ui.prompt` | `{ title, message?, label?, initial?, placeholder?, maxLength? }` → string or `null` | implicit | 1 |
| `ui.haptic` | `{ kind: 'selection'\|'light'\|'medium'\|'heavy'\|'success'\|'warning'\|'error' }` → `true` | implicit | 1 |
| `ui.setTitle` | `{ title }` (≤ 40 chars; empty: the app's name) → `true` | implicit | 1 |
| `ui.setBackHandler` | `{ enabled }` → `true` | implicit | 1 |
| **clipboard** | | | |
| `clipboard.write` | `{ text }` (≤ 100 KB) → `true` | `clipboard-write` (declared, not asked) | 1 |
| `clipboard.read` | → string | `clipboard-read` (declared, asked at first use) | 1 |
| **share / files** | | | |
| `share.text` / `share.file` | `{ text, title? }` / `{ name, mime, data (base64 or text) }` → `true` after the system sheet | `share` | 3 |
| `files.pick` | `{ types?, multiple? }` → `[{ name, mime, size, data }]` (≤ 5 MB) | `files` | 3 |
| `files.save` | `{ name, mime, data }` → `true` (system save sheet) | `files` | 3 |
| **location** | `location.current` `{ accuracy? }` → `{ latitude, longitude, accuracy, at }`; `location.watch` / `location.stop` (only while the app is open) | `location` | 3 |
| **notifications** | `notifications.schedule` `{ title, body?, at }` → id; `notifications.cancel` `{ id }`; `notifications.list` | `notifications` | 3 |
| **camera / photos** | `camera.takePhoto` `{ maxSize? }` → `{ data, width, height }`; `photos.pick` `{ multiple? }` | `camera`, `photos` | 3 |
| **assistant** | `assistant.ask` `{ question, context? }` → `{ answer }`: shown to the user first ("<app> wants to ask Qutai: …", with the cost source), the user's key or credits, no tools, no page access | `assistant` | 3 |
| **network** | `network.fetch` `{ url, method?, headers?, body? }` → `{ status, headers, body }`: only `https` to a host in `manifest.network.hosts`, no cookies, size and rate caps | `network` | 4 |

**Events** (`qutai.on(name, fn)`): `theme`, `insets`, `pause`, `resume`, `back`.

**Caps** (`LIMITS` in `src/apps/contract.ts`): quota **5 MB per app** (UTF-8 bytes of keys, values and documents);
one value or document 256 KB; key and collection names: `^[A-Za-z0-9_.:-]{1,100}$` / `^[A-Za-z0-9_-]{1,64}$`;
document ids the same as keys; `batch` up to 100 operations; `query` `limit` up to 500 (default 100); a message 512 KB.

**Atomic writes**: each write call (and each `batch`, `setMany`) is one SQLite transaction; the quota is checked inside
the same transaction from the stored sizes, and writes for one app are queued so two calls can't interleave. A failed
batch leaves nothing behind.

**Queries** (`runQuery` in `src/apps/query.ts`, in JavaScript over the collection's documents, which the quota keeps
small): `where` is an object of `field: value` (equal) or `field: { eq, ne, lt, lte, gt, gte, in, contains,
startsWith, exists }` (an object value is always read as operators: compare with an object through `{ eq: {...} }`); fields may be dotted (`"meta.done"`). `search: { text, fields? }` matches every word of the
text, case- and accent-insensitive with Turkish dotted/dotless i handled (`İstanbul` finds `istanbul`), in the given
fields or every string field. `orderBy` a field or `[{ field, dir }]`, then by `createdAt` for a stable order;
strings compare with the user's language collation. Enough for notes, lists, trackers and simple journals; joins and
aggregates are the app's own JavaScript.

### The helper library (`qutai.js`, contract 1, injected)

```js
await qutai.ready;                                    // info, theme, insets loaded
const notes = qutai.db('notes');                       // a collection
const n = await notes.add({ title, body });            // → { id, createdAt, updatedAt, title, body }
const { docs } = await notes.query({ search: { text: q, fields: ['title', 'body'] }, orderBy: [{ field: 'updatedAt', dir: 'desc' }] });
await notes.update(n.id, { body });  await notes.delete(n.id);
await qutai.storage.set('settings', { sort: 'new' });
if (await qutai.ui.confirm({ title: 'Delete?', destructive: true })) …
qutai.ui.toast('Saved');  qutai.ui.haptic('success');  qutai.escape(text)  // HTML-escape user text
qutai.t({ en: 'Notes', tr: 'Notlar' })                 // picks the app's language
qutai.on('back', closeEditor); qutai.ui.setBackHandler(true);
```

Also `qutai.call(name, args)`, `qutai.app`, `qutai.clipboard`, `qutai.theme`, `qutai.language`, `qutai.id()` (a random
id that works on every WebView version). The base stylesheet gives
`--qutai-bg`, `--qutai-surface`, `--qutai-sunken`, `--qutai-text`, `--qutai-text-secondary`, `--qutai-tint`,
`--qutai-on-tint`, `--qutai-danger`, `--qutai-separator`, `--qutai-border`, `--qutai-safe-top/right/bottom/left`,
`--qutai-font-scale`, a system font, `rem`-based text that follows the phone's text size, 44 px touch targets for
buttons and inputs, and visible focus outlines. Versioned with the contract: a later contract keeps `qutai.js` 1's
calls working (an app declares the contract it was written for; Qutai keeps answering old contracts).

## 4. Permissions

| permission | declared? | asked? | phase |
| ---------- | --------- | ------ | ----- |
| `storage`, `ui`, `app` | implicit | no | 1 |
| `clipboard-write` | yes | no (writing is visible: Qutai shows "Copied") | 1 |
| `clipboard-read` | yes | first use, Qutai's dialog ("<app> wants to read what you copied") | 1 |
| `share`, `files` | yes | no: the system sheet or picker is the consent | 3 |
| `location`, `notifications`, `camera`, `photos` | yes | first use, Qutai's dialog, then the system permission | 3 |
| `links` | yes | every link, Qutai's dialog shows the address | 3 |
| `assistant` | yes | first use, plus each question shown before it goes | 3 |
| `network` | yes, with hosts | when the app is turned on (hosts listed) | 4 |

- A call whose permission isn't declared fails with `E_NOT_DECLARED`, even if the user would agree: the manifest is
  the whole list of what the app can ever ask for, shown before an imported app is turned on.
- Answers are stored per app (`apps.grants`), "Allow" or "Don't allow"; dismissing the dialog is not an answer.
- **Review and revoke**: the runner's ⋮ › Permissions lists each declared permission with its state; tapping one
  resets it to "Ask next time". Deleting the app removes its answers with it.
- Apple 4.7.3 ("explicit user consent in each instance") is met by asking per app, never "for all apps".

## 5. How the assistant builds an app

One tool, `apps`, with an `action`:

| action | does |
| ------ | ---- |
| `guide` | returns the full contract and the writing guide (`APP_GUIDE`, ~2,500 tokens). Called once before the first create or update in a conversation; the system prompt only has one short line, so other conversations don't pay for it |
| `list` | the user's apps: id, name, version, description (never their data) |
| `read` | an app's manifest and files of the current version (or one file); for changes |
| `create` | `name`, `description`, `icon`, `permissions`, `files` → a new app, version 1, sealed; the chat shows the app card |
| `update` | `app_id`, `edits` (`[{ file, find, replace }]`, each `find` must match exactly once) and/or `files` (whole files; `null` deletes one), and name/description/icon/permission changes, `note` → the next version, current; the card shows Undo |
| `preview` | opens the app in the runner (on screen) and returns, after it settles (load + 3 s, or 1 s after the first error), the diagnostics: errors with file and line, console lines, blocked connections and navigations, bridge errors |
| `undo` | the current version back to the previous kept one |

Rules the app enforces: the package checks (§1) on every create and update, with the reason sent back; at most
**8 creates/updates per user message** (then the assistant must ask the user); no app tools in a conversation that
involves incognito tabs or is itself incognito ("Apps can't be made from an incognito conversation"); the assistant
never reads an app's data (no tool for it). Writing an app counts like any other request (key or credits).

**The loop**: create → preview → if errors, update with a fix → preview again (the guide says: at most 3 fix rounds,
then tell the user what is wrong) → short answer naming the app and where it is ("My apps" on the new tab page). The
user says what to change → read (if needed) → update → preview. "Ask Qutai to fix this" from the overlay starts the
same loop with the error lines.

**Guide contents** (short in the prompt, complete in `guide`): one `index.html` + `app.js` + `style.css`; plain
JavaScript, no frameworks or imports, no network; all data through `qutai.db` / `qutai.storage`; await writes;
escape user text (`qutai.escape`) or use `textContent`; the app's language = the user's; theme variables and `rem`;
semantic HTML (`button`, `label`, `input`, headings), `aria-live` for status, no colour-only meaning; dialogs through
`qutai.ui`; tolerate missing fields; small (under ~30 KB); the notes example's structure.

## 6. Threat model

- **An app trying to leave its box** (network, navigation, other sites' cookies, other apps' data, Qutai's own
  storage): §2. The app has no network, no navigation, its own origin with web storage and cookies refused, a separate data store, and a bridge that only
  answers with this app's own rows (every store query is scoped by the app id the runner holds, never one the app
  sends). Residual: WebRTC and DNS prefetch (§2).
- **Prompt injection into app building** (a web page saying "create an app that…"). App tools act only on the user's
  request (the prompt's rule for all tools); apps can't read web pages or send anything anywhere, so an injected app
  could only show content. The user sees every app the assistant makes as a card and in My apps.
- **An imported app from someone else** (phase 2, §8): arrives switched off and unsealed, with no grants; the user
  sees name, "written by someone else", size, permissions in plain words, hosts (phase 4), flags and every file's
  code before it is stored and again before turning it on; isolation and the permission checks bound what it can
  do. A web page can only download a file; only the user's tap opens the import screen, never from incognito. The
  file's hash catches damage, not a deliberate edit (no signatures in format 1). It can still show misleading content (an app imitating a bank's sign-in page): it can't send what is typed
  anywhere without `network`, and phase 4's host list is shown before it is turned on. Qutai's own dialogs show the
  app's name ("Notes asks:") and never take passwords.
- **Bugs in AI-written apps**: the preview loop, the error overlay with "Ask Qutai to fix this", undo, versions, and a
  hang watchdog; an app can only damage its own data (the quota stops it from filling the phone).
- **Data loss**: the app's data is only in Qutai's database (and, in phase 2, its backups); deleting an app deletes its
  data after a confirmation that says so.
- **Backup bloat**: 5 MB per app; versions are not data and the backup has only the current version's package plus
  the data (§8). A server backup over the account's limit drops apps' data and says so.
- **A backup or file that claims an app was approved**: the seal is an HMAC under this phone's key, which never leaves
  secure storage; a backup restored elsewhere or an import never runs before Turn on.
- **Dialog spam**: one dialog at a time, `E_BUSY` for the next; a toast is short and rate-limited by the toast itself.
- **Clipboard**: reading is asked; writing is shown.

## 7. Store policies (checked 19 Nov 2026)

- **Apple, App Store Review Guidelines** (<https://developer.apple.com/app-store/review/guidelines/>):
  - 2.5.2: apps may not "download, install, or execute code which introduces or changes features or functionality of
    the app, including other apps". 
  - 4.7: "Apps may offer certain software that is not embedded in the binary, specifically HTML5 and JavaScript mini
    apps and mini games, streaming games, chatbots, and plug-ins", under 4.7.1–4.7.5: privacy rules (5.1), "a method
    for filtering objectionable material, a mechanism to report content", 3.1 for digital goods; 4.7.2 no native
    platform APIs extended or exposed "without prior permission from Apple"; 4.7.3 no data or privacy permissions shared
    "without explicit user consent in each instance"; 4.7.4 "an index of software and metadata available in your app"
    with universal links; 4.7.5 a way to identify software above the app's age rating and an age restriction.

  **Reading:** apps here are generated on the phone at the user's request and run only inside a WKWebView; nothing is
  downloaded from the developer and there is no catalogue. This is closer to a code-writing assistant than to a mini
  app platform, but a reviewer may well read it as 4.7 "HTML5 and JavaScript mini apps". The design fits 4.7 anyway:
  4.7.2 — the bridge gives clipboard, dialogs, toasts and haptics (phase 1), all user-visible; later bridges
  (location, camera, notifications) are each asked per app, and **phase 3 should be raised with Apple** (App Review
  notes, or a question through App Store Connect) because 4.7.2 speaks of "prior permission"; 4.7.3 — per-app consent;
  4.7.4 — "My apps" is the index (each user's own apps; no shared catalogue, so universal links don't apply: say so in
  the notes); 4.7.5 — apps are private to the user who made them; imported ones (phase 2) come from a file the user
  chose. 4.7.1's reporting: the existing AI-report question (TODO.md) covers generated content; apps are not shared
  inside Qutai.
  
  **App Review notes should say:** "Qutai's assistant can write small personal tools (for example a notes list) at
  the user's request. They are HTML/JavaScript that runs only inside a sandboxed WKWebView with no network access, no
  cookies or website data, and no navigation. No code is downloaded from us; there is no store or catalogue; each
  user's apps live only on their device under 'My apps'. The only native features they can reach are a
  per-app storage area, Qutai's own dialogs and toasts, haptics and the clipboard (reading it asks the user each app).
  To try it: open a new tab, tap Ask, and type 'Build me an app to keep notes'."
- **Google Play, Device and Network Abuse** (<https://support.google.com/googleplay/android-developer/answer/9888379>):
  no downloaded dex/JAR/.so; "This restriction does not apply to code that runs in a virtual machine or an interpreter
  … (such as JavaScript in a webview or browser)", but interpreted code loaded at run time "must not allow potential
  violations of Google Play policies". The violation example is "a webview with added JavaScript Interface that loads
  untrusted web content": the runner has no `addJavascriptInterface` (react-native-webview's message channel only),
  loads no web content, and every message is checked.
- **Google Play, AI-Generated Content** (see docs/page-customisation.md): generated apps are AI output; the open
  question of an in-app report button applies to them too.

## 8. Phase 2: export, import and backup (19 Nov 2026)

The owner's request: apps can be exported, and are backed up (and therefore synced through the server backup) together
with their data. Decisions taken: sharing is by file only; apps are offline; available in every build. Code:
`src/apps/appFile.ts` (the file, pure), `src/apps/appBackup.ts` (the backup section, pure), `src/apps/store.ts`
(import, export and restore rows), `src/components/AppImport.tsx` (the import screen and the review shared with the
approval screen), `src/components/AppExport.tsx`, `src/device/appFile.ts` (pick, share, read an opened file),
`plugins/withAppFiles.js` (file association). Tests: `npm run test:apps` (file and backup round trips),
`npm run test:backup`.

### The export file (`.qutaiapp`)

**Container: one UTF-8 JSON object**, not a zip. Everything in an app is text (format 1 has no binary assets), JSON needs
no archive parser on the phone (no zip-slip, no compression bombs, no extra library), and anyone can open the file in
a text editor and read the code before importing it. A later file version can add a zip container for binary assets;
the `fileVersion` number says which one a file is.

```json
{
  "format": "qutai-app-file",
  "fileVersion": 1,
  "exportedAt": "2026-11-19T10:00:00.000Z",
  "exportedBy": "Qutai 0.1.1",
  "package": { "manifest": { … }, "files": { "index.html": "…", "app.js": "…" }, "sha256": "<packageHash>" },
  "data": {                                                       // only "With my data"
    "kv": [{ "key": "settings", "value": { … } }],
    "docs": [{ "collection": "notes", "doc": { "id": "…", "createdAt": 0, "updatedAt": 0, … } }],
    "bytes": 12345,                                               // as the store counts them (the 5 MB quota)
    "sha256": "<dataHash>"
  }
}
```

- **Only the current version** is exported. Versions are an undo aid on the phone that made them, not part of the
  app; 21 versions could be 10 MB. The manifest's `version` travels for information; an import starts at version 1.
- `author` is written as it is on this phone and ignored on import (Qutai sets `imported`). Grants (the user's
  answers) are never exported: the importing user answers for themselves.
- **Without data (default)**: the file is the code only. **With my data**: also every key-value entry and document
  of the app. The export sheet says why without is the default: the data can be personal (notes, lists) and goes
  wherever the file is sent.
- **Hashes.** `package.sha256` = `packageHash` (§1: the canonical manifest fields and the files);
  `data.sha256` = SHA-256 of `qutai-app-data-v1`, then each key-value entry (`k`, key, JSON value) sorted by key, then
  each document (`d`, collection, id, JSON) sorted by collection and id. Import recomputes both; a mismatch is refused
  as "damaged or changed after it was exported". **A hash is not a signature**: whoever edits a file can recompute
  it. The hash catches damage in transfer and careless edits; the protection against a deliberately changed app is
  the trust rules below (it arrives switched off and the user reads what it is), the same as for a file written by a
  stranger.
- **Limits** (checked before anything is stored, in this order): the file at most **8 MB** (refused before reading:
  512 KB of package and 5 MB of data with JSON's escaping fit well inside), valid UTF-8 JSON, the shape above,
  `format`, `fileVersion` ≤ 1 (newer: "This app was exported by a newer Qutai"), the package checks of §1 (manifest,
  files, 12 files, 256 KB per file, 512 KB in all, the SVG icon subset; `formatVersion` newer is refused, `contract`
  newer is accepted and the app is listed as "needs a newer Qutai"), the hash, and the data: keys, collection names
  and document ids by the contract's patterns, each value or document at most 256 KB, at most 20,000 entries, the
  total at most the **5 MB quota** counted as the store counts it, no key or document twice, `bytes` equal to the
  recount.
- **Name**: `<app name>.qutaiapp` (characters a file system dislikes replaced), with ` (with data)` when it has data so
  the user can tell the two apart in Files.
- **Type and "Open in Qutai"** (`plugins/withAppFiles.js`):
  - iOS: an exported type `com.sonsuzdongu.qutai.app` (extension `qutaiapp`, MIME `application/vnd.qutai.app+json`,
    conforms to `public.json`, so Files' Quick Look shows the code as text) and a document type with Qutai as its
    Owner (viewer role), `LSSupportsOpeningDocumentsInPlace` false: iOS copies an opened file into Qutai's
    `Documents/Inbox` and hands the app a `file://` URL (React Native's `Linking`); Qutai reads it and deletes the copy.
    Files, Mail, Messages, AirDrop and Safari's downloads then offer "Open in Qutai" / "Qutai" in the share sheet.
  - Android: a `VIEW` intent filter on the main activity, `DEFAULT` category and **not** `BROWSABLE` (a web page in
    any browser can't launch it with an `intent:` link), schemes `content` and `file`, MIME types
    `application/vnd.qutai.app+json` (what Qutai's own export sends) and `application/octet-stream` (what file
    managers and browsers call an unknown `.qutaiapp`, because Android can't match a `content://` address by its
    extension). The cost: Qutai appears in "Open with" for other unknown files too; it reads the file and says
    plainly when it isn't a Qutai app (a `.qutai` backup gets "restore it in Settings › Backup"). Owner decision.
  - Export shares with that MIME type (Android) and UTI (iOS) through the system sheet (save to Files, Drive,
    AirDrop, mail…).

### Import

**Where from** (each is a user's tap; nothing imports by itself):
- My apps › **Import an app** (the system file picker).
- Opening a `.qutaiapp` from outside: Files, a mail or chat attachment, AirDrop, another browser's downloads. It
  arrives as an entry (`src/device/entryPoints.ts`, kind `appFile`), waits for the app lock like every entry, and
  switches to a normal tab first.
- **Qutai's own downloads**: a finished `.qutaiapp` download opens the import screen when the user taps Open in
  Downloads or on the download pill; a web page can only start a download, never the screen. An incognito tab's
  download is not imported ("Apps can't be imported from an incognito tab"): incognito leaves nothing behind.
- Never from an incognito conversation and never by the assistant: the `apps` tool has no import.

**The import screen** (before anything is stored): the icon, name and description; "Imported from <file> · written by
someone else"; a plain warning ("Only turn on apps from people you trust. The app can't reach the internet or your
other data, but it can show anything, including text that asks for passwords: never type a password into an app."),
the size, the version it had, the permissions in plain words (each with "not available in this Qutai yet" when it is
a later phase's), the hosts it would ask for (phase 4), flags (code that mentions `RTCPeerConnection`,
`RTCDataChannel`, `iframe`, `frames[`, `window[0]`, `eval`, `Function(`: "uses techniques that apps normally don't
need"), the file list (tap a file to read its code, read-only, selectable), and, when the file has data, its count
and size with **Also bring in its data** (off; the user's consent).

**Trust rules** (`importPlan` in `src/apps/appFile.ts`, `AppStore.importApp`):
1. An imported app **arrives switched off and unsealed** (`apps.state = 'disabled'`, `seal` NULL, version source
   `import`, `author: { kind: 'imported', file, importedAt }`), with no grants. It never runs until the user turns it
   on: the runner shows the approval screen (the same review as the import screen, then **Turn on**), which seals it
   with this phone's key (`approveCurrent`).
2. **Ids**: a file whose app id is free on this phone keeps it (so a later, updated export of the same app can
   replace it); otherwise the user chooses.
3. **Clashes**: the same id, or the same name, as an app already here: **Keep both** (a new id; the name gets " 2",
   " 3"…) or **Replace "<name>"**. Replace adds the imported package as the next version of that app (the old
   versions stay in Versions, so going back is one tap), switches the app off until approved, drops its grants (the
   new code may differ) and keeps the phone's data. If the user also chose to bring in the file's data and the app
   has data here, a second confirmation names both sizes and says the phone's data will be deleted; no data is ever
   replaced silently.
4. **Data** is loaded only with the user's consent, in the same transaction as the app, after the same checks the
   bridge applies to writes (it can't exceed the quota).
5. **Errors** are one plain sentence with the technical line under Details: not a Qutai app (or a backup), damaged or
   changed, too large, exported by a newer Qutai, an app this Qutai can't read (a failing package check, with the
   reason), the file can't be read.

### Backup and restore

The apps go into the encrypted backup file (`src/backup/payload.ts`), which is also exactly what the server backup
stores (docs/server-backup.md), so the server needs no change: the backup is an opaque blob to it; account merge moves
whole backups and account deletion deletes them, without reading them.

```
apps?: { withData: boolean, items: [{ manifest, files, sha256, seal, state, grants, createdAt, updatedAt, openedAt?,
         data?: { kv, docs } }] }
```

- **Two switches** in Settings › Backup (file export) and in the server backup's "What goes in", next to the existing
  ones: **Apps** (on by default: they are the user's own work and small) and **Apps' data** (on by default: without it
  a restored notes app is empty, which is the loss a backup is for; the switch shows the current total, "1.2 MB").
  Server backups keep their own choice, like the other switches.
- **Only the current version** of each app (the same reasoning as the export file; bounded history would add up to
  10 MB per app for an undo aid). The seal and state go with it, and the grants; they count only on a phone whose key
  verifies the seal.
- **Size**: an app's package is at most 512 KB and its data at most 5 MB. Before a server upload the file is
  checked against the server's per-backup limit (`backups.maxBytes`, 50 MiB by default); **if it is over and apps'
  data is in it, the backup is made again without apps' data and uploaded**, and the screen says so ("Backed up
  without your apps' data: with it the backup was 61 MB, over your account's 50 MB"). The record of the last backup
  keeps that note. Without apps' data and still too large: the existing "too large" error (turn off conversations…).
- **Restore** (`applyBackup` → `restoreApps` in `src/apps/appBackup.ts`, inside the restore's one transaction): each
  app passes the package checks, its hash and (when present) the data checks again; a failing app is skipped, never
  the whole restore.
  - **Same phone** (the seal verifies with this phone's key: the device key in secure storage; a reinstall on iOS
    or Android makes a new key, so it counts as another phone): the app comes back as it was: on or off as it was,
    sealed, with its grants and data.
  - **Another phone**: switched off and unsealed, grants dropped, data intact (the same rule as kept scripts). The
    user turns it on from the approval screen.
  - **Merge** (the default): an app whose id is already here is kept as it is, with its versions and data (the
    phone's copy wins, like every merge kind); the backup's copy is skipped. New ids are added.
  - **Replace**: every app and its data on the phone is deleted and the backup's apps are written; the confirmation
    lists "Apps" among what is replaced. A backup made **without apps' data** keeps the phone's data of apps whose id
    it has (replace never empties an app because a switch was off).
- **Old backups** (no `apps`): apps on the phone are left alone. **An older Qutai** reading a backup with `apps`
  ignores the section (`parseBackup` keeps only the kinds it knows), restores the rest and doesn't crash; tested
  against the payload code of the last build before phase 2.

### The Android network block (native)

The patched `react-native-webview` (patches/react-native-webview+14.0.1.patch) gets one Android prop,
**`appSandbox`**, set by the runner only. With it:

- `WebSettings.setBlockNetworkLoads(true)`: the engine refuses every network load of the WebView.
- `shouldInterceptRequest` answers every request (`http`, `https`, `ws`, `wss`, `ftp`, any scheme but `data:`, `blob:`
  and `about:`) with an empty 403 at once, on WebView's own request thread: no JavaScript is involved. The local schemes
  pass because the app's own document arrives there as a `data:` request on recent WebViews (found on the emulator).
- `shouldOverrideUrlLoading` refuses every navigation natively **without waiting for JavaScript**, so the 250 ms
  timeout that let a navigation through while Qutai's JavaScript thread was busy is gone. The event still reaches
  the runner (with a lock id no one waits for), so "Navigation refused" stays in the diagnostics.
- A document-start script (`WebViewCompat.addDocumentStartJavaScript`, all origins) runs the **frame guard** in every
  frame the engine creates, including `about:blank` frames: it removes `RTCPeerConnection` and its relatives before any
  of the app's code can reach the frame.
- The phase-1 JavaScript checks stay as the second layer (CSP, the lockdown, `onShouldStartLoadWithRequest`,
  `onLoadStart` stopping and rebuilding).

iOS gets the frame guard too (`injectedJavaScriptBeforeContentLoaded` with `ForMainFrameOnly` off: a WKUserScript in
every frame), and both platforms get `<meta http-equiv="x-dns-prefetch-control" content="off">` before the app's head
(both engines honour "off", and it can't be turned back on). The break-out app adds cases for the busy-thread race
(a flood of bridge messages, then a navigation, a form and a link at once) and for `window[0]` from an `about:blank`
frame. What remains open on each platform is in §2 "What can't be blocked", updated with the phase-2 results.

## 9. Later phases (nothing in phases 1 and 2 blocks them)

- **Phase 2: export, import, backup**: done, §8.
- **Phase 3: more bridges**, each already in the contract table: share/files, location, notifications, camera/photos,
  links, assistant (with its per-question consent and cost line). Raise 4.7.2 with Apple first.
- **Phase 4: network to declared hosts** (`network.fetch` through Qutai, not the WebView's own fetch: CSP stays
  `connect-src 'none'`; Qutai checks host, method, sizes, no cookies) and a **home-screen shortcut** (`qutai://app/<id>`
  deep link opening the runner).

## 10. Owner decisions

1. Per-app quota 5 MB and 20 kept versions: enough?
2. ~~Should "Ask Qutai to fix this" send at once or put the message in the input first?~~ Input first, without the
   app's values (19 Nov 2026 security pass; the owner may change it).
3. Phase 3: ask Apple about 4.7.2 before building location/camera bridges?
4. A report button for AI-generated apps (with the general AI-report question)?
5. Privacy policy sentences (not added; legal version not bumped): "Apps you have Qutai build are stored only on your
   phone with their data. When you ask Qutai to make or change an app, the app's code (not its data) and any error
   messages it showed are sent to the AI provider as part of the conversation." Phase 2 adds: "Your apps and, unless
   you turn it off, their data are part of the backups you make (the file you export and the backup in your Qutai
   account), encrypted with your backup password. An app you export goes, with its data if you choose, wherever you
   send the file."
6. Phase 2: Android "Open with" also claims `application/octet-stream` (needed because Android can't match the
   extension of a content:// address): keep, or only Qutai's own MIME type?
7. Phase 2: backups keep only the current version of each app: enough, or the last few within a size budget?
8. Phase 2 defaults: My apps and My apps' data on in both backups; imported data off on the import screen; a server
   backup over the limit drops apps' data rather than failing. Confirm.
9. Phase 2: the residual risks in §2 "What can't be blocked" (after the frame guard and the Android sandbox): accept
   for imported apps?
