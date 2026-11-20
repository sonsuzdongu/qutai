/**
 * How the address bar shows an address while it isn't being edited (`UI` rules in docs/design/27-interface.md): the
 * registrable domain stands out, the subdomain before it and the port and path after it are subdued, https shows no
 * scheme (the lock says it), and the host is shown in Unicode only when that can't be mistaken for another site.
 * Pure (tested in scripts/navigation-tests/addressDisplay.test.ts); hosts come from the one URL parser
 * (src/utils/webUrl.ts), so what is shown is the host the WebView loads.
 *
 * The IDN rule (when a punycode host is shown in Unicode), after the common browser policy (Chromium's IDN spoof
 * checker, based on Unicode UTS #39 "highly restrictive"):
 * 1. every label decodes as valid punycode and holds only letters, combining marks, digits and hyphens (no symbols,
 *    spaces, invisible or format characters);
 * 2. each label is written in one script, apart from digits and hyphens, or in one of the combinations a language
 *    needs: Latin with Han and Hiragana/Katakana (Japanese), Latin with Han and Hangul (Korean), Latin with Han and
 *    Bopomofo (Chinese);
 * 3. no whole-script look-alike: a label written only in Cyrillic or Greek letters that look like Latin ones
 *    ("аррӏе") is shown in punycode unless the top-level domain is itself in that script;
 * 4. if any label fails, the whole host is shown in punycode; where the JavaScript engine lacks Unicode script
 *    classes, every IDN host is shown in punycode.
 */
import { registrableDomain } from '../content/filterLists';
import { parseWebUrl } from '../utils/webUrl';

export type AddressDisplay = {
  /** web: an http(s) site; ip: an IP address; file: a local file; internal: the app's or the WebView's own page. */
  kind: 'web' | 'ip' | 'file' | 'internal' | 'other';
  /** Subdued, before the domain: subdomains ("mail.", "www." dropped). */
  before: string;
  /** Emphasised: the registrable domain, the IP address, or the page's name. */
  domain: string;
  /** Subdued, after the domain: a non-default port and the path, query and fragment ("" for the bare site). */
  after: string;
};

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** The parts of an address for the bar. `url` is the address as the tab holds it. */
export function addressDisplay(url: string): AddressDisplay {
  const web = parseWebUrl(url);
  if (web) {
    let path = '';
    try {
      const u = new URL(web.href);
      path = (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash;
    } catch {
      path = '';
    }
    const port = web.port ? `:${web.port}` : '';
    if (IPV4.test(web.host) || web.host.startsWith('[')) {
      return { kind: 'ip', before: '', domain: web.host, after: port + path };
    }
    const asciiLabels = web.host.split('.');
    const shownLabels = displayHostLabels(asciiLabels);
    const keep = registrableDomain(web.host).split('.').length;
    const cut = Math.max(0, shownLabels.length - keep);
    let beforeLabels = shownLabels.slice(0, cut);
    if (beforeLabels[0] === 'www') beforeLabels = beforeLabels.slice(1);
    return {
      kind: 'web',
      before: beforeLabels.length ? `${beforeLabels.join('.')}.` : '',
      domain: shownLabels.slice(cut).join('.'),
      after: port + path,
    };
  }
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  if (scheme === 'file') {
    const name = url.replace(/^file:\/\//i, '');
    return { kind: 'file', before: '', domain: 'file', after: name ? ` ${name}` : '' };
  }
  if (scheme === 'about' || scheme === 'qutai' || scheme === 'chrome') {
    return { kind: 'internal', before: '', domain: url, after: '' };
  }
  // data:, blob: and anything else: only the scheme, never content the page could have written to look like a site.
  return { kind: 'other', before: '', domain: scheme ? `${scheme}:` : url.slice(0, 40), after: '' };
}

/** The host as shown: Unicode where the IDN rule allows it, else the punycode the WebView uses. */
export function displayHost(asciiHost: string): string {
  return displayHostLabels(asciiHost.split('.')).join('.');
}

function displayHostLabels(labels: string[]): string[] {
  if (!labels.some((l) => l.startsWith('xn--'))) return labels;
  if (!SCRIPTS) return labels;
  const decoded = labels.map((l) => (l.startsWith('xn--') ? punycodeDecode(l.slice(4)) : l));
  if (decoded.some((l) => l === null)) return labels;
  const unicode = decoded as string[];
  const tld = unicode[unicode.length - 1];
  for (const label of unicode) {
    if (!safeLabel(label, tld)) return labels;
  }
  return unicode;
}

type ScriptName = 'Latin' | 'Cyrillic' | 'Greek' | 'Han' | 'Hiragana' | 'Katakana' | 'Hangul' | 'Bopomofo' | 'Other';

/** Script classes, or null where the engine has no Unicode property escapes (then IDNs stay punycode). */
const SCRIPTS: { name: ScriptName; re: RegExp }[] | null = (() => {
  try {
    const names: Exclude<ScriptName, 'Other'>[] = ['Latin', 'Cyrillic', 'Greek', 'Han', 'Hiragana', 'Katakana', 'Hangul', 'Bopomofo'];
    return names.map((name) => ({ name, re: new RegExp(`^\\p{Script=${name}}$`, 'u') }));
  } catch {
    return null;
  }
})();
const ALLOWED_CHAR = (() => {
  try {
    return new RegExp('^[\\p{L}\\p{M}\\p{Nd}-]$', 'u');
  } catch {
    return null;
  }
})();
// Built at run time, never as a literal: an engine without property escapes must not fail to load this file.
const LETTER = (() => {
  try {
    return new RegExp('^\\p{L}$', 'u');
  } catch {
    return null;
  }
})();
/** Letters of another script that pass for Latin ones (UTS #39 whole-script confusables, the common ones). */
const LATIN_LOOKALIKE: Record<'Cyrillic' | 'Greek', string> = {
  Cyrillic: 'асԁеһіјӏорԛѕԝхуъьвкмнтгпш',
  Greek: 'αβεικνορτυχωηζ',
};
const COMBINATIONS: ScriptName[][] = [
  ['Latin', 'Han', 'Hiragana', 'Katakana'],
  ['Latin', 'Han', 'Hangul'],
  ['Latin', 'Han', 'Bopomofo'],
];

function scriptOf(ch: string): ScriptName | null {
  if (/^[0-9-]$/.test(ch)) return null;
  for (const s of SCRIPTS!) if (s.re.test(ch)) return s.name;
  return 'Other';
}

function safeLabel(label: string, tld: string): boolean {
  const chars = Array.from(label);
  if (!ALLOWED_CHAR || !LETTER || chars.some((c) => !ALLOWED_CHAR.test(c))) return false;
  const scripts = new Set(chars.map(scriptOf).filter((s): s is ScriptName => s !== null));
  if (scripts.size > 1 && !COMBINATIONS.some((combo) => [...scripts].every((s) => combo.includes(s)))) return false;
  if (scripts.size === 1) {
    const only = [...scripts][0];
    if (only === 'Cyrillic' || only === 'Greek') {
      const tldScripts = new Set(Array.from(tld).map(scriptOf));
      const lookalike = chars.every((c) => !LETTER?.test(c) || LATIN_LOOKALIKE[only].includes(c));
      if (lookalike && !tldScripts.has(only)) return false;
    }
  }
  return true;
}

/** RFC 3492 punycode decoding of one label (without "xn--"); null when it isn't valid punycode. */
export function punycodeDecode(input: string): string | null {
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  const out: number[] = [];
  const lastDash = input.lastIndexOf('-');
  if (lastDash > 0) {
    for (let j = 0; j < lastDash; j++) {
      const c = input.charCodeAt(j);
      if (c >= 0x80) return null;
      out.push(c);
    }
  }
  const adapt = (delta: number, numPoints: number, first: boolean) => {
    let d = first ? Math.floor(delta / damp) : delta >> 1;
    d += Math.floor(d / numPoints);
    let k = 0;
    while (d > ((base - tMin) * tMax) >> 1) {
      d = Math.floor(d / (base - tMin));
      k += base;
    }
    return k + Math.floor(((base - tMin + 1) * d) / (d + skew));
  };
  const digit = (c: number) =>
    c >= 0x30 && c <= 0x39 ? c - 22 : c >= 0x41 && c <= 0x5a ? c - 0x41 : c >= 0x61 && c <= 0x7a ? c - 0x61 : base;
  let n = 128;
  let i = 0;
  let bias = 72;
  for (let idx = lastDash > 0 ? lastDash + 1 : 0; idx < input.length; ) {
    const oldi = i;
    let w = 1;
    for (let k = base; ; k += base) {
      if (idx >= input.length) return null;
      const d = digit(input.charCodeAt(idx++));
      if (d >= base) return null;
      i += d * w;
      if (i > 0x10ffff * 4) return null;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (d < t) break;
      w *= base - t;
    }
    bias = adapt(i - oldi, out.length + 1, oldi === 0);
    n += Math.floor(i / (out.length + 1));
    i %= out.length + 1;
    if (n > 0x10ffff) return null;
    out.splice(i++, 0, n);
  }
  // A label made only of ASCII ("xn--zz-") is not an IDN: refused, so it can't pass for "zz".
  if (!out.some((c) => c >= 0x80)) return null;
  try {
    return String.fromCodePoint(...out).toLowerCase();
  } catch {
    return null;
  }
}
