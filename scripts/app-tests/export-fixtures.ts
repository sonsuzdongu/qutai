// Writes .qutaiapp files for phone checks (docs/test-checklist.md › Apps phase 2): the notes app with two notes, the
// break-out app (its leaks go to the fake AI server's /leak recorder, port 8793 unless given), and broken files for the
// error screens. Run: node --no-warnings --experimental-transform-types --import ./scripts/test-support/loader.mjs \
//   scripts/app-tests/export-fixtures.ts <out dir> [port]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAppFile, type AppData } from '../../src/apps/appFile.ts';
import { PACKAGE_FORMAT, type AppManifest } from '../../src/apps/manifest.ts';
import { breakoutFiles } from './breakoutApp.mjs';
import { notesFiles } from './notesApp.mjs';

const out = process.argv[2];
const port = Number(process.argv[3] ?? 8793);
if (!out) throw new Error('usage: export-fixtures.ts <out dir> [port]');
mkdirSync(out, { recursive: true });

const at = '2026-11-19T10:00:00.000Z';
const manifest = (id: string, name: string, icon: AppManifest['icon'], description: string): AppManifest => ({
  format: PACKAGE_FORMAT,
  formatVersion: 1,
  id,
  name,
  description,
  icon,
  version: 3,
  contract: 1,
  permissions: [],
  entry: 'index.html',
  language: 'en',
  createdAt: at,
  updatedAt: at,
  author: { kind: 'local' },
});

const notes = { manifest: manifest('app-fixturenotes', 'Shared notes', { name: 'notes', color: '#2e7d32' }, 'Notes from a friend'), files: notesFiles() };
const data: AppData = {
  kv: [],
  docs: [
    { collection: 'notes', doc: { id: 'n1', createdAt: 1763546400000, updatedAt: 1763546400000, title: 'Shopping', body: 'milk, bread' } },
    { collection: 'notes', doc: { id: 'n2', createdAt: 1763546500000, updatedAt: 1763546500000, title: 'İstanbul trip', body: 'tickets 🚆' } },
  ],
};
const write = (name: string, text: string) => {
  writeFileSync(join(out, name), text);
  console.log(join(out, name));
};
write('Shared notes (with data).qutaiapp', buildAppFile({ pkg: notes, data, exportedAt: at, exportedBy: 'Qutai fixture' }));
write('Shared notes.qutaiapp', buildAppFile({ pkg: notes, exportedAt: at, exportedBy: 'Qutai fixture' }));
const breakout = { manifest: manifest('app-fixturebreak', 'Break-out test', { name: 'tool', color: '#c62828' }, 'Every line should say PASS.'), files: breakoutFiles(port) };
write('Break-out test.qutaiapp', buildAppFile({ pkg: breakout, exportedAt: at, exportedBy: 'Qutai fixture' }));
const tampered = JSON.parse(buildAppFile({ pkg: notes, exportedAt: at, exportedBy: 'Qutai fixture' }));
tampered.package.files['app.js'] += '\n// changed';
write('Tampered.qutaiapp', JSON.stringify(tampered));
write('Newer.qutaiapp', JSON.stringify({ ...tampered, fileVersion: 9 }));
