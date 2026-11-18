import type { ChatItem } from '../components/AssistantPanel';

/**
 * Cards whose number came from the address book (find_contact, docs/contacts.md) keep it only while the conversation
 * is open. What is saved on the phone (and so in backups) keeps the name, the label and the message text, never the
 * number: the card then says the number isn't kept. Other items are returned as they are.
 */
export function withoutContactValues(items: ChatItem[]): ChatItem[] {
  return items.map((item) => {
    if (item.call?.contact) return { ...item, text: item.call.name ?? '', call: { ...item.call, number: '' } };
    if (item.sms?.contact) return { ...item, text: item.sms.name ?? '', sms: { ...item.sms, number: '' } };
    if (item.whatsapp?.contact) {
      const { number: _number, ...rest } = item.whatsapp;
      return { ...item, text: `WhatsApp${rest.name ? ` · ${rest.name}` : ''}`, whatsapp: rest };
    }
    return item;
  });
}

let scopeCounter = 0;

/** A new scope for contact handles: each conversation, and each time one is cleared, gets its own. */
export function newContactScope(key: string): string {
  return `${key}#${Date.now().toString(36)}.${++scopeCounter}`;
}
