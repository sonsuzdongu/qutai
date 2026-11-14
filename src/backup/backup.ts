import { reloadAppAsync } from 'expo';
import { PROVIDER_ORDER } from '../ai/providers';
import type { ProviderId } from '../ai/types';
import type { ReaderFont, ReaderTheme } from '../browser/reader';
import type { SearchEngineId } from '../browser/search';
import { appVersion } from '../device/appVersion';
import { shareBackupFile } from '../device/backupFile';
import { getDb, holdDb } from '../storage/db';
import { clampTextZoom, DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from '../storage/settings';
import { decryptBackup, encryptBackup, Progress } from './crypto';
import { applyBackup, ApplyMode, collectBackup, ExportChoice } from './database';
import { BackupPayload, BackupSettings, PAYLOAD_VERSION, parseBackup, serializeBackup } from './payload';

/** The installed development build has no expo-crypto yet (it was added after the build was made). */
export class CryptoUnavailableError extends Error {}

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

/** Shortest password accepted for a backup. */
export const MIN_BACKUP_PASSWORD = 10;

export type ExportOptions = ExportChoice & { apiKeys: boolean };

/** The preferences that go into a backup (locks, first-run and legal state stay with the phone). */
function backupSettings(s: Settings): BackupSettings {
  return {
    provider: s.provider,
    models: { ...s.models },
    confirmActions: s.confirmActions,
    searchEngine: s.searchEngine,
    searchSuggestions: s.searchSuggestions,
    textZoom: s.textZoom,
    memoryEnabled: s.memoryEnabled,
    webSearch: s.webSearch,
    blockAds: s.blockAds,
    hideCookieBanners: s.hideCookieBanners,
    theme: s.theme,
    darkSites: s.darkSites,
    addressBarPosition: s.addressBarPosition,
    haptics: s.haptics,
    httpsOnly: s.httpsOnly,
    blockThirdPartyCookies: s.blockThirdPartyCookies,
    showAssistantButton: s.showAssistantButton,
    animateLogo: s.animateLogo,
    forceZoom: s.forceZoom,
    readerTheme: s.readerTheme,
    readerFont: s.readerFont,
    readerEasyReading: s.readerEasyReading,
  };
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Builds the encrypted backup and opens the share sheet to save it. */
export async function exportBackup(options: ExportOptions, password: string, onProgress?: Progress): Promise<void> {
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
  }
  const file = await encryptBackup(
    new TextEncoder().encode(serializeBackup(payload)),
    password,
    osRandomBytes,
    onProgress,
  );
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
 * Keys are never removed.
 */
export function mergeSettings(current: Settings, p: BackupPayload, mode: ApplyMode, withKeys: boolean): Settings {
  const next: Settings = { ...current, apiKeys: { ...current.apiKeys }, models: { ...current.models } };
  const take = <K extends keyof Settings>(key: K, value: Settings[K] | undefined) => {
    if (value === undefined) return;
    if (mode === 'replace' || current[key] === DEFAULT_SETTINGS[key]) next[key] = value;
  };
  const s = p.settings;
  if (s) {
    take('provider', s.provider);
    take('confirmActions', s.confirmActions);
    take('searchEngine', s.searchEngine as SearchEngineId | undefined);
    take('searchSuggestions', s.searchSuggestions);
    take('textZoom', s.textZoom === undefined ? undefined : clampTextZoom(s.textZoom));
    take('memoryEnabled', s.memoryEnabled);
    take('webSearch', s.webSearch);
    take('blockAds', s.blockAds);
    take('hideCookieBanners', s.hideCookieBanners);
    take('theme', s.theme);
    take('darkSites', s.darkSites);
    take('addressBarPosition', s.addressBarPosition);
    take('haptics', s.haptics);
    take('httpsOnly', s.httpsOnly);
    take('blockThirdPartyCookies', s.blockThirdPartyCookies);
    take('showAssistantButton', s.showAssistantButton);
    take('animateLogo', s.animateLogo);
    take('forceZoom', s.forceZoom);
    take('readerTheme', s.readerTheme as ReaderTheme | undefined);
    take('readerFont', s.readerFont as ReaderFont | undefined);
    take('readerEasyReading', s.readerEasyReading);
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
  return next;
}

/**
 * Restores a validated backup: the database part in one transaction (on failure nothing changed, the
 * database is released and the error is thrown), then preferences and keys. After success the database
 * stays held until reloadApp() reads everything again. Returns false if the preferences couldn't be saved.
 */
export async function restoreBackup(p: BackupPayload, mode: ApplyMode, withKeys: boolean): Promise<boolean> {
  const db = await getDb();
  // Nothing else in the running app may write from here on (it would overwrite restored data).
  const release = holdDb();
  try {
    await applyBackup(db, p, mode);
  } catch (e) {
    release();
    throw e;
  }
  if (!p.settings && !(withKeys && p.apiKeys)) return true;
  try {
    await saveSettings(mergeSettings(await loadSettings(), p, mode, withKeys));
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
