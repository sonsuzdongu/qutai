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

/**
 * Only the user copies text, through buttons in the UI. The agent deliberately has no
 * clipboard tool: a malicious page could steer it into swapping a copied IBAN or wallet address.
 */
export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export async function shareText(text: string): Promise<void> {
  await Share.share({ message: text });
}
