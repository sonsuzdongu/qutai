/**
 * What kind of page a tab shows, as a few flags the page script reads from the markup (`pageSignals` in
 * pageScript.ts): structured data types, the reader-mode article check, forms, video, tables and so on. Never page
 * text, field values, phone numbers or addresses themselves. The flags stay in the tab's memory: they are not logged,
 * saved (also not for incognito tabs) or sent anywhere; they only pick the suggestions in the empty assistant panel.
 */

/** schema.org / Open Graph types the page declares, folded into a few kinds. */
export type SchemaKind = 'product' | 'article' | 'recipe' | 'video' | 'event' | 'localBusiness' | 'jobPosting';

/** The main form on the page (3 or more visible fields) and what it looks like it is for. */
export type FormKind = 'signup' | 'checkout' | 'contact' | 'other';

export type PageSignals = {
  kinds: SchemaKind[];
  /** Reader mode would find an article here (same check as the address bar indicator). */
  article: boolean;
  form: FormKind | null;
  /** A video player of real size, or an embedded YouTube / Vimeo / Dailymotion player. */
  video: boolean;
  /** The document itself is a PDF (iOS shows PDFs in the WebView). */
  pdf: boolean;
  /** Card number fields: a payment step. */
  payment: boolean;
  /** A tel: link or a marked-up telephone number. */
  phone: boolean;
  /** An <address> element or a marked-up postal address. */
  address: boolean;
  /** A data table of 4 or more rows. */
  table: boolean;
  /** More than 8 screens tall. */
  long: boolean;
};

const SCHEMA_KINDS: readonly SchemaKind[] = [
  'product',
  'article',
  'recipe',
  'video',
  'event',
  'localBusiness',
  'jobPosting',
];
const FORM_KINDS: readonly FormKind[] = ['signup', 'checkout', 'contact', 'other'];

/** Checks the page's answer (pages can't be trusted to send the right shape); null when it isn't one. */
export function parsePageSignals(raw: unknown): PageSignals | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const flag = (key: string) => r[key] === true;
  const kinds = Array.isArray(r.kinds)
    ? SCHEMA_KINDS.filter((kind) => (r.kinds as unknown[]).includes(kind))
    : [];
  return {
    kinds,
    article: flag('article'),
    form: FORM_KINDS.find((kind) => kind === r.form) ?? null,
    video: flag('video'),
    pdf: flag('pdf'),
    payment: flag('payment'),
    phone: flag('phone'),
    address: flag('address'),
    table: flag('table'),
    long: flag('long'),
  };
}

export function samePageSignals(a: PageSignals | null, b: PageSignals | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.kinds.join() === b.kinds.join() &&
    a.article === b.article &&
    a.form === b.form &&
    a.video === b.video &&
    a.pdf === b.pdf &&
    a.payment === b.payment &&
    a.phone === b.phone &&
    a.address === b.address &&
    a.table === b.table &&
    a.long === b.long
  );
}
