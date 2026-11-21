// Every test suite of the app, in one table (README.md in this folder). `npm test` runs the server-free ones;
// `npm run test:<name>` runs one. Files are globs `node --test` expands itself.
//   files: what to run; env: extra environment; forceExit: the suite leaves timers or sockets the code under test
//   keeps (navigation's slow server, the task runner); server: needs Qutai's local server (QUTAI_TEST_API_URL,
//   default http://localhost:8790), never part of `npm test`.
const LOCAL_API = { QUTAI_TEST_API_URL: process.env.QUTAI_TEST_API_URL || 'http://localhost:8790' };

export const SUITES = {
  account: { files: ['scripts/account-tests/session.test.ts', 'scripts/account-tests/email.test.ts', 'scripts/account-tests/methods.test.ts'] },
  cost: { files: ['scripts/cost-tests/*.test.ts'] },
  custom: { files: ['scripts/custom-endpoint-tests/*.test.ts'] },
  instructions: { files: ['scripts/instructions-tests/*.test.ts'] },
  approvals: { files: ['scripts/approval-tests/*.test.ts'], env: { TZ: 'Europe/Istanbul' } },
  text: { files: ['scripts/text-tests/*.test.ts'] },
  intro: { files: ['scripts/intro-tests/*.test.ts'] },
  assistant: { files: ['scripts/assistant-tests/*.test.ts'] },
  image: { files: ['scripts/image-tests/*.test.ts'] },
  contacts: { files: ['scripts/contacts-tests/*.test.ts'] },
  i18n: { files: ['scripts/i18n-tests/*.test.ts'] },
  navigation: { files: ['scripts/navigation-tests/*.test.ts'], forceExit: true },
  omnibox: { files: ['scripts/omnibox-tests/*.test.ts'] },
  install: { files: ['scripts/install-tests/*.test.ts'] },
  entry: { files: ['scripts/entry-tests/*.test.ts'] },
  version: { files: ['scripts/version/rule.test.mjs'], plain: true },
  useragent: { files: ['scripts/useragent-tests/*.test.ts'] },
  layout: { files: ['scripts/layout-tests/*.test.ts'] },
  apps: { files: ['scripts/app-tests/*.test.ts'] },
  siterules: { files: ['scripts/site-rules-tests/*.test.ts'] },
  credits: { files: ['scripts/credits-tests/*.test.ts'] },
  backup: { files: ['scripts/backup-tests/logic.test.ts', 'scripts/backup-tests/client.test.ts', 'scripts/backup-tests/offer.test.ts'] },
  injection: { files: ['scripts/injection-tests/*.test.ts'], loader: './scripts/injection-tests/loader.mjs' },
  storage: { files: ['scripts/storage-tests/*.test.ts'] },
  tasks: { files: ['scripts/task-tests/*.test.ts'], forceExit: true },
  blocking: { files: ['scripts/blocking-tests/*.test.ts'], loader: './scripts/blocking-tests/loader.mjs' },
  media: { files: ['scripts/media-tests/*.test.ts'] },
  voice: { files: ['scripts/voice-tests/*.test.ts'], loader: './scripts/voice-tests/loader.mjs' },
  'account:server': { files: ['scripts/account-tests/server.test.ts'], env: LOCAL_API, server: true },
  'backup:server': { files: ['scripts/backup-tests/server.test.ts'], env: LOCAL_API, server: true },
  'credits:server': { files: ['scripts/credits-tests/server/relay-server.test.ts'], env: LOCAL_API, server: true },
};
