import { Platform, TurboModuleRegistry, type TurboModule } from 'react-native';
import type { Tab } from '../browser/Tab';
import {
  cookieApplies,
  type CookieKey,
  dedupeCookies,
  expiringCookie,
  fromIosCookie,
  type IosCookie,
  parseCookieInfoLine,
  parsePlainCookieHeader,
  type StoreCookie,
} from '../content/cookieInfo';

/**
 * The tab's native cookie store (docs/page-customisation.md › Cookies), through the patched react-native-webview
 * module: Android's CookieManager of the tab's profile, iOS's WKHTTPCookieStore of the tab's data store. HttpOnly
 * cookies included. Values are returned to the Cookies view only; nothing here logs them.
 */
interface CookieModule extends TurboModule {
  getCookies(urls: string, store: string): Promise<string>;
  deleteCookie(store: string, url: string, line: string, name: string, domain: string, path: string): Promise<boolean>;
}

const native: CookieModule | null = (() => {
  const module = TurboModuleRegistry.get<CookieModule>('RNCWebViewModule');
  return module && typeof module.getCookies === 'function' ? module : null;
})();

export class CookieStoreUnavailableError extends Error {}

/** At most this many other hosts the page loaded from are asked about. */
const MAX_OTHER_HOSTS = 20;

/** iOS: the key the tab's WebView is registered under (its webviewProfile prop), naming its own data store. */
export function iosStoreKey(tab: Pick<Tab, 'id'>): string {
  return `qutai-tab-${tab.id}`;
}

function storeFor(tab: Tab): string {
  if (Platform.OS === 'ios') return iosStoreKey(tab);
  return tab.profile ?? '';
}

export type CookieRead = { cookies: StoreCookie[]; detailed: boolean; platform: 'android' | 'ios' };

/** The cookies that apply to the tab's page and to the other sites it loaded from (their front page). */
export async function readTabCookies(tab: Tab): Promise<CookieRead> {
  if (!native) throw new CookieStoreUnavailableError();
  const page = tab.url.replace(/#.*$/, '');
  const origin = /^(https?:\/\/[^/?#]+)/i.exec(page)?.[1];
  if (!origin) return { cookies: [], detailed: true, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
  const others = await tab
    .run<string[]>('resourceHosts', [], 4000)
    .catch(() => [] as string[]);
  const urls = [page, ...others.filter((o) => o.toLowerCase() !== origin.toLowerCase()).slice(0, MAX_OTHER_HOSTS).map((o) => `${o}/`)];
  let text: string;
  try {
    text = await native.getCookies(JSON.stringify(urls), storeFor(tab));
  } catch (e) {
    // iOS: a normal tab whose WebView isn't registered (yet) uses the default store; an incognito tab never does.
    if (Platform.OS === 'ios' && !tab.incognito) text = await native.getCookies(JSON.stringify(urls), '');
    else throw e;
  }
  const parsed = JSON.parse(text) as { detailed?: boolean; entries?: { url: string; cookies: string[] }[]; cookies?: IosCookie[] };
  const detailed = parsed.detailed !== false;
  const cookies: StoreCookie[] = [];
  if (Platform.OS === 'ios') {
    for (const raw of parsed.cookies ?? []) {
      const c = fromIosCookie(raw);
      if (c && urls.some((u) => cookieApplies(c, u))) cookies.push(c);
    }
  } else {
    for (const entry of parsed.entries ?? []) {
      for (const line of entry.cookies ?? []) {
        if (detailed) {
          const c = parseCookieInfoLine(line, entry.url);
          if (c) cookies.push(c);
        } else cookies.push(...parsePlainCookieHeader(line, entry.url));
      }
    }
  }
  return { cookies: dedupeCookies(cookies), detailed, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
}

/** Deletes cookies by key from the tab's store; resolves with how many the store reported deleted. */
export async function deleteTabCookies(tab: Tab, keys: CookieKey[]): Promise<number> {
  if (!native) throw new CookieStoreUnavailableError();
  let store = storeFor(tab);
  let deleted = 0;
  for (const key of keys) {
    const { url, line } = expiringCookie(key, tab.url);
    let ok: boolean;
    try {
      ok = await native.deleteCookie(store, url, line, key.name, key.domain, key.path);
    } catch (e) {
      if (Platform.OS === 'ios' && !tab.incognito && store) {
        store = '';
        ok = await native.deleteCookie(store, url, line, key.name, key.domain, key.path);
      } else throw e;
    }
    if (ok) deleted++;
  }
  return deleted;
}
