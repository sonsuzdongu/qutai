import type { Tab } from '../browser/Tab';
import {
  cookieMetadata,
  formatCookieList,
  type CookieKey,
  type StoreCookie,
} from '../content/cookieInfo';
import { sanitizeCss } from '../content/userCss';
import { parseStyleScope, stylesFor, type UserStyle } from '../content/userStyles';
import { t } from '../i18n';
import { cutText } from '../utils/wellFormed';
import type { ToolContext, ToolOutput } from './executeTool';
import { siteKey } from './sitePolicy';
import { declinedNotice, errorNotice } from './stepLine';
import { uiPath } from './uiLabels';

/**
 * restyle_page and page_cookies (docs/page-customisation.md). The app does the checking and asking: the CSS goes
 * through the sanitiser and the user's approval before it touches the page; cookie values never reach this file's
 * output (cookieMetadata copies named fields only).
 */

/** What the style approval shows; resolves true on Apply. */
export type StyleApproval = { site: string; url: string; description: string; css: string; incognito: boolean };

export type PageStylesAccess = {
  approve(approval: StyleApproval): Promise<boolean>;
  /** Applies the approved CSS to the tab now (the trial) and puts the style card in the chat. */
  applyTrial(tab: Tab, css: string, description: string): Promise<void>;
  /** Removes the trial from the tab; false when there was none. */
  undoTrial(tab: Tab): Promise<boolean>;
  /** The kept styles. */
  kept(): UserStyle[];
};

export type CookieDeleteApproval = { site: string; cookies: { name: string; domain: string }[]; incognito: boolean };

export type CookieAccess = {
  read(tab: Tab): Promise<{ cookies: StoreCookie[]; detailed: boolean; platform: 'android' | 'ios' }>;
  remove(tab: Tab, keys: CookieKey[]): Promise<number>;
  confirmDelete(approval: CookieDeleteApproval): Promise<boolean>;
  /** Puts the cookies card ("Show cookies") in the chat. */
  offer(tab: Tab, site: string, count: number): void;
};

const MAX_DESCRIPTION = 120;
const MAX_HANDLES = 50;

export function describePageCustomCall(name: string, input: Record<string, unknown>): string {
  if (name === 'restyle_page') {
    if (input.action === 'undo') return t('action.styleUndo');
    if (input.action === 'list') return t('action.styleList');
    return t('action.styleApply');
  }
  return input.action === 'delete' ? t('action.cookiesDelete') : t('action.cookiesList');
}

/** The handles of the last list, per tab and page: only those can be deleted. */
const listed = new WeakMap<Tab, { url: string; keys: Map<string, CookieKey> }>();

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean) : [];
}

function stylesPlace(): string {
  return uiPath('settings.title', 'settings.privacySection', 'settings.filterLists', 'siteRules.title');
}

export function platformNote(read: { detailed: boolean; platform: 'android' | 'ios' }, thirdPartyBlocked: boolean): string {
  const common =
    'First- or third-party is worked out from the domain against the page\'s site (the store does not record who set ' +
    'a cookie). Calling a cookie a tracker is your judgement from its name and domain: say so.';
  if (read.platform === 'ios') {
    return (
      `${common} iOS blocks third-party cookies and keeps cookies of embedded sites per top-level site without ` +
      'saying so, so third-party cookies are often missing here.'
    );
  }
  if (!read.detailed) {
    return (
      `${common} This Android WebView gives names and values only: domains, paths, HttpOnly, Secure, SameSite and ` +
      'expiry are unknown, and cookies are listed under the address they were asked for.'
    );
  }
  return (
    `${common} Partitioned cookies are not marked as such.` +
    (thirdPartyBlocked ? ' Third-party cookies are blocked (the user\'s setting), so few or none are listed.' : '')
  );
}

export async function pageCustomTool(name: string, input: Record<string, unknown>, ctx: ToolContext, tab: Tab): Promise<ToolOutput> {
  const site = siteKey(tab.url);
  if (!site) return { content: 'This works on web pages (http or https) only.', isError: true, notice: errorNotice(t('step.noPage')) };

  if (name === 'restyle_page') {
    const access = ctx.pageStyles;
    if (!access) return { content: 'Styles are not available here.', isError: true };
    if (input.action === 'list') {
      const here = stylesFor(access.kept(), tab.url);
      if (!here.length) return { content: `No kept styles apply to this page. The user manages styles in ${stylesPlace()}.`, isError: false };
      return {
        content:
          `Kept styles on this page (the user edits, switches off or deletes them in ${stylesPlace()}):\n` +
          here.map((s) => `- ${JSON.stringify(s.name)} (${scopeWords(s.scope)}, ${s.source === 'assistant' ? 'kept from you' : 'added by the user'})`).join('\n'),
        isError: false,
      };
    }
    if (input.action === 'undo') {
      const removed = await access.undoTrial(tab);
      return { content: removed ? 'The style is removed from the page.' : 'No style that was not kept is applied here.', isError: false };
    }
    if (input.action !== 'apply') return { content: 'action must be apply, undo or list.', isError: true };
    const description = cutText(typeof input.description === 'string' ? input.description.replace(/\s+/g, ' ').trim() : '', MAX_DESCRIPTION);
    if (!description) return { content: 'Give a short description of what the style changes, in the user\'s language.', isError: true };
    const checked = sanitizeCss(typeof input.css === 'string' ? input.css : '');
    if (!checked.ok) {
      return {
        content:
          `Refused, nothing applied: ${checked.detail}. Allowed: style rules, @media and @supports; colours, sizes, ` +
          'gradients, calc() and var(); url() only for data: PNG/JPEG/GIF/WebP images; no @import, @font-face or other ' +
          "at-rules, no image-set(), attr() or other functions that load or read things, no selectors naming Qutai's elements.",
        isError: true,
      };
    }
    if (!(await access.approve({ site, url: tab.url, description, css: checked.css, incognito: tab.incognito }))) {
      return { content: 'The user did not approve the style. Nothing changed.', isError: true, notice: declinedNotice() };
    }
    await access.applyTrial(tab, checked.css, description);
    return {
      content:
        'Applied to this page now (the user approved it). A card in the chat lets the user keep it' +
        (tab.incognito ? ' (not from this incognito tab: nothing is saved from it)' : ' for this site') +
        ' or undo it; never keep it yourself. Check it with view_screenshot if the result matters.',
      isError: false,
    };
  }

  // page_cookies
  const access = ctx.cookies;
  if (!access) return { content: 'The cookie list is not available here.', isError: true };
  if (input.action === 'list' || input.action === undefined) {
    const read = await access.read(tab);
    const { list, keys } = cookieMetadata(read.cookies, site);
    listed.set(tab, { url: tab.url, keys });
    access.offer(tab, site, list.length);
    return { content: formatCookieList(list, site, platformNote(read, ctx.thirdPartyCookiesBlocked?.() ?? false)), isError: false };
  }
  if (input.action !== 'delete') return { content: 'action must be list or delete.', isError: true };
  const handles = strings(input.handles).slice(0, MAX_HANDLES);
  const known = listed.get(tab);
  if (!known || known.url !== tab.url) return { content: 'Call page_cookies list first (the handles belong to one listing of this page).', isError: true };
  const keys = handles.map((h) => known.keys.get(h)).filter((k): k is CookieKey => !!k);
  if (!keys.length) return { content: 'None of these is a handle from the last list; call page_cookies list.', isError: true };
  const ok = await access.confirmDelete({ site, cookies: keys.map((k) => ({ name: k.name, domain: k.domain })), incognito: tab.incognito });
  if (!ok) return { content: 'The user did not delete the cookies.', isError: true, notice: declinedNotice() };
  const deleted = await access.remove(tab, keys);
  listed.delete(tab);
  return {
    content:
      `Deleted ${deleted} of ${keys.length} cookie${keys.length === 1 ? '' : 's'}. The user may need to sign in to ` +
      `${site} again; reload the page for the site to notice. Handles are no longer valid: list again if needed.`,
    isError: deleted === 0,
  };
}

function scopeWords(scope: string): string {
  const parsed = parseStyleScope(scope);
  if (!parsed) return scope;
  switch (parsed.kind) {
    case 'all':
      return 'everywhere';
    case 'subdomains':
      return `${parsed.host} and its subdomains`;
    case 'site':
      return parsed.host;
    case 'path':
      return `pages under ${parsed.host}${parsed.path ?? '/'}`;
    case 'page':
      return `the page ${parsed.host}${parsed.path ?? '/'}`;
  }
}
