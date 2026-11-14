export type Lang = 'en' | 'tr';

/** Reads the `lang` cookie, if it is one of ours. */
export function cookieLanguage(cookie: string | null): Lang | null {
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'lang') {
      const value = rest.join('=').trim();
      if (value === 'en' || value === 'tr') return value;
    }
  }
  return null;
}

/**
 * The first Turkish or English entry of an Accept-Language header, by quality (ties keep the
 * header's order). `tr`, `tr-TR`, `tr-CY` → tr; `en-*` → en; anything else is skipped. q=0 means
 * "not acceptable" and is ignored.
 */
export function headerLanguage(header: string | null): Lang | null {
  if (!header) return null;
  const entries = header
    .split(',')
    .map((raw, index) => {
      const [tag, ...params] = raw.trim().toLowerCase().split(';');
      let q = 1;
      for (const p of params) {
        const [k, v] = p.trim().split('=');
        if (k === 'q') {
          const n = Number(v);
          q = Number.isFinite(n) ? n : 0;
        }
      }
      return { tag: tag.trim(), q, index };
    })
    .filter((e) => e.tag && e.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of entries) {
    const primary = tag.split('-')[0];
    if (primary === 'tr') return 'tr';
    if (primary === 'en') return 'en';
  }
  return null;
}

export function pickLanguage(cookie: string | null, acceptLanguage: string | null): Lang {
  return cookieLanguage(cookie) ?? headerLanguage(acceptLanguage) ?? 'en';
}
