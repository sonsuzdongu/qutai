import { recordRequest } from './audit';
import { anthropic } from './anthropic';
import { gemini } from './gemini';
import { openai } from './openai';
import { openrouter } from './openrouter';
import { catalogModel } from './openrouterModels';
import type { Provider, ProviderId } from './types';

/**
 * The adapters are reached only through here, and every call is recorded for "What was sent to the AI"
 * before it goes out. Recording never throws, so it can't fail a request.
 */
function recorded(provider: Provider): Provider {
  return {
    ...provider,
    call: (req) => {
      recordRequest(provider.id, req);
      return provider.call(req);
    },
  };
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  anthropic: recorded(anthropic),
  openai: recorded(openai),
  gemini: recorded(gemini),
  openrouter: recorded(openrouter),
};

/** Every provider, in the order the settings list them. Nothing else may assume how many there are. */
export const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'openai', 'gemini', 'openrouter'];

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS[id];
}

export function modelLabel(id: ProviderId, model: string): string {
  const provider = getProvider(id);
  const listed = provider.models.find((m) => m.id === model)?.name;
  if (listed) return listed;
  return (provider.catalog && catalogModel(model)?.name) || model;
}

/**
 * What the agent knows about a model before sending: whether it takes images (screenshots) and its output limit.
 * Only catalogue providers can tell; the others' models all take images.
 */
export function modelCapabilities(id: ProviderId, model: string): { images: boolean; maxOutputTokens?: number } {
  if (!getProvider(id).catalog) return { images: true };
  const info = catalogModel(model);
  return { images: info?.images ?? true, ...(info?.maxOutput ? { maxOutputTokens: info.maxOutput } : {}) };
}
