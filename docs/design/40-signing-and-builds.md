# 40. Signing and builds

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

How Qutai is built (development builds, EAS profiles, store packages, pro-mode test builds), how Android release builds are signed, and the native patches and config plugins every build carries.

## How it works

1. Qutai does not run in Expo Go (Expo's ready-made test app), because it uses native modules that Expo Go lacks, `expo-calendar` among them. Developers install a **development build** once (`npx expo run:android` or `npx expo run:ios`) and then start the dev server with `npx expo start`.
2. The `android/` and `ios/` folders are generated from `app.json` and the config plugins in `plugins/`. They are git-ignored and never edited by hand. A "config plugin" is a small script that changes the generated native project, for example to add a permission or a service.
3. There are three EAS cloud build profiles in `eas.json`: `development` (dev client), `preview` (a release build for test phones) and `production`. All three build with pro mode off (`EXPO_PUBLIC_PRO_MODE=off`). `submit.production` is a skeleton: Android goes to the internal testing track, and the store account ids are not in the repository.
4. Store packages are built on the owner's machine with `npm run build:aab` or `npm run build:ipa`, adding `-- --pro-mode` for the pro build (shortcuts: `build:aab:pro-mode`, `build:ipa:pro-mode`). `-- --dry-run` only prints the commands. Each run generates the native project again, builds and signs it, checks that a pro package contains its server's address, and copies the result to `builds/qutai-<version>-<build>[-pro-mode].aab|ipa`.
5. Two values are never committed. They come from the environment or from the git-ignored file `.env.build.local`: the server address of a pro build (`EXPO_PUBLIC_QUTAI_API_URL`) and the Apple team that signs the IPA (`QUTAI_APPLE_TEAM_ID`). The test sign-in variables are always removed from a store build.
6. Android release signing: the owner made an "upload key" once, kept outside the repository. A properties file at `~/.qutai/release-signing.properties` (or wherever `$QUTAI_RELEASE_SIGNING` points) names the keystore and its passwords. If the file is missing, release builds fall back to the public template debug key and Gradle warns. If the file is broken, the build stops with "Qutai release signing: …". EAS builds use the keys EAS manages instead.
7. Google Play re-signs apps with its own key (Play App Signing). Sign in with Google therefore needs one Android OAuth client per certificate: the upload key's client for sideloaded builds, and one for each of Play's keys for installs from Play.
8. Pro-mode test builds (the owner's notes): pro mode on, with the server address of a tunnel to the owner's computer (local port 8000, so the API starts with `API_PORT=8000`). iOS uses a Release build on a connected iPhone; Android uses a release APK signed with the upload key. Pro APKs in `builds/` end in `-pro-mode`.
9. Gradle sometimes reuses an old JavaScript bundle when only `EXPO_PUBLIC_*` values changed. On 2026-11-16 this produced a "pro" APK identical to the normal one. The fix is to force `createBundleReleaseJsAndAssets --rerun` and check that the server address is in the bundle.
10. An APK signed with a different key cannot be installed over the old one. Uninstall Qutai first, which deletes its local data.
11. `npm install` applies two patches with `patch-package`: a small build fix to `expo-dev-launcher`, and a large one to `react-native-webview` that carries Qutai's native browser features.

## The rules

- **`BUILD-2`** `ios/` and `android/` are generated, git-ignored and never edited by hand. Native behaviour goes into `app.json` and the config plugins.
  Status: Owner, date not recorded · Why: these folders are generated again from the config (Continuous Native Generation), so hand edits are lost. For example, `expo prebuild` re-adds the signing setup · Source: AGENTS.md › Rules; .gitignore; [docs/release-signing.md](../../docs/release-signing.md) › What changes
- **`BUILD-4`** Packages are added with `npx expo install`, and Expo's own modules are preferred over third-party libraries.
  Status: Owner, date not recorded · Why: Expo ships breaking changes every SDK release, and `expo install` picks versions that match SDK 58 · Source: AGENTS.md › Commands, › Rules
- **`BUILD-5`** Every EAS profile builds with pro mode off, and `eas.json` has no pro profile.
  Status: Default (manager or implementing session; open to change) · Why: builds from the repository use the user's own key and keep data on the phone, and pro values such as the server address stay out of the repository · Enforced: In the app: eas.json (`EXPO_PUBLIC_PRO_MODE: "off"` in each profile) · Source: 1d5f0d5; README.md › Running
- **`BUILD-7`** Packages are named `builds/qutai-<version>-<build>.aab|ipa`, with `-pro-mode` before the extension for pro builds. Test APKs use the same suffix (`qutai-release-arm64-pro-mode.apk`).
  Status: Owner, 2026-11-16 · Why: the normal and pro APKs share one app id and install over each other, so the suffix is what tells them apart · Source: owner's memory note on the pro-mode test API URL; scripts/build/release.mjs (`name`)
- **`BUILD-9`** A store package never contains the test sign-in. `EXPO_PUBLIC_DEV_LOGIN` and its secret are deleted even if the shell sets them.
  Status: Owner, 2026-11-17 · Why: the owner said to turn the test sign-in off ("test girişini kapat"). Anyone who has a build can read the test secret, so such a build must never be shared or shipped · Enforced: In the app: scripts/build/release.mjs (deletes `env.EXPO_PUBLIC_DEV_LOGIN` and `env.EXPO_PUBLIC_DEV_LOGIN_SECRET`); src/config/features.ts (`devLoginSecret` is null, and the secret is not bundled, unless accounts and the flag are on) · Source: owner's memory note on fixes before launch; 3249723
- **`BUILD-10`** A pro build's server address and the Apple team id are never committed. They come from the environment or `.env.build.local`, a git-ignored file that Expo's own commands never load.
  Status: Owner, 2026-11-16 · Why: real domains stay out of the repository, and a file Expo doesn't read cannot leak into development runs · Enforced: In the app: scripts/build/release.mjs (`envFile`, `value`); .gitignore (`.env*.local`) · Source: [docs/versioning.md](../../docs/versioning.md) › Store packages
- **`BUILD-11`** The pro test tunnel's address is passed only at build time. It is never written into the app or backend repository, docs or notes, where it appears as `<tunnel URL>`.
  Status: Owner, 2026-11-16 · Why: it is a real domain that points at the owner's own computer · Source: [docs/pro-test-builds.md](../../docs/pro-test-builds.md); 3e19603
- **`BUILD-12`** Android release builds are signed with Qutai's own upload key, read from a properties file outside the repository. Without that file they fall back to the debug key with a warning, and a file that is incomplete or names a missing keystore stops the build.
  Status: Default (manager or implementing session; open to change) · Why: no secrets in the repository. Silently falling back to the public debug key on a broken setup would produce a build that cannot update the real one · Enforced: In the app: plugins/withReleaseSigning.js (`addReleaseSigning`, throws GradleException) · Source: 740ac38; [docs/release-signing.md](../../docs/release-signing.md)
- **`BUILD-13`** Keystores, keys and local env files are never committed. `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.pem`, `*.mobileprovision`, `.env` and `.env*.local` are git-ignored, while `.env.example` is committed.
  Status: Default (manager or implementing session; open to change) · Why: "Nothing secret is in the repository" · Enforced: In the app: .gitignore · Source: [docs/release-signing.md](../../docs/release-signing.md); 7d65220
- **`BUILD-14`** `EXPO_PUBLIC_*` values are built into the app where anyone can read them, so they are never secrets.
  Status: Default (manager or implementing session; open to change) · Why: Expo inlines them into the JavaScript bundle · Enforced: In the app: src/config/features.ts (header comment; addresses and client ids only) · Source: 7d65220
- **`BUILD-15`** The native setup for accounts (the Sign in with Apple entitlement, Google's URL scheme, App Links and Universal Links) is added only when pro mode is on. The open-source build has none of it, and the Apple entitlement that `expo-apple-authentication` adds is removed again when pro mode is off.
  Status: Default (manager or implementing session; open to change) · Why: the open-source build must not contain account features · Enforced: In the app: plugins/withProAccounts.js (`withProAccounts`, `appLink`) · Source: d95ab3e, 1c50bc1
- **`BUILD-16`** Builds without pro mode contain no RevenueCat SDK at all.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: 1e08428 (body); README.md › Qutai Credits › Buying credits
- **`BUILD-21`** Builds from the repository are the same code with pro mode off. Forks use their own name, logo, bundle id and server.
  Status: Default (manager or implementing session; open to change) · Why: the Apache licence covers the code, not the Qutai name and logo · Source: 7d65220; TRADEMARKS.md; README.md › License
- **`BUILD-22`** Today Android declares REQUEST_INSTALL_PACKAGES, so that "Open" on a downloaded APK reaches the system installer. Whether to fill in Play's permissions declaration or drop the permission is still open.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: the system installer silently refuses an app without this permission (21d43e3). Google Play allows it for web browsers but needs a declaration form (draft in docs/permissions.md) · Source: plugins/withDownloads.js; owner's open question 20

## Details

**Development builds**

- (was `BUILD-1`) Qutai runs only as a development build or a release build. Expo Go is not supported. Why: several native modules it uses (expo-calendar first) are not in Expo Go. Where: README.md › Running; 7df4849.
- (was `BUILD-3`) A newly added native module needs a new development build. Older builds still start and say that a newer build is needed for the missing feature. Why: a dev client only contains the native modules it was built with. Where: README.md › Running; AGENTS.md › Rules.

**Store packages**

- (was `BUILD-6`) Store packages (AAB and IPA) are built on the owner's machine by `scripts/build/release.mjs`, which generates the native project again on every run. Why: so the version, the build number and pro mode's entitlements are in the package. Where: 68c58e7; [docs/versioning.md](../../docs/versioning.md) › Store packages of a version.
- (was `BUILD-8`) A pro-mode package is refused if its JavaScript bundle does not contain the server's address. Why: Gradle once kept an old bundle and produced a "pro" APK identical to the normal one (2026-11-16). Where: In the app: scripts/build/release.mjs (`checkBundle`); [docs/versioning.md](../../docs/versioning.md) › Store packages step 3.
- (was `BUILD-20`) The normal and pro packages are built one after the other, never at the same time. Why: each build needs most of the machine's memory. Where: [docs/versioning.md](../../docs/versioning.md) › Store packages.

**Native patches and plugins**

- (was `BUILD-17`) The `expo-dev-launcher` patch removes one toolbar call (`axisBehavior`) from the development launcher. The patch is dropped once every machine builds with Xcode 27.1 or upstream fixes its check. Why: upstream's check is also true on Xcode 27.0, whose SDK lacks the call, so iOS debug builds failed. It affects the development launcher only. Where: patches/expo-dev-launcher+58.0.20.patch; bc2a261.
- (was `BUILD-18`) Qutai's native browser features live in one patch of `react-native-webview` 14.0.1, each change marked "Qutai patch". They cover per-origin camera and microphone grants (where nothing allowed means a refusal), Android incognito WebView profiles, network ad blocking, background playback and picture-in-picture, certificate exceptions only for the exact certificate the user accepted, downloads into Qutai's own module, and reading and deleting cookies per profile without their values. Why: none of this is in the library itself. Each part's reason is in its commit (86eace5, e677bac, e090b66, 2b331a8, e479786, 06b61bb, c4777c7, 496320b, 6d45b73, e1ca973). Where: In the app: patches/react-native-webview+14.0.1.patch (`isMediaCaptureGranted`, `RNCWebViewContentBlocker`, `RNCWebViewProfiles`, `RNCWebViewCertificates`, `RNCWebViewCookies`); patches/.
- (was `BUILD-19`) Every native change comes from a config plugin in `plugins/`: storage write permission only up to Android 10, cleartext http allowed for pages the user opens, background media, background tasks (specialUse foreground service), downloads (including REQUEST_INSTALL_PACKAGES), picture-in-picture, entry points (share, shortcuts, widget, quick actions), pro accounts, release signing, launch background and orientations. Why: BUILD-2. Each plugin's header gives its own reason. For example, cleartext is allowed app-wide because a network security config cannot name private address ranges, which makes it the narrowest setting that lets a browser open http pages. The HTTPS-only setting stays on by default. Where: plugins/*.js; app.json › plugins; 06b61bb.

## Limits and what is not built

- (not planned: BUILD-5) No EAS profile builds pro mode. Pro store packages come only from the local script.
- `submit.production` is a skeleton, and the store accounts and app ids are not in the repository.
- Builds from Play need extra Google OAuth clients, one for each certificate on Play's App signing page ([docs/google-sign-in.md](../../docs/google-sign-in.md), f630317).
- (planned) Make a separate Apple sign-in key for production (see HOUSE).

## Where it lives

- `eas.json`, `app.json`, `plugins/`, `patches/`, `modules/` (qutai-agent, qutai-auth, qutai-downloads, qutai-entry, qutai-media), `scripts/build/release.mjs`
- Read next: [docs/release-signing.md](../../docs/release-signing.md), [docs/pro-test-builds.md](../../docs/pro-test-builds.md), [docs/versioning.md](../../docs/versioning.md), [docs/google-sign-in.md](../../docs/google-sign-in.md), [docs/permissions.md](../../docs/permissions.md)

## Disagreements between sources

- [docs/pro-test-builds.md](../../docs/pro-test-builds.md) still builds the iOS test app with `EXPO_PUBLIC_DEV_LOGIN=on`, and the header of docs/test-checklist.md (16 Nov) calls the pro APK "test girişi açık". The owner's note says test sign-in has been off since 17 Nov. The release script follows the newer rule and strips it (BUILD-9). The test-build doc is out of date.
- The comment in src/config/features.ts says official store builds set pro mode "in their EAS build profile", but every profile in eas.json sets it off, and store packages come from scripts/build/release.mjs.
- docs/versioning.md says `builds/` is git-ignored. It is ignored only through `.git/info/exclude` on this machine, not in the committed `.gitignore`, so a fresh clone would not ignore it.
