/** What Qutai may do on a site. 'default' follows the global "ask before actions" setting. */
export type SiteLevel = 'default' | 'allow' | 'ask' | 'readonly' | 'blocked';

export const SITE_LEVELS: SiteLevel[] = ['default', 'allow', 'ask', 'readonly', 'blocked'];

export function isSiteLevel(value: unknown): value is SiteLevel {
  return typeof value === 'string' && (SITE_LEVELS as string[]).includes(value);
}

/**
 * The key a site's permission is stored under: utils/webUrl.ts siteKey (host without "www.", with a non-default port,
 * read as the WebView reads the address; SITE-25).
 */
export { siteKey } from '../utils/webUrl';

/** Whether the assistant may enter the user's remembered personal details on a site; 'ask' is the default. */
export type PersonalSetting = 'ask' | 'allow' | 'block';

/** Looks up a site's level synchronously (backed by an in-memory copy of the stored permissions). */
export interface SitePolicy {
  levelFor(host: string): SiteLevel;
  personalFor(host: string): PersonalSetting;
}

/** Actions that change something; they need the user's confirmation when the site asks for it. */
export const ACTIONS_NEEDING_CONFIRMATION = new Set([
  'navigate',
  'open_tab',
  'click',
  'click_at',
  'type',
  'select_option',
  'save_screenshot',
]);

/** Actions that interact with the page; not allowed on read-only sites. */
const WRITE_ACTIONS = new Set([
  'click',
  'click_at',
  'type',
  'select_option',
  'download_file',
  'upload_image',
  'upload_file',
  'request_approval',
  // Changing how the page looks and deleting the site's cookies (docs/page-customisation.md).
  'restyle_page',
  'delete_cookies',
  // Scripts, in a copy or on the page: never on read-only sites (docs/page-customisation.md › Scripts).
  'run_script',
]);

/**
 * The name the site permission decides a call on: applying a style and deleting cookies change the page or the
 * site's data (refused on read-only sites); listing and undoing only read or put things back.
 */
export function policyName(name: string, input: Record<string, unknown>): string {
  if (name === 'restyle_page') return input.action === 'apply' ? 'restyle_page' : 'restyle_page_read';
  if (name === 'page_cookies') return input.action === 'delete' ? 'delete_cookies' : 'page_cookies';
  return name;
}

export type Decision = { kind: 'run' } | { kind: 'confirm' } | { kind: 'refuse'; reason: string };

/**
 * Decides whether a tool may run on a site. `confirmByDefault` is the global setting that
 * applies to sites without their own permission.
 */
export function decide(tool: string, host: string | null, level: SiteLevel, confirmByDefault: boolean): Decision {
  if (host && level === 'blocked') {
    return {
      kind: 'refuse',
      reason: `The user has blocked Qutai on ${host}: don't read or use this site. Tell the user if the task needs it.`,
    };
  }
  if (host && level === 'readonly' && WRITE_ACTIONS.has(tool)) {
    return {
      kind: 'refuse',
      reason: `Qutai may only read ${host} (the user's setting): clicking, typing, selecting, downloading and uploading are not allowed there. Tell the user what to do themselves.`,
    };
  }
  if (!ACTIONS_NEEDING_CONFIRMATION.has(tool)) return { kind: 'run' };
  if (level === 'allow') return { kind: 'run' };
  if (level === 'ask') return { kind: 'confirm' };
  return confirmByDefault ? { kind: 'confirm' } : { kind: 'run' };
}

/**
 * Whether the assistant may post on a site without the publish dialog (PAY-29): the user's remembered choice ("Post on
 * {site} without asking"), never in a conversation that touched an incognito tab, never on a Read only or Blocked site
 * (those are refused before the dialog anyway, PAY-14). Only kind "publish": pay and change always ask.
 */
export function postingWithoutAsking(
  sites: { levelFor(host: string): SiteLevel; postingFor(host: string): boolean },
  site: string,
  incognito: boolean,
): boolean {
  return actsOn(sites, site, incognito) && sites.postingFor(site);
}

/**
 * Whether the assistant's one-off scripts may run on a site without the script dialog (SCR-36): the user's remembered
 * choice ("Run scripts on {site} without asking"), with the same limits as posting (`PAY-29`): never in a conversation
 * that touched an incognito tab, never on a Read only or Blocked site.
 */
export function scriptsWithoutAsking(
  sites: { levelFor(host: string): SiteLevel; scriptsFor(host: string): boolean },
  site: string,
  incognito: boolean,
): boolean {
  return actsOn(sites, site, incognito) && sites.scriptsFor(site);
}

/** A remembered "without asking" applies: not incognito, and the site may be acted on. */
function actsOn(sites: { levelFor(host: string): SiteLevel }, site: string, incognito: boolean): boolean {
  if (incognito) return false;
  const level = sites.levelFor(site);
  return level !== 'readonly' && level !== 'blocked';
}
