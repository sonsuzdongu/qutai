import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';

/**
 * Header texts grow with the system text size up to this much. The row holds a title and up to two actions
 * side by side; above 1.4x the longest action pair (French "Tout supprimer" + "Terminé") no longer fits next
 * to any title on a 360dp phone. The assistant panel and the address bar cap their single-line texts the same way.
 */
export const HEADER_FONT_SCALE = 1.4;

/** Below this the title would show only a few letters, so it gets all the room instead of being centred. */
const MIN_CENTRED_TITLE = 120;
const GAP = 8;
const PADDING = 16;

export type HeaderAction = {
  label: string;
  onPress: () => void;
  /** primary: the screen's Done/Save (bold, tinted); danger: Clear all; plain: Cancel; link: tinted, not bold (Back). */
  tone?: 'primary' | 'danger' | 'plain' | 'link';
  /**
   * Shown before the label; with `iconOnly` instead of it (the label is then what screen readers say). Back
   * actions are always the icon alone, as in Settings: a named back button ("< Saved pages") beside a long
   * action does not fit a 360dp row in every language.
   */
  icon?: IconName;
  iconOnly?: boolean;
  disabled?: boolean;
};

type Props = {
  title?: string;
  left?: HeaderAction;
  right?: HeaderAction;
};

/**
 * The top row of a full-screen page: an action on each side and the title between them. The actions keep their
 * full label on one line; the title gives way (up to two lines, then an ellipsis). The title is centred while
 * that leaves it enough room, otherwise it takes all the space between the actions.
 */
export function ScreenHeader({ title, left, right }: Props) {
  const styles = useStyles();
  const [row, setRow] = useState(0);
  const [leftWidth, setLeftWidth] = useState(0);
  const [rightWidth, setRightWidth] = useState(0);
  const widest = Math.max(leftWidth, rightWidth);
  const centred = row > 0 && row - 2 * PADDING - 2 * (widest + GAP) >= MIN_CENTRED_TITLE;
  const side = centred ? { minWidth: widest } : null;
  const measure = (set: (w: number) => void) => (e: LayoutChangeEvent) => set(Math.ceil(e.nativeEvent.layout.width));

  return (
    <View style={styles.header} onLayout={measure(setRow)}>
      <View style={[styles.side, side]}>
        {left ? <ActionButton action={left} onWidth={measure(setLeftWidth)} /> : null}
      </View>
      <Text
        style={styles.title}
        accessibilityRole="header"
        numberOfLines={2}
        maxFontSizeMultiplier={HEADER_FONT_SCALE}
      >
        {title}
      </Text>
      <View style={[styles.side, styles.right, side]}>
        {right ? <ActionButton action={right} onWidth={measure(setRightWidth)} /> : null}
      </View>
    </View>
  );
}

function ActionButton({ action, onWidth }: { action: HeaderAction; onWidth: (e: LayoutChangeEvent) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const tone = action.tone ?? 'primary';
  const color = tone === 'danger' ? palette.danger : tone === 'plain' ? palette.textSecondary : palette.tintText;
  return (
    <Pressable
      onPress={action.onPress}
      disabled={action.disabled}
      hitSlop={8}
      onLayout={onWidth}
      style={({ pressed }) => [styles.button, action.disabled ? styles.disabled : pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: action.disabled }}
    >
      {action.icon ? <Icon name={action.icon} size={action.iconOnly ? 22 : 18} color={action.iconOnly ? palette.text : color} /> : null}
      {action.iconOnly ? null : (
        <Text
          style={[styles.label, { color }, tone === 'primary' && styles.bold]}
          numberOfLines={1}
          maxFontSizeMultiplier={HEADER_FONT_SCALE}
        >
          {action.label}
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: PADDING,
    paddingVertical: 6,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  // The title (flex: 1, no basis) gives way first; only when the two actions alone overflow the row do their
  // labels shrink, and then they end in an ellipsis on one line rather than breaking inside a word.
  side: { flexShrink: 1, alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, color: c.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 44, minWidth: 44, flexShrink: 1 },
  label: { fontSize: 16, flexShrink: 1 },
  bold: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
}));
