/**
 * A site's request for a user name and password (HTTP Basic or Digest: a 401 with WWW-Authenticate), answered with
 * Qutai's own dialog (HTTP auth, docs/design). The patched WebView holds the load under an id and reports the host
 * and the realm; the app answers through the module (src/device/httpAuth.ts). The password goes only to the
 * WebView for that one request: it is never stored, logged, shown to the assistant or sent anywhere else.
 */

export type HttpAuthRequest = { id: string; host: string; realm: string; url: string };

/** Longest realm shown: it is the site's own text, shown in quotes as the site's words. */
export const MAX_REALM_CHARS = 120;

/** The event's fields as a request, or null when it has no id or host (nothing to answer or name). */
export function parseHttpAuthRequest(e: { id?: unknown; host?: unknown; realm?: unknown; url?: unknown }): HttpAuthRequest | null {
  const id = typeof e.id === 'string' ? e.id : '';
  const host = typeof e.host === 'string' ? e.host.trim().toLowerCase() : '';
  if (!id || !host || !/^[a-z0-9.\-:[\]]+$/.test(host)) return null;
  return {
    id,
    host,
    realm: cleanRealm(typeof e.realm === 'string' ? e.realm : ''),
    url: typeof e.url === 'string' ? e.url : '',
  };
}

/** The realm without control or direction characters and line breaks, cut to MAX_REALM_CHARS. */
export function cleanRealm(realm: string): string {
  const clean = realm
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > MAX_REALM_CHARS ? `${clean.slice(0, MAX_REALM_CHARS - 1)}…` : clean;
}

/** Whether the password would travel unencrypted: the page asking is plain http. */
export function isInsecureAuth(req: HttpAuthRequest): boolean {
  return /^http:/i.test(req.url);
}

/** What the dialog says, as translation keys and their values. */
export function httpAuthDialogParts(req: HttpAuthRequest): {
  title: { key: 'httpAuth.title'; host: string };
  lines: ({ key: 'httpAuth.body' } | { key: 'httpAuth.realm'; realm: string } | { key: 'httpAuth.insecure' } | { key: 'httpAuth.note' })[];
} {
  const lines: ReturnType<typeof httpAuthDialogParts>['lines'] = [{ key: 'httpAuth.body' }];
  if (req.realm) lines.push({ key: 'httpAuth.realm', realm: req.realm });
  if (isInsecureAuth(req)) lines.push({ key: 'httpAuth.insecure' });
  lines.push({ key: 'httpAuth.note' });
  return { title: { key: 'httpAuth.title', host: req.host }, lines };
}

/**
 * The tab's waiting requests: asked one at a time, only while the tab is on screen (a request for a tab in the
 * background, a task's tab say, waits until the user is on it). A repeated request for the same host and realm
 * (wrong password) replaces nothing: each id is answered on its own.
 */
export class HttpAuthQueue {
  private items: HttpAuthRequest[] = [];
  private asking: string | null = null;

  add(req: HttpAuthRequest) {
    if (this.items.some((r) => r.id === req.id)) return;
    this.items.push(req);
  }

  /** The next request to ask now, or null (none, one already asked, or the tab isn't on screen). */
  next(onScreen: boolean): HttpAuthRequest | null {
    if (!onScreen || this.asking !== null) return null;
    const req = this.items[0] ?? null;
    if (req) this.asking = req.id;
    return req;
  }

  /** The asked request was answered (or cancelled). */
  done(id: string) {
    this.items = this.items.filter((r) => r.id !== id);
    if (this.asking === id) this.asking = null;
  }

  /** Every request still waiting (the tab goes): the caller cancels them. */
  drain(): HttpAuthRequest[] {
    const all = this.items;
    this.items = [];
    this.asking = null;
    return all;
  }

  get size(): number {
    return this.items.length;
  }
}
