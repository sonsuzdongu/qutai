/**
 * Opaque handles for contacts found by find_contact (docs/contacts.md). The model gets "ct-k3j2m9qa" for a person and
 * "ct-k3j2m9qa.2" for one of their numbers or addresses; the values stay here, in memory only, never on disk. A handle
 * is valid only in the conversation (scope) that made it and for HANDLE_TTL_MS; anything else is refused. Pure: the
 * randomness is passed in.
 */

export const HANDLE_TTL_MS = 30 * 60_000;
/** A person ("ct-" and 8 letters or digits) or one of their values (".1" to ".99"). */
export const HANDLE_RE = /^ct-[a-z0-9]{8}(?:\.[1-9]\d?)?$/;

export type ContactValue = {
  kind: 'phone' | 'email';
  /** The label the model and the user see ("mobile", "work email" is kind + label). */
  label: string;
  /** The number (digits, maybe a leading "+") or the address. Never leaves the phone except to the user's apps. */
  value: string;
};

export type ContactEntry = { name: string; values: ContactValue[] };

export type HandleLookup =
  | { ok: true; name: string; values: ContactValue[]; person: string; index: number | null }
  | { ok: false; error: string };

type Stored = { scope: string; at: number; entry: ContactEntry };

/** Whether a string the model passed is meant as a handle (then it must also be a valid one). */
export function looksLikeHandle(text: unknown): text is string {
  return typeof text === 'string' && /^ct-/i.test(text.trim());
}

const REFUSED = 'look the person up again with find_contact';

export class ContactHandles {
  private people = new Map<string, Stored>();

  constructor(
    /** 8 random characters from a–z and 0–9. */
    private randomId: () => string,
    private ttl = HANDLE_TTL_MS,
  ) {}

  /** A new person handle for this conversation; the values get ".1", ".2"… in their order. */
  issue(scope: string, entry: ContactEntry, now: number): string {
    this.prune(now);
    let id: string;
    do id = `ct-${this.randomId()}`;
    while (this.people.has(id));
    if (!HANDLE_RE.test(id)) throw new Error('Bad random handle');
    this.people.set(id, { scope, at: now, entry: { name: entry.name, values: entry.values.slice(0, 99) } });
    return id;
  }

  /** What a handle stands for, in this conversation and while it is fresh; refused otherwise. */
  resolve(scope: string, handle: string, now: number): HandleLookup {
    const text = handle.trim().toLowerCase();
    if (!HANDLE_RE.test(text)) return { ok: false, error: `"${cut(handle)}" is not a contact handle: ${REFUSED}.` };
    const [person, part] = text.split('.');
    const stored = this.people.get(person);
    if (!stored || stored.scope !== scope)
      return { ok: false, error: `Unknown contact handle ${cut(handle)} (handles work only in the conversation that found them): ${REFUSED}.` };
    if (now - stored.at > this.ttl) {
      this.people.delete(person);
      return { ok: false, error: `The contact handle ${cut(handle)} has expired: ${REFUSED}.` };
    }
    const index = part ? Number(part) - 1 : null;
    if (index !== null && !stored.entry.values[index])
      return { ok: false, error: `Unknown contact handle ${cut(handle)}: ${REFUSED}.` };
    return { ok: true, name: stored.entry.name, values: stored.entry.values, person, index };
  }

  /** Forgets every handle (the app's contacts permission was taken back, or for tests). */
  clear() {
    this.people.clear();
  }

  get size() {
    return this.people.size;
  }

  private prune(now: number) {
    for (const [id, stored] of this.people) if (now - stored.at > this.ttl) this.people.delete(id);
  }
}

function cut(text: string) {
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}
