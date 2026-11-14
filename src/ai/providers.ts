import { recordRequest } from './audit';
import { anthropic } from './anthropic';
import { gemini } from './gemini';
import { openai } from './openai';
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
};

export const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'openai', 'gemini'];

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS[id];
}

export function modelLabel(id: ProviderId, model: string): string {
  return getProvider(id).models.find((m) => m.id === model)?.name ?? model;
}
