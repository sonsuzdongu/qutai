import type { SiteLevel } from '../agent/sitePolicy';
import { siteKey } from '../agent/sitePolicy';
import type { SiteScriptSetting } from '../agent/scriptTool';
import {
  scriptsFor,
  sensitivePage,
  wrapScript,
  type PageFacts,
  type ScriptLastRun,
  type UserScript,
} from '../content/userScripts';

/**
 * Kept scripts at run time (docs/page-customisation.md › Kept scripts › Injection). The page's small "ready" script
 * (content/userScripts.ts keptScriptsReadyScript) says when the document is ready, idle or moved by the page itself;
 * this decides which scripts run there and injects each on its own (so one broken script can't stop Qutai's other
 * page scripts), once per page load, and records how each run went.
 *
 * Nothing runs while the setting is off, in incognito tabs, on read-only, blocked or "scripts off" sites, with
 * "Scripts off for this page", or on sensitive pages (unless the site allows scripts there); only sealed scripts run.
 * Per-tab state is in memory.
 */

export type KeptScriptsHost = {
  enabled(): boolean;
  levelFor(site: string): SiteLevel;
  siteSetting(site: string): SiteScriptSetting;
  scripts(): readonly UserScript[];
  key(): Uint8Array | null;
  recordRun(id: string, run: ScriptLastRun): void;
};

export type KeptTab = {
  id: string;
  url: string;
  incognito: boolean;
  messageNonce: string;
  /** Documents started in the tab so far (Tab.documents): a new number is a new page load. */
  documents: number;
  webview: { injectJavaScript(code: string): void } | null;
};

type TabState = { load: number; ran: Set<string>; skipped: boolean; off: boolean };

/** The tab's state for its current document: a new document starts with no script run. */
function current(tab: KeptTab): TabState {
  const state = stateOf(tab.id);
  if (state.load !== tab.documents) {
    state.load = tab.documents;
    state.ran = new Set();
    state.skipped = false;
  }
  return state;
}

const states = new Map<string, TabState>();
const listeners = new Set<() => void>();
/** The message of a script's last error, in memory only (it could hold page text). */
const messages = new Map<string, string>();
let host: KeptScriptsHost | null = null;
let version = 0;

function stateOf(tabId: string): TabState {
  let state = states.get(tabId);
  if (!state) {
    state = { load: 0, ran: new Set(), skipped: false, off: false };
    states.set(tabId, state);
  }
  return state;
}

function changed() {
  version++;
  listeners.forEach((l) => l());
}

const pageOf = (url: string) => url.replace(/#.*$/, '');

export const keptScripts = {
  configure(next: KeptScriptsHost | null) {
    host = next;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getVersion: () => version,
  /** Settings › Assistant › scripts (false before the app configured this). */
  enabled: () => host?.enabled() ?? false,
  /** "Scripts off for this page" (until switched on again or the tab is closed). */
  off: (tabId: string) => states.get(tabId)?.off ?? false,
  setOff(tabId: string, off: boolean) {
    stateOf(tabId).off = off;
    changed();
  },
  /** The message of a script's last error since the app started, or null. */
  lastMessage: (id: string) => messages.get(id) ?? null,

  /** The scripts that would run on this tab's page now (for the page menu's "Scripts off for this page"). */
  applyTo(tab: KeptTab): UserScript[] {
    if (!host || !host.enabled() || tab.incognito) return [];
    return scriptsFor(host.scripts(), pageOf(tab.url), host.key());
  },

  closed(tabId: string) {
    if (states.delete(tabId)) changed();
  },

  /** Handles a kept-script message from the tab's page; false when the message is something else. */
  handleMessage(tab: KeptTab, data: string): boolean {
    if (!data.includes('__qutaiKept') && !data.includes('__qutaiScript')) return false;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data);
    } catch {
      return false;
    }
    if (msg.__qutaiKept === tab.messageNonce) {
      const phase = String(msg.phase ?? '');
      const reported = typeof msg.url === 'string' ? msg.url : '';
      const facts = readFacts(msg.facts);
      // After the page moves itself, the tab's address may follow a moment later.
      if (!ready(tab, phase, reported, facts) && phase === 'spa') setTimeout(() => ready(tab, phase, reported, facts), 600);
      return true;
    }
    if (msg.__qutaiScript === tab.messageNonce) {
      const state = current(tab);
      const id = typeof msg.id === 'string' ? msg.id : '';
      // Only a run injected for this load counts (the page can't add runs of its own).
      if (msg.load !== state.load || !state.ran.has(id) || !host) return true;
      const status = msg.status === 'ok' ? 'ok' : msg.status === 'timeout' ? 'timeout' : msg.status === 'moved' ? null : 'error';
      if (!status) return true;
      // Only a standard error kind is kept ("TypeError"): anything else could be text from the page.
      const name = typeof msg.error === 'string' && /^(Eval|Range|Reference|Syntax|Type|URI|Aggregate|Security|Abort|NotAllowed|NotFound|Network|Timeout)?Error$/.test(msg.error) ? msg.error : '';
      if (status === 'error') messages.set(id, name || 'Error');
      else messages.delete(id);
      host.recordRun(id, { at: Date.now(), status, ...(status === 'error' ? { error: name || 'Error' } : {}) });
      changed();
      return true;
    }
    return false;
  },
};

function readFacts(value: unknown): PageFacts | null {
  if (!value || typeof value !== 'object') return null;
  const f = value as Record<string, unknown>;
  return { password: f.password === true, oneTimeCode: f.oneTimeCode === true, card: f.card === true };
}

/**
 * Which kept scripts run now, decided from the tab's own address (the page's report must agree with it), and each
 * injected in its own wrapper. `phase`: end (DOMContentLoaded), idle (after load), spa (the page moved itself).
 */
function ready(tab: KeptTab, phase: string, reported: string, facts: PageFacts | null): boolean {
  if (!host || !host.enabled() || tab.incognito || !tab.webview) return true;
  const state = current(tab);
  if (state.off) return true;
  const url = pageOf(tab.url);
  // The tab's address decides; the page's own report must agree (else: not yet, or not to be trusted).
  if (pageOf(reported) !== url) return false;
  const site = siteKey(url);
  if (!site) return true;
  const level = host.levelFor(site);
  if (level === 'readonly' || level === 'blocked' || host.siteSetting(site) === 'off') return true;
  const key = host.key();
  const candidates = scriptsFor(host.scripts(), url, key).filter(
    (s) => !state.ran.has(s.id) && (phase === 'spa' || s.runAt === (phase === 'idle' ? 'idle' : 'end')),
  );
  if (!candidates.length) return true;
  if (sensitivePage(url, facts) && host.siteSetting(site) !== 'sensitive') {
    if (!state.skipped) {
      state.skipped = true;
      for (const s of candidates) host.recordRun(s.id, { at: Date.now(), status: 'skipped' });
      changed();
    }
    return true;
  }
  for (const script of candidates) {
    state.ran.add(script.id);
    tab.webview.injectJavaScript(
      wrapScript(script.code, { mode: 'kept', nonce: tab.messageNonce, id: script.id, url, load: state.load }),
    );
  }
  return true;
}
