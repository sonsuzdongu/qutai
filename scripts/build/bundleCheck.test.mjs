// node --test scripts/build/bundleCheck.test.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { BILLING_PERMISSION, FAKE_PURCHASE_MARKS, REVENUECAT_MARK, bundleProblems, hostOf, manifestProblems } from './bundleCheck.mjs';

const SECRET = 'test-sign-in-secret-0123456789abcdef0123';
const HOST = 'api.example.test';

/** A fabricated bundle file, written and read back as the release script reads one. */
function bundle(text) {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
  try {
    writeFileSync(join(dir, 'index.android.bundle'), text);
    return readFileSync(join(dir, 'index.android.bundle'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const clean = 'var e={EXPO_PUBLIC_PRO_MODE:"on"};function f(){return"https://api.example.test/config"}';

test('a pro bundle with the server address and no test sign-in passes', () => {
  assert.deepEqual(bundleProblems(bundle(clean), { pro: true, apiHost: HOST, secrets: [{ name: 'EXPO_PUBLIC_DEV_LOGIN_SECRET', value: SECRET }] }), []);
});

test('a pro bundle without the server address fails', () => {
  assert.equal(bundleProblems(bundle('var x=1'), { pro: true, apiHost: HOST }).length, 1);
});

test('the test sign-in secret fails the build, without printing it', () => {
  const problems = bundleProblems(bundle(`${clean};var s="${SECRET}"`), { pro: true, apiHost: HOST, secrets: [{ name: 'EXPO_PUBLIC_DEV_LOGIN_SECRET', value: SECRET }] });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /EXPO_PUBLIC_DEV_LOGIN_SECRET/);
  assert.ok(!problems[0].includes(SECRET));
});

test('a reference to the test sign-in flag left for runtime fails', () => {
  const problems = bundleProblems(bundle(`${clean};var d=process.env.EXPO_PUBLIC_DEV_LOGIN`), { pro: true, apiHost: HOST });
  assert.deepEqual(problems, ['the bundle still refers to EXPO_PUBLIC_DEV_LOGIN (not replaced at build time)']);
});

test('a plain bundle with any known server address fails; without one it passes', () => {
  assert.equal(bundleProblems(bundle(clean), { pro: false, apiHost: null, serverHosts: [HOST, 'tunnel.example.test'] }).length, 1);
  assert.deepEqual(bundleProblems(bundle('var plain=1'), { pro: false, apiHost: null, serverHosts: [HOST] }), []);
});

test('short or empty secret values are not searched (no chance matches)', () => {
  assert.deepEqual(bundleProblems(bundle('var on="on"'), { pro: false, apiHost: null, secrets: [{ name: 'X', value: 'on' }, { name: 'Y', value: '' }] }), []);
});

test('hostOf', () => {
  assert.equal(hostOf('https://api.example.test/x'), HOST);
  assert.equal(hostOf(''), null);
  assert.equal(hostOf('not a url'), null);
});

test('RevenueCat’s SDK: never in a plain bundle; required in a pro build that sells credits', () => {
  const withSdk = bundle(`${clean};console.warn("${REVENUECAT_MARK} Native module (RNPurchases) not found")`);
  assert.deepEqual(bundleProblems(withSdk, { pro: true, apiHost: HOST, purchases: true }), []);
  assert.equal(bundleProblems(bundle(clean), { pro: true, apiHost: HOST, purchases: true }).length, 1);
  assert.deepEqual(bundleProblems(bundle(clean), { pro: true, apiHost: HOST, purchases: false }), []);
  const plain = bundle(`var x=1;console.warn("${REVENUECAT_MARK}")`);
  assert.match(bundleProblems(plain, { pro: false, apiHost: null }).join(), /RevenueCat/);
});

test('the removed fake purchases fail every bundle, pro or plain', () => {
  for (const [text, mark] of [
    ['t("buy.testMode.notice")', 'buy.testMode.'],
    ['{"buy.status.testModeOff":"Test purchases are switched off"}', 'buy.status.testModeOff'],
    ['fetch(base+"/purchases/fake")', '/purchases/fake'],
  ]) {
    assert.ok(FAKE_PURCHASE_MARKS.includes(mark));
    assert.match(bundleProblems(bundle(`${clean};${text}`), { pro: true, apiHost: HOST }).join(), /removed fake purchases/);
    assert.match(bundleProblems(bundle(`var x=1;${text}`), { pro: false, apiHost: null }).join(), /removed fake purchases/);
  }
  assert.deepEqual(bundleProblems(bundle(`${clean};fetch(base+"/purchases/verify")`), { pro: true, apiHost: HOST }), []);
});

test('the Play Billing permission: never in a plain bundle; required when selling credits', () => {
  const withBilling = Buffer.concat([Buffer.from([0x0a, 0x1c]), Buffer.from(BILLING_PERMISSION), Buffer.from([0x12])]);
  const without = Buffer.from([0x0a, 0x10, 0x61, 0x6e, 0x64, 0x72, 0x6f, 0x69, 0x64]);
  assert.equal(manifestProblems(withBilling, { pro: false, purchases: false }).length, 1);
  assert.deepEqual(manifestProblems(without, { pro: false, purchases: false }), []);
  assert.deepEqual(manifestProblems(withBilling, { pro: true, purchases: true }), []);
  assert.equal(manifestProblems(without, { pro: true, purchases: true }).length, 1);
  assert.deepEqual(manifestProblems(without, { pro: true, purchases: false }), []);
});
