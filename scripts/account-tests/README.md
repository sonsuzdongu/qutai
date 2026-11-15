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
