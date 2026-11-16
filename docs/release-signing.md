# Android release signing (upload key)

Release builds made on this machine (`./gradlew :app:assembleRelease` / `bundleRelease`) are signed with Qutai's
own **upload key** when a signing file exists; otherwise they stay signed with the template debug keystore
(`android/app/debug.keystore`, the same public key in every React Native app) and Gradle warns. The config plugin
`plugins/withReleaseSigning.js` adds this to the generated `android/app/build.gradle`. EAS Build is not affected:
it signs with the credentials EAS manages.

Nothing secret is in the repository: the keystore and its passwords live outside it.

## One-time setup (owner)

1. Create the keystore. `keytool` asks for a password and your name details; choose a strong password and keep it
   in your password manager. Lose the key or the password and you lose the ability to sign updates the same way
   (with Play App Signing, Google can reset an upload key; without it, it can't be replaced).

   ```bash
   mkdir -p ~/.qutai && chmod 700 ~/.qutai
   ```

   ```bash
   keytool -genkeypair -v -keystore ~/.qutai/qutai-upload.jks -alias qutai-upload -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Create `~/.qutai/release-signing.properties` (a text file, `chmod 600`):

   ```
   storeFile=/Users/<you>/.qutai/qutai-upload.jks
   storePassword=<the password>
   keyAlias=qutai-upload
   keyPassword=<the password>
   ```

   Another location works too: point the `QUTAI_RELEASE_SIGNING` environment variable at the file.

3. Back up `qutai-upload.jks` and the password somewhere safe (not in the repository, not in a cloud folder that
   syncs to shared machines).

4. The SHA-1 of the new key, for the Google Cloud Android OAuth client (docs/google-sign-in.md):

   ```bash
   keytool -list -v -keystore ~/.qutai/qutai-upload.jks -alias qutai-upload | grep SHA1
   ```

## What changes

- An APK signed with the new key can't be installed over one signed with the debug key: uninstall Qutai on the
  test phone first (its local data goes with it).
- If the file is there but incomplete, or names a keystore that doesn't exist, the release build stops with a
  "Qutai release signing: …" error instead of silently using the debug key.
- `npx expo prebuild` keeps the setting (the plugin re-adds it); never edit `android/` by hand.
- Play Store: with Play App Signing, Google re-signs the app with its own **app signing key**. Sign in with Google
  then needs a second Android OAuth client with that key's SHA-1 (Play Console › Test and release › App
  integrity); the upload key's client stays for sideloaded builds.
