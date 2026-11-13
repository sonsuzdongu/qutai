import { anthropic } from './anthropic';
import { gemini } from './gemini';
import { openai } from './openai';
import type { Provider, ProviderId } from './types';

export const PROVIDERS: Record<ProviderId, Provider> = { anthropic, openai, gemini };

export const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'openai', 'gemini'];

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS[id];
}

export function modelLabel(id: ProviderId, model: string): string {
  return (
    getProvider(id)
      .models.find((m) => m.id === model)
      ?.label.replace(/ \(.*\)$/, '') ?? model
  );
}
