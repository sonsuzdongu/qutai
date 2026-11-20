import { isAdUrl } from '../content/adBlock';
import { safeHttpsUrl } from './optionCards';
import { sniffImage, toBase64 } from './imageSniff';

/**
 * Pictures of option cards (UI-25, DATA-24 in docs/design). Showing one means the phone asks that site's
 * server (or its image host) for it, also for options the user never opens; see DATA-24.
 *
 * Not through React Native's <Image> loader: on Android it shares the WebView's cookie store, so a card would send
 * the user's cookies for that site. Here the bytes are fetched with XMLHttpRequest and `withCredentials` off, which
 * React Native turns into no cookie jar on Android (OkHttp CookieJar.NO_COOKIES) and HTTPShouldHandleCookies = NO on
 * iOS; nothing sends a Referer (the request comes from no page). The bytes must be a JPEG, PNG, GIF or WebP by their
 * own first bytes (no SVG or anything active), at most MAX_BYTES (the download stops there), and a sane pixel count;
 * they are shown as a data: address. Kept in memory only, never written to the phone, within MAX_CACHE_BYTES.
 *
 * With "Block ads and trackers" on, a picture from a host on the built-in ad and tracker list is not loaded (the
 * downloaded filter lists live in the native blockers and are not consulted here).
 */

export const MAX_BYTES = 600_000;
const MAX_CACHE_BYTES = 6_000_000;
const TIMEOUT_MS = 15_000;
const MAX_PARALLEL = 3;

type Entry = { uri: string; bytes: number } | 'failed';
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<string | null>>();
let cachedBytes = 0;
let blockAds = true;
let running = 0;
const queue: (() => void)[] = [];

/** Follows Settings › "Block ads and trackers" (App.tsx). */
export function setCardImageBlocking(on: boolean) {
  blockAds = on;
}

/** Whether this picture may be requested at all (https, and not an ad or tracker host while blocking is on). */
export function cardImageAllowed(url: string): boolean {
  return !!safeHttpsUrl(url) && !(blockAds && isAdUrl(url));
}

/** A picture already in memory: its data: address, null when it failed, undefined when not loaded yet. */
export function cachedCardImage(url: string): string | null | undefined {
  const hit = cache.get(url);
  if (hit === undefined) return undefined;
  if (hit === 'failed') return null;
  // Most recently used last.
  cache.delete(url);
  cache.set(url, hit);
  return hit.uri;
}

/** The picture as a data: address, or null when it can't or mustn't be shown. Never throws. */
export function loadCardImage(url: string): Promise<string | null> {
  const known = cachedCardImage(url);
  if (known !== undefined) return Promise.resolve(known);
  if (!cardImageAllowed(url)) return Promise.resolve(null);
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;
  const job = new Promise<string | null>((resolve) => {
    const start = () => {
      running++;
      fetchBytes(url)
        .then((bytes) => {
          const info = bytes ? sniffImage(bytes) : null;
          if (!bytes || !info) return remember(url, 'failed');
          const uri = `data:${info.mime};base64,${toBase64(bytes)}`;
          remember(url, { uri, bytes: uri.length });
          return uri;
        })
        .catch(() => remember(url, 'failed'))
        .then((result) => {
          running--;
          pending.delete(url);
          queue.shift()?.();
          resolve(result);
        });
    };
    if (running < MAX_PARALLEL) start();
    else queue.push(start);
  });
  pending.set(url, job);
  return job;
}

function remember(url: string, entry: Entry): null {
  cache.set(url, entry);
  if (entry !== 'failed') cachedBytes += entry.bytes;
  // The oldest pictures go first.
  for (const [key, value] of cache) {
    if (cachedBytes <= MAX_CACHE_BYTES && cache.size <= 200) break;
    if (key === url) continue;
    if (value !== 'failed') cachedBytes -= value.bytes;
    cache.delete(key);
  }
  return null;
}

/** The response's bytes, or null (an error status, a redirect to something not https, too large, a timeout). */
function fetchBytes(url: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let done = false;
    const finish = (value: Uint8Array | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      xhr.abort();
      finish(null);
    }, TIMEOUT_MS);
    xhr.open('GET', url);
    xhr.withCredentials = false;
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Accept', 'image/webp,image/jpeg,image/png,image/gif;q=0.8');
    // Stops the download as soon as it passes the limit (React Native reports progress when a listener is set).
    xhr.onprogress = (e) => {
      if (e.loaded > MAX_BYTES) {
        xhr.abort();
        finish(null);
      }
    };
    xhr.onerror = () => finish(null);
    xhr.onabort = () => finish(null);
    xhr.onload = () => {
      const finalUrl = xhr.responseURL || url;
      if (xhr.status !== 200 || !safeHttpsUrl(finalUrl) || (blockAds && isAdUrl(finalUrl))) return finish(null);
      const length = Number(xhr.getResponseHeader('content-length'));
      if (Number.isFinite(length) && length > MAX_BYTES) return finish(null);
      const body = xhr.response as ArrayBuffer | null;
      if (!body || body.byteLength > MAX_BYTES) return finish(null);
      finish(new Uint8Array(body));
    };
    xhr.send();
  });
}
