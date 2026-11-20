// Every check before a commit or a build (scripts/test-support/README.md): the app's typecheck, lint, the agent
// profile check and every server-free test suite, then the server's (backend/) typecheck, lint and tests. One after
// the other: the server's tests start many workers, and one app test writes a temporary file under src/ that the
// typecheck would read. Prints one line per step and exits 1 if any failed, with the end of its output.
//
//   npm run check:all            everything
//   npm run check:all -- --app   the app only (no backend/)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = join(ROOT, 'backend');
const appOnly = process.argv.includes('--app');

const STEPS = [
  { name: 'app typecheck', cmd: 'npx', args: ['tsc', '--noEmit'], cwd: ROOT },
  { name: 'app lint', cmd: 'npx', args: ['expo', 'lint'], cwd: ROOT },
  { name: 'agent profile', cmd: 'npm', args: ['run', '-s', 'profile:check'], cwd: ROOT },
  { name: 'app tests', cmd: 'npm', args: ['test', '-s'], cwd: ROOT },
  ...(appOnly || !existsSync(join(BACKEND, 'package.json'))
    ? []
    : [
        { name: 'server typecheck', cmd: 'npm', args: ['run', '-s', 'typecheck'], cwd: BACKEND },
        { name: 'server lint', cmd: 'npm', args: ['run', '-s', 'lint'], cwd: BACKEND },
        { name: 'server tests', cmd: 'npm', args: ['test', '-s'], cwd: BACKEND },
      ]),
];

function run(step) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(step.cmd, step.args, { cwd: step.cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ ...step, ok: code === 0, ms: Date.now() - started, out }));
  });
}

/** A short detail for the line: the test total, the profile id, lint's problem count. */
function detail(r) {
  const total = /✔ (\d+\/\d+ suites, \d+ tests passed)/.exec(r.out)?.[1];
  if (total) return total;
  const tests = /Tests\s+(\d+ passed[^\n]*)/.exec(r.out)?.[1];
  if (tests) return tests.trim();
  if (r.name === 'agent profile') return r.out.trim().slice(0, 12) + '…';
  const problems = /✖ (\d+ problems?[^\n]*)/.exec(r.out)?.[1];
  return problems ?? '';
}

const started = Date.now();
const results = [];
for (const step of STEPS) {
  const r = await run(step);
  results.push(r);
  console.log(`${r.ok ? '✔' : '✖'} ${r.name.padEnd(17)} ${(r.ms / 1000).toFixed(1).padStart(5)} s  ${detail(r)}`);
}
const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log(`\n── ${r.name} ──\n${r.out.trim().split('\n').slice(-40).join('\n')}`);
console.log(`\n${failed.length ? '✖' : '✔'} ${results.length - failed.length}/${results.length} checks passed in ${((Date.now() - started) / 1000).toFixed(0)} s`);
process.exit(failed.length ? 1 : 0);
