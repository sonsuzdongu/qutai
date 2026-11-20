import { sanitizeCss } from './userCss';
import { formatScope, parseScope, type RuleSource, type Scope, type ScopeKind, scopeForUrl, siteHost, splitUrl } from './siteRules';

/**
 * User styles (docs/page-customisation.md): CSS the user keeps for the pages a scope covers. Pure code: no React
 * Native, also runs in Node. The CSS is always the sanitiser's output (content/userCss.ts).
 *
 * Scopes are the hide rules' four (content/siteRules.ts) plus "everywhere" ("*"), written as text the same way.
 */

export type StyleScopeKind = ScopeKind | 'all';
export const STYLE_SCOPE_KINDS: readonly StyleScopeKind[] = ['page', 'path', 'site', 'subdomains', 'all'];

export type StyleScope = Scope | { kind: 'all'; host: '' };

export type UserStyle = {
  id: string;
  /** The readable name ("Red links"). */
  name: string;
  /** Where it applies, as text: a hide rule's scope, or "*" for everywhere. */
  scope: string;
  /** Sanitised CSS. */
  css: string;
  enabled: boolean;
  source: RuleSource;
  /** The site it was made for (listed under it, except "everywhere" styles). */
  site: string;
  /** The page it was made on (without its fragment), so a scope can be widened and narrowed again. */
  url?: string;
  createdAt: number;
};

export const MAX_STYLES = 200;
export const MAX_STYLES_PER_SITE = 20;
export const MAX_STYLE_NAME = 80;

export function parseStyleScope(text: string): StyleScope | null {
  const raw = text.trim();
  if (raw === '*') return { kind: 'all', host: '' };
  return parseScope(raw);
}

export function formatStyleScope(scope: StyleScope): string {
  return scope.kind === 'all' ? '*' : formatScope(scope);
}

export function styleScopeForUrl(url: string, kind: StyleScopeKind): StyleScope | null {
  if (kind === 'all') return splitUrl(url) ? { kind: 'all', host: '' } : null;
  return scopeForUrl(url, kind);
}

/** Whether a page address falls under a style's scope ("everywhere" covers every web page). */
export function matchesStyleScope(scope: StyleScope, url: string): boolean {
  const parts = splitUrl(url);
  if (!parts) return false;
  const { host, path } = parts;
  switch (scope.kind) {
    case 'all':
      return true;
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

/** A name: one line, trimmed, at most MAX_STYLE_NAME characters; "" when nothing is left. */
export function cleanStyleName(name: unknown): string {
  if (typeof name !== 'string') return '';
  const text = name.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return [...text].slice(0, MAX_STYLE_NAME).join('').trim();
}

/** The enabled styles that apply to a page address. */
export function stylesFor(styles: readonly UserStyle[], url: string): UserStyle[] {
  return styles.filter((s) => {
    if (!s.enabled) return false;
    const scope = parseStyleScope(s.scope);
    return !!scope && matchesStyleScope(scope, url);
  });
}

/** What the page script needs of a style: s scope kind, h host, p path, c CSS. */
export type PageStyle = { s: StyleScopeKind; h: string; p?: string; c: string };

/** The enabled styles for the page script (it matches them against the address itself, also after SPA moves). */
export function pageStyles(styles: readonly UserStyle[]): PageStyle[] {
  const out: PageStyle[] = [];
  for (const style of styles) {
    if (!style.enabled) continue;
    const scope = parseStyleScope(style.scope);
    if (!scope) continue;
    out.push({ s: scope.kind, h: scope.host, ...(scope.kind !== 'all' && scope.path !== undefined ? { p: scope.path } : {}), c: style.css });
  }
  return out;
}

/**
 * A style read from a file or a backup, checked again: its CSS through the sanitiser, its scope and name. null when
 * any part is refused.
 */
export function checkStyleEntry(entry: { name?: unknown; scope?: unknown; css?: unknown }): { name: string; scope: string; css: string } | null {
  if (typeof entry.scope !== 'string' || typeof entry.css !== 'string') return null;
  const scope = parseStyleScope(entry.scope);
  if (!scope) return null;
  const css = sanitizeCss(entry.css);
  if (!css.ok) return null;
  return { name: cleanStyleName(entry.name) || formatStyleScope(scope), scope: formatStyleScope(scope), css: css.css };
}

/** A user style in the encrypted backup and the server backup (src/backup/payload.ts, sites.styles). */
export type BackupStyle = {
  name: string;
  scope: string;
  css: string;
  enabled: boolean;
  source: RuleSource;
  site: string;
  url?: string;
  createdAt: number;
};

/**
 * The styles of a backup, checked like a style read from a rules file (the CSS through the sanitiser, the scope, the
 * name); anything else is dropped. The same scope and CSS twice is kept once.
 */
export function readBackupStyles(value: unknown, now = Date.now()): BackupStyle[] {
  if (!Array.isArray(value)) return [];
  const out = new Map<string, BackupStyle>();
  for (const raw of value.slice(0, MAX_STYLES)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const st = raw as Record<string, unknown>;
    const checked = checkStyleEntry({ name: st.name, scope: st.scope, css: st.css });
    if (!checked) continue;
    const scope = parseStyleScope(checked.scope)!;
    const listed = typeof st.site === 'string' ? (st.site === '*' ? '*' : siteHost(st.site)) : null;
    const url = typeof st.url === 'string' && /^https?:\/\//i.test(st.url) && st.url.length <= 2048 ? st.url : undefined;
    const created = typeof st.createdAt === 'number' && Number.isFinite(st.createdAt) && st.createdAt > 0 ? Math.min(st.createdAt, now) : now;
    out.set(`${checked.scope}\n${checked.css}`, {
      ...checked,
      enabled: st.enabled !== false,
      source: st.source === 'assistant' ? 'assistant' : 'manual',
      site: listed ?? styleSite(scope, '*'),
      ...(url ? { url } : {}),
      createdAt: created,
    });
  }
  return [...out.values()];
}

/** The site a style is listed under: its scope's host, or (everywhere) the site it came with. */
export function styleSite(scope: StyleScope, fallback: string): string {
  return scope.kind === 'all' ? fallback : scope.host;
}

/**
 * Runs in every tab's main frame before the page's own scripts (and again after load on Android): one style element
 * with the user styles whose scope matches the current address, moved to the end of the document once the page's
 * own sheets are in (DOMContentLoaded, load) so it comes after them. Re-evaluated after SPA moves. `off`: the user
 * turned styles off for this tab ("Styles off for this page"): nothing is applied, the trial included.
 * window.__qutaiUserStyles.set(styles, off) replaces the styles on the page already open; .trial(css) applies a style
 * the user approved but did not keep (gone with the next page load), .trial('') removes it.
 * The matching repeats matchesStyleScope above in ES5 (Hermes can't ship functions into the page as source).
 */
export function userStylesScript(styles: readonly PageStyle[], off: boolean): string {
  return `(function () {
  var STYLES = ${JSON.stringify(styles)};
  var OFF = ${off ? 'true' : 'false'};
  if (window.__qutaiUserStyles) { window.__qutaiUserStyles.set(STYLES, OFF); return; }
  var style = null;
  var trialCss = '';
  var current = null;
  function here() {
    var host = String(location.hostname || '').toLowerCase().replace(/\\.$/, '').replace(/^www\\./, '');
    var port = location.port;
    if (port && !((location.protocol === 'https:' && port === '443') || (location.protocol === 'http:' && port === '80'))) {
      host += ':' + port;
    }
    return { web: /^https?:$/.test(location.protocol), host: host, path: (location.pathname || '/') + (location.search || '') };
  }
  function matches(r, h) {
    if (r.s === 'all') return true;
    if (r.s === 'subdomains') return h.host === r.h || h.host.slice(-r.h.length - 1) === '.' + r.h;
    if (h.host !== r.h) return false;
    if (r.s === 'site') return true;
    if (r.s === 'path') return h.path.indexOf(r.p || '/') === 0;
    return h.path === (r.p || '/');
  }
  function place() {
    if (!style) return;
    var root = document.documentElement;
    if (root && (style.parentNode !== root || root.lastChild !== style)) root.appendChild(style);
  }
  function apply() {
    var css = '';
    var h = here();
    if (!OFF && h.web) {
      for (var i = 0; i < STYLES.length; i++) if (matches(STYLES[i], h)) css += STYLES[i].c + '\\n';
      if (trialCss) css += trialCss + '\\n';
    }
    if (css === current && (style || !css)) return;
    current = css;
    if (!style) {
      if (!css) return;
      style = document.createElement('style');
      style.setAttribute('data-qutai', 'user-styles');
    }
    style.textContent = css;
    place();
  }
  function later() { setTimeout(apply, 0); }
  window.__qutaiUserStyles = {
    set: function (styles, off) { STYLES = styles; OFF = off; current = null; apply(); },
    trial: function (css) { trialCss = css || ''; current = null; apply(); },
    applies: function () { return !!(style && style.textContent); }
  };
  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    if (typeof original !== 'function') return;
    history[name] = function () { var result = original.apply(this, arguments); later(); return result; };
  });
  window.addEventListener('popstate', later);
  window.addEventListener('hashchange', later);
  if (document.documentElement) apply();
  else new MutationObserver(function (_, observer) {
    if (!document.documentElement) return;
    observer.disconnect();
    apply();
  }).observe(document, { childList: true });
  document.addEventListener('DOMContentLoaded', function () { current = null; apply(); place(); });
  window.addEventListener('load', place);
})(); true;`;
}

/**
 * Applies (or with "" removes) the trial style on the page already open, with the kept styles as they are now (so
 * keeping a style swaps the trial for the kept copy in one step); installs the script first if needed.
 */
export function trialStyleScript(css: string, styles: readonly PageStyle[], off: boolean): string {
  return `if (window.top === window) (function () {
  if (!window.__qutaiUserStyles) { ${userStylesScript(styles, off)} }
  else window.__qutaiUserStyles.set(${JSON.stringify(styles)}, ${off ? 'true' : 'false'});
  window.__qutaiUserStyles.trial(${JSON.stringify(css)});
})(); true;`;
}
