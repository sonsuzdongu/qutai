import { reloadAppAsync } from 'expo';
import { ALLOW_CLEARTEXT } from '../ai/custom';
import { normalizeBaseUrl } from '../ai/customEndpoint';
import { PROVIDER_ORDER } from '../ai/providers';
import type { ProviderId } from '../ai/types';
import type { ReaderFont, ReaderTheme } from '../browser/reader';
import type { SearchEngineId } from '../browser/search';
import { appVersion } from '../device/appVersion';
import { loadScriptKey } from '../device/scriptKey';
import { shareBackupFile } from '../device/backupFile';
import { getDb, holdDb } from '../storage/db';
import { clampTextZoom, DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from '../storage/settings';
import { decryptBackup, encryptBackup, Progress } from './crypto';
import { applyBackup, ApplyMode, collectBackup, ExportChoice } from './database';
import { BackupPayload, BackupSettings, PAYLOAD_VERSION, parseBackup, serializeBackup } from './payload';

/** The installed development build has no expo-crypto yet (it was added after the build was made). */
export class CryptoUnavailableError extends Error {
  constructor() {
    super('crypto unavailable');
    this.name = 'CryptoUnavailableError';
  }
}

/** Random bytes from the OS. Loaded on first use, so an older development build still starts. */
async function osRandomBytes(length: number): Promise<Uint8Array> {
  let Crypto: typeof import('expo-crypto');
  try {
    Crypto = await import('expo-crypto');
  } catch {
    throw new CryptoUnavailableError();
  }
  return Crypto.getRandomBytesAsync(length);
}

/** Shortest password accepted for a backup (shared with the server backup, server/logic.ts). */
export { MIN_BACKUP_PASSWORD } from './server/logic';

export type ExportOptions = ExportChoice & { apiKeys: boolean };

/**
 * Where each setting goes in a backup (DATA-3, DATA-5): 'backup' travels in every backup (backupSettings, mergeSettings and
 * payload.ts's BOOLEAN_SETTINGS / parseSettings agree with it, scripts/backup-tests/policy.test.ts), 'keys' only when
 * the user includes the API keys, 'phone' never leaves this phone. A Record over every key of Settings, so a new
 * setting doesn't compile until someone decides where it goes.
 */
export const BACKUP_POLICY = {
  provider: 'backup',
  apiKeys: 'keys',
  models: 'backup',
  customBaseUrl: 'backup',
  customImages: 'backup',
  customHeaders: 'keys',
  confirmActions: 'backup',
  // "Don't ask again" and per-site script settings travel (owner, 25 Nov 2026); the two switches stay (PAY-7, SCR-*).
  alwaysAllow: 'backup',
  assistantPayments: 'phone',
  assistantScripts: 'phone',
  scriptSites: 'backup',
  searchEngine: 'backup',
  searchSuggestions: 'backup',
  textZoom: 'backup',
  memoryEnabled: 'backup',
  customInstructions: 'backup',
  webSearch: 'backup',
  blockAds: 'backup',
  hideCookieBanners: 'backup',
  blockVideoAds: 'backup',
  theme: 'backup',
  addressBarPosition: 'backup',
  haptics: 'backup',
  httpsOnly: 'backup',
  blockThirdPartyCookies: 'backup',
  // The locks stay with the phone (INC-27).
  appLock: 'phone',
  incognitoLock: 'phone',
  showAssistantButton: 'backup',
  forceZoom: 'backup',
  backgroundPlayback: 'backup',
  autoplaySound: 'backup',
  pictureInPicture: 'backup',
  backgroundTasks: 'backup',
  notifyTaskDone: 'backup',
  geminiStreaming: 'backup',
  showCost: 'backup',
  showActionMarker: 'backup',
  readerTheme: 'backup',
  readerFont: 'backup',
  readerEasyReading: 'backup',
  voiceAutoSend: 'backup',
  // The answer about the phone's online speech service: each phone asks again.
  voiceOnline: 'phone',
  voiceLanguage: 'backup',
  voiceLastLanguage: 'backup',
  voiceHoldToTalk: 'backup',
  // First-run and legal state stay with the phone.
  onboarded: 'phone',
  legalAcceptedVersion: 'phone',
} as const satisfies Record<keyof Settings, 'backup' | 'keys' | 'phone'>;

type Policy = typeof BACKUP_POLICY;
/** The settings BACKUP_POLICY sends in every backup. */
export type BackedUpSetting = { [K in keyof Policy]: Policy[K] extends 'backup' ? K : never }[keyof Policy];
/** Every backed-up setting has a place in the backup payload, and the payload carries no other setting. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const POLICY_MATCHES_PAYLOAD: Same<BackedUpSetting, Exclude<keyof BackupSettings, 'retiredInstructionsRemoved'>> = true;

/** The preferences that go into a backup (BACKUP_POLICY 'backup'; locks, first-run and legal state stay with the phone). */
export function backupSettings(s: Settings): BackupSettings {
  return {
    provider: s.provider,
    models: { ...s.models },
    ...(s.customBaseUrl ? { customBaseUrl: s.customBaseUrl } : {}),
    confirmActions: s.confirmActions,
    searchEngine: s.searchEngine,
    searchSuggestions: s.searchSuggestions,
    textZoom: s.textZoom,
    memoryEnabled: s.memoryEnabled,
    customInstructions: s.customInstructions,
    // This phone already took out the retired example lines (settings.ts), so a restore leaves the text as it is.
    retiredInstructionsRemoved: true,
    webSearch: s.webSearch,
    blockAds: s.blockAds,
    hideCookieBanners: s.hideCookieBanners,
    blockVideoAds: s.blockVideoAds,
    theme: s.theme,
    addressBarPosition: s.addressBarPosition,
    haptics: s.haptics,
    httpsOnly: s.httpsOnly,
    blockThirdPartyCookies: s.blockThirdPartyCookies,
    showAssistantButton: s.showAssistantButton,
    forceZoom: s.forceZoom,
    backgroundPlayback: s.backgroundPlayback,
    autoplaySound: s.autoplaySound,
    pictureInPicture: s.pictureInPicture,
    readerTheme: s.readerTheme,
    readerFont: s.readerFont,
    readerEasyReading: s.readerEasyReading,
    // The answer about the phone's online speech service stays on this phone: each phone asks again.
    voiceAutoSend: s.voiceAutoSend,
    voiceHoldToTalk: s.voiceHoldToTalk,
    // In backups since 25 Nov 2026 (owner); older backups leave this phone's values.
    alwaysAllow: [...s.alwaysAllow],
    scriptSites: s.scriptSites.map((x) => ({ ...x })),
    backgroundTasks: s.backgroundTasks,
    notifyTaskDone: s.notifyTaskDone,
    geminiStreaming: s.geminiStreaming,
    showCost: s.showCost,
    showActionMarker: s.showActionMarker,
    voiceLanguage: s.voiceLanguage,
    voiceLastLanguage: s.voiceLastLanguage,
    customImages: s.customImages,
  };
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Builds the encrypted backup file: the same bytes for the file export and the server backup (docs/server-backup.md),
 * so either can be restored from the other.
 */
export async function buildBackupFile(options: ExportOptions, password: string, onProgress?: Progress): Promise<Uint8Array> {
  const db = await getDb();
  const settings = await loadSettings();
  const payload: BackupPayload = {
    app: 'qutai',
    payloadVersion: PAYLOAD_VERSION,
    createdAt: Date.now(),
    appVersion: appVersion().version,
    ...(await collectBackup(db, options)),
    settings: backupSettings(settings),
  };
  if (options.apiKeys) {
    const keys: Partial<Record<ProviderId, string>> = {};
    for (const id of PROVIDER_ORDER) if (settings.apiKeys[id]) keys[id] = settings.apiKeys[id];
    if (Object.keys(keys).length) payload.apiKeys = keys;
    // The custom endpoint's extra headers can hold tokens, so they go only where the keys go.
    if (settings.customHeaders.length) payload.customHeaders = settings.customHeaders;
  }
  return encryptBackup(new TextEncoder().encode(serializeBackup(payload)), password, osRandomBytes, onProgress);
}

/** Random bytes from the OS for callers outside this file (the server backup's upload id). */
export const randomBytes = osRandomBytes;

/** Builds the encrypted backup and opens the share sheet to save it. */
export async function exportBackup(options: ExportOptions, password: string, onProgress?: Progress): Promise<void> {
  const file = await buildBackupFile(options, password, onProgress);
  await shareBackupFile(file, `qutai-backup-${localDate(new Date())}.qutai`);
}

/** Decrypts and validates a backup file; throws BackupError or PayloadError, writes nothing. */
export async function openBackup(file: Uint8Array, password: string, onProgress?: Progress): Promise<BackupPayload> {
  const plaintext = await decryptBackup(file, password, onProgress);
  return parseBackup(new TextDecoder().decode(plaintext));
}

/**
 * Applies the backup's preferences. Merge: a preference from the backup is used only where this phone
 * still has the default (what was changed here stays). Replace: the backup's preferences win.
 * Keys: merge fills in providers without a key here; replace overwrites the ones the backup has.
 * Keys are never removed. The custom endpoint's extra headers go with the keys: merge takes them only when this
 * phone has none, replace takes the backup's list.
 */
export function mergeSettings(current: Settings, p: BackupPayload, mode: ApplyMode, withKeys: boolean): Settings {
  const next: Settings = { ...current, apiKeys: { ...current.apiKeys }, models: { ...current.models } };
  const take = <K extends keyof Settings>(key: K, value: Settings[K] | undefined) => {
    if (value === undefined) return;
    if (mode === 'replace' || current[key] === DEFAULT_SETTINGS[key]) next[key] = value;
  };
  const s = p.settings;
  if (s) {
    // A provider this build doesn't offer (Qutai Credits outside pro mode) is left as it is here.
    if (s.provider && PROVIDER_ORDER.includes(s.provider)) take('provider', s.provider);
    take('confirmActions', s.confirmActions);
    take('searchEngine', s.searchEngine as SearchEngineId | undefined);
    take('searchSuggestions', s.searchSuggestions);
    take('textZoom', s.textZoom === undefined ? undefined : clampTextZoom(s.textZoom));
    take('memoryEnabled', s.memoryEnabled);
    take('customInstructions', s.customInstructions);
    take('webSearch', s.webSearch);
    take('blockAds', s.blockAds);
    take('hideCookieBanners', s.hideCookieBanners);
    take('blockVideoAds', s.blockVideoAds);
    take('theme', s.theme);
    take('addressBarPosition', s.addressBarPosition);
    take('haptics', s.haptics);
    take('httpsOnly', s.httpsOnly);
    take('blockThirdPartyCookies', s.blockThirdPartyCookies);
    take('showAssistantButton', s.showAssistantButton);
    take('forceZoom', s.forceZoom);
    take('backgroundPlayback', s.backgroundPlayback);
    take('autoplaySound', s.autoplaySound);
    take('pictureInPicture', s.pictureInPicture);
    take('readerTheme', s.readerTheme as ReaderTheme | undefined);
    take('readerFont', s.readerFont as ReaderFont | undefined);
    take('readerEasyReading', s.readerEasyReading);
    take('voiceAutoSend', s.voiceAutoSend);
    take('voiceHoldToTalk', s.voiceHoldToTalk);
    take('backgroundTasks', s.backgroundTasks);
    take('notifyTaskDone', s.notifyTaskDone);
    take('geminiStreaming', s.geminiStreaming);
    take('showCost', s.showCost);
    take('showActionMarker', s.showActionMarker);
    take('voiceLanguage', s.voiceLanguage);
    take('voiceLastLanguage', s.voiceLastLanguage);
    take('customImages', s.customImages);
    // Lists: merge takes the backup's only where this phone has none (its own choices stay); replace takes it.
    if (s.alwaysAllow && (mode === 'replace' || !current.alwaysAllow.length)) next.alwaysAllow = [...s.alwaysAllow];
    if (s.scriptSites && (mode === 'replace' || !current.scriptSites.length)) next.scriptSites = s.scriptSites.map((x) => ({ ...x }));
    if (s.customBaseUrl && normalizeBaseUrl(s.customBaseUrl, { allowCleartext: ALLOW_CLEARTEXT }).ok)
      take('customBaseUrl', s.customBaseUrl);
    for (const id of PROVIDER_ORDER) {
      const model = s.models?.[id];
      if (model && (mode === 'replace' || current.models[id] === DEFAULT_SETTINGS.models[id])) next.models[id] = model;
    }
  }
  if (withKeys && p.apiKeys) {
    for (const id of PROVIDER_ORDER) {
      const key = p.apiKeys[id];
      if (key && (mode === 'replace' || !current.apiKeys[id])) next.apiKeys[id] = key;
    }
  }
  if (withKeys && p.customHeaders && (mode === 'replace' || !current.customHeaders.length))
    next.customHeaders = p.customHeaders;
  return next;
}

/**
 * Restores a validated backup: the database part in one transaction (on failure nothing changed, the
 * database is released and the error is thrown), then preferences and keys. After success the database
 * stays held until reloadApp() reads everything again. Returns false if the preferences couldn't be saved.
 * `prepare`: the settings the restored ones are applied to, instead of the stored ones (a restore from setup passes
 * setup's finished settings, so they are saved only if the data was restored, in the same write).
 */
export async function restoreBackup(
  p: BackupPayload,
  mode: ApplyMode,
  withKeys: boolean,
  prepare?: (stored: Settings) => Settings,
  /**
   * Extra writes that belong to the restore, run with the restore's own database handle before anything else. The
   * database is held from here until the app restarts, so a write that calls getDb() itself would wait forever.
   */
  after?: (db: Awaited<ReturnType<typeof getDb>>) => Promise<void>,
): Promise<boolean> {
  const db = await getDb();
  // Nothing else in the running app may write from here on (it would overwrite restored data).
  const release = holdDb();
  try {
    await applyBackup(db, p, mode, Date.now(), await loadScriptKey());
  } catch (e) {
    release();
    throw e;
  }
  // Never fails the restore: the data is in, and the app must still restart.
  if (after) await after(db).catch(() => {});
  if (!prepare && !p.settings && !(withKeys && (p.apiKeys || p.customHeaders))) return true;
  try {
    const stored = await loadSettings();
    await saveSettings(mergeSettings(prepare ? prepare(stored) : stored, p, mode, withKeys));
    return true;
  } catch {
    return false;
  }
}

/** Starts the app again from storage, so every screen, tab and conversation shows the restored data. */
export async function reloadApp(): Promise<boolean> {
  try {
    await reloadAppAsync('Backup restored');
    return true;
  } catch {
    return false;
  }
}
