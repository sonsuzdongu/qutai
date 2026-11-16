import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;

/** Follows the "Haptic feedback" setting. */
export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

const { AndroidHaptics } = Haptics;
type AndroidHaptic = (typeof AndroidHaptics)[keyof typeof AndroidHaptics];

/**
 * Android: the system's own haptic feedback on the app's view (performHapticFeedback), which follows the phone's
 * "Touch feedback" / "Vibration & haptics" settings; the vibrator calls behind selectionAsync / impactAsync would
 * ignore them. Newer constants fall back to one every Android version has. iOS: UIFeedbackGenerator, which follows
 * the system's "System Haptics" setting on its own.
 */
function android(preferred: AndroidHaptic, fallback: AndroidHaptic) {
  Haptics.performAndroidHapticsAsync(preferred).catch(() => Haptics.performAndroidHapticsAsync(fallback).catch(() => {}));
}

/** A light tick, for selections (switching tabs, picking an option). */
export function tick() {
  if (!enabled) return;
  if (Platform.OS === 'android') return android(AndroidHaptics.Segment_Tick, AndroidHaptics.Clock_Tick);
  Haptics.selectionAsync().catch(() => {});
}

/** A short bump, for things that appear or go away (long-press menu, closing a tab). */
export function bump() {
  if (!enabled) return;
  if (Platform.OS === 'android') return android(AndroidHaptics.Long_Press, AndroidHaptics.Long_Press);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A switch turned on or off. */
export function toggle(on: boolean) {
  if (!enabled) return;
  if (Platform.OS === 'android') {
    return android(on ? AndroidHaptics.Toggle_On : AndroidHaptics.Toggle_Off, AndroidHaptics.Clock_Tick);
  }
  Haptics.selectionAsync().catch(() => {});
}

/** A confirmation given (Allow in the approval dialog, a confirmed dialog). */
export function confirm() {
  if (!enabled) return;
  if (Platform.OS === 'android') return android(AndroidHaptics.Confirm, AndroidHaptics.Virtual_Key);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Done, e.g. a task finished. */
export function success() {
  if (!enabled) return;
  if (Platform.OS === 'android') return android(AndroidHaptics.Confirm, AndroidHaptics.Virtual_Key);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
