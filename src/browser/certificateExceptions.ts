/**
 * "Continue anyway" past a certificate error (Android). Only the user can add an exception, from the app's own error
 * page (ErrorPage, a native view the assistant's tools can't reach: they act inside web pages). An exception allows one
 * certificate (SHA-256 of the one the WebView refused) on one host and port, and lives in memory only: never saved,
 * gone when the app restarts or the user clears the cache. An incognito tab's exceptions belong to that tab and go with
 * it. The patched WebView proceeds only for a certificate in the list it is given (certificateExceptions prop), so
 * every decision to proceed is the user's (Google Play's rule for onReceivedSslError).
 *
 * The WebView engine itself may remember a proceed for its profile until the app restarts; the patch clears that when
 * the tab that made the exception closes or the list loses an entry. While an exception exists for a host, pages there
 * show "Not secure", including in other tabs of the same kind (normal or incognito), which share the engine's memory.
 */

type Entry = { key: string; fingerprint: string; incognito: boolean; tabId: string };

let entries: Entry[] = [];

/** Hosts (with port) that served a valid certificate this session; a certificate error there is not bypassable. */
const validHosts = new Set<string>();

/** "host:port" of an https URL (default port 443, IPv6 without brackets), lowercase; null for other URLs. */
export function certificateKey(url: string): string | null {
  const m = /^https:\/\/(?:[^/?#@]*@)?(\[[^\]]+\]|[^/?#:]+)(?::(\d+))?/i.exec(url.trim());
  if (!m) return null;
  const host = m[1].replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  return `${host}:${m[2] ?? '443'}`;
}

/** The user chose "Continue anyway" on the error page of this tab, for this URL's host and this certificate. */
export function addCertificateException(url: string, fingerprint: string, tab: { id: string; incognito: boolean }) {
  const key = certificateKey(url);
  if (!key || !/^[0-9a-f]{64}$/.test(fingerprint)) return;
  if (entries.some((e) => e.key === key && e.fingerprint === fingerprint && sameScope(e, tab))) return;
  entries = [...entries, { key, fingerprint, incognito: tab.incognito, tabId: tab.id }];
}

function sameScope(e: Entry, tab: { id: string; incognito: boolean }): boolean {
  return tab.incognito ? e.incognito && e.tabId === tab.id : !e.incognito;
}

/** The list for a tab's WebView: "host:port fingerprint" lines (normal tabs share theirs; incognito tabs have own). */
export function certificateExceptionsFor(tab: { id: string; incognito: boolean }): string {
  return entries
    .filter((e) => sameScope(e, tab))
    .map((e) => `${e.key} ${e.fingerprint}`)
    .join('\n');
}

/** Whether a page at this URL may be using an exception (so it must not look secure). */
export function usesCertificateException(url: string, incognito: boolean): boolean {
  const key = certificateKey(url);
  return !!key && entries.some((e) => e.key === key && e.incognito === incognito);
}

/** An https page loaded with no certificate error and no exception in play: its host had a valid certificate. */
export function noteValidCertificate(url: string, incognito: boolean) {
  const key = certificateKey(url);
  if (key && !usesCertificateException(url, incognito)) validHosts.add(key);
}

/**
 * "Continue anyway" is offered only when the error page shows a certificate the WebView reported (Android) for a host
 * that had no valid certificate earlier this session: a site whose good certificate turned bad may be intercepted.
 */
export function mayBypassCertificate(url: string, fingerprint: string | undefined): boolean {
  const key = certificateKey(url);
  return !!key && !!fingerprint && !validHosts.has(key);
}

/** An incognito tab closed: its exceptions go with it. */
export function removeTabCertificateExceptions(tabId: string) {
  entries = entries.filter((e) => !(e.incognito && e.tabId === tabId));
}

export function clearCertificateExceptions() {
  entries = [];
  validHosts.clear();
}
