import * as SecureStore from 'expo-secure-store';

export type Settings = {
  apiKey: string;
  model: string;
  confirmActions: boolean;
};

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

export const MODEL_OPTIONS = [
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5 (en hızlı)' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 (önerilen)' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5 (en güçlü)' },
];

const KEYS = {
  apiKey: 'anthropic_api_key',
  model: 'model',
  confirmActions: 'confirm_actions',
};

export async function loadSettings(): Promise<Settings> {
  const [apiKey, model, confirmActions] = await Promise.all([
    SecureStore.getItemAsync(KEYS.apiKey),
    SecureStore.getItemAsync(KEYS.model),
    SecureStore.getItemAsync(KEYS.confirmActions),
  ]);
  return {
    apiKey: apiKey ?? '',
    model: model || DEFAULT_MODEL,
    confirmActions: confirmActions === 'true',
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.apiKey, settings.apiKey),
    SecureStore.setItemAsync(KEYS.model, settings.model),
    SecureStore.setItemAsync(KEYS.confirmActions, String(settings.confirmActions)),
  ]);
}
