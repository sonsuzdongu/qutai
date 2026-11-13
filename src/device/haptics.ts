import * as Haptics from 'expo-haptics';

let enabled = true;

/** Follows the "Haptic feedback" setting. */
export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

/** A light tick, for selections (switching tabs, picking an option). */
export function tick() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}

/** A short bump, for things that appear or go away (long-press menu, closing a tab). */
export function bump() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Done, e.g. a task finished. */
export function success() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
