// Every test suite of the app, in one table (README.md in this folder). `npm test` runs the server-free ones;
// `npm run test:<name>` runs one. Files are globs, expanded here (filesOf) so a suite can leave some out.
//   files: what to run; exclude: files the globs match that belong to another suite (the server ones); env: extra
//   environment; forceExit: the suite leaves timers or sockets the code under test
//   keeps (navigation's slow server, the task runner); server: needs Qutai's local server (QUTAI_TEST_API_URL,
//   default http://localhost:8790), never part of `npm test`.
import { globSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCAL_API = { QUTAI_TEST_API_URL: process.env.QUTAI_TEST_API_URL || 'http://localhost:8790' };

export const SUITES = {
  account: { files: ['scripts/account-tests/*.test.ts'], exclude: ['scripts/account-tests/server.test.ts'] },
  cost: { files: ['scripts/cost-tests/*.test.ts'] },
  analytics: { files: ['scripts/analytics-tests/*.test.ts'] },
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
  version: { files: ['scripts/version/*.test.mjs'], plain: true },
  build: { files: ['scripts/build/*.test.mjs'], plain: true },
  support: { files: ['scripts/test-support/*.test.mjs'], plain: true },
  useragent: { files: ['scripts/useragent-tests/*.test.ts'] },
  layout: { files: ['scripts/layout-tests/*.test.ts'] },
  apps: { files: ['scripts/app-tests/*.test.ts'] },
  siterules: { files: ['scripts/site-rules-tests/*.test.ts'] },
  credits: { files: ['scripts/credits-tests/*.test.ts'] },
  backup: { files: ['scripts/backup-tests/*.test.ts'], exclude: ['scripts/backup-tests/server.test.ts'] },
  injection: { files: ['scripts/injection-tests/*.test.ts'], loader: './scripts/injection-tests/loader.mjs' },
  storage: { files: ['scripts/storage-tests/*.test.ts'] },
  tasks: { files: ['scripts/task-tests/*.test.ts'], forceExit: true },
  blocking: { files: ['scripts/blocking-tests/*.test.ts'], loader: './scripts/blocking-tests/loader.mjs' },
  tools: { files: ['scripts/tools-tests/*.test.ts'] },
  media: { files: ['scripts/media-tests/*.test.ts'] },
  voice: { files: ['scripts/voice-tests/*.test.ts'], loader: './scripts/voice-tests/loader.mjs' },
  'account:server': { files: ['scripts/account-tests/server.test.ts'], env: LOCAL_API, server: true },
  'backup:server': { files: ['scripts/backup-tests/server.test.ts'], env: LOCAL_API, server: true },
  'credits:server': { files: ['scripts/credits-tests/server/relay-server.test.ts'], env: LOCAL_API, server: true },
};

/** The files a suite runs, relative to the repository root, sorted: its globs expanded, minus its exclusions. */
export function filesOf(suite) {
  const out = new Set();
  for (const pattern of suite.files) for (const f of globSync(pattern, { cwd: ROOT })) out.add(f.split('\\').join('/'));
  for (const f of suite.exclude ?? []) out.delete(f);
  return [...out].sort();
}

/** Every test file under scripts/ (`*.test.ts`, `*.test.mjs`) that no suite runs: a file there runs only through a suite. */
export function unmatchedTests() {
  const run = new Set(Object.values(SUITES).flatMap(filesOf));
  return globSync('scripts/**/*.test.{ts,mjs}', { cwd: ROOT })
    .map((f) => f.split('\\').join('/'))
    .filter((f) => !run.has(f))
    .sort();
}
