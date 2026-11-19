# Pro-mode test builds (owner's notes)

Builds that talk to the local server through the owner's tunnel (it forwards to local port 8000; start the API
with `API_PORT=8000`). The tunnel address is a real domain and stays out of commits: replace `<tunnel URL>`
below when running a command (it is the `https://…` address that forwards to port 8000).

Values that come from the uncommitted files by themselves: the Google client ids from the root `.env`
(docs/google-sign-in.md). The test sign-in stays off in these builds (the owner's decision of 17 Nov 2026,
`HOUSE-16`): they are made without `EXPO_PUBLIC_DEV_LOGIN` and its secret, so sign in with Apple, Google or email.

## iOS: Release build on a connected iPhone

```bash
EXPO_PUBLIC_PRO_MODE=on EXPO_PUBLIC_QUTAI_API_URL=<tunnel URL> npx expo run:ios --configuration Release --device
```

- `--device` asks which connected iPhone to install on; leave it out for the simulator.
- Sign in with Google needs the native build (the URL scheme of the iOS client goes into Info.plist); reloading
  JavaScript is not enough after the Google client ids change.

## Android: release APK

Same `EXPO_PUBLIC_*` values. Signed with the upload key when `~/.qutai/release-signing.properties` exists
(docs/release-signing.md); without it Sign in with Google fails (no OAuth client for the debug key).

- Gradle may treat the JavaScript bundle as up to date when only `EXPO_PUBLIC_*` values (or `.env`) changed:
  build with `./gradlew :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease …` and check that the
  tunnel host is in the APK's `assets/index.android.bundle`.
- An APK signed with another key can't be installed over the old one: uninstall Qutai on the phone first.
