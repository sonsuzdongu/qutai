import { useRef } from 'react';
import { Pressable, Text } from 'react-native';
import { Icon, IconName } from '../ui/Icon';
import { darkPalette, makeStyles, usePalette } from '../ui/theme';
import { BottomSheet } from './BottomSheet';

export type SheetAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: IconName;
  /**
   * Runs only once the sheet has gone: for an action that shows a system screen (the save dialog, Quick Look, the
   * share sheet). Shown while the sheet's modal was still closing, such a screen was dismissed with it at once, and on
   * a Mac the window stopped responding (DL-19, 26 Nov 2026).
   */
  afterClose?: boolean;
};

/** Longest wait for the sheet's dismissal before an afterClose action runs anyway (Android has no onDismiss). */
const AFTER_CLOSE_FALLBACK_MS = 700;

type Props = { title: string | null; actions: SheetAction[]; dark?: boolean; onClose: () => void };

/** A simple bottom sheet with a title and a list of actions (Android alerts only fit three buttons). */
export function ActionSheet({ title, actions, dark, onClose }: Props) {
  // The app's theme; dark: an incognito tab or the dark theme (UI-48).
  const styles = useStyles(dark);
  const system = usePalette();
  const palette = dark ? darkPalette : system;
  // An afterClose action waiting for the sheet to go: run once, on its dismissal or after the fallback.
  const waiting = useRef<(() => void) | null>(null);
  const runWaiting = () => {
    const run = waiting.current;
    waiting.current = null;
    run?.();
  };
  return (
    <BottomSheet visible={title !== null} onClose={onClose} onDismiss={runWaiting} style={styles.sheet}>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={() => {
            onClose();
            if (!action.afterClose) return action.onPress();
            waiting.current = action.onPress;
            setTimeout(runWaiting, AFTER_CLOSE_FALLBACK_MS);
          }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          {action.icon ? (
            <Icon name={action.icon} size={20} color={action.destructive ? palette.danger : palette.textSecondary} />
          ) : null}
          <Text style={[styles.label, action.destructive && styles.destructive]}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  // As before: the page colour in light, raised surface in dark.
  sheet: { paddingTop: 14, backgroundColor: c.dark ? c.surface : c.bg },
  title: { fontSize: 13, color: c.textSecondary, paddingHorizontal: 20, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
  pressed: { backgroundColor: c.pressed },
  label: { flexShrink: 1, fontSize: 16, color: c.text },
  destructive: { color: c.danger },
}));
