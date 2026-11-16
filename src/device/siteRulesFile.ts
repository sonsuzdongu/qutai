import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MAX_EXPORT_BYTES } from '../content/siteRules';
import { PickerUnavailableError } from './bookmarksFile';

export { PickerUnavailableError };

export class RulesFileTooLargeError extends Error {}

/** Shares the exported rules as a .txt file (to Files, Drive, another app…); the temporary copy is removed afterwards. */
export async function shareRulesFile(text: string, fileName: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  try {
    if (file.exists) file.delete();
    file.create();
    await file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: fileName });
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {}
  }
}

/** Lets the user pick a rules file and returns its text, or null if they cancelled. */
export async function pickRulesFile(): Promise<string | null> {
  let DocumentPicker: typeof import('expo-document-picker');
  try {
    DocumentPicker = await import('expo-document-picker');
  } catch {
    throw new PickerUnavailableError();
  }
  // Lists come as .txt or without a known type; anything can be picked, the lines decide.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const file = new File(result.assets[0].uri);
  try {
    if (file.size > MAX_EXPORT_BYTES) throw new RulesFileTooLargeError();
    return await file.text();
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {}
  }
}
