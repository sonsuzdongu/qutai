import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import type { Tab } from '../browser/Tab';

export async function shareLink(tab: Tab): Promise<void> {
  // iOS shows `url` as a link preview; Android only reads `message`.
  await Share.share({ title: tab.title || undefined, message: tab.url, url: tab.url });
}

export async function copyLink(tab: Tab): Promise<void> {
  await Clipboard.setStringAsync(tab.url);
}
