import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, GestureResponderEvent } from 'react-native';
import { CANCEL_DISTANCE, HOLD_SLOP, HOLD_TO_TALK_MS } from './PushToTalk';

/** A screen reader is on (holding clashes with its own gestures, so buttons offer actions instead). */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => alive && setOn(value))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

export type HoldCallbacks = {
  /** A new touch began (it may become a hold). */
  pressIn?: () => void;
  /** The finger stayed down HOLD_TO_TALK_MS without moving more than HOLD_SLOP. */
  start: () => void;
  /** While held: whether the finger is now far enough away (CANCEL_DISTANCE) that lifting it cancels. */
  move?: (away: boolean) => void;
  release: () => void;
  /** The touch was taken away (system gesture, a window on top). */
  cancel: () => void;
};

/**
 * Hold-to-talk on a button: the press, release and slide-away are read from the raw touch events of a wrapper View,
 * which keep coming wherever the finger goes (Pressable's onPressIn fires again when a finger that slid off comes
 * back). Used by the Qutai button in the address bar and the microphone in the assistant panel.
 *
 * Spread `touch` on the wrapper. `held()` says whether the current press became a hold (so the Pressable's onPress
 * that follows the lift is not a tap); `holding` is the same as state, for styles and `cancelable`.
 */
export function useHoldGesture(enabled: boolean, callbacks: HoldCallbacks) {
  const [holding, setHolding] = useState(false);
  const latest = useRef(callbacks);
  useEffect(() => {
    latest.current = callbacks;
  });
  const gesture = useRef({
    timer: null as ReturnType<typeof setTimeout> | null,
    x0: 0,
    y0: 0,
    /** The finger is on the button (or wherever it slid to). */
    down: false,
    /** This press became a hold: the tap that ends it is not a tap. */
    held: false,
    away: false,
  });

  const clearTimer = () => {
    const g = gesture.current;
    if (g.timer) clearTimeout(g.timer);
    g.timer = null;
  };
  useEffect(() => () => clearTimer(), []);

  // A new touch (not onPressIn, which Pressable fires again when a finger that slid off comes back).
  const onTouchStart = (e: GestureResponderEvent) => {
    const g = gesture.current;
    clearTimer();
    g.held = false;
    g.away = false;
    g.down = true;
    // A hold whose lift never arrived (a system prompt took the touch) must not leave the button stuck.
    setHolding(false);
    g.x0 = e.nativeEvent.pageX;
    g.y0 = e.nativeEvent.pageY;
    if (!enabled) return;
    latest.current.pressIn?.();
    g.timer = setTimeout(() => {
      g.timer = null;
      if (!g.down) return;
      g.held = true;
      setHolding(true);
      latest.current.start();
    }, HOLD_TO_TALK_MS);
  };

  const onTouchMove = (e: GestureResponderEvent) => {
    const g = gesture.current;
    const d = Math.hypot(e.nativeEvent.pageX - g.x0, e.nativeEvent.pageY - g.y0);
    // Moving before the hold: a swipe or a sloppy tap, not a hold.
    if (g.timer && d > HOLD_SLOP) clearTimer();
    if (!g.held) return;
    const away = d > CANCEL_DISTANCE;
    if (away !== g.away) {
      g.away = away;
      latest.current.move?.(away);
    }
  };

  const onTouchEnd = () => {
    clearTimer();
    const g = gesture.current;
    g.down = false;
    if (!g.held) return;
    setHolding(false);
    latest.current.release();
  };

  const onTouchCancel = () => {
    clearTimer();
    const g = gesture.current;
    g.down = false;
    if (!g.held) return;
    setHolding(false);
    latest.current.cancel();
  };

  return {
    touch: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
    holding,
    held: () => gesture.current.held,
    /** The finger is still down. */
    down: () => gesture.current.down,
    /** Forgets a pending hold (a tap was handled). */
    clear: clearTimer,
  };
}
