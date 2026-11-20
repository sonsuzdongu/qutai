import { requireOptionalNativeModule } from 'expo';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import { commonMimeType, textTravelsWithFiles, WHATSAPP_PACKAGES, type ShareApp } from '../chat/shareable';
import { t } from '../i18n';
import { copyText } from './link';
import type { OutgoingFile } from './outgoing';

/**
 * Shares prepared files (src/device/outgoing.ts) and text to another app, only ever from the user's tap on a card
 * or as the fallback of an email draft: the user picks the app (or WhatsApp opens), picks the chat or recipient
 * there, and sends. Nothing is sent by Qutai.
 *
 * expo-sharing shares one file and no text, so the qutai-entry module does it (Android: ACTION_SEND /
 * ACTION_SEND_MULTIPLE with EXTRA_TEXT, sent to WhatsApp's package when asked; iOS: the share sheet with the text and
 * every file). A build without that function falls back to expo-sharing for a single file.
 */

type ShareFilesOptions = {
  paths: string[];
  mimeType: string;
  text?: string;
  subject?: string;
  emails?: string[];
  targets?: string[];
  chooserTitle?: string;
};

type QutaiShareModule = { shareFiles?(options: ShareFilesOptions): string | Promise<string> };

const native = requireOptionalNativeModule<QutaiShareModule>('QutaiEntry');

/** This build can't share several files, or text with files (a newer build is needed). */
export class ShareNeedsBuildError extends Error {}

export type ShareResult = {
  /** "com.whatsapp" / "com.whatsapp.w4b" (Android, sent straight there), "chooser" (Android), an iOS activity type, or "cancelled". */
  via: string;
  /** The text was copied to the clipboard because it may not travel with the files. */
  textCopied: boolean;
};

export async function shareToApp(options: {
  files: OutgoingFile[];
  text?: string;
  app: ShareApp;
  subject?: string;
  emails?: string[];
}): Promise<ShareResult> {
  const { files, app } = options;
  const text = options.text?.trim() || '';
  const textCopied = !!text && files.length > 0 && !textTravelsWithFiles(Platform.OS, app);
  if (textCopied) await copyText(text).catch(() => {});

  if (native?.shareFiles) {
    const via = await native.shareFiles({
      paths: files.map((f) => f.uri),
      mimeType: commonMimeType(files.map((f) => f.mimeType)),
      ...(text ? { text } : {}),
      ...(options.subject ? { subject: options.subject } : {}),
      ...(options.emails?.length ? { emails: options.emails } : {}),
      targets: app === 'whatsapp' && Platform.OS === 'android' ? WHATSAPP_PACKAGES : [],
      chooserTitle: t('share.chooserTitle'),
    });
    return { via, textCopied };
  }

  // An older build: text alone through React Native's share sheet, one file through expo-sharing.
  if (!files.length && text) {
    const result = await Share.share({ message: text });
    return { via: result.action === Share.dismissedAction ? 'cancelled' : 'sheet', textCopied: false };
  }
  if (files.length !== 1) throw new ShareNeedsBuildError(t('share.needsBuild'));
  if (text && !textCopied) await copyText(text).catch(() => {});
  await Sharing.shareAsync(files[0].uri, { mimeType: files[0].mimeType, dialogTitle: files[0].name });
  return { via: 'sheet', textCopied: !!text };
}
