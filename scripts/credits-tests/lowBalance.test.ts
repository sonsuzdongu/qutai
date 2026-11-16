// The low-credit hint in the assistant panel (src/credits/lowBalance.ts): the threshold comes from /config (a few
// reference steps on the conversation's tier), the hint shows once per drop below it and comes back only after the
// balance has risen above it again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dismissLowBalance,
  LOW_BALANCE_START,
  LOW_BALANCE_STEPS,
  lowBalanceThreshold,
  nextLowBalance,
} from '../../src/credits/lowBalance.ts';
import type { PublicConfig, Tier } from '../../src/credits/types.ts';
import { CONFIG } from './fake.ts';

const tier = (approxCreditsPerStep: number | null): Tier => ({
  id: 'standard',
  order: 0,
  default: true,
  format: 'anthropic',
  maxOutputTokens: 16000,
  webSearch: true,
  limits: { ...CONFIG.limits },
  approxCreditsPerStep,
  prices: [],
  servedBy: null,
});
const config = (t: Tier): PublicConfig => ({ ...CONFIG, tiers: [t] });

test('threshold: a few steps of the tier, from /config', () => {
  const standard = tier(420_000);
  assert.equal(lowBalanceThreshold(config(standard), standard), 420_000 * LOW_BALANCE_STEPS);
  assert.equal(LOW_BALANCE_STEPS, 5);
});

test('no threshold, so no hint, without a tier or its estimate', () => {
  assert.equal(lowBalanceThreshold(null, tier(420_000)), null);
  assert.equal(lowBalanceThreshold(CONFIG, null), null);
  assert.equal(lowBalanceThreshold(config(tier(null)), tier(null)), null);
  assert.equal(lowBalanceThreshold(config(tier(0)), tier(0)), null);
});

test('shown once when the balance drops below it, not again while it stays low', () => {
  const threshold = 2_100_000;
  let s = nextLowBalance(LOW_BALANCE_START, 5_000_000, threshold);
  assert.deepEqual(s, LOW_BALANCE_START);
  s = nextLowBalance(s, 2_000_000, threshold);
  assert.deepEqual(s, { warned: true, visible: true });
  s = dismissLowBalance(s);
  assert.deepEqual(s, { warned: true, visible: false });
  s = nextLowBalance(s, 1_000_000, threshold);
  s = nextLowBalance(s, 0, threshold);
  assert.equal(s.visible, false);
});

test('rising back above it (a purchase) resets; the next drop shows it again', () => {
  const threshold = 2_100_000;
  let s = dismissLowBalance(nextLowBalance(LOW_BALANCE_START, 1_000_000, threshold));
  s = nextLowBalance(s, 10_000_000, threshold);
  assert.deepEqual(s, LOW_BALANCE_START);
  s = nextLowBalance(s, 2_099_999, threshold);
  assert.deepEqual(s, { warned: true, visible: true });
  // Rising above while still on screen hides it.
  assert.deepEqual(nextLowBalance(s, 2_100_000, threshold), LOW_BALANCE_START);
});

test('an unknown balance or threshold changes nothing', () => {
  const shown = { warned: true, visible: true };
  assert.equal(nextLowBalance(shown, null, 2_100_000), shown);
  assert.equal(nextLowBalance(shown, 1, null), shown);
  assert.equal(nextLowBalance(LOW_BALANCE_START, null, null), LOW_BALANCE_START);
});
