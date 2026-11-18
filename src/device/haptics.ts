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

/**
 * Signals the user should feel without looking at the screen: the microphone is on (holding the Qutai button, whose
 * finger covers it), a voice message went off, a question waits, a task ended or was stopped.
 *
 * Android: a short vibrator waveform (what the hold used before e0bdea8, when the owner felt it), not the view's
 * performHapticFeedback with a system constant. The constant plays a "prebaked" effect (LONG_PRESS → HEAVY_CLICK)
 * whose fallback pattern comes from the phone maker's configuration, so whether and how strongly it is felt depends
 * on the phone; the waveform is played as given. Both follow the phone's "Touch feedback" switch: Android 12+
 * classes a short vibration from an app as touch feedback (checked on Android 16: with the switch off both are
 * "ignored_for_settings" in dumpsys vibrator_manager, with it on both play), and the app's own "Haptic feedback"
 * setting turns everything off. The decorative ticks above keep the system constants.
 */
export type Signal = 'listening' | 'sent' | 'attention' | 'failure' | 'stopped' | 'done';

export function signal(kind: Signal) {
  if (!enabled) return;
  switch (kind) {
    case 'listening':
      return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    case 'sent':
    case 'stopped':
      return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    case 'attention':
      return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    case 'failure':
      return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    case 'done':
      return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

/** Done, e.g. a file saved (a finished task is signal('done')). */
export function success() {
  if (!enabled) return;
  if (Platform.OS === 'android') return android(AndroidHaptics.Confirm, AndroidHaptics.Virtual_Key);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
