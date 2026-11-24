import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';
import type { Tab } from '../browser/Tab';
import { shareContent, type ShareRequest } from '../browser/webShare';

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

/** A page's navigator.share (browser/webShare.ts): the system share sheet; false when the user dismissed it (iOS). */
export async function shareFromPage(req: ShareRequest): Promise<boolean> {
  const content = shareContent(req);
  // iOS shows the address as its own item (a link preview), so the message keeps only the text there.
  const ios = Platform.OS === 'ios' && req.url;
  const result = await Share.share(
    ios ? { title: content.title, message: req.text || undefined, url: req.url } : content,
    content.title ? { dialogTitle: content.title, subject: content.title } : undefined,
  );
  return result.action !== Share.dismissedAction;
}
