// "Let sites play videos with sound automatically" (settings.autoplaySound): off by default, carried by a backup and
// restored like the other media settings.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS } from '../../src/storage/settings.ts';
import { parseBackup, serializeBackup, PAYLOAD_VERSION, type BackupPayload } from '../../src/backup/payload.ts';
import { mergeSettings } from '../../src/backup/backup.ts';

test('off by default', () => {
  assert.equal(DEFAULT_SETTINGS.autoplaySound, false);
});

function payload(autoplaySound: unknown): BackupPayload {
  return {
    app: 'qutai',
    payloadVersion: PAYLOAD_VERSION,
    createdAt: 1,
    appVersion: '0.1.25',
    schemaVersion: 1,
    settings: { autoplaySound } as BackupPayload['settings'],
  };
}

test('a backup keeps the setting, and drops a value that is not a boolean', () => {
  assert.equal(parseBackup(serializeBackup(payload(true))).settings?.autoplaySound, true);
  assert.equal(parseBackup(serializeBackup(payload('yes'))).settings?.autoplaySound, undefined);
});

test('restoring: merge takes it only where this phone has the default; replace always', () => {
  const restored = parseBackup(serializeBackup(payload(true)));
  assert.equal(mergeSettings(DEFAULT_SETTINGS, restored, 'merge', false).autoplaySound, true);
  const off = parseBackup(serializeBackup(payload(false)));
  assert.equal(mergeSettings({ ...DEFAULT_SETTINGS, autoplaySound: true }, off, 'merge', false).autoplaySound, true);
  assert.equal(mergeSettings({ ...DEFAULT_SETTINGS, autoplaySound: true }, off, 'replace', false).autoplaySound, false);
});
