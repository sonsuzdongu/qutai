import { composeAsync, isAvailableAsync } from 'expo-mail-composer';
import { Linking, Platform } from 'react-native';
import type { EmailDraft } from '../agent/executeTool';
import { prepareOutgoing, type OutgoingFile } from './outgoing';
import { shareToApp } from './share';

/** Builds a mailto: link, for phones without a mail account set up in the system composer. It carries no files. */
export function mailtoUrl({ to, subject, body }: Pick<EmailDraft, 'to' | 'subject' | 'body'>): string {
  const params = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`].join('&');
  return `mailto:${to.map(encodeURIComponent).join(',')}?${params}`;
}

/**
 * How the draft reached the user: the system composer (with what the user did there, as far as the platform tells),
 * a mailto: link (no files), or, when files go with it and no composer is available, the share sheet with the files
 * and the text, where the user picks their mail app.
 */
export type EmailOutcome =
  | { route: 'composer'; status: string; files: OutgoingFile[] }
  | { route: 'mailto' }
  | { route: 'share'; via: string; textCopied: boolean; files: OutgoingFile[] };

/**
 * Shows the system email composer with the draft and its files attached; the user sends it (or not). iOS reads the
 * files when the composer opens, so their copies go right after; Android's mail app reads them from content URIs
 * later, so they stay for the receiving app (src/device/outgoing.ts removes them).
 *
 * Without a composer (no mail account set up): with no files, a mailto: link as before; with files, never a mailto:
 * link (it can't carry them) but the share sheet with the files, the subject and the body, so nothing is dropped.
 */
export async function composeEmail(draft: EmailDraft): Promise<EmailOutcome> {
  const available = await isAvailableAsync();
  if (!draft.attachments.length) {
    if (available) {
      const result = await composeAsync({ recipients: draft.to, subject: draft.subject, body: draft.body });
      return { route: 'composer', status: result.status, files: [] };
    }
    await Linking.openURL(mailtoUrl(draft));
    return { route: 'mailto' };
  }

  const prepared = await prepareOutgoing(draft.attachments, { incognito: draft.incognito, original: draft.original });
  if (available) {
    try {
      const result = await composeAsync({
        recipients: draft.to,
        subject: draft.subject,
        body: draft.body,
        // Local file URIs: iOS reads them into the message; Android turns them into content URIs of the module's
        // FileProvider (files and cache folders) for the mail app.
        attachments: prepared.files.map((f) => f.uri),
      });
      return { route: 'composer', status: result.status, files: prepared.files };
    } finally {
      if (Platform.OS === 'ios') prepared.dispose();
    }
  }
  const shared = await shareToApp({
    files: prepared.files,
    text: draft.body,
    subject: draft.subject,
    emails: draft.to,
    app: 'any',
  });
  return { route: 'share', via: shared.via, textCopied: shared.textCopied, files: prepared.files };
}
