import { Linking } from 'react-native';
import { dialog } from '../components/Dialog';
import { t } from '../i18n';
import { copyText } from './link';

/** E.164 allows at most 15 digits; local formats with a trunk or international prefix stay within that too. */
const MAX_DIGITS = 15;
/** Short numbers such as 112 or 911 can be called too. */
const MIN_DIGITS = 3;

/** A number offered by the assistant: the name it belongs to (optional) and the digits that will be dialled. */
export type CallOffer = { number: string; name?: string };

export type PhoneParse = { ok: true; number: string } | { ok: false; error: string };

/**
 * Turns a phone number as written on a page ("+90 (212) 555-12 34", "0212 555 12 34") into what goes in a
 * tel: URL: digits with an optional leading "+". Only a plain number is accepted, because a dial string can do
 * more than place a call: "*" and "#" codes (USSD/MMI, e.g. call forwarding or "*#06#"), pauses and post-dial
 * digits ("," ";" "p" "w"), extensions or a second number would all run on the phone, so they are refused.
 */
export function normalizePhone(raw: unknown): PhoneParse {
  let text = typeof raw === 'string' ? raw.trim() : '';
  text = text.replace(/^tel:/i, '').trim();
  if (!text) return { ok: false, error: 'No phone number given.' };
  if (/[*#]/.test(text))
    return { ok: false, error: 'Numbers with * or # (service codes such as USSD/MMI) cannot be offered.' };
  if (/[,;]/.test(text))
    return {
      ok: false,
      error: 'Pauses and digits dialled after the call connects ("," or ";") are not allowed; give one plain number.',
    };
  if (/[\p{L}]/u.test(text))
    return {
      ok: false,
      error: 'The number contains letters (an extension, pause or text); give one plain phone number only.',
    };
  if (/[/|]|\s{3,}/.test(text) || (text.match(/\+/g) ?? []).length > 1)
    return { ok: false, error: 'This looks like more than one number; offer one number per call.' };
  // Spaces (including non-breaking ones), dashes of any kind, dots and brackets are formatting.
  const compact = text.replace(/[\s   \-‐-―−.()[\]]/g, '');
  if (!/^\+?[0-9]+$/.test(compact))
    return { ok: false, error: 'This does not look like a phone number: use digits, spaces, dashes, brackets and a leading +.' };
  const digits = compact.replace('+', '');
  if (digits.length < MIN_DIGITS) return { ok: false, error: 'This number is too short to be a phone number.' };
  if (digits.length > MAX_DIGITS)
    return { ok: false, error: `This number has more than ${MAX_DIGITS} digits; phone numbers are shorter.` };
  return { ok: true, number: compact };
}

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
