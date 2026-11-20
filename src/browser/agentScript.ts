/**
 * How Qutai's page script (browser/pageScript.ts with content/hideProbe.ts and content/scriptPage.ts) gets into a page
 * and how a command reaches it (`UNTR-26`, docs/design/04-untrusted-content.md).
 *
 * - Installed once per document, in the main frame only, from the WebView's before-content script (iOS: a WebKit user
 *   script at document start, before any of the page's own scripts; Android: as early as react-native-webview runs
 *   it, then again when the page has loaded, and as a fallback by the first command that finds it missing).
 * - It lives on window under a secret name (`__q` and 32 random hex characters, a new one per tab, and on Android a new
 *   one for every document), defined non-writable, non-configurable and non-enumerable, as a frozen object: a page
 *   can't guess the name before it is installed, and once installed it can't replace or delete it.
 * - A command is only the call (about 500 bytes plus its arguments), not the whole script.
 *
 * What the page answers stays the page's word: a page's own scripts run in the same JavaScript world and can always
 * change what the DOM shows, so every answer is checked as untrusted data by the caller (agent/pageFacts.ts).
 */
import { HIDE_PROBE_SCRIPT } from '../content/hideProbe';
import { SCRIPT_PAGE_SCRIPT } from '../content/scriptPage';
import { newNonce } from '../utils/ids';
import { PAGE_SCRIPT } from './pageScript';

/** A new secret name for the page script's object on window. */
export function newAgentName(): string {
  return `__q${newNonce(16)}`;
}

/**
 * The page script, installed under `name` unless something already holds that name (a second run in the same document
 * does nothing). Main frame only: commands only go to the main frame.
 */
export function agentInstallScript(name: string): string {
  return `(function () {
  if (window.top !== window) return;
  var NAME = ${JSON.stringify(name)};
  if (NAME in window) return;
  var __qutaiAgent = {};
${PAGE_SCRIPT}
${HIDE_PROBE_SCRIPT}
${SCRIPT_PAGE_SCRIPT}
  Object.freeze(__qutaiAgent);
  try {
    Object.defineProperty(window, NAME, { value: __qutaiAgent, writable: false, enumerable: false, configurable: false });
  } catch (e) {}
})();
`;
}

/** The reply a command sends when the page script is not in the document (yet, or any more). */
export const MISSING_REPLY = 'missing';

/**
 * One call of a page command, with the reply handed to `deliver` (which sees `payload`). The arguments are written
 * into the call itself, so it doesn't go through Function.prototype.apply, which the page could replace.
 */
export function agentCommandScript(name: string, command: string, args: unknown[], nonce: string, id: string, deliver: string): string {
  const call = `a[${JSON.stringify(command)}](${args.map((a) => JSON.stringify(a === undefined ? null : a)).join(', ')})`;
  return `(function () {
  var send = function (payload) {
    payload.__qutai = ${JSON.stringify(nonce)};
    payload.id = ${JSON.stringify(id)};
    ${deliver}
  };
  var a = window[${JSON.stringify(name)}];
  if (!a || typeof a[${JSON.stringify(command)}] !== 'function') { send({ ok: false, ${MISSING_REPLY}: true }); return; }
  var fail = function (e) { send({ ok: false, error: String((e && e.message) || e) }); };
  try {
    var result = ${call};
    if (result && typeof result.then === 'function') result.then(function (value) { send({ ok: true, result: value }); }, fail);
    else send({ ok: true, result: result });
  } catch (e) {
    fail(e);
  }
})();
true;`;
}
