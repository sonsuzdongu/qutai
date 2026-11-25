# Test support: one loader, one runner

All app test suites live in `scripts/*-tests/` and use Node's built-in test runner with its TypeScript support; no
test framework is added to the app, and these folders are left out of the app's `tsc`.

```bash
npm test                    # every server-free suite, 4 at a time: one line per suite, a total, exit 1 on a failure
npm run test:text           # one suite with node's full output (every suite keeps its test:<name>)
node scripts/test-support/run.mjs text apps     # some suites, summarised
QUTAI_TEST_JOBS=1 npm test  # one at a time (default: half the cores, at most 4)
npm run test:coverage       # the same with node's own coverage: per-file summary in node_modules/.cache/qutai-coverage/
npm run check:all           # before a commit or a build: typecheck, lint, profile, npm test, and the server's checks
```

- [suites.mjs](suites.mjs) is the table of suites: files, environment (`approvals` runs in `TZ=Europe/Istanbul`),
  `forceExit` for suites whose code under test keeps timers or sockets. Suites marked `server` need Qutai's local
  server (`QUTAI_TEST_API_URL`, default `http://localhost:8790`) and run only by name:
  `npm run test:account:server`, `test:backup:server`, `test:credits:server`.
- Globs are expanded by suites.mjs (`filesOf`); `exclude` keeps a server test out of its folder's suite. The `support`
  suite (suites.test.mjs) fails when a `*.test.ts` or `*.test.mjs` under `scripts/` is run by no suite, so a new
  test file is never silently skipped.
- [register.mjs](register.mjs) is the one module loader (`--import ./scripts/test-support/loader.mjs`): extensionless
  imports, stand-ins for native modules and `.tsx` files, type-only imports, i18n's `require`. Platform.OS follows
  `QUTAI_TEST_OS` (default `ios`), the language `QUTAI_TEST_LANG` (default `en`). A harness can replace app files with
  its own stand-ins through the `stubs` option (scripts/injection-tests/loader.mjs does).
- Not in `npm test`, and billed or needing a key: `npm run measure:injection` (the owner's Anthropic key, capped).
  Free measuring scripts: `measure:tokens`, `measure:intro`, `measure:omnibox`, `measure:backup`.
- Time-based checks: `text` compares wellFormedJson with JSON.stringify in the same run (an absolute limit failed once
  on a busy machine); `tasks` (abort.test.ts) checks that a stop ends waits within about a second of a 15-second one.
