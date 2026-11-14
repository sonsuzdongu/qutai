# Permissions

Every permission and usage description Qutai declares, what needs it and when the user is asked. Use this for the
App Store privacy labels and the Google Play Data safety form.

`ios/` and `android/` are generated (Continuous Native Generation), so everything here comes from `app.json` (config
plugins, `ios.infoPlist`, `android.blockedPermissions`), `plugins/withLegacyStorageWrite.js`, the native libraries'
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
| `NSMicrophoneUsageDescription` | Sites the user allows to use the microphone (`getUserMedia`, per-site setting: video calls, voice input on sites); the sound of a video recorded with the system camera for a web page's upload field. Qutai itself has no voice input | First time the user allows a site, or such a video is recorded (iOS asks) | `expo-camera` plugin, `microphonePermission` |
| `NSPhotoLibraryAddUsageDescription` | Saving screenshots (visible area or full page) and images from pages to Photos. Add-only: Qutai can't see the library | First save | `expo-media-library` plugin, `savePhotosPermission` (`photosPermission: false`, so no read key) |
| `NSFaceIDUsageDescription` | Locking the app and incognito tabs with Face ID | When the lock is turned on or first used | `expo-local-authentication` plugin, `faceIDPermission` |
| `NSCalendarsWriteOnlyAccessUsageDescription` (iOS 17+), `NSCalendarsUsageDescription` (iOS 16 and older) | The assistant adds an event the user confirmed (tickets, reservations). Write-only on iOS 17+: Qutai can't read the calendar | First event the user confirms | `expo-calendar` plugin, `writeOnlyAccess: true`, `writeOnlyCalendarPermission`, `calendarPermission` |
| `NSRemindersFullAccessUsageDescription` (iOS 17+), `NSRemindersUsageDescription` (iOS 16 and older) | The assistant adds a reminder the user confirmed. iOS has no write-only Reminders access; Qutai only writes | First reminder the user confirms | `expo-calendar` plugin, `remindersPermission` |
| `NSLocationWhenInUseUsageDescription` | Position for sites the user allows (per-site setting) and for the assistant's `get_location` (confirmed every time). Foreground only, approximate accepted | First time a site or the assistant needs it | `expo-location` plugin, `locationWhenInUsePermission` (every "always"/background/motion option `false`) |
| Notifications (no Info.plist key) | Local notifications the assistant schedules after the user confirms. No push: no `aps-environment` entitlement, no push token | First scheduled notification | `expo-notifications` plugin, `enableRemoteNotifications: false` |
| `NSLocalNetworkUsageDescription`, `NSBonjourServices` | Development builds only: the dev client finding the Metro server. `expo-dev-client` removes both from release builds in a build phase, so they are not translated | Development builds only | `expo-dev-client` plugin |

Other store-facing iOS declarations:

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
| `CAMERA` | QR code scanner; the camera option in a web page's upload field (offered once Qutai holds the permission); sites the user allows to use the camera (`getUserMedia`) | First time the QR scanner opens or the user allows a site | `expo-camera` (plugin and library manifest) |
| `RECORD_AUDIO` | Sites the user allows to use the microphone (`getUserMedia`) | First time the user allows a site | `expo-camera` plugin, `recordAudioAndroid: true` |
| `WRITE_EXTERNAL_STORAGE` (Android 10 and older, `maxSdkVersion` 29) | Saving screenshots and images to the gallery (Android 10 and older); downloads to the Downloads folder (Android 9 and older). Android 11+ needs no storage permission for either | First save or download on those versions | `plugins/withLegacyStorageWrite.js` (the libraries declare it up to Android 12; this lowers it) |
| `READ_CALENDAR`, `WRITE_CALENDAR` | Adding events and reminders (a reminder is a calendar event with an alarm on Android). Read is needed to find a writable calendar; Android has no write-only calendar access | First event or reminder the user confirms | `expo-calendar` plugin |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | Same as iOS location; approximate accepted. Foreground only | First time a site or the assistant needs it | `expo-location` (plugin and library manifest) |
| `POST_NOTIFICATIONS` (Android 13+) | Local notifications the assistant schedules | First scheduled notification | `expo-notifications` library manifest |

Install-time permissions (no prompt):

| Permission | Why | Declared by |
| --- | --- | --- |
| `INTERNET` | Loading pages, talking to the AI provider the user chose | Expo template, `expo-file-system` |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | App and incognito lock (fingerprint for Android 8 and older) | `expo-local-authentication` |
| `VIBRATE` | Haptic feedback | `expo-haptics` |
| `RECEIVE_BOOT_COMPLETED` | Scheduled notifications survive a restart | `expo-notifications` |
| `WAKE_LOCK` | Required by the Firebase Messaging library that `expo-notifications` bundles. Qutai doesn't use push; kept so the library can't fail on a missing permission | `expo-notifications` (Firebase Messaging) |
| `DETECT_SCREEN_CAPTURE` (Android 14+) | `expo-screen-capture` registers a screen-capture callback as soon as it loads, which needs this permission. Qutai only blocks screenshots in incognito tabs (`FLAG_SECURE`) and doesn't listen for them | `expo-screen-capture` |
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

Debug builds also get `ACCESS_NETWORK_STATE`, `ACCESS_LOCAL_NETWORK` and `CHANGE_WIFI_MULTICAST_STATE` from the dev
client and React Native's debug manifest.

Package visibility (`<queries>`): only what the libraries declare (sharing, mail composer, document picker, text to
speech engines, WebView payment intents, calendar). Qutai doesn't call `canOpenURL`; links to other apps go straight
to `openURL`.

## Web pages

| Capability | iOS | Android |
| --- | --- | --- |
| Location (`navigator.geolocation`) | Qutai's per-site prompt (ask / allow / block), see `src/browser/geolocation.ts` | Same; the WebView's own geolocation is off |
| Camera and microphone (`getUserMedia`) | Qutai's per-site prompt, camera and microphone separately (ask / allow / block), see `src/browser/mediaCapture.ts`. WebKit grants only the main frame of the allowed origin and only the allowed kinds (patched react-native-webview, `mediaCaptureGrant`); everything else is refused without a prompt | Same rule; the patched `onPermissionRequest` grants only the requesting frame's origin when it is the allowed one, and only the allowed kinds, and never asks the OS for anything else. Frames from other sites are refused on both. Screen sharing (`getDisplayMedia`) is refused |
| Upload field (`<input type="file">`) | Photo picker (no permission), Files, or the system camera ("Take Photo or Video": camera prompt, plus microphone for a video with sound) | System file picker (no permission); the camera option is offered only once Qutai holds `CAMERA` |
| Downloads | Saved in the app's own Downloads folder (no permission) | System download manager; asks for `WRITE_EXTERNAL_STORAGE` on Android 9 and older |

## Notes for the store forms

- Qutai has no servers of its own. Page content, chats and screenshots the user sends to the assistant go from the
  device to the AI provider the user chose, with the user's own key.
- Location goes only to sites the user allowed and, when the user confirms each time, to the AI provider.
- Camera and microphone: a page gets the live stream only on a site the user allowed for that device; Qutai doesn't
  record or keep it, and the assistant can't grant it.
- Photos: write-only; nothing is read from the library. Calendar on iOS 17+: write-only. Reminders and the Android
  calendar: Qutai only writes, though the OS grants read access too.
- Camera: QR codes are decoded on the device; photos and videos for uploads go only to the page the user is
  uploading to.
- No analytics, no advertising ID, no tracking (pro builds' planned analytics will change the forms; see TODO.md).
