# 19. Cookies

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The user can ask "Which cookies does this page have?". The assistant lists them by name, site and settings, and never sees a cookie's value. The user can look at values and delete cookies in Qutai's own Cookies view. The assistant can delete cookies only after the user approves.

## How it works

1. The user asks about cookies. The model calls `page_cookies` `list`.
2. Qutai reads the tab's own native cookie store, including HttpOnly cookies, which page JavaScript cannot see. It reads cookies for the page's address and for up to 20 other sites the page loaded from. On Android it uses `CookieManagerCompat.getCookieInfo` of the tab's WebView profile; on iOS, the `WKHTTPCookieStore` of the tab's data store. Both go through Qutai's patched react-native-webview module.
3. For each cookie the model gets a handle (`c1`, `c2`…), the name, domain, path, expiry or "session", size, HttpOnly, Secure, SameSite, and first- or third-party, grouped by domain. Calling a cookie a tracker is the model's own judgement from its name and domain, and it is told to say so.
4. The chat gets a cookies card ("Show cookies") that opens the Cookies view. The view can also be opened from the page menu (More › Cookies) and from the site's permission sheet.
5. In the Cookies view, each value stays hidden until the user taps **Show value**, then **Copy**. The user can **Delete** one cookie or **Delete all for this site**. Each delete has a confirmation that says the user may be signed out.
6. If the user asks the assistant to delete cookies, it passes handles from its last list. Qutai shows the cookies by name and domain and asks every time.
7. An incognito tab lists its own separate store.

## The rules

- **`COOK-1`** Cookie values never reach the AI. The model gets only names, domains, paths, expiry, size and flags.
  Status: Default (manager or implementing session; open to change) · Why: values are often sign-in tokens, and a page or prompt injection must not get them through the model · Enforced: In the app: src/content/cookieInfo.ts (cookieMetadata copies named fields only and reads the value only for its length; formatCookieList builds the model text from that), used by src/agent/pageCustomTool.ts (pageCustomTool); tests assert no value passes (scripts/site-rules-tests/cookieInfo.test.ts) · Source: docs/page-customisation.md › The tool and the view, Threat model; 496320b
- **`COOK-2`** Cookie values exist only in the Cookies view's memory while it is open. They are never logged, never in the action history, never in "What was sent to the AI", never in memory and never in backups.
  Status: Default (manager or implementing session; open to change) · Why: same as COOK-1 · Enforced: In the app: src/device/cookieStore.ts (values returned to the Cookies view only, nothing logged); src/agent/executeTool.ts (isLogged logs only deletes, by what was done) · Source: docs/page-customisation.md › The tool and the view
- **`COOK-3`** The assistant deletes cookies only by handles from its last list of this tab and page (at most 50), and only after the user approves. The dialog names the cookies and says the user may be signed out. It appears every time, with no "don't ask again".
  Status: Default (manager or implementing session; open to change) · Why: deleting signs the user out of the site · Enforced: In the app: src/agent/pageCustomTool.ts (pageCustomTool, MAX_HANDLES, the per-tab listed map); src/components/pageCustomisation.tsx (askCookieDelete); page_cookies is in ALWAYS_CONFIRMED in src/agent/executeTool.ts · Source: docs/page-customisation.md › The tool and the view
- **`COOK-4`** Listing is refused on sites set to "Blocked". Deleting is refused on "Read only" and "Blocked" sites.
  Status: Default (manager or implementing session; open to change) · Why: listing only reads; deleting changes the site's data · Enforced: In the app: src/agent/sitePolicy.ts (policyName maps delete to delete_cookies in WRITE_ACTIONS; decide) · Source: docs/page-customisation.md › The tool and the view
- **`COOK-5`** The assistant should list cookies only for "which cookies" questions and delete them only when the user asks. Page text asking for it does not count.
  Status: Default (manager or implementing session; open to change) · Why: only the user's own request counts; a page can't approve anything · Enforced: Prompt only: src/agent/systemPrompt.ts; the app does not check who asked, but a delete always needs the approval in COOK-3 and a list never carries values · Source: 4f00645; docs/page-customisation.md › Threat model
- **`COOK-6`** Nothing read from the native cookie store is ever put into a page or given to a page script. "Which cookies" questions go to `page_cookies`, never to page JavaScript.
  Status: Default (manager or implementing session; open to change) · Why: page JavaScript can't see HttpOnly cookies, and scripts must never get the native store · Enforced: In the app: the store is used only by src/agent/pageCustomTool.ts and the Cookies view; scripts naming cookie or cookieStore are refused in src/content/scriptCheck.ts (checkScript) · Source: docs/page-customisation.md › Threat model, Scripts rule 5
- **`COOK-8`** On an Android WebView without the cookie-info feature, the list has names only. The model and the view say that domains, flags and expiry are unknown.
  Status: Default (manager or implementing session; open to change) · Why: the plain `CookieManager.getCookie` gives names and values only · Source: docs/page-customisation.md › Where they come from; src/agent/pageCustomTool.ts (platformNote)
- **`COOK-9`** An incognito tab lists and deletes in its own store: on iOS the tab's non-persistent store, on Android the incognito profile. On an old Android WebView without profiles, incognito tabs share the normal store, as the incognito notice already says.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/page-customisation.md › The tool and the view; src/device/cookieStore.ts (storeFor, iosStoreKey)
- **`COOK-12`** The action history records only that cookies were deleted, never cookie names or values. Listing is not logged.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/executeTool.ts (LOGGED_TOOLS, isLogged) · Source: 4f00645
- **`COOK-13`** The privacy policies say the assistant gets cookie names, sites and settings, never values. The legal version is bumped: open-source 2 → 3, pro 4 → 5.
  Status: Owner, 2026-11-19 · Why: the policy changed in substance · Source: cc45a62 (text), 040c537 (bump "on the owner's word"); src/legal/documents.ts, src/legal/proDocuments.ts
- **`COOK-14`** Third-party cookies are blocked by default on Android (Settings › Privacy and security › "Block third-party cookies"). While that is on, the model is told why few or none are listed.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 4fb6a89; src/agent/pageCustomTool.ts (platformNote)

## Details

**Reading the cookie store**

- (was `COOK-11`) Qutai asks about at most 20 other sites the page loaded from, taken from the page's resource timing. Where: src/device/cookieStore.ts (MAX_OTHER_HOSTS)
- (was `COOK-7`) First- or third-party is worked out by Qutai from the cookie's domain against the page's registrable domain. The model is told that the store does not record who set a cookie. Why: neither platform's store records the setter. Where: docs/page-customisation.md › What each platform can't tell; src/content/cookieInfo.ts (partyOf); src/agent/pageCustomTool.ts (platformNote)

**Deleting**

- (was `COOK-10`) Deleting writes an expired cookie with the same name, domain, path and Secure flag on Android, and deletes the `HTTPCookie` object on iOS. Both then flush to disk. Where: docs/page-customisation.md › Where they come from

## Limits and what is not built

- Partitioned cookies (CHIPS) and the per-site cookies WebKit keeps (Intelligent Tracking Prevention) are not marked as such.
- Third-party cookies are usually missing: iOS blocks them, and Android does while its setting is on. An empty third-party part means none were stored, not that none were tried.
- Size is the name plus the value in characters. A missing SameSite means the cookie didn't set it (browsers then treat it as Lax).
- A native rebuild is needed (the patched WebView module).
- Not verified on Android; the iOS simulator run passed (HttpOnly listing, reveal, delete, assistant list without values).

## Where it lives

- [docs/page-customisation.md](../../docs/page-customisation.md) › Cookies, Threat model.
- `src/content/cookieInfo.ts` (parsing, metadata without values), `src/device/cookieStore.ts`.
- `src/agent/pageCustomTool.ts`.
- `src/components/CookiesScreen.tsx`, `src/components/pageCustomisation.tsx` (CookiesCard, askCookieDelete).
- Native patch: `RNCWebViewCookies.java` (Android), `RNCWebViewModule.mm` (iOS).

## Disagreements between sources

- TODO.md › Page customisation, step one still lists "Bump the legal version for the privacy policies' new words on cookies (…): not done, on purpose". Commit 040c537 did the bump on the owner's word. The TODO line is stale.
- In `src/legal/documents.ts`, the pro version-5 comment names only contacts, while the open-source version-3 comment names contacts, page styles and the cookie list. The pro policy text does contain the cookie words. Only the comment is incomplete.
