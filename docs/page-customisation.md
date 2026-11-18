# Page customisation: user styles, the cookie list, and (next) user scripts

The owner's request of 18 Nov 2026, done in two steps. **Step one (this note, shipped): user styles and the cookie
list.** Step two (a later session): user scripts, with the "which cookies" example done properly through the cookie
tool below rather than through page JavaScript. Everything here is designed so scripts slot in as one more kind.

## Rule kinds

All of the user's own page rules live in "My rules" (Settings › Privacy and security › Filter lists › My rules) and in
one table, `site_rules`.

| kind     | what it does                                   | stored as                                            | made by                         |
| -------- | ---------------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| `filter` | hide an element (`<scope>##<selector>`) or block a domain (`\|\|domain^`) | `line` (filter syntax), unchanged since the table was created | user, or `save_site_rules` |
| `style`  | a user stylesheet on the pages its scope covers | `line` = the scope, `body` = sanitised CSS, `name`    | user, or the assistant (`restyle_page` + the user's "Keep") |
| `script` | *(step two)* run JavaScript on the pages its scope covers | `line` = the scope, `body` = source, `name`, `meta` = JSON | step two decides |

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

## Step two: what the script session needs

- **Storage:** `kind = 'script'` rows in `site_rules` with `line` = scope, `body` = source, `name`, `meta` = JSON
  (at least `runAt` (`start` | `end`), the approved source's hash, `approvedAt`, and any grants). `listSiteRules`
  already skips kinds it doesn't know; add `scripts` to `SiteRuleStore` like `styles`.
- **UI:** "My rules" already groups by kind; add a "Scripts" part beside "Styles" with the same row (switch, edit,
  rename, scope, delete) and the same page-menu escape hatch ("Scripts off for this page").
- **File and backup:** a `! [script] {…}` block in the rules file and a `sites.scripts` array in the backup; import
  must list scripts and add them **switched off** (a script is not low risk like a style), with the source shown.
- **Approval:** a script is not low risk: show the source, say what it can do (read and change the page, read
  non-HttpOnly cookies, send requests as the user), never "don't ask again"; refused on "Read only" and "Blocked"
  sites; never written from incognito.
- **Running it:** `injectedJavaScriptBeforeContentLoaded` for `runAt: start`, `injectedJavaScript` for `end`, main
  frame only, wrapped in a function scope and a try/catch so it can't break Qutai's own page scripts; results the
  model sees go through the hidden-value redaction like any page content.
- **Cookies:** "which cookies does this page have" is answered by `page_cookies` (native store, HttpOnly included,
  no values); a script never gets the native cookie store.
