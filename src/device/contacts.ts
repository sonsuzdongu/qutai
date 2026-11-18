import { Platform } from 'react-native';
import type { ContactName } from '../agent/contactMatch';

/**
 * The phone's address book, read only, for find_contact (docs/contacts.md). expo-contacts is loaded lazily so a build
 * without the native module (an older development build) reports 'unavailable' instead of failing at start.
 *
 * 'limited': iOS 18 access to the contacts the user chose. 'denied': refused, the system can still ask (Android's
 * first refusal). 'blocked': only the phone's settings can change it.
 */
export type ContactsState = 'granted' | 'limited' | 'undetermined' | 'denied' | 'blocked' | 'unavailable';

type Module = typeof import('expo-contacts');

async function load(): Promise<Module | null> {
  try {
    const mod = await import('expo-contacts');
    return mod.Contact ? mod : null;
  } catch {
    return null;
  }
}

function stateOf(r: { granted: boolean; status: string; canAskAgain: boolean; accessPrivileges?: string }): ContactsState {
  if (r.granted) return r.accessPrivileges === 'limited' ? 'limited' : 'granted';
  if (r.status === 'undetermined') return 'undetermined';
  return r.canAskAgain ? 'denied' : 'blocked';
}

export async function contactsState(): Promise<ContactsState> {
  const mod = await load();
  if (!mod) return 'unavailable';
  try {
    return stateOf(await mod.getPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

/** Shows the system prompt when the system still asks; resolves with the state afterwards. */
export async function requestContacts(): Promise<ContactsState> {
  const mod = await load();
  if (!mod) return 'unavailable';
  try {
    const before = stateOf(await mod.getPermissionsAsync());
    if (before !== 'undetermined' && before !== 'denied') return before;
    return stateOf(await mod.requestPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

/** iOS 18 limited access: the system's sheet for choosing which contacts Qutai may see. Resolves false elsewhere. */
export async function chooseSharedContacts(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const mod = await load();
  if (!mod) return false;
  try {
    await mod.Contact.presentAccessPicker();
    return true;
  } catch {
    return false;
  }
}

/**
 * The name fields of every contact Qutai may see (no numbers, addresses or photos), for matching on the phone.
 * One bulk read: a few thousand contacts take well under a second.
 */
export async function readContactNames(): Promise<ContactName[]> {
  const mod = await load();
  if (!mod) return [];
  const F = mod.ContactField;
  const rows = await mod.Contact.getAllDetails([
    F.GIVEN_NAME,
    F.MIDDLE_NAME,
    F.FAMILY_NAME,
    F.FULL_NAME,
    F.NICKNAME,
    F.COMPANY,
  ] as const);
  return rows.map((r) => ({
    id: r.id,
    givenName: r.givenName ?? undefined,
    middleName: r.middleName ?? undefined,
    familyName: r.familyName ?? undefined,
    fullName: r.fullName ?? undefined,
    nickname: r.nickname ?? undefined,
    company: r.company ?? undefined,
  }));
}

export type RawContactValues = {
  phones: { label?: string; number?: string }[];
  emails: { label?: string; address?: string }[];
};

/** The numbers and email addresses of one matched contact (read only for the few that matched). */
export async function readContactValues(id: string): Promise<RawContactValues> {
  const mod = await load();
  if (!mod) return { phones: [], emails: [] };
  const F = mod.ContactField;
  const details = await new mod.Contact(id).getDetails([F.PHONES, F.EMAILS] as const);
  return { phones: details.phones ?? [], emails: details.emails ?? [] };
}
