# Page customisation: user styles, the cookie list and user scripts

The owner's request of 18 Nov 2026, done in two steps. **Step one: user styles and the cookie list.** **Step two
(19 Nov 2026): running JavaScript on a page with approval, and kept user scripts** (section "Scripts" below), with the
"which cookies" example done through the cookie tool rather than through page JavaScript.

## Rule kinds

All of the user's own page rules live in "My rules" (Settings › Privacy and security › Filter lists › My rules) and in
one table, `site_rules`.

| kind     | what it does                                   | stored as                                            | made by                         |
| -------- | ---------------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| `filter` | hide an element (`<scope>##<selector>`) or block a domain (`\|\|domain^`) | `line` (filter syntax), unchanged since the table was created | user, or `save_site_rules` |
| `style`  | a user stylesheet on the pages its scope covers | `line` = the scope, `body` = sanitised CSS, `name`    | user, or the assistant (`restyle_page` + the user's "Keep") |
| `script` | run JavaScript on the pages its scope covers ("Scripts" below) | `line` = the scope, `body` = source, `name`, `meta` = JSON (run time, approval seal, last run) | the user's "Keep" after a run they approved, or written by hand; every first run approved |

Hide and block rules are part of ad blocking: they are off while "Block ads and trackers" is off and on "Don't block on
this site" sites. Styles are not ad blocking: they apply whatever those switches say, and have their own escape hatch
("Styles off for this page", below).

### Storage and migration

Migration 21 (the one after the table's creation) adds four columns to `site_rules`:

```sql
ALTER TABLE site_rules ADD COLUMN kind TEXT NOT NULL DEFAULT 'filter';
ALTER TABLE site_rules ADD COLUMN name TEXT;   -- the readable name (styles, scripts)
ALTER TABLE site_rules ADD COLUMN body TEXT;   -- the CSS (styles) or the source (scripts)
ALTER TABLE site_rules ADD COLUMN meta TEXT;   -- JSON for kinds that need more (scripts: run-at, grants, hash)
```

Existing rows become `kind = 'filter'` and keep working unchanged. `SiteRuleStore` (`src/storage/siteRules.ts`) keeps
`rules` (filter rules only, as before, so every existing caller is unchanged) and adds `styles`. Reading a row of a kind
this version does not know skips it, so a database written by a later version (with scripts) is never misread.

`site` is the site the rule was made on (a site key), as for filter rules; styles are listed under it in "My rules",
except "everywhere" styles, which are listed under their own heading.

### Scopes

Styles reuse the hide rules' scopes and their dialog (`pickScope` in `SiteRulesSection.tsx`) plus one more:

- this page (address without the `#fragment`), pages under this path, this site, this site and its subdomains (the
  default), as for hide rules (`src/content/siteRules.ts`: `scopeForUrl`, `matchesScope`, `www.` is the same site);
- **everywhere** (`*`, styles only: hide rules can't have it because a selector that hides an ad on one site hides
  content on another).

The page script repeats the matching in ES5 (as `siteRulesScript` does) and re-evaluates it after SPA navigations.

## Styles

### The flow

1. The user asks ("make the links red", "bigger text on this site", "dark background here"). The model calls
   `restyle_page` `apply` with `css` and a short plain-language `description`.
2. The app sanitises the CSS (below). Anything refused goes back to the model with the reason; nothing is applied.
3. **Approval**, every time (never "don't ask again", whatever the site's setting): the description, the site, the
   CSS under Details. Refused on "Blocked" and "Read only" sites (`decide()` in `src/agent/sitePolicy.ts`).
4. On approve the CSS is applied at once to the tab (a "trial" style element) and the chat gets a **style card**:
   the description, **Keep…** (picks the scope; saves to "My rules") and **Undo** (removes the trial at once). The
   trial lasts until the tab loads another page; Undo still works later (it is then a no-op on the new page).
5. In an incognito tab the card offers no Keep (the note says why): nothing is written from incognito.
6. The model can also `undo` the trial and `list` the kept styles that apply to the page (ids, names, scopes). It
   can't delete or edit kept styles: the user does that in "My rules".

### Kept styles in "My rules"

A "Styles" part of "My rules", not greyed out by the ad blocking switch: each style with its name, where it applies,
who made it, an on/off switch, **Edit CSS** (re-sanitised on save; refused CSS is not saved and the reason is shown),
**Rename**, **Change where it applies**, **Delete**. "Add a style" lets the user write one by hand (site → CSS → name).

### Injection

- **When:** at document start in the main frame, through `injectedJavaScriptBeforeContentLoaded` (both platforms),
  so the page never shows unstyled first; again after load (Android may run the early script for the previous page),
  and on every change of the kept styles (switch, edit, delete, a backup restored) through `injectJavaScript` into
  the open pages, as hide rules do.
- **Where:** one `<style data-qutai="user-styles">` element, moved to the end of the document at DOMContentLoaded and
  load so it comes after the page's own sheets; every declaration is written with `!important` by the sanitiser, so
  "links red" wins over the page's own rules and inline styles.
- **SPA navigations:** `pushState`/`replaceState`/`popstate`/`hashchange` re-evaluate the scopes (a page-scoped style
  goes away when the app moves to another address).
- **Frames:** main frame only (step one). A frame is often another site; a style of the page's site should not
  restyle an embedded map or video player, and an "everywhere" style in every ad frame costs memory for nothing.
- **Excluded:** the reader view and the PDF view are separate WebViews and never get user styles; the new tab page
  and Qutai's own screens are not web pages. Styles never reach anything outside the page: the address bar, menus and
  dialogs are native views.
- **Incognito:** kept styles apply in incognito tabs, matching the existing behaviour of hide rules (the user's own
  rules apply in every tab); only writing from an incognito tab is refused.
- **Escape hatch:** whenever a kept or trial style applies to the current page, the page menu shows **Styles off for
  this page** (turns them all off for this tab until it is switched on again or the tab is closed; in memory only) and
  then **Styles on for this page**. A broken style can always be switched off, then fixed or deleted in "My rules".

### CSS sanitising (`src/content/userCss.ts`)

The CSS is **parsed**, not pattern-matched: a tokenizer that follows CSS Syntax Level 3 (comments, escapes, strings,
`url(` tokens, functions, at-keywords; escapes are decoded before any name is checked), a parser for rules, at-rules
and declarations, and a serialiser that writes the result back from the parse (comments dropped, every declaration
`!important`). Only what is written back is stored and injected, never the input.

Allowed (the safe subset):

- style rules: selector `{ declarations }`;
- `@media` and `@supports` with nested style rules (one level of nesting; no `@media` inside `@media`);
- declarations of any property spelled as a CSS identifier (letters, digits, `-`), including custom properties
  `--name`, with values made of identifiers, numbers, dimensions, percentages, hash colours, strings, commas,
  slashes, operators and these functions: colour functions (`rgb`, `rgba`, `hsl`, `hsla`, `hwb`, `lab`, `lch`,
  `oklab`, `oklch`, `color`, `color-mix`, `light-dark`), maths (`calc`, `min`, `max`, `clamp`, `round`, `mod`,
  `rem`, `abs`, `sign`, trigonometric), `var`, `env`, gradients (`linear-gradient`, `radial-gradient`,
  `conic-gradient` and their `repeating-` forms), transforms, filters, `cubic-bezier`, `steps`, `minmax`, `repeat`,
  `fit-content`, `counter`, `counters`;
- `url()` only with a `data:image/png|jpeg|gif|webp;base64,` address (no SVG: an SVG can reference other files).

Refused (the whole stylesheet is refused with a reason; nothing is silently dropped, so the user sees exactly what
runs):

- `@import`, `@font-face`, `@namespace`, `@charset`, `@page`, `@layer`, `@property`, `@container`, `@scope`,
  `@keyframes` and every other at-rule, however written (`@\69mport`, `@IMPORT`, with comments in between);
- `url()` with anything but a raster `data:` image, in any spelling (`URL(`, `u\72l(`, `url( "…" )`, unquoted,
  escaped, split by comments), and every function that can take an address or load something: `image-set`,
  `-webkit-image-set`, `image`, `cross-fade`, `element`, `paint`, `src`, `attr` (it can read attribute values into
  the page and, typed as `url`, load them), `expression`, and any function not on the list above;
- properties that load or run something: `behavior`, `-moz-binding`, `src`;
- selectors that reach Qutai's own page elements: anything mentioning `qutai` (after escapes are decoded);
- `<`, `</style`, NUL and unbalanced brackets or strings; more than 16 KB of CSS, more than 200 rules.

Why this is enough against the CSS threats: a stylesheet can only make network requests through `@import`, `url()`
and its relatives, `image-set()`, and `@font-face` sources, all refused; without a request, attribute selectors
(`input[value^="a"]`) can't send anything anywhere. Visual spoofing (covering the page with fixed boxes or `content:`
text) is possible in principle, but every style is approved by the user, shown under Details, and can be switched off
from the page menu.

### Export, import, backup

- **Rules file**, version 2: still a text file of filter lines (other blockers read the filter lines and ignore the
  rest), now starting with `! Qutai-Format: 2`; each style is a block of comment lines, so other blockers and older
  Qutai versions skip it:

  ```
  ! [style] {"name":"Red links","scope":"*.example.com","enabled":true}
  ! | a { color: red !important; }
  ! [end]
  ```

  Files without the header are version 1 and read as before. Imported styles are sanitised like the assistant's;
  styles that fail are counted as invalid. When a file has styles, the app lists them (name and where) and asks
  **Import switched on** / **Import switched off** before anything is added.
- **Encrypted backup and server backup** (`src/backup/payload.ts`, one format for both): a new optional array
  `sites.styles` (`name`, `scope`, `css`, `enabled`, `source`, `site`, `url`, `createdAt`), sanitised again on
  restore. Older versions ignore the unknown array (they don't lose their own data); scripts will get their own array
  (`sites.scripts`) so that a version that can't vet scripts never accepts them as something else.

## Cookies

### Where they come from

Page JavaScript can't see HttpOnly cookies, so the list comes from the WebView's native cookie store, through two
methods added to the patched react-native-webview module (no new dependency; a native rebuild is needed):

- **Android:** `CookieManagerCompat.getCookieInfo` (androidx.webkit 1.14, feature `GET_COOKIE_INFO`) for the page's
  address and the addresses of the third-party hosts the page loaded from (up to 20, from the page's resource
  timing), in the tab's own cookie store (the default profile, or the incognito profile, see `webviewProfile.ts`).
  It gives each cookie as a `Set-Cookie` line with its attributes. On a WebView without that feature the plain
  `CookieManager.getCookie` gives names and values only: the list then says that flags and expiry are unknown.
- **iOS:** `WKHTTPCookieStore.getAllCookies` of the tab's own data store (the default store, or the incognito tab's
  own non-persistent store, found through a key the tab gives its WebView), filtered to the cookies whose domain and
  path match the page or one of its third-party hosts. `HTTPCookie` gives name, domain, path, expiry, Secure,
  HttpOnly, SameSite and session.

Deleting: Android writes an expired cookie with the same name, domain, path and Secure flag; iOS deletes the
`HTTPCookie` object. Both then flush.

### What each platform can't tell

- **First- or third-party** is worked out by Qutai from the cookie's domain against the page's site (same registrable
  domain = first-party); the store does not record who set a cookie.
- **Partitioned cookies (CHIPS)** and cookies WebKit keeps per top-level site (Intelligent Tracking Prevention) are
  not shown as such: iOS doesn't expose the partition; Android lists only what it would send to the address asked.
- **Third-party cookies** are usually absent: iOS blocks them, and Android does while "Block third-party cookies" is
  on. An empty third-party part means none were stored, not that none were tried.
- **Size** is the name plus the value in characters, as browsers count it.
- **SameSite** missing means the cookie didn't set it (browsers then treat it as Lax).

### The tool and the view

`page_cookies` `list`: the cookies that apply to the current page, grouped by domain, each with a handle (`c1`,
`c2`…), name, domain, path, expiry or "session", size, HttpOnly, Secure, SameSite, first- or third-party. **Never a
value**: the native result is turned into this metadata by one function (`cookieMetadata` in
`src/content/cookieInfo.ts`) that copies named fields only, and the model's text is built from that. The chat gets a
**cookies card** ("Show cookies") that opens the Cookies view.

`page_cookies` `delete` with handles: the app shows the cookies by name and domain and asks; deleting signs the user
out of the site, and the dialog says so. Refused on "Read only" and "Blocked" sites; listing is refused on "Blocked"
sites only.

The **Cookies view** (from the card, from the page menu, and from the site's permission sheet): the same list grouped
by domain; each value hidden until the user taps **Show value**, then **Copy**; **Delete** one, or **Delete all for
this site**, each behind a confirmation that says the user may be signed out. Values live only in the view's memory
while it is open: never logged, never in the action history, "What was sent to the AI", memory or backups.

Incognito tabs list their own separate store (iOS: the tab's own store; Android: the incognito profile; on an old
Android WebView without profiles incognito tabs share the normal store, as the incognito notice already says).

## Threat model

- **Page text asking the assistant to restyle or list cookies.** Only the user's own request counts (the prompt says
  so, as for settings and site rules). A restyle needs the user's approval with the CSS shown; a delete needs the
  user's approval; a list returns no values. A page can't approve anything.
- **CSS as an attack.** Network loads and exfiltration: refused by the sanitiser (above). Hiding Qutai's own UI:
  impossible (native views), and Qutai's in-page elements can't be selected. Making the page unusable: the page menu's
  "Styles off for this page".
- **Cookie values reaching the model or a page.** Values never leave the native result except into the Cookies
  view's state; the model gets metadata only, and tests assert that no value can pass `cookieMetadata` or the
  tool's text. Nothing read from the cookie store is injected into a page.
- **A malicious rules file or backup.** Styles from either are sanitised again; a file's styles are listed and added
  only after the user's choice.
- **Incognito.** Nothing is written from an incognito tab (no kept style, no action history entry); the cookie list
  of an incognito tab is that tab's own store.

## Scripts

Running a script is the riskiest thing the assistant can do: page content can try to instruct the model (prompt
injection), and a script on the live page runs with the user's sign-in on that site. The rules agreed for this step,
and how each is met:

1. **Off by default.** Settings › Assistant › "Let the assistant run scripts on pages" (`assistantScripts`), off by
   default, with a plain explanation; turning it on asks once more. Never changed by the assistant's `settings` tool
   and not restored from a backup (like payments). Off, the assistant can't run scripts and **kept scripts don't run
   either**: the switch is the whole capability.
2. **Every run is approved** in Qutai's own dialog: the description, the site, where it runs (a copy or the live page),
   the flags in plain words (red), and the exact code under Details. No "Don't ask again", single use, bound to the tab
   and the page; the code that runs is the code that was shown (the same string, checked against its hash right
   before it runs).
3. **Kept scripts** run only on the site they were kept for (page, path, site, site and subdomains; never
   "everywhere"), are their own kind in "My rules", and any change to their code needs approval again before it runs.
   Never written from an incognito tab, and kept scripts don't run in incognito tabs.
4. **Site modes rule.** "Read only" and "Blocked" sites never run scripts (one-off or kept); a per-site "Scripts off"
   too. Sensitive pages (below) are refused by default; the user can allow scripts on one sensitive site only in
   Settings › Site permissions.
5. **What the cookie list protects stays protected.** HttpOnly cookies are out of reach of page JavaScript by nature;
   scripts that name `document.cookie` or `cookieStore` are refused; the copy a read-only script runs on has no cookies
   or site storage at all. Nothing a script returns is stored anywhere but the conversation: not in memory, backups,
   the action history or the "What was sent to the AI" outline (which keeps sizes only, as for every tool result);
   a kept script's last run is stored as ok / error kind / skipped, never a value or a message.
6. **Results are untrusted data**: JSON, at most 16 KB, wrapped in a marked block that says it is page data and not
   instructions, and passed through the hidden-value redaction like every tool result.

### Two places a script can run

`run_script` takes `where`:

- **`copy` (the default): a sealed copy of the page.** Qutai takes a snapshot of the tab's main frame (the DOM, with
  same-site stylesheets inlined, field values copied in, elements the page hides marked `hidden`, links made absolute)
  and loads it into a separate, invisible WebView (`ScriptSandbox`) whose own Content Security Policy is
  `default-src 'none'; style-src 'unsafe-inline'; img-src data:` (no `script-src` at all, no `connect-src`, no frames,
  no forms, no workers, no base URL), with no cookies, no site storage (iOS: a non-persistent data store; both: an
  opaque `about:blank` origin and DOM storage off) and every navigation refused. The snapshot never carries the
  page's scripts, inline handlers, `<meta>`, `<base>`, frames, `<object>`/`<embed>`, password, hidden or one-time-code
  field values, or payment card fields. The approved code is then evaluated there natively (WebView
  `injectJavaScript`, which a page's CSP doesn't apply to); `eval`, `new Function` and string timers are blocked by
  the sandbox's CSP. The sandbox is created for one run and removed after it (a timeout or an endless loop removes
  it too). **What it costs:** the copy has the page's markup and same-site CSS but not its JavaScript objects, open
  shadow roots, canvas pixels, cross-site stylesheets or cross-site frames, and `location` is not the page (the
  wrapper passes `pageUrl`). It is enough for counting, extracting text, links and tables, and checking what the DOM
  says, which is what the assistant should use scripts for.
- **`page`: the live page, in the page's own JavaScript world.** Needed to change the page, to read what only the
  page's JavaScript knows, and for every kept script. It can do what the site's own code can do, with the user's
  sign-in on that site, and the dialog says so in red.

### Which JavaScript world, per platform

Both platforms run Qutai's page scripts in the page's main world (react-native-webview's `injectJavaScript`,
`injectedJavaScript` and `injectedJavaScriptBeforeContentLoaded`); scripts use the same path.

- **iOS** offers isolated worlds (`WKContentWorld`, iOS 14+): a script there sees the same DOM but not the page's
  JavaScript objects, and the page can't see or tamper with it. react-native-webview 14 doesn't expose content worlds,
  so using one needs a native patch and a rebuild. **Not used in this step**, because what it protects against (the
  page tampering with the script or faking its result) is already covered by treating results as untrusted page data,
  and it does nothing against the real risk (the script itself misusing the user's session). It would also make kept
  scripts behave differently on the two platforms.
- **Android** has no isolated worlds for WebView (`evaluateJavascript` and `addDocumentStartJavaScript` both run in
  the main world).

So on both: **DOM: yes. The page's own JavaScript objects: yes (page mode). The page can see and override what the
script uses**, which is why the wrapper (below) takes its guarded functions as parameters rather than from `window`,
and why nothing the script reports is trusted.

**Frames: main frame only.** A frame is usually another site (a payment form, a sign-in widget, an ad); a script
approved for the page's site must not reach it, and the copy leaves frames out. Scripts can't reach frames from the
main frame either: `contentWindow`, `contentDocument`, `frames`, `top`, `parent`, `opener` are refused.

### The wrapper

Every script, one-off or kept, copy or page, is wrapped the same way (`wrapScript` in `src/content/userScripts.ts`):

```js
(function () {
  var run = (function () {
    return async function (pageUrl, fetch, setTimeout, setInterval) { "use strict";
<the approved code>
    };
  })();
  /* Qutai's runner: calls run(...) with guarded functions, a time limit, JSON.stringify with a cap, and posts
     the reply with the tab's nonce; none of its names are in the code's scope */
})();
```

The code can't **break out** of its function: the static check tokenizes it (strings, template literals, comments,
regular expressions, Unicode line terminators) and refuses code whose brackets don't balance or go below zero, and the
places where a tokenizer and the engine could disagree (a `/` after `}`, after `await`/`yield`/`of`/`let`, HTML-like
comments `<!--` / `-->`, backslashes outside strings), so the scope check and the "this site only" promise can't be
escaped by `})(); evil(); (function(){`. Strict mode makes `with` and assignments to undeclared names errors.

`fetch` inside the code is Qutai's guard (the real one is reachable only through names the check refuses): same
origin as the page only, `GET` or `HEAD` only, no body, redirects not followed (`redirect: 'manual'`, so an open
redirect can't carry data elsewhere). In the copy there is no network at all. `setTimeout`/`setInterval` take
functions only. Returns: any JSON value, a string or nothing; `undefined` becomes "no value"; values that
`JSON.stringify` can't handle become `String(value)`; the page cuts the JSON at 64 KB, the app at 16 KB (marked as
cut). Errors come back as their kind and message (cut at 300 characters). Time limit: 10 seconds; the copy is then
destroyed, while on the live page the app stops waiting but **can't stop a script that loops forever** (it blocks
the page until reloaded; the result says so).

### The static check (`src/content/scriptCheck.ts`)

A tokenizer for JavaScript, then rules over the tokens (identifiers and property names compared after their escapes
are decoded; escapes in identifiers are refused outright). Size: at most 16 KB and 400 lines.

**Refused, any mode** (the reason goes back to the model; nothing is shown to the user):

- loading or making code: `import(…)`/`import.meta`, `importScripts`, `eval`, `Function`, `.constructor`,
  `document.write`/`writeln`, `createElement` of `script`, `iframe`, `frame`, `object`, `embed`, `link`, `meta`,
  `base` or of a computed tag, `srcdoc`, `Worker`, `SharedWorker`, `serviceWorker`, `WebAssembly`, `Blob` +
  `createObjectURL`, strings holding `<script`, `<iframe`, `javascript:` or `on…=` handlers;
- other network channels: `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `WebTransport`,
  `RTCPeerConnection` and its relatives;
- cookies and secrets: `cookie`, `cookieStore`, strings naming `password`, `one-time-code`;
- leaving the page or the frame: `location` changes, `open`, `history.back/forward/go`, `contentWindow`,
  `contentDocument`, `frames`, `top`, `parent`, `opener`, `frameElement`, `postMessage`;
- sending in the user's name: `submit`, `requestSubmit`, `.click()`, `dispatchEvent`, synthetic events (`new
  MouseEvent`…): pressing and sending stay with the click and type tools, where `request_approval` and the payment
  button checks apply;
- the clipboard (`clipboard`, `execCommand`);
- Qutai's own objects (`ReactNativeWebView`, `webkit.messageHandlers`, anything starting `__qutai`);
- what can't be checked: computed access on `window`, `self`, `globalThis`, `document`, `navigator`, `location`,
  `this`; those objects used as values (`const w = window`); `Reflect`, `Proxy`, `__proto__`, `with`, `atob`,
  `fromCharCode`, `fromCodePoint`, `unescape`; computed keys built with `+` or a template; string escapes that spell
  plain ASCII letters (`'\\x66etch'`); `setTimeout`/`setInterval` with a string.

**Flags, shown in red in the dialog when the script may run:**

| flag | plain words | copy | page | kept |
| ---- | ----------- | ---- | ---- | ---- |
| `changesPage` | "Changes the page" | allowed (it changes the copy only, not shown) | allowed, red | allowed, red |
| `network` | "Loads pages from this site as you (reading only)" — `fetch` | refused (no network in a copy) | allowed, red | allowed, red |
| `storage` | "Reads or changes what this site stores on your phone" — `localStorage`, `sessionStorage`, `indexedDB`, `caches` | refused (none in a copy) | refused (results go to the AI: tokens live there) | allowed, red |
| `fields` | "Reads what is typed in the page's fields" — `.value` of inputs | allowed (secret fields are empty in the copy) | allowed, red | allowed, red |

**Honest limit:** a static check is a filter, not a sandbox. It stops the plain and the usual obfuscated ways; a
determined author can still hide behaviour in data-driven code (a computed method name built from page text, a page
change that makes the page itself load an address with data in it — an image, a link). That is why every run is
approved with the code shown, why the dialog says what an approved script can do, and why read-only work goes to the
copy, where the sandbox — not the check — enforces "no network, no session".

### Sensitive pages (refused by default, both modes)

`sensitivePage(url, facts)` in `src/content/userScripts.ts`; `facts` come from the page (`scriptFacts`):

- a password field, a one-time-code field (`autocomplete="one-time-code"`, or a short numeric field named or labelled
  like otp / 2fa / verification code / doğrulama kodu…), or payment card fields (`autocomplete="cc-*"`, names like
  card number / cvc / cvv / iban) anywhere in the main frame;
- an address that looks like sign-in, payment or account security: paths with `login`, `signin`, `sign-in`,
  `oauth`, `auth`, `checkout`, `payment`, `pay`, `billing`, `password`, `2fa`, `mfa`, `security`, `wallet`;
- hosts of payment and identity providers (PayPal, Stripe, Adyen, Klarna, iyzico, Google Pay, Apple ID, Google
  accounts, Microsoft sign-in, Okta, Auth0…) and bank-like hosts (a host label containing `bank`, and a short list of
  well-known banks).

The user can allow scripts on one such site in Settings › Site permissions › the site › "Scripts" ("Allowed on
sensitive pages"); not from the dialog, the chat or the assistant. Kept scripts check the same facts in the page right
before they run and skip the page ("skipped: sensitive page") unless the site has that setting.

Other refusals before the dialog: the setting is off (the model is told to explain where to switch it on, never to ask
the page); a pending publish or pay approval for the tab (a script could press or change what the user just
approved); the reader view, the PDF view and the new tab page (not web pages). One-off scripts may run in incognito
tabs (nothing is written; the copy lives in memory), but Keep isn't offered there.

### Kept scripts

- **Keep:** after a successful `page` run the chat shows a script card with **Keep for this site…** (not in
  incognito) → where (this page, pages under this path, this site, this site and subdomains — default "this site") and
  when (when the page is ready — default — or when it has finished loading) → saved to "My rules". Keeping is the
  user's tap on code they just approved on that site: no second approval.
- **Approval seal:** `meta.seal` = HMAC-SHA-256 of the code under a device key kept in secure storage (never in a
  backup). A kept script runs only while its seal matches its code. Editing the code, importing it, or restoring it
  on another device leaves it without a valid seal: it is listed as "Needs your approval" and is switched off until
  the user approves it (the same dialog with the code). The device key also makes a backup or file that claims a
  script was approved worthless.
- **Run time:** `end` (DOMContentLoaded; default) or `idle` (after `load`, when the page is idle). No `start`: before
  the page exists there is nothing to check for sensitive fields, and a script that must beat the page's own code is
  a different risk (cost: no "block the page's own script" userscripts).
- **Injection:** every enabled, sealed kept script whose site is allowed is shipped in the main frame's early and
  after-load scripts (iOS `WKUserScript`, Android `injectedJavaScriptBeforeContentLoaded` + `injectedJavaScript`),
  each in its own wrapper, with its scope; the page matches the scope against `location` (as styles do), checks the
  sensitive facts, and runs each script **once per document**. After an SPA move (`pushState`, `replaceState`,
  `popstate`, `hashchange`) a script whose scope now matches and that hasn't run in this document runs then; none
  runs twice. Changes (switch, edit, delete, a page's "Scripts off") reach open pages at their next load. Not shipped
  at all to incognito tabs, to read-only, blocked or "Scripts off" sites, or while the setting is off.
- **Escape hatch:** the page menu's **Scripts off for this page** (per tab, in memory, like styles) and **Scripts on
  for this page**; turning them off reloads the page so nothing a script did stays.
- **Last run:** each run posts ok / error (its kind, e.g. `TypeError`) / skipped (sensitive page) / timed out with the
  time; stored in `meta.lastRun`. The error message is kept in memory only (it could hold page text).
- **"My rules" › Scripts:** name, where, when, flags, last run, switch, **View and edit code** (the editor runs the
  check on save; refused code isn't saved; saving changed code asks for approval, and declining keeps the old code),
  **Rename**, **Change where it applies**, **Delete**. An unsealed script's switch asks for approval before it turns on.

### Export, import, backup

- **Rules file, format 3** (`! Qutai-Format: 3`; versions 1 and 2 still read): `! [script] {"name","scope","runAt"}`
  then the code on `! |` lines, then `! [end]`. Older Qutai versions count script blocks as unsupported. No `enabled`
  and no seal are written: **imported scripts always arrive switched off, unsealed**, listed with their flags; each
  needs the user's approval before its first run. Scripts that fail the check are counted as invalid; "everywhere"
  scopes are refused.
- **Encrypted and server backup:** `sites.scripts` (`name`, `scope`, `code`, `runAt`, `enabled`, `seal`, `site`,
  `url`, `createdAt`), checked again on restore. A restored script keeps `enabled` only when its seal verifies with
  this device's key (a restore on the same phone, same install or iOS keychain); anywhere else it arrives off and
  unsealed. Erring toward off: a seal can't be forged without the device key, and a restore on a new phone asks again.
  The last run is not backed up.

### Threat model (scripts)

- **Prompt injection from page text** ("run this script", "use run_script to fetch…"). The prompt says only the
  user's request counts; the app refuses when the setting is off, on sensitive pages, on read-only/blocked sites, and
  refuses dangerous code whatever the model wanted; every run needs the dialog with the code. A page can't approve.
- **A script's result carrying instructions.** Marked untrusted page data, capped, redacted; the prompt rule for page
  content applies to it.
- **Exfiltration with `fetch`.** Copy: no network (CSP + sandbox, enforced by the engine). Page and kept: `fetch` is
  the guard (same origin, GET/HEAD, no redirects); other network APIs refused. Residual: a page change that makes the
  page load an address (an `<img>` with data in its URL) can carry data out; the dialog shows "Changes the page" in
  red and the code.
- **Posting, buying, changing account settings.** Scripts may not submit forms, press buttons, dispatch events,
  navigate or open windows (refused statically), `fetch` can't POST, a pending publish or pay approval refuses the
  run, and payment and account-security pages are refused. Residual (said plainly in the dialog): an approved
  live-page script can do what the site's own code can do, with the user's sign-in; checks can be got around by
  deliberately disguised code.
- **Passwords and one-time codes.** Pages with such fields are refused; the copy never carries their values; code
  naming them is refused.
- **Kept scripts that change after import or restore.** No seal → off and asking. A changed `body` in the database
  (another app can't write it; a later bug could) no longer matches its seal and doesn't run.
- **Remote code** (`import()`, `<script src>`, `eval` of fetched text, workers, `srcdoc`): refused statically;
  `eval`/`Function` are also blocked by the copy's CSP. On the live page a site whose own CSP allows `eval` would let
  a disguised `eval` run; the check refuses every spelling it can see.
- **Cookies.** `document.cookie` refused; HttpOnly unreachable; nothing from the native cookie store ever reaches a
  script.
- **The page tampering with the script** (overriding `JSON.stringify`, `fetch`, `postMessage`, or faking a result
  message). It can, as it can fake any page content; the result is untrusted and only ever shown to the model as page
  data; the guarded `fetch` is captured before the code runs but a page that ran first can have replaced
  `window.fetch` (the guard then calls the page's version: no more than the page could do itself).
- **Incognito.** One-off scripts allowed (nothing written; the copy is in memory); no Keep; kept scripts don't run.

### Store policies (checked 19 Nov 2026)

- **Apple, App Store Review Guidelines** (<https://developer.apple.com/app-store/review/guidelines/>):
  - 2.5.2 forbids apps that "download, install, or execute code which introduces or changes features or functionality of the app".
  - 2.5.6 requires browsers to use WebKit, which WKWebView does.
  - 4.7 allows "software that is not embedded in the binary" (HTML5/JavaScript mini apps, chatbots, plug-ins). It asks for:
    - no native APIs exposed to that software without permission (4.7.2);
    - consent for any data sharing (4.7.3);
    - an index of the software offered (4.7.4);
    - age gating (4.7.5).

  Assessment: scripts here are written by the user or the assistant on the user's request, approved one by one, and run only inside page content. They add no app features, and Qutai serves no catalog. So 2.5.2 and 4.7 most likely don't apply, but this is not certain: a reviewer could read AI-written scripts as "chatbots/plug-ins".

  Review notes should say:
  - no code is downloaded from the developer;
  - scripts run only in WKWebView page content, and the message bridge gives them nothing native;
  - every run is shown and approved by the user;
  - imported scripts arrive switched off;
  - the feature is off by default;
  - there is no store of scripts.

  Context only (a different mechanism, Safari web extensions under 4.4): the "Userscripts" app is on the App Store (<https://apps.apple.com/app/id1463298887>).
- **Google Play, Device and Network Abuse** (<https://support.google.com/googleplay/android-developer/answer/9888379>):
  - Apps may not download executable code such as dex, JAR or .so files. This "does not apply to code that runs in a virtual machine or an interpreter … (such as JavaScript in a webview or browser)", which fits this feature.
  - The policy's example of a violation is "a webview with added JavaScript Interface that loads untrusted web content". Qutai's pages reach the app only through react-native-webview's `postMessage` bridge. Every message is checked against the tab's nonce and the known command shapes, and nothing native is callable from a page.
- **Google Play, AI-Generated Content** (<https://support.google.com/googleplay/android-developer/answer/14094294>, <https://support.google.com/googleplay/android-developer/answer/13985936>):
  - It lists "malicious code creation" as violating output. The static check and the refusals are the answer to that.
  - It asks for an in-app way to report or flag offensive AI output. Whether Qutai's assistant needs one, and whether it counts as an AI "productivity" feature that is exempt, is an owner decision (TODO.md).

Not verified: the dates of the current versions, the full text of Play's Malware and Mobile Unwanted Software pages, and the last part of Apple's page. Nothing in the code needs to change before a store release. The review notes above and the AI-report question are open.
