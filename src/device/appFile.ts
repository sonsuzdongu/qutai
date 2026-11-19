import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { APP_FILE_EXTENSION, APP_FILE_MAX_BYTES, APP_FILE_MIME, APP_FILE_UTI, AppFileError } from '../apps/appFile';
import { PickerUnavailableError } from './bookmarksFile';

/**
 * `.qutaiapp` files on the phone (docs/mini-apps.md › Phase 2): picking one in My apps, reading one opened from outside
 * (iOS: a copy in Documents/Inbox, handed over as a file:// URL; Android: a content:// or file:// address from a VIEW
 * intent) or from Qutai's downloads, and sharing an export through the system sheet. Reading checks the size first.
 */

export { PickerUnavailableError };

export type PickedAppFile = { bytes: Uint8Array; name: string };

/** The last part of an address, decoded, for "Imported from <file>". */
export function fileNameOf(uri: string): string {
  const last = uri.split(/[?#]/)[0].split('/').pop() ?? '';
  try {
    return decodeURIComponent(last) || `app.${APP_FILE_EXTENSION}`;
  } catch {
    return last || `app.${APP_FILE_EXTENSION}`;
  }
}

async function readChecked(file: File): Promise<Uint8Array> {
  let size: number | null = null;
  try {
    size = file.size;
  } catch {
    // Some content:// providers can't tell the size up front: the length is checked after reading.
  }
  if (size !== null && size > APP_FILE_MAX_BYTES) throw new AppFileError('too-large', `${size} bytes`);
  const bytes = await file.bytes();
  if (bytes.length > APP_FILE_MAX_BYTES) throw new AppFileError('too-large', `${bytes.length} bytes`);
  return bytes;
}

/** Lets the user pick a file; null when they cancelled. The picker's copy is removed afterwards. */
export async function pickAppFile(): Promise<PickedAppFile | null> {
  let DocumentPicker: typeof import('expo-document-picker');
  try {
    DocumentPicker = await import('expo-document-picker');
  } catch {
    throw new PickerUnavailableError();
  }
  // Older file apps don't know the type, so anything can be picked; the contents decide.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    return { bytes: await readChecked(file), name: asset.name || fileNameOf(asset.uri) };
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {}
  }
}

/**
 * Reads a file opened from outside or a finished download. iOS's copy in Documents/Inbox is Qutai's to remove (it was
 * made for this opening); anything else (a download, another app's content://) is left where it is.
 */
export async function readAppFileUri(uri: string): Promise<PickedAppFile> {
  const file = new File(uri);
  let name = fileNameOf(uri);
  try {
    // A content:// address is an opaque id; the provider's display name is the file's real name.
    if (file.name && /\.\w+$/.test(file.name)) name = file.name;
  } catch {}
  try {
    return { bytes: await readChecked(file), name };
  } finally {
    if (Platform.OS === 'ios' && /\/Documents\/Inbox\//.test(uri)) {
      try {
        if (file.exists) file.delete();
      } catch {}
    }
  }
}

/** Shares an export through the system sheet (save to Files, Drive, AirDrop, mail…); the temporary copy goes after. */
export async function shareAppFile(text: string, fileName: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType: APP_FILE_MIME, UTI: APP_FILE_UTI, dialogTitle: fileName });
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {}
  }
}
