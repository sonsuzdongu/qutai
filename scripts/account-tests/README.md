# Account tests (pro mode)

Tests for the account client in `src/account/` (`api.ts`, `session.ts`, `nonce.ts`: pure TypeScript, no React
Native imports). They use Node's built-in test runner (`node --test`, Node 22.18+ / 24) with its TypeScript support;
no test framework is added to the app. `resolve-ts.mjs` lets Node resolve the app's extensionless imports to `.ts`.
The folder is left out of the app's `tsc` (Node types aren't installed in the app); Node only strips the types.

```bash
npm run test:account          # client and session against a fake server
npm run test:account:server   # against the local server (QUTAI_TEST_API_URL, default http://localhost:8790)
```

For the second one, run the server first (`backend/README.md` › Local development): `cd backend && npm install &&
npm run migrate:local`, `apps/api/.dev.vars` with `ACCESS_TOKEN_SIGNING_KEY` and `REFRESH_TOKEN_PEPPER`, then
`npm run dev`. Real Apple / Google identity tokens can't be made in a test, so each test writes its user and refresh
token straight into the local D1 database (`wrangler d1 execute --local`, hashed with the local pepper) and then uses
only the server's real routes. It never touches a remote database.

The test sign-in (`POST /auth/dev`) is tested for real when the server has it switched on (`DEV_SIGN_IN=true` and
`DEV_SIGN_IN_SECRET` in `apps/api/.dev.vars`) and the same secret is given to the tests:

```bash
QUTAI_TEST_DEV_LOGIN_SECRET=<the server's DEV_SIGN_IN_SECRET> npm run test:account:server
```

Those tests wait a minute before they start, because the tests before them use most of the server's per-address
limit on auth routes. `QUTAI_TEST_D1_STATE` points the database writes at another local state folder when the
server runs with a different `--persist-to` (default `.wrangler/state/api`).

Sign-in by email is tested for real when the server runs with `EMAIL_SENDER=log` and its output goes to a file the
tests can read (they take the code and link from it). Those tests also wait a minute first, and one of them waits out
the 30-second resend time. A server of your own on another port, with its own state and keys, keeps your usual
server and its database untouched (`QUTAI_TEST_DEV_VARS` names that server's `.dev.vars`, for the pepper):

```bash
QUTAI_TEST_API_URL=http://localhost:8795 QUTAI_TEST_EMAIL_LOG=<server output file> \
QUTAI_TEST_DEV_VARS=<that server's .dev.vars> QUTAI_TEST_D1_STATE=<its --persist-to folder> npm run test:account:server
```
