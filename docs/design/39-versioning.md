# 39. Versioning

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

How Qutai's version (for example 0.1.1) and its store build number (for example 101) are set, and who may change them.

## How it works

1. The version is written in one place: `app.json` › `expo.version`, as dotted numbers (`major.minor.patch`). Today it is 0.1.1.
2. The build number is not counted separately. It is computed from the version: `major*10000 + minor*100 + patch`. So 0.1.0 is 100, 0.1.7 is 107, 0.2.0 is 200 and 1.0.0 is 10000. A missing part counts as 0 (1.2 is 10200).
3. Android (`versionCode`) and iOS (`buildNumber`) always get the same build number. Today both are 101.
4. The owner says when to raise it ("make it 0.2.0"). Then someone runs `npm run version:bump`, which only prints what it would do (`Version: 0.1.1 → 0.1.2`, `Build: 101 → 102`). Adding `-- --yes` writes the change, and `-- 0.2.0 --yes` sets a chosen version.
5. The script writes `expo.version`, `expo.ios.buildNumber`, `expo.android.versionCode`, and the `version` in `package.json` and `package-lock.json`. The bump goes in its own commit, named like "Version 0.1.1 (101)".
6. The new numbers reach the native projects only when they are generated again (`expo prebuild` or a native build), so a bump needs a native rebuild before it shows.
7. EAS cloud builds read the same numbers from `app.json`. They do not count on their own.
8. The server turns away apps older than its "minimum app version" setting (admin panel › Settings) with "upgrade required". It compares versions, not build numbers.
9. History: until 17 Nov 2026 every build was 1.0.0 (1). Version 0.1.0 (100) was the first under this rule (17 Nov 2026), and 0.1.1 (101) followed the same day.

## The rules

- **`VER-1`** The build number is always `major*10000 + minor*100 + patch` of the version, and it is the same on Android and iOS.
  Status: Owner, 2026-11-17 · Why: the owner adapted it from their Unity project's rule. An earlier rule that only removed the dots went from 0.1.16 → 116 to 0.2.0 → 20, which is backwards, and the stores refuse a build number that is not larger than the last one · Source: [docs/versioning.md](../../docs/versioning.md) › The rule; 784567b; scripts/version/rule.mjs
- **`VER-2`** The version is raised only when the owner explicitly says so. Test APKs, simulator builds and commits never raise it, and no agent or sub-session raises it on its own.
  Status: Owner, 2026-11-17 · Why: the owner wants to decide when the number moves ("sadece ben deyince arttırılsın") · Source: [docs/versioning.md](../../docs/versioning.md) › When; owner's memory note on version bumps
- **`VER-3`** Only `npm run version:bump` writes `version`, `buildNumber` and `versionCode`. Nobody edits them by hand.
  Status: Owner, 2026-11-17 · Why: the computed rule cannot drift if only one tool writes the numbers · Source: [docs/versioning.md](../../docs/versioning.md) › How; scripts/version/bump.mjs
- **`VER-9`** The server's minimum app version must never be above the version of the builds people are using. Check it after lowering the app's version and before raising the minimum.
  Status: Default (manager or implementing session; open to change) · Why: when the app went from 1.0.0 to 0.1.0, the minimum of 1.0.0 seeded on the server locked every build out until it was set to 0.1.0 · Enforced: Server: backend relay/settings (`min_app_version`, answer `upgrade_required` 426) · Source: [docs/versioning.md](../../docs/versioning.md) › The server's minimum version; b563215, 9c5e1d8

## Details

**Version format**

- (was `VER-5`) A version is made of dotted numbers only, with at most three parts and no suffix such as `-beta`. The bump script refuses anything else. Why: the build number has to be computable from the version. Where: [docs/versioning.md](../../docs/versioning.md) › The rule; scripts/version/bump.mjs.
- (was `VER-6`) Minor and patch stop at 99. Going past that means moving by hand to the next minor or major (0.1.99 → 0.2.0). Why: 0.1.100 would get the same build number as 0.2.0. Where: [docs/versioning.md](../../docs/versioning.md) › The rule.
- (was `VER-7`) If a bump gives a build number that is not larger than the current one, the script warns but still does it. Why: a smaller number is sometimes intended. Going from 1.0.0 to 0.1.0 did no harm because nothing had been uploaded to a store yet. Where: [docs/versioning.md](../../docs/versioning.md) › How step 3, › History.

**Tools and commits**

- (was `VER-4`) A version bump is a commit of its own, titled "Version X.Y.Z (build)". Where: [docs/versioning.md](../../docs/versioning.md) › When; bf46838, 8a128a4.
- (was `VER-8`) EAS builds take their version numbers from `app.json` (`"appVersionSource": "local"`, no `autoIncrement`). Why: one source for the numbers, so the computed rule also holds on EAS. This replaced the earlier EAS-managed numbers with automatic increments (1d5f0d5). Where: eas.json; bf46838.
- (was `VER-10`) The store build script never changes the version. Why: keeps VER-2 (versions move only when the owner says so). Where: scripts/build/release.mjs header; [docs/versioning.md](../../docs/versioning.md) › Store packages of a version.

## Limits and what is not built

- Minor and patch stop at 99, and pre-release suffixes are not supported.
- (not planned: VER-2) There is no automatic bump on EAS or in CI.
- A bump shows only after the native project is generated again.

## Where it lives

- `app.json` (`expo.version`, `ios.buildNumber`, `android.versionCode`), `package.json`, `eas.json`
- `scripts/version/bump.mjs`, `scripts/version/rule.mjs`; tests with `npm run test:version`
- Read next: [docs/versioning.md](../../docs/versioning.md)

## Disagreements between sources

- README.md › Running says the `production` EAS profile's build numbers "are kept by EAS and go up by one on each build". That was true after 1d5f0d5. Since bf46838, `eas.json` uses `appVersionSource: local` with no auto-increment, which matches docs/versioning.md. The README line is out of date.
