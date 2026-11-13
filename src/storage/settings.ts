import * as SecureStore from 'expo-secure-store';
import { PROVIDER_ORDER, PROVIDERS } from '../ai/providers';
import type { ProviderId } from '../ai/types';
import { isSearchEngine, SearchEngineId } from '../browser/search';

export type Settings = {
  provider: ProviderId;
  apiKeys: Record<ProviderId, string>;
  models: Record<ProviderId, string>;
  confirmActions: boolean;
  searchEngine: SearchEngineId;
  /** Live suggestions from the search engine while typing; always off in incognito tabs. */
  searchSuggestions: boolean;
  /** Page text size in percent, for every tab. */
  textZoom: number;
  /** The assistant remembers facts about the user across conversations. */
  memoryEnabled: boolean;
  /** The assistant may use the provider's web search (each search is billed to the user's API key). */
  webSearch: boolean;
  /** Block requests to known ad and tracker servers. */
  blockAds: boolean;
  /** Hide cookie consent banners. */
  hideCookieBanners: boolean;
  /** App appearance; 'system' follows the phone. */
  theme: ThemeSetting;
  /** In the dark theme, darken sites that have no dark design of their own. */
  darkSites: boolean;
  /** Address bar at the top (default) or the bottom of the screen. */
  addressBarPosition: 'top' | 'bottom';
  /** Light vibrations for taps like switching tabs. */
  haptics: boolean;
  /** Open sites over https:// only, asking before falling back to http://. */
  httpsOnly: boolean;
  /** Block third-party cookies (Android; iOS blocks them anyway). */
  blockThirdPartyCookies: boolean;
};

export type ThemeSetting = 'system' | 'light' | 'dark';
const THEMES: ThemeSetting[] = ['system', 'light', 'dark'];

export const DEFAULT_SETTINGS: Settings = {
  provider: 'anthropic',
  apiKeys: { anthropic: '', openai: '', gemini: '' },
  models: {
    anthropic: PROVIDERS.anthropic.defaultModel,
    openai: PROVIDERS.openai.defaultModel,
    gemini: PROVIDERS.gemini.defaultModel,
  },
  confirmActions: false,
  searchEngine: 'google',
  searchSuggestions: true,
  textZoom: 100,
  memoryEnabled: true,
  webSearch: true,
  blockAds: true,
  hideCookieBanners: true,
  theme: 'system',
  darkSites: true,
  addressBarPosition: 'top',
  haptics: true,
  httpsOnly: false,
  blockThirdPartyCookies: true,
};

const KEYS = {
  provider: 'provider',
  confirmActions: 'confirm_actions',
  searchEngine: 'search_engine',
  searchSuggestions: 'search_suggestions',
  textZoom: 'text_zoom',
  memoryEnabled: 'memory_enabled',
  webSearch: 'web_search',
  blockAds: 'block_ads',
  hideCookieBanners: 'hide_cookie_banners',
  theme: 'theme',
  darkSites: 'dark_sites',
  addressBarPosition: 'address_bar_position',
  haptics: 'haptics',
  httpsOnly: 'https_only',
  blockThirdPartyCookies: 'block_third_party_cookies',
  apiKey: (id: ProviderId) => `api_key_${id}`,
  model: (id: ProviderId) => `model_${id}`,
  // Written by the first, Claude-only version of the app.
  legacyApiKey: 'anthropic_api_key',
  legacyModel: 'model',
};

export const TEXT_ZOOM_MIN = 50;
export const TEXT_ZOOM_MAX = 200;

export function clampTextZoom(value: number): number {
  return Math.min(TEXT_ZOOM_MAX, Math.max(TEXT_ZOOM_MIN, Math.round(value / 10) * 10));
}

function isProvider(value: string | null): value is ProviderId {
  return !!value && (PROVIDER_ORDER as string[]).includes(value);
}

export async function loadSettings(): Promise<Settings> {
  const get = (key: string) => SecureStore.getItemAsync(key);
  const [
    provider,
    confirmActions,
    searchEngine,
    searchSuggestions,
    textZoom,
    memoryEnabled,
    webSearch,
    blockAds,
    hideCookieBanners,
    theme,
    darkSites,
    addressBarPosition,
    haptics,
    httpsOnly,
    blockThirdPartyCookies,
    legacyApiKey,
    legacyModel,
    ...perProvider
  ] = await Promise.all([
    get(KEYS.provider),
    get(KEYS.confirmActions),
    get(KEYS.searchEngine),
    get(KEYS.searchSuggestions),
    get(KEYS.textZoom),
    get(KEYS.memoryEnabled),
    get(KEYS.webSearch),
    get(KEYS.blockAds),
    get(KEYS.hideCookieBanners),
    get(KEYS.theme),
    get(KEYS.darkSites),
    get(KEYS.addressBarPosition),
    get(KEYS.haptics),
    get(KEYS.httpsOnly),
    get(KEYS.blockThirdPartyCookies),
    get(KEYS.legacyApiKey),
    get(KEYS.legacyModel),
    ...PROVIDER_ORDER.flatMap((id) => [get(KEYS.apiKey(id)), get(KEYS.model(id))]),
  ]);

  const settings: Settings = {
    provider: isProvider(provider) ? provider : DEFAULT_SETTINGS.provider,
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys },
    models: { ...DEFAULT_SETTINGS.models },
    confirmActions: confirmActions === 'true',
    searchEngine: isSearchEngine(searchEngine) ? searchEngine : DEFAULT_SETTINGS.searchEngine,
    searchSuggestions: searchSuggestions !== 'false',
    textZoom: clampTextZoom(Number(textZoom) || DEFAULT_SETTINGS.textZoom),
    memoryEnabled: memoryEnabled !== 'false',
    webSearch: webSearch !== 'false',
    blockAds: blockAds !== 'false',
    hideCookieBanners: hideCookieBanners !== 'false',
    theme: THEMES.includes(theme as ThemeSetting) ? (theme as ThemeSetting) : 'system',
    darkSites: darkSites !== 'false',
    addressBarPosition: addressBarPosition === 'bottom' ? 'bottom' : 'top',
    haptics: haptics !== 'false',
    httpsOnly: httpsOnly === 'true',
    blockThirdPartyCookies: blockThirdPartyCookies !== 'false',
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
    set(KEYS.searchEngine, settings.searchEngine),
    set(KEYS.searchSuggestions, String(settings.searchSuggestions)),
    set(KEYS.textZoom, String(settings.textZoom)),
    set(KEYS.memoryEnabled, String(settings.memoryEnabled)),
    set(KEYS.webSearch, String(settings.webSearch)),
    set(KEYS.blockAds, String(settings.blockAds)),
    set(KEYS.hideCookieBanners, String(settings.hideCookieBanners)),
    set(KEYS.theme, settings.theme),
    set(KEYS.darkSites, String(settings.darkSites)),
    set(KEYS.addressBarPosition, settings.addressBarPosition),
    set(KEYS.haptics, String(settings.haptics)),
    set(KEYS.httpsOnly, String(settings.httpsOnly)),
    set(KEYS.blockThirdPartyCookies, String(settings.blockThirdPartyCookies)),
    ...PROVIDER_ORDER.flatMap((id) => [
      set(KEYS.apiKey(id), settings.apiKeys[id]),
      set(KEYS.model(id), settings.models[id]),
    ]),
    // Migrated into the per-provider keys above.
    SecureStore.deleteItemAsync(KEYS.legacyApiKey),
    SecureStore.deleteItemAsync(KEYS.legacyModel),
  ]);
}
