# Sign in with Apple: the owner's setup (iOS and Android)

Server side: `backend/README.md` › Auth (sign-in, revocation at deletion and removal, the web flow). This page is what
has to exist at Apple and in the configuration. **Android cannot be tried for real until steps 2–4 are done**: the
server answers `503 not_configured` and the app shows no Apple button on Android.

Apple's pages (checked 17 Nov 2026; their HTML is rendered by script, the same content is readable at
`https://developer.apple.com/tutorials/data/documentation/signinwithapple/<page>.json`): "Incorporating Sign in with
Apple into other platforms", "Configuring your webpage for Sign in with Apple", and the REST API's "Generate and
validate tokens".

## 1. iOS (exists today)

1. Apple Developer › Certificates, Identifiers & Profiles › Identifiers › the app's **App ID** › enable **Sign in with
   Apple** (as a primary App ID).
2. Keys › **+** › a key with *Sign in with Apple* enabled, linked to that App ID. Download the `.p8` once.
3. Server secrets (`wrangler secret put … --env <dev|production>`; locally in `backend/apps/api/.dev.vars`):
   `APPLE_PRIVATE_KEY` (the `.p8` contents), `APPLE_KEY_ID` (the key's id), `APPLE_TEAM_ID` (Membership › Team ID),
   `APPLE_TOKEN_ENCRYPTION_KEY` (`node scripts/generate-secret.mjs aes-key` in `backend/`). These let the
   server exchange the authorization code and revoke Apple's authorization when the account is deleted or Apple is
   removed as a sign-in method.
4. Server var `APPLE_CLIENT_IDS` = the bundle id (replace the `PLACEHOLDER` locally or in CI, never commit it).
5. A pro build (`EXPO_PUBLIC_PRO_MODE=on`) gets the entitlement from `plugins/withProAccounts.js`; the button is the
   system's.

## 2. A Services ID (Android's web flow)

1. Identifiers › **+** › **Services IDs** › a description and an identifier (e.g. `<bundle id>.signin`; it is the
   `client_id` of the web flow). Register it.
2. Open it › enable **Sign in with Apple** › **Configure**:
   - **Primary App ID**: the app's App ID (so Apple treats both as one app: the same user gets the same `sub`, and the
     server joins them as one Apple identity).
   - **Domains and Subdomains**: the API's host, e.g. `api.<your domain>` (no scheme).
   - **Return URLs**: `https://api.<your domain>/auth/apple/web/callback` — exactly the server's
     `APPLE_WEB_RETURN_URL`. Apple accepts only https URLs with a domain name (no IP address, no `localhost`, no `#`).
3. Save. If Apple asks to verify the domain, follow its prompt (it may ask for a file under `/.well-known/` on that
   host; the API can serve it the same way the website serves its well-known files, ask for it then).
4. The same Sign in with Apple key from §1 signs the web flow's client secret; nothing new to download.

## 3. Server configuration

| Name | Value | Kind |
|---|---|---|
| `APPLE_SERVICES_ID` | the Services ID's identifier | var |
| `APPLE_WEB_RETURN_URL` | `https://<API host>/auth/apple/web/callback` | var |
| `APPLE_WEB_APP_REDIRECT` | optional; default `qutai://auth/apple/done` | var |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_TOKEN_ENCRYPTION_KEY` | as in §1 | secrets |

Both `APPLE_SERVICES_ID` and `APPLE_WEB_RETURN_URL` must be set (they are declared empty in `wrangler.jsonc`; set them
there per environment or in `.dev.vars` locally). Then `GET /config` answers `auth: { "appleWeb": true }` and the
Android app shows "Sign in with Apple". Run `npm run migrate:local` (migration 0009) on a local server first.

A local server can't receive Apple's return: the return URL must be the API's public https host. To try it end to end
before production, deploy the dev API (`npm run deploy:dev` in `backend/`) on a host you registered in §2.

## 4. Trying it on Android

1. The pro build pointed at that API; no native rebuild is needed for this (it uses `expo-web-browser`, already in the
   app, and the existing `qutai` scheme).
2. Settings › Account › **Sign in with Apple**: a Custom Tab opens Apple's page; after "Continue" it returns to Qutai
   and the account appears. Cancel returns with nothing changed.
3. Signed in another way: Settings › Account › Add a sign-in method › Apple adds it (and removing it revokes it).
4. If it fails, the dialog's Details line names the server's reason (`not_configured`, `flow_invalid`, …); the API's
   log has `apple_web_rejected` with a fixed reason (`unknown_state`, `wrong_audience`, `nonce_mismatch`, `cancelled`).

## What the flow protects

- Apple's tokens never appear in a URL: Apple POSTs them to the server; the app gets a flow id and a one-time
  handoff value, both useless without the verifier the app kept (its hash went to the server first). Another app
  catching `qutai://auth/apple/done` can't finish the sign-in.
- The `state` sent to Apple finds the flow (only its hash is stored); the `id_token` must be for the Services ID and
  carry the SHA-256 of the flow's nonce, used once; the flow lives 10 minutes and finishes once, on the device that
  started it.
- Only the address is asked for (`scope=email`); the name Apple sends the first time is ignored.
