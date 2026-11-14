/**
 * Filter lists for network blocking, reduced to domains (pure: no React Native, also runs in Node).
 *
 * Qutai blocks by request host, not with full Adblock Plus semantics. From a list it uses only the rules that
 * mean "block requests to this domain and its subdomains":
 *   ||example.com^             block everywhere
 *   ||example.com^$third-party block when the page is on another site (also $3p)
 *   @@||example.com^           exception (the domain and its subdomains are never blocked)
 *   0.0.0.0 example.com        hosts-file line (also 127.0.0.1, ::1, ::), or a bare domain in a domains-only list
 * Everything else (paths, wildcards, regexes, element hiding "##", scriptlets, $domain= and other options) is
 * skipped and counted. Lists are downloaded on the phone from their publishers; nothing from them is in the app.
 */

export type ListStats = {
  /** Rules in the list (lines that are not comments, headers or empty). */
  rules: number;
  /** Rules turned into a blocked domain or an exception. */
  used: number;
  /** Rules Qutai can't express as a domain (paths, cosmetic rules, other options...) or that were invalid. */
  skipped: number;
};

export type ParsedList = {
  /** Blocked everywhere (with subdomains). */
  block: string[];
  /** Blocked only when the request goes to another site than the page's ($third-party). */
  blockThirdParty: string[];
  /** Never blocked (with subdomains), whatever list blocks them. */
  allow: string[];
  stats: ListStats;
};

/** The blocked and exception domains of every enabled list together, reduced to what can still match. */
export type CompiledBlocker = { block: string[]; blockThirdParty: string[]; allow: string[] };

/** A hostile or broken list must not exhaust memory: lines and domains beyond these are ignored. */
export const MAX_LINE_LENGTH = 2048;
export const MAX_DOMAINS_PER_LIST = 250_000;

const ADBLOCK_DOMAIN_RULE = /^(@@)?\|\|([^\s^$/|*?=&:@]+)\^\|?(?:\$(.+))?$/;
const HOSTS_LINE = /^(?:0\.0\.0\.0|127\.0\.0\.1|::1|::|0)\s+(.+)$/;
const BARE_DOMAIN = /^[^\s/:#!|^$@*?&=\\[\]]+\.[^\s/:#!|^$@*?&=\\[\]]+$/;
/** Cosmetic, scriptlet and HTML rules: "##", "#@#", "#?#", "#$#", "#%#", "#@$#", "$$", "$@$"... */
const COSMETIC = /#[@?$%]{0,2}#|\$@?\$/;
const COSMETIC_START = /^#[@?$%]{0,2}#/;
const LOCAL_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'local',
  'broadcasthost',
  'ip6-localhost',
  'ip6-loopback',
  'ip6-localnet',
  'ip6-mcastprefix',
  'ip6-allnodes',
  'ip6-allrouters',
  'ip6-allhosts',
  '0.0.0.0',
]);

/**
 * Parses list text a bit at a time (feed lines, then finish), so the caller can pause between batches and keep
 * the UI responsive. Tolerates comments, headers, Windows line endings, a byte-order mark, IDN hosts and junk.
 */
export class ListParser {
  private block = new Set<string>();
  private blockThirdParty = new Set<string>();
  private allow = new Set<string>();
  private stats: ListStats = { rules: 0, used: 0, skipped: 0 };
  /** Adblock Plus syntax (from its "[Adblock Plus x]" header or rules): bare domains are then substring rules. */
  private adblock = false;
  private first = true;

  /** Feeds one line of the list. */
  line(raw: string): void {
    let text = raw;
    if (this.first) {
      this.first = false;
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    text = text.trim();
    if (!text) return;
    if (text.length > MAX_LINE_LENGTH) {
      this.skip();
      return;
    }
    // Headers and comments.
    if (text.startsWith('[') && /^\[(adblock|ublock|adguard)/i.test(text)) {
      this.adblock = true;
      return;
    }
    if (text.startsWith('!')) return;
    if (text.startsWith('#')) {
      // Element hiding in Adblock Plus syntax ("##.ad", "#@#...", "#?#..."); otherwise a hosts-file comment.
      if (this.adblock && COSMETIC_START.test(text)) this.skip();
      return;
    }

    const rule = ADBLOCK_DOMAIN_RULE.exec(text);
    if (rule) {
      this.adblock = true;
      this.adblockRule(!!rule[1], rule[2], rule[3]);
      return;
    }

    const hosts = HOSTS_LINE.exec(text);
    if (hosts) {
      this.stats.rules++;
      let any = false;
      for (const word of hosts[1].split(/\s+/)) {
        if (word.startsWith('#')) break;
        if (LOCAL_HOSTS.has(word.toLowerCase())) continue;
        const host = normalizeHost(word);
        if (host && this.add(this.block, host)) any = true;
      }
      if (any) this.stats.used++;
      else this.stats.skipped++;
      return;
    }

    // Element hiding for some sites, scriptlets, HTML filters, and other network rules (paths, wildcards...).
    if (COSMETIC.test(text) || /^(?:\|\||@@|\||\/)/.test(text)) {
      this.adblock = true;
      this.skip();
      return;
    }

    // A domains-only list ("example.com" per line). In Adblock Plus syntax this is a substring match: skipped.
    const bare = text.replace(/\s+#.*$/, '');
    if (!this.adblock && BARE_DOMAIN.test(bare)) {
      const host = LOCAL_HOSTS.has(bare.toLowerCase()) ? null : normalizeHost(bare);
      this.stats.rules++;
      if (host && this.add(this.block, host)) this.stats.used++;
      else this.stats.skipped++;
      return;
    }
    this.skip();
  }

  /** Feeds a whole block of text (any line endings). */
  text(chunk: string): void {
    for (const line of chunk.split(/\r\n|\r|\n/)) this.line(line);
  }

  finish(): ParsedList {
    // Duplicates were merged by the sets; drop domains already covered by a blocked parent.
    const block = withoutCovered(this.block, this.block);
    const blockThirdParty = [...this.blockThirdParty].filter(
      (d) => !hasAncestorOrSelf(d, this.block) && !hasStrictAncestor(d, this.blockThirdParty),
    );
    const allow = withoutCovered(this.allow, this.allow);
    return { block: block.sort(), blockThirdParty: blockThirdParty.sort(), allow: allow.sort(), stats: this.stats };
  }

  private adblockRule(exception: boolean, rawHost: string, rawOptions: string | undefined) {
    this.stats.rules++;
    const host = normalizeHost(rawHost);
    if (!host) {
      this.stats.skipped++;
      return;
    }
    const options = rawOptions ? rawOptions.split(',').map((o) => o.trim().toLowerCase()) : [];
    // Exceptions only without conditions: a conditional exception would unblock the domain everywhere.
    if (exception) {
      if (options.every((o) => o === 'important')) {
        if (this.add(this.allow, host)) this.stats.used++;
        else this.stats.skipped++;
      } else this.stats.skipped++;
      return;
    }
    let thirdParty = false;
    for (const option of options) {
      if (option === 'third-party' || option === '3p') thirdParty = true;
      // $important only matters against the list's own exceptions; the domain is blocked either way.
      else if (option !== 'important') {
        this.stats.skipped++;
        return;
      }
    }
    if (this.add(thirdParty ? this.blockThirdParty : this.block, host)) this.stats.used++;
    else this.stats.skipped++;
  }

  private add(set: Set<string>, host: string): boolean {
    if (set.has(host)) return true;
    if (this.block.size + this.blockThirdParty.size + this.allow.size >= MAX_DOMAINS_PER_LIST) return false;
    set.add(host);
    return true;
  }

  private skip() {
    this.stats.rules++;
    this.stats.skipped++;
  }
}

/** Parses a whole list at once (tests, small lists). */
export function parseList(text: string): ParsedList {
  const parser = new ListParser();
  parser.text(text);
  return parser.finish();
}

/**
 * Parses a list in batches of lines, waiting on `pause` between them (e.g. a zero timeout) so a big list doesn't
 * freeze the UI.
 */
export async function parseListInBatches(
  text: string,
  pause: () => Promise<void>,
  batchLines = 4000,
): Promise<ParsedList> {
  const parser = new ListParser();
  let start = 0;
  let count = 0;
  while (start < text.length) {
    let end = text.indexOf('\n', start);
    if (end < 0) end = text.length;
    parser.line(text.slice(start, end));
    start = end + 1;
    if (++count % batchLines === 0) await pause();
  }
  return parser.finish();
}

/**
 * Merges the enabled lists. An exception from any list wins over a block from any list (as in Adblock Plus, where
 * exceptions apply across subscriptions). The result keeps only entries that can still change anything.
 */
export function mergeLists(lists: Pick<ParsedList, 'block' | 'blockThirdParty' | 'allow'>[]): CompiledBlocker {
  const blockAll = new Set<string>();
  const thirdAll = new Set<string>();
  const allowAll = new Set<string>();
  for (const list of lists) {
    for (const d of list.block) blockAll.add(d);
    for (const d of list.blockThirdParty) thirdAll.add(d);
    for (const d of list.allow) allowAll.add(d);
  }
  const allow = new Set(withoutCovered(allowAll, allowAll));
  // Entries at or under an exception never block anything.
  const blockSet = new Set(withoutCovered(blockAll, blockAll).filter((d) => !hasAncestorOrSelf(d, allow)));
  const third = [...thirdAll].filter(
    (d) => !hasAncestorOrSelf(d, blockSet) && !hasStrictAncestor(d, thirdAll) && !hasAncestorOrSelf(d, allow),
  );
  const thirdSet = new Set(third);
  // An exception matters only under something blocked (e.g. block example.com, allow cdn.example.com).
  const usefulAllow = [...allow].filter((d) => hasStrictAncestor(d, blockSet) || hasStrictAncestor(d, thirdSet));
  return { block: [...blockSet].sort(), blockThirdParty: third.sort(), allow: usefulAllow.sort() };
}

/**
 * The reference matcher (the Android native one does the same): whether a request to `host` from a page on
 * `pageHost` is blocked. Walks the host's parent domains, so it costs one set lookup per label.
 */
export function isBlocked(
  host: string,
  pageHost: string | null,
  sets: { block: Set<string>; blockThirdParty: Set<string>; allow: Set<string> },
): boolean {
  let blocked = false;
  let thirdPartyOnly = false;
  for (let d: string | null = host; d; d = parentDomain(d)) {
    if (sets.allow.has(d)) return false;
    if (sets.block.has(d)) blocked = true;
    else if (sets.blockThirdParty.has(d)) thirdPartyOnly = true;
  }
  if (blocked) return true;
  return thirdPartyOnly && (!pageHost || registrableDomain(host) !== registrableDomain(pageHost));
}

/** "a.b.example.com" -> "b.example.com"; null once only the top-level domain would be left. */
export function parentDomain(domain: string): string | null {
  const dot = domain.indexOf('.');
  if (dot < 0) return null;
  const parent = domain.slice(dot + 1);
  return parent.includes('.') ? parent : null;
}

function hasStrictAncestor(domain: string, set: Set<string>): boolean {
  for (let d = parentDomain(domain); d; d = parentDomain(d)) if (set.has(d)) return true;
  return false;
}

function hasAncestorOrSelf(domain: string, set: Set<string>): boolean {
  return set.has(domain) || hasStrictAncestor(domain, set);
}

function withoutCovered(domains: Set<string>, by: Set<string>): string[] {
  return [...domains].filter((d) => !hasStrictAncestor(d, by));
}

// --- Hosts -------------------------------------------------------------------------------------------------

const LABEL = /^(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)$/;
const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/**
 * Lower-case ASCII host (IDN labels in punycode, no trailing dot), or null when it isn't a usable domain:
 * malformed, a single label, or a public suffix such as "com.tr" (a list must not block a whole country).
 */
export function normalizeHost(raw: string): string | null {
  let host = raw.trim().toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (!host || host.length > 253) return null;
  if (IPV4.test(host)) return host;
  const labels = host.split('.');
  if (labels.length < 2) return null;
  for (let i = 0; i < labels.length; i++) {
    let label = labels[i];
    if (/[^\x00-\x7f]/.test(label)) {
      const encoded = punycodeEncode(label.normalize('NFC'));
      if (!encoded) return null;
      label = `xn--${encoded}`;
      labels[i] = label;
    }
    if (!LABEL.test(label)) return null;
  }
  // The top-level domain is never numeric (that would be a partial IP address).
  if (/^\d+$/.test(labels[labels.length - 1])) return null;
  const ascii = labels.join('.');
  if (ascii.length > 253 || isPublicSuffix(ascii)) return null;
  return ascii;
}

/**
 * Second-level labels that, under a two-letter country code, form a public suffix ("co.uk", "com.tr", "or.jp",
 * "gov.br"...). A small heuristic instead of the full Public Suffix List; see registrableDomain.
 */
const SECOND_LEVEL_SUFFIXES = new Set([
  'ac',
  'co',
  'com',
  'edu',
  'gen',
  'go',
  'gob',
  'gouv',
  'gov',
  'k12',
  'ltd',
  'mil',
  'ne',
  'net',
  'nic',
  'nom',
  'or',
  'org',
  'plc',
  'sch',
]);
/** Turkey has more of them ("bel.tr", "web.tr", "av.tr"...). */
const TR_SECOND_LEVEL_SUFFIXES = new Set([
  'av',
  'bbs',
  'bel',
  'biz',
  'dr',
  'info',
  'kep',
  'name',
  'pol',
  'tel',
  'tsk',
  'tv',
  'web',
]);

function isCountrySecondLevel(secondLabel: string, tld: string): boolean {
  if (tld.length !== 2) return false;
  return SECOND_LEVEL_SUFFIXES.has(secondLabel) || (tld === 'tr' && TR_SECOND_LEVEL_SUFFIXES.has(secondLabel));
}

/** Whether a domain is itself a public suffix by the heuristic (a top-level domain or e.g. "com.tr"). */
export function isPublicSuffix(domain: string): boolean {
  const labels = domain.split('.');
  if (labels.length === 1) return true;
  return labels.length === 2 && isCountrySecondLevel(labels[0], labels[1]);
}

/**
 * The site a host belongs to, for telling first- from third-party requests: the last two labels, or three when
 * the last two look like a country's public second level ("bbc.co.uk", "hurriyet.com.tr"). IP addresses are their
 * own site. Limits (no full Public Suffix List): hosting suffixes such as github.io, blogspot.com or
 * cloudfront.net count as one site (third-party rules then don't apply between two of their customers: fewer
 * blocks, never more), and the few countries with other second-level patterns are seen as two-label sites.
 */
export function registrableDomain(host: string): string {
  if (IPV4.test(host)) return host;
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const n = labels.length;
  const keep = isCountrySecondLevel(labels[n - 2], labels[n - 1]) ? 3 : 2;
  return labels.slice(-keep).join('.');
}

/** RFC 3492 punycode for one label (without the "xn--" prefix); null if it can't be encoded. */
export function punycodeEncode(input: string): string | null {
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  const codePoints = Array.from(input, (c) => c.codePointAt(0) ?? 0);
  let n = 128;
  let delta = 0;
  let bias = 72;
  let output = codePoints
    .filter((c) => c < 128)
    .map((c) => String.fromCharCode(c))
    .join('');
  const basic = output.length;
  let handled = basic;
  if (basic > 0) output += '-';
  const digit = (d: number) => String.fromCharCode(d + 22 + 75 * (d < 26 ? 1 : 0));
  const adapt = (deltaIn: number, points: number, first: boolean) => {
    let k = 0;
    let d = first ? Math.floor(deltaIn / damp) : deltaIn >> 1;
    d += Math.floor(d / points);
    for (; d > ((base - tMin) * tMax) >> 1; k += base) d = Math.floor(d / (base - tMin));
    return Math.floor(k + ((base - tMin + 1) * d) / (d + skew));
  };
  while (handled < codePoints.length) {
    let m = Infinity;
    for (const c of codePoints) if (c >= n && c < m) m = c;
    if ((m - n) * (handled + 1) > 0x7fffffff - delta) return null;
    delta += (m - n) * (handled + 1);
    n = m;
    for (const c of codePoints) {
      if (c < n) delta++;
      if (c === n) {
        let q = delta;
        for (let k = base; ; k += base) {
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (q < t) break;
          output += digit(t + ((q - t) % (base - t)));
          q = Math.floor((q - t) / (base - t));
        }
        output += digit(q);
        bias = adapt(delta, handled + 1, handled === basic);
        delta = 0;
        handled++;
      }
    }
    delta++;
    n++;
  }
  return output;
}

// --- Native formats ----------------------------------------------------------------------------------------

/**
 * Android: the file the native matcher reads (RNCWebViewContentBlocker.java). One entry per line:
 * "b <domain>" blocked, "t <domain>" blocked when third-party, "e <domain>" exception.
 */
export function androidBlockerFile(compiled: CompiledBlocker): string {
  const lines = ['qutai-content-blocker 1'];
  for (const d of compiled.block) lines.push(`b ${d}`);
  for (const d of compiled.blockThirdParty) lines.push(`t ${d}`);
  for (const d of compiled.allow) lines.push(`e ${d}`);
  return lines.join('\n') + '\n';
}

/** WebKit's documented limit is 150,000 rules per list (50,000 on older systems); stay well below it. */
export const MAX_RULES_PER_CONTENT_RULE_LIST = 40_000;

/** Any scheme, then the domain or one of its subdomains, then the port or the path. */
function hostFilter(domain: string): string {
  return `^[a-z][a-z0-9.+-]*://([a-z0-9_.-]*\\.)?${domain.replace(/\./g, '\\.')}[:/]`;
}

/**
 * iOS: the WebKit content rule lists (JSON) for the compiled domains, split so each stays under the rule limit.
 * In WebKit "ignore-previous-rules" only works inside one list, so every list ends with the exceptions that undo
 * one of its blocks, and with a rule letting every top-level page load itself (a blocked page would look like a
 * broken browser; its ads and trackers are still blocked).
 */
export function contentRuleLists(compiled: CompiledBlocker, maxRules = MAX_RULES_PER_CONTENT_RULE_LIST): string[] {
  const entries: { domain: string; thirdParty: boolean }[] = [
    ...compiled.block.map((domain) => ({ domain, thirdParty: false })),
    ...compiled.blockThirdParty.map((domain) => ({ domain, thirdParty: true })),
  ];
  const lists: string[] = [];
  // Keep room for the exceptions and the top-level rule in each list.
  const perList = Math.max(1, maxRules - Math.min(compiled.allow.length, maxRules / 2) - 1);
  for (let start = 0; start < entries.length; start += perList) {
    const slice = entries.slice(start, start + perList);
    const inList = new Set(slice.map((e) => e.domain));
    const rules: string[] = slice.map((e) =>
      JSON.stringify({
        trigger: e.thirdParty
          ? { 'url-filter': hostFilter(e.domain), 'load-type': ['third-party'] }
          : { 'url-filter': hostFilter(e.domain) },
        action: { type: 'block' },
      }),
    );
    for (const domain of compiled.allow) {
      if (rules.length >= maxRules - 1) break;
      if (!hasStrictAncestor(domain, inList)) continue;
      rules.push(
        JSON.stringify({ trigger: { 'url-filter': hostFilter(domain) }, action: { type: 'ignore-previous-rules' } }),
      );
    }
    rules.push(
      JSON.stringify({
        trigger: { 'url-filter': '.*', 'resource-type': ['document'], 'load-context': ['top-frame'] },
        action: { type: 'ignore-previous-rules' },
      }),
    );
    lists.push(`[${rules.join(',\n')}]`);
  }
  return lists;
}

/** Short stable hash (FNV-1a, 32 bits, hex) of a text: names compiled lists by their content. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
