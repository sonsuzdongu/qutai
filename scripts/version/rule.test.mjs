import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNumber, currentBuild, nextVersion, plan } from './rule.mjs';

test('nextVersion raises the last part', () => {
  assert.equal(nextVersion('0.1.6'), '0.1.7');
  assert.equal(nextVersion('0.1.47'), '0.1.48');
  assert.equal(nextVersion('0.1.99'), '0.1.100');
  assert.equal(nextVersion('1.2'), '1.3');
  assert.equal(nextVersion(' 0.1.0 '), '0.1.1');
});

test('nextVersion refuses anything that is not dotted numbers', () => {
  for (const bad of ['0.1.x', '1.0.0-beta', '', '1..2', '-1.0.0', '1.0.0 beta', undefined]) assert.equal(nextVersion(bad), null);
});

test('buildNumber is major*10000 + minor*100 + patch', () => {
  assert.equal(buildNumber('0.1.0'), 100);
  assert.equal(buildNumber('0.1.7'), 107);
  assert.equal(buildNumber('0.2.0'), 200);
  assert.equal(buildNumber('1.0.0'), 10000);
  assert.equal(buildNumber('1.2'), 10200);
  assert.equal(buildNumber('2'), 20000);
  assert.equal(buildNumber('12.34.56'), 123456);
});

test('buildNumber refuses what would collide or go backwards', () => {
  assert.equal(buildNumber('0.1.100'), null);
  assert.equal(buildNumber('0.100.0'), null);
  assert.equal(buildNumber('1.2.3.4'), null);
  assert.equal(buildNumber('1.0.x'), null);
});

test('build numbers grow with the version (the old rule went 0.1.16 → 116, 0.2.0 → 20)', () => {
  const order = ['0.1.0', '0.1.16', '0.1.99', '0.2.0', '0.99.99', '1.0.0', '1.0.1', '1.1.0'];
  const builds = order.map(buildNumber);
  for (let i = 1; i < builds.length; i++) assert.ok(builds[i] > builds[i - 1], `${order[i]} must be above ${order[i - 1]}`);
});

test('currentBuild is the larger of the two stores', () => {
  assert.equal(currentBuild(107, '107'), 107);
  assert.equal(currentBuild(107, '110'), 110);
  assert.equal(currentBuild(undefined, '5'), 5);
  assert.equal(currentBuild(3, 'abc'), 3);
});

test('plan: a patch bump', () => {
  assert.deepEqual(plan({ version: '0.1.0', androidVersionCode: 100, iosBuildNumber: '100' }), {
    ok: true,
    from: '0.1.0',
    to: '0.1.1',
    fromBuild: 100,
    toBuild: 101,
  });
});

test('plan: an explicit version', () => {
  const p = plan({ version: '0.1.42', androidVersionCode: 142, iosBuildNumber: '142', to: '0.2.0' });
  assert.equal(p.ok, true);
  assert.equal(p.toBuild, 200);
  assert.equal(p.warning, undefined);
});

test('plan: warns, without refusing, when the build would not grow', () => {
  const p = plan({ version: '1.0.0', androidVersionCode: 10000, iosBuildNumber: '10000', to: '0.1.0' });
  assert.equal(p.ok, true);
  assert.equal(p.toBuild, 100);
  assert.match(p.warning, /not larger/);
});

test('plan: stops when the patch runs out, and names the way out', () => {
  const p = plan({ version: '0.1.99', androidVersionCode: 199, iosBuildNumber: '199' });
  assert.equal(p.ok, false);
  assert.match(p.error, /Raise the minor by hand/);
});

test('plan: stops on a version that is not dotted numbers', () => {
  assert.equal(plan({ version: '1.0.0-beta', androidVersionCode: 1, iosBuildNumber: '1' }).ok, false);
  assert.equal(plan({ version: '0.1.0', androidVersionCode: 100, iosBuildNumber: '100', to: 'next' }).ok, false);
});
