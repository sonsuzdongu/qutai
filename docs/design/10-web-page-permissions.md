# 10. What web pages may use

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

What a web site itself may use on the phone: the location, the camera and the microphone, each decided per site by
the user. Web pages can't show notifications.

## How it works

1. Each site's sheet ("What Qutai may do on this site") has "Location for this site", "Camera for this site" and
   "Microphone for this site", each Ask (default), Allow or Block.
2. When a page asks (a map's "my location" button, a video call), Qutai shows "<site> wants to use your location" (or
   camera / microphone / camera and microphone) with "Don’t allow", "Allow once" (highlighted) and "Always allow on
   this site". "Allow once" lasts until the page is left or reloaded; in incognito it covers that one request and
   "Always allow" is not offered.
3. Only the site shown in the address bar can ask, and only over https. A map embedded from another site is refused.
4. After the user allows a site, the phone's own permission is asked the first time.
5. While a page uses the camera or microphone, the address bar shows it; capture pauses while another tab is shown
   or Qutai is in the background. "Stop camera and microphone" in the site's sheet reloads the page.
6. Screen sharing is always refused. Pages can't send notifications (there is no web notification support).

## The rules

- **`WPERM-1`** Location, camera and microphone are each set per site: Ask (default, not stored), Allow or Block.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/storage/sitePermissions.ts (SitePermissionStore) · Source: e60fa84; 0e8b19f
- **`WPERM-2`** Only the tab's own site, over https, may ask; frames from other sites are always refused.
  Status: Default (manager or implementing session; open to change) · Why: "the decision is the site in the address bar's, not that of something it embeds" · Enforced: In the app: src/browser/sitePrompt.ts (requestingSite) · Source: e60fa84
- **`WPERM-3`** "Allow once" is the highlighted choice; "Always allow" is secondary and not offered in incognito; closing the dialog counts as "no"; the assistant cannot answer it.
  Status: Default (manager or implementing session; open to change) · Why: the narrowest choice first; incognito never remembers · Enforced: In the app: src/browser/sitePrompt.ts (askSitePermission) · Source: e60fa84
- **`WPERM-4`** In incognito a stored "allow" is ignored (Qutai asks) and a stored "block" still applies.
  Status: Default (manager or implementing session; open to change) · Why: incognito never uses what normal tabs remembered as allowed · Enforced: In the app: src/browser/geolocation.ts and src/browser/mediaCapture.ts (settingFor) · Source: e60fa84; 0e8b19f
- **`WPERM-5`** The location is answered by Qutai, not the WebView: the page's `navigator.geolocation` is replaced in the main frame, the position goes only to the same origin, frames get "permission denied", and nothing is shared in the background.
  Status: Default (manager or implementing session; open to change) · Why: neither WebView lets the app decide per site (Android grants every origin once the app holds the permission; iOS shows WebKit's own prompt) · Enforced: In the app: src/browser/geolocation.ts (PageGeolocation, geolocationScript) · Source: e60fa84
- **`WPERM-6`** A "Don’t allow" for the location is remembered for that page only, not stored.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/geolocation.ts (PageGeolocation) · Source: e60fa84
- **`WPERM-7`** Camera and microphone are enforced natively: the patched WebView grants only the main frame of exactly the allowed origin, only the allowed kinds, only while one approved request is answered (15 seconds at most); everything else is refused without a prompt.
  Status: Default (manager or implementing session; open to change) · Why: a check in page JavaScript alone can't enforce it (frames, untouched functions from same-site frames, native grants); holding the phone's permission must never let a site in by itself · Enforced: In the app: src/browser/mediaCapture.ts (PageMediaCapture); patches/react-native-webview+14.0.1.patch (mediaCaptureGrant) · Source: 0e8b19f; dc01c39 (pages got no camera or microphone at all until the per-site prompt existed); item 17 hand-over
- **`WPERM-9`** Screen sharing (`getDisplayMedia`) is always refused.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/mediaCapture.ts (mediaCaptureScript) · Source: 0e8b19f
- **`WPERM-10`** Capture pauses while another tab is shown or Qutai is in the background; "Stop camera and microphone" reloads the page, which must ask again.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/mediaCapture.ts · Source: 0e8b19f
- **`WPERM-12`** The assistant can't grant a site the location, camera or microphone or change these settings; when a site asks for the location itself, the assistant lets the site's own prompt answer.
  Status: Default (manager or implementing session; open to change) · Why: site permissions set what sites may do; only the user decides · Enforced: In the app: src/browser/sitePrompt.ts; src/agent/settingsTool.ts (PROTECTED) · Source: febcdb4; e60fa84
- **`WPERM-13`** The assistant's own location request (`get_location`) is separate from sites: confirmed each time unless "Don't ask again for your location", never in incognito, and the coordinates are for that task only, never saved to memory.
  Status: Default (manager or implementing session; open to change) · Why: the location then goes to the AI provider · Enforced: In the app: src/agent/tools/device.ts (locationTool); "never save them" is Prompt only (tool result text) · Source: e60fa84; 289a687
- **`WPERM-14`** Web pages can't show notifications: there is no web notification or push support.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: Designed, not built (no page shim, no push entitlement, push permission blocked on Android) · Source: docs/permissions.md
- **`WPERM-15`** Web Share: a page's own Share button (`navigator.share`) opens the system share sheet with the page's title, text and address. Android's WebView has no `navigator.share`, so Qutai adds one (and `canShare`) in the main frame at document start: only during a user activation (the page script's check, and the app's own: a touch on the page in the last 3 s and the tab on screen), one share at a time, http(s) addresses only (resolved against the page), title, text and address cut to 1 000, 20 000 and 8 192 characters, no files (`canShare` says no to them). The promise resolves once the sheet is shown (Android can't tell a dismissal), and rejects with NotAllowedError without a gesture. iOS keeps WebKit's own `navigator.share` (checked on the simulator: the system sheet opens), and the script adds nothing where one exists. Nothing leaves the phone by itself: the user picks the app in the system sheet.
  Status: Default (implementing session; owner approved the list of browser behaviours 24 Nov 2026) · Why: sites' Share buttons did nothing in Qutai on Android · Enforced: In the app: src/browser/webShare.ts (webShareScript, parseShareMessage, shareContent), src/components/BrowserView.tsx (onMessage), src/device/link.ts (shareFromPage); tests scripts/navigation-tests/webShare.test.ts · Source: owner's 24 Nov 2026 list (Web Share); Android emulator check (sheet with text and address; a share 6 s after the tap refused)
- **`WPERM-16`** Passkeys and security keys (WebAuthn). Android: the patched WebView turns on WebAuthn as a browser (`WEB_AUTHENTICATION_SUPPORT_FOR_BROWSER`, WebViews with the WEB_AUTHENTICATION feature) and Qutai declares `CREDENTIAL_MANAGER_SET_ORIGIN` (a normal permission, Android 14+), without which the WebView's request threw and closed the app. The request then reaches Android's Credential Manager; whether a provider serves it is the provider's decision: Google Password Manager only serves browsers on its privileged-browser list (Google's approval form), so until Qutai is on it passkey sign-in fails with an error instead of a sheet (checked on the emulator: the request reached Google Password Manager, which cancelled it, and the page got NotReadableError; no crash). iOS: WKWebView refuses WebAuthn for a third-party app without the `com.apple.developer.web-browser` entitlement or the site's associated domain (checked on the simulator: NotAllowedError at once, no system sheet); Qutai doesn't have that entitlement (`INTRO-32`), so nothing changes on iOS. The credential goes from the user's provider to the site the user signs in to; nothing goes to Qutai.
  Status: Default (implementing session; owner approved the list of browser behaviours 24 Nov 2026) · Why: sign-in with a passkey failed in Qutai; Android can do it once the provider accepts Qutai as a browser · Enforced: In the app: patches/react-native-webview+14.0.1.patch (RNCWebViewManagerImpl.createViewInstance), plugins/withPasskeys.js · Source: owner's 24 Nov 2026 list (passkeys); emulator and simulator checks; developer.android.com WebSettingsCompat and privileged-apps pages

- **`WPERM-17`** A site that asks the browser for a user name and password (HTTP Basic or Digest: a 401 with `WWW-Authenticate`, typical of routers, NAS boxes, intranet and staging pages) gets Qutai's own dialog instead of the site's 401 page: "Sign in to <host>", what the site asks, its realm in quotes as the site's own words (control and direction characters removed, at most 120 characters), a warning when the page is plain http (the password travels unencrypted), "Qutai doesn't keep the password", a user name field, a hidden password field, Cancel and Sign in. Sign in continues the waiting load with that answer; Cancel shows the site's own 401 page. The dialog always names the host that asks (a frame from another site shows its own host). It appears only while the tab is on screen and one at a time; a request from a tab in the background (a task's tab) waits until the user is on that tab. The password goes to the WebView for that one request and nowhere else: Qutai never stores it (the WebView's credential store is not used, iOS credentials are "for this request only"), never logs it, never shows it to the assistant or sends it to the AI, and the assistant can't answer the dialog. The fields carry the user-name and password autofill hints, so the phone's own password manager (iOS Passwords, Android Autofill) can fill them and may offer to save them, which is the user's choice in that app, not Qutai's; in incognito tabs the hints are off, so nothing is filled or offered and nothing is remembered. A tab that closes or sleeps cancels its open request.
  Status: Default (implementing session; owner approved 25 Nov 2026) · Why: such sites were unreachable in Qutai (the WebViews refuse them without an app handler) · Enforced: In the app: src/browser/httpAuth.ts (parseHttpAuthRequest, cleanRealm, httpAuthDialogParts, HttpAuthQueue), src/device/httpAuth.ts, src/components/BrowserView.tsx (askHttpAuth, httpAuthPrompt, onHttpAuthRequest), src/components/Dialog.tsx (password field); patches/react-native-webview+14.0.1.patch (Android RNCWebViewHttpAuth, RNCWebViewClient.onReceivedHttpAuthRequest, TopHttpAuthRequestEvent; iOS didReceiveAuthenticationChallenge for Basic and Digest; answerHttpAuth / cancelHttpAuth on RNCWebViewModule, so the password is never a view prop); tests scripts/navigation-tests/httpAuth.test.ts; test page scripts/page-tests/serve.mjs `/auth` (test user only) · Source: owner's approval 25 Nov 2026. Checked on the Android 16 emulator and the iOS 26 simulator: the dialog shows for the test page, Sign in loads it, Cancel shows its 401 page (iOS then offered "Save Password?" from the system Passwords app, which led to the incognito rule).

- **`WPERM-18`** "Copy" buttons on pages (copy code, copy link) work with the WebViews' own clipboard rules, and Qutai adds nothing: `navigator.clipboard.writeText` and `document.execCommand('copy')` reach the phone's clipboard after a tap on the page; a write without a tap is refused (`NotAllowedError`); a page can't read the clipboard on Android (`readText` refused), and on iOS only after the user taps WebKit's own "Paste" button (text the same site copied itself it may read back without asking, WebKit's rule). No page-script bridge to the app's clipboard was added, since nothing failed; if an older Android WebView refuses `writeText`, the bridge described in the owner's 25 Nov 2026 request (recent tap, top or same-origin frame, length limit, "Copied" notice) is the fallback to build.
  Status: Default (implementing session; owner's request 25 Nov 2026, checked, no change needed) · Why: copy buttons were reported to fail in embedded WebViews · Enforced: the WebViews (Android WebView 134, iOS 26 WKWebView); test page scripts/page-tests/clipboard.html (served at /clipboard) · Source: owner's request 25 Nov 2026. Checked on the Android 16 emulator (both copy methods, pasted text matched; no-tap write and read refused) and the iOS 26 simulator (both copy methods, the simulator clipboard held the text; a read of another site's text showed WebKit's Paste button).
## Details

- (was `WPERM-8`) Camera and microphone are asked and set separately. Where: src/browser/mediaCapture.ts; 0e8b19f.
- (was `WPERM-11`) Tabs using the camera or microphone never go to sleep. Where: README › Known limitations (Tabs sleep).

## Limits and what is not built

- Android: a same-site frame of the allowed site could use the grant during the moment it is open.
- iOS: WebKit keeps a grant for the rest of the page, so a page that goes around Qutai's wrapper can get the same kinds
  again on that page without a new question (in incognito too).
- A page that tampers with built-in functions could hide its tracks from the address bar indicator.
- Android: the location script may run too late for a page that asks the moment it loads (installed again after load).
- Web notifications: not built (no decision recorded).
- Not yet tried on phones (TODO › To try on the phone › Privacy and permissions).

## Where it lives

- `src/browser/geolocation.ts`, `src/browser/mediaCapture.ts`, `src/browser/sitePrompt.ts`,
  `src/storage/sitePermissions.ts`, `patches/react-native-webview+14.0.1.patch`.
- Read next: [docs/permissions.md](../../docs/permissions.md) › Web pages.
