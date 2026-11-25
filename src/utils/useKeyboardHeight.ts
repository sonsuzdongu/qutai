import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, KeyboardEvent, KeyboardMetrics, LayoutAnimation, Platform } from 'react-native';
import { isIosAppOnMac } from '../device/macDevice';

/**
 * How far up from the bottom of the window the on-screen keyboard reaches.
 *
 * Measured from the keyboard's top edge (screenY) rather than its reported height: on Android the height
 * leaves out the navigation bar under the keyboard (24 dp with gestures, 48 dp with buttons), so a view
 * padded by the height alone stays partly covered. Expo apps are edge to edge there, so the window spans
 * the whole screen and its height is the line the keyboard rises from. A hardware keyboard sends no
 * event on Android, and on iOS reports only the small bar it really shows, so neither adds padding.
 */
function cover(metrics: KeyboardMetrics) {
  return Math.max(0, Math.round(Dimensions.get('window').height - metrics.screenY));
}

/**
 * The open keyboard's cover (see above), 0 when it is closed. Always 0 on a Mac (UI-77): it has a real keyboard, and
 * the only thing iOS reports there is its input bar at the bottom of the window, which must not push the page or the
 * bars up.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(() => {
    if (isIosAppOnMac) return 0;
    const metrics = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
    return metrics ? cover(metrics) : 0;
  });
  useEffect(() => {
    if (isIosAppOnMac) return;
    // iOS has "will" events, which line up with the keyboard animation (the layout change animates
    // along with it, as KeyboardAvoidingView does); Android only has "did", sent again when the height
    // changes while open (emoji panel, suggestions bar).
    const update = (e: KeyboardEvent, next: number) => {
      if (Platform.OS === 'ios' && e.duration) {
        LayoutAnimation.configureNext({
          duration: Math.max(e.duration, 10),
          update: { duration: Math.max(e.duration, 10), type: LayoutAnimation.Types.keyboard },
        });
      }
      setHeight(next);
    };
    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillChangeFrame', (e) => update(e, cover(e.endCoordinates))),
            Keyboard.addListener('keyboardWillHide', (e) => update(e, 0)),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', (e) => update(e, cover(e.endCoordinates))),
            Keyboard.addListener('keyboardDidHide', (e) => update(e, 0)),
          ];
    // The screen turned with the keyboard open: measured against the new window height (docs/landscape.md). The
    // keyboard's own event may come before or after the window's, so both measure from what is current.
    const turned = Dimensions.addEventListener('change', () => {
      const metrics = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
      setHeight(metrics ? cover(metrics) : 0);
    });
    return () => {
      subscriptions.forEach((s) => s.remove());
      turned.remove();
    };
  }, []);
  return height;
}
