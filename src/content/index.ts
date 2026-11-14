import { cookieBannerScript } from './cookieBanners';

export { adBlockScript, isAdUrl, isHostIn } from './adBlock';

/** Built once: the script is the same for every page. */
export const COOKIE_BANNER_SCRIPT = cookieBannerScript();
