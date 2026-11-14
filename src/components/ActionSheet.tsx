import { Pressable, Text } from 'react-native';
import { makeStyles } from '../ui/theme';
import { BottomSheet } from './BottomSheet';

export type SheetAction = { label: string; onPress: () => void; destructive?: boolean };

type Props = { title: string | null; actions: SheetAction[]; dark?: boolean; onClose: () => void };

/** A simple bottom sheet with a title and a list of actions (Android alerts only fit three buttons). */
export function ActionSheet({ title, actions, dark, onClose }: Props) {
  const styles = useStyles();
  return (
    <BottomSheet visible={title !== null} onClose={onClose} style={[styles.sheet, dark && styles.sheetDark]}>
      <Text style={[styles.title, dark && styles.dim]} numberOfLines={1}>
        {title}
      </Text>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={() => {
            onClose();
            action.onPress();
          }}
          style={({ pressed }) => [styles.row, pressed && (dark ? styles.pressedDark : styles.pressed)]}
          accessibilityRole="button"
        >
          <Text style={[styles.label, dark && styles.text, action.destructive && styles.destructive]}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { paddingTop: 14 },
  sheetDark: { backgroundColor: '#2b2a33' },
  title: { fontSize: 13, color: c.textSecondary, paddingHorizontal: 20, paddingBottom: 6 },
  row: { paddingHorizontal: 20, paddingVertical: 13 },
  pressed: { backgroundColor: c.pressed },
  pressedDark: { backgroundColor: '#3a3944' },
  label: { fontSize: 16, color: c.text },
  text: { color: '#f2f1f5' },
  dim: { color: '#a9a8b3' },
  destructive: { color: '#d64545' },
}));
