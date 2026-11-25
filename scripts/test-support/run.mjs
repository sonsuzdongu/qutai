// The test runner (README.md in this folder).
//
//   node scripts/test-support/run.mjs                 every server-free suite, side by side; one line per suite and
//                                                      a total; exit 1 if any fails (npm test)
//   node scripts/test-support/run.mjs text apps       these suites, the same way
//   node scripts/test-support/run.mjs text --verbose  one suite with node's full output (npm run test:text)
//   node scripts/test-support/run.mjs --coverage      the same with node's coverage; a per-file summary of src/ in
//                                                      node_modules/.cache/qutai-coverage/ (coverage.mjs)
//
// Suites run in separate processes (each has its own loader and module state), up to QUTAI_TEST_JOBS at a time
// (default: half the CPU cores, at most 4, so the machine keeps memory for a simulator or a build).
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { SUITES, filesOf } from './suites.mjs';
import { COVERAGE_DIR, coverageArgs, summarise } from './coverage.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const coverage = args.includes('--coverage');
const names = args.filter((a) => !a.startsWith('--'));
for (const n of names) {
  if (!SUITES[n]) {
    console.error(`No suite "${n}". Suites: ${Object.keys(SUITES).join(', ')}`);
    process.exit(2);
  }
}
const chosen = names.length ? names : Object.keys(SUITES).filter((n) => !SUITES[n].server);
const jobs = Math.max(1, Number(process.env.QUTAI_TEST_JOBS) || Math.min(4, Math.floor(availableParallelism() / 2)));

if (coverage) mkdirSync(join(ROOT, COVERAGE_DIR), { recursive: true });

function command(suite, name) {
  const loader = suite.plain ? [] : ['--no-warnings', '--experimental-transform-types', '--import', suite.loader ?? './scripts/test-support/loader.mjs'];
  const cover = coverage && !suite.plain ? coverageArgs(ROOT, name) : [];
  const files = filesOf(suite);
  // With no files node would look for tests everywhere; a glob that matches nothing is a mistake in suites.mjs.
  if (!files.length) throw new Error(`Suite "${name}" matches no test file (suites.mjs).`);
  return [...loader, '--test', ...cover, ...(suite.forceExit ? ['--test-force-exit'] : []), ...files];
}

function run(name) {
  const suite = SUITES[name];
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, command(suite, name), {
      cwd: ROOT,
      env: { ...process.env, ...(suite.env ?? {}) },
      stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (out += d));
    child.on('close', (code) => {
      const count = (word) => Number(new RegExp(`^ℹ ${word} (\\d+)`, 'm').exec(out)?.[1] ?? 0);
      resolve({ name, ok: code === 0, pass: count('pass'), fail: count('fail'), ms: Date.now() - started, out });
    });
  });
}

if (verbose && chosen.length === 1) {
  const r = await run(chosen[0]);
  if (coverage) summarise(ROOT, chosen);
  process.exit(r.ok ? 0 : 1);
}

const started = Date.now();
const queue = [...chosen];
const results = [];
await Promise.all(
  Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length) {
      const r = await run(queue.shift());
      results.push(r);
      const time = `${(r.ms / 1000).toFixed(1)} s`;
      console.log(`${r.ok ? '✔' : '✖'} ${r.name.padEnd(16)} ${String(r.pass).padStart(4)} passed${r.fail ? `, ${r.fail} failed` : ''}  (${time})`);
    }
  }),
);
const failed = results.filter((r) => !r.ok);
for (const r of failed) {
  // The failing tests and their messages: node's summary at the end of its output.
  const at = r.out.indexOf('✖ failing tests:');
  console.log(`\n── ${r.name} ──\n${(at >= 0 ? r.out.slice(at) : r.out.slice(-4000)).trim()}`);
}
const pass = results.reduce((a, r) => a + r.pass, 0);
const fail = results.reduce((a, r) => a + r.fail, 0);
console.log(
  `\n${failed.length ? '✖' : '✔'} ${results.length - failed.length}/${results.length} suites, ${pass} tests passed${fail ? `, ${fail} failed` : ''} in ${((Date.now() - started) / 1000).toFixed(1)} s (${jobs} at a time)`,
);
if (coverage) {
  const summary = summarise(ROOT, chosen);
  console.log('\n' + summary.slice(0, summary.indexOf('\nEvery file')).trim());
  console.log(`\nEvery file: ${join(COVERAGE_DIR, 'summary.txt')}; merged lcov: ${join(COVERAGE_DIR, 'merged.lcov')}`);
}
process.exit(failed.length ? 1 : 0);
