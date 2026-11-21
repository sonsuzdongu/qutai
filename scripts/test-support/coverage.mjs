// Coverage of the app suites (README.md in this folder): `npm run test:coverage` runs the suites with node's own
// --experimental-test-coverage, each writing an lcov file, then merges them here into one per-file summary of
// src/. Output goes to node_modules/.cache/qutai-coverage/ (never committed): one lcov file per suite,
// merged.lcov and summary.txt. Files no suite loads are listed at 0 %; .tsx files are stand-ins in the tests, so
// they are left out.
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const COVERAGE_DIR = join('node_modules', '.cache', 'qutai-coverage');

/** Node's arguments for one suite: lcov to its own file, the usual spec output to stdout (the runner counts it). */
export function coverageArgs(root, name) {
  return [
    '--experimental-test-coverage',
    '--test-coverage-include=src/**',
    // a backup test writes and removes a temporary file under src/ (its coverage could not be reported)
    '--test-coverage-exclude=**/*.tmp.ts',
    '--test-reporter=spec',
    '--test-reporter-destination=stdout',
    '--test-reporter=lcov',
    `--test-reporter-destination=${join(root, COVERAGE_DIR, name.replace(/[^\w-]/g, '_') + '.lcov')}`,
  ];
}

/** lcov text → Map(file → Map(line → hits)). */
export function parseLcov(text) {
  const files = new Map();
  let lines = null;
  for (const raw of text.split('\n')) {
    const row = raw.trim();
    if (row.startsWith('SF:')) {
      const file = row.slice(3);
      lines = files.get(file) ?? new Map();
      files.set(file, lines);
    } else if (row.startsWith('DA:') && lines) {
      const [line, hits] = row.slice(3).split(',').map(Number);
      lines.set(line, Math.max(lines.get(line) ?? 0, hits));
    } else if (row === 'end_of_record') lines = null;
  }
  return files;
}

/** Merges several parsed lcov maps: a line is covered when any suite ran it. */
export function mergeCoverage(maps) {
  const out = new Map();
  for (const files of maps) {
    for (const [file, lines] of files) {
      const into = out.get(file) ?? new Map();
      for (const [line, hits] of lines) into.set(line, (into.get(line) ?? 0) + hits);
      out.set(file, into);
    }
  }
  return out;
}

function sourceFiles(root, dir = 'src') {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) out.push(...sourceFiles(root, rel));
    else if (/\.ts$/.test(name) && !name.endsWith('.d.ts')) out.push(rel);
  }
  return out;
}

function lineCount(root, file) {
  try {
    return readFileSync(join(root, file), 'utf8').split('\n').length;
  } catch {
    return 0;
  }
}

/** Reads every suite's lcov, writes merged.lcov and summary.txt, returns the summary text. */
export function summarise(root, suiteNames) {
  const dir = join(root, COVERAGE_DIR);
  const maps = [];
  for (const name of suiteNames) {
    try {
      maps.push(parseLcov(readFileSync(join(dir, name.replace(/[^\w-]/g, '_') + '.lcov'), 'utf8')));
    } catch {}
  }
  const merged = mergeCoverage(maps);
  const rows = [];
  for (const file of sourceFiles(root)) {
    const lines = merged.get(file) ?? merged.get(join(root, file)) ?? merged.get(relative(root, join(root, file)));
    const size = lineCount(root, file);
    if (!lines) {
      rows.push({ file, size, total: size, hit: 0, pct: 0, loaded: false });
      continue;
    }
    const total = lines.size;
    const hit = [...lines.values()].filter((h) => h > 0).length;
    rows.push({ file, size, total, hit, pct: total ? (100 * hit) / total : 100, loaded: true });
  }
  let lcov = '';
  for (const [file, lines] of merged) {
    lcov += `SF:${file}\n`;
    for (const [line, hits] of [...lines].sort((a, b) => a[0] - b[0])) lcov += `DA:${line},${hits}\n`;
    lcov += `LF:${lines.size}\nLH:${[...lines.values()].filter((h) => h > 0).length}\nend_of_record\n`;
  }
  writeFileSync(join(dir, 'merged.lcov'), lcov);

  const loaded = rows.filter((r) => r.loaded);
  const allHit = loaded.reduce((a, r) => a + r.hit, 0);
  const allLines = loaded.reduce((a, r) => a + r.total, 0);
  const srcLines = rows.reduce((a, r) => a + r.size, 0);
  const pad = (s, n) => String(s).padEnd(n);
  const fmt = (r) => `${pad(r.pct.toFixed(1).padStart(5) + ' %', 9)}${String(r.size).padStart(6)}  ${r.file}`;
  const text = [
    `Coverage of src/**/*.ts by the suites: ${suiteNames.join(', ')}`,
    `Loaded files: ${loaded.length} of ${rows.length}; lines run in loaded files: ${allHit} of ${allLines} (${((100 * allHit) / Math.max(1, allLines)).toFixed(1)} %)`,
    `Lines of src/**/*.ts in all: ${srcLines}; in files no suite loads: ${rows.filter((r) => !r.loaded).reduce((a, r) => a + r.size, 0)}`,
    '',
    'Largest files under 60 % (lines %, file length, file):',
    ...rows.filter((r) => r.pct < 60 && r.size >= 150).sort((a, b) => b.size - a.size).slice(0, 40).map(fmt),
    '',
    'Every file (by path):',
    ...rows.sort((a, b) => a.file.localeCompare(b.file)).map((r) => fmt(r) + (r.loaded ? '' : '  (not loaded)')),
  ].join('\n');
  writeFileSync(join(dir, 'summary.txt'), text + '\n');
  return text;
}
