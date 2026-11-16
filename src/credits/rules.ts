import { compareVersions } from './client';
import { RelayError } from './errors';
import { isRelayProvider, type AllowedModel, type PublicConfig } from './types';

/**
 * What `GET /config` says before anything is sent: maintenance, the lowest app version the server accepts, and
 * whether the model is still offered. The relay refuses the same things itself; checking first gives the user the
 * reason without a round trip and without a request that can't succeed.
 */
export function preflight(config: PublicConfig, appVersion: string, model: string): AllowedModel {
  if (config.maintenance.enabled) {
    throw new RelayError('maintenance', 503, config.maintenance.message ? { detail: config.maintenance.message } : {});
  }
  if (config.minAppVersion && compareVersions(appVersion, config.minAppVersion) < 0) {
    throw new RelayError('upgrade_required', 426);
  }
  const found = config.models.find((m) => m.model === model && isRelayProvider(m.provider));
  if (!found) throw new RelayError('model_not_allowed', 400);
  return found;
}

/** The models the relay offers, for the model lists (the providers this app can talk to only). */
export function offeredModels(config: PublicConfig | null): AllowedModel[] {
  return config ? config.models.filter((m) => isRelayProvider(m.provider)) : [];
}

/** Steps allowed for one message (`limits.maxSteps` / `maxResearchSteps`), or null when the server gave none. */
export function stepLimit(config: PublicConfig | null, research: boolean): number | null {
  const n = config?.limits[research ? 'maxResearchSteps' : 'maxSteps'];
  return typeof n === 'number' && n > 0 ? n : null;
}
