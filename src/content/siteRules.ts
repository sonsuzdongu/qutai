import { normalizeHost, registrableDomain } from './filterLists';

/**
 * Site rules: the user's own blocking rules (pure code: no React Native, also runs in Node).
 *
 * Two kinds, kept in standard filter syntax so they can be exported:
 *   <scope>##<css selector>   hide matching elements on the pages the scope covers ("element hiding")
 *   ||ads.example.com^        block requests to a domain and its subdomains (fed to the network blocker)
 *
 * A hiding rule's scope is one of:
 *   https://example.com/entry/1?x=2   this page (the address without its #fragment; http and https alike)
 *   example.com/entry/*               pages under this path
 *   example.com                       this site only
 *   *.example.com                     this site and its subdomains (the default)
 * Sites are compared as siteKey does (agent/sitePolicy.ts): lowercase, IDN in punycode, without "www.", with the
 * port only when it isn't the scheme's default. So "example.com" also covers www.example.com.
 *
 * Network rules can't be scoped: the native blocker checks a request's host only (see filterLists.ts), so a blocked
 * domain is blocked on every site, as the filter lists' domains are. They keep the site they were made on, to be
 * listed with that site's rules.
 */

export type ScopeKind = 'page' | 'path' | 'site' | 'subdomains';
export const SCOPE_KINDS: readonly ScopeKind[] = ['page', 'path', 'site', 'subdomains'];
export const DEFAULT_SCOPE: ScopeKind = 'subdomains';

export function isScopeKind(value: unknown): value is ScopeKind {
  return typeof value === 'string' && (SCOPE_KINDS as readonly string[]).includes(value);
}

/** host: a site key (see above). path: for 'page' the path and query, for 'path' the prefix (ends with "/"). */
export type Scope = { kind: ScopeKind; host: string; path?: string };

export type RuleSource = 'assistant' | 'manual';

export type SiteRule = {
  id: string;
  /** The rule as a filter line (see above). */
  line: string;
  enabled: boolean;
  createdAt: number;
  source: RuleSource;
  /** The site it was made for (a site key); network rules are listed under it. */
  site: string;
  /** The page it was made on (without its fragment), so a scope can be widened and narrowed again. */
  url?: string;
};

export type ParsedRule = { kind: 'hide'; scope: Scope; selector: string } | { kind: 'block'; domain: string };

/** Limits that keep the page script small and a broken rule harmless. */
export const MAX_SELECTOR_LENGTH = 300;
export const MAX_RULES = 500;
export const MAX_RULES_PER_SITE = 50;

const DEFAULT_PORTS: Record<string, string> = { http: '80', https: '443' };

/** Splits an address into its site key and path (with the query, without the fragment); null for non-web pages. */
export function splitUrl(url: string): { host: string; path: string } | null {
  const match = /^(https?):\/\/([^/?#]*)([^#]*)/i.exec(url.trim());
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  const host = siteHost(match[2].replace(/^[^@]*@/, ''), DEFAULT_PORTS[scheme]);
  if (!host) return null;
  let path = match[3] || '/';
  if (path.startsWith('?')) path = `/${path}`;
  return { host, path };
}

/**
 * A host (with an optional port) as a site key: lowercase, IDN labels in punycode, without "www." and the default
 * port. IP addresses and single labels such as "localhost" are kept as they are; null when malformed.
 */
export function siteHost(raw: string, defaultPort?: string): string | null {
  let text = raw.trim().toLowerCase();
  let port = '';
  const portMatch = /^(.*):(\d{1,5})$/.exec(text);
  if (portMatch) {
    text = portMatch[1];
    port = portMatch[2] === defaultPort ? '' : portMatch[2];
  }
  if (text.endsWith('.')) text = text.slice(0, -1);
  text = text.replace(/^www\./, '');
  if (!text) return null;
  let host: string | null;
  if (text === 'localhost') host = text;
  else host = normalizeHost(text);
  if (!host) {
    // A public suffix such as "co.uk" is no site; anything else malformed is refused too.
    return null;
  }
  return port ? `${host}:${port}` : host;
}

/** The scope of the given kind for a page address; null for non-web pages. */
export function scopeForUrl(url: string, kind: ScopeKind): Scope | null {
  const parts = splitUrl(url);
  if (!parts) return null;
  if (kind === 'page') return { kind, host: parts.host, path: parts.path };
  if (kind === 'path') return { kind, host: parts.host, path: pathPrefix(parts.path) };
  return { kind, host: parts.host };
}

/** "/entry/123?x" → "/entry/"; "/a/b/" → "/a/b/"; "/" → "/". The folder the page is in. */
export function pathPrefix(path: string): string {
  const bare = path.replace(/[?#].*$/, '') || '/';
  return bare.endsWith('/') ? bare : bare.slice(0, bare.lastIndexOf('/') + 1) || '/';
}

export function formatScope(scope: Scope): string {
  switch (scope.kind) {
    case 'page':
      return `https://${scope.host}${scope.path ?? '/'}`;
    case 'path':
      return `${scope.host}${scope.path ?? '/'}*`;
    case 'site':
      return scope.host;
    case 'subdomains':
      return `*.${scope.host}`;
  }
}

/** The inverse of formatScope; null when it isn't one of the four forms. */
export function parseScope(text: string): Scope | null {
  const raw = text.trim();
  if (!raw || /\s/.test(raw)) return null;
  if (/^https?:\/\//i.test(raw)) {
    const parts = splitUrl(raw);
    return parts ? { kind: 'page', host: parts.host, path: parts.path } : null;
  }
  if (raw.startsWith('*.')) {
    const host = siteHost(raw.slice(2));
    return host ? { kind: 'subdomains', host } : null;
  }
  const slash = raw.indexOf('/');
  if (slash >= 0) {
    if (!raw.endsWith('*')) return null;
    const host = siteHost(raw.slice(0, slash));
    const path = raw.slice(slash, -1);
    if (!host || !path.startsWith('/') || /[*?#]/.test(path)) return null;
    return { kind: 'path', host, path };
  }
  const host = siteHost(raw);
  return host ? { kind: 'site', host } : null;
}

/** Whether a page address falls under a scope (hash and default ports ignored, "www." is the same site). */
export function matchesScope(scope: Scope, url: string): boolean {
  const parts = splitUrl(url);
  if (!parts) return false;
  return matchesParts(scope, parts.host, parts.path);
}

function matchesParts(scope: Scope, host: string, path: string): boolean {
  switch (scope.kind) {
    case 'subdomains':
      return host === scope.host || host.endsWith(`.${scope.host}`);
    case 'site':
      return host === scope.host;
    case 'path':
      return host === scope.host && path.startsWith(scope.path ?? '/');
    case 'page':
      return host === scope.host && path === (scope.path ?? '/');
  }
}

export type SelectorProblem = 'empty' | 'tooLong' | 'syntax' | 'tooBroad';

/**
 * Checks a CSS selector before it is saved or tried. Refused: empty or too long ones, text that could leave the
 * selector in the stylesheet ("{", "}", ";", "@", comments, "<", newlines), and over-broad ones: a part (between
 * commas) that names no id, class or attribute ("div", "body > div", "*"), or whose last element is "*", html, body,
 * head or :root. The page itself refuses a selector it can't parse (try_hide and the page script).
 */
export function selectorProblem(selector: string): SelectorProblem | null {
  const text = selector.trim();
  if (!text) return 'empty';
  if (text.length > MAX_SELECTOR_LENGTH) return 'tooLong';
  if (/[{};@<\\\n\r]|\/\*|\*\//.test(text)) return 'syntax';
  const parts = splitTopLevel(text);
  if (!parts) return 'syntax';
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) return 'syntax';
    if (!/[#.[]/.test(stripStrings(part))) return 'tooBroad';
    const last = lastCompound(part);
    if (/^(\*|html|body|head|:root)$/i.test(last)) return 'tooBroad';
  }
  return null;
}

/** Splits on commas outside brackets, parentheses and quotes; null when they don't balance. */
function splitTopLevel(text: string): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') {
      depth--;
      if (depth < 0) return null;
    } else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (quote || depth !== 0) return null;
  parts.push(text.slice(start));
  return parts;
}

function stripStrings(text: string): string {
  return text.replace(/"[^"]*"|'[^']*'/g, '""');
}

/** The last compound selector ("main > .ad div" → "div"), ignoring combinators inside brackets and parentheses. */
function lastCompound(part: string): string {
  const plain = stripStrings(part);
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < plain.length; i++) {
    const ch = plain[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0 && /[\s>+~]/.test(ch)) cut = i + 1;
  }
  return plain.slice(cut).trim();
}

export type DomainProblem = 'invalid' | 'ownSite';

/**
 * A domain to block, as a site-less host (lowercase, punycode, no "www."); refused when malformed, a public suffix,
 * or the site the rule is made for (or a domain it belongs to): blocking that would break the site itself.
 */
export function checkBlockDomain(raw: string, site: string | null): { domain: string } | { problem: DomainProblem } {
  const text = raw
    .trim()
    .replace(/^\|\|/, '')
    .replace(/\^$/, '')
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^\*\./, '');
  const domain = normalizeHost(text.replace(/:\d+$/, ''));
  if (!domain) return { problem: 'invalid' };
  if (site) {
    const siteName = site.replace(/:\d+$/, '');
    const own = registrableDomain(siteName);
    if (domain === siteName || siteName.endsWith(`.${domain}`) || domain === own) return { problem: 'ownSite' };
  }
  return { domain };
}

export function hideLine(scope: Scope, selector: string): string {
  return `${formatScope(scope)}##${selector.trim()}`;
}

export function blockLine(domain: string): string {
  return `||${domain}^`;
}

/** Reads one rule line; null when it isn't a valid hiding or domain rule. */
export function parseRuleLine(line: string): ParsedRule | null {
  const text = line.trim();
  const at = text.indexOf('##');
  if (at > 0) {
    const scope = parseScope(text.slice(0, at));
    const selector = text.slice(at + 2).trim();
    if (!scope || selectorProblem(selector)) return null;
    return { kind: 'hide', scope, selector };
  }
  const block = /^\|\|([^\s^$/|*]+)\^$/.exec(text);
  if (block) {
    const checked = checkBlockDomain(block[1], null);
    return 'domain' in checked ? { kind: 'block', domain: checked.domain } : null;
  }
  return null;
}

/** What the page script needs of a hiding rule: s scope kind, h host, p path, c selector. */
export type PageRule = { s: ScopeKind; h: string; p?: string; c: string };

/** The enabled hiding rules for the page script (it matches them against the address itself, also after SPA moves). */
export function pageRules(rules: readonly SiteRule[]): PageRule[] {
  const out: PageRule[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const parsed = parseRuleLine(rule.line);
    if (parsed?.kind !== 'hide') continue;
    out.push({
      s: parsed.scope.kind,
      h: parsed.scope.host,
      ...(parsed.scope.path !== undefined ? { p: parsed.scope.path } : {}),
      c: parsed.selector,
    });
  }
  return out;
}

/** The enabled blocked domains, once each. */
export function blockedDomains(rules: readonly SiteRule[]): string[] {
  const set = new Set<string>();
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const parsed = parseRuleLine(rule.line);
    if (parsed?.kind === 'block') set.add(parsed.domain);
  }
  return [...set].sort();
}

/** Whether a site (key) is among the "Don't block on this site" sites or a subdomain of one. */
export function isOffSite(host: string, offSites: readonly string[]): boolean {
  const bare = host.replace(/:\d+$/, '');
  return offSites.some((s) => host === s || bare === s || host.endsWith(`.${s}`) || bare.endsWith(`.${s}`));
}

/** The enabled hiding selectors that apply to a page address (none on off sites). */
export function selectorsFor(rules: readonly SiteRule[], url: string, offSites: readonly string[] = []): string[] {
  const parts = splitUrl(url);
  if (!parts || isOffSite(parts.host, offSites)) return [];
  return pageRules(rules)
    .filter((r) => matchesParts({ kind: r.s, host: r.h, path: r.p }, parts.host, parts.path))
    .map((r) => r.c);
}

/** Rules listed under a site: made for it, or hiding rules whose scope covers it. */
export function rulesForSite(rules: readonly SiteRule[], site: string): SiteRule[] {
  return rules.filter((rule) => {
    if (rule.site === site) return true;
    const parsed = parseRuleLine(rule.line);
    return parsed?.kind === 'hide' && parsed.scope.kind === 'subdomains' && site.endsWith(`.${parsed.scope.host}`);
  });
}

/**
 * Runs in every tab's main frame before the page's own scripts (and again after load on Android): hides the
 * elements of the rules that match the current address with a stylesheet, one CSS rule per selector so that a
 * selector the WebView can't parse drops only itself. Re-evaluated when the address changes without a load
 * (history.pushState / replaceState, back and forward, hash changes). Does nothing on the "Don't block on this site"
 * sites. Running it again (or window.__qutaiSiteRules.set) replaces the rules on the page already open.
 * The matching repeats matchesParts above in ES5 (Hermes can't ship functions into the page as source).
 */
export function siteRulesScript(rules: readonly PageRule[], offSites: readonly string[]): string {
  return `(function () {
  var RULES = ${JSON.stringify(rules)};
  var OFF = ${JSON.stringify(offSites)};
  if (window.__qutaiSiteRules) { window.__qutaiSiteRules.set(RULES, OFF); return; }
  var style = null;
  var current = '';
  function here() {
    var host = String(location.hostname || '').toLowerCase().replace(/\\.$/, '').replace(/^www\\./, '');
    var port = location.port;
    if (port && !((location.protocol === 'https:' && port === '443') || (location.protocol === 'http:' && port === '80'))) {
      host += ':' + port;
    }
    return { host: host, bare: host.replace(/:\\d+$/, ''), path: (location.pathname || '/') + (location.search || '') };
  }
  function off(h) {
    for (var i = 0; i < OFF.length; i++) {
      var s = OFF[i];
      if (h.host === s || h.bare === s || h.host.slice(-s.length - 1) === '.' + s || h.bare.slice(-s.length - 1) === '.' + s) return true;
    }
    return false;
  }
  function matches(r, h) {
    if (r.s === 'subdomains') return h.host === r.h || h.host.slice(-r.h.length - 1) === '.' + r.h;
    if (h.host !== r.h) return false;
    if (r.s === 'site') return true;
    if (r.s === 'path') return h.path.indexOf(r.p || '/') === 0;
    return h.path === (r.p || '/');
  }
  function apply() {
    var css = '';
    var h = here();
    if (!off(h)) {
      for (var i = 0; i < RULES.length; i++) {
        var r = RULES[i];
        if (!matches(r, h)) continue;
        try { document.createDocumentFragment().querySelector(r.c); } catch (e) { continue; }
        css += r.c + '{display:none!important}\\n';
      }
    }
    if (css === current && (style || !css)) return;
    current = css;
    if (!style) {
      if (!css) return;
      style = document.createElement('style');
      style.setAttribute('data-qutai', 'site-rules');
    }
    style.textContent = css;
    var root = document.head || document.documentElement;
    if (root && style.parentNode !== root) root.appendChild(style);
  }
  function later() { setTimeout(apply, 0); }
  window.__qutaiSiteRules = {
    set: function (rules, offSites) { RULES = rules; OFF = offSites; current = null; apply(); }
  };
  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    if (typeof original !== 'function') return;
    history[name] = function () { var result = original.apply(this, arguments); later(); return result; };
  });
  window.addEventListener('popstate', later);
  window.addEventListener('hashchange', later);
  // The style element must be in the document: at document start the root element may not exist yet, and some pages
  // replace <head>.
  if (document.documentElement) apply();
  else new MutationObserver(function (_, observer) {
    if (!document.documentElement) return;
    observer.disconnect();
    apply();
  }).observe(document, { childList: true });
  document.addEventListener('DOMContentLoaded', function () { current = null; apply(); });
})(); true;`;
}

export type TryMeasure = {
  selector: string;
  /** The page could not parse it. */
  invalid?: boolean;
  /** Elements it matched. */
  count: number;
  /** Matched elements that were visible. */
  visible: number;
  /** Share of the page's area (document width × height) covered by visible matches that hold text, 0–1 (empty boxes, the gaps ads leave, don't count). */
  area: number;
  /** Share of the page's visible text inside the matches, 0–1. */
  text: number;
};

/** Over-broad at try time: more than this share of the page's area or text, or this many elements. */
export const MAX_AREA_SHARE = 0.25;
export const MAX_TEXT_SHARE = 0.1;
export const MAX_MATCHES = 60;

export type TryVerdict = { ok: true } | { ok: false; reason: 'invalid' | 'noMatch' | 'area' | 'text' | 'count' };

/** Whether a tried selector is acceptable; the reasons go to the model. */
export function judgeMeasure(m: TryMeasure): TryVerdict {
  if (m.invalid) return { ok: false, reason: 'invalid' };
  if (m.count === 0) return { ok: false, reason: 'noMatch' };
  if (m.count > MAX_MATCHES) return { ok: false, reason: 'count' };
  if (m.area > MAX_AREA_SHARE) return { ok: false, reason: 'area' };
  if (m.text > MAX_TEXT_SHARE) return { ok: false, reason: 'text' };
  return { ok: true };
}
