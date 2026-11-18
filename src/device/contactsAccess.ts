import { getRandomBytes } from 'expo-crypto';
import { getLocales } from 'expo-localization';
import { dialog } from '../components/Dialog';
import { makeHandles, type ContactsAccess } from '../agent/contactTool';
import type { Conversation } from '../chat/Conversation';
import { t } from '../i18n';
import { contactsState, readContactNames, readContactValues, requestContacts } from './contacts';

/** Contact handles of every conversation, in memory only (gone when the app restarts). */
const handles = makeHandles(getRandomBytes);

/**
 * The address book for one assistant task (find_contact and handles, docs/contacts.md): the conversation's handle
 * scope, what the user said in it, the pre-explanation before the system prompt, and the picker. Stopping the task
 * dismisses an open dialog as "not now" / no choice.
 */
export function contactsAccessFor(chat: Conversation, signal: AbortSignal): ContactsAccess {
  return {
    scope: () => chat.contactScope,
    userTexts: () => chat.items.filter((item) => item.kind === 'user').map((item) => item.text),
    state: contactsState,
    ask: async () => {
      const result = await dialog.show({
        title: t('contacts.askTitle'),
        message: t('contacts.askBody'),
        buttons: [
          { text: t('contacts.notNow'), style: 'cancel' },
          { text: t('contacts.askContinue'), primary: true },
        ],
        signal,
      });
      if (result.button !== 1) return contactsState();
      return requestContacts();
    },
    names: readContactNames,
    values: readContactValues,
    pick: async (title, rows) => {
      const result = await dialog.show({
        title,
        choices: { label: t('contacts.pickLabel'), options: rows, initial: 0 },
        buttons: [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('contacts.pickUse'), primary: true },
        ],
        signal,
      });
      return result.button === 1 ? result.choice : null;
    },
    region: () => getLocales()[0]?.regionCode ?? null,
    handles,
  };
}
