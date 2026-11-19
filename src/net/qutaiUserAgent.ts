import { Platform } from 'react-native';
import { features } from '../config/features';
import { appVersion } from '../device/appVersion';
import { appUserAgent, initForRequest, qutaiToken } from './userAgentToken';

const { version, build } = appVersion();

/**
 * "Qutai/0.1.3 (iOS) qutai.103": the User-Agent of requests to Qutai's server (the origin of
 * EXPO_PUBLIC_QUTAI_API_URL), and of nothing else (DATA-23). Without a readable build number it ends without the token.
 */
export const QUTAI_SERVER_USER_AGENT = appUserAgent(version, Platform.OS, qutaiToken(build));

let installed = false;

/**
 * Wraps the global fetch once, first thing in index.ts, so every fetch the app's JavaScript makes goes through one
 * decision by the request's origin (initForRequest): requests to Qutai's server (accounts, the credits relay, backups,
 * /config, purchases) get QUTAI_SERVER_USER_AGENT unless they set their own; everything else (AI providers with the
 * user's key, search suggestions, filter lists, favicons, PDFs, link and download checks) is passed on untouched and
 * sends the platform's default. A new fetch to a third party therefore can't pick the token up by accident.
 *
 * Redirects: React Native's fetch follows them natively (NSURLSession on iOS, OkHttp on Android) and both copy the
 * request's headers to the next hop, so a Qutai-server response redirecting elsewhere would carry the token along;
 * JavaScript can't stop that (RN ignores `redirect: 'manual'`). Qutai's API answers its app routes with JSON and no
 * redirects. Requests made inside web views and native downloads are not fetch calls and never see this.
 */
export function installAppUserAgent() {
  if (installed || typeof globalThis.fetch !== 'function') return;
  installed = true;
  const original = globalThis.fetch;
  const wrapped = (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    original(input, initForRequest(input, init, features.apiUrl, QUTAI_SERVER_USER_AGENT));
  globalThis.fetch = wrapped as typeof fetch;
}
