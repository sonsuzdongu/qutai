// Settings changes are patches on the live settings (DATA-28, 20 Nov 2026 code review): a switch the Settings
// screen sets after Face ID, while the assistant's settings tool changed another one, keeps both; writes never land
// out of order.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, type Settings } from '../../src/storage/settings';
import { SettingsWriter } from '../../src/storage/settingsWriter';
import { tick } from './host';

function setup(saveMs: (n: number) => number = () => 0) {
  let live: Settings = { ...DEFAULT_SETTINGS, appLock: false, blockAds: true };
  const written: Settings[] = [];
  let n = 0;
  const writer = new SettingsWriter(
    () => live,
    (next) => (live = next),
    async (s) => {
      await tick(saveMs(++n));
      written.push(s);
    },
    () => {},
  );
  return { writer, live: () => live, written };
}

test('a change made while a dialog awaited Face ID is kept', async () => {
  const { writer, live, written } = setup();
  // The Settings screen asks for Face ID before turning the app lock on (SettingsModal setLock)…
  const faceId = tick(20).then(() => writer.change({ appLock: true }));
  // …and meanwhile the assistant's settings tool turns ad blocking off.
  await writer.change({ blockAds: false });
  await faceId;
  assert.equal(live().appLock, true);
  assert.equal(live().blockAds, false);
  assert.equal(written.at(-1)!.appLock, true);
  assert.equal(written.at(-1)!.blockAds, false);
});

test('a change that depends on the settings reads them when it lands', async () => {
  const { writer, live } = setup();
  await writer.change({ alwaysAllow: [] as never });
  await Promise.all([
    writer.change((s) => ({ alwaysAllow: [...s.alwaysAllow, 'calendar'] as never })),
    writer.change((s) => ({ alwaysAllow: [...s.alwaysAllow, 'location'] as never })),
  ]);
  assert.deepEqual(live().alwaysAllow, ['calendar', 'location']);
});

test('writes go one after another, the last with the latest settings', async () => {
  // The first write is slow, the second fast: without the queue the older one would land last.
  const { writer, written } = setup((n) => (n === 1 ? 30 : 0));
  const a = writer.change({ haptics: false });
  const b = writer.change({ showCost: true });
  await Promise.all([a, b]);
  assert.equal(written.length, 2);
  assert.equal(written.at(-1)!.haptics, false);
  assert.equal(written.at(-1)!.showCost, true);
});
