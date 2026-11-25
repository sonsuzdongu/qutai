// The suite table itself (suites.mjs, HOUSE-21): every test file under scripts/ is run by a suite, and every suite's
// globs match at least one file. A suite that listed its files one by one once left two backup tests unrun.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SUITES, filesOf, unmatchedTests } from './suites.mjs';

test('every test file under scripts/ belongs to a suite', () => {
  assert.deepEqual(unmatchedTests(), [], 'add these to a suite in scripts/test-support/suites.mjs');
});

test('every suite runs at least one file, and every exclusion names a file its globs match', () => {
  for (const [name, suite] of Object.entries(SUITES)) {
    assert.ok(filesOf(suite).length > 0, `suite "${name}" matches no file`);
    for (const f of suite.exclude ?? []) {
      const all = filesOf({ files: suite.files });
      assert.ok(all.includes(f), `suite "${name}" excludes ${f}, which its globs don't match`);
    }
  }
});

test('server suites stay out of npm test, and their files run in no other suite', () => {
  const local = Object.values(SUITES).filter((s) => !s.server).flatMap(filesOf);
  for (const [name, suite] of Object.entries(SUITES)) {
    if (!suite.server) continue;
    for (const f of filesOf(suite)) assert.ok(!local.includes(f), `${f} (suite "${name}") also runs in npm test`);
  }
});
