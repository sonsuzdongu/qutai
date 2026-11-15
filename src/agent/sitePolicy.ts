/** What Qutai may do on a site. 'default' follows the global "ask before actions" setting. */
export type SiteLevel = 'default' | 'allow' | 'ask' | 'readonly' | 'blocked';

export const SITE_LEVELS: SiteLevel[] = ['default', 'allow', 'ask', 'readonly', 'blocked'];

export function isSiteLevel(value: unknown): value is SiteLevel {
  return typeof value === 'string' && (SITE_LEVELS as string[]).includes(value);
}

/**
 * The key a site's permission is stored under: its host name, lowercase, without "www.", plus the port when it isn't
 * the scheme's default ("192.168.1.2:3000"), so two local apps on different ports of one machine are two sites (as
 * they are two origins for the web, and two sites in history). Web pages only.
 */
export function siteKey(url: string): string | null {
  const match = /^(https?):\/\/([^/?#]+)/i.exec(url.trim());
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  let host = match[2].replace(/^[^@]*@/, '').toLowerCase();
  const defaultPort = scheme === 'https' ? ':443' : ':80';
  if (host.endsWith(defaultPort)) host = host.slice(0, -defaultPort.length);
  host = host.replace(/:$/, '');
  return host.replace(/^www\./, '') || null;
}

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
const WRITE_ACTIONS = new Set(['click', 'click_at', 'type', 'select_option', 'download_file', 'upload_image', 'upload_file']);

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
