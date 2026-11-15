import { ComponentRef, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { t } from '../i18n';
import { QutaiMark } from '../ui/QutaiMark';
import { makeStyles } from '../ui/theme';
import { HoldHandlers } from './PushToTalk';
import { useHoldGesture, useScreenReader } from './useHoldGesture';

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

/**
 * The Qutai button at the end of the address bar. A tap opens the panel; holding it (HOLD_TO_TALK_MS) records a voice
 * message (PushToTalk.tsx). The two don't mix: a hold never also taps, and once the hold has started the address
 * bar's swipe-to-switch-tabs can't take the touch (cancelable is off); before that, moving more than HOLD_SLOP makes it
 * an ordinary tap or swipe. The gesture itself is useHoldGesture.ts (shared with the panel's microphone). With a screen
 * reader on there is no hold (its own gestures would clash): custom actions start, send and cancel instead.
 */
export function AssistantButton({ open, running, unseen, onPress, hold, holdActive = false }: Props) {
  const styles = useStyles();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const screenReader = useScreenReader();
  const canHold = !!hold && !screenReader;

  const measure = (then: (anchor: { x: number; y: number; width: number; height: number }) => void) =>
    ref.current?.measureInWindow((x, y, width, height) => then({ x, y, width, height }));

  const gesture = useHoldGesture(canHold, {
    pressIn: () => hold?.pressIn(),
    // Lifted in the moment it took to measure: no hold after all.
    start: () => measure((anchor) => gesture.down() && hold?.start(anchor)),
    move: (away) => hold?.move(away),
    release: () => hold?.release(),
    cancel: () => hold?.cancel(),
  });
  const holding = gesture.holding;

  const label =
    t(open ? 'address.closeAssistant' : 'address.openAssistant') + (unseen ? `, ${t('address.assistantUnseen')}` : '');

  return (
    <View {...gesture.touch}>
      <Pressable
        ref={ref}
        onPress={() => {
          // The lift that ends a hold is not a tap (the flag is reset by the next press).
          if (gesture.held()) return;
          gesture.clear();
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
  button: {
    width: 34,
    height: 34,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
