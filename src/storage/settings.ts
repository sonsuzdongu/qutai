import * as SecureStore from 'expo-secure-store';
import { cleanCustomHeaders, CustomHeader, MAX_CUSTOM_HEADERS } from '../ai/customHeaders';
import { PROVIDER_ORDER, PROVIDERS } from '../ai/providers';
import type { ProviderId } from '../ai/types';
import { READER_FONTS, READER_THEMES, ReaderFont, ReaderTheme } from '../browser/reader';
import { isSearchEngine, SearchEngineId } from '../browser/search';
import type { VoiceOnline } from '../device/voiceInput';
import { AlwaysAllowKind, parseAlwaysAllow, serializeAlwaysAllow } from '../agent/alwaysAllow';
import { removeRetiredInstructionLines } from '../agent/retiredInstructions';
import { cleanCustomInstructions } from '../agent/systemPrompt';
import { secureStoreReady } from './secureStoreGate';

export type Settings = {
  provider: ProviderId;
  apiKeys: Record<ProviderId, string>;
  models: Record<ProviderId, string>;
  /**
   * Base URL of the custom OpenAI-compatible endpoint ('' when not set up), normalised by ai/customEndpoint.ts
   * when saved. A setting, not a secret: it goes in backups (its key only with the explicit opt-in).
   */
  customBaseUrl: string;
  /** The custom endpoint's model takes images (set by "Test connection"; the user can change it). */
  customImages: boolean;
  /**
   * Extra HTTP headers for the custom endpoint (ai/customHeaders.ts). Values can be tokens, so they are treated like
   * the API keys: one secure-storage entry per row, in backups only with the keys' opt-in, never logged.
   */
  customHeaders: CustomHeader[];
  confirmActions: boolean;
  /**
   * Low-risk phone actions the user allowed for good with "Don't ask again" (agent/alwaysAllow.ts): their
   * confirmation is skipped. Turned off one by one in Settings › Assistant. Never set by the assistant itself.
   */
  alwaysAllow: AlwaysAllowKind[];
  searchEngine: SearchEngineId;
  /** Live suggestions from the search engine while typing; always off in incognito tabs. */
  searchSuggestions: boolean;
  /** Page text size in percent, for every tab. */
  textZoom: number;
  /** The assistant remembers facts about the user across conversations. */
  memoryEnabled: boolean;
  /**
   * The user's standing instructions for the assistant ("Answer briefly"), added to every request below the safety
   * rules (agent/systemPrompt.ts customInstructionsPrompt). Also where setup's answer-style question writes.
   */
  customInstructions: string;
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
  /** Ask for Face ID / fingerprint / passcode when opening the app. */
  appLock: boolean;
  /** Ask before showing incognito tabs again after leaving the app. */
  incognitoLock: boolean;
  /** The Qutai button in the address bar; when off, "Ask Qutai" is in the page menu. */
  showAssistantButton: boolean;
  /** Pinch-zoom every page, even those that turn zooming off. */
  forceZoom: boolean;
  /** Sound a page plays keeps playing when Qutai is in the background or the screen locks. */
  backgroundPlayback: boolean;
  /** Android: a playing video goes into picture-in-picture when the user leaves Qutai (modules/qutai-media). */
  pictureInPicture: boolean;
  /**
   * Android: an assistant task the user started goes on when they leave Qutai, behind an ongoing notification
   * (src/device/backgroundTask.ts). Off by default.
   */
  backgroundTasks: boolean;
  /** Android, with backgroundTasks: a notification says how a task ended when it ended while Qutai was away. */
  notifyTaskDone: boolean;
  /**
   * Experimental: stream Gemini replies as they are written. Off by default until checked with a real key;
   * the other providers always stream.
   */
  geminiStreaming: boolean;
  /** Under answers and in "What was sent to the AI": tokens used and the approximate cost (ai/cost.ts). On by default. */
  showCost: boolean;
  /** Reader mode colours: following the app's appearance, light, dark or sepia. */
  readerTheme: ReaderTheme;
  readerFont: ReaderFont;
  /** Reader mode: wider letter, word and line spacing, for dyslexic readers. */
  readerEasyReading: boolean;
  /** Voice input: send the message as soon as the user stops speaking (off: they review and tap send). */
  voiceAutoSend: boolean;
  /**
   * Voice input where on-device recognition isn't available: whether the phone's online speech
   * service (Apple's or Google's) may receive the audio. Asked once, before first use.
   */
  voiceOnline: VoiceOnline;
  /**
   * Voice input's language: 'auto' follows the conversation (what the user writes in it, see device/voiceLanguage.ts),
   * otherwise a language or tag ("tr", "en-GB"). A language picked in a conversation's panel wins over it.
   */
  voiceLanguage: string;
  /** The recogniser language voice input was last used in (a fallback when a conversation says nothing yet). */
  voiceLastLanguage: string;
  /** Holding the Qutai button records a voice message and sends it on release (push-to-talk). */
  voiceHoldToTalk: boolean;
  /** The first-run setup was completed (or skipped through). */
  onboarded: boolean;
  /** Version of the privacy policy and terms the user accepted (0: none yet). */
  legalAcceptedVersion: number;
};

export type ThemeSetting = 'system' | 'light' | 'dark';
const THEMES: ThemeSetting[] = ['system', 'light', 'dark'];

export const DEFAULT_SETTINGS: Settings = {
  provider: 'anthropic',
  apiKeys: Object.fromEntries(PROVIDER_ORDER.map((id) => [id, ''])) as Record<ProviderId, string>,
  models: Object.fromEntries(PROVIDER_ORDER.map((id) => [id, PROVIDERS[id].defaultModel])) as Record<ProviderId, string>,
  customBaseUrl: '',
  customImages: true,
  customHeaders: [],
  confirmActions: false,
  alwaysAllow: [],
  searchEngine: 'google',
  searchSuggestions: true,
  textZoom: 100,
  memoryEnabled: true,
  customInstructions: '',
  webSearch: true,
  blockAds: true,
  hideCookieBanners: true,
  theme: 'system',
  darkSites: true,
  addressBarPosition: 'bottom',
  haptics: true,
  httpsOnly: false,
  blockThirdPartyCookies: true,
  appLock: false,
  incognitoLock: false,
  showAssistantButton: true,
  forceZoom: false,
  backgroundPlayback: true,
  pictureInPicture: true,
  backgroundTasks: false,
  notifyTaskDone: true,
  geminiStreaming: false,
  showCost: true,
  readerTheme: 'auto',
  readerFont: 'serif',
  readerEasyReading: false,
  voiceAutoSend: false,
  voiceOnline: 'ask',
  voiceLanguage: 'auto',
  voiceLastLanguage: '',
  voiceHoldToTalk: true,
  onboarded: false,
  legalAcceptedVersion: 0,
};

const KEYS = {
  provider: 'provider',
  customBaseUrl: 'custom_base_url',
  customImages: 'custom_images',
  confirmActions: 'confirm_actions',
  alwaysAllow: 'always_allow',
  searchEngine: 'search_engine',
  searchSuggestions: 'search_suggestions',
  textZoom: 'text_zoom',
  memoryEnabled: 'memory_enabled',
  customInstructions: 'custom_instructions',
  webSearch: 'web_search',
  blockAds: 'block_ads',
  hideCookieBanners: 'hide_cookie_banners',
  theme: 'theme',
  darkSites: 'dark_sites',
  addressBarPosition: 'address_bar_position',
  haptics: 'haptics',
  httpsOnly: 'https_only',
  blockThirdPartyCookies: 'block_third_party_cookies',
  appLock: 'app_lock',
  incognitoLock: 'incognito_lock',
  showAssistantButton: 'show_assistant_button',
  forceZoom: 'force_zoom',
  backgroundPlayback: 'background_playback',
  pictureInPicture: 'picture_in_picture',
  backgroundTasks: 'background_tasks',
  notifyTaskDone: 'notify_task_done',
  geminiStreaming: 'gemini_streaming',
  showCost: 'show_cost',
  readerTheme: 'reader_theme',
  readerFont: 'reader_font',
  readerEasyReading: 'reader_easy_reading',
  voiceAutoSend: 'voice_auto_send',
  voiceOnline: 'voice_online',
  voiceLanguage: 'voice_language',
  voiceLastLanguage: 'voice_last_language',
  voiceHoldToTalk: 'voice_hold_to_talk',
  onboarded: 'onboarded',
  legalAcceptedVersion: 'legal_accepted_version',
  /** '1' once the retired example lines were taken out of the custom instructions (agent/retiredInstructions.ts). */
  retiredInstructionsRemoved: 'retired_instructions_removed',
  apiKey:(id: ProviderId) => `api_key_${id}`,
  customHeader: (i: number) => `custom_header_${i}`,
  model: (id: ProviderId) => `model_${id}`,
  // Written by the first, Claude-only version of the app.
  legacyApiKey: 'anthropic_api_key',
  legacyModel: 'model',
  // The retired "Animate the logo" switch (the logo now always animates, unless the system reduces motion).
  retiredAnimateLogo: 'animate_logo',
};

/** Every secure-storage key settings.ts writes or once wrote (cleared on a reinstall, storage/installCheck.ts). */
export function secureSettingKeys(): string[] {
  return Object.values(KEYS).flatMap((k) =>
    typeof k === 'string'
      ? [k]
      : k === KEYS.customHeader
        ? Array.from({ length: MAX_CUSTOM_HEADERS }, (_, i) => KEYS.customHeader(i))
        : PROVIDER_ORDER.map((id) => (k as (id: ProviderId) => string)(id)),
  );
}

export const TEXT_ZOOM_MIN = 50;
export const TEXT_ZOOM_MAX = 200;

export function clampTextZoom(value: number): number {
  return Math.min(TEXT_ZOOM_MAX, Math.max(TEXT_ZOOM_MIN, Math.round(value / 10) * 10));
}

/** A language or tag for voice input ("tr", "en-GB"). */
function isLanguageTag(value: string | null): value is string {
  return !!value && /^[a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]{2,8}){0,3}$/.test(value);
}

function isProvider(value: string | null): value is ProviderId {
  return !!value && (PROVIDER_ORDER as string[]).includes(value);
}

/** One stored extra-header row (JSON { name, value }); anything else is dropped. */
function parseHeaderRow(raw: string | null): CustomHeader[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === 'object') {
      const { name, value } = v as { name?: unknown; value?: unknown };
      if (typeof name === 'string' && typeof value === 'string') return [{ name, value }];
    }
  } catch {}
  return [];
}

export async function loadSettings(): Promise<Settings> {
  await secureStoreReady();
  const get = (key: string) => SecureStore.getItemAsync(key);
  const [
    provider,
    confirmActions,
    searchEngine,
    searchSuggestions,
    textZoom,
    memoryEnabled,
    customInstructions,
    webSearch,
    blockAds,
    hideCookieBanners,
    theme,
    darkSites,
    addressBarPosition,
    haptics,
    httpsOnly,
    blockThirdPartyCookies,
    appLock,
    incognitoLock,
    showAssistantButton,
    forceZoom,
    backgroundPlayback,
    pictureInPicture,
    backgroundTasks,
    notifyTaskDone,
    geminiStreaming,
    showCost,
    readerTheme,
    readerFont,
    readerEasyReading,
    voiceAutoSend,
    voiceOnline,
    voiceLanguage,
    voiceLastLanguage,
    voiceHoldToTalk,
    onboarded,
    legalAcceptedVersion,
    legacyApiKey,
    legacyModel,
    customBaseUrl,
    customImages,
    customHeaderRows,
    alwaysAllow,
    ...perProvider
  ] = await Promise.all([
    get(KEYS.provider),
    get(KEYS.confirmActions),
    get(KEYS.searchEngine),
    get(KEYS.searchSuggestions),
    get(KEYS.textZoom),
    get(KEYS.memoryEnabled),
    get(KEYS.customInstructions),
    get(KEYS.webSearch),
    get(KEYS.blockAds),
    get(KEYS.hideCookieBanners),
    get(KEYS.theme),
    get(KEYS.darkSites),
    get(KEYS.addressBarPosition),
    get(KEYS.haptics),
    get(KEYS.httpsOnly),
    get(KEYS.blockThirdPartyCookies),
    get(KEYS.appLock),
    get(KEYS.incognitoLock),
    get(KEYS.showAssistantButton),
    get(KEYS.forceZoom),
    get(KEYS.backgroundPlayback),
    get(KEYS.pictureInPicture),
    get(KEYS.backgroundTasks),
    get(KEYS.notifyTaskDone),
    get(KEYS.geminiStreaming),
    get(KEYS.showCost),
    get(KEYS.readerTheme),
    get(KEYS.readerFont),
    get(KEYS.readerEasyReading),
    get(KEYS.voiceAutoSend),
    get(KEYS.voiceOnline),
    get(KEYS.voiceLanguage),
    get(KEYS.voiceLastLanguage),
    get(KEYS.voiceHoldToTalk),
    get(KEYS.onboarded),
    get(KEYS.legalAcceptedVersion),
    get(KEYS.legacyApiKey),
    get(KEYS.legacyModel),
    get(KEYS.customBaseUrl),
    get(KEYS.customImages),
    Promise.all(Array.from({ length: MAX_CUSTOM_HEADERS }, (_, i) => get(KEYS.customHeader(i)))),
    get(KEYS.alwaysAllow),
    ...PROVIDER_ORDER.flatMap((id) => [get(KEYS.apiKey(id)), get(KEYS.model(id))]),
  ]);

  const settings: Settings = {
    provider: isProvider(provider) ? provider : DEFAULT_SETTINGS.provider,
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys },
    models: { ...DEFAULT_SETTINGS.models },
    customBaseUrl: customBaseUrl ?? '',
    customImages: customImages !== 'false',
    customHeaders: (customHeaderRows as (string | null)[]).flatMap(parseHeaderRow),
    confirmActions: confirmActions === 'true',
    alwaysAllow: parseAlwaysAllow(alwaysAllow as string | null),
    searchEngine: isSearchEngine(searchEngine) ? searchEngine : DEFAULT_SETTINGS.searchEngine,
    searchSuggestions: searchSuggestions !== 'false',
    textZoom: clampTextZoom(Number(textZoom) || DEFAULT_SETTINGS.textZoom),
    memoryEnabled: memoryEnabled !== 'false',
    customInstructions: cleanCustomInstructions(customInstructions ?? ''),
    webSearch: webSearch !== 'false',
    blockAds: blockAds !== 'false',
    hideCookieBanners: hideCookieBanners !== 'false',
    theme: THEMES.includes(theme as ThemeSetting) ? (theme as ThemeSetting) : 'system',
    darkSites: darkSites !== 'false',
    addressBarPosition: addressBarPosition === 'top' ? 'top' : 'bottom',
    haptics: haptics !== 'false',
    httpsOnly: httpsOnly === 'true',
    blockThirdPartyCookies: blockThirdPartyCookies !== 'false',
    appLock: appLock === 'true',
    incognitoLock: incognitoLock === 'true',
    showAssistantButton: showAssistantButton !== 'false',
    forceZoom: forceZoom === 'true',
    backgroundPlayback: backgroundPlayback !== 'false',
    pictureInPicture: pictureInPicture !== 'false',
    backgroundTasks: backgroundTasks === 'true',
    notifyTaskDone: notifyTaskDone !== 'false',
    geminiStreaming: geminiStreaming === 'true',
    showCost: showCost !== 'false',
    readerTheme: READER_THEMES.includes(readerTheme as ReaderTheme) ? (readerTheme as ReaderTheme) : 'auto',
    readerFont: READER_FONTS.includes(readerFont as ReaderFont) ? (readerFont as ReaderFont) : 'serif',
    readerEasyReading: readerEasyReading === 'true',
    voiceAutoSend: voiceAutoSend === 'true',
    voiceOnline: voiceOnline === 'allowed' || voiceOnline === 'declined' ? voiceOnline : 'ask',
    voiceLanguage: isLanguageTag(voiceLanguage) ? voiceLanguage : 'auto',
    voiceLastLanguage: isLanguageTag(voiceLastLanguage) ? voiceLastLanguage : '',
    voiceHoldToTalk: voiceHoldToTalk !== 'false',
    onboarded: onboarded === 'true',
    legalAcceptedVersion: Math.max(0, Math.floor(Number(legalAcceptedVersion) || 0)),
  };
  PROVIDER_ORDER.forEach((id, i) => {
    settings.apiKeys[id] = (perProvider[i * 2] as string | null) ?? '';
    settings.models[id] = (perProvider[i * 2 + 1] as string | null) || DEFAULT_SETTINGS.models[id];
  });

  if (!settings.apiKeys.anthropic && legacyApiKey) settings.apiKeys.anthropic = legacyApiKey;
  if (legacyModel?.startsWith('claude-') && !perProvider[1]) settings.models.anthropic = legacyModel;

  // Once per install: the "Always reply in Turkish" line older builds added (agent/retiredInstructions.ts). If
  // saving fails, the line is still left out of this session's settings and the next launch tries again.
  if ((await get(KEYS.retiredInstructionsRemoved)) !== '1') {
    try {
      const cleaned = removeRetiredInstructionLines(settings.customInstructions);
      if (cleaned !== settings.customInstructions) {
        settings.customInstructions = cleaned;
        await (cleaned
          ? SecureStore.setItemAsync(KEYS.customInstructions, cleaned)
          : SecureStore.deleteItemAsync(KEYS.customInstructions));
      }
      await SecureStore.setItemAsync(KEYS.retiredInstructionsRemoved, '1');
    } catch {}
  }

  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const set = (key: string, value: string) =>
    value ? SecureStore.setItemAsync(key, value) : SecureStore.deleteItemAsync(key);
  await Promise.all([
    set(KEYS.provider, settings.provider),
    set(KEYS.customBaseUrl, settings.customBaseUrl),
    set(KEYS.customImages, String(settings.customImages)),
    ...Array.from({ length: MAX_CUSTOM_HEADERS }, (_, i) => {
      const h = cleanCustomHeaders(settings.customHeaders)[i];
      return set(KEYS.customHeader(i), h ? JSON.stringify({ name: h.name, value: h.value }) : '');
    }),
    set(KEYS.confirmActions, String(settings.confirmActions)),
    set(KEYS.alwaysAllow, serializeAlwaysAllow(settings.alwaysAllow)),
    set(KEYS.searchEngine, settings.searchEngine),
    set(KEYS.searchSuggestions, String(settings.searchSuggestions)),
    set(KEYS.textZoom, String(settings.textZoom)),
    set(KEYS.memoryEnabled, String(settings.memoryEnabled)),
    set(KEYS.customInstructions, cleanCustomInstructions(settings.customInstructions)),
    set(KEYS.webSearch, String(settings.webSearch)),
    set(KEYS.blockAds, String(settings.blockAds)),
    set(KEYS.hideCookieBanners, String(settings.hideCookieBanners)),
    set(KEYS.theme, settings.theme),
    set(KEYS.darkSites, String(settings.darkSites)),
    set(KEYS.addressBarPosition, settings.addressBarPosition),
    set(KEYS.haptics, String(settings.haptics)),
    set(KEYS.httpsOnly, String(settings.httpsOnly)),
    set(KEYS.blockThirdPartyCookies, String(settings.blockThirdPartyCookies)),
    set(KEYS.appLock, String(settings.appLock)),
    set(KEYS.incognitoLock, String(settings.incognitoLock)),
    set(KEYS.showAssistantButton, String(settings.showAssistantButton)),
    set(KEYS.forceZoom, String(settings.forceZoom)),
    set(KEYS.backgroundPlayback, String(settings.backgroundPlayback)),
    set(KEYS.pictureInPicture, String(settings.pictureInPicture)),
    set(KEYS.backgroundTasks, String(settings.backgroundTasks)),
    set(KEYS.notifyTaskDone, String(settings.notifyTaskDone)),
    set(KEYS.geminiStreaming, String(settings.geminiStreaming)),
    set(KEYS.showCost, String(settings.showCost)),
    set(KEYS.readerTheme, settings.readerTheme),
    set(KEYS.readerFont, settings.readerFont),
    set(KEYS.readerEasyReading, String(settings.readerEasyReading)),
    set(KEYS.voiceAutoSend, String(settings.voiceAutoSend)),
    set(KEYS.voiceOnline, settings.voiceOnline),
    set(KEYS.voiceLanguage, settings.voiceLanguage),
    set(KEYS.voiceLastLanguage, settings.voiceLastLanguage),
    set(KEYS.voiceHoldToTalk, String(settings.voiceHoldToTalk)),
    set(KEYS.onboarded, String(settings.onboarded)),
    set(KEYS.legalAcceptedVersion, String(settings.legalAcceptedVersion)),
    ...PROVIDER_ORDER.flatMap((id) => [
      set(KEYS.apiKey(id), settings.apiKeys[id]),
      set(KEYS.model(id), settings.models[id]),
    ]),
    // Migrated into the per-provider keys above.
    SecureStore.deleteItemAsync(KEYS.legacyApiKey),
    SecureStore.deleteItemAsync(KEYS.legacyModel),
    SecureStore.deleteItemAsync(KEYS.retiredAnimateLogo),
  ]);
}
