import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PickerUnavailableError } from './bookmarksFile';

export { PickerUnavailableError };

/** Larger files are refused before reading (a real backup is a few megabytes). */
const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

export class BackupTooLargeError extends Error {}

/** Lets the user pick a backup file and returns its bytes, or null if they cancelled. */
export async function pickBackupFile(): Promise<Uint8Array | null> {
  let DocumentPicker: typeof import('expo-document-picker');
  try {
    DocumentPicker = await import('expo-document-picker');
  } catch {
    throw new PickerUnavailableError();
  }
  // File apps don't know the .qutai type, so anything can be picked; the header decides.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const file = new File(result.assets[0].uri);
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new BackupTooLargeError();
    return await file.bytes();
  } finally {
    // The picker's copy in the cache is ours to clean up.
    try {
      if (file.exists) file.delete();
    } catch {}
  }
}

/** Shares an encrypted backup (to Files, Drive, AirDrop…); the temporary copy is removed afterwards. */
export async function shareBackupFile(bytes: Uint8Array, fileName: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  try {
    if (file.exists) file.delete();
    file.create();
    await file.write(bytes);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/octet-stream',
      UTI: 'public.data',
      dialogTitle: fileName,
    });
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {}
  }
}
