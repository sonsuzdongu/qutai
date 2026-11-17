# Sign in with Google on Android: owner checklist

For the first real test of Sign in with Google (pro mode) on an Android phone, against a local server; iOS
(simulator or phone) is in section 6. No real ids belong in this file or in any commit.

How it works, in one line: the app asks Credential Manager for a Google ID token for the **web** client id
(with a nonce), and Qutai's server accepts the token only if its `aud` is in `GOOGLE_CLIENT_IDS`. The Android
client id never appears in the token; Google uses it only to check that the app asking is really ours
(package name + signing certificate).

## 1. Google Cloud console (test project)

1. Create the Qutai project (one project serves testing and production; what production adds is in section 7).
2. **Google Auth Platform › Branding** (older consoles: *OAuth consent screen*): app name, support email.
   Audience: **External**, publishing status **Testing**. Under **Audience › Test users** add every Google
   account that will try signing in. In Testing, only those accounts can sign in.
   Data access / scopes: `openid`, `email`, `profile` (the defaults; nothing sensitive).
3. **Clients › Create client › Web application**. Name it e.g. "Qutai server (test)". No redirect URIs or
   origins are needed. Its client id is the **web client id**.
4. **Clients › Create client › Android**: package name `com.sonsuzdongu.qutai` and the **SHA-1 of the
   certificate that signs the APK you will install** (next step). No secret is involved; you don't copy this
   client id anywhere.

### Which SHA-1

The SHA-1 must be that of the key that signs the APK on the phone:

- **Qutai's upload key** when `~/.qutai/release-signing.properties` exists (docs/release-signing.md, the normal case):

  ```bash
  keytool -list -v -keystore ~/.qutai/qutai-upload.jks -alias qutai-upload | grep SHA1
  ```

- otherwise the template debug keystore **`android/app/debug.keystore`** (not `~/.android/debug.keystore`, a
  different key). It is public: an Android client with its SHA-1 is for a quick local test only and must be
  deleted before the app is public.

Safest, from the APK itself:

```bash
"$ANDROID_HOME"/build-tools/<version>/apksigner verify --print-certs builds/<the-apk>.apk | grep SHA-1
```

`android/` is generated (`expo prebuild`); a fresh prebuild copies the same template keystore, but if the APK is
ever signed with another key, add a second Android client (or replace the SHA-1) with that key's SHA-1.

## 2. Where the two values go

Only the **web client id** is used, in two uncommitted files:

| File | Line | Effect |
|---|---|---|
| `.env` (repository root) | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>` | built into the app; without it there is no Google button |
| `backend/apps/api/.dev.vars` | `GOOGLE_CLIENT_IDS=<web client id>` | the server accepts tokens for it; without it `POST /auth/google` answers 503 |

- **Server:** the `.dev.vars` line replaces the committed `PLACEHOLDER` for `npm run dev` (checked by
  `npm run check:dev-vars` in `backend/`). Restart the local server after editing `.dev.vars`.
  Several ids are comma-separated (the iOS client id joins later).
- **App:** a release bundle built with `./gradlew :app:assembleRelease` (or `:app:createBundleReleaseJsAndAssets`)
  runs `expo export:embed`, which reads the root `.env` files itself. A value exported on the command line wins
  over `.env`, including an *empty* one: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID= ./gradlew …` hides the button. Pro
  mode must be on as well (`EXPO_PUBLIC_PRO_MODE=on`, `EXPO_PUBLIC_QUTAI_API_URL`).
- The Google button appears in setup's Qutai step and in Settings › Account only when the build has the web
  client id.

## 3. The test

1. On the phone: a Google account that is a test user (step 1.2) is added in the phone's settings, Google Play
   services is up to date.
2. Settings › Account › Sign in with Google → Google's account picker → pick the test user.
3. On failure, the dialog (or setup's note) has a **Details** line. Send that line; it never contains a token,
   nonce, client id or email.

## 4. Symptom → most likely cause

**Details start with `Google:`** (the phone or Google refused, the server was never asked):

| Details | Most likely cause |
|---|---|
| `ERR_NO_CREDENTIAL: TYPE_NO_CREDENTIAL …` and the plain sentence "No Google account was found" | no Google account on the phone, or the account picker had nothing to offer. If an account *is* on the phone, treat it like the next row |
| `ERR_GOOGLE_SIGN_IN: TYPE_UNKNOWN: … 10: …` or "Developer console is not set up correctly" (often with a number such as `[28444]`) | **DEVELOPER_ERROR**: package name or SHA-1 of the Android client doesn't match the installed APK (section 1, "Which SHA-1"), or the web client id in `.env` belongs to another project. Console changes can take a few minutes to apply |
| the picker works but Google then refuses the chosen account (Google's own screen, or another status number in Details) | the account is not a test user of a project in Testing, or must sign in again in the phone's settings. Other numbers are Google Play services status codes: send the line |
| `ERR_CANCELED` (no message shown) | the picker was closed. Many cancels without anyone closing it can also mean misconfiguration (Google's troubleshooting page) |
| `… TYPE_PROVIDER_CONFIGURATION …` | the Play services Credential Manager provider is missing from the build (a build problem: tell the developer) |
| `… TYPE_UNSUPPORTED …` | the phone has no Credential Manager support (Play services too old) |
| `TYPE_UNEXPECTED_CREDENTIAL` / `TYPE_PARSING` | Google answered with something the app doesn't understand: tell the developer |

**Details start with `Qutai server:`** (Google gave a token, Qutai's server refused it; reasons in
`backend/README.md` › Auth › Sign-in error reasons):

| Details | Most likely cause |
|---|---|
| `HTTP 503 unavailable (not_configured)` | `GOOGLE_CLIENT_IDS` missing from `.dev.vars` or the server not restarted (still the placeholder) |
| `HTTP 401 unauthorized (wrong_audience)` | the server's `GOOGLE_CLIENT_IDS` is not the web client id the app was built with (e.g. the Android client id was put there, or ids from two projects) |
| `HTTP 401 unauthorized (nonce_mismatch)` / `(missing_claim)` | an app bug in the nonce handling: tell the developer |
| `HTTP 401 unauthorized (nonce_reused)` | a retried request; try again |
| `HTTP 401 unauthorized (expired)` | the phone's or computer's clock is far off |
| `HTTP 503 unavailable (keys_unavailable)` | the server couldn't fetch Google's signing keys (computer offline?) |
| `no answer (network)` / `(timeout)` | the phone can't reach `EXPO_PUBLIC_QUTAI_API_URL` (same Wi-Fi? server running?) |

## 6. iOS (simulator or iPhone)

iOS doesn't use Credential Manager: the app opens Google's sign-in page in the system's authentication window
(`expo-auth-session`, PKCE, the nonce) with the **iOS** OAuth client and exchanges the code for the ID token
itself. That token's `aud` is the iOS client id.

1. Google Cloud › Clients › Create client › **iOS**, bundle ID `com.sonsuzdongu.qutai` (App Store ID and Team ID
   can stay empty). No secret.
2. Root `.env`: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS client id>`.
3. `backend/apps/api/.dev.vars`: add the iOS client id to the list, `GOOGLE_CLIENT_IDS=<web client id>,<iOS client id>`,
   and restart the local server. Without it the server answers 401 `wrong_audience`.
4. Rebuild the iOS app in pro mode (`EXPO_PUBLIC_PRO_MODE=on`, `EXPO_PUBLIC_QUTAI_API_URL`): `plugins/withProAccounts.js`
   adds the reversed iOS client id as a URL scheme (Google's redirect back to the app), which only a native build
   picks up; reloading JavaScript isn't enough.
5. Settings › Account › Sign in with Google: Google's page opens in a sheet; sign in with a test user.

Details lines on iOS start with `Google:` (`cancel`/`dismiss` = the sheet was closed, `error (…)` = Google's
OAuth error, e.g. `invalid_client` or `redirect_uri_mismatch` for a wrong client id or URL scheme) or
`Google token exchange:` (the code exchange failed), or `Qutai server:` as on Android.

## 7. Production later

- Publishing the consent screen beyond Testing (Audience › Publish app) after Google's brand verification;
  until then only the listed test users can sign in.
- Delete any Android client made for the template debug keystore's SHA-1 (it is public).
- The Play Store build is re-signed by **Play App Signing**: its Android client needs the **app signing key
  certificate** SHA-1 from Play Console (Test and release › App integrity), and one for the upload key if
  sideloaded upload-key builds should work too. The template debug keystore must never sign a production build.
- **What happened on 17 Nov 2026 (internal testing track).** Sign-in in the Play-installed build listed the accounts
  and then came back as "Sign-in was cancelled" without reaching the server: Google refuses to issue a token when the
  installed app's signing certificate matches no Android client, and Credential Manager reports that as a
  cancellation. Play Console › Test and release › App integrity › App signing showed three certificates besides the
  upload key: the current app signing key's classical certificate, its post-quantum certificate ("Quantum-ready"
  keys have both), and a previous app signing key (the key had been changed that day). An Android client was added
  for each SHA-1 (package `com.sonsuzdongu.qutai`); sign-in then worked. Which of the three the phone needed was not
  established, and a new client can take from five minutes to a few hours to take effect, so register every
  certificate on that page, including previous keys, and wait before concluding it failed. The internal testing
  track is enough for the app signing key to exist; the app needn't be released.
- The consent screen went from Testing to **In production** the same day (any Google account can sign in; no
  sensitive scopes, so no data-access verification), with app name, home page, privacy policy, the authorised domain
  and a logo; "Verify branding" passed in about a minute without a Search Console step, and the verified branding
  must then be published ("Publish branding") within seven days.
- The production web client id goes into the production build's `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and the
  production Worker's `GOOGLE_CLIENT_IDS` (replacing the `PLACEHOLDER` in `backend/apps/api/wrangler.jsonc`
  locally or in CI before a deploy, see `backend/README.md` › What to set up at Apple and Google), together with
  the iOS client id.
