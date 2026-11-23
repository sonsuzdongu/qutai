import { Pressable, Text } from 'react-native';
import { Icon, IconName } from '../ui/Icon';
import { darkPalette, makeStyles, usePalette } from '../ui/theme';
import { BottomSheet } from './BottomSheet';

export type SheetAction = { label: string; onPress: () => void; destructive?: boolean; icon?: IconName };

type Props = { title: string | null; actions: SheetAction[]; dark?: boolean; onClose: () => void };

/** A simple bottom sheet with a title and a list of actions (Android alerts only fit three buttons). */
export function ActionSheet({ title, actions, dark, onClose }: Props) {
  // The app's theme; dark: an incognito tab or the dark theme (UI-48).
  const styles = useStyles(dark);
  const system = usePalette();
  const palette = dark ? darkPalette : system;
  return (
    <BottomSheet visible={title !== null} onClose={onClose} style={styles.sheet}>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={() => {
            onClose();
            action.onPress();
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
