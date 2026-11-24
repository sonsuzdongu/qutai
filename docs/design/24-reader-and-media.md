# 24. Reader mode, media and downloads on screen

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

What the user sees when reading an article, playing a video or audio, and downloading a file, and how web pages get the camera and microphone. The security rules for downloads (risky files, blocked sites, file addresses) are in [section 23](23-downloads-and-links.md).

## How it works

1. **Reader mode.** On an article page a page icon shows in the address bar; the page menu has the same item. Reader mode shows only the article (title, byline, text, headings, images, links) in its own view laid over the tab, so the page underneath stays as it was (scroll position, forms, video). Colours light, dark or sepia, serif or sans, an "easier reading" spacing, and the same text size as pages. Read aloud in reader mode reads exactly the article, highlighting the paragraph being read. Links, navigation, Android back and the close button leave reader mode.
2. **Background playback.** Settings › Appearance › Media › "Keep playing in the background" (on). Example: start a podcast or a music video, press Home: the sound goes on with the lock-screen controls. On iOS a video's sound goes on without the picture; on Android a media notification shows while a tab plays sound.
3. **Picture-in-picture (PiP).** Setting on by default. iOS: the system player's PiP when the user leaves a full-screen video. Android: a full-screen video, or an inline video playing with sound, shrinks into a small window when the user goes home. On YouTube PiP is offered only when YouTube's player allows background play (Premium); otherwise Home keeps the sound only.
4. **Downloads.** One Downloads screen (menu › Library › Downloads): in progress and finished, search, type icon, site, size, progress with speed and time left; per item Pause / Resume / Cancel / Retry, Open, Share, Show in Downloads folder (Android), Copy link, Remove from list, Delete file (confirmed). "Clear finished" only empties the list. A small pill over the page shows running downloads and, for a few seconds, one that just finished, with Open.
5. **Camera and microphone for pages.** A video-call site asks; Qutai shows its own prompt for that site (ask / allow / block per kind, "Allow once" for the page).

## The rules

- **`MEDIA-2`** The reader view is an inert copy of the article built through an allowlist (no scripts, styles, frames, forms, tracking pixels, event handlers or `javascript:` links), shown with a policy that runs no script and loads only images; incognito tabs keep nothing on disk.
  Status: Default (manager or implementing session; open to change) · Why: show only the article, safely · Enforced: In the app: src/browser/reader.ts (reader extraction and document) · Source: 6336779
- **`MEDIA-3`** Reader mode settings: theme follows the app ("auto"), serif typeface, easier reading off by default; all are saved.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/storage/settings.ts (DEFAULT_SETTINGS)
- **`MEDIA-4`** Assistant actions that look at or act on the page leave reader mode first; `read_page` still reads the real page.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 6336779; docs/working-mode.md › Not covered
- **`MEDIA-5`** "Keep playing in the background" and "Picture-in-picture" are both on by default.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/storage/settings.ts (DEFAULT_SETTINGS); ROADMAP.md › Content and media
- **`MEDIA-6`** iOS: when Qutai leaves the screen, a video WebKit paused is played again (sound only) and, while sound plays, the page keeps seeing "visible" so sites that pause themselves (YouTube's mobile site) go on; incognito tabs don't do this.
  Status: Default (manager or implementing session; open to change) · Why: WebKit pauses `<video>` in the background and automatic PiP from inline video is impossible (Apple DTS reply); re-playing is the only way to keep the sound · Source: bf41c9b, edfe9b7; README › Known limitations; ios-background-video-findings note
- **`MEDIA-7`** Whether iOS background play of YouTube is acceptable under YouTube's terms and App Review is open; today it works as in MEDIA-6.
  Status: Waiting for the owner ([README.md](../../README.md#known-limitations--next-steps)) · Why: background play is a paid YouTube feature · Source: README › Known limitations (Background playback)
- **`MEDIA-10`** Qutai never asks for a battery-optimisation exemption; Settings › Appearance › Media shows an Android hint that phone makers' battery managers may stop playback, with a button to Qutai's app settings.
  Status: Default (manager or implementing session; open to change) · Why: Honor, Huawei, Xiaomi, Samsung battery managers may stop it; no REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission · Source: 2b331a8; README › Known limitations
- **`MEDIA-11`** Android PiP on youtube.com is offered only when YouTube's player says the video may play in the background; on other sites, a page that leaves full screen, pauses itself within 5 s in PiP, or reaches no full screen in 2.5 s ends PiP and the sound goes on. Qutai never fakes the window size.
  Status: Default (manager or implementing session; open to change) · Why: YouTube exits full screen in PiP without Premium; faking the size would defeat a paid gate · Source: e479786; fix-android-pip note
- **`MEDIA-12`** YouTube without Premium not opening PiP is expected and accepted.
  Status: Owner, 2026-11-16 · Why: same as MEDIA-11 · Source: owner's open-questions memory note, item 17 (the failing Honor case itself is still open)
- **`MEDIA-14`** No PiP for incognito tabs or while the app lock is on; incognito tabs show "Private tab" in the media notification and on the lock screen.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded (privacy of private tabs) · Enforced: In the app: src/components/BrowserView.tsx (allowsPictureInPictureMediaPlayback, incognito) · Source: ROADMAP.md › Picture-in-Picture; README › Known limitations
- **`MEDIA-15`** Android downloads use Qutai's own engine (not the system DownloadManager): the tab's user agent, referrer and its own WebView profile's cookies, read again for each redirect host; files go to the public Downloads folder and appear only when every byte arrived.
  Status: Default (manager or implementing session; open to change) · Why: downloads that need a login must carry the tab's cookies; incognito cookies stay separate · Source: 2c54eb1, 6d6a7e6; README › Downloads; fix9-android-downloads note
- **`MEDIA-17`** iOS saves into Qutai's own Downloads folder (then Save to Files) with progress and cancel only, no resume.
  Status: Default (manager or implementing session; open to change) · Why: `expo-file-system` has no resume · Source: README › Downloads
- **`MEDIA-18`** The download pill's close button, a sideways swipe or the screen reader's "Hide" action hide it without stopping anything; a finished download stays on the pill 6 s (15 s with a screen reader).
  Status: Default (manager or implementing session; open to change) · Why: the close button used to cancel the download · Source: 21d43e3; fix10 note
- **`MEDIA-19`** "Open" on a download never fails silently: a file deleted elsewhere, no app for its type, lost access or a refusal each say what to do instead (share it, or open it from Files).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: README › Downloads
- **`MEDIA-20`** On Android an APK opens in the system installer, which asks "allow from this source" itself; Qutai declares `REQUEST_INSTALL_PACKAGES` for that. Whether to keep the permission (Play declaration form) is open.
  Status: Waiting for the owner ([docs/permissions.md](../../docs/permissions.md); owner's open question 20) · Why: without the permission the installer refused and closed while Qutai reported "opened" · Source: 21d43e3; owner's open-questions memory note, item 20; docs/permissions.md
- **`MEDIA-23`** Incognito downloads are listed only while the incognito session lasts and never written down; unfinished ones are cancelled when it ends; finished files stay on the phone.
  Status: Default (manager or implementing session; open to change) · Why: "the user asked for them" · Enforced: In the app: src/storage/downloads.ts (DownloadStore, incognito list in memory) · Source: README › Downloads
- **`MEDIA-24`** Downloads always go to the Downloads folder (Android) or Qutai's Downloads (iOS); there is no "Ask where to save", no "ask before large files on mobile data", and POST downloads are sent as GET.
  Status: Default (manager or implementing session; open to change) · Why: mobile-data question "left out to keep this change smaller"; the WebView doesn't hand over a request's method or body · Source: ROADMAP.md › Download manager; TODO.md › Device integrations
- **`MEDIA-25`** A page gets the camera or microphone only for the site in the address bar (main frame of exactly that https origin) and only for the kinds the user allowed; frames from other sites are always refused.
  Status: Default (manager or implementing session; open to change) · Why: a JavaScript-only gate can't control frames or the WebView's native grants, so the WebView was patched to grant only the named origin and kinds · Enforced: In the app: patches/react-native-webview+14.0.1.patch (mediaCaptureGrant) and src/browser/mediaCapture.ts (PageMediaCapture.serve, authorize) · Source: 0e8b19f; item17-camera-microphone note
- **`MEDIA-26`** Each site has ask / allow / block per kind; "Allow once" lasts for the page; incognito tabs keep a stored block but never use a stored allow.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/mediaCapture.ts (PageMediaCapture.settingFor) · Source: 0e8b19f; README › Known limitations
- **`MEDIA-27`** Screen sharing (`getDisplayMedia`) is always refused; http pages get no camera or microphone.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/mediaCapture.ts (mediaCaptureScript, refuse) · Source: 0e8b19f
- **`MEDIA-28`** Capture is paused while another tab is shown or Qutai is in the background; revoking reloads the page.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/mediaCapture.ts (setPaused) · Source: README › Known limitations

## Details

**Reader mode**

- (was `MEDIA-1`) Reader mode is offered only when the page has at least 600 characters of article text in 3 real paragraphs. · Why: reason not recorded (README calls it a heuristic that can miss or include wrong parts) · Where: 6336779; README › Known limitations

**Background playback and picture-in-picture on Android**

- (was `MEDIA-8`) Android: a `mediaPlayback` foreground service with a media notification runs while a tab plays sound, and only that tab's WebView is told it stays visible; other tabs, and this one once playback ends, see the real state. · Why: Chromium pauses every `<video>` (sound included) the moment the page is hidden, and the process is frozen about 5 s after Home without a service · Where: 2b331a8, e090b66; fix-android-background-playback note
- (was `MEDIA-9`) The media service is its own service (own type, channel and notification id), separate from the assistant's background service; both can run at once. · Why: nothing shared, so neither stops the other · Where: item23-background-media-pip note
- (was `MEDIA-13`) An inline Android video goes into PiP by being made full screen as PiP starts (one tap sent to the page natively gives the Fullscreen API its user activation); full screen is left again when the window is expanded or closed. · Why: the owner's Honor reports were inline videos, which never went into PiP · Where: e479786; fix-android-pip note

**Downloads**

- (was `MEDIA-16`) Android runs three downloads at a time (the rest queue), pauses and resumes with a range request guarded by `If-Range` (starting again and saying so when that is impossible), retries with backoff, waits for a network, and keeps going in the background with a user-initiated job (Android 14+) or a `dataSync` foreground service; downloads cut by a kill or restart show as interrupted and resumable. · Where: README › Downloads; ROADMAP.md › Download manager
- (was `MEDIA-21`) Android asks for the notification permission after the first download, and the storage permission only on Android 9 and older. · Where: fix9-android-downloads note
- (was `MEDIA-22`) Tapping a download or assistant notification returns to the tab it came from; if that tab is closed, the first tab opens with a toast. · Where: 21d43e3; fix10 note

## Limits and what is not built

- Android: media inside frames isn't seen; inline videos inside frames don't go into PiP; whether headphone buttons reach the page is untested.
- iOS: no resume for downloads; a link with the `download` attribute to a PDF opens the PDF in the tab instead of downloading (O5, docs/performance-2026-11.md).
- Background playback, PiP, iOS downloads and page camera/microphone have not been tested on a phone.
- A page that tampers with built-ins could hide tracks from Qutai's indicator.
- On iOS, WebKit keeps a camera/microphone grant for the document, so an incognito page can get the same kinds again on that page without a new prompt if it goes around the wrapper.

## Where it lives

- `src/browser/reader.ts`, `src/browser/playback.ts`, `src/browser/mediaCapture.ts`, `src/browser/downloadRequests.ts`, `src/device/backgroundMedia.ts`
- `modules/qutai-media` (Android media service and PiP), `modules/qutai-downloads` (Android engine), `src/storage/downloads.ts`, `iosDownloads.ts`, `androidDownloads.ts`
- `plugins/withBackgroundMedia.js`, `withPictureInPicture.js`, `withDownloads.js`; `patches/react-native-webview+14.0.1.patch`
- [README.md](../../README.md) › Downloads and › Known limitations; [docs/permissions.md](../../docs/permissions.md); [section 23](23-downloads-and-links.md) for download security

## Disagreements between sources

- The iOS background-video findings note (2026-11-14) says "Not implemented; investigation only" and that the background setting does nothing on iOS; commits bf41c9b and edfe9b7 and the README show the re-play approach was built. The code follows the README.
