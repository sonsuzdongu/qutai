import { t } from '../../i18n';
import { normalizePhone } from '../../device/phone';
import { MAX_SMS_BODY } from '../../device/sms';
import { MAX_WHATSAPP_BODY, normalizeWhatsAppNumber } from '../../device/whatsapp';
import { toInternational } from '../../device/phoneRegion';
import { contactForUse } from '../contactTool';
import { uiLabel } from '../uiLabels';
import { cutText } from '../../utils/wellFormed';
import type { ToolContext, ToolOutput } from '../executeTool';

/**
 * Calls, SMS and WhatsApp messages the assistant prepares: offered as chat cards the user taps; nothing is sent by
 * the assistant. The action history names who, never the number.
 */

/** Who a call was offered to, for the action history: the name, never the number. */
export function offerCallLog(input: Record<string, unknown>): string {
  const name = typeof input.name === 'string' ? cutText(input.name.trim(), 60) : '';
  return name ? t('action.offerCallLogged', { name }) : t('action.offerCallLoggedNoName');
}

/**
 * Shows a Call button in the chat. Nothing is dialled here: page content is untrusted, so the user's tap
 * on the button is the only thing that opens the dialer, and the button shows the full number first.
 */
export async function offerCallTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  if (!ctx.offerCall) return { content: 'Call buttons are not available here.', isError: true };
  const contact = await contactForUse(input.phone, 'phone', ctx);
  if (contact && !contact.ok) return contact.out;
  if (contact) {
    ctx.offerCall({ number: contact.value, name: contact.name, contact: { label: contact.label } });
    return {
      content:
        `A call button labelled ${uiLabel('chat.call')} for ${contact.name} (${contact.label}, from the user's contacts) ` +
        'is shown in the chat with the number, which only the user sees. No call has been made: the user taps the ' +
        'button to call. Do not say you called.',
      isError: false,
    };
  }
  const phone = normalizePhone(input.phone);
  if (!phone.ok) return { content: `${phone.error} No button was shown.`, isError: true };
  const name = typeof input.name === 'string' ? cutText(input.name.replace(/\s+/g, ' ').trim(), 80) : '';
  ctx.offerCall({ number: phone.number, ...(name ? { name } : {}) });
  return {
    content:
      `A call button labelled ${uiLabel('chat.call')} for ${name ? `${name}, ` : ''}${phone.number} is shown in the ` +
      'chat. No call has been made: the user taps the button to call themselves. Do not say you called; tell them ' +
      'where the number came from.',
    isError: false,
  };
}

/** Who a text message was prepared for, for the action history: the name, never the number or the text. */
export function draftSmsLog(input: Record<string, unknown>): string {
  const name = typeof input.name === 'string' ? cutText(input.name.trim(), 60) : '';
  return name ? t('action.draftSmsLogged', { name }) : t('action.draftSmsLoggedNoName');
}

/**
 * Shows a prepared text message in the chat. Nothing opens or is sent here: page content is untrusted and
 * premium-rate numbers exist, so the card shows the full number and text first, the user's tap opens the
 * Messages app, and the user sends it there.
 */
export async function draftSmsTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  if (!ctx.offerSms) return { content: 'Text message drafts are not available here.', isError: true };
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body) return { content: 'The message text is empty. No message was prepared.', isError: true };
  if (body.length > MAX_SMS_BODY)
    return { content: `The text is longer than ${MAX_SMS_BODY} characters; shorten it. No message was prepared.`, isError: true };
  const contact = await contactForUse(input.phone, 'phone', ctx);
  if (contact && !contact.ok) return contact.out;
  if (contact) {
    ctx.offerSms({ number: contact.value, name: contact.name, body, contact: { label: contact.label } });
    return {
      content:
        `A text message to ${contact.name} (${contact.label}, from the user's contacts; only the user sees the number) ` +
        `is shown in the chat with a ${uiLabel('chat.openInMessages')} button. Nothing has been sent: the user opens it ` +
        'in their messaging app and sends it themselves. Do not say it was sent.',
      isError: false,
    };
  }
  const phone = normalizePhone(input.phone);
  if (!phone.ok) return { content: `${phone.error} No message was prepared.`, isError: true };
  const name = typeof input.name === 'string' ? cutText(input.name.replace(/\s+/g, ' ').trim(), 80) : '';
  ctx.offerSms({ number: phone.number, body, ...(name ? { name } : {}) });
  return {
    content:
      `A text message to ${name ? `${name}, ` : ''}${phone.number} is shown in the chat with a ` +
      `${uiLabel('chat.openInMessages')} button. Nothing has been sent: the user opens it in their messaging app and ` +
      'sends it themselves. Do not say it was sent.',
    isError: false,
  };
}

/** Who a WhatsApp message was prepared for, for the action history: the name, never the number or the text. */
export function draftWhatsAppLog(input: Record<string, unknown>): string {
  const name = typeof input.name === 'string' ? cutText(input.name.trim(), 60) : '';
  return name ? t('action.draftWhatsAppLogged', { name }) : t('action.draftWhatsAppLoggedNoName');
}

/**
 * Shows a prepared WhatsApp message in the chat, like draft_sms: the card shows the full number (international, as
 * WhatsApp will use it) and text, the user's tap opens WhatsApp, and the user sends it there. Without a number the
 * user picks the chat in WhatsApp.
 */
export async function draftWhatsAppTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  if (!ctx.offerWhatsApp) return { content: 'WhatsApp drafts are not available here.', isError: true };
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body) return { content: 'The message text is empty. No message was prepared.', isError: true };
  if (body.length > MAX_WHATSAPP_BODY)
    return {
      content: `The text is longer than ${MAX_WHATSAPP_BODY} characters; shorten it. No message was prepared.`,
      isError: true,
    };
  const contact = await contactForUse(input.phone, 'phone', ctx);
  if (contact && !contact.ok) return contact.out;
  if (contact) {
    const countryCode = typeof input.country_code === 'string' ? input.country_code : undefined;
    const intl = toInternational(contact.value, ctx.contacts?.region() ?? null, countryCode);
    if (!intl.ok) return { content: `${intl.error} No message was prepared.`, isError: true };
    ctx.offerWhatsApp({
      number: intl.number,
      name: contact.name,
      body,
      contact: { label: contact.label, ...(intl.added ? { added: intl.added } : {}) },
    });
    const added = intl.added
      ? ` The number was saved without a country code, so ${intl.added} was added (from ${countryCode ? 'country_code' : "the phone's region"}); the card says so, and the user can check it.`
      : '';
    return {
      content:
        `A WhatsApp message to ${contact.name} (${contact.label}, from the user's contacts; only the user sees the ` +
        `number) is shown in the chat with a ${uiLabel('chat.openInWhatsApp')} button.${added} Nothing has been sent: ` +
        'the user opens it in WhatsApp and sends it themselves. Do not say it was sent.',
      isError: false,
    };
  }
  const rawPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
  let number: string | undefined;
  if (rawPhone) {
    const phone = normalizeWhatsAppNumber(rawPhone);
    if (!phone.ok) return { content: `${phone.error} No message was prepared.`, isError: true };
    number = phone.number;
  }
  const name = typeof input.name === 'string' ? cutText(input.name.replace(/\s+/g, ' ').trim(), 80) : '';
  ctx.offerWhatsApp({ body, ...(number ? { number } : {}), ...(name ? { name } : {}) });
  const to = number ? `to ${name ? `${name}, ` : ''}${number} ` : '(the user picks the chat in WhatsApp) ';
  return {
    content:
      `A WhatsApp message ${to}is shown in the chat with a ${uiLabel('chat.openInWhatsApp')} button. Nothing has ` +
      'been sent: the user opens it in WhatsApp and sends it themselves. Do not say it was sent.',
    isError: false,
  };
}
