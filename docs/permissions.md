# Permissions

Every permission and usage description Qutai declares, what needs it and when the user is asked. Use this for the
App Store privacy labels and the Google Play Data safety form.

`ios/` and `android/` are generated (Continuous Native Generation), so everything here comes from `app.json` (config
plugins, `ios.infoPlist`, `android.blockedPermissions`), `plugins/withLegacyStorageWrite.js`, `plugins/withBackgroundMedia.js`,
`plugins/withPictureInPicture.js`, `plugins/withDownloads.js`, the native libraries'
own manifests and the translated iOS strings in `locales/en.json` and `locales/tr.json`. react-native-webview carries a small
patch (`patches/`, applied by `postinstall`) that decides camera and microphone requests from web pages and lets the user continue past a certificate error (below). To see what a build will
declare, run `npx expo config --type introspect` (or `npx expo prebuild --no-install` in a copy of the project). The
Android libraries' own permissions are only merged in by Gradle: check
`android/app/build/intermediates/merged_manifests/release/` and the merger report
`android/app/build/outputs/logs/manifest-merger-release-report.txt` (which library added what) after
`./gradlew :app:processReleaseMainManifest`. `aapt2 dump badging` of an APK also prints permissions Android implies
without a manifest entry (see `READ_EXTERNAL_STORAGE` below); `aapt2 dump xmltree --file AndroidManifest.xml` shows the
manifest itself.

Every iOS usage description is in `app.json` (English) and in both `locales/*.json` files with the same keys. Nothing
is asked for at launch. The first-run setup has an optional step, "What Qutai may use" (`src/components/PermissionsStep.tsx`,
`src/device/permissionStatus.ts`): one row per permission the assistant can use (location, calendar, Reminders on iOS,
notifications), each with what it is for and a switch; the system prompt is shown only when the user turns a switch on,
the switch then shows the system's answer (allowed; iOS write-only calendar access as "default calendar only"; not
allowed; not allowed for good with "Open settings"), and turning an allowed one off opens the phone's settings (the
only place to take a permission back). The step can be passed with every switch off. Everything not allowed there is
asked the first time the feature needs it, exactly as before; nothing is ever asked twice by Qutai once the system has
an answer. The camera and the microphone are not in the step: they are asked where their use is plain (QR scanner,
taking a photo, the microphone button).

## iOS (Info.plist)

| Key | Feature | When the user is asked | Declared by |
| --- | --- | --- | --- |
| `NSCameraUsageDescription` | QR code scanner; taking a photo or video for a web page's upload field (`<input type="file">`); taking a photo to attach to a message to the assistant (attach button › Take photo, `src/device/attachments.ts`); sites the user allows to use the camera (`getUserMedia`, per-site setting) | First time the QR scanner opens, "Take Photo or Video" is chosen in an upload field, "Take photo" is chosen in the attach sheet, or the user allows a site | `expo-camera` plugin, `cameraPermission`, and the same text in the `expo-image-picker` plugin's `cameraPermission` (both write this key, so they must match) |
| `NSMicrophoneUsageDescription` | Voice input in the assistant panel (the microphone button; speech becomes text in the message field, `src/device/voiceInput.ts`); sites the user allows to use the microphone (`getUserMedia`, per-site setting: video calls, voice input on sites); the sound of a video recorded with the system camera for a web page's upload field | First tap on the panel's microphone button, the first time the user allows a site, or such a video is recorded (iOS asks) | `expo-camera` plugin, `microphonePermission`, and the same text in the `expo-speech-recognition` plugin's `microphonePermission` (both write this key, so they must match) |
| `NSSpeechRecognitionUsageDescription` | Voice input in the assistant panel (`SFSpeechRecognizer`). On-device recognition is used whenever the phone supports it for the language; otherwise Apple's speech service receives the audio, only after the user agreed once in Qutai (never in incognito conversations). Qutai and the AI provider get only the recognised text | First tap on the panel's microphone button (asked together with the microphone) | `expo-speech-recognition` plugin, `speechRecognitionPermission` |
| `NSPhotoLibraryAddUsageDescription` | Saving screenshots (visible area or full page), images from pages, images attached to the assistant (their full-screen preview › Save), edited images (their card › Save to Photos) and an image a site couldn't take from `upload_image` to Photos. Add-only: Qutai can't see the library | First save | `expo-media-library` plugin, `savePhotosPermission` (`photosPermission: false`, so no read key) |
| `NSPhotoLibraryUsageDescription` | Not requested by Qutai: attaching and uploading images use the system photo picker, which needs no library permission. The string is there because App Store Connect refuses a build without it (ITMS-90683) when a bundled library (`expo-image-picker`, `expo-media-library`) references the photo library API | Never asked for by Qutai itself | `photosPermission` of the `expo-image-picker` and `expo-media-library` plugins, translated in `locales/*.json` |
| `NSFaceIDUsageDescription` | Locking the app and incognito tabs with Face ID | When the lock is turned on or first used | `expo-local-authentication` plugin, `faceIDPermission` |
| `NSCalendarsWriteOnlyAccessUsageDescription` (iOS 17+), `NSCalendarsUsageDescription` (iOS 16 and older) | The assistant adds an event the user confirmed (tickets, reservations). Write-only on iOS 17+: adding events never asks to read the calendar. On iOS 16 and older one grant covers adding and reading, so the old key mentions both | First event the user confirms | `expo-calendar` plugin, `writeOnlyAccess: true`, `writeOnlyCalendarPermission`, `calendarPermission` |
| `NSCalendarsFullAccessUsageDescription` (iOS 17+) | Listing the user's calendars so they can choose where the assistant's events go (Settings › Assistant › Calendar for the assistant, `src/components/CalendarChoiceScreen.tsx`; write-only access shows only a virtual calendar, so choosing needs full access), and the assistant's `read_calendar` ("am I free on Friday?"): reads the events of a range the user confirmed, each time, and sends their titles, times and places (notes only if the confirmation says so) to the AI provider. Not asked by the add tools. If write-only access was granted first, iOS asks once more to upgrade to full access; a "no" keeps write-only | The setup step's Calendar switch, "Allow access" in the calendar chooser, or the first `read_calendar` the user confirms | `ios.infoPlist` in `app.json` (the `expo-calendar` plugin writes either the write-only or the full-access key, not both) |
| `NSRemindersFullAccessUsageDescription` (iOS 17+), `NSRemindersUsageDescription` (iOS 16 and older) | The assistant adds a reminder the user confirmed, to the Reminders list the user chose (calendar chooser) or the default list. iOS has no write-only Reminders access; Qutai only writes, and reads only the lists' names and colours for the chooser | The setup step's Reminders switch, "Allow access" in the chooser, or the first reminder the user confirms | `expo-calendar` plugin, `remindersPermission` |
| (none) `NSPhotoLibraryUsageDescription` | Attaching images to the assistant uses the system photo picker (PHPicker), which needs no photo library access: only the chosen images reach Qutai | Never | `expo-image-picker` plugin with `photosPermission: false`, so the key is not written |
| `NSLocationWhenInUseUsageDescription` | Position for sites the user allows (per-site setting), for the assistant's `get_location` (confirmed each time unless the user ticked "Don't ask again"), and for "Use my location" on setup's city question (reverse geocoded by Apple's `CLGeocoder`, see "Notes for the store forms"). Foreground only, approximate accepted | The setup step's Location switch, "Use my location" in setup, or the first time a site or the assistant needs it | `expo-location` plugin, `locationWhenInUsePermission` (every "always"/background/motion option `false`) |
| `NSContactsUsageDescription` | The assistant's `find_contact` ("call Ahmet", "WhatsApp Ayşe", "email this to Mehmet Bey"): looks up, on the phone, only a name the user said in the conversation (checked by the app), at most 5 people; the AI gets the matching names, the labels of their numbers and addresses ("mobile", "work email") and opaque handles, never a number or address. The app puts the real value on the Call button, the text / WhatsApp card or into the mail composer, and the user calls or sends. Read only, never in incognito conversations. iOS 18 limited access works with the contacts the user shared (Settings › Assistant › Contacts › Choose contacts). See docs/contacts.md | First `find_contact`, after a short pre-explanation in Qutai's own dialog; or "Allow" in Settings › Assistant › Contacts | `expo-contacts` plugin, `contactsPermission`, translated in `locales/*.json` |
| Notifications (no Info.plist key) | Local notifications the assistant schedules after the user confirms, and reminders for saved tasks the user schedules. No push: no `aps-environment` entitlement, no push token | The setup step's Notifications switch, or the first scheduled notification | `expo-notifications` plugin, `enableRemoteNotifications: false` |
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
| `CAMERA` | QR code scanner; the camera option in a web page's upload field (offered once Qutai holds the permission); "Take photo" in the assistant's attach sheet (the system camera app, which Android lets an app open only while it holds `CAMERA` when it declares it); sites the user allows to use the camera (`getUserMedia`) | First time the QR scanner opens, the user taps an upload field with `capture` (a "take a photo" button; `src/browser/fileCapture.ts`), chooses "Take photo" in the attach sheet, or the user allows a site | `expo-camera` (plugin and library manifest), `expo-image-picker` library manifest |
| `RECORD_AUDIO` | Voice input in the assistant panel (Android `SpeechRecognizer`, on-device on Android 13+ when the language's model is installed, otherwise Google's speech service after the user agreed once in Qutai); sites the user allows to use the microphone (`getUserMedia`) | First tap on the panel's microphone button, or the first time the user allows a site | `expo-camera` plugin, `recordAudioAndroid: true` (the `expo-speech-recognition` and `expo-image-picker` plugins declare it too; the image picker's `microphonePermission` must stay a string, since `false` would block it for voice input) |
| (none) storage read permissions | Attaching images to the assistant uses the system photo picker (Android 11+ or the Google Play services backport), which needs no permission. `expo-image-picker` and `expo-file-system` declare `READ_EXTERNAL_STORAGE` up to Android 12; it stays blocked with the others in `android.blockedPermissions` and is not in the merged manifest (the merger report lists both as REJECTED). `aapt2 dump badging` still prints `READ_EXTERNAL_STORAGE` with `maxSdkVersion='29'`, as a `uses-implied-permission` with "reason='requested WRITE_EXTERNAL_STORAGE'": Android treats read access as part of `WRITE_EXTERNAL_STORAGE` (below), so on Android 10 and older a user who allows saving also allows reading shared storage. Qutai never reads it; this can't be removed without dropping saving on those versions | Never asked for on its own | – |
| `WRITE_EXTERNAL_STORAGE` (Android 10 and older, `maxSdkVersion` 29) | Saving screenshots and images to the gallery (Android 10 and older); downloads to the public Downloads folder (Android 9 and older: Qutai writes the file there itself, `modules/qutai-downloads`). From Android 10 downloads go through `MediaStore.Downloads` and from Android 11 the gallery through MediaStore, with no storage permission | First save, or first download on Android 9 and older (`src/browser/downloadRequests.ts`; a refusal says Qutai can't save files) | `plugins/withLegacyStorageWrite.js` (the libraries, `expo-image-picker` among them, declare it up to Android 12; this lowers it) |
| `READ_CALENDAR`, `WRITE_CALENDAR` | Adding events and reminders (a reminder is a calendar event with an alarm on Android) to the calendar the user chose (calendar chooser) or the primary one; the assistant's `read_calendar`, confirmed each time unless the user ticked "Don't ask again". Read is needed to list and find a writable calendar; Android has no write-only calendar access, so one prompt covers both | The setup step's Calendar switch, "Allow access" in the calendar chooser, or the first event or reminder the user confirms (when that grant has two or more writable calendars to choose from, the chooser opens before the event is added), or the first `read_calendar` | `expo-calendar` plugin |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | Same as iOS location (setup's "Use my location" is reverse geocoded by Android's `Geocoder`); approximate accepted. Foreground only | The setup step's Location switch, "Use my location" in setup, or the first time a site or the assistant needs it | `expo-location` (plugin and library manifest) |
| `READ_CONTACTS` | Same as iOS contacts: the assistant's `find_contact` reads the name fields of the address book on the phone to find a name the user said, then the numbers and email addresses of at most 5 matches; nothing is uploaded, and the AI never gets a number or address (docs/contacts.md). Not asked in setup; never in incognito conversations | First `find_contact` (after Qutai's pre-explanation), or "Allow" in Settings › Assistant › Contacts. Refused twice: only the phone's settings (the row offers "Open phone settings") | `expo-contacts` plugin |
| `POST_NOTIFICATIONS` (Android 13+) | Local notifications the assistant schedules; reminders for saved tasks (asked when the first one is saved); the notifications of "Keep working in the background" (the running task, what it needs from the user, how it ended); download progress (with Pause / Resume / Cancel) and finished downloads | The setup step's Notifications switch, first scheduled notification, turning "Keep working in the background" on, in the first-run setup or Settings (if refused for good: an "Open settings" offer; the task still runs, without visible progress), or right after the first download starts (downloads work without it: the in-app Downloads screen is then the only progress display; Android 14+ still lists a running download in the Task Manager) | `expo-notifications` library manifest |

Install-time permissions (no prompt):

| Permission | Why | Declared by |
| --- | --- | --- |
| `INTERNET` | Loading pages, talking to the AI provider the user chose | Expo template, `expo-file-system` |
| `ACCESS_NETWORK_STATE` | Whether the phone is online, for the libraries that need it: media playback (`androidx.media3`, used by the `modules/qutai-media` service) and the Firebase libraries `expo-notifications` bundles (Qutai doesn't use push). Qutai's own code reads it only in pro builds, for the daily server backup's "Only on Wi-Fi" (`getNetworkStateAsync` in `src/backup/server/index.ts`: the connection type, checked when Qutai opens or comes to the foreground; docs/server-backup.md) | `androidx.media3:media3-common`, `firebase-messaging`, `firebase-installations`, `expo-network` |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | App and incognito lock (fingerprint for Android 8 and older) | `expo-local-authentication` |
| `VIBRATE` | Haptic feedback | `expo-haptics` |
| `RECEIVE_BOOT_COMPLETED` | Scheduled notifications survive a restart | `expo-notifications` |
| `WAKE_LOCK` | "Keep working in the background": a partial wake lock while an assistant task runs in the background, so it goes on with the screen off. Held only while the task's service runs, with a 5-minute timeout that progress renews; released as soon as the task pauses or ends. Also required by the Firebase Messaging library that `expo-notifications` bundles (Qutai doesn't use push) | `plugins/withBackgroundTasks.js`, `expo-notifications` (Firebase Messaging) |
| `DETECT_SCREEN_CAPTURE` (Android 14+) | `expo-screen-capture` registers a screen-capture callback as soon as it loads, which needs this permission. Qutai only blocks screenshots in incognito tabs (`FLAG_SECURE`) and doesn't listen for them | `expo-screen-capture` |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | "Keep playing in the background": the `mediaPlayback` foreground service (`expo.modules.qutaimedia.MediaPlaybackService`, local module `modules/qutai-media`) runs only while a tab plays sound and up to two minutes after it pauses, with a media notification (play/pause, previous/next when the site offers them, lock screen, headphone buttons). Started only while Qutai is on screen, stopped when playback ends, the tab closes, the setting is turned off or Qutai is swiped away. Its notification needs no `POST_NOTIFICATIONS` prompt: media session notifications are exempt on Android 13+ | `plugins/withBackgroundMedia.js` (the service, `foregroundServiceType="mediaPlayback"`, `exported="false"`) |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE` | "Keep working in the background" (Settings › Assistant, off by default): the `specialUse` foreground service `expo.modules.qutaiagent.AgentTaskService` (local module `modules/qutai-agent`) keeps an assistant task the user started running when they leave Qutai, with an ongoing notification (task title from the user's own message, hidden on the lock screen; the current step; Stop and Open). Started only at the moment Qutai leaves the screen while a task runs, stopped when the user returns, the task ends, fails, is stopped, pauses because it needs the user, stalls, or after 30 minutes in the background; never for incognito conversations. **Also, with the setting off:** a short "finishing a reply" mode of the same service when Qutai leaves the screen while an AI request to the user's own key is in flight (`src/device/requestHold.ts`): one generic quiet notification ("Qutai is finishing a reply"), no task step goes on, stopped as soon as the request ends, the user returns, or after 3 minutes; not for incognito conversations; the notification permission is never asked for it (without it Android hides the notification). No new permission or service type | `plugins/withBackgroundTasks.js` (the service, `foregroundServiceType="specialUse"`, `exported="false"`, and its `android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE` property) |
| `RUN_USER_INITIATED_JOBS` (Android 14+) | Downloads keep going when the user leaves Qutai: one user-initiated data transfer job (`JobScheduler`, `setUserInitiated(true)`, `expo.modules.qutaidownloads.DownloadJobService`, `BIND_JOB_SERVICE`, not exported) runs while any download is active, with the downloads' notification, and ends when none is left. Scheduled only when the user starts or resumes a download while Qutai is on screen; it has a network constraint, so Android stops it while offline and runs it again when a network is back. Android's own guidance for user-initiated transfers. No Play Console declaration (it is not a foreground service type) | `plugins/withDownloads.js` |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` | Downloads in the background on Android 8 to 13, and on Android 14+ only when the job above can't be scheduled (for example "Resume" pressed in a notification while Qutai is in the background): the `dataSync` foreground service `expo.modules.qutaidownloads.DownloadService` runs only while a download is active, with the same notification, and stops when none is left. On Android 15+ `dataSync` is limited to 6 hours a day; when that is reached, `onTimeout` pauses the downloads (resumable from the app) and the service stops | `plugins/withDownloads.js` (the service, `foregroundServiceType="dataSync"`, `exported="false"`, and the notification action receiver `DownloadActionReceiver`, not exported) |
| `REQUEST_INSTALL_PACKAGES` | "Open" on a downloaded APK (the Downloads screen, the download pill, the finished download's notification) hands it to the system's package installer, which refuses a caller without this permission (it logged "needs to declare permission" and closed at once, so the tap did nothing). With it, the installer's own "allow from this source" step appears the first time (Settings › Install unknown apps › Qutai); Qutai never installs anything itself, never turns that setting on and never opens an APK without the user's tap. Google Play allows it for web browsers ("Web browsing or search"), with a Permissions Declaration Form in Play Console; Firefox for Android declares it too | The system's "Install unknown apps" page, shown by the installer when the user opens the first APK | `plugins/withDownloads.js` |
| `<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX's private permission for the app's own broadcast receivers | `androidx.core` |

Blocked (`android.blockedPermissions` in `app.json`, removed from the merged manifest):

| Permission | Added by | Why it's blocked |
| --- | --- | --- |
| `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION` | `expo-location` | Location is foreground only |
| `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VISUAL_USER_SELECTED` | `READ_EXTERNAL_STORAGE`: `expo-file-system`, `expo-image-picker`, `expo-media-library`; `READ_MEDIA_IMAGES`: `expo-screen-capture`; `READ_MEDIA_VISUAL_USER_SELECTED`: `expo-media-library` | Qutai only adds to the gallery (write-only requests ask for none of these) and doesn't listen for screenshots. File imports use the system picker, which needs no permission |
| `ACCESS_WIFI_STATE` | `expo-network` | Needed only for `getIpAddressAsync`, which Qutai doesn't call; the network type for the server backup's "Only on Wi-Fi" comes from `ConnectivityManager` (`ACCESS_NETWORK_STATE`). Not verified on a device yet: the Android build must be checked to read Wi-Fi as `WIFI` without it |
| `WRITE_CONTACTS` | `expo-contacts` plugin | Qutai only reads contacts (lookup by name); it never adds, edits or deletes one |
| `SYSTEM_ALERT_WINDOW` | Expo template | Only for the development overlay; debug builds keep it from their own manifest |
| `com.google.android.c2dm.permission.RECEIVE` | Firebase Messaging (`expo-notifications`) | No push notifications |
| `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` | Install Referrer (`expo-application`) | Qutai doesn't read the install referrer |
| `READ_APP_BADGE` and the launcher badge permissions (Samsung, HTC, Sony, Huawei, OPPO, …) | ShortcutBadger (`expo-notifications`) | Qutai never sets a badge count |

Cleartext (plain http): allowed for the app (`android:usesCleartextTraffic="true"`, `plugins/withCleartextBrowsing.js`),
because Qutai is a browser. Apps targeting API 28+ get no cleartext by default and the WebView honours that, so before
this release builds failed every http page with `net::ERR_CLEARTEXT_NOT_PERMITTED`, local ones (a development server at
`http://192.168.1.2:3000`, a router, a NAS) included, even after the user accepted the "open the insecure version?"
prompt; debug builds worked only because their manifest allows cleartext for the Metro server. The options were: (1) a
network security config allowing cleartext per domain: it matches named domains and exact IP addresses only, not
private address ranges or "whatever the user typed", so it can't cover local addresses in general; (2) cleartext for the
app, the only setting that lets a browser open the http pages the user chooses. Qutai uses (2) and keeps http in check
in the app instead: the HTTPS-only setting (on by default) opens http addresses over https and asks before falling
back (per site and port, for the session), and the address bar marks http pages "Not secure". The app's own requests
stay https-only in code: the AI providers' addresses are fixed https URLs, a custom endpoint is refused unless it is
https on Android (`src/ai/custom.ts`, and `src/ai/http.ts` refuses http again before every request), and filter lists
are refused unless https (`src/content/blocking.ts`). iOS still allows http only to local addresses
(`NSAllowsLocalNetworking`, above); public http pages remain blocked there by App Transport Security.

Local network access: no permission. Android's local network protection (`ACCESS_LOCAL_NETWORK`, a runtime permission
in the Nearby devices group, which also covers WebView traffic) is enforced only for apps targeting Android 17 (API 37)
or higher; below that, apps with `INTERNET` keep local network access and Android's documentation says not to declare
or request the permission. Debug builds carry it only from the dev tooling (below). When the app moves to target API
37, it must declare `ACCESS_LOCAL_NETWORK` and ask for it the first time the user opens a local address (and before a
custom endpoint on the local network is used). iOS asks for no local network permission for WebKit content
(`NSLocalNetworkUsageDescription` is for the custom AI endpoint).

Certificate errors (patched react-native-webview, Android): the WebView refuses an invalid certificate as before and the
app shows its own page saying what is wrong (not issued by a trusted authority, for example self-signed; expired or not
yet valid; for another address) with "Go back". "Continue anyway (not secure)" is offered under it unless the same host
and port served a valid certificate earlier in the session (a certificate that turned bad may mean interception). It
allows that one certificate (SHA-256) on that host and port, in memory only: gone when the app restarts or the cache is
cleared, and in an incognito tab only for that tab. `onReceivedSslError` proceeds only for a certificate on that list,
so proceeding is always the user's decision (Google Play's policy on `onReceivedSslError`), and while an exception is in
use the address bar shows "Not secure". The error page is a native view, outside the web page, and has no tool: the
assistant's actions click and type inside web pages and can't press it. iOS shows the same error page without
"Continue anyway" (the server-trust bypass is not implemented there).

Package visibility (`<queries>`, `plugins/withDownloads.js`): `android.intent.action.VIEW` for `content://` files of
any type, so the finished-download notification can tell whether some app opens the file (a tap then opens it
directly) or must go through Qutai, which says why it can't instead of a tap that does nothing. No permission; it
makes visible only the apps that open files.

Package visibility from `expo-contacts`' own manifest: `<queries>` for `SEND` of vCard / octet-stream and for
`EDIT` / `INSERT` intents (the library's share-contact and contact-form features, which Qutai doesn't call). No
permission; it only makes such apps visible to the package manager.

Main activity: `android:supportsPictureInPicture="true"` and `configChanges` including
`screenSize|smallestScreenSize|screenLayout|orientation` (`plugins/withPictureInPicture.js`), for picture-in-picture of
a playing full-screen video when the user goes home. No permission; it is not offered for incognito tabs or while the
app lock is on, and Settings › Appearance › "Picture-in-picture" turns it off.

Google Play Console, Permissions Declaration Form for `REQUEST_INSTALL_PACKAGES` (App content › Sensitive app
permissions): core functionality "Web browsing or search"; description: "Qutai is a web browser with its own download
manager. When the user taps Open on an APK file they downloaded, Qutai hands it to the Android package installer, which
asks the user to allow Qutai as a source and to confirm the installation. Qutai never installs packages itself." The
store listing should mention that downloaded files, including apps, can be opened from Qutai's Downloads.

Google Play Console, "Foreground service permissions" declaration (App content), for `dataSync`:

- Use case: "Data sync" › "Download"; description: "Qutai is a web browser. When the user downloads a file from a
  website (taps a download link, chooses Download link or Save image, or confirms a download the in-app assistant
  proposed), the transfer continues in a foreground service with a progress notification (Pause, Resume, Cancel) if
  the user leaves the app. The service runs only while a user-started download is active and stops when it finishes,
  is paused or cancelled. On Android 14 and newer Qutai uses a user-initiated data transfer job instead and starts this
  service only if the job can't be scheduled." Video: start a large download from a web page, go to the home screen,
  show the notification's progress and Pause / Resume, then the finished file in the Downloads folder.

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
  the user in Settings › Assistant › Keep working in the background. Separately, when the user leaves the app while
  one AI request they already sent is still running, the same service runs for at most 3 minutes, with a quiet
  notification \"Qutai is finishing a reply\", only until that request has finished, so the phone doesn't cut it
  and the request isn't sent and billed a second time; nothing else of the task continues."
- Why a foreground service: the work happens in the app's own WebViews (the user's logged-in pages, cookies and tabs
  live on the device), so it cannot move to a server or to WorkManager/JobScheduler; it is started by the user, visible
  to them and stoppable at any time, and has no fixed end time. No other foreground service type covers operating web
  pages for the user (`dataSync` is for transferring data; the task is mostly reading and acting on pages), so it is
  declared as `specialUse` with the subtype text in the manifest (`plugins/withBackgroundTasks.js`).
- Impact if deferred or interrupted: the user's task stops half-way as soon as they leave the app (as it does with the
  setting off); it continues only when they come back. For the short "finishing a reply" mode: the AI request is cut,
  sent again on return and charged twice by the user's AI provider.
- Owner: the Play Console text above changed on 17 Nov 2026 (the "finishing a reply" sentence); update the declaration
  and the video (leave the app during a long answer, the quiet notification, it disappears when the answer ends).
- Video: required; record turning the setting on (the notification permission prompt), starting a multi-step task,
  pressing Home, the notification with its steps, a step that needs a confirmation (the "Qutai paused" notification,
  opening the app shows the dialog), Stop from the notification, and the finish notification. Not recorded yet: it
  needs a device.

Intent filters without a permission (`plugins/withEntryPoints.js`): `SEND` `text/plain` (the share sheet),
`PROCESS_TEXT` `text/plain` (other apps' text-selection menu) and `WEB_SEARCH`, on the main activity, besides the
`http`/`https` and `qutai` links. What arrives is only text; it is handled as untrusted input (see README, "Opening
Qutai from other apps"). The launcher shortcuts are static (`android.app.shortcuts` meta-data on the main activity,
`res/xml/qutai_shortcuts.xml`, no permission); pinning a page with "Add to home screen" needs no permission (the
launcher asks). The home screen widget is a non-exported receiver (`expo.modules.qutaientry.QutaiWidgetProvider`,
`APPWIDGET_UPDATE`); no permission. A second non-exported receiver (`expo.modules.qutaientry.QutaiLocaleReceiver`,
`LOCALE_CHANGED` and `MY_PACKAGE_REPLACED`, both sent by the system) redoes the widget's texts when the phone's or
Qutai's own language changes and removes the dynamic shortcuts earlier builds published; no permission.

Files the user shares from the assistant's cards to another app go through a non-exported FileProvider of the
`qutai-entry` module (`expo.modules.qutaientry.QutaiShareFileProvider`, authority `${applicationId}.qutai.share`),
limited to the hand-out folders in the cache, with a read grant per share; no permission and no `<queries>` entry
(WhatsApp is targeted by trying its package and falling back to the chooser).

Debug builds also get `SYSTEM_ALERT_WINDOW`, `ACCESS_LOCAL_NETWORK` and `CHANGE_WIFI_MULTICAST_STATE` from the dev
client and React Native's debug manifest (the release manifest has none of them).

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
| Media playback | Plays as in Safari. With "Keep playing in the background" on, `<audio>` and audio-only media go on in the background; WebKit pauses `<video>` elements when the app leaves the foreground (except in picture-in-picture), and the page script plays such a video again so its sound goes on, keeping the page from seeing that the app left while sound plays (not in incognito tabs); the lock screen, Control Center and headphones control the page through WebKit's own Now Playing and the page's Media Session. Incognito tabs: the page's Media Session title, artist and artwork are replaced with "Private tab" | With the setting on, the page's sound goes on in the background with Qutai's media notification (the page's Media Session metadata, or its title and site; "Private tab" for incognito tabs, never artwork). The playing tab keeps seeing itself visible while Qutai is in the background (its `<video>` isn't paused by Chromium and players that pause on visibilitychange go on), only while it plays and up to two minutes after it is paused from the controls; every other tab sees the real state. Media inside frames isn't seen on Android, so it gets no notification and may stop in the background. Phone makers' battery managers may still stop playback; Settings offers a button to Qutai's app settings (battery), no `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` |
| Downloads | Saved in the app's own Downloads folder (no permission) | System download manager; asks for `WRITE_EXTERNAL_STORAGE` on Android 9 and older |
| User styles (docs/page-customisation.md) | No permission. CSS the user approved or kept, in the page's main frame only; it can't load anything from the network (sanitised) and can't reach Qutai's own screens | Same |
| Scripts (docs/page-customisation.md › Scripts) | No permission. JavaScript the user approved, in the page's main frame (or on a sealed copy of the page in a hidden WebView that can make no request); off by default; never in incognito tabs as kept scripts | Same |
| Cookie list (docs/page-customisation.md) | No permission. Read from the tab's own WebKit data store (`WKHTTPCookieStore`; an incognito tab's own non-persistent store), HttpOnly included; deleted only after the user confirms | Read from the tab's WebView profile (`CookieManagerCompat.getCookieInfo`; the incognito profile for incognito tabs) |

## Notes for the store forms

- Qutai has no servers of its own. Page content, chats and screenshots the user sends to the assistant go from the
  device to the AI provider the user chose, with the user's own key.
- Location goes only to sites the user allowed and, when the user confirms each time, to the AI provider. Setup's
  "Use my location" (city question, only on the user's tap): the position (about 100 m, a cached one up to an hour
  old) is turned into place names by the platform's geocoder, which needs the network: on iOS `CLGeocoder` sends the
  coordinates to Apple; on Android `Geocoder` uses the phone's geocoding provider, on phones with Google Play services
  Google's (a phone without one reports it unavailable and the user types instead). No Qutai key or server is involved,
  and the coordinates are not stored or sent to the AI provider. Only the resulting text (neighbourhood, district,
  province or state, country; no street) is kept, as the memory "City: …" when the user continues, and like every memory
  goes to the AI provider with requests while memory is on.
- Calendar choice: the chooser reads the calendars' and Reminders lists' names, accounts and colours on the phone to
  show them; only the chosen ids are stored (on this phone, not in backups). Nothing about them is sent anywhere.
- Camera and microphone: a page gets the live stream only on a site the user allowed for that device; Qutai doesn't
  record or keep it, and the assistant can't grant it.
- Media playback in the background: no data leaves the phone for it. On Android the notification's artwork is
  loaded from the address the page's Media Session gives (https only, normal tabs only), without cookies.
- Cookies (the assistant's `page_cookies` and the Cookies view): the AI provider gets only each cookie's name, domain,
  path, expiry, size and flags, and only when the user asks about cookies; values stay on the phone, shown in the
  Cookies view when the user taps "Show value", and are never stored, logged, in the "sent to the AI" log or in
  backups. Kept user styles are stored on the phone and in backups (they are the user's settings, not browsing data).
- Scripts: a script the user approved runs in the page (or on a copy of it); its result (16 KB at most) goes to the AI
  provider with the conversation like other page content, and nowhere else: not in memory, backups, the action
  history (which records only that a script ran and its description) or the "sent to the AI" outline beyond its size.
  Kept scripts (their code, where and when they run) are stored on the phone and in backups; their last run is kept as
  a status only. The approval seal's key stays in the phone's secure storage and is never backed up.
- Photos: write-only; nothing is read from the library. Reminders: Qutai only writes, though iOS grants read access
  too.
- Calendar: read only by the assistant's `read_calendar`, when the user asks about their schedule and confirms the
  range each time, unless they ticked "Don't ask again" (then the range goes to the AI provider without asking; a
  switch in Settings › Assistant › "Allowed without asking" takes it back). Never in incognito conversations. The events of that range go to the AI provider; they are not
  stored by Qutai (no memory, the action history records only the range, the "sent to the AI" log keeps the text in
  memory only). On iOS 17+ adding events uses write-only access and reading asks for full access separately; full access is also what the setup step's Calendar switch and the calendar chooser ask for, since only it lets Qutai list the calendars.
- Voice input (assistant panel): speech becomes text in the message field; nothing is recorded to disk and no audio
  goes to Qutai or the AI provider (only the text, when the user sends it, like a typed message). The phone's own
  recogniser runs on the device when it supports the language (iOS on-device dictation; Android 13+ with the language
  downloaded). Otherwise the audio goes to Apple's or Google's speech service, only after the user agreed once in Qutai
  (Settings › Assistant shows and changes the answer); incognito conversations never use it. For the store forms this
  is processed by the platform's speech service, not collected by Qutai.
- Voice introduction ("Tell me about yourself", setup and Settings › Assistant › Memory): the same voice input and the
  same rules. The recognised text (not the audio) goes to the user's AI provider, or Qutai's AI service in credits
  mode, once to be understood and once more if follow-up questions are answered in words; only the notes the user
  confirms are stored, on the phone, as memory. Its page says this before the microphone is used.
- Camera: QR codes are decoded on the device; photos and videos for uploads go only to the page the user is
  uploading to.
- PDFs (assistant): a PDF the user attaches comes from the system document picker (no permission). `read_pdf` reads PDFs
  on the phone (PDF.js in a hidden WebView that can make no network request); only the extracted text (or, for scanned
  pages the assistant asks to see, page images) goes to the AI provider. Fetched PDFs are kept in memory only.
- Attachments (assistant panel): images the user picks (system photo picker, no library access) or photos they take
  go to the AI provider with the message they are attached to (the attach sheet says so). The copy sent is resized and
  re-encoded, which strips EXIF data such as the location; the original stays on the phone with the conversation and is
  deleted with it (incognito: when the incognito session ends, and at every start). Not in the encrypted backup.
- Edited images and uploads: `edit_image` and "Resize or crop" work on the phone only (nothing is sent; the results are
  re-encoded without EXIF). `upload_image` gives an image of the conversation to a page's file field only after the
  user confirms in a dialog showing the image, its size and the site, every time (never covered by a site's "always
  allow"); the page gets a copy without metadata. When a site can't take it, the user may save it to Photos instead
  (add-only permission). The action history records that an image was given to the site, not the image.
- Contacts (`find_contact`, docs/contacts.md): read on the phone only, for a name the user said; nothing from the
  address book is uploaded or stored by Qutai. The AI provider receives the names that matched (at most 5) and the
  labels of their numbers and addresses, never the numbers or addresses themselves; those appear only on the card or
  in the mail composer for the user. Saved conversations and backups keep the name and label, not the number or
  address. Never in incognito conversations. For the store forms:
  - App Store privacy label: Contacts — data used only on the device does not count as "collected" (Apple: data
    "transmitted off the device"). The contact *names* that match do go to the AI provider the user chose (own key) or
    to Qutai's AI relay (credits mode); declare **Contacts › App Functionality, not linked to identity, not used for
    tracking** to be safe, and say in review notes that numbers and addresses never leave the phone.
  - Google Play Data safety: **Contacts › collected (names of matching contacts sent to the AI service), not shared,
    processed ephemerally, required for the feature, optional for the user (the feature works without the
    permission)**, purpose App functionality. Play's policy on `READ_CONTACTS` ("Permissions and APIs that Access
    Sensitive Information"): use must be tied to a core feature the user starts; the in-app pre-explanation and the
    store listing should say "the assistant can find a person you name in your contacts to call or message them".
    No Permissions Declaration Form is needed for `READ_CONTACTS` (it is not in Play's restricted SMS / Call Log
    group); the prominent disclosure is the pre-explanation dialog shown before the system prompt.
- No analytics, no advertising ID, no tracking (pro builds' planned analytics will change the forms; see TODO.md).
