import { composeAsync, isAvailableAsync } from 'expo-mail-composer';
import { Linking } from 'react-native';
import type { EmailDraft } from '../agent/executeTool';

/** Builds a mailto: link, for phones without a mail account set up in the system composer. */
export function mailtoUrl({ to, subject, body }: EmailDraft): string {
  const params = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`].join('&');
  return `mailto:${to.map(encodeURIComponent).join(',')}?${params}`;
}

/** Shows the system email composer with the draft; the user sends it (or not). */
export async function composeEmail(draft: EmailDraft): Promise<string> {
  if (await isAvailableAsync()) {
    const result = await composeAsync({ recipients: draft.to, subject: draft.subject, body: draft.body });
    return result.status;
  }
  await Linking.openURL(mailtoUrl(draft));
  return 'opened in the mail app';
}
