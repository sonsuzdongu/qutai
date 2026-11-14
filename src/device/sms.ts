import { Linking, Platform } from 'react-native';
import { dialog } from '../components/Dialog';
import { t } from '../i18n';
import { copyText } from './link';

/** Longer than a few SMS parts is not a text message any more; the assistant is told to shorten it. */
export const MAX_SMS_BODY = 1000;

/** A text message prepared by the assistant: the recipient (normalised like a call's number) and the text. */
export type SmsOffer = { number: string; name?: string; body: string };

/**
 * The URL that opens the Messages app with the recipient and the text filled in. iOS reads the body after
 * "&" (`sms:+90…&body=…`), Android after "?" (`sms:+90…?body=…`). The number is already digits with an
 * optional leading "+", so only the body is encoded.
 */
export function smsUrl(number: string, body: string): string {
  if (!body) return `sms:${number}`;
  return `sms:${number}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

/**
 * Opens the Messages app with the message filled in. Only ever called from the user's tap on the card,
 * after they have seen the full number and text; the user sends it there (nothing is sent from Qutai, and
 * no SMS permission is needed). Where no app can send texts (tablets, simulators), the text can be copied.
 */
export function openSmsComposer(offer: SmsOffer, onCopied: () => void) {
  Linking.openURL(smsUrl(offer.number, offer.body)).catch(() => {
    dialog.alert(t('sms.failedTitle'), t('sms.failed', { number: offer.number }), [
      { text: t('common.ok'), style: 'cancel' },
      {
        text: t('sms.copyText'),
        onPress: () => {
          copyText(offer.body)
            .then(onCopied)
            .catch(() => {});
        },
      },
    ]);
  });
}
