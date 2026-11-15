import { ComponentRef, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, GestureResponderEvent, Pressable, View } from 'react-native';
import { t } from '../i18n';
import { QutaiMark } from '../ui/QutaiMark';
import { makeStyles } from '../ui/theme';
import { CANCEL_DISTANCE, HOLD_SLOP, HOLD_TO_TALK_MS, HoldHandlers } from './PushToTalk';

type Props = {
  open: boolean;
  running: boolean;
  unseen: boolean;
  /** A short tap: opens or closes the panel. */
  onPress: () => void;
  /** Push-to-talk (Settings › Assistant › "Hold the Qutai button to talk"); absent: a long press does nothing. */
  hold?: HoldHandlers;
  /** A push-to-talk session is on (the screen-reader actions become Send and Cancel). */
  holdActive?: boolean;
};

function useScreenReader(): boolean {
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

/**
 * The Qutai button at the end of the address bar. A tap opens the panel; holding it (HOLD_TO_TALK_MS) records a voice
 * message (PushToTalk.tsx). The two don't mix: a hold never also taps, and once the hold has started the address
 * bar's swipe-to-switch-tabs can't take the touch (cancelable is off); before that, moving more than HOLD_SLOP makes it
 * an ordinary tap or swipe. The press, release and slide-away are read from the raw touch events of the wrapper, which
 * keep coming wherever the finger goes (Pressable's onPressIn fires again when a finger that slid off comes back). With a screen reader on there is no hold (its own gestures would clash): custom
 * actions start, send and cancel instead.
 */
export function AssistantButton({ open, running, unseen, onPress, hold, holdActive = false }: Props) {
  const styles = useStyles();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const screenReader = useScreenReader();
  const [holding, setHolding] = useState(false);
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
  const canHold = !!hold && !screenReader;

  const clearTimer = () => {
    const g = gesture.current;
    if (g.timer) clearTimeout(g.timer);
    g.timer = null;
  };
  useEffect(() => () => clearTimer(), []);

  const measure = (then: (anchor: { x: number; y: number; width: number; height: number }) => void) =>
    ref.current?.measureInWindow((x, y, width, height) => then({ x, y, width, height }));

  // A new touch (not onPressIn, which Pressable fires again when a finger that slid off comes back).
  const touchStart = (e: GestureResponderEvent) => {
    const g = gesture.current;
    clearTimer();
    g.held = false;
    g.away = false;
    g.down = true;
    // A hold whose lift never arrived (a system prompt took the touch) must not leave the button unswipeable.
    setHolding(false);
    g.x0 = e.nativeEvent.pageX;
    g.y0 = e.nativeEvent.pageY;
    if (!canHold || !hold) return;
    hold.pressIn();
    g.timer = setTimeout(() => {
      g.timer = null;
      g.held = true;
      setHolding(true);
      // Lifted in the moment it took to measure: no hold after all.
      measure((anchor) => g.down && hold.start(anchor));
    }, HOLD_TO_TALK_MS);
  };

  const distance = (e: GestureResponderEvent) => {
    const g = gesture.current;
    return Math.hypot(e.nativeEvent.pageX - g.x0, e.nativeEvent.pageY - g.y0);
  };

  const touchMove = (e: GestureResponderEvent) => {
    const g = gesture.current;
    const d = distance(e);
    // Moving before the hold: a swipe on the bar or a sloppy tap, not a hold.
    if (g.timer && d > HOLD_SLOP) clearTimer();
    if (!g.held || !hold) return;
    const away = d > CANCEL_DISTANCE;
    if (away !== g.away) {
      g.away = away;
      hold.move(away);
    }
  };

  const touchEnd = () => {
    clearTimer();
    const g = gesture.current;
    g.down = false;
    if (!g.held) return;
    setHolding(false);
    hold?.release();
  };

  const touchCancel = () => {
    clearTimer();
    const g = gesture.current;
    g.down = false;
    if (!g.held) return;
    setHolding(false);
    hold?.cancel();
  };

  const label =
    t(open ? 'address.closeAssistant' : 'address.openAssistant') + (unseen ? `, ${t('address.assistantUnseen')}` : '');

  return (
    <View onTouchStart={touchStart} onTouchMove={touchMove} onTouchEnd={touchEnd} onTouchCancel={touchCancel}>
      <Pressable
        ref={ref}
        onPress={() => {
          // The lift that ends a hold is not a tap (the flag is reset by the next press).
          if (gesture.current.held) return;
          clearTimer();
          onPress();
        }}
        // Once holding, the bar's swipe can't take the touch away.
        cancelable={!holding}
        hitSlop={6}
        style={[styles.button, (open || holding) && styles.active]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hold && !screenReader ? t('ptt.hint') : undefined}
        accessibilityActions={
          hold
            ? holdActive
              ? [
                  { name: 'send', label: t('common.send') },
                  { name: 'cancel', label: t('common.cancel') },
                ]
              : [{ name: 'startVoice', label: t('ptt.a11yStart') }]
            : undefined
        }
        onAccessibilityAction={(e) => {
          if (!hold) return;
          const action = e.nativeEvent.actionName;
          if (action === 'startVoice') measure((anchor) => hold.start(anchor, true));
          else if (action === 'send') hold.release();
          else if (action === 'cancel') hold.cancel();
        }}
      >
        {/* The orbit circles while a task runs. */}
        <QutaiMark size={24} working={running} />
        {unseen && !running ? <View style={styles.unseenDot} /> : null}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  // A 34pt touch target around a 24pt logo, in line with the bar's 22pt icons.
  button: { width: 34, height: 34, marginLeft: 2, alignItems: 'center', justifyContent: 'center' },
  active: { opacity: 0.7 },
  unseenDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: c.danger,
    borderWidth: 1.5,
    borderColor: c.chrome,
  },
}));
