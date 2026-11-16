import type { PublicConfig, Tier } from './types';

/**
 * The low-credit hint in the assistant panel (Qutai Credits only): shown once when the balance drops below a few
 * steps' worth on the conversation's tier, and again only after the balance has risen back above it (a purchase, a
 * refund). Pure, for the tests (scripts/credits-tests/lowBalance.test.ts).
 */

/** "A few steps": the hint comes when the balance would pay for fewer reference steps than this. */
export const LOW_BALANCE_STEPS = 5;

/**
 * The threshold in micro-credits: LOW_BALANCE_STEPS × the tier's `approxCreditsPerStep` from `/config`. Null (no
 * hint) without a tier or without that figure (a server without tiers, or one that sends no estimate).
 */
export function lowBalanceThreshold(config: PublicConfig | null, tier: Tier | null): number | null {
  if (!config || !tier) return null;
  const perStep = tier.approxCreditsPerStep;
  if (perStep === null || !Number.isSafeInteger(perStep) || perStep <= 0) return null;
  return perStep * LOW_BALANCE_STEPS;
}

export type LowBalanceState = {
  /** The hint was given for the current drop (shown, then dismissed or followed). */
  warned: boolean;
  /** The hint is on screen. */
  visible: boolean;
};

export const LOW_BALANCE_START: LowBalanceState = { warned: false, visible: false };

/** The next state for a balance (micro-credits) and threshold; unknown values change nothing. */
export function nextLowBalance(state: LowBalanceState, balance: number | null, threshold: number | null): LowBalanceState {
  if (balance === null || threshold === null) return state;
  if (balance >= threshold) return state.warned || state.visible ? LOW_BALANCE_START : state;
  if (state.warned) return state;
  return { warned: true, visible: true };
}

/** The hint was closed, or its "Buy credits" tapped: gone until the next drop. */
export function dismissLowBalance(state: LowBalanceState): LowBalanceState {
  return state.visible ? { ...state, visible: false } : state;
}
