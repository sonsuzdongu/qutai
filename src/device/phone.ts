import { Linking } from 'react-native';
import { dialog } from '../components/Dialog';
import { t } from '../i18n';
import { copyText } from './link';

export { normalizePhone, type PhoneParse } from './phoneNumber';

/** A number offered by the assistant: the name it belongs to (optional) and the digits that will be dialled. */
export type CallOffer = { number: string; name?: string; contact?: ContactSource };

/**
 * Set on a card whose number or address came from the address book (find_contact): its label ("mobile"). The value
 * is shown on the card while the conversation is open but not saved with it (Conversation.toSaved), and `added` is
 * the country code put in front of a local number for WhatsApp (shown on the card).
 */
export type ContactSource = { label: string; added?: string };

/**
 * The URL that opens the dialer. The number is already reduced to digits and a leading "+", which are
 * valid as they are in a tel: URI (RFC 3966); "+" is not percent-encoded because some dialers then
 * show "%2B" instead of dialling internationally.
 */
export function telUrl(number: string): string {
  return `tel:${number}`;
}

/**
 * Opens the phone's dialer with the number filled in. Only ever called from the user's tap: Android shows
 * the dialer (no CALL_PHONE permission needed) and iOS asks before calling. openURL is called directly
 * instead of checking canOpenURL first, which would need the scheme declared on both platforms; where
 * nothing can place calls (tablets, simulators) it fails, and the number is shown so it can be copied.
 */
export function placeCall(number: string, onCopied: () => void) {
  Linking.openURL(telUrl(number)).catch(() => {
    dialog.alert(t('call.failedTitle'), t('call.failed', { number }), [
      { text: t('common.ok'), style: 'cancel' },
      {
        text: t('call.copyNumber'),
        onPress: () => {
          copyText(number)
            .then(onCopied)
            .catch(() => {});
        },
      },
    ]);
  });
}
