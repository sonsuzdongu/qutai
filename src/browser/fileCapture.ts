import { dialog } from '../components/Dialog';
import { ensureMediaPermission } from '../device/mediaPermissions';
import { PermissionDeniedError, openSettingsOrExplain } from '../device/settings';
import { t } from '../i18n';
import { touchedRecently } from './externalGuard';
import type { Tab } from './Tab';

/**
 * Android upload fields with `capture` ("take a photo" buttons). react-native-webview opens only the
 * camera for them, and only once Qutai holds CAMERA; without it the tap does nothing. This page script
 * holds back the first tap on such a field, the app asks for the camera (the system prompt, shown once),
 * and the field is tapped again: with the camera allowed it opens the camera, otherwise `capture` is
 * left out for that tap so the plain file picker opens instead. Fields without `capture` are untouched,
 * so pages that never use the camera never prompt. Main frame only (Android's injectedJavaScript).
 */
export const FILE_CAPTURE_SCRIPT = `(function () {
  if (window.__qutaiFileCamera) return;
  var camera = null;
  var pending = null;
  window.__qutaiFileCamera = function (allowed) {
    camera = !!allowed;
    var input = pending;
    pending = null;
    // Opens the chooser if the tap is still recent enough for the WebView; otherwise the next tap does.
    if (input && input.isConnected) input.click();
  };
  document.addEventListener('click', function (e) {
    var input = e.composedPath ? e.composedPath()[0] : e.target;
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file' || !input.hasAttribute('capture')) return;
    if (camera === true) return;
    if (camera === false) {
      var capture = input.getAttribute('capture');
      input.removeAttribute('capture');
      setTimeout(function () { input.setAttribute('capture', capture); }, 0);
      return;
    }
    e.preventDefault();
    if (pending) return;
    pending = input;
    window.ReactNativeWebView.postMessage(JSON.stringify({ __qutaiFileCamera: true }));
  }, true);
})(); true;`;

/** The "Open settings" explanation is shown once per app run, not on every upload field. */
let offeredSettings = false;

/** Handles a FILE_CAPTURE_SCRIPT message; returns false for other messages. */
export function handleFileCaptureMessage(tab: Tab, data: string): boolean {
  if (!data.includes('__qutaiFileCamera')) return false;
  try {
    if (JSON.parse(data).__qutaiFileCamera !== true) return false;
  } catch {
    return false;
  }
  // Only for the user's own tap: a page can't bring up the camera prompt by itself.
  const ask = touchedRecently(tab) ? cameraForUpload() : Promise.resolve(false);
  ask.then((allowed) =>
    tab.webview?.injectJavaScript(`if (window.__qutaiFileCamera) window.__qutaiFileCamera(${allowed}); true;`),
  );
  return true;
}

async function cameraForUpload(): Promise<boolean> {
  try {
    await ensureMediaPermission('camera');
    return true;
  } catch (e) {
    if (e instanceof PermissionDeniedError && !e.canAskAgain && !offeredSettings) {
      offeredSettings = true;
      const result = await dialog.show({
        title: t('settings.permissionTitle'),
        message: t('upload.cameraDenied'),
        buttons: [
          { text: t('upload.chooseFile'), style: 'cancel' },
          { text: t('settings.openSystem') },
        ],
      });
      if (result.button === 1) openSettingsOrExplain();
    }
    return false;
  }
}
