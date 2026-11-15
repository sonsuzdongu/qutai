import { siteKey } from '../agent/sitePolicy';

/** Sites (host and port, see siteKey) the user chose to visit over plain HTTP anyway, for this session only. */
const exceptions = new Set<string>();

function hostOf(url: string): string {
  // http://host:80 and https://host:443 have no port in the key, so an upgraded address keeps its key.
  return siteKey(url.replace(/^https:/i, 'http:')) ?? '';
}

/** With HTTPS-only on, http:// pages are opened over https:// (unless the user made an exception). */
export function upgradeToHttps(url: string, httpsOnly: boolean): string {
  if (!httpsOnly || !/^http:\/\//i.test(url) || exceptions.has(hostOf(url))) return url;
  return `https://${url.slice('http://'.length)}`;
}

export function allowInsecure(url: string) {
  exceptions.add(hostOf(url));
}

export function clearInsecureExceptions() {
  exceptions.clear();
}
