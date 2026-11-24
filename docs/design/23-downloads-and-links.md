# 23. Downloads and opening Qutai from other apps

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The decisions taken before a download starts (who asked, which files warn, which addresses work), and what a link,
a shared text or a `qutai://` link from another app may make Qutai do.

## How it works

1. Tapping a download link starts it at once; a file that can install or run code, or an archive, first shows a
   warning. Long-press › "Download link" or "Save image" counts as the user's own request.
2. A page that starts a download without a tap in the last 10 seconds gets a question: "<site> wants to download
   <file>". From the second such download in a session, the question also offers "Block downloads from this site",
   which refuses that site's automatic downloads until Qutai restarts.
3. Downloads from `blob:` and `data:` addresses are read from the page in 512 KB slices; `content:` and `file:`
   addresses are refused.
4. The assistant's `download_file` always shows what will be downloaded: name, site, type and size, with a warning
   for risky files. "Don't ask again for downloads" covers ordinary files outside incognito only. The assistant can't
   open or read the file.
5. From other apps (Android): shared text or a link opens a small chooser: "Open page" (when the text has exactly one
   web link), "Search with" the chosen engine, "Ask Qutai about this" (the text goes into the message field, unsent)
   and "Summarize this page" (the user taps Summarize). A web link handed to Qutai as the browser opens in a normal tab.
6. `qutai://` links (Shortcuts app, launcher shortcuts, widget) only open or prepare things: open a page, put a search
   in the address bar, put a question in the assistant's field, open a new tab or incognito tab, open the QR scanner.
   Nothing is submitted or sent.
7. A page may open another app (phone, mail, WhatsApp, an app link) only right after the user touched it, and Qutai
   asks first.

## The rules

- **`DL-1`** Only http, https, blob and data addresses can be downloaded; others are refused with a notice.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/downloadRequests.ts (DownloadRequests) · Source: 6d6a7e6
- **`DL-2`** A download a page starts without a recent tap (10 seconds) asks first, with a warning if the file is risky.
  Status: Default (manager or implementing session; open to change) · Why: pages must not drop files on the phone on their own · Enforced: In the app: src/browser/downloadRequests.ts (DownloadRequests); patched download listener (userGesture) · Source: 6d6a7e6; fix 9 hand-over
- **`DL-3`** From the second automatic download of a site in a session, the question offers "Block downloads from this site"; a blocked site's automatic downloads are refused with a notice until the app restarts.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/downloadRequests.ts (DownloadRequests) · Source: 6d6a7e6
- **`DL-4`** A risky file (apps, installers, executables, scripts, disk images, archives; a generic binary without an extension) shows a warning before it downloads; an ordinary file the user tapped starts at once.
  Status: Default (manager or implementing session; open to change) · Why: these files can install or run code · Enforced: In the app: src/device/download.ts (isRiskyDownload) · Source: 6d6a7e6
- **`DL-5`** The assistant's download is confirmed with name, site, type, size and any risk warning, unless "Don't ask again for downloads" is on, which never covers a risky file or an incognito conversation. Changed 20 Nov 2026: an address the model wrote itself (not a link's ref) first passes the outbound check (`UNTR-22`), and nothing is requested from it before the user has answered: the dialog then shows the name from the address without type and size, and "Don't ask again" doesn't cover it (before, a HEAD request went to the address before any dialog).
  Status: Default (manager or implementing session; open to change) · Why: see `SITE-11` · Enforced: In the app: src/agent/tools/files.ts (downloadFileTool); src/agent/alwaysAllow.ts (kindForDownload) · Source: 4f9e69e; 289a687
- **`DL-6`** The assistant may download only http(s) files, and not from a site set to "Read only" or "Blocked".
  Status: Default (manager or implementing session; open to change) · Why: "the file's site has to allow it as well" · Enforced: In the app: src/agent/tools/files.ts (downloadFileTool) · Source: 4f9e69e
- **`DL-7`** The assistant never opens or reads a downloaded file, and never downloads something the user didn't ask for.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app for opening (the tool returns only where the file is); Prompt only: src/agent/systemPrompt.ts for "didn't ask" · Source: 4f9e69e
- **`DL-8`** Android 9 and older ask for the storage permission at the first download; Android 13 and newer ask for the notification permission right after the first download, and downloads work without it.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/browser/downloadRequests.ts; docs/permissions.md
- **`DL-9`** "Open" on a downloaded app file (APK) hands it to the system installer; Qutai never installs anything itself, never turns on "Install unknown apps" and never opens an APK without the user's tap.
  Status: Default (manager or implementing session; open to change); the Play declaration for this permission is an open owner question (fill it in, or drop the permission) · Why: without the permission the installer closed at once and the tap did nothing · Enforced: In the app: plugins/withDownloads.js (REQUEST_INSTALL_PACKAGES) · Source: 21d43e3; docs/permissions.md
- **`DL-10`** Everything that reaches Qutai from outside is untrusted: a web link opens in a normal tab; other text is never searched with a search engine, submitted or sent to the AI by itself; only http(s) addresses open as pages.
  Status: Default (manager or implementing session; open to change) · Why: "another app or a web page chose it" · Enforced: In the app: src/device/entryPoints.ts (entryFromLink, entryFromShared) · Source: 8f434d5; 6928cb1
- **`DL-11`** `qutai://` links are read strictly (exact names, no unknown or repeated parameters) and never act by themselves: open (http(s) only), search (not submitted), ask (not sent), new-tab, new-private-tab, scan; anything else is ignored.
  Status: Default (manager or implementing session; open to change) · Why: "Any app or web page can open these links, which is why none of them acts by itself" · Enforced: In the app: src/device/entryPoints.ts (entryFromAppLink) · Source: 6928cb1; README › The qutai:// URL scheme
- **`DL-13`** Each item from outside is handled once, and waits behind the app lock until the user unlocks.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/device/entryPoints.ts (useEntryPoints) · Source: 6928cb1
- **`DL-14`** An email sign-in link is never opened as a page or treated as a `qutai://` action.
  Status: Default (manager or implementing session; open to change) · Why: keeps its token out of history, logs and the AI · Enforced: In the app: src/device/entryPoints.ts (entryFromAppLink); src/components/AccountLinks.tsx (takeSignInLink) · Source: docs/app-links.md
- **`DL-15`** A page may ask to open another app (tel:, mailto:, whatsapp:, intent://) only within 3 seconds of a user touch, one question per tap, and never again for a link the user declined in that tab.
  Status: Default (manager or implementing session; open to change) · Why: pages that redirect to an app on load (store pages, "open in app" banners) are ignored · Enforced: In the app: src/browser/externalGuard.ts (mayOfferExternal); src/browser/openExternal.ts · Source: 4272d00
- **`DL-18`** Android, like Chrome: a link opened from another app (Qutai the default browser) counts as the user's tap for its first load and that load's redirects, until the first page has loaded or 15 seconds at most, one hand-off per opening; a redirect in it to another app follows `DL-15`'s question. Google Play links the user started (a tap within `DL-15`'s window, or such a link from another app) open Play directly without the question: `market://`, an `intent://` link with `scheme=market`, or one for the Play Store app (`package=com.android.vending`) whose Play web page (`play.google.com/store/apps/details?…`) becomes `market://details?…`. Every other app (WhatsApp, tel:, any other), and anything a page starts on its own, keeps the question. An `intent://` link no app answers opens its `S.browser_fallback_url` web page, or else (like Chrome) its package's Play page. All of this holds for every address that isn't a web page (`linkTarget` 'external': whatsapp:, tg:, tel:, mailto:, sms:, fb:, file:, any app's own scheme such as myapp:), not only Play: such an address is never loaded or shown like a page. The patched WebView never loads one itself when the app's answer is late (it used to show an ERR_UNKNOWN_URL_SCHEME page), a load error for one shows no error page (the tab goes back, or to the new tab page), and a cancelled redirect to one never becomes the tab's address; the app still hands it off (or asks). iOS: the same first-load rule applies, App Store links keep the question.
  Status: Owner, 2026-11-24 · Why: with Qutai the default browser, Play links from other apps (http(s) links that redirect to `market://` or a Play `intent://`) didn't open Play as other browsers do · Enforced: In the app: src/browser/externalGuard.ts (noteOpenedFromApp, endLaunchChain, mayOfferExternal); src/browser/navigation.ts (playStoreUrl, parseIntentUrl, isAppLinkError); src/browser/openExternal.ts; src/browser/Tab.ts (handleNavigationStateChange, handleLoadStart, handleWebViewLoadEnd); src/components/BrowserView.tsx (onError); App.tsx (handleEntry); patches/react-native-webview+14.0.1.patch (RNCWebViewClient.isWebViewScheme) · Tests: scripts/navigation-tests/externalLinks.test.ts; scripts/navigation-tests/scenarios.test.ts (app link never the tab's address)
- **`DL-16`** The home screen widget shows no history, tabs or other personal data.
  Status: Default (manager or implementing session; open to change) · Why: "others see a home screen" · Source: 424a535; README › Opening Qutai from other apps
- **`DL-17`** "Add to home screen" is not offered for incognito tabs.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: README › Opening Qutai from other apps

## Details

- (was `DL-12`) Incoming text is cleaned of control characters and hidden direction marks and cut to 10,000 characters (addresses to 4,096). · Why: hidden direction marks could disguise text · Where: src/device/entryPoints.ts (cleanText, MAX_TEXT); 8f434d5

## Limits and what is not built

- A file a form produced with POST is fetched again with GET; servers without range support restart from zero; a
  `blob:` made inside a frame can't be read; iOS has no pause or resume.
- Whether a page download followed a tap is judged by a touch in the 10 seconds before.
- iOS: no share extension, no widget, no App Intents yet (planned).

## Where it lives

- `src/browser/downloadRequests.ts`, `src/device/download.ts`, `src/storage/downloads.ts`, `modules/qutai-downloads`,
  `src/agent/executeTool.ts` (`downloadFileTool`), `src/device/entryPoints.ts`, `src/browser/externalGuard.ts`.
- Read next: README › Opening Qutai from other apps, [docs/app-links.md](../../docs/app-links.md).

## Disagreements between sources

- docs/permissions.md › Web pages says Android downloads go through the "System download manager"; since fix 9 Qutai
  uses its own download engine ("DownloadManager no longer used"). The code uses its own engine.
