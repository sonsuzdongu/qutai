/**
 * The site's public address, without a trailing slash: used for canonical links, hreflang, the sitemap and
 * social previews. A placeholder until the owner picks a domain; the build warns while it ends in `.example`.
 */
export const SITE_URL = 'https://qutai.sonsuzdongu.com';
export const REPO_URL = 'https://github.com/sonsuzdongu/qutai';
export const ISSUES_URL = `${REPO_URL}/issues`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
/** The app's privacy policy, a page of this site in each language (scripts/prerender.mjs, text from the app). */
export const privacyPolicyPath = (lang: 'en' | 'tr') => `/${lang}/privacy-policy/`;
