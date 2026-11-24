import * as SecureStore from 'expo-secure-store';
import { cleanCustomHeaders, CustomHeader, MAX_CUSTOM_HEADERS } from '../ai/customHeaders';
import { PROVIDER_ORDER, PROVIDERS } from '../ai/providers';
import type { ProviderId } from '../ai/types';
import { READER_FONTS, READER_THEMES, ReaderFont, ReaderTheme } from '../browser/reader';
import { isSearchEngine, SearchEngineId } from '../browser/search';
import type { VoiceOnline } from '../device/voiceInput';
import { AlwaysAllowKind, parseAlwaysAllow, serializeAlwaysAllow } from '../agent/alwaysAllow';
import { removeDefaultStyleLine, removeRetiredInstructionLines } from '../agent/retiredInstructions';
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
  /**
   * Settings › Assistant › "Let the assistant complete payments": off by default. On, the assistant may press a
   * site's final payment button after the user approves that payment in Qutai's dialog (agent/outwardApproval.ts);
   * off, it prepares the order and the user pays. Never changed by the assistant, and not restored from a backup.
   */
  assistantPayments: boolean;
  /**
   * Settings › Assistant › "Let the assistant run scripts on pages": off by default. Off, run_script is refused and kept
   * scripts don't run (docs/page-customisation.md › Scripts). Never changed by the assistant, not restored from a backup.
   */
  assistantScripts: boolean;
  /** Per-site script settings under that switch: scripts off on a site, or allowed on its sensitive pages. */
  scriptSites: ScriptSite[];
  searchEngine: SearchEngineId;
  /** Live suggestions from the search engine while typing; always off in incognito tabs. */
  searchSuggestions: boolean;
  /** Page text size in percent, for every tab. */
  textZoom: number;
  /** The assistant remembers facts about the user across conversations. */
  memoryEnabled: boolean;
  /**
   * The user's standing instructions for the assistant ("Answer briefly"), added to every request below the safety
   * rules (agent/systemPrompt.ts customInstructionsPrompt). Short answers are the assistant's own rule, not a line here (INTRO-34).
   */
  customInstructions: string;
  /** The assistant may use the provider's web search (each search is billed to the user's API key). */
  webSearch: boolean;
  /** Block requests to known ad and tracker servers. */
  blockAds: boolean;
  /** Hide cookie consent banners. */
  hideCookieBanners: boolean;
  /**
   * Remove video ads before the player reads them (supported video sites; content/videoAds.ts, `BLK-29`, `BLK-30`). Off by default (owner,
   * 21 Nov 2026); sites where "Block ads and trackers here" is off are left alone.
   */
  blockVideoAds: boolean;
  /** App appearance; 'system' follows the phone. */
  theme: ThemeSetting;
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
  /** The address bar stays on screen while a page is scrolled down (off: it slides away, `UI` rules). */
  keepAddressBarVisible: boolean;
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
  /**
   * While a task runs: a marker over the page where the assistant clicks or types, shown for a moment before the
   * action (docs/working-mode.md). Off: no marker and no pause. On by default.
   */
  showActionMarker: boolean;
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
  assistantPayments: false,
  assistantScripts: false,
  scriptSites: [],
  searchEngine: 'google',
  searchSuggestions: true,
  textZoom: 100,
  memoryEnabled: true,
  customInstructions: '',
  webSearch: true,
  blockAds: true,
  hideCookieBanners: true,
  blockVideoAds: false,
  theme: 'system',
  addressBarPosition: 'bottom',
  haptics: true,
  httpsOnly: false,
  blockThirdPartyCookies: true,
  appLock: false,
  incognitoLock: false,
  showAssistantButton: true,
  keepAddressBarVisible: false,
  forceZoom: false,
  backgroundPlayback: true,
  pictureInPicture: true,
  backgroundTasks: false,
  notifyTaskDone: true,
  geminiStreaming: false,
  showCost: true,
  showActionMarker: true,
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
  assistantPayments: 'assistant_payments',
  assistantScripts: 'assistant_scripts',
  scriptSites: 'script_sites',
  searchEngine: 'search_engine',
  searchSuggestions: 'search_suggestions',
  textZoom: 'text_zoom',
  memoryEnabled: 'memory_enabled',
  customInstructions: 'custom_instructions',
  webSearch: 'web_search',
  blockAds: 'block_ads',
  hideCookieBanners: 'hide_cookie_banners',
  blockVideoAds: 'block_video_ads',
  theme: 'theme',
  addressBarPosition: 'address_bar_position',
  haptics: 'haptics',
  httpsOnly: 'https_only',
  blockThirdPartyCookies: 'block_third_party_cookies',
  appLock: 'app_lock',
  incognitoLock: 'incognito_lock',
  showAssistantButton: 'show_assistant_button',
  keepAddressBarVisible: 'keep_address_bar_visible',
  forceZoom: 'force_zoom',
  backgroundPlayback: 'background_playback',
  pictureInPicture: 'picture_in_picture',
  backgroundTasks: 'background_tasks',
  notifyTaskDone: 'notify_task_done',
  geminiStreaming: 'gemini_streaming',
  showCost: 'show_cost',
  showActionMarker: 'show_action_marker',
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
  /** '1' once the default answer-style line was taken out of the custom instructions (INTRO-34). */
  defaultStyleLineRemoved: 'default_style_line_removed',
  secretsDeviceOnly: 'secrets_device_only',
  apiKey:(id: ProviderId) => `api_key_${id}`,
  customHeader: (i: number) => `custom_header_${i}`,
  model: (id: ProviderId) => `model_${id}`,
  // Written by the first, Claude-only version of the app.
  legacyApiKey: 'anthropic_api_key',
  legacyModel: 'model',
  // The retired "Animate the logo" switch (the logo now always animates, unless the system reduces motion).
  retiredAnimateLogo: 'animate_logo',
  // The retired trial switch "Asistan görünümü (deneme)" (owner, 21 Nov 2026: the light look stays, the switch goes).
  retiredAssistantLook: 'assistant_look',
  // The retired "Dark sites in dark mode" switch (owner, 23 Nov 2026: sites go dark only through their own dark design).
  retiredDarkSites: 'dark_sites',
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
    blockVideoAds,
    theme,
    addressBarPosition,
    haptics,
    httpsOnly,
    blockThirdPartyCookies,
    appLock,
    incognitoLock,
    showAssistantButton,
    keepAddressBarVisible,
    forceZoom,
    backgroundPlayback,
    pictureInPicture,
    backgroundTasks,
    notifyTaskDone,
    geminiStreaming,
    showCost,
    showActionMarker,
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
    assistantPayments,
    assistantScripts,
    scriptSites,
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
    get(KEYS.blockVideoAds),
    get(KEYS.theme),
    get(KEYS.addressBarPosition),
    get(KEYS.haptics),
    get(KEYS.httpsOnly),
    get(KEYS.blockThirdPartyCookies),
    get(KEYS.appLock),
    get(KEYS.incognitoLock),
    get(KEYS.showAssistantButton),
    get(KEYS.keepAddressBarVisible),
    get(KEYS.forceZoom),
    get(KEYS.backgroundPlayback),
    get(KEYS.pictureInPicture),
    get(KEYS.backgroundTasks),
    get(KEYS.notifyTaskDone),
    get(KEYS.geminiStreaming),
    get(KEYS.showCost),
    get(KEYS.showActionMarker),
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
    get(KEYS.assistantPayments),
    get(KEYS.assistantScripts),
    get(KEYS.scriptSites),
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
    assistantPayments: assistantPayments === 'true',
    assistantScripts: assistantScripts === 'true',
    scriptSites: parseScriptSites(scriptSites as string | null),
    searchEngine: isSearchEngine(searchEngine) ? searchEngine : DEFAULT_SETTINGS.searchEngine,
    searchSuggestions: searchSuggestions !== 'false',
    textZoom: clampTextZoom(Number(textZoom) || DEFAULT_SETTINGS.textZoom),
    memoryEnabled: memoryEnabled !== 'false',
    customInstructions: cleanCustomInstructions(customInstructions ?? ''),
    webSearch: webSearch !== 'false',
    blockAds: blockAds !== 'false',
    hideCookieBanners: hideCookieBanners !== 'false',
    blockVideoAds: blockVideoAds === 'true',
    theme: THEMES.includes(theme as ThemeSetting) ? (theme as ThemeSetting) : 'system',
    addressBarPosition: addressBarPosition === 'top' ? 'top' : 'bottom',
    haptics: haptics !== 'false',
    httpsOnly: httpsOnly === 'true',
    blockThirdPartyCookies: blockThirdPartyCookies !== 'false',
    appLock: appLock === 'true',
    incognitoLock: incognitoLock === 'true',
    showAssistantButton: showAssistantButton !== 'false',
    keepAddressBarVisible: keepAddressBarVisible === 'true',
    forceZoom: forceZoom === 'true',
    backgroundPlayback: backgroundPlayback !== 'false',
    pictureInPicture: pictureInPicture !== 'false',
    backgroundTasks: backgroundTasks === 'true',
    notifyTaskDone: notifyTaskDone !== 'false',
    geminiStreaming: geminiStreaming === 'true',
    showCost: showCost !== 'false',
    showActionMarker: showActionMarker !== 'false',
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

  // Once per install: the "Answer briefly and to the point." line setup used to add (INTRO-34); short answers are the
  // assistant's own rule now. As above, a failed save leaves it out of this session and the next launch tries again.
  if ((await get(KEYS.defaultStyleLineRemoved)) !== '1') {
    try {
      const cleaned = removeDefaultStyleLine(settings.customInstructions);
      if (cleaned !== settings.customInstructions) {
        settings.customInstructions = cleaned;
        await (cleaned
          ? SecureStore.setItemAsync(KEYS.customInstructions, cleaned)
          : SecureStore.deleteItemAsync(KEYS.customInstructions));
      }
      await SecureStore.setItemAsync(KEYS.defaultStyleLineRemoved, '1');
    } catch {}
  }

  await protectStoredSecrets(get).catch(() => {});

  return settings;
}

/**
 * How the AI keys and the custom endpoint's header values are kept (AI-33): like the account session and the backup
 * password, readable after the phone's first unlock and on this device only, so they never move to another phone
 * through a device backup. Reading needs no option (the item is found by its name).
 */
const SECRET_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

/**
 * Once per install: the keys and header values written by earlier builds (with the default protection) are written
 * again with SECRET_OPTIONS. Writing over an item changes its protection in place, so nothing is removed first and a
 * failure loses nothing; the mark is only set when every write worked, else the next launch tries again.
 */
async function protectStoredSecrets(get: (key: string) => Promise<string | null>): Promise<void> {
  if ((await get(KEYS.secretsDeviceOnly)) === '1') return;
  const keys = [
    ...PROVIDER_ORDER.map((id) => KEYS.apiKey(id)),
    ...Array.from({ length: MAX_CUSTOM_HEADERS }, (_, i) => KEYS.customHeader(i)),
  ];
  for (const key of keys) {
    const value = await get(key);
    if (value) await SecureStore.setItemAsync(key, value, SECRET_OPTIONS);
  }
  await SecureStore.setItemAsync(KEYS.secretsDeviceOnly, '1');
}

export async function saveSettings(settings: Settings): Promise<void> {
  const set = (key: string, value: string) =>
    value ? SecureStore.setItemAsync(key, value) : SecureStore.deleteItemAsync(key);
  const setSecret = (key: string, value: string) =>
    value ? SecureStore.setItemAsync(key, value, SECRET_OPTIONS) : SecureStore.deleteItemAsync(key);
  await Promise.all([
    set(KEYS.provider, settings.provider),
    set(KEYS.customBaseUrl, settings.customBaseUrl),
    set(KEYS.customImages, String(settings.customImages)),
    ...Array.from({ length: MAX_CUSTOM_HEADERS }, (_, i) => {
      const h = cleanCustomHeaders(settings.customHeaders)[i];
      return setSecret(KEYS.customHeader(i), h ? JSON.stringify({ name: h.name, value: h.value }) : '');
    }),
    set(KEYS.confirmActions, String(settings.confirmActions)),
    set(KEYS.alwaysAllow, serializeAlwaysAllow(settings.alwaysAllow)),
    set(KEYS.assistantPayments, settings.assistantPayments ? 'true' : ''),
    set(KEYS.assistantScripts, settings.assistantScripts ? 'true' : ''),
    set(KEYS.scriptSites, JSON.stringify(cleanScriptSites(settings.scriptSites))),
    set(KEYS.searchEngine, settings.searchEngine),
    set(KEYS.searchSuggestions, String(settings.searchSuggestions)),
    set(KEYS.textZoom, String(settings.textZoom)),
    set(KEYS.memoryEnabled, String(settings.memoryEnabled)),
    set(KEYS.customInstructions, cleanCustomInstructions(settings.customInstructions)),
    set(KEYS.webSearch, String(settings.webSearch)),
    set(KEYS.blockAds, String(settings.blockAds)),
    set(KEYS.hideCookieBanners, String(settings.hideCookieBanners)),
    set(KEYS.blockVideoAds, String(settings.blockVideoAds)),
    set(KEYS.theme, settings.theme),
    set(KEYS.addressBarPosition, settings.addressBarPosition),
    set(KEYS.haptics, String(settings.haptics)),
    set(KEYS.httpsOnly, String(settings.httpsOnly)),
    set(KEYS.blockThirdPartyCookies, String(settings.blockThirdPartyCookies)),
    set(KEYS.appLock, String(settings.appLock)),
    set(KEYS.incognitoLock, String(settings.incognitoLock)),
    set(KEYS.showAssistantButton, String(settings.showAssistantButton)),
    set(KEYS.keepAddressBarVisible, String(settings.keepAddressBarVisible)),
    set(KEYS.forceZoom, String(settings.forceZoom)),
    set(KEYS.backgroundPlayback, String(settings.backgroundPlayback)),
    set(KEYS.pictureInPicture, String(settings.pictureInPicture)),
    set(KEYS.backgroundTasks, String(settings.backgroundTasks)),
    set(KEYS.notifyTaskDone, String(settings.notifyTaskDone)),
    set(KEYS.geminiStreaming, String(settings.geminiStreaming)),
    set(KEYS.showCost, String(settings.showCost)),
    set(KEYS.showActionMarker, String(settings.showActionMarker)),
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
      setSecret(KEYS.apiKey(id), settings.apiKeys[id]),
      set(KEYS.model(id), settings.models[id]),
    ]),
    // Migrated into the per-provider keys above.
    SecureStore.deleteItemAsync(KEYS.legacyApiKey),
    SecureStore.deleteItemAsync(KEYS.legacyModel),
    SecureStore.deleteItemAsync(KEYS.retiredAnimateLogo),
    SecureStore.deleteItemAsync(KEYS.retiredAssistantLook),
  ]);
}

/** A site's own script setting (Settings › Assistant › Scripts › Sites). */
export type ScriptSite = { host: string; setting: 'off' | 'sensitive' };

export function cleanScriptSites(value: unknown): ScriptSite[] {
  if (!Array.isArray(value)) return [];
  const out = new Map<string, ScriptSite>();
  for (const raw of value.slice(0, 200)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const host = typeof r.host === 'string' ? r.host.trim().toLowerCase().replace(/^www\./, '') : '';
    if (!host || host.length > 253 || /[\s/]/.test(host)) continue;
    if (r.setting !== 'off' && r.setting !== 'sensitive') continue;
    out.set(host, { host, setting: r.setting });
  }
  return [...out.values()].sort((a, b) => a.host.localeCompare(b.host));
}

function parseScriptSites(text: string | null): ScriptSite[] {
  if (!text) return [];
  try {
    return cleanScriptSites(JSON.parse(text));
  } catch {
    return [];
  }
}

/**
 * A change to the settings, applied to the settings as they are when it lands, never to a copy from an earlier render
 * (DATA-28): a value, or a function of the current settings (for a change that depends on them).
 */
export type SettingsPatch = Partial<Settings> | ((current: Settings) => Partial<Settings>);
