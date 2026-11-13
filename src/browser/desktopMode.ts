import { Platform } from 'react-native';

/** Desktop identities, so sites serve their desktop layout. */
export const DESKTOP_USER_AGENT =
  Platform.OS === 'ios'
    ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
    : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

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
