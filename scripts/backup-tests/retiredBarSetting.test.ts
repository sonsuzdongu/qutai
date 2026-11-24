// "Keep the address bar visible" is gone (UI-36: the bar always stays). A backup made before, with the setting on or
// off, restores everything else and the retired setting is ignored.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS } from '../../src/storage/settings.ts';
import { parseBackup, PAYLOAD_VERSION } from '../../src/backup/payload.ts';
import { mergeSettings } from '../../src/backup/backup.ts';

function oldBackup(keepAddressBarVisible: boolean) {
  return JSON.stringify({
    app: 'qutai',
    payloadVersion: PAYLOAD_VERSION,
    createdAt: 1,
    appVersion: '0.1.25',
    schemaVersion: 1,
    settings: { keepAddressBarVisible, addressBarPosition: 'top', autoplaySound: true },
  });
}

test('the setting is no longer part of the settings', () => {
  assert.equal('keepAddressBarVisible' in DEFAULT_SETTINGS, false);
});

test('an old backup with the setting on or off restores the rest and drops it', () => {
  for (const value of [true, false]) {
    const restored = parseBackup(oldBackup(value));
    assert.equal(restored.settings && 'keepAddressBarVisible' in restored.settings, false);
    assert.equal(restored.settings?.addressBarPosition, 'top');
    for (const mode of ['merge', 'replace'] as const) {
      const merged = mergeSettings(DEFAULT_SETTINGS, restored, mode, false);
      assert.equal('keepAddressBarVisible' in merged, false, mode);
      assert.equal(merged.addressBarPosition, 'top', mode);
    }
  }
});
