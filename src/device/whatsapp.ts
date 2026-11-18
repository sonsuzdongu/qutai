import { Linking } from 'react-native';
import { dialog } from '../components/Dialog';
import { t } from '../i18n';
import { copyText } from './link';
import { normalizePhone, type ContactSource } from './phone';

/** WhatsApp allows much longer messages, but a prepared message the user reads on a card should stay short. */
export const MAX_WHATSAPP_BODY = 2000;
/** A country code and a subscriber number: anything shorter is not a full international number. */
const MIN_INTERNATIONAL_DIGITS = 8;

/**
 * A WhatsApp message prepared by the assistant: the number in international format as digits with a leading "+"
 * (absent when the user picks the chat in WhatsApp), who it is for, and the text.
 */
export type WhatsAppOffer = { number?: string; name?: string; body: string; contact?: ContactSource };

export type WhatsAppNumberParse = { ok: true; number: string } | { ok: false; error: string };

/**
 * A number WhatsApp can open a chat with: a plain phone number (same rules as a call) in international format.
 * WhatsApp links need the country code and cannot guess it, so a local number ("0532 …") is refused instead of
 * assuming a country; "00" as the international prefix is read as "+".
 */
export function normalizeWhatsAppNumber(raw: unknown): WhatsAppNumberParse {
  const phone = normalizePhone(raw);
  if (!phone.ok) return phone;
  const number = phone.number.startsWith('00') ? `+${phone.number.slice(2)}` : phone.number;
  if (!number.startsWith('+'))
    return {
      ok: false,
      error:
        'WhatsApp needs the number in international format with the country code (e.g. +90 532 …), and this one has ' +
        'none. Ask the user which country code it has; do not guess it.',
    };
  if (number.length - 1 < MIN_INTERNATIONAL_DIGITS)
    return { ok: false, error: 'This number is too short for an international WhatsApp number (country code + number).' };
  return { ok: true, number };
}

/**
 * The app's own scheme, which only WhatsApp (and WhatsApp Business) handle. It takes the same values as WhatsApp's
 * documented click-to-chat link (`https://wa.me/<number>?text=<url-encoded>`): the number as digits only, with the
 * country code and no "+", zeros, brackets or dashes; without a number (`https://wa.me/?text=…`) the user picks the
 * chat in WhatsApp.
 */
function schemeUrl(offer: WhatsAppOffer): string {
  const phone = offer.number ? `phone=${offer.number.replace('+', '')}&` : '';
  return `whatsapp://send?${phone}text=${encodeURIComponent(offer.body)}`;
}

/**
 * Opens WhatsApp with the chat and the text filled in. Only ever called from the user's tap on the card, after they
 * have seen the number and text; the user sends it in WhatsApp (nothing is sent from Qutai).
 *
 * The `whatsapp://` scheme is tried rather than the wa.me link: openURL fails for it when WhatsApp is not installed
 * (no `canOpenURL` declaration needed), whereas the https link would then open in a browser, possibly Qutai itself.
 * When WhatsApp is installed both open the same chat with the same text; when it is not, the user can copy the text.
 */
export function openWhatsApp(offer: WhatsAppOffer, onCopied: () => void) {
  Linking.openURL(schemeUrl(offer)).catch(() => {
    dialog.alert(
      t('whatsapp.failedTitle'),
      offer.number ? t('whatsapp.failed', { number: offer.number }) : t('whatsapp.failedNoNumber'),
      [
        { text: t('common.ok'), style: 'cancel' },
        {
          text: t('sms.copyText'),
          onPress: () => {
            copyText(offer.body)
              .then(onCopied)
              .catch(() => {});
          },
        },
      ],
    );
  });
}
