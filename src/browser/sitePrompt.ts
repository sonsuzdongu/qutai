import { siteKey } from '../agent/sitePolicy';
import { dialog } from '../components/Dialog';
import { t } from '../i18n';

/**
 * Pieces shared by the per-site prompts for what a web page may use on the phone (location, camera,
 * microphone): which site a request belongs to, and the question itself.
 */

/** 'once': this page (normal tabs) or this request (incognito); null: dismissed without an answer. */
export type SitePromptAnswer = 'deny' | 'once' | 'always' | null;

/**
 * The site a page's request is for, if it may ask at all: https only, and only the tab's own site
 * (the decision is the site in the address bar's, not that of something it embeds).
 */
export function requestingSite(origin: string, tabUrl: string): string | null {
  if (!/^https:\/\//i.test(origin)) return null;
  const host = siteKey(origin);
  return host && host === siteKey(tabUrl) ? host : null;
}

/**
 * Asks the user. "Allow once" is the emphasised choice (the narrowest one); "Always allow" is a plain
 * secondary action and isn't offered in incognito, which never remembers. Only the user answers: the
 * dialog has no API for the assistant, and the signal can only dismiss it (as a refusal).
 */
export async function askSitePermission(options: {
  title: string;
  message: string;
  incognito: boolean;
  signal: AbortSignal;
}): Promise<SitePromptAnswer> {
  const result = await dialog.show({
    title: options.title,
    message: options.message,
    buttons: [
      { text: t('sitePrompt.deny'), style: 'cancel' as const },
      { text: t('sitePrompt.allowOnce'), primary: true },
      ...(options.incognito ? [] : [{ text: t('sitePrompt.allowAlways') }]),
    ],
    signal: options.signal,
  });
  if (result.button === 0) return 'deny';
  if (result.button === 1) return 'once';
  if (result.button === 2) return 'always';
  return null;
}
