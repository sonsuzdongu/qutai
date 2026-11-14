/**
 * Camera and microphone for web pages (getUserMedia) are off until there is a per-site prompt.
 *
 * iOS: the WebView's mediaCapturePermissionGrantType is 'deny', so WebKit refuses every request in
 * every frame without a prompt.
 *
 * Android: react-native-webview 14 answers a page's request by asking the OS for the CAMERA
 * permission and, once Qutai holds it (it does after QR scanning), granting it to any site, with no
 * per-site hook. This script, run in the main frame before the page's own scripts (and again after
 * load in case Android ran it too soon), makes getUserMedia fail with NotAllowedError instead.
 * Frames aren't reached on Android (see TODO.md). RECORD_AUDIO is blocked in app.json, so the
 * microphone is always refused there.
 */
export const MEDIA_CAPTURE_BLOCK_SCRIPT = `(function () {
  if (window.__qutaiMediaBlocked) return;
  Object.defineProperty(window, '__qutaiMediaBlocked', { value: true });
  function error() {
    return new DOMException('Camera and microphone are not available to web pages in Qutai.', 'NotAllowedError');
  }
  function refuse() { return Promise.reject(error()); }
  function lock(target, name, value) {
    try { Object.defineProperty(target, name, { value: value, writable: false, configurable: false }); } catch (e) {}
  }
  if (window.MediaDevices) {
    lock(MediaDevices.prototype, 'getUserMedia', refuse);
    lock(MediaDevices.prototype, 'getDisplayMedia', refuse);
  }
  if (navigator.mediaDevices) {
    lock(navigator.mediaDevices, 'getUserMedia', refuse);
    lock(navigator.mediaDevices, 'getDisplayMedia', refuse);
  }
  ['getUserMedia', 'webkitGetUserMedia'].forEach(function (name) {
    if (!(name in navigator)) return;
    lock(navigator, name, function (constraints, onSuccess, onError) {
      if (typeof onError === 'function') setTimeout(function () { onError(error()); }, 0);
    });
  });
})();`;
