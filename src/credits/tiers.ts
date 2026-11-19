import type { Turn } from '../ai/types';
import type { PublicConfig, RelayServed, Tier } from './types';

/**
 * Credit-mode tiers (pro mode only; backend/README.md › Relay › Tiers). The server keeps tiers (stable ids, each served
 * by a model it chooses and may repoint at any time). Since 20 Nov 2026 the app offers no choice between them (owner's
 * decision, `CRED-39` in docs/design/34-credits-and-relay.md): every request uses the tier the server's `/config` marks
 * as default, read when the request is made, so the owner changes the model behind it, or which tier is the default,
 * in the admin panel without an app release. No tier id or model is written into the app. A tier chosen in an older
 * version (Settings' model for `qutai`, a conversation's `ModelChoice.model`) is still stored but no longer read.
 * Pure (no React Native), so `scripts/credits-tests/` runs it.
 */

/** The server lists tiers: the tier form is used. Otherwise the older direct form with the server's first model. */
export function usesTiers(config: PublicConfig | null): config is PublicConfig {
  return !!config && config.tiers.length > 0;
}

/** The tier every Qutai Credits request uses: the one `/config` marks as default (the first listed, failing that). */
export function defaultTier(config: PublicConfig): Tier | null {
  return config.tiers.find((tier) => tier.default) ?? config.tiers[0] ?? null;
}

/** A tier id is shaped like this (the server's rule), which a provider model id with a dot or a digit-dash is not. */
export const TIER_ID = /^[a-z][a-z0-9_-]{0,31}$/;

/** The last answer of this conversation that came through Qutai's relay and said what served it. */
export function lastServed(turns: readonly Turn[]): RelayServed | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn.role !== 'assistant') continue;
    if (turn.rawProvider !== 'qutai') return null;
    if (turn.served) return turn.served;
  }
  return null;
}

/**
 * How the next request of a conversation on `tier` goes out: in the provider format and on the model of its last
 * answer on the same tier, with that answer's route (the server keeps a running conversation on its model); otherwise
 * as a new conversation on the tier (its format, no route). `model` is only what the app expects to serve it: it keys
 * the raw-output replay rule (raw output goes back only to the model that made it), the server decides.
 */
export function tierTarget(tier: Tier, turns: readonly Turn[]): { format: RelayServed['provider']; model: string; route?: string } {
  const last = lastServed(turns);
  if (last && last.tier === tier.id) {
    return { format: last.provider, model: last.model, ...(last.route ? { route: last.route } : {}) };
  }
  return { format: tier.format, model: expectedModel(tier, tier.format) };
}

/** The model the tier is listed as served by, when it is in this format ('' when unknown: nothing raw is replayed). */
export function expectedModel(tier: Tier, format: string): string {
  return tier.servedBy && tier.servedBy.provider === format ? tier.servedBy.model : '';
}
