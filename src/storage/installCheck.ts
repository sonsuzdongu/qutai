import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { DatabaseState, installAction, MARKER_DONE, MARKER_PENDING, MarkerState, parseMarker } from './installState';
import { setSecureStoreGate } from './secureStoreGate';
import { secureSettingKeys } from './settings';

/**
 * iOS keeps Keychain items when an app is deleted; this makes delete-and-reinstall a clean start (as on Android).
 * The decision is in installState.ts. Runs from i18n/startup.ts, the first module the entry file imports, so the
 * database file is checked before anything opens (and so creates) it, for every entry point (app, widget link,
 * share, background task). Android clears secure storage on uninstall itself, so this is iOS only.
 */

// Every key Qutai has ever written to secure storage outside settings.ts (keep in step with those files).
const OTHER_KEYS = [
  'account_session', // account/storage.ts
  'account_device_id', // account/storage.ts
  'credits_disclosure_accepted', // credits/index.ts
  'credits_pending_purchases', // purchases/index.ts
  'webview_user_agent', // browser/userAgent.ts (Android only, listed for completeness)
];

export function allSecureStoreKeys(): string[] {
  return [...secureSettingKeys(), ...OTHER_KEYS];
}

function markerFile(): File {
  return new File(Paths.document, '.qutai-install');
}

function readMarker(): MarkerState {
  try {
    const f = markerFile();
    return parseMarker(f.exists ? f.textSync() : null);
  } catch {
    return 'unknown';
  }
}

function databaseState(): DatabaseState {
  try {
    // expo-sqlite's default folder on iOS: <documents>/SQLite (storage/db.ts opens 'qutai.db' there).
    const docs = new Directory(Paths.document);
    if (!docs.exists) return 'unknown';
    return new File(Paths.document, 'SQLite', 'qutai.db').exists ? 'present' : 'missing';
  } catch {
    return 'unknown';
  }
}

async function wipe(): Promise<void> {
  // Pending first: if the app is closed half-way, the next launch finishes the wipe (the database exists by then).
  markerFile().writeSync(MARKER_PENDING);
  const results = await Promise.allSettled(allSecureStoreKeys().map((k) => SecureStore.deleteItemAsync(k)));
  if (results.every((r) => r.status === 'fulfilled')) markerFile().writeSync(MARKER_DONE);
}

export function startInstallCheck(): void {
  if (Platform.OS !== 'ios') return;
  const action = installAction(readMarker(), databaseState());
  if (action === 'none') return;
  if (action === 'markExisting') {
    try {
      markerFile().writeSync(MARKER_DONE);
    } catch {}
    return;
  }
  setSecureStoreGate((async () => wipe())());
}
