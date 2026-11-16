import { compareVersions } from './client';
import { RelayError } from './errors';
import { isRelayProvider, type AllowedModel, type PublicConfig, type Tier } from './types';

/**
 * What `GET /config` says before anything is sent: maintenance, the lowest app version the server accepts, and
 * whether the model is still offered. The relay refuses the same things itself; checking first gives the user the
 * reason without a round trip and without a request that can't succeed.
 */
export function preflight(config: PublicConfig, appVersion: string, model: string): AllowedModel {
  checkServer(config, appVersion);
  const found = config.models.find((m) => m.model === model && isRelayProvider(m.provider));
  if (!found) throw new RelayError('model_not_allowed', 400);
  return found;
}

/** Maintenance and the lowest app version the server accepts (both forms). */
export function checkServer(config: PublicConfig, appVersion: string): void {
  if (config.maintenance.enabled) {
    throw new RelayError('maintenance', 503, config.maintenance.message ? { detail: config.maintenance.message } : {});
  }
  if (config.minAppVersion && compareVersions(appVersion, config.minAppVersion) < 0) {
    throw new RelayError('upgrade_required', 426);
  }
}

/** The models the relay offers, for the model lists (the providers this app can talk to only). */
export function offeredModels(config: PublicConfig | null): AllowedModel[] {
  return config ? config.models.filter((m) => isRelayProvider(m.provider)) : [];
}

/**
 * The limits a task runs under: the tier's own (`tiers[].limits`, the top-level ones with the tier's overrides) on a
 * server with tiers, else the top-level ones.
 */
export function limitsFor(config: PublicConfig, tier: Tier | null): Record<string, number> {
  return tier ? tier.limits : config.limits;
}

/** Steps allowed for one message (`limits.maxSteps` / `maxResearchSteps`), or null when the server gave none. */
export function stepLimit(config: PublicConfig | null, research: boolean, tier: Tier | null = null): number | null {
  const n = config ? limitsFor(config, tier)[research ? 'maxResearchSteps' : 'maxSteps'] : undefined;
  return typeof n === 'number' && n > 0 ? n : null;
}
