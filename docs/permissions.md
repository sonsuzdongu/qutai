# Permissions

Every permission and usage description Qutai declares, what needs it and when the user is asked. Use this for the
App Store privacy labels and the Google Play Data safety form.

`ios/` and `android/` are generated (Continuous Native Generation), so everything here comes from `app.json` (config
plugins, `ios.infoPlist`, `android.blockedPermissions`), `plugins/withLegacyStorageWrite.js`, `plugins/withBackgroundMedia.js`,
`plugins/withPictureInPicture.js`, the native libraries'
own manifests and the translated iOS strings in `locales/en.json` and `locales/tr.json`. react-native-webview carries a small
patch (`patches/`, applied by `postinstall`) that decides camera and microphone requests from web pages. To see what a build will
declare, run `npx expo config --type introspect` (or `npx expo prebuild --no-install` in a copy of the project). The
Android libraries' own permissions are only merged in by Gradle: check
`android/app/build/intermediates/merged_manifest/release/` after a release build.

Every iOS usage description is in `app.json` (English) and in both `locales/*.json` files with the same keys. Nothing
is asked for at launch: each permission is asked the first time the feature needs it.

## iOS (Info.plist)

| Key | Feature | When the user is asked | Declared by |
| --- | --- | --- | --- |
| `NSCameraUsageDescription` | QR code scanner; taking a photo or video for a web page's upload field (`<input type="file">`); sites the user allows to use the camera (`getUserMedia`, per-site setting) | First time the QR scanner opens, "Take Photo or Video" is chosen in an upload field, or the user allows a site | `expo-camera` plugin, `cameraPermission` |
| `NSMicrophoneUsageDescription` | Voice input in the assistant panel (the microphone button; speech becomes text in the message field, `src/device/voiceInput.ts`); sites the user allows to use the microphone (`getUserMedia`, per-site setting: video calls, voice input on sites); the sound of a video recorded with the system camera for a web page's upload field | First tap on the panel's microphone button, the first time the user allows a site, or such a video is recorded (iOS asks) | `expo-camera` plugin, `microphonePermission`, and the same text in the `expo-speech-recognition` plugin's `microphonePermission` (both write this key, so they must match) |
| `NSSpeechRecognitionUsageDescription` | Voice input in the assistant panel (`SFSpeechRecognizer`). On-device recognition is used whenever the phone supports it for the language; otherwise Apple's speech service receives the audio, only after the user agreed once in Qutai (never in incognito conversations). Qutai and the AI provider get only the recognised text | First tap on the panel's microphone button (asked together with the microphone) | `expo-speech-recognition` plugin, `speechRecognitionPermission` |
| `NSPhotoLibraryAddUsageDescription` | Saving screenshots (visible area or full page) and images from pages to Photos. Add-only: Qutai can't see the library | First save | `expo-media-library` plugin, `savePhotosPermission` (`photosPermission: false`, so no read key) |
| `NSFaceIDUsageDescription` | Locking the app and incognito tabs with Face ID | When the lock is turned on or first used | `expo-local-authentication` plugin, `faceIDPermission` |
| `NSCalendarsWriteOnlyAccessUsageDescription` (iOS 17+), `NSCalendarsUsageDescription` (iOS 16 and older) | The assistant adds an event the user confirmed (tickets, reservations). Write-only on iOS 17+: adding events never asks to read the calendar. On iOS 16 and older one grant covers adding and reading, so the old key mentions both | First event the user confirms | `expo-calendar` plugin, `writeOnlyAccess: true`, `writeOnlyCalendarPermission`, `calendarPermission` |
| `NSCalendarsFullAccessUsageDescription` (iOS 17+) | The assistant's `read_calendar` ("am I free on Friday?"): reads the events of a range the user confirmed, each time, and sends their titles, times and places (notes only if the confirmation says so) to the AI provider. Not asked by the add tools. If write-only access was granted first, iOS asks once more to upgrade to full access; a "no" keeps write-only | First `read_calendar` the user confirms | `ios.infoPlist` in `app.json` (the `expo-calendar` plugin writes either the write-only or the full-access key, not both) |
| `NSRemindersFullAccessUsageDescription` (iOS 17+), `NSRemindersUsageDescription` (iOS 16 and older) | The assistant adds a reminder the user confirmed. iOS has no write-only Reminders access; Qutai only writes | First reminder the user confirms | `expo-calendar` plugin, `remindersPermission` |
| `NSLocationWhenInUseUsageDescription` | Position for sites the user allows (per-site setting) and for the assistant's `get_location` (confirmed every time). Foreground only, approximate accepted | First time a site or the assistant needs it | `expo-location` plugin, `locationWhenInUsePermission` (every "always"/background/motion option `false`) |
| Notifications (no Info.plist key) | Local notifications the assistant schedules after the user confirms, and reminders for saved tasks the user schedules. No push: no `aps-environment` entitlement, no push token | First scheduled notification | `expo-notifications` plugin, `enableRemoteNotifications: false` |
| `UIBackgroundModes`: `audio` (no prompt) | "Keep playing in the background": music, podcasts and other sound the user starts in a web page go on when Qutai is in the background or the screen locks, with WebKit's lock screen and headphone controls. Also what the system player's picture-in-picture needs to go on outside the app. WebKit switches the audio session to playback only while a page plays audible media and leaves it after the sound stops, so a silent app is suspended as usual | Never (no permission) | `plugins/withBackgroundMedia.js` |
| `NSLocalNetworkUsageDescription` | A custom AI endpoint (Settings › Assistant › Custom, OpenAI-compatible) on the local network, such as Ollama or LM Studio on a computer at home. iOS 14+ asks before the app's first connection to a local address. Translated in `locales/` (not the dev client's text, so its release build phase keeps it). Development builds also use it for the dev client finding the Metro server | First request to a local-network address (a custom endpoint's "Test connection", "Fetch models" or a task) | `ios.infoPlist` in `app.json` |
| `NSBonjourServices` | Development builds only: the dev client finding the Metro server. `expo-dev-client` removes it from release builds in a build phase | Development builds only | `expo-dev-client` plugin |

Other store-facing iOS declarations:

- Audio background mode (App Review guideline 2.5.4: background services only for their intended purpose, "audio
  playback"): it is used only for playback the user started in a web page (a site's music, podcast or video player).
  Qutai never plays sound of its own in the background (read-aloud and the assistant's speech stop when it leaves the
  foreground) and doesn't keep a silent audio session. Review notes: "Qutai is a web browser; audio a user plays on a
  website (e.g. a podcast or music site) continues in the background, like Safari."

- `UIApplicationShortcutItems`: the Home Screen quick actions (New tab, New incognito tab, Ask Qutai, Scan QR code;
  `plugins/withEntryPoints.js`). No permission; each is a `qutai://` link handled like any other.
- App Transport Security (`ios.infoPlist.NSAppTransportSecurity` in `app.json`, the values the Expo template
  already generated, now explicit): `NSAllowsArbitraryLoads` `false`, `NSAllowsLocalNetworking` `true`. The local
  networking exception is what lets a custom AI endpoint on the local network be reached over plain http (`.local`
  and unqualified names; ATS does not apply to IP address literals). The app itself allows http for a custom endpoint
  only to loopback and private addresses (`src/ai/customEndpoint.ts`) and says "not encrypted, local network only".
- `ITSAppUsesNonExemptEncryption` is `false` (`ios.config.usesNonExemptEncryption`): Qutai only uses HTTPS and the
  operating system's own encryption (Keychain via `expo-secure-store`).
- Privacy manifest (`ios.privacyManifests`): the required-reason APIs that the bundled libraries declare in their own
  `PrivacyInfo.xcprivacy` (React Native, `expo-application`, `expo-constants`, `expo-file-system`,
  `expo-localization`, `expo-media-library`, `expo-notifications`, `expo-system-ui`), repeated at app level as the
  Expo guide advises, because Apple doesn't always read the manifests of static CocoaPods: UserDefaults `CA92.1`,
  file timestamp `C617.1` `0A2A.1` `3B52.1`, system boot time `35F9.1`, disk space `E174.1` `85F4.1`. No tracking,
  no tracking domains; the collected data types list is empty (Qutai has no servers of its own; see "Notes for the
  store forms"). Update it when a library adds a new reason (Apple's email after an upload lists any missing one).

## Android (AndroidManifest.xml)

Runtime permissions (the user is asked):

| Permission | Feature | When the user is asked | Declared by |
| --- | --- | --- | --- |
| `CAMERA` | QR code scanner; the camera option in a web page's upload field (offered once Qutai holds the permission); sites the user allows to use the camera (`getUserMedia`) | First time the QR scanner opens, the user taps an upload field with `capture` (a "take a photo" button; `src/browser/fileCapture.ts`), or the user allows a site | `expo-camera` (plugin and library manifest) |
| `RECORD_AUDIO` | Voice input in the assistant panel (Android `SpeechRecognizer`, on-device on Android 13+ when the language's model is installed, otherwise Google's speech service after the user agreed once in Qutai); sites the user allows to use the microphone (`getUserMedia`) | First tap on the panel's microphone button, or the first time the user allows a site | `expo-camera` plugin, `recordAudioAndroid: true` (the `expo-speech-recognition` plugin declares it too) |
| `WRITE_EXTERNAL_STORAGE` (Android 10 and older, `maxSdkVersion` 29) | Saving screenshots and images to the gallery (Android 10 and older); downloads to the Downloads folder (Android 9 and older). Android 11+ needs no storage permission for either | First save or download on those versions | `plugins/withLegacyStorageWrite.js` (the libraries declare it up to Android 12; this lowers it) |
| `READ_CALENDAR`, `WRITE_CALENDAR` | Adding events and reminders (a reminder is a calendar event with an alarm on Android); the assistant's `read_calendar`, confirmed each time. Read is needed to find a writable calendar; Android has no write-only calendar access, so one prompt covers both | First event or reminder the user confirms, or the first `read_calendar` | `expo-calendar` plugin |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | Same as iOS location; approximate accepted. Foreground only | First time a site or the assistant needs it | `expo-location` (plugin and library manifest) |
| `POST_NOTIFICATIONS` (Android 13+) | Local notifications the assistant schedules; reminders for saved tasks (asked when the first one is saved); the notifications of "Keep working in the background" (the running task, what it needs from the user, how it ended) | First scheduled notification, or turning "Keep working in the background" on (if refused for good: an "Open settings" offer; the task still runs, without visible progress) | `expo-notifications` library manifest |

Install-time permissions (no prompt):

| Permission | Why | Declared by |
| --- | --- | --- |
| `INTERNET` | Loading pages, talking to the AI provider the user chose | Expo template, `expo-file-system` |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | App and incognito lock (fingerprint for Android 8 and older) | `expo-local-authentication` |
| `VIBRATE` | Haptic feedback | `expo-haptics` |
| `RECEIVE_BOOT_COMPLETED` | Scheduled notifications survive a restart | `expo-notifications` |
| `WAKE_LOCK` | "Keep working in the background": a partial wake lock while an assistant task runs in the background, so it goes on with the screen off. Held only while the task's service runs, with a 5-minute timeout that progress renews; released as soon as the task pauses or ends. Also required by the Firebase Messaging library that `expo-notifications` bundles (Qutai doesn't use push) | `plugins/withBackgroundTasks.js`, `expo-notifications` (Firebase Messaging) |
| `DETECT_SCREEN_CAPTURE` (Android 14+) | `expo-screen-capture` registers a screen-capture callback as soon as it loads, which needs this permission. Qutai only blocks screenshots in incognito tabs (`FLAG_SECURE`) and doesn't listen for them | `expo-screen-capture` |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | "Keep playing in the background": the `mediaPlayback` foreground service (`expo.modules.qutaimedia.MediaPlaybackService`, local module `modules/qutai-media`) runs only while a tab plays sound and up to two minutes after it pauses, with a media notification (play/pause, previous/next when the site offers them, lock screen, headphone buttons). Started only while Qutai is on screen, stopped when playback ends, the tab closes, the setting is turned off or Qutai is swiped away. Its notification needs no `POST_NOTIFICATIONS` prompt: media session notifications are exempt on Android 13+ | `plugins/withBackgroundMedia.js` (the service, `foregroundServiceType="mediaPlayback"`, `exported="false"`) |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE` | "Keep working in the background" (Settings › Assistant, off by default): the `specialUse` foreground service `expo.modules.qutaiagent.AgentTaskService` (local module `modules/qutai-agent`) keeps an assistant task the user started running when they leave Qutai, with an ongoing notification (task title from the user's own message, hidden on the lock screen; the current step; Stop and Open). Started only at the moment Qutai leaves the screen while a task runs, stopped when the user returns, the task ends, fails, is stopped, pauses because it needs the user, stalls, or after 30 minutes in the background; never for incognito conversations | `plugins/withBackgroundTasks.js` (the service, `foregroundServiceType="specialUse"`, `exported="false"`, and its `android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE` property) |
| `<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX's private permission for the app's own broadcast receivers | `androidx.core` |

Blocked (`android.blockedPermissions` in `app.json`, removed from the merged manifest):

| Permission | Added by | Why it's blocked |
| --- | --- | --- |
| `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION` | `expo-location` | Location is foreground only |
| `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VISUAL_USER_SELECTED` | Expo template, `expo-media-library`, `expo-file-system`, `expo-screen-capture` | Qutai only adds to the gallery (write-only requests ask for none of these) and doesn't listen for screenshots. File imports use the system picker, which needs no permission |
| `SYSTEM_ALERT_WINDOW` | Expo template | Only for the development overlay; debug builds keep it from their own manifest |
| `com.google.android.c2dm.permission.RECEIVE` | Firebase Messaging (`expo-notifications`) | No push notifications |
| `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` | Install Referrer (`expo-application`) | Qutai doesn't read the install referrer |
| `READ_APP_BADGE` and the launcher badge permissions (Samsung, HTC, Sony, Huawei, OPPO, …) | ShortcutBadger (`expo-notifications`) | Qutai never sets a badge count |

Cleartext (plain http) for a custom AI endpoint: not enabled. Release builds target an API level where cleartext is
off by default (only the debug manifests set `usesCleartextTraffic`, for the Metro server), and a network security
config can only allow it per named domain or exact IP, not for private address ranges; allowing it everywhere would
cover every host the app talks to. So on Android a custom endpoint must use https (the settings say so, and an http
address is refused before saving); iOS allows http to local addresses (above).

Main activity: `android:supportsPictureInPicture="true"` and `configChanges` including
`screenSize|smallestScreenSize|screenLayout|orientation` (`plugins/withPictureInPicture.js`), for picture-in-picture of
a playing full-screen video when the user goes home. No permission; it is not offered for incognito tabs or while the
app lock is on, and Settings › Appearance › "Picture-in-picture" turns it off.

Google Play Console, "Foreground service permissions" declaration (App content), for `mediaPlayback`:

- Use case: "Media playback"; description: "Qutai is a web browser. When the user plays audio or video on a website
  (music, podcasts, talks) and leaves the app or locks the screen, playback continues in a foreground service with a
  media notification and controls. It runs only while a page is playing (and two minutes after it pauses) and can be
  turned off in Settings."
- Impact if deferred or interrupted: playback the user started stops as soon as they leave the app.
- Video: required; record the user starting playback on a site, pressing Home, the notification and lock screen
  controls, and pausing (the policy says background audio the user didn't start, such as automatic sounds, doesn't
  qualify). Not recorded yet: it needs a device.
- Picture-in-picture is a separate feature, not a foreground service; it needs no declaration.

Same declaration, for `specialUse` ("Keep working in the background"):

- Use case: "Other" (custom); description: "Qutai is a web browser with an AI assistant. When the user gives the
  assistant a task (for example: compare these products, fill in this form, summarise these pages) and then leaves the
  app or locks the screen, the task the user started continues in a foreground service: it reads and operates the web
  pages the task opened in the app and sends the requests to the AI provider the user chose. The notification shows the
  task and its current step and has a Stop button. The service runs only while that task runs; it stops when the task
  finishes, fails or is stopped, when the user returns to the app, when a step needs the user (a confirmation, a
  question: the task pauses and a notification says so), and after 30 minutes. It is off by default and turned on by
  the user in Settings › Assistant › Keep working in the background."
- Why a foreground service: the work happens in the app's own WebViews (the user's logged-in pages, cookies and tabs
  live on the device), so it cannot move to a server or to WorkManager/JobScheduler; it is started by the user, visible
  to them and stoppable at any time, and has no fixed end time. No other foreground service type covers operating web
  pages for the user (`dataSync` is for transferring data; the task is mostly reading and acting on pages), so it is
  declared as `specialUse` with the subtype text in the manifest (`plugins/withBackgroundTasks.js`).
- Impact if deferred or interrupted: the user's task stops half-way as soon as they leave the app (as it does with the
  setting off); it continues only when they come back.
- Video: required; record turning the setting on (the notification permission prompt), starting a multi-step task,
  pressing Home, the notification with its steps, a step that needs a confirmation (the "Qutai paused" notification,
  opening the app shows the dialog), Stop from the notification, and the finish notification. Not recorded yet: it
  needs a device.

Intent filters without a permission (`plugins/withEntryPoints.js`): `SEND` `text/plain` (the share sheet),
`PROCESS_TEXT` `text/plain` (other apps' text-selection menu) and `WEB_SEARCH`, on the main activity, besides the
`http`/`https` and `qutai` links. What arrives is only text; it is handled as untrusted input (see README, "Opening
Qutai from other apps"). The main activity also carries the launcher shortcuts (`android.app.shortcuts` meta-data,
`res/xml/qutai_shortcuts.xml`); pinning a page with "Add to home screen" needs no permission (the launcher asks). The home screen widget is a
non-exported receiver (`expo.modules.qutaientry.QutaiWidgetProvider`, `APPWIDGET_UPDATE`); no permission.

Debug builds also get `ACCESS_NETWORK_STATE`, `ACCESS_LOCAL_NETWORK` and `CHANGE_WIFI_MULTICAST_STATE` from the dev
client and React Native's debug manifest.

Package visibility (`<queries>`): only what the libraries declare (sharing, mail composer, document picker, text to
speech engines, WebView payment intents, calendar), plus the speech recognition services voice input may bind to:
`com.google.android.googlequicksearchbox` (Android 12 and older), `com.google.android.tts` (Speech Recognition &
Synthesis, Android 13+) and `com.google.android.as` (Android System Intelligence, the on-device recogniser), each with
the `android.speech.RecognitionService` intent (`expo-speech-recognition` plugin, `androidSpeechServicePackages`).
Qutai doesn't call `canOpenURL`; links to other apps go straight to `openURL`.

## Web pages

| Capability | iOS | Android |
| --- | --- | --- |
| Location (`navigator.geolocation`) | Qutai's per-site prompt (ask / allow / block), see `src/browser/geolocation.ts` | Same; the WebView's own geolocation is off |
| Camera and microphone (`getUserMedia`) | Qutai's per-site prompt, camera and microphone separately (ask / allow / block), see `src/browser/mediaCapture.ts`. WebKit grants only the main frame of the allowed origin and only the allowed kinds (patched react-native-webview, `mediaCaptureGrant`); everything else is refused without a prompt | Same rule; the patched `onPermissionRequest` grants only the requesting frame's origin when it is the allowed one, and only the allowed kinds, and never asks the OS for anything else. Frames from other sites are refused on both. Screen sharing (`getDisplayMedia`) is refused |
| Upload field (`<input type="file">`) | Photo picker (no permission), Files, or the system camera ("Take Photo or Video": camera prompt, plus microphone for a video with sound) | System file picker (no permission); the camera option is offered only once Qutai holds `CAMERA` |
| Media playback | Plays as in Safari. With "Keep playing in the background" on, `<audio>` and audio-only media go on in the background (WebKit pauses `<video>` elements when the app leaves the foreground, except in picture-in-picture); the lock screen, Control Center and headphones control the page through WebKit's own Now Playing and the page's Media Session. Incognito tabs: the page's Media Session title, artist and artwork are replaced with "Private tab" | With the setting on, the page's sound goes on in the background with Qutai's media notification (the page's Media Session metadata, or its title and site; "Private tab" for incognito tabs, never artwork). Media inside frames isn't seen on Android, so it gets no notification and may stop in the background |
| Downloads | Saved in the app's own Downloads folder (no permission) | System download manager; asks for `WRITE_EXTERNAL_STORAGE` on Android 9 and older |

## Notes for the store forms

- Qutai has no servers of its own. Page content, chats and screenshots the user sends to the assistant go from the
  device to the AI provider the user chose, with the user's own key.
- Location goes only to sites the user allowed and, when the user confirms each time, to the AI provider.
- Camera and microphone: a page gets the live stream only on a site the user allowed for that device; Qutai doesn't
  record or keep it, and the assistant can't grant it.
- Media playback in the background: no data leaves the phone for it. On Android the notification's artwork is
  loaded from the address the page's Media Session gives (https only, normal tabs only), without cookies.
- Photos: write-only; nothing is read from the library. Reminders: Qutai only writes, though iOS grants read access
  too.
- Calendar: read only by the assistant's `read_calendar`, when the user asks about their schedule and confirms the
  range each time (never in incognito conversations). The events of that range go to the AI provider; they are not
  stored by Qutai (no memory, the action history records only the range, the "sent to the AI" log keeps the text in
  memory only). On iOS 17+ adding events uses write-only access and reading asks for full access separately.
- Voice input (assistant panel): speech becomes text in the message field; nothing is recorded to disk and no audio
  goes to Qutai or the AI provider (only the text, when the user sends it, like a typed message). The phone's own
  recogniser runs on the device when it supports the language (iOS on-device dictation; Android 13+ with the language
  downloaded). Otherwise the audio goes to Apple's or Google's speech service, only after the user agreed once in Qutai
  (Settings › Assistant shows and changes the answer); incognito conversations never use it. For the store forms this
  is processed by the platform's speech service, not collected by Qutai.
- Camera: QR codes are decoded on the device; photos and videos for uploads go only to the page the user is
  uploading to.
- No analytics, no advertising ID, no tracking (pro builds' planned analytics will change the forms; see TODO.md).
