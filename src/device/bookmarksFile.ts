import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** The installed app build has no document picker yet (it was added after it was built). */
export class PickerUnavailableError extends Error {}

/** Lets the user pick an exported bookmark file and returns its text, or null if they cancelled. */
export async function pickBookmarkFile(): Promise<string | null> {
  // Loaded on first use, so a development build made before expo-document-picker was added still starts.
  let DocumentPicker: typeof import('expo-document-picker');
  try {
    DocumentPicker = await import('expo-document-picker');
  } catch {
    throw new PickerUnavailableError();
  }
  const result = await DocumentPicker.getDocumentAsync({
    // File apps label the export as HTML, plain text or nothing at all, so anything can be picked; the parser decides.
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const file = new File(result.assets[0].uri);
  try {
    return await file.text();
  } finally {
    // The picker's copy in the cache is ours to clean up.
    try {
      if (file.exists) file.delete();
    } catch {}
  }
}

/** Shares a bookmark file (e.g. to Files, AirDrop or email); the temporary copy is removed afterwards. */
export async function shareBookmarkFile(html: string, fileName: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  try {
    if (file.exists) file.delete();
    file.create();
    await file.write(html);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/html', UTI: 'public.html', dialogTitle: fileName });
  } finally {
    if (file.exists) file.delete();
  }
}
