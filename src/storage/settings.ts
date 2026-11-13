import * as SecureStore from 'expo-secure-store';
import { PROVIDER_ORDER, PROVIDERS } from '../ai/providers';
import type { ProviderId } from '../ai/types';

export type Settings = {
  provider: ProviderId;
  apiKeys: Record<ProviderId, string>;
  models: Record<ProviderId, string>;
  confirmActions: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  provider: 'anthropic',
  apiKeys: { anthropic: '', openai: '', gemini: '' },
  models: {
    anthropic: PROVIDERS.anthropic.defaultModel,
    openai: PROVIDERS.openai.defaultModel,
    gemini: PROVIDERS.gemini.defaultModel,
  },
  confirmActions: false,
};

const KEYS = {
  provider: 'provider',
  confirmActions: 'confirm_actions',
  apiKey: (id: ProviderId) => `api_key_${id}`,
  model: (id: ProviderId) => `model_${id}`,
  // Written by the first, Claude-only version of the app.
  legacyApiKey: 'anthropic_api_key',
  legacyModel: 'model',
};

function isProvider(value: string | null): value is ProviderId {
  return !!value && (PROVIDER_ORDER as string[]).includes(value);
}

export async function loadSettings(): Promise<Settings> {
  const get = (key: string) => SecureStore.getItemAsync(key);
  const [provider, confirmActions, legacyApiKey, legacyModel, ...perProvider] = await Promise.all([
    get(KEYS.provider),
    get(KEYS.confirmActions),
    get(KEYS.legacyApiKey),
    get(KEYS.legacyModel),
    ...PROVIDER_ORDER.flatMap((id) => [get(KEYS.apiKey(id)), get(KEYS.model(id))]),
  ]);

  const settings: Settings = {
    provider: isProvider(provider) ? provider : DEFAULT_SETTINGS.provider,
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys },
    models: { ...DEFAULT_SETTINGS.models },
    confirmActions: confirmActions === 'true',
  };
  PROVIDER_ORDER.forEach((id, i) => {
    settings.apiKeys[id] = perProvider[i * 2] ?? '';
    settings.models[id] = perProvider[i * 2 + 1] || DEFAULT_SETTINGS.models[id];
  });

  if (!settings.apiKeys.anthropic && legacyApiKey) settings.apiKeys.anthropic = legacyApiKey;
  if (legacyModel?.startsWith('claude-') && !perProvider[1]) settings.models.anthropic = legacyModel;

  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const set = (key: string, value: string) =>
    value ? SecureStore.setItemAsync(key, value) : SecureStore.deleteItemAsync(key);
  await Promise.all([
    set(KEYS.provider, settings.provider),
    set(KEYS.confirmActions, String(settings.confirmActions)),
    ...PROVIDER_ORDER.flatMap((id) => [
      set(KEYS.apiKey(id), settings.apiKeys[id]),
      set(KEYS.model(id), settings.models[id]),
    ]),
    // Migrated into the per-provider keys above.
    SecureStore.deleteItemAsync(KEYS.legacyApiKey),
    SecureStore.deleteItemAsync(KEYS.legacyModel),
  ]);
}
