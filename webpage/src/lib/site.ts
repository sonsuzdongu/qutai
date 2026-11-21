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
/** The app's terms of use (the pro build's, as the stores ship it), a page of this site in each language. */
export const termsPath = (lang: 'en' | 'tr') => `/${lang}/terms/`;
/**
 * Where account deletion requests go without the app (the deletion page, scripts/prerender.mjs): the same contact address
 * as the app's privacy policy. Google Play asks for this page's address in the Play Console (Data safety › Data deletion).
 */
export const CONTACT_EMAIL = 'qutai@sonsuzdongu.com';
/** How to delete a Qutai account, in the app or by email, and what is deleted and kept (a page of this site). */
export const deleteAccountPath = (lang: 'en' | 'tr') => `/${lang}/delete-account/`;
/** Help for the app: contact, what to include, common questions (a page of this site; the App Store's Support URL). */
export const supportPath = (lang: 'en' | 'tr') => `/${lang}/support/`;
