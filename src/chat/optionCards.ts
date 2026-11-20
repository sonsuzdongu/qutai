/**
 * Option cards (UI-23 to UI-26 in docs/design/27-interface.md, UNTR-20): the assistant's show_options
 * tool presents a few things to choose between (products, places, hotels, flights, articles, search results) as cards
 * with a picture, title, price, one detail line and the site's name.
 *
 * Everything on a card comes from web pages, so it is untrusted data. This file is the app's own check, whatever the
 * prompt says: pure and tested (scripts/assistant-tests/optionCards.test.ts).
 * - Links and pictures are https only; no user name or password in the address; a real domain (no IP, no single label).
 * - The card shows the host of its own link, worked out here, never a name the model or the page gave.
 * - Text fields are plain text (control and direction-override characters removed), cut to a length.
 * - At most MAX_CARDS cards. Pictures are never addresses the model wrote: the app looks them up on the page
 *   (pageScript.ts optionDetails); a price is kept only when its number appears in what the task read.
 *
 * No React Native imports: the Node tests load it.
 */
import { punycodeEncode } from '../content/filterLists';
import { cutText } from '../utils/wellFormed';

export const MAX_CARDS = 8;
export const MAX_TITLE = 120;
export const MAX_PRICE = 40;
export const MAX_DETAIL = 120;
export const MAX_URL = 2048;

/** One card as stored with the message. `host` is derived from `url` (recomputed whenever cards are read back). */
export type OptionCard = {
  title: string;
  url: string;
  host: string;
  image?: string;
  price?: string;
  detail?: string;
};

/** What the model asked for, before the page lookup: each needs a title and a link or a ref. */
export type OptionRequest = { title: string; url?: string; ref?: number; price?: string; detail?: string };

/** What the page said about one request (pageScript.ts optionDetails): the link's real address, its picture, its text. */
export type OptionDetail = { href?: string; image?: string; text?: string } | null | undefined;

// C0/C1 controls, zero-width and direction controls (a title could otherwise reverse the text around it).
const INVISIBLE_RANGES: [number, number][] = [
  [0x0000, 0x001f], [0x007f, 0x009f], [0x00ad, 0x00ad], [0x061c, 0x061c], [0x180e, 0x180e], [0x200b, 0x200f],
  [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff], [0xfff9, 0xfffb],
];
// Built from code points: written out, U+2028 inside a regex literal would end the line.
const hex4 = (n: number) => n.toString(16).padStart(4, '0');
const INVISIBLE = new RegExp(`[${INVISIBLE_RANGES.map(([a, b]) => `\\u${hex4(a)}-\\u${hex4(b)}`).join('')}]`, 'g');

/** Plain, single-line text: invisible and control characters out, whitespace collapsed, cut to `max`. */
export function plainField(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const text = value.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${cutText(text, max - 1).trimEnd()}…`;
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** The host of an https address, lower-case ASCII (IDN in punycode), or null when the address isn't acceptable. */
function httpsHost(url: string): string | null {
  const m = /^https:\/\/([^/?#\\]*)(?:[/?#]|$)/i.exec(url);
  if (!m) return null;
  const authority = m[1];
  // "https://shop.example@evil.example/" shows one site and opens another.
  if (!authority || authority.includes('@')) return null;
  const hostPort = /^([^:]+)(?::(\d{1,5}))?$/.exec(authority);
  if (!hostPort) return null;
  let host = hostPort[1].toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  const labels = host.split('.');
  if (labels.length < 2 || host.length > 253) return null;
  for (let i = 0; i < labels.length; i++) {
    if (/[^\x00-\x7f]/.test(labels[i])) {
      const encoded = punycodeEncode(labels[i].normalize('NFC'));
      if (!encoded) return null;
      labels[i] = `xn--${encoded}`;
    }
    if (!LABEL.test(labels[i])) return null;
  }
  // No IP addresses: a card leads to a site by name.
  if (/^\d+$/.test(labels[labels.length - 1])) return null;
  return labels.join('.');
}

/** An acceptable card or picture address (https, a real domain, no credentials, no spaces, not too long), or null. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || url.length > MAX_URL || /[\s\u0000-\u001f\u007f<>"`]/.test(url)) return null;
  return httpsHost(url) ? url : null;
}

/** The site a card names: its link's own host without "www.", IDN shown in punycode so look-alikes stay visible. */
export function displayHost(url: string): string {
  const host = httpsHost(url) ?? '';
  return host.startsWith('www.') ? host.slice(4) : host;
}

/** A relative link from the page ("/p/123") made absolute against the page's address; an absolute one as it is. */
export function absoluteUrl(value: string, base: string | undefined): string {
  const url = value.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const origin = base ? /^(https?:\/\/[^/?#]+)/i.exec(base)?.[1] : undefined;
  if (!origin) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return origin + url;
  return url;
}

/**
 * The tool call's input, checked: up to MAX_CARDS options, each with a title and a link (url) or a ref from
 * read_page. Returns the requests, or an error message the model can act on.
 */
export function parseOptionsInput(input: Record<string, unknown>): { requests: OptionRequest[] } | { error: string } {
  const raw = Array.isArray(input.options) ? input.options : null;
  if (!raw || raw.length === 0) {
    return { error: 'Give "options": a list of 1 to 8 items, each with a title and the url (or ref) it opens.' };
  }
  const requests: OptionRequest[] = [];
  for (const item of raw) {
    if (requests.length >= MAX_CARDS) break;
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = plainField(o.title, MAX_TITLE);
    const url = typeof o.url === 'string' && o.url.trim() ? o.url.trim().slice(0, MAX_URL) : undefined;
    const refNumber = typeof o.ref === 'number' ? o.ref : typeof o.ref === 'string' ? Number(o.ref.replace(/^ref=/, '')) : NaN;
    const ref = Number.isInteger(refNumber) && refNumber > 0 ? refNumber : undefined;
    if (!title || (!url && ref === undefined)) continue;
    const price = plainField(o.price, MAX_PRICE);
    const detail = plainField(o.detail, MAX_DETAIL);
    requests.push({ title, ...(url ? { url } : {}), ...(ref !== undefined ? { ref } : {}), ...(price ? { price } : {}), ...(detail ? { detail } : {}) });
  }
  if (!requests.length) {
    return { error: 'None of the options had both a title and a url (or ref). Give each option a title and the link it opens.' };
  }
  return { requests };
}

// A number as written on a page: digits with thousands or decimal separators ("1.299,99", "1 299", "12'500").
const NUMBER = /\d+(?:[\s  ]?[.,'’]?[\s  ]?\d+)*/g;

function numbersIn(text: string): string[] {
  return text.match(NUMBER) ?? [];
}

/**
 * The numbers of the text the task read, as digit strings, for checking that a price wasn't made up. Each number
 * also adds its runs of digits and their joins, since pages split prices over elements ("299" ",99") and read_page
 * may join neighbouring numbers ("4.5 299").
 */
export function numberIndex(texts: string[]): Set<string> {
  const seen = new Set<string>();
  for (const text of texts) {
    for (const n of numbersIn(text)) {
      const runs = n.match(/\d+/g) ?? [];
      for (let i = 0; i < runs.length && i < 8; i++) {
        let joined = '';
        for (let j = i; j < runs.length && j < i + 4; j++) {
          joined += runs[j];
          seen.add(joined);
        }
      }
    }
  }
  return seen;
}

/** A price is kept only when each number in it appears in what was read (or, without digits, its words do). */
export function priceSeen(price: string, numbers: Set<string>, lowerText: string): boolean {
  const found = numbersIn(price);
  if (!found.length) return price.length >= 2 && lowerText.includes(price.toLowerCase());
  return found.every((n) => numbers.has(n.replace(/\D/g, '')));
}

/**
 * The cards to show: the model's requests joined with what the page said about each. The link is the page's own
 * address for the element when there is one (refs), else the model's url made absolute against the page; a card
 * without an acceptable https link is dropped. Pictures come only from the page. `dropped` says why, for the model.
 */
export function buildCards(
  requests: OptionRequest[],
  details: OptionDetail[],
  { pageUrl, readTexts }: { pageUrl?: string; readTexts: string[] },
): { cards: OptionCard[]; dropped: string[]; pricesDropped: number } {
  const detailTexts = details.map((d) => (d && typeof d.text === 'string' ? d.text : ''));
  const numbers = numberIndex([...readTexts, ...detailTexts]);
  const lower = [...readTexts, ...detailTexts].join('\n').toLowerCase();
  const cards: OptionCard[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();
  let pricesDropped = 0;
  requests.forEach((req, i) => {
    const detail = details[i];
    const fromPage = detail && typeof detail.href === 'string' ? safeHttpsUrl(detail.href) : null;
    const fromModel = req.url ? safeHttpsUrl(absoluteUrl(req.url, pageUrl)) : null;
    const url = fromPage ?? fromModel;
    if (!url) {
      dropped.push(`"${req.title}" (no https link${req.ref !== undefined && !req.url ? ' found for its ref' : ''})`);
      return;
    }
    const key = url.split('#')[0];
    if (seen.has(key)) return;
    seen.add(key);
    const image = detail && typeof detail.image === 'string' ? safeHttpsUrl(detail.image) : null;
    let price = req.price;
    if (price && !priceSeen(price, numbers, lower)) {
      price = undefined;
      pricesDropped++;
    }
    cards.push({
      title: req.title,
      url,
      host: displayHost(url),
      ...(image ? { image } : {}),
      ...(price ? { price } : {}),
      ...(req.detail ? { detail: req.detail } : {}),
    });
  });
  return { cards, dropped, pricesDropped };
}

/**
 * Cards read back from storage or a backup file: the same checks as when they were made (a file can be edited),
 * the host worked out again. Anything else in the record is left out.
 */
export function storedCards(value: unknown): OptionCard[] {
  if (!Array.isArray(value)) return [];
  const cards: OptionCard[] = [];
  for (const v of value) {
    if (cards.length >= MAX_CARDS) break;
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const url = safeHttpsUrl(o.url);
    const title = plainField(o.title, MAX_TITLE);
    if (!url || !title) continue;
    const image = safeHttpsUrl(o.image);
    const price = plainField(o.price, MAX_PRICE);
    const detail = plainField(o.detail, MAX_DETAIL);
    cards.push({
      title,
      url,
      host: displayHost(url),
      ...(image ? { image } : {}),
      ...(price ? { price } : {}),
      ...(detail ? { detail } : {}),
    });
  }
  return cards;
}

/**
 * The message's text, which versions without cards show as a plain line (and which copy and share use): one line
 * per option, no links to tap. Language-neutral, so it needs no translation.
 */
export function cardsText(cards: OptionCard[]): string {
  return cards.map((c, i) => `${i + 1}. ${[c.title, c.price, c.host].filter(Boolean).join(' · ')}`).join('\n');
}

/** What a screen reader says for a card: title, price, detail, site. */
export function cardLabel(card: OptionCard): string {
  return [card.title, card.price, card.detail, card.host].filter(Boolean).join(', ');
}

/** The tool result the model reads: what was shown and what was left out, and how to finish. */
export function optionsResult(built: { cards: OptionCard[]; dropped: string[]; pricesDropped: number }): string {
  const withImages = built.cards.filter((c) => c.image).length;
  const withPrices = built.cards.filter((c) => c.price).length;
  const parts = [
    `Shown to the user as ${built.cards.length} card${built.cards.length === 1 ? '' : 's'} ` +
      `(${withImages} with a picture from the page, ${withPrices} with a price).`,
  ];
  if (built.dropped.length) parts.push(`Left out: ${built.dropped.join(', ')}.`);
  if (built.pricesDropped) {
    parts.push(
      `${built.pricesDropped} price${built.pricesDropped === 1 ? ' was' : 's were'} not found in what you read and not shown on the cards; ` +
        "don't say the cards show prices they don't.",
    );
  }
  parts.push(
    'Now finish with a short text reply that makes sense without the cards: what you found in a sentence or two ' +
      '(and which one you would pick, if that helps). Do not list every option again.',
  );
  return parts.join(' ');
}

/**
 * A saved chat item read back from the phone's storage: an options item keeps only cards that pass the checks again
 * (and loses `cards` when none do, so it shows its text line); every other item is returned as it is.
 */
export function checkedOptionItem<T extends { kind: string; text: string; cards?: unknown; imagesOnTap?: unknown }>(item: T): T {
  if (item.kind !== 'options') return item;
  const cards = storedCards(item.cards);
  const { cards: _cards, imagesOnTap, ...rest } = item;
  return {
    ...rest,
    ...(cards.length ? { cards } : {}),
    ...(imagesOnTap === true ? { imagesOnTap: true } : {}),
  } as T;
}
