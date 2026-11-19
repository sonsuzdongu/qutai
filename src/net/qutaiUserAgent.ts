import { Platform } from 'react-native';
import { appVersion } from '../device/appVersion';
import { appUserAgent, qutaiToken, withUserAgentInit } from './userAgentToken';

const { version, build } = appVersion();

/**
 * "qutai.103": appended to every web view's user agent (iOS and Android: the web view's applicationNameForUserAgent,
 * i.e. the platform's real string plus this; where Qutai sets its own string, withQutaiToken) and ending the app's
 * own requests' User-Agent. Null only when the installed app has no readable build number.
 */
export const QUTAI_UA_TOKEN: string | null = qutaiToken(build);

/** "Qutai/0.1.3 (iOS) qutai.103": the User-Agent of the app's own requests. */
export const APP_USER_AGENT = appUserAgent(version, Platform.OS, QUTAI_UA_TOKEN);

let installed = false;

/**
 * Gives every fetch the app's JavaScript makes (Qutai's server, AI providers with the user's key, search suggestions,
 * block lists, PDFs, download checks) APP_USER_AGENT, unless the call sets its own User-Agent. Called once, first
 * thing in index.ts. Requests made inside web views are the web views' own and are not affected.
 */
export function installAppUserAgent() {
  if (installed || typeof globalThis.fetch !== 'function') return;
  installed = true;
  const original = globalThis.fetch;
  const wrapped = (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    original(input, withUserAgentInit(input, init, APP_USER_AGENT));
  globalThis.fetch = wrapped as typeof fetch;
}
