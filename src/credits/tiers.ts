import type { ModelTag, Turn } from '../ai/types';
import { getLanguage, t, type MessageKey } from '../i18n';
import { formatCredits, separators } from './format';
import type { PublicConfig, RelayServed, Tier } from './types';

/**
 * Credit-mode tiers (pro mode only; backend/README.md › Relay › Tiers). With a server whose `/config` lists tiers, the
 * customer picks a tier ("Qutai Fast", "Qutai", "Qutai Pro"), never a provider model: the server decides which model
 * serves it and may repoint it at any time. The tier id is stored where the Qutai model was stored before (Settings'
 * model for `qutai`, a conversation's `ModelChoice.model`), so a choice saved before tiers existed (a provider model
 * id) still reads; `resolveTier` maps it. Pure (no React Native), so `scripts/credits-tests/` runs it.
 */

/** The server lists tiers: the tier form is used and the menus show tiers. Otherwise the older model list. */
export function usesTiers(config: PublicConfig | null): config is PublicConfig {
  return !!config && config.tiers.length > 0;
}

export function defaultTier(config: PublicConfig): Tier | null {
  return config.tiers.find((tier) => tier.default) ?? config.tiers[0] ?? null;
}

/**
 * Which tier a stored choice means. A tier id the server lists is itself. Anything else was saved before tiers (a
 * provider model id from the older model list) or names a tier the server no longer offers:
 * 1. the tier that model serves now (`servedBy`), the default one first;
 * 2. by what the model was in the own-key lists (`tagOf`): the fastest → `fast`, the recommended → `standard`, the
 *    strongest → `pro`, when the server has such a tier;
 * 3. the default tier.
 * Null only when the server lists no tiers.
 */
export function resolveTier(config: PublicConfig, stored: string | undefined | null, tagOf?: (model: string) => ModelTag | undefined): Tier | null {
  const id = (stored ?? '').trim();
  const fallback = defaultTier(config);
  if (!fallback) return null;
  if (!id) return fallback;
  const direct = config.tiers.find((tier) => tier.id === id);
  if (direct) return direct;
  const serving = config.tiers.filter((tier) => tier.servedBy?.model === id);
  if (serving.length) return serving.find((tier) => tier.default) ?? serving[0];
  const tag = tagOf?.(id);
  const byTag = tag ? config.tiers.find((tier) => tier.id === TAG_TIER[tag]) : undefined;
  return byTag ?? fallback;
}

/**
 * A Qutai choice saved before tiers: a provider model id (from the own-key lists, `isKnownModel`, or the server's older
 * model list), not a tier id. The app rewrites such a choice as the tier it maps to the first time it is used with
 * tiers; an unlisted tier id (switched off for now) is left as it is.
 */
export function preTierChoice(stored: string | undefined, config: PublicConfig, isKnownModel: (id: string) => boolean): boolean {
  if (!stored || config.tiers.some((tier) => tier.id === stored)) return false;
  return (
    isKnownModel(stored) ||
    config.models.some((m) => m.model === stored) ||
    config.tiers.some((tier) => tier.servedBy?.model === stored)
  );
}

const TAG_TIER: Record<ModelTag, string> = { fastest: 'fast', recommended: 'standard', strongest: 'pro' };

/** Tier ids the app has its own texts for; others are named from their id. */
const KNOWN: Record<string, { name: MessageKey; about: MessageKey }> = {
  fast: { name: 'tier.fast', about: 'tier.fastAbout' },
  standard: { name: 'tier.standard', about: 'tier.standardAbout' },
  pro: { name: 'tier.pro', about: 'tier.proAbout' },
};

/** A tier id is shaped like this (the server's rule), which a provider model id with a dot or a digit-dash is not. */
export const TIER_ID = /^[a-z][a-z0-9_-]{0,31}$/;

/** The tier's name in the app's language: "Qutai Fast" / "Qutai Hızlı", "Qutai", "Qutai Pro"; others "Qutai <Id>". */
export function tierName(id: string): string {
  const known = KNOWN[id];
  if (known) return t(known.name);
  return `Qutai ${id.charAt(0).toUpperCase()}${id.slice(1).replace(/[-_]+/g, ' ')}`;
}

/** One plain line on what the tier is for; null for a tier the app has no text for. */
export function tierAbout(id: string): string | null {
  const known = KNOWN[id];
  return known ? t(known.about) : null;
}

/** "About 0.42 credits per step" (approximate by nature: one reference step on the tier's current model). */
export function tierCostLine(tier: Tier): string | null {
  if (tier.approxCreditsPerStep === null) return null;
  return t('tier.approxPerStep', { credits: formatCredits(tier.approxCreditsPerStep, separators(getLanguage())) });
}

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
