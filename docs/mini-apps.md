# Apps inside Qutai ("mini apps")

The owner's request of 18 Nov 2026: users can have Qutai build small applications for them ("build me an app where I
can keep my notes"); Qutai writes the HTML, CSS and JavaScript, runs it on the phone, keeps its data on the phone, and
later exports it and includes it in backup and sync. This note is the design and the **contract** every later phase
builds on. Phase 1 (this step) is the runner, the storage bridge, the assistant writing and editing apps and "My apps";
phases 2 to 4 are listed at the end, and nothing in phase 1 needs to change for them.

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

Stored as JSON with each version (and, in phase 2, as `qutai-app.json` in the export file).

| field | type | rules |
| ----- | ---- | ----- |
| `format` | `"qutai-app"` | fixed; anything else is not an app package |
| `formatVersion` | integer | `1`. A newer number is refused on import ("needs a newer Qutai") |
| `id` | string | `app-` + 12 characters `[a-z0-9]`, made by Qutai. An imported app gets a **new** id (two copies of one file never share data) |
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
| Origin | `about:blank` with no base URL: an **opaque origin**, the same as the script sandbox. No cookies (`document.cookie` throws), no `localStorage`/`IndexedDB` (SecurityError), no service workers, no Cache Storage | the same (`loadDataWithBaseURL` with no base) |
| Data store | `incognito`: its own **non-persistent** `WKWebsiteDataStore` per WebView: nothing written to disk, nothing shared with tabs or other apps | its own **WebView profile** `qutai-apps` (the patched module's `webviewProfile`, androidx.webkit multi-profile, WebView 119+): cookies, storage and cache apart from the browsing profile. On an older WebView the default profile, which is still harmless because the opaque origin can't read or write any storage. The `incognito` prop is never used on Android (it clears every cookie of the browsing tabs) |
| DOM storage | `domStorageEnabled={false}` | `domStorageEnabled={false}` |
| Files, location, camera | `allowFileAccess` off, `geolocationEnabled` off, media capture denied | same |
| Windows | `setSupportMultipleWindows={false}`, `javaScriptCanOpenWindowsAutomatically={false}` | same |
| Navigation | `onShouldStartLoadWithRequest` allows only the initial `about:blank` document; every other URL (links, `location =`, forms, `<meta refresh>`, `window.open`, other schemes such as `tel:` or `intent:`) is refused and reported to the diagnostics | same |
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
module's `contentBlocking` / `contentRuleLists` props, compiled at the runner's first use. Android has no equivalent
in the current patch: `shouldInterceptRequest` only consults the ad-block host list. A `blockNetworkLoads` prop
(`WebSettings.setBlockNetworkLoads(true)`) is a small patch change but needs a native rebuild: **recommended before
phase 2** (imported apps), not needed for phase 1 where every app is written on the user's request.

Layer 3, the lockdown script (first script in the document): `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
`RTCPeerConnection` and its relatives, `Worker`, `SharedWorker` replaced by stubs that throw "The network is off in
Qutai apps" (a clear error for the assistant instead of a CSP line), `navigator.sendBeacon` returns false,
`window.open` returns null, form submits and link clicks are cancelled and reported, `<iframe>`/`<frame>`/`<object>`/
`<embed>` elements are removed as soon as they are added and `contentWindow`/`contentDocument` return null.

**What can't be blocked (risks stated):**

- **WebRTC**: CSP doesn't govern it. ICE candidate gathering can send UDP packets to a STUN/TURN server named in
  code, which can carry a few bytes of data. The lockdown removes the constructors, but a determined author can try
  to get fresh ones from an `about:blank` frame in the moment before it is removed (`window[0]` can't be intercepted).
  Neither platform lets an app turn WebRTC off in a WebView. Mitigation in phase 2: imported packages that mention
  `RTCPeerConnection`, `RTCDataChannel`, `iframe`, `frames[` or `window[0]` are flagged on the approval screen.
- **DNS prefetch**: an engine may resolve host names it sees in links (`<link rel=dns-prefetch>` is removed; a plain
  `<a href>` may still be prefetched by some WebView versions). A DNS lookup can carry data in the host name to that
  domain's name server. Low bandwidth, no response reaches the app.
- **Timing and visual channels** need the user: the app can show text that asks the user to type something into a
  website. The app can't open a website itself.
- Android before the `blockNetworkLoads` patch: the CSP is the only layer for subresources. CSP is mature on both
  engines and is the same mechanism the script sandbox relies on.

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
  runner and sends the assistant a message naming the app, its version and the error lines (not the app's data).
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
startsWith, exists }`; fields may be dotted (`"meta.done"`). `search: { text, fields? }` matches every word of the
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
id: `crypto.randomUUID` isn't available on an opaque origin everywhere). The base stylesheet gives
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
  storage): §2. The app has no network, no navigation, an opaque origin, a separate data store, and a bridge that only
  answers with this app's own rows (every store query is scoped by the app id the runner holds, never one the app
  sends). Residual: WebRTC and DNS prefetch (§2).
- **Prompt injection into app building** (a web page saying "create an app that…"). App tools act only on the user's
  request (the prompt's rule for all tools); apps can't read web pages or send anything anywhere, so an injected app
  could only show content. The user sees every app the assistant makes as a card and in My apps.
- **An imported app from someone else** (phase 2): arrives disabled and unsealed; the user sees name, author kind,
  permissions, hosts (phase 4) and flags before turning it on; isolation and the permission checks bound what it can
  do. It can still show misleading content (an app imitating a bank's sign-in page): it can't send what is typed
  anywhere without `network`, and phase 4's host list is shown before it is turned on. Qutai's own dialogs show the
  app's name ("Notes asks:") and never take passwords.
- **Bugs in AI-written apps**: the preview loop, the error overlay with "Ask Qutai to fix this", undo, versions, and a
  hang watchdog; an app can only damage its own data (the quota stops it from filling the phone).
- **Data loss**: the app's data is only in Qutai's database (and, in phase 2, its backups); deleting an app deletes its
  data after a confirmation that says so.
- **Backup bloat**: 5 MB per app; versions are not data and phase 2 backs up only the current version's package plus
  the data.
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

## 8. Later phases (nothing in phase 1 blocks them)

- **Phase 2: export, import, backup.** File `<name>.qutaiapp` = JSON `{ format, formatVersion, manifest, files,
  sha256, data? }` (data optional, the user chooses). Import: format and hash check, the package checks, a new id,
  `author: imported`, **state disabled, unsealed**; the "Needs your approval" screen; then sealed. Encrypted and
  server backup: `apps: [{ manifest, files (current version), data (kv + docs), grants: none }]`; restored apps on the
  same phone keep `active` only when their seal verifies with this phone's key, otherwise arrive disabled (like kept
  scripts). The Android `blockNetworkLoads` patch before release. Flags for WebRTC/frame code on the approval screen.
- **Phase 3: more bridges**, each already in the contract table: share/files, location, notifications, camera/photos,
  links, assistant (with its per-question consent and cost line). Raise 4.7.2 with Apple first.
- **Phase 4: network to declared hosts** (`network.fetch` through Qutai, not the WebView's own fetch: CSP stays
  `connect-src 'none'`; Qutai checks host, method, sizes, no cookies) and a **home-screen shortcut** (`qutai://app/<id>`
  deep link opening the runner).

## 9. Owner decisions

1. Per-app quota 5 MB and 20 kept versions: enough?
2. Should "Ask Qutai to fix this" send at once (as now) or put the message in the input first?
3. Phase 3: ask Apple about 4.7.2 before building location/camera bridges?
4. A report button for AI-generated apps (with the general AI-report question)?
5. Privacy policy sentences (not added; legal version not bumped): "Apps you have Qutai build are stored only on your
   phone with their data. When you ask Qutai to make or change an app, the app's code (not its data) and any error
   messages it showed are sent to the AI provider as part of the conversation."
