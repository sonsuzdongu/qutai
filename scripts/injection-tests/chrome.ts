/**
 * A headless Chrome that stands in for the phone's WebViews (README.md in this folder): the app's real page script
 * (src/browser/pageScript.ts) runs in a real, rendered page, so what reaches the model from hidden text, alt text, ARIA
 * labels or off-screen content is exactly what Qutai's read_page would take from it.
 *
 * Nothing leaves the machine: every request a page makes is paused (CDP Fetch domain) and answered by the fixture
 * server, and Chrome's own host resolution is pointed nowhere (--host-resolver-rules), so a request the harness did
 * not answer cannot reach the network either. Every request is recorded: it is how the judges see a page or a link
 * carrying data to an attacker's address.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser } from '../../src/browser/Browser';
import type { Tab } from '../../src/browser/Tab';

const CHROME_PATHS = [
  process.env.QUTAI_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean) as string[];

/** An iPhone's Safari, as Qutai's iOS WebView reports itself closely enough for page layouts. */
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1';

export type ServedRequest = { url: string; method: string; postData?: string; tabId: string; resourceType: string };
export type Response = { status: number; type: string; body: string | Buffer; headers?: Record<string, string> };
export type Server = (req: ServedRequest) => Response;

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

export class Chrome {
  private proc: ChildProcess;
  private ws!: WebSocket;
  private nextId = 0;
  private pending = new Map<number, Pending>();
  private listeners = new Map<string, (method: string, params: any) => void>();
  private profile: string;

  private constructor(proc: ChildProcess, profile: string) {
    this.proc = proc;
    this.profile = profile;
  }

  static async launch(): Promise<Chrome> {
    const path = CHROME_PATHS.find((p) => existsSync(p));
    if (!path) throw new Error('No Chrome or Chromium found (set QUTAI_CHROME to its executable).');
    const profile = mkdtempSync(join(tmpdir(), 'qutai-injection-'));
    const proc = spawn(
      path,
      [
        '--headless=new',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-sync',
        '--disable-default-apps',
        '--mute-audio',
        '--host-resolver-rules=MAP * ~NOTFOUND',
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    const chrome = new Chrome(proc, profile);
    const wsUrl = await new Promise<string>((resolve, reject) => {
      let buf = '';
      const timer = setTimeout(() => reject(new Error('Chrome did not start')), 20000);
      proc.stderr!.on('data', (d) => {
        buf += String(d);
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
      proc.on('exit', () => reject(new Error('Chrome exited')));
    });
    chrome.ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      chrome.ws.onopen = () => resolve();
      chrome.ws.onerror = () => reject(new Error('Could not connect to Chrome'));
    });
    chrome.ws.onmessage = (ev) => chrome.onMessage(String(ev.data));
    return chrome;
  }

  private onMessage(raw: string) {
    const msg = JSON.parse(raw);
    if (typeof msg.id === 'number') {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
      return;
    }
    const listener = this.listeners.get(msg.sessionId ?? '');
    listener?.(msg.method, msg.params);
  }

  send<T = any>(method: string, params: object = {}, sessionId?: string): Promise<T> {
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  listen(sessionId: string, fn: (method: string, params: any) => void) {
    this.listeners.set(sessionId, fn);
  }

  unlisten(sessionId: string) {
    this.listeners.delete(sessionId);
  }

  async close() {
    try {
      await Promise.race([this.send('Browser.close'), new Promise((r) => setTimeout(r, 2000))]);
    } catch {}
    this.ws?.close();
    this.proc.kill('SIGKILL');
    try {
      rmSync(this.profile, { recursive: true, force: true });
    } catch {}
  }
}

const POST_BRIDGE =
  'window.ReactNativeWebView = { postMessage: function (s) { window.__qutaiPost(String(s)); } };';

/** One tab's WebView: a Chrome page whose events reach the real Tab in the order react-native-webview reports them. */
export class ChromeWebView {
  private sessionId = '';
  private targetId = '';
  private ready: Promise<void>;
  destroyed = false;
  private loadingUrl = '';

  constructor(
    private chrome: Chrome,
    private tab: Tab,
    private server: Server,
    private onRequest: (r: ServedRequest) => void,
    /** Install Qutai's page script at document start, as iOS does (false: only the commands' fallback, as on Android at worst). */
    private early = true,
  ) {
    this.ready = this.init();
    tab.setWebView(this.handle as never);
  }

  /** What Tab calls on its WebView. */
  handle = {
    injectJavaScript: (code: string) => {
      void this.ready.then(() =>
        this.chrome.send('Runtime.evaluate', { expression: code, awaitPromise: false }, this.sessionId).catch(() => {}),
      );
    },
    stopLoading: () => void this.chrome.send('Page.stopLoading', {}, this.sessionId).catch(() => {}),
    reload: () => void this.chrome.send('Page.reload', {}, this.sessionId).catch(() => {}),
    goBack: () => this.handle.injectJavaScript('history.back(); true;'),
    goForward: () => this.handle.injectJavaScript('history.forward(); true;'),
  };

  private async init() {
    const { targetId } = await this.chrome.send('Target.createTarget', { url: 'about:blank' });
    this.targetId = targetId;
    const { sessionId } = await this.chrome.send('Target.attachToTarget', { targetId, flatten: true });
    this.sessionId = sessionId;
    this.chrome.listen(sessionId, (m, p) => void this.event(m, p));
    const s = (method: string, params: object = {}) => this.chrome.send(method, params, sessionId);
    await s('Page.enable');
    await s('Runtime.enable');
    await s('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    await s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await s('Emulation.setUserAgentOverride', { userAgent: MOBILE_UA });
    await s('Runtime.addBinding', { name: '__qutaiPost' });
    await s('Page.addScriptToEvaluateOnNewDocument', { source: POST_BRIDGE });
    if (this.early) await s('Page.addScriptToEvaluateOnNewDocument', { source: this.tab.agentInstallScript });
  }

  async load(url: string) {
    await this.ready;
    if (this.destroyed) return;
    this.loadingUrl = url;
    this.tab.handleLoadStart(url, true);
    this.nav(url, true);
    await this.chrome.send('Page.navigate', { url }, this.sessionId).catch(() => {});
  }

  private nav(url: string, loading: boolean, title = '') {
    this.tab.handleNavigationStateChange({ url, title, loading, canGoBack: true, canGoForward: false } as never);
  }

  private async event(method: string, params: any) {
    if (this.destroyed) return;
    const s = (m: string, p: object = {}) => this.chrome.send(m, p, this.sessionId);
    switch (method) {
      case 'Fetch.requestPaused': {
        const req: ServedRequest = {
          url: params.request.url,
          method: params.request.method,
          postData: params.request.postData,
          tabId: this.tab.id,
          resourceType: params.resourceType,
        };
        this.onRequest(req);
        const res = this.server(req);
        const body = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body, 'utf8');
        const headers = [{ name: 'Content-Type', value: res.type }, ...Object.entries(res.headers ?? {}).map(([name, value]) => ({ name, value }))];
        await s('Fetch.fulfillRequest', {
          requestId: params.requestId,
          responseCode: res.status,
          responseHeaders: headers,
          body: body.toString('base64'),
        }).catch(() => {});
        return;
      }
      case 'Page.frameRequestedNavigation':
        if (!params.frameId || params.disposition !== 'currentTab') return;
        this.tab.noteNavigationRequest(params.url, false);
        return;
      case 'Page.frameNavigated':
        if (params.frame.parentId) return;
        if (params.frame.url !== this.loadingUrl) {
          this.loadingUrl = params.frame.url;
          this.tab.handleLoadStart(params.frame.url, true);
        }
        this.nav(params.frame.url, true);
        return;
      case 'Page.navigatedWithinDocument':
        this.nav(params.url, false, await this.title());
        return;
      case 'Runtime.bindingCalled':
        if (params.name === '__qutaiPost') this.tab.handleMessage(params.payload);
        return;
      case 'Page.loadEventFired': {
        const where = await s('Runtime.evaluate', { expression: 'location.href', returnByValue: true }).catch(() => null);
        const url = where?.result?.value ?? this.loadingUrl;
        this.nav(url, false, await this.title());
        this.tab.handleWebViewLoadEnd(url);
        return;
      }
    }
  }

  private async title(): Promise<string> {
    const r = await this.chrome
      .send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }, this.sessionId)
      .catch(() => null);
    return String(r?.result?.value ?? '');
  }

  destroy() {
    this.destroyed = true;
    this.chrome.unlisten(this.sessionId);
    void this.ready.then(() => this.chrome.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {}));
  }
}

/** What BrowserView does: a WebView for every awake tab that isn't the new tab page; a new source loads it. */
export function mountViews(chrome: Chrome, browser: Browser, server: Server, onRequest: (r: ServedRequest) => void) {
  const views = new Map<string, { view: ChromeWebView; source: object }>();
  const reconcile = () => {
    for (const tab of browser.tabs) {
      const live = !tab.asleep && !tab.isNewTab;
      const existing = views.get(tab.id);
      if (!live) {
        if (existing) {
          existing.view.destroy();
          views.delete(tab.id);
        }
        continue;
      }
      if (!existing) {
        const view = new ChromeWebView(chrome, tab, server, onRequest);
        views.set(tab.id, { view, source: tab.source });
        void view.load(tab.source.uri);
      } else if (existing.source !== tab.source) {
        existing.source = tab.source;
        void existing.view.load(tab.source.uri);
      }
    }
    for (const [id, v] of views) {
      if (!browser.getTab(id)) {
        v.view.destroy();
        views.delete(id);
      }
    }
  };
  const unsubscribe = browser.subscribe(reconcile);
  reconcile();
  return {
    done: () => {
      unsubscribe();
      views.forEach((v) => v.view.destroy());
      browser.tabs.forEach((t) => t.dispose());
    },
  };
}
