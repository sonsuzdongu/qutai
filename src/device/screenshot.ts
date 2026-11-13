import { File } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import type { Tab } from '../browser/Tab';

/**
 * Saves the visible part of the tab to the photo library. Only add-only access is
 * requested, so the app never gets to read the user's photos.
 */
export async function saveScreenshot(tab: Tab): Promise<void> {
  if (!tab.container) throw new Error('Sekme henüz hazır değil.');

  const permission = await requestPermissionsAsync(true, ['photo']);
  if (!permission.granted) throw new Error("Fotoğraflara kaydetme izni verilmedi. Ayarlar'dan izin verebilirsiniz.");

  const uri = await captureRef(tab.container, { format: 'png', quality: 1, result: 'tmpfile' });
  try {
    await Asset.create(uri);
  } finally {
    const file = new File(uri);
    if (file.exists) file.delete();
  }
}
