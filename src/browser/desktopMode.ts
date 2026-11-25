import { Platform } from 'react-native';
import { stripDevice } from '../device/macDevice';
import { desktopUserAgent, safariApplicationName } from './safariUserAgent';

/**
 * Desktop-site mode's identity, so sites serve their desktop layout, built from the real versions (DATA-33): the
 * system's Safari version on iOS, the WebView engine's Chrome version on Android (`learnedUserAgent`).
 */
export function desktopModeUserAgent(learnedUserAgent: string | undefined): string {
  return Platform.OS === 'ios'
    ? desktopUserAgent('ios', { osVersion: Platform.Version })
    : desktopUserAgent('android', { learnedUserAgent });
}

/**
 * iOS, iPadOS and the iOS app on a Mac: Safari's ending of the user agent for this device and system version, given to
 * every browser tab as WKWebView's `applicationNameForUserAgent` (DATA-33); undefined on Android or if unreadable.
 */
export const SAFARI_APPLICATION_NAME: string | undefined =
  Platform.OS === 'ios'
    ? (safariApplicationName(Platform.Version, stripDevice === 'phone' ? 'phone' : stripDevice === 'mac' ? 'mac' : 'pad') ??
      undefined)
    : undefined;

/**
 * Responsive sites lay out to the device width given by their viewport tag no matter which
 * browser they think they are talking to, so desktop mode also widens the viewport (Android;
 * iOS does this itself through contentMode).
 */
export const DESKTOP_VIEWPORT_SCRIPT = `(function () {
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
  meta.setAttribute('content', 'width=1024');
})(); true;`;

/**
 * iOS has no text zoom setting for web views; text-size-adjust scales page text the same way.
 * (Android uses the WebView's own textZoom instead.)
 */
export function textZoomScript(percent: number): string {
  return `document.documentElement.style.webkitTextSizeAdjust = '${Math.round(percent)}%'; true;`;
}
