# Native code: patches and Qutai's own native modules

Everything native that Qutai carries besides what Expo generates: the two patches applied to dependencies at install
time, and the five local Expo modules in `modules/`. Neither has automated tests (a native test setup was decided
against on 20 Nov 2026); this page is where a regression is looked up: what each piece does, which JavaScript uses
it, and how to check it by hand on a phone. Design rules: `BUILD` in
[design/40-signing-and-builds.md](design/40-signing-and-builds.md), `HOUSE-22` in
[design/43-working-on-the-repo.md](design/43-working-on-the-repo.md).

## Patches (`patches/`, applied by `patch-package` on every install)

`npm install` runs `postinstall`: `patch-package --error-on-fail`, then `scripts/build-pdf-reader.js`. A patch that
no longer applies **fails the install** (since 20 Nov 2026; before, patch-package 8 only printed an error outside CI
and the install went on without the patch, so a build could silently lose Qutai's browser features). EAS builds run
the same `postinstall`.

### How the patched packages are pinned

| Package | In package.json | Why |
|---|---|---|
| `react-native-webview` | `14.0.1` (exact) | The patch is made against 14.0.1. |
| `expo-dev-client` | `58.0.20` (exact) | It depends on `expo-dev-launcher ~58.0.20`, so its own patch release would bring a new launcher. |
| `expo-dev-launcher` | `overrides: 58.0.20` | The patched package itself; `expo-dev-client`'s range alone would let a fresh resolve move it. |

Both direct dependencies are listed in `expo.install.exclude` (package.json). Expo's documentation (SDK 58,
docs.expo.dev › package.json) says a library listed there is excluded from the version checks of `npx expo install`
(with `--check` or `--fix`), `npx expo start` and `npx expo-doctor`, so `npx expo install --fix` never moves them to
the SDK's newer recommended version behind the patch's back. On 20 Nov 2026 the SDK already recommended
`expo-dev-client ~58.0.21`. The lockfile (`package-lock.json`) holds the same versions.

### When a patched dependency is updated

1. Look at the new version's source for the patched files (below). Upstream may have fixed the reason for the patch:
   then delete the patch file, update the version, and remove the pin and the exclusion.
2. Otherwise change the version in package.json (and the override), `npm install`; if the install fails at
   `patch-package`, apply the changes by hand in `node_modules/<package>` (each change is marked "Qutai patch") and
   run `npx patch-package <package>` to write the new patch file; delete the old one.
3. Build both platforms (`npx expo run:ios`, `npx expo run:android`; a development build is enough) and do the manual
   checks below for that package.

### `expo-dev-launcher+58.0.20.patch` (23 lines, iOS, development builds only)

- **Changes** `ios/SwiftUI/Navigation/DevLauncherToolbar.swift`: `verticalBarPreferred()` returns the toolbar
  unchanged instead of calling `axisBehavior(.verticalPreferred)`.
- **Why**: upstream guards the call with `compiler(>=6.4)` and `#available(iOS 27.1, *)`, which is also true on
  Xcode 27.0, whose iOS 27.0 SDK lacks `axisBehavior`, so iOS debug builds failed to compile (bc2a261). Release
  builds don't contain the development launcher.
- **Drop it** when every machine that builds Qutai uses Xcode 27.1 or later, or when a new expo-dev-launcher checks
  the SDK correctly.
- **Manual check**: `npx expo run:ios` builds; the development launcher opens and its toolbar shows.

### `react-native-webview+14.0.1.patch` (2,609 lines, 25 files, Android and iOS and the JS types)

Qutai's native browser features, each change marked "Qutai patch" (122 marks), by feature (design record `BUILD`,
previously `BUILD-18`; each part's reason is in its commit):

| Feature | Files (Android / iOS / JS) | Manual check |
|---|---|---|
| Camera and microphone only for the origin and kinds the user allowed (`mediaCaptureGrant` "<origin> camera microphone"; nothing allowed is a refusal) | `RNCWebChromeClient.java`, `RNCWebView.java` / `RNCWebViewImpl.m` / `WebViewTypes.ts` | On a site asking for the camera, deny in Qutai's dialog: the page gets an error, no system prompt; allow once: the camera works on that site only. |
| Network ad and tracker blocking (Android: a domain set checked on WebView's request threads, blocked counts reported; iOS: compiled WebKit content rule lists) | `RNCWebViewContentBlocker.java`, `RNCWebViewClient.java`, `RNCWebViewModule` / `RNCWebViewImpl.m`, `RNCWebViewModule.mm` / `NativeRNCWebViewModule.ts`, `RNCWebViewNativeComponent.ts` | Open a news site with blocking on: the shield count rises and ad frames are empty; switch blocking off for the site: ads load after reload. |
| Android incognito profiles (separate cookies and storage per incognito session) | `RNCWebViewProfiles.java`, `RNCWebViewManagerImpl.kt` | Sign in to a site in an incognito tab: a normal tab of the same site is not signed in; close all incognito tabs: the sign-in is gone. |
| Background playback and picture-in-picture (page media state for qutai-media) | `RNCWebViewPlayback.java`, `RNCWebView.java` | See qutai-media below. |
| Certificate exceptions only for the exact certificate the user accepted, for the tab's life | `RNCWebViewCertificates.java`, `RNCWebViewClient.java` / `RNCWebViewImpl.m` | Open a self-signed test site: Qutai's error page; "Continue anyway" loads it; a new tab asks again. |
| Downloads go to Qutai's own engine (qutai-downloads), not DownloadManager | `RNCWebViewClient.java`, `TopFileDownloadEvent.kt` / (iOS sends onFileDownload itself) | Download a PDF: it appears in Qutai's Downloads with progress; Android's system download list stays empty. |
| Reading and deleting cookies per WebView data store, without values | `RNCWebViewCookies.java`, `RNCWebViewModule` (both archs) / `RNCWebViewModule.mm` | On a site, "which cookies does this page have": names and sites, no values; delete one: it is gone after reload. |
| App sandbox for apps inside Qutai (Android: no network, no navigation, a frame guard) | `RNCWebViewClient.java`, `RNCWebView.java` | Run a Qutai app that tries `fetch`: it fails; a link in it doesn't navigate. |
| Qutai's page script at document start on Android (`documentStartScript`: WebViewCompat.addDocumentStartJavaScript, where the WebView has it; `UNTR-26`) | `RNCWebView.java`, `RNCWebViewManager.java` (both archs) / (iOS ignores it) / `WebViewTypes.ts`, `RNCWebViewNativeComponent.ts` | On a news site, ask "Summarise this page" right after it starts loading: it works, no "page script could not be set up" error. |
| "Send the form again?" on Android (`onFormResubmission` event, `formResubmissionAnswer` prop "<id> resend\|keep"; unanswered for 30 s, a newer question or the WebView going away: not sent again; `TABS-25`) | `RNCWebView.java`, `RNCWebViewClient.java`, `RNCWebViewManager.java` (both archs), `TopFormResubmissionEvent.kt` / (iOS ignores them) / `WebViewTypes.ts`, `RNCWebViewNativeComponent.ts` | Send a form (a search form with POST, or a test shop's checkout), then Reload: Qutai asks; Cancel keeps the page, Send again shows the result once more; leave the question open 30 s: nothing is sent and the page doesn't hang. |
| Cancelled and interrupted navigations reported (`onLoadingCancelled`-style event) | `RNCWebViewClient.java` / `RNCWebViewImpl.m` | Tap a link to an app (tel:, a store link): the progress line stops instead of hanging. |
| Full-screen video drawn by Chromium's own view | `RNCWebChromeClient.java` | Play a video full screen and rotate: it fills the screen; leaving full screen returns to the page. |

**Moving it out of a patch (for the owner to decide).** A patch this size breaks on any upstream change near the
touched lines and is hard to review as a diff of a diff. Two ways out, each about half a day of work plus one full
manual pass of the table above on both platforms:

- **A fork**: fork react-native-webview at `v14.0.1`, apply the patch as ordinary commits, tag `qutai-14.0.1`, and
  depend on `github:<owner>/react-native-webview#qutai-14.0.1` (npm installs it from git; EAS can too, the repository
  must be public or EAS given a token). Updating means rebasing the commits on a new upstream tag, with git showing
  real conflicts. Costs: a second repository to keep; installs depend on GitHub; the package's `lib/` build output
  must be committed in the fork or built on install.
- **A local package**: copy the patched 14.0.1 package into `modules/react-native-webview` (or `packages/`) and
  depend on `file:./modules/react-native-webview`. Expo's autolinking finds it like any dependency. Updating means
  copying a new upstream version in and re-applying the changes by hand (the same work as today, without
  patch-package's line matching). Costs: about 1.1 MB of vendored source (without build output) in this repository.

Either way the pin, the exclusion and the patch file go away; the JavaScript code is unchanged.

## Qutai's native modules (`modules/`)

Five local Expo modules (Android unless noted; minSdk 24, React Native's default). Each is a `requireOptionalNativeModule`
in JavaScript, so Expo Go and the other platform simply get `null`. Android manifest entries come from the config
plugins named; nothing in `android/` or `ios/` is edited by hand.

### qutai-agent (Android, iOS)

- **Does**: Android "Keep working in the background": a foreground service (`AgentTaskService`, type `specialUse`)
  with a notification showing the current step, a headless JS task (`QutaiAgentKeepAlive`, registered in `index.ts`)
  that keeps timers running, a timed wake lock, and page commands sent straight to the tab's WebView while React
  Native is paused. Both platforms: `holdRequest` keeps one own-key AI request alive for up to 3 minutes after the
  user leaves (iOS: `beginBackgroundTask`; Android: a quiet "finishing" notification).
- **JS**: `src/device/backgroundTask.ts` (`configure`, `isActive`, `setTask`, `setStep`, `progress`, `pause`,
  `finish`, `evaluate`, `pageState`, `goBack`; events `onStateChange`, `onStopRequested`, `onOpenRequested`);
  `src/device/requestHold.ts` (`holdRequest`, both platforms).
- **Declared by** `plugins/withBackgroundTasks.js`: the service, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_SPECIAL_USE`, `WAKE_LOCK`. Channels `qutai_agent_task` (low), `qutai_agent_alerts` (high), set
  up with qutai-media's `NotificationChannels`. Needs the WebView patch (`RNCWebView.mediaPlaybackKey`).
- **Manual check**: turn on "Keep working in the background", start a multi-step task, press Home: a "working on…"
  notification shows the step and updates; tap Stop: it goes and the chat says the task stopped. Leave during a
  confirmation: a "paused" alert, tapping it opens the conversation. With the setting off, leave during an own-key
  request: a brief "finishing" notification, the reply is there on return.

### qutai-auth (Android)

- **Does**: Google sign-in for Qutai accounts with Credential Manager: takes the web client id and the hashed nonce,
  returns `{ idToken }`; errors `ERR_CANCELED`, `ERR_NO_CREDENTIAL`, `ERR_GOOGLE_SIGN_IN`, `ERR_NO_ACTIVITY`.
- **JS**: `src/account/providers.ts` (`googleSignIn`).
- **Declared by**: nothing beyond its Gradle dependencies (androidx.credentials 1.6.0, googleid 1.1.1).
- **Manual check**: in a pro build, "Continue with Google": the account picker, then signed in. Back out of the
  picker: treated as cancelled, no error. A phone without a Google account: a "no account" message.

### qutai-downloads (Android)

- **Does**: Qutai's own downloader (OkHttp with the tab's cookies, User-Agent and Referer) into the public Downloads
  folder (MediaStore from Android 10, a hidden partial file before), pause and resume with `Range`/`If-Range`, up to 3
  at once, retries on network errors and waits offline; the list in a JSON file; progress, paused and finished
  notifications; runs as a user-initiated job on Android 14+, a `dataSync` service before.
- **JS**: `src/storage/androidDownloads.ts` (`list`, `refresh`, `start`, `beginWrite`, `writeChunk`, `endWrite`,
  `failWrite`, `pause`, `resume`, `retry`, `cancel`, `remove`, `pauseAll`, `resumeAll`, `clearFinished`, `clearAll`,
  `forgetIncognito`, `seen`, `deleteFile`, `open`, `share`, `showFolder`, `needsStoragePermission`; event `onChange`);
  `App.tsx` (`setLanguage`, `consumeOpenRequest`, `consumeOpenFileRequest`; events `onOpenRequested`,
  `onOpenFileRequested`). `isMetered` is defined but nothing calls it.
- **Declared by** `plugins/withDownloads.js`: `DownloadJobService` (`BIND_JOB_SERVICE`), `DownloadService`
  (`dataSync`), `DownloadActionReceiver`, none exported; `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`,
  `RUN_USER_INITIATED_JOBS`, `REQUEST_INSTALL_PACKAGES`, a `<queries>` entry for viewing `content://`;
  `WRITE_EXTERNAL_STORAGE` up to Android 10 from `plugins/withLegacyStorageWrite.js`. Channels `qutai_downloads`
  (low), `qutai_downloads_done`.
- **Manual check**: download a file over 50 MB and press Home: percent, speed and time left, it goes on. Pause and
  resume from the notification: it continues from the same byte (no "restarted" note). Airplane mode mid-download:
  "Waiting", then it continues. Tap the finished notification: the file opens or the app says why not; opening
  Downloads clears finished notifications. On Android 10 specifically, pause and resume a large download (see
  "Suspicious" below).

### qutai-entry (Android, iOS)

- **Does**: Android: queues text shared to Qutai (SEND, PROCESS_TEXT, WEB_SEARCH) for JavaScript; pinned site
  shortcuts ("Add to home screen") and the home-screen widget; the four launcher shortcuts, published as dynamic
  shortcuts in Qutai's language (`AppLanguage.kt`: at start, after a language change in Qutai's settings, on
  `LOCALE_CHANGED` and `MY_PACKAGE_REPLACED`; ids `new_tab`, `new_private_tab`, `ask`, `scan`; no static shortcuts
  since 20 Nov 2026, `LANG-19`); the app language (the system's per-app language on Android 13+, a stored choice
  before), which the shortcuts and the widget's texts follow; the theme for the launch splash
  (Android 12+); sharing files Qutai hands out through a FileProvider. iOS: Home Screen quick actions (an
  AppDelegate subscriber keeps a cold-start shortcut until JavaScript asks) and `shareFiles` through the share sheet.
- **JS**: `src/device/entryPoints.ts` (`takePending`, event `onEntry`, both platforms; `isPinShortcutSupported`,
  `pinSiteShortcut`, `setLaunchAppearance`, Android); `src/device/share.ts` (`shareFiles`, both);
  `src/i18n/appLanguage.ts` (`getAppLanguage`, `setAppLanguage`, `hasSystemAppLanguage`, Android). The Android-only
  calls are guarded on iOS.
- **Declared by**: the module's manifest (`QutaiShareFileProvider`, authority `${applicationId}.qutai.share`, cache
  folders `outgoing/`, `outgoing-incognito/`); `plugins/withEntryPoints.js` (text intent filters,
  `QutaiWidgetProvider`, `QutaiLocaleReceiver`, iOS `UIApplicationShortcutItems`; it declares no launcher shortcuts
  and deletes the `qutai_shortcuts.xml` earlier prebuilds left). No permissions.
- **Manual check**: share a link from another app to Qutai: it offers to open it. Add the widget and resize it small
  to large: the layout switches; "Private tab" opens incognito. Switch the app language to Turkish: the widget's
  labels follow without opening the app. "Add to home screen" on a page: the launcher confirms, the icon opens the
  page. Launcher shortcuts: phone in English, Qutai in Turkish, open Qutai once, long-press the icon: four shortcuts
  in Turkish (Yeni sekme, Gizli sekme, Qutai'a sor, QR tara), no English duplicates; change Qutai's language in its
  settings or the phone's language and long-press again without reopening (Android 13+: within about ten seconds).
  After an update from 0.1.4 a shortcut pinned from the old static ones is greyed (Android disables it; remove and
  pin again), the menu shows the four dynamic ones. "Incognito tab" with the incognito lock on asks for the lock.
  iOS: long-press the icon, "New tab", also from a cold start.

### qutai-media (Android)

- **Does**: keeps a tab's audio playing in the background (`MediaPlaybackService`, type `mediaPlayback`, a media
  notification and MediaSession for the lock screen and headphones), fed natively by the patched WebView
  (`RNCWebViewPlayback`), so it works while React Native is paused; picture-in-picture for a full-screen video, or
  an inline one made full screen as PiP starts (automatic on Android 12+, from `onUserLeaveHint` on 8–11).
- **JS**: `src/device/backgroundMedia.ts` (`configure`, `setPictureInPictureAllowed`).
- **Declared by** `plugins/withBackgroundMedia.js` (the service, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, iOS `UIBackgroundModes` audio) and `plugins/withPictureInPicture.js`
  (`supportsPictureInPicture`, `configChanges`, a MainActivity override for Android 15+). Channel
  `qutai_media_playback`.
- **Manual check**: play audio in a tab and lock the phone: lock-screen controls work, playback goes on. "Keep
  playing" off, press Home: it pauses within about a second. A video full screen, press Home: a PiP window whose
  play/pause works; closing it pauses. In an incognito tab: the notification says "Private tab", no PiP.

### Known problems found while writing this (20 Nov 2026)

The two clear bugs below were fixed on 20 Nov 2026 (version 0.1.4): the assistant's notifications use the flat
drawable `qutai_agent_ic_notification` (qutai-agent `res/drawable`), and the picture-in-picture ratio is rounded and
kept inside Android's limits as a fraction (`MIN_RATIO_PARTS`, `MAX_RATIO_PARTS`). Neither has been seen on a phone
yet. The descriptions stay as the record of what was wrong.

Clear bugs:

1. **The assistant's notifications use the app's launcher icon as their small icon** (`AgentHub.kt:393,397`,
   `AgentTaskService.kt:104,113,142`: `applicationInfo.icon`, which is the adaptive `@mipmap/ic_launcher`). Android
   draws a small icon from its alpha channel only, so it shows as a white blob in the status bar; on Android 8.0 an
   adaptive icon as a notification's small icon is a known "Bad notification" failure, which in `startForeground`
   ends the app. The media and downloads notifications use platform drawables and are fine. Fix: a monochrome
   small-icon drawable.
2. **Picture-in-picture is never offered for very tall videos** (`PictureInPicture.kt:166-167`):
   `Rational((r * 1000).toInt(), 1000)` truncates the lower clamp 1/2.39 (0.41841…) to 0.418, below Android's
   minimum PiP ratio, so setting the parameters throws `IllegalArgumentException` for any video taller than 1:2.39;
   it is caught and logged, and `lastKey` (set before the `try`) keeps it from being tried again. Fix: build the
   Rational from the video's own width and height and clamp that, or round the lower bound up.

Suspicious, worth a test before a fix:

- Downloads may stay "Waiting" after the network returns: a worker setting `online = false` after a failed
  `isOnline()` can race the network callback setting it back to true (`DownloadEngine.kt:416-421` against
  `781-787`).
- Resume on Android 10 may restart from zero: MediaStore can hide the app's own pending row from a plain query
  without `setIncludePending`, so `exists()` is false mid-download (`DownloadSink.kt:57-59,81`).
- iOS share: `completionWithItemsHandler` can report "not completed" when a share extension is cancelled while the
  sheet stays open; JavaScript then hears "cancelled" early and loses a later result (`QutaiEntryModule.swift:54-56`).
- Download notifications' throttle fields are touched from two threads without synchronisation (at worst one
  refresh skipped or doubled; `DownloadNotifications.kt:35-36,134-145`).
- Shared text may be offered twice after the process is killed and restored: the "handled" mark is set only on the
  in-memory intent (`QutaiEntryModule.kt:128`).
