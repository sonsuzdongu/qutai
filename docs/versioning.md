# Version and build number

One rule, one script. Read this before touching `version`, `buildNumber` or `versionCode` anywhere.

## The rule

- The **version** is `major.minor.patch` in `app.json` › `expo.version` (dotted numbers only, no `-beta` suffixes).
- The **build number** is computed from the version, never counted separately:

  `major*10000 + minor*100 + patch`

  | Version | Build |
  |---|---|
  | 0.1.0 | 100 |
  | 0.1.7 | 107 |
  | 0.2.0 | 200 |
  | 1.0.0 | 10000 |
  | 1.2 (a missing part counts as 0) | 10200 |

- Android (`expo.android.versionCode`, a number) and iOS (`expo.ios.buildNumber`, a string) always carry the **same**
  build number.
- Minor and patch stop at 99. `0.1.99` cannot be bumped to `0.1.100` (its number would collide with `0.2.0`): go to
  `0.2.0` by hand.
- Why computed: a rule that used the version without its dots went 0.1.16 → 116 and then 0.2.0 → 20, backwards. The
  stores refuse a build number that isn't larger than the last one they have.

## When

**Only when the owner says so.** Test APKs, simulator builds and commits do not bump anything; an agent never bumps on
its own initiative. A bump is its own commit ("Version 0.1.1 (101)").

## How

```bash
npm run version:bump                  # shows the next patch bump, changes nothing
npm run version:bump -- --yes         # does it
npm run version:bump -- 0.2.0         # shows what setting 0.2.0 would do
npm run version:bump -- 0.2.0 --yes   # does it
```

The script (`scripts/version/bump.mjs`, rule in `scripts/version/rule.mjs`, tests `npm run test:version`):

1. reads `app.json`, raises the last part of the version (or takes the version given);
2. stops with a message when the version isn't dotted numbers, has more than three parts, or minor/patch would pass 99;
3. prints `Version: old → new` and `Build: old → new`, and a warning when the new build number is not larger than the
   current one (the larger of Android's and iOS's): a store that already has the current one will refuse it. The warning
   does not stop the bump;
4. with `--yes` writes `expo.version`, `expo.ios.buildNumber`, `expo.android.versionCode`, and the `version` of
   `package.json` (and `package-lock.json`).

Nothing else may write these values. `eas.json` uses `"appVersionSource": "local"` and no `autoIncrement`, so EAS builds
take the numbers from `app.json` too. `android/` and `ios/` are generated: the numbers reach them at the next
`expo prebuild` / native build, so a bump needs a native rebuild to show.

## Store packages of a version

After a bump (and its commit), on this machine:

```bash
npm run build:aab -- --pro-mode     # builds/qutai-<version>-<build>-pro-mode.aab
npm run build:ipa -- --pro-mode     # builds/qutai-<version>-<build>-pro-mode.ipa
```

`npm run build:aab:pro-mode` and `npm run build:ipa:pro-mode` are the same two commands, shorter to type.
Without `--pro-mode` the package is the plain app (no `-pro-mode` in the name). `-- --dry-run` prints the commands and
runs nothing. `scripts/build/release.mjs` never changes the version; it

1. regenerates the native project (`expo prebuild --platform …`), so the new numbers and pro mode's entitlements are in it;
2. Android: `./gradlew :app:createBundleReleaseJsAndAssets --rerun :app:bundleRelease`, signed with the upload key
   (docs/release-signing.md; it stops when the signing file is missing). iOS: `xcodebuild archive` and
   `-exportArchive` (App Store Connect, automatic signing);
3. with `--pro-mode`, checks that the server's host is in the package's JavaScript bundle, and stops if it isn't
   (Gradle once kept a stale bundle);
4. copies the package to `builds/` (git-ignored) under the name above.

Two values stay out of the repository and are read from the environment or from `.build.local.env` (git-ignored; its name must not
start with `.env`, because Expo's development bundler pulls every `.env*` file in the project root into the bundle): `EXPO_PUBLIC_QUTAI_API_URL` (the server of a pro-mode build) and
`QUTAI_APPLE_TEAM_ID` (the Apple team that signs the IPA). Optional, pro mode only: `EXPO_PUBLIC_APP_LINK_HOST` (and `EXPO_PUBLIC_APP_LINK_PATH`) makes the sign-in mail's link open the app directly (docs/app-links.md). The test sign-in variables are always removed. Run the two
builds one after the other, not together: each needs most of this machine's memory.

## The server's minimum version

The server refuses requests from an app older than its `min_app_version` setting (D1 `settings`, changed in the admin
panel › Settings, read within 15 seconds; `backend/README.md` › Relay) with `upgrade_required` (426). It compares
versions, not build numbers. After lowering the app's version, or before raising the minimum, check that the setting is
not above the version of the builds in use: when the app went from 1.0.0 to 0.1.0 the seeded minimum of 1.0.0 locked
every build out until it was set to 0.1.0.

## History

- 0.1.0 (100): first version under this rule, 17 Nov 2026. Before it every build was 1.0.0 (1); nothing had been
  uploaded to a store, so the smaller number is harmless.
