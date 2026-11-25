// Ten settings that used to stay on the phone travel in backups since 25 Nov 2026 (owner; DATA-5): "Don't ask again",
// per-site script settings, background tasks and their notification, Gemini streaming, the cost, the action marker,
// voice input's languages and whether the custom endpoint's model takes images. Restored values are checked like the
// settings loader checks them; a backup made before leaves this phone's values.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, type Settings } from '../../src/storage/settings.ts';
import { parseBackup, serializeBackup, PAYLOAD_VERSION, type BackupPayload } from '../../src/backup/payload.ts';
import { backupSettings, mergeSettings } from '../../src/backup/backup.ts';

const ADDED = ['alwaysAllow', 'scriptSites', 'backgroundTasks', 'notifyTaskDone', 'geminiStreaming', 'showCost', 'showActionMarker', 'voiceLanguage', 'voiceLastLanguage', 'customImages'] as const;

const backedUp: Settings = {
  ...DEFAULT_SETTINGS,
  alwaysAllow: ['calendarRead', 'download'],
  scriptSites: [{ host: 'shop.example', setting: 'sensitive' }],
  backgroundTasks: true,
  notifyTaskDone: false,
  geminiStreaming: true,
  showCost: false,
  showActionMarker: false,
  voiceLanguage: 'tr',
  voiceLastLanguage: 'en-GB',
  customImages: !DEFAULT_SETTINGS.customImages,
};
const phone: Settings = {
  ...DEFAULT_SETTINGS,
  alwaysAllow: ['notification'],
  scriptSites: [{ host: 'news.example', setting: 'off' }],
  voiceLanguage: 'de',
  voiceLastLanguage: 'de-DE',
};

function payload(settings: unknown): BackupPayload {
  return { app: 'qutai', payloadVersion: PAYLOAD_VERSION, createdAt: 1, appVersion: '0.1.28', schemaVersion: 1, settings } as BackupPayload;
}
const roundTrip = (settings: unknown) => parseBackup(serializeBackup(payload(settings)));

test('a backup carries the nine settings and a replace restores them', () => {
  const restored = mergeSettings(phone, roundTrip(backupSettings(backedUp)), 'replace', false);
  for (const k of ADDED) assert.deepEqual(restored[k], backedUp[k], k);
});

test('a backup made before them leaves this phone’s values, in both modes', () => {
  const old = backupSettings(backedUp) as Record<string, unknown>;
  for (const k of ADDED) delete old[k];
  for (const mode of ['merge', 'replace'] as const) {
    const restored = mergeSettings(phone, roundTrip(old), mode, false);
    for (const k of ADDED) assert.deepEqual(restored[k], phone[k], `${k} (${mode})`);
  }
});

test('merge: a list comes from the backup only where this phone has none; switches only where they are the default', () => {
  const read = roundTrip(backupSettings(backedUp));
  const onPhone = mergeSettings(phone, read, 'merge', false);
  assert.deepEqual(onPhone.alwaysAllow, ['notification']);
  assert.deepEqual(onPhone.scriptSites, [{ host: 'news.example', setting: 'off' }]);
  assert.equal(onPhone.voiceLanguage, 'de');
  const fresh = mergeSettings(DEFAULT_SETTINGS, read, 'merge', false);
  for (const k of ADDED) assert.deepEqual(fresh[k], backedUp[k], k);
});

test('restored values are checked: unknown kinds, bad hosts and settings, and bad language tags are dropped', () => {
  const read = roundTrip({
    alwaysAllow: ['notification', 'clicks', 'purchase', 42, 'notification', 'location'],
    scriptSites: [
      { host: 'WWW.Good.Example', setting: 'off' },
      { host: 'bad host', setting: 'off' },
      { host: 'a/b', setting: 'sensitive' },
      { host: 'ok.example', setting: 'always' },
      'nope',
    ],
    backgroundTasks: 'yes',
    showCost: 0,
    customImages: 'true',
    voiceLanguage: 'not a tag!',
    voiceLastLanguage: 'x',
  }).settings!;
  assert.deepEqual(read.alwaysAllow, ['notification', 'location']);
  assert.deepEqual(read.scriptSites, [{ host: 'good.example', setting: 'off' }]);
  assert.equal(read.backgroundTasks, undefined);
  assert.equal(read.showCost, undefined);
  assert.equal(read.customImages, undefined);
  assert.equal(read.voiceLanguage, undefined);
  assert.equal(read.voiceLastLanguage, undefined);
  assert.equal(roundTrip({ voiceLanguage: 'auto', voiceLastLanguage: '' }).settings!.voiceLanguage, 'auto');
  assert.equal(roundTrip({ alwaysAllow: 'notification' }).settings!.alwaysAllow, undefined);
});
