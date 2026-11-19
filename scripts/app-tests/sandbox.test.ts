// The app sandbox of phase 2 (docs/mini-apps.md › The Android network block): the frame guard run in a VM as a frame's
// window, the DNS-prefetch switch in every app document, and the native hooks in the WebView patch (the order of the
// checks matters: the sandbox answers before the 250 ms wait for JavaScript and before the ad blocker).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { APP_FRAME_GUARD, buildAppDocument } from '../../src/apps/document.ts';
import { notesFiles } from './notesApp.mjs';

const WEBRTC = ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCSessionDescription', 'RTCIceCandidate'];

test('the frame guard removes WebRTC from a frame and leaves the rest', () => {
  const frame: Record<string, unknown> = { fetch: () => 1, document: {} };
  for (const name of WEBRTC) frame[name] = function () {};
  frame.window = frame;
  const result = vm.runInNewContext(APP_FRAME_GUARD, frame);
  assert.equal(result, true, 'ends with true (Android document-start scripts and iOS injection both accept it)');
  for (const name of WEBRTC) assert.equal(frame[name], undefined, `${name} still there`);
  assert.equal(typeof frame.fetch, 'function');
});

test('the frame guard also handles a non-deletable binding, and never throws', () => {
  const frame: Record<string, unknown> = {};
  Object.defineProperty(frame, 'RTCPeerConnection', { value: function () {}, configurable: true, writable: false, enumerable: false });
  Object.defineProperty(frame, 'RTCDataChannel', { value: function () {}, configurable: false, writable: false });
  frame.window = frame;
  assert.doesNotThrow(() => vm.runInNewContext(APP_FRAME_GUARD, frame));
  assert.equal(frame.RTCPeerConnection, undefined);
});

test('every app document turns DNS prefetching off before any of the app\'s bytes', () => {
  const pkg = {
    manifest: { entry: 'index.html', language: 'en' } as never,
    files: { ...notesFiles(), 'index.html': '<!doctype html><html><head><link rel="dns-prefetch" href="//leak.example"></head><body></body></html>' },
  };
  const built = buildAppDocument(pkg, {
    id: 'app-aaaaaaaaaaaa',
    name: 'Notes',
    version: 1,
    language: 'en',
    uiLanguage: 'en',
    platform: 'ios',
    permissions: [],
    theme: { dark: false, colors: {} as never, fontScale: 1 },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  } as never);
  const html = built.html;
  const off = html.indexOf('<meta http-equiv="x-dns-prefetch-control" content="off">');
  assert.ok(off > 0);
  assert.ok(off < html.indexOf('<body'), 'in the head');
  assert.ok(!html.includes('leak.example') || html.indexOf('leak.example') > off);
});

test('the WebView patch: sandbox prop on both architectures, checks before the JavaScript wait and the ad blocker', () => {
  const patch = readFileSync(new URL('../../patches/react-native-webview+14.0.1.patch', import.meta.url), 'utf8');
  assert.match(patch, /\+\s+getSettings\(\)\.setBlockNetworkLoads\(next != null\);/);
  assert.match(patch, /\+\s+appSandboxScript = WebViewCompat\.addDocumentStartJavaScript\(this, next, Collections\.singleton\("\*"\)\);/);
  assert.equal((patch.match(/@ReactProp\(name = "appSandbox"\)/g) ?? []).length, 2, 'new and old architecture managers');
  assert.match(patch, /\+\s+appSandbox\?: string;/, 'codegen spec');

  // shouldInterceptRequest: the sandbox answers first, before the main-frame bookkeeping and the ad blocker.
  const intercept = patch.slice(patch.indexOf('public WebResourceResponse shouldInterceptRequest'));
  const sandboxAt = intercept.indexOf('if (webView.appSandbox != null) return RNCWebViewContentBlocker.blockedResponse();');
  assert.ok(sandboxAt > 0);
  assert.ok(sandboxAt < intercept.indexOf('request.isForMainFrame()'));

  // shouldOverrideUrlLoading: refused (true) before the lock that waits up to 250 ms for JavaScript.
  const override = patch.slice(patch.indexOf('public boolean shouldOverrideUrlLoading(WebView view, String url)'));
  const refuse = override.indexOf('if (rncWebView.appSandbox != null) {');
  assert.ok(refuse > 0 && refuse < override.indexOf('isJsDebugging'));
  assert.match(override.slice(refuse, refuse + 400), /putDouble\("lockIdentifier", -1\)[\s\S]*return true;/);
});
