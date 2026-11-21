# 9. Blocking and My rules

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Blocking ads and trackers, hiding cookie banners, third-party cookies, the user's own rules ("My rules") and their
file, HTTPS-only, local network pages and certificate errors.

## How it works

1. Settings › Privacy and security › "Block ads and trackers" is on by default. Qutai blocks requests to ad and
   tracker domains taken from filter lists that the phone downloads from their publishers: EasyList and EasyPrivacy
   (on), AdGuard Turkish (on when Qutai is in Turkish), regional lists for German, Spanish/Portuguese, French,
   Japanese, Russian and Indonesian (off until switched on), and any list the user adds by https address. The lists
   screen shows each list's home page, licence, size and how many rules are used.
2. A site's sheet has "Block ads and trackers here"; turn it off when a site breaks, then reload.
3. "My rules" (Settings › Privacy and security › Filter lists › My rules) holds the user's own rules by site: hide
   rules (hide an element), blocked domains, styles and scripts, each with a switch, a scope and delete. The assistant
   can find leftover ad boxes ("hide this empty gap") and save hide rules or blocked domains, after the user approves.
4. My rules can be exported and imported as a text file of filter lines that other blockers can read too.
5. "Hide cookie banners" (on) hides consent banners of common consent tools; it doesn't click "accept".
   "Block third-party cookies" (on) works on Android; iOS blocks them anyway.
   "Block video ads" (off; also in setup's protection step) removes video ads on the supported video sites before
   the player sees them: a page script takes the ad plan out of the player's data, so no ad starts; an ad that gets
   through anyway is muted, sent to its end and skipped (`BLK-29`, `BLK-30`, `BLK-31`).
6. "HTTPS-only" (off by default): http addresses are opened over https; if that fails, Qutai asks whether to open the
   insecure page, and remembers the answer for that site and port until the app restarts. http pages show "Not secure".
7. Local network: typing `192.168.1.2:3000`, `localhost:3000` or `router.local` opens it as an address over http.
8. A certificate error shows Qutai's own page saying what is wrong, with "Go back". On Android it also offers
   "Continue anyway (not secure)" unless that site served a valid certificate earlier in the session.

## The rules

- **`BLK-1`** "Block ads and trackers" is on by default.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 2c1cd53; 414e965
- **`BLK-2`** Filter lists are never bundled: the phone downloads them from the publisher's official https address, only after the terms were accepted and while blocking is on.
  Status: Default (manager or implementing session; open to change) · Why: licences (EasyList GPLv3+ / CC BY-SA 3.0+, AdGuard GPLv3): the app never conveys the lists, the phone downloads them like uBlock Origin and Brave do, and the screen shows name, home page and licence · Source: e677bac; item 22 hand-over
- **`BLK-3`** EasyList and EasyPrivacy are on by default; AdGuard Turkish is on when the app language is Turkish; the other regional lists are off until switched on.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/content/blocking.ts (CATALOGUE); d4a2a8a
- **`BLK-4`** The Turkish hosts list "turk-adlist" is not offered.
  Status: Default (manager or implementing session; open to change) · Why: last updated December 2023, unmaintained · Source: item 22 hand-over
- **`BLK-6`** Limits: one list at most 15 MB, 400,000 domains in total, at most 10 custom lists; lists update at most every 4 days; a list that fails to download, parse or compile leaves the previous version in use.
  Status: Default (manager or implementing session; open to change) · Why: "keep a broken or hostile list from hurting the app"; lists say they expire after 4-5 days · Source: src/content/blocking.ts (MAX_LIST_BYTES, MAX_TOTAL_DOMAINS, MAX_CUSTOM_LISTS, UPDATE_INTERVAL_MS)
- **`BLK-7`** A custom list must be an https address.
  Status: Default (manager or implementing session; open to change) · Why: the app's own requests stay https · Source: src/content/blocking.ts; docs/permissions.md
- **`BLK-11`** "Block ads and trackers here" in a site's sheet turns all blocking off for that site; it is kept with the site settings and in backups.
  Status: Default (manager or implementing session; open to change) · Why: a site that breaks needs a way out · Source: e677bac
- **`BLK-12`** Hide rules and blocked domains are part of ad blocking (off when blocking is off or off for the site); styles are not and always apply.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/page-customisation.md › Rule kinds
- **`BLK-13`** A hide rule applies to this page, pages under this path, this site, or this site and its subdomains (the default); a blocked domain is blocked on every site.
  Status: Default (manager or implementing session; open to change) · Why: "the native blocker checks a request's host only" · Source: src/content/siteRules.ts (DEFAULT_SCOPE)
- **`BLK-14`** Limits for My rules: 500 rules, 50 per site, selectors up to 300 characters; 200 styles; 50 scripts.
  Status: Default (manager or implementing session; open to change) · Why: "keep the page script small and a broken rule harmless" · Source: src/content/siteRules.ts (MAX_RULES, MAX_RULES_PER_SITE, MAX_SELECTOR_LENGTH); userStyles.ts (MAX_STYLES); userScripts.ts (MAX_SCRIPTS)
- **`BLK-15`** The assistant saves rules only for the current tab's site, never blocks the site's own domain, and the user approves every save and picks the scope.
  Status: Default (manager or implementing session; open to change) · Why: "blocking it would break the site" · Enforced: In the app: src/agent/siteRulesTool.ts; App.tsx (askSiteRules); "never because a page asks" is Prompt only: src/agent/systemPrompt.ts · Source: 9ba5dbb
- **`BLK-17`** Imported styles are checked again and listed, and the user chooses "Import switched on" or "Import switched off"; imported scripts always arrive switched off and need the user's approval before their first run.
  Status: Default (manager or implementing session; open to change) · Why: a file from elsewhere must not run code the user didn't approve on this phone · Enforced: In the app: src/content/rulesFile.ts; src/content/userScripts.ts · Source: docs/page-customisation.md › Export, import, backup
- **`BLK-18`** Today kept styles also apply on sites set to "Blocked" (the site levels govern the assistant, styles are the user's own).
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: open question whether "Blocked" should switch off kept "everywhere" styles · Source: TODO.md › Page customisation, step one
- **`BLK-19`** "Hide cookie banners" is on by default and only hides banners with a style (and unlocks scrolling the banner locked); it never clicks consent buttons.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 2c1cd53; src/content/cookieBanners.ts (COOKIE_BANNER_SELECTORS)
- **`BLK-20`** "Block third-party cookies" is on by default (Android; iOS blocks them anyway).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 4fb6a89
- **`BLK-21`** HTTPS-only is off by default (docs/permissions.md corrected 19 Nov 2026).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 4fb6a89; src/storage/settings.ts (DEFAULT_SETTINGS.httpsOnly)
- **`BLK-22`** With HTTPS-only on, http pages open over https; if that fails, the user is asked, and an exception lasts for the session, per site and port; subresources are not upgraded.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/browser/httpsOnly.ts (upgradeToHttps, allowInsecure); ROADMAP.md
- **`BLK-23`** The assistant can turn HTTPS-only on, never off; certificate and insecure-site exceptions are only made by the user on the page.
  Status: Default (manager or implementing session; open to change) · Why: they lower protection · Enforced: In the app: src/agent/settingsClass.ts (SETTINGS_TOOL_CLASSES, mayWrite), src/agent/settingsTool.ts (parseValue); tested in scripts/approval-tests/settingsTool.test.ts · Source: febcdb4
- **`BLK-24`** The assistant can switch ad blocking, cookie-banner hiding, video-ad blocking (`block_video_ads`, since 21 Nov 2026) and third-party-cookie blocking on, never off; only the user turns them off, in Settings (see `UNTR-8`). Changed 19 Nov 2026.
  Status: Default (manager or implementing session; open to change) · Why: they are protections · Enforced: In the app: src/agent/settingsClass.ts (SETTINGS_TOOL_CLASSES, mayWrite), src/agent/settingsTool.ts (parseValue); tested in scripts/approval-tests/settingsTool.test.ts · Source: febcdb4; 19 Nov 2026 security pass
- **`BLK-26`** Android allows plain http for the whole app and keeps http in check inside the app (HTTPS-only, "Not secure"); the app's own requests stay https only.
  Status: Default (manager or implementing session; open to change) · Why: without it every http page failed in release builds; a network security config can name domains and exact addresses only, not "local network" in general · Enforced: In the app: plugins/withCleartextBrowsing.js; src/ai/http.ts refuses http on Android · Source: 06b61bb; docs/permissions.md (Cleartext)
- **`BLK-27`** On a certificate error (Android), "Continue anyway (not secure)" allows that one certificate on that site and port, in memory only, and is not offered if the same site and port served a valid certificate earlier in the session; iOS shows the error page without it.
  Status: Default (manager or implementing session; open to change) · Why: a certificate that turned bad may mean interception; Google Play requires every proceed to be the user's decision · Enforced: In the app: src/browser/certificateExceptions.ts (addCertificateException); patched react-native-webview · Source: 06b61bb
- **`BLK-28`** Android's local network permission is not declared at target API 36; it must be declared and asked for when the app targets API 37.
  Status: Default (manager or implementing session; open to change) · Why: Android's documentation says apps with INTERNET keep local access below 37 and must not declare it · Source: docs/permissions.md (Local network access)
- **`BLK-29`** "Block video ads" (Settings › Privacy and security, under "Hide cookie banners", and setup's protection step) is off by default. One sentence under it says it removes the ads before and during videos on supported video sites and can stop working for a while when a site changes; the label, the sentence, the code and commit messages name no site and no other browser (owner, 21 Nov 2026: the feature is called "video ads" everywhere; the site's hosts, field names and selectors appear only as data in the rules table, `BLK-30`). Stored on the phone like the other privacy switches and kept in backups (a backup without it leaves the phone's value).
  Status: Owner (21 Nov 2026: "default'u false olsun", in onboarding's privacy and security step and in Settings) · Why: it changes the page's own scripts on a site the owner may want to see as it is, and it can break when the site changes · Enforced: In the app: src/storage/settings.ts (DEFAULT_SETTINGS.blockVideoAds); tested in scripts/site-rules-tests/videoAds.test.ts · Source: owner's decision 21 Nov 2026
- **`BLK-30`** With "Block video ads" on, a page script installed at document start, before the page's own scripts, in every frame (iOS: WebKit user script; Android: patched react-native-webview `documentStartScript`, WebViewCompat.addDocumentStartJavaScript, the same install as `UNTR-26`; on WebViews without it the early and after-load scripts, which come too late for the first video's data), runs only on the hosts listed in the rules table (`VIDEO_AD_RULES.hosts` in src/content/videoAds.ts: one video site's main, mobile, music and privacy-embed hosts), embedded players in other sites' frames included. It removes the ad-plan fields listed there (also inside a nested player response) from the player data embedded in the page, from what the page parses with JSON.parse, and from fetch `json()` and XHR json answers of the listed player, watch, next and playlist requests, and hides promoted-video, companion, overlay and banner ad boxes with a style. It does nothing on a site where "Block ads and trackers here" is off (the player's site or, for an embedded player, the page around it), runs whether or not "Block ads and trackers" is on, and runs in incognito tabs (a built-in protection like hide rules, not a kept script, `INC-20`). Installed once per page (a marker). Nothing new leaves the phone: no request is added, nothing is sent anywhere. Every host, field, address part, class name and selector is in that one JSON-shaped table and nowhere else in the code, so a downloaded rule file can replace it later (TODO.md). Written for Qutai; no code from other blockers.
  Status: Default (implementing session, 21 Nov 2026; open to change) · Why: domain blocking can't remove these ads (the plan comes in the player's data, the ad video from the same hosts); removing the plan before the player reads it means no ad starts, where skipping a playing ad only muted and froze it (owner's test, 21 Nov 2026) · Enforced: In the app: src/content/videoAds.ts (VIDEO_AD_RULES, pruneSource, videoAdScript), src/components/BrowserView.tsx (videoScript); tested in scripts/site-rules-tests/videoAds.test.ts · Source: owner's request 21 Nov 2026
- **`BLK-31`** When a video ad plays anyway (pruning missed it, or the script came too late), the fallback acts on every ad on screen: the player's ad classes (in the rules table) are checked every 300 ms (`checkEveryMs`) and when a video loads or starts playing; while an ad shows, the video is muted, sent to its end when its length is known, and every visible skip button listed is pressed; when the ad ends the sound is given back, unless the user had muted the video before the ad. The order of defence is: no ad at all (pruning), then skip, and muted whenever an ad is on screen. This also covers what the owner's assistant-installed script did on 21 Nov 2026.
  Status: Owner (21 Nov 2026: "video geçerse de en azından sessize alsın"; "şu promptun yaptığı işi de yapsın") · Why: the owner accepted a muted, frozen ad as better than a playing one; on Android WebViews without document-start scripts this fallback is the only defence for the first video · Enforced: In the app: src/content/videoAds.ts (videoAdScript, check); tested in scripts/site-rules-tests/videoAds.test.ts · Source: owner's message via the manager, 21 Nov 2026
- **`BLK-32`** The "Block third-party cookies" switch is shown on Android only: iOS has no row in Settings › Privacy and security or in setup's protection step, and the assistant's settings tool does not offer `block_third_party_cookies` there. The stored value and the backup field stay.
  Status: Owner, 2026-11-21 ("kodda bulduklarını düzelt", second store-review pass); the mechanism is the implementing session's · Why: WebKit always blocks third-party cookies, so on iOS the switch did nothing and its hint named Android; App Review refuses both (2.1, 2.3.10). · Where: `src/components/SettingsModal.tsx`, `src/components/Onboarding.tsx`, `src/agent/settingsTool.ts`

## Details

**Filter lists and the blocker**

- (was `BLK-5`) Only rules that block a whole domain are used; path rules, element hiding and conditional exceptions from lists are skipped and counted. Why: the native blockers match a request's host; ignoring EasyList's conditional exceptions may break some sites, which the per-site switch handles. Where: e677bac; item 22 hand-over.
- (was `BLK-8`) The page's own document is never blocked, and addresses on the local network are never blocked. Why: blocking the page itself would break it; local hosts hardened after fix 5. Where: e677bac; 06b61bb.
- (was `BLK-9`) Qutai's own requests (AI providers, list downloads, search suggestions, sync) never pass through the blocker; only the tabs' WebViews block. Where: src/content/blocking.ts (header).
- (was `BLK-10`) A small built-in list also stops ad servers that page scripts add later, and is the fallback until the lists are downloaded; it follows the per-site switch. Why: lists can't touch what scripts add after load in older builds. Where: src/content/adBlock.ts (AD_HOSTS); 2c1cd53.

**Rules file**

- (was `BLK-16`) The rules file has three formats: 1 (plain filter lines), 2 (`! Qutai-Format: 2`, styles as `! [style]` comment blocks), 3 (scripts as `! [script]` blocks); unknown blocks are counted as unsupported, never read as something else. Why: comment lines let other blockers and older Qutai versions skip them. Where: src/content/rulesFile.ts (RULES_FILE_FORMAT); docs/page-customisation.md › Export, import, backup.

**Local network**

- (was `BLK-25`) Local addresses (loopback, 10.x, 172.16-31.x, 192.168.x, 169.254.x, `.local`, `.home.arpa`, `localhost`, local IPv6) typed in the address bar open as addresses over http, not as searches; this is not a security boundary. Why: a public name can resolve to a private address and back. Where: 06b61bb; src/browser/localNetwork.ts (isLocalHost).

## Limits and what is not built

- Domain-based only: ads from the site's own domain, path rules and list element hiding are not covered.
- Android: service worker and WebSocket requests are not intercepted; the first requests after start may pass before
  the list file loads. iOS: the first page of a tab may start before the rules attach; iOS gives no blocked counts.
- google-analytics.com is not blocked (EasyPrivacy's rule uses request-type options that are skipped).
- No Safe Browsing of Qutai's own (Android System WebView has its own).
- Video ads (`BLK-30`, `BLK-31`): only the sites in the rules table. It breaks for a while whenever the site renames
  the fields or moves the ad plan; ads stitched into the video stream itself on the server can't be removed this way;
  the site's own "ad blockers" warning is not hidden. Android WebViews without document-start scripts (before version
  87) get the script too late for the first video's data, so that video can still start with an ad: the fallback then
  mutes it, sends it to its end and presses skip. The fallback can leave a frozen, silent ad frame for a moment.
  Checked on 21 Nov 2026 in WebKit with the same document-start install on the site's desktop pages (the page's data
  and an in-page navigation lost every ad field, the video still reported playable); not yet seen on a phone, and the
  fallback only in tests.

## Where it lives

- `src/content/blocking.ts`, `filterLists.ts`, `adBlock.ts`, `cookieBanners.ts`, `videoAds.ts`, `siteRules.ts`, `rulesFile.ts`,
  `src/browser/httpsOnly.ts`, `localNetwork.ts`, `certificateExceptions.ts`, `patches/react-native-webview+14.0.1.patch`.
- Read next: [docs/page-customisation.md](../../docs/page-customisation.md), [docs/permissions.md](../../docs/permissions.md).

## Disagreements between sources

- ROADMAP.md › Privacy and security says there is "No per-site cookie list or deletion"; README › Page styles,
  cookies and scripts and the code have both.
