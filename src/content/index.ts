import { adBlockScript } from './adBlock';
import { cookieBannerScript } from './cookieBanners';

export { isAdUrl } from './adBlock';

/** Built once: the scripts are the same for every page. */
export const AD_BLOCK_SCRIPT = adBlockScript();
export const COOKIE_BANNER_SCRIPT = cookieBannerScript();
