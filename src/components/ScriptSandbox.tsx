import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { PageSnapshot } from '../agent/scriptTool';
import { readOutcome, SCRIPT_TIME_LIMIT_MS, wrapScript, type ScriptOutcome } from '../content/userScripts';
import { newNonce } from '../utils/ids';

/**
 * The sealed place read-only scripts run in (docs/page-customisation.md › Two places a script can run): an invisible
 * WebView made for one job and removed after it. Its page is the snapshot under a Content Security Policy with no
 * script source, no connections, no frames, no forms and data: images only; it has no cookies or site storage (an
 * opaque about:blank origin; iOS: a non-persistent store) and every navigation is refused. Also compiles code
 * without running it, to report syntax errors before the user is asked (a page that allows only eval, nothing else).
 */

const RUN_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; media-src 'none'; connect-src 'none'; " +
  "frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; manifest-src 'none'";
const CHECK_CSP = "default-src 'none'; script-src 'unsafe-eval'; form-action 'none'; base-uri 'none'";

type Job =
  | { kind: 'check'; id: string; code: string; resolve: (error: string | null) => void }
  | { kind: 'run'; id: string; html: string; code: string; pageUrl: string; resolve: (outcome: ScriptOutcome) => void };

const queue: Job[] = [];
let wake: (() => void) | null = null;
let counter = 0;
const NONCE = `sbx${newNonce()}`;

function push(job: Job) {
  queue.push(job);
  wake?.();
}

/** The copy as one HTML document under the sandbox's policy (the policy first, before anything from the page). */
export function sandboxHtml(snapshot: PageSnapshot): string {
  const css = snapshot.css.replace(/<\/style/gi, '<\\/style');
  return (
    `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${RUN_CSP}">` +
    `<meta charset="utf-8"><meta name="referrer" content="no-referrer">${snapshot.head}<style>${css}</style></head>` +
    `${snapshot.body}</html>`
  );
}

export const scriptSandbox = {
  /** Compiles the code as the body of the wrapper's function; the error message, or null when it parses. */
  check(code: string): Promise<string | null> {
    if (!wake) return Promise.resolve(null);
    return new Promise((resolve) => push({ kind: 'check', id: `c${++counter}`, code, resolve }));
  },
  run(snapshot: PageSnapshot, code: string, pageUrl: string): Promise<ScriptOutcome> {
    if (!wake) return Promise.resolve({ status: 'error', name: 'Error', message: 'The sandbox is not available.' });
    return new Promise((resolve) => push({ kind: 'run', id: `r${++counter}`, html: sandboxHtml(snapshot), code, pageUrl, resolve }));
  },
};

const PRELUDE =
  "(function () { ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'WebSocket', 'EventSource', " +
  "'XMLHttpRequest', 'Worker', 'SharedWorker', 'WebTransport'].forEach(function (n) { try { window[n] = undefined; } catch (e) {} });" +
  " try { navigator.sendBeacon = undefined; } catch (e) {} })(); true;";

function checkScript(id: string, code: string): string {
  return `(function () {
  var r;
  try {
    var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    new AsyncFunction('pageUrl', 'fetch', 'setTimeout', 'setInterval', '"use strict";\\n' + ${JSON.stringify(code)});
    r = { ok: true };
  } catch (e) {
    r = { ok: false, message: String((e && e.message) || e).slice(0, 300) };
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({ __qutai: ${JSON.stringify(NONCE)}, id: ${JSON.stringify(id)}, check: r }));
})(); true;`;
}

/** Mounted once (App.tsx); shows nothing. */
export function ScriptSandboxHost() {
  const [job, setJob] = useState<Job | null>(null);
  const jobRef = useRef<Job | null>(null);
  const webview = useRef<{ injectJavaScript(code: string): void } | null>(null);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    const next = () => {
      if (jobRef.current || !queue.length) return;
      const j = queue.shift()!;
      jobRef.current = j;
      setJob(j);
    };
    wake = next;
    next();
    return () => {
      wake = null;
    };
  }, []);

  const finish = (value: unknown) => {
    const j = jobRef.current;
    if (!j) return;
    jobRef.current = null;
    setJob(null);
    if (j.kind === 'check') {
      const r = value as { ok?: boolean; message?: string } | null;
      j.resolve(r && r.ok === false ? String(r.message || 'SyntaxError') : null);
    } else {
      j.resolve(value === 'timeout' ? { status: 'timeout' } : readOutcome(value));
    }
    setTimeout(() => wake?.(), 0);
  };

  // The job's time limit: a run that never answers (an endless loop) is removed with its WebView.
  useEffect(() => {
    if (!job) return;
    const timer = setTimeout(() => finish(job.kind === 'check' ? null : 'timeout'), job.kind === 'check' ? 5000 : SCRIPT_TIME_LIMIT_MS + 3000);
    return () => clearTimeout(timer);
  }, [job]);

  if (!job) return null;
  const html =
    job.kind === 'check'
      ? `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${CHECK_CSP}"></head><body></body></html>`
      : job.html;
  return (
    <View
      style={[styles.hidden, { width: Math.max(320, width), height: Math.max(480, height) }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <WebView
        key={job.id}
        ref={(ref) => {
          webview.current = ref;
        }}
        // No base address: an opaque origin, apart from every site's cookies and storage (as the reader view).
        source={{ html, baseUrl: '' }}
        // Everything passes the origin list (else react-native-webview would open it in another app) and is then
        // refused here: the sandbox never navigates.
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(request) => /^about:/i.test(request.url) || request.url.startsWith('data:') || request.url === ''}
        javaScriptEnabled
        domStorageEnabled={false}
        cacheEnabled={false}
        incognito={Platform.OS === 'ios'}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        geolocationEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback={false}
        onLoadEnd={() => {
          const view = webview.current;
          if (!view || jobRef.current?.id !== job.id) return;
          if (job.kind === 'check') view.injectJavaScript(checkScript(job.id, job.code));
          else {
            view.injectJavaScript(PRELUDE);
            view.injectJavaScript(wrapScript(job.code, { mode: 'copy', nonce: NONCE, id: job.id, url: job.pageUrl }));
          }
        }}
        onMessage={(e) => {
          let msg: { __qutai?: string; id?: string; check?: unknown; result?: unknown };
          try {
            msg = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          if (msg.__qutai !== NONCE || msg.id !== jobRef.current?.id) return;
          finish(job.kind === 'check' ? msg.check : msg.result);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', left: -20000, top: 0, opacity: 0 },
});
