import { readerHtml } from './readerHtml';
import { wellFormedJsonText } from '../utils/wellFormed';

/**
 * Talks to the hidden PDF reader page (src/pdf/readerHtml.ts, shown by src/components/PdfReaderHost.tsx). The
 * WebView exists only while PDFs are being read: the first request mounts it, and it goes again after a minute
 * without requests, taking the open document with it. Requests run one at a time.
 *
 * The PDF's bytes stay in memory only (here while they are handed over, then in the page), so reading a PDF writes
 * nothing to the phone, in incognito tabs too.
 */

export type PdfInfo = { pages: number; info: Record<string, string> };
export type PdfPageText = { page: number; text: string };
export type PdfPageImage = { page: number; width: number; height: number; data: string };

/** The PDF can't be read: why, for the tool's result. */
export class PdfReadError extends Error {
  constructor(
    message: string,
    readonly reason: 'unavailable' | 'password' | 'invalid' | 'failed' | 'timeout',
  ) {
    super(message);
  }
}

type WebViewLike = { injectJavaScript: (code: string) => void };

const IDLE_MS = 60_000;
const PIECE_CHARS = 1_000_000;
const TIMEOUT_MS = 90_000;

let webview: WebViewLike | null = null;
let mounted = false;
let readyWaiters: (() => void)[] = [];
let ready = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let openKey: string | null = null;
let openInfo: PdfInfo | null = null;
let counter = 0;
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const listeners = new Set<(mounted: boolean) => void>();
let queue: Promise<unknown> = Promise.resolve();

/** Whether the host should show the reader WebView now. */
export function readerMounted(): boolean {
  return mounted;
}

export function subscribeReader(fn: (mounted: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setMounted(value: boolean) {
  if (mounted === value) return;
  mounted = value;
  if (!value) {
    webview = null;
    ready = false;
    openKey = null;
    openInfo = null;
    for (const [id, p] of pending) {
      clearTimeout(p.timer);
      p.reject(new PdfReadError('The PDF reader closed.', 'failed'));
      pending.delete(id);
    }
  }
  listeners.forEach((fn) => fn(value));
}

/** Called by the host with its WebView (or null when it unmounts). */
export function attachReaderWebView(view: WebViewLike | null) {
  webview = view;
  if (!view) ready = false;
}

/** A message from the reader page; false when it isn't one. */
export function handleReaderMessage(data: string): boolean {
  let msg: { qutaiPdf?: boolean; ready?: boolean; id?: string; ok?: boolean; result?: unknown; error?: string };
  try {
    msg = JSON.parse(wellFormedJsonText(data));
  } catch {
    return false;
  }
  if (!msg || msg.qutaiPdf !== true) return false;
  if (msg.ready) {
    ready = true;
    const waiters = readyWaiters;
    readyWaiters = [];
    waiters.forEach((fn) => fn());
    return true;
  }
  const p = msg.id ? pending.get(msg.id) : undefined;
  if (!p || !msg.id) return true;
  pending.delete(msg.id);
  clearTimeout(p.timer);
  if (msg.ok) p.resolve(msg.result);
  else {
    const error = msg.error ?? 'failed';
    if (error === 'password') p.reject(new PdfReadError('The PDF is protected with a password.', 'password'));
    else if (error === 'invalid') p.reject(new PdfReadError('The file is not a valid PDF.', 'invalid'));
    else p.reject(new PdfReadError(`The PDF could not be read: ${error}`, 'failed'));
  }
  return true;
}

/** The reader page failed to load (an old WebView that can't run PDF.js, or a crash). */
export function readerFailed(message: string) {
  const waiters = readyWaiters;
  readyWaiters = [];
  waiters.forEach((fn) => fn());
  for (const [id, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new PdfReadError(message, 'failed'));
    pending.delete(id);
  }
  setMounted(false);
}

function keepAlive() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => setMounted(false), IDLE_MS);
}

async function whenReady(): Promise<void> {
  if (!readerHtml()) throw new PdfReadError('PDF reading is not in this build of Qutai.', 'unavailable');
  setMounted(true);
  keepAlive();
  if (ready && webview) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PdfReadError('The PDF reader did not start.', 'timeout')), 20_000);
    readyWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
  if (!ready || !webview) throw new PdfReadError('The PDF reader could not start on this phone.', 'unavailable');
}

function call<T>(build: (id: string) => string): Promise<T> {
  const view = webview;
  if (!view) return Promise.reject(new PdfReadError('The PDF reader is not running.', 'failed'));
  const id = `p${++counter}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new PdfReadError('Reading the PDF took too long.', 'timeout'));
    }, TIMEOUT_MS);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    view.injectJavaScript(`${build(id)};true;`);
  });
}

/** Runs one request after the ones before it. */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}

/**
 * The scripts that hand a PDF's base64 to the reader page, a million characters each. The whole string is checked
 * first: base64 holds no quotes, backslashes or line breaks, so each piece can go into the script as it is; anything
 * else is refused before a script is built.
 */
export function pieceScripts(pieces: string, data: string): string[] {
  if (/[^A-Za-z0-9+/=]/.test(data)) throw new PdfReadError('The file is not a valid PDF.', 'invalid');
  const out: string[] = [];
  for (let i = 0; i < data.length; i += PIECE_CHARS) {
    out.push(`window.__qutaiPdf.piece(${pieces},"${data.slice(i, i + PIECE_CHARS)}");true;`);
  }
  return out;
}

/**
 * Opens a PDF in the reader, unless the same `key` (its address or attachment id) is still open. `load` gives its
 * bytes in base64 and is called only when they are needed.
 */
export function openPdf(key: string, load: () => Promise<string>): Promise<PdfInfo> {
  return serial(async () => {
    await whenReady();
    if (openKey === key && openInfo) return openInfo;
    const data = await load();
    keepAlive();
    const view = webview;
    if (!view) throw new PdfReadError('The PDF reader is not running.', 'failed');
    const pieces = JSON.stringify(`d${++counter}`);
    for (const script of pieceScripts(pieces, data)) view.injectJavaScript(script);
    openKey = null;
    const info = await call<PdfInfo>((id) => `window.__qutaiPdf.open(${JSON.stringify(id)},${JSON.stringify(key)},${pieces})`);
    openKey = key;
    openInfo = info;
    return info;
  });
}

/** Text of pages `from`..`to`, stopping after the page that takes it past `budget` characters. */
export function pdfText(key: string, from: number, to: number, budget: number): Promise<PdfPageText[]> {
  return serial(async () => {
    keepAlive();
    if (openKey !== key) throw new PdfReadError('The PDF is no longer open.', 'failed');
    const res = await call<{ pages: PdfPageText[] }>(
      (id) => `window.__qutaiPdf.text(${JSON.stringify(id)},${JSON.stringify(key)},${from},${to},${budget})`,
    );
    return res.pages;
  });
}

/** Pages drawn as JPEG images, the longest side `edge` pixels. */
export function pdfRender(key: string, pages: number[], edge: number): Promise<PdfPageImage[]> {
  return serial(async () => {
    keepAlive();
    if (openKey !== key) throw new PdfReadError('The PDF is no longer open.', 'failed');
    return call<PdfPageImage[]>(
      (id) => `window.__qutaiPdf.render(${JSON.stringify(id)},${JSON.stringify(key)},${JSON.stringify(pages)},${edge})`,
    );
  });
}

/** Closes the open document (e.g. the incognito session ended); the reader goes when idle. */
export function closePdf() {
  openKey = null;
  openInfo = null;
  webview?.injectJavaScript('window.__qutaiPdf && window.__qutaiPdf.close();true;');
}
