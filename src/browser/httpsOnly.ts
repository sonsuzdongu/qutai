/** Hosts the user chose to visit over plain HTTP anyway, for this session only. */
const exceptions = new Set<string>();

function hostOf(url: string): string {
  return /^https?:\/\/([^/?#:]+)/i.exec(url)?.[1]?.toLowerCase() ?? '';
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
