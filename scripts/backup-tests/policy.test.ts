// Every setting is deliberately in or out of the backup (DATA-3, DATA-5): BACKUP_POLICY in src/backup/backup.ts names
// each key of Settings (tsc refuses a new one without a decision); here, what the backup actually writes, reads back
// and restores is checked against it, so a setting added to the policy but forgotten in backupSettings, parseSettings
// (BOOLEAN_SETTINGS) or mergeSettings fails.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, type Settings } from '../../src/storage/settings.ts';
import { BOOLEAN_SETTINGS, parseBackup, serializeBackup, PAYLOAD_VERSION, type BackupPayload } from '../../src/backup/payload.ts';
import { BACKUP_POLICY, backupSettings, mergeSettings } from '../../src/backup/backup.ts';

const keys = Object.keys(BACKUP_POLICY) as (keyof Settings)[];
const withPolicy = (p: string) => keys.filter((k) => BACKUP_POLICY[k] === p).sort();

/** Every setting with a value that differs from the default: booleans flipped, the others given by hand. */
const OTHER: Partial<Settings> = {
  provider: 'openai',
  models: { ...DEFAULT_SETTINGS.models, anthropic: 'claude-test-model' },
  customBaseUrl: 'https://llm.example.test/v1',
  searchEngine: 'duckduckgo',
  textZoom: 130,
  customInstructions: 'Answer briefly.',
  theme: 'dark',
  addressBarPosition: DEFAULT_SETTINGS.addressBarPosition === 'top' ? 'bottom' : 'top',
  readerTheme: 'sepia',
  readerFont: 'sans',
  apiKeys: { ...DEFAULT_SETTINGS.apiKeys, anthropic: 'sk-test-key' },
  customHeaders: [{ name: 'X-Test', value: 'token' }],
  voiceLanguage: 'tr',
  voiceLastLanguage: 'tr-TR',
  voiceOnline: 'allow' as Settings['voiceOnline'],
  legalAcceptedVersion: 7,
};
const changed = Object.fromEntries(
  keys.map((k) => {
    const d = DEFAULT_SETTINGS[k];
    return [k, typeof d === 'boolean' ? !d : k in OTHER ? OTHER[k] : d];
  }),
) as Settings;

function restore(from: Settings, onto: Settings, mode: 'merge' | 'replace'): Settings {
  const payload: BackupPayload = {
    app: 'qutai',
    payloadVersion: PAYLOAD_VERSION,
    createdAt: 1,
    appVersion: '0.1.28',
    schemaVersion: 1,
    settings: backupSettings(from),
  };
  return mergeSettings(onto, parseBackup(serializeBackup(payload)), mode, false);
}

test('the policy names every setting, and only these three places', () => {
  assert.deepEqual(keys.sort(), (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).sort());
  for (const k of keys) assert.ok(['backup', 'keys', 'phone'].includes(BACKUP_POLICY[k]), k);
});

test('the backup writes exactly the settings the policy sends', () => {
  const written = Object.keys(backupSettings(changed)).filter((k) => k !== 'retiredInstructionsRemoved');
  assert.deepEqual(written.sort(), withPolicy('backup'));
});

test('the booleans the backup reads back are exactly the backed-up booleans', () => {
  const booleans = withPolicy('backup').filter((k) => typeof DEFAULT_SETTINGS[k] === 'boolean');
  assert.deepEqual([...BOOLEAN_SETTINGS].sort(), booleans);
});

test('a replace restores every backed-up setting and touches no other', () => {
  const restored = restore(changed, DEFAULT_SETTINGS, 'replace');
  for (const k of keys) {
    const want = BACKUP_POLICY[k] === 'backup' ? changed[k] : DEFAULT_SETTINGS[k];
    assert.deepEqual(restored[k], want, `${k} (${BACKUP_POLICY[k]})`);
  }
});

test('the other way round: a backup of the defaults replaces every backed-up setting and keeps the phone ones', () => {
  const restored = restore(DEFAULT_SETTINGS, changed, 'replace');
  for (const k of keys) {
    // customBaseUrl is written only when set, so an empty one in the backup leaves this phone's address.
    const want = BACKUP_POLICY[k] === 'backup' && k !== 'customBaseUrl' ? DEFAULT_SETTINGS[k] : changed[k];
    assert.deepEqual(restored[k], want, `${k} (${BACKUP_POLICY[k]})`);
  }
});

test('the keys travel only with the keys', () => {
  const p: BackupPayload = {
    app: 'qutai',
    payloadVersion: PAYLOAD_VERSION,
    createdAt: 1,
    appVersion: '0.1.28',
    schemaVersion: 1,
    apiKeys: { anthropic: 'sk-test-key' },
    customHeaders: [{ name: 'X-Test', value: 'token' }],
  };
  const read = parseBackup(serializeBackup(p));
  for (const k of withPolicy('keys')) {
    assert.deepEqual(mergeSettings(DEFAULT_SETTINGS, read, 'replace', false)[k], DEFAULT_SETTINGS[k], `${k} without keys`);
    assert.notDeepEqual(mergeSettings(DEFAULT_SETTINGS, read, 'replace', true)[k], DEFAULT_SETTINGS[k], `${k} with keys`);
  }
});
