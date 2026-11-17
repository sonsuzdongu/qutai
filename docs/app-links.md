# The sign-in link as an App Link / Universal Link

The sign-in mail links to `https://<MAIL_INTENT_DOMAIN><MAIL_INTENT_PATH>?token=…` (server variables, per environment;
the path defaults to `/intent/sign-in/email`). Today that is the website's page (`webpage/worker/intent.ts`), which
opens the app. With an **App Link** (Android) and a **Universal Link** (iOS) on the same host, the phone opens Qutai
straight from the mail, without the page. Nothing in this repository names a real team id, bundle id, package or
certificate: everything below is configuration.

## How the token stays out of history, logs and the AI

| Where the link is opened | What happens to the token |
|---|---|
| Mail app, App Link / Universal Link set up | The OS gives the URL to Qutai; no web request is made. The app sends the token to the server with the waiting address and never shows or stores it. |
| Mail app, no App Link (today) | The browser loads the website's page: the token reaches Cloudflare's edge in the URL, but the page's Worker has observability off and logs nothing, sends `Referrer-Policy: no-referrer`, is not cached or indexed, and removes the token from the address bar and history entry (`history.replaceState`) before handing it to the app. |
| Inside Qutai's own browser (a tab, or Qutai as the default Android browser) | The tab checks the URL before loading it (`takeSignInLink`): the page is never loaded, so the token never becomes a tab, a history entry, a search, page text for the assistant or a line in the "sent to the AI" log. |
| Mailjet | Open and click tracking are off per message (`TrackOpens` / `TrackClicks` `disabled`), so the link is not rewritten through Mailjet's tracker. |
| Our API | The structured logger can't carry tokens, codes or addresses (field allowlist); only HMACs are stored. |

A scanner that opens the link uses nothing up: the link only works with the address and device that asked.

## 1. What the site must serve

Both from the host in `MAIL_INTENT_DOMAIN`, over https with a valid certificate, **no redirect**, `Content-Type:
application/json`. The website's Worker serves them from its variables (`webpage/worker/wellKnown.ts`); until those are
set both paths answer 404, exactly as before.

`https://<host>/.well-known/apple-app-site-association` (no file extension):

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["<TEAM_ID>.<BUNDLE_ID>"],
        "components": [{ "/": "/intent/sign-in/email", "comment": "Qutai sign-in link" }]
      }
    ]
  }
}
```

`https://<host>/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "<PACKAGE_NAME>",
      "sha256_cert_fingerprints": ["<SHA256_FINGERPRINT_1>", "<SHA256_FINGERPRINT_2>"]
    }
  }
]
```

If the server's `MAIL_INTENT_PATH` is not the default, use that path in the AASA `components` (the Worker's
`APP_LINK_PATH`) and in the app (`EXPO_PUBLIC_APP_LINK_PATH`).

## 2. Where each value comes from

| Placeholder | Where to find it |
|---|---|
| `<TEAM_ID>` | Apple Developer › Membership details › Team ID (10 characters). |
| `<BUNDLE_ID>` | The app's `ios.bundleIdentifier` in `app.json` (Apple Developer › Identifiers shows it too). |
| `<PACKAGE_NAME>` | The app's `android.package` in `app.json`. |
| `<SHA256_FINGERPRINT_…>` | Every certificate that signs a build which should open the link: **Play Console › your app › Test and release › App integrity › App signing key certificate › SHA-256** (store builds), the **upload key** certificate on the same page (internal test builds signed with it), EAS builds: `npx eas-cli credentials` › Android › the keystore's SHA-256; a local debug build: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`. Format `AA:BB:…` (32 pairs). |

## 3. Owner's steps

1. Deploy the website with its variables (not committed):
   `cd webpage && npx wrangler deploy --var APPLE_APP_IDS:<TEAM_ID>.<BUNDLE_ID> --var ANDROID_CERT_SHA256:<fp1>,<fp2>`
   (or set them as plain-text variables of the Worker in the Cloudflare dashboard).
2. Check both files: `curl -si https://<host>/.well-known/apple-app-site-association` and
   `curl -si https://<host>/.well-known/assetlinks.json` (200, `application/json`, no redirect). Google's checker:
   `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://<host>&relation=delegate_permission/common.handle_all_urls`.
3. Apple Developer › Identifiers › the App ID › enable **Associated Domains** (regenerate the provisioning profiles; EAS
   does this when it manages credentials).
4. Build the app with `EXPO_PUBLIC_APP_LINK_HOST=<host>` (and `EXPO_PUBLIC_APP_LINK_PATH` if not the default) in `.env`
   or the EAS profile's `env`. The config plugin (`plugins/withProAccounts.js`) then adds the `applinks:<host>`
   entitlement on iOS and a verified (`autoVerify`) https intent filter for the host and path on Android. A **native
   rebuild** is needed (`npx expo prebuild --clean` / a new EAS build); a build without the variable is unchanged.
5. On a phone: tap the link in the mail. Android: `adb shell pm get-app-links <PACKAGE_NAME>` should show the host as
   `verified` (re-verify with `adb shell pm verify-app-links --re-verify <PACKAGE_NAME>`). iOS: the link opens Qutai
   directly; long-pressing it shows "Open in Qutai". Apple fetches the AASA through its CDN, which can take a while to
   pick up changes.
6. Keep the website page: browsers without the app, desktops, and phones where verification failed still use it.

The server needs nothing new for this: `MAIL_INTENT_DOMAIN` (and `MAIL_INTENT_PATH`) already decide the link.
