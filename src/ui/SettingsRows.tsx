import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { WholeWordsText } from '../components/WholeWordsText';
import { common, makeStyles, radii } from './theme';
import { ThemedSwitch } from './ThemedSwitch';

/**
 * The rows settings screens are made of (design record UI-28): a switch with its title and hint, a link to another
 * page, and a segmented control. One look everywhere; a screen passes `style` for its own spacing.
 */
export function SwitchRow({
  title,
  hint,
  value,
  onChange,
  disabled,
  style,
  titleStyle,
}: {
  title: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.row, style, disabled && styles.disabled]}>
      <View style={styles.texts}>
        <Text style={[styles.title, titleStyle]}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <ThemedSwitch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={title} />
    </View>
  );
}

export function LinkRow({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={[styles.link, style]} accessibilityRole="button">
      <Text style={styles.linkText}>{label} ›</Text>
    </Pressable>
  );
}

export type SegmentOption<T extends string> = { value: T; label: string; icon?: ReactNode };

/** Options side by side, one selected; labels keep whole words at large text sizes (WholeWordsText). */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  role = 'radio',
  accessibilityLabel,
  style,
  textStyle,
  selectedTextStyle,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  role?: 'radio' | 'tab';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** Extra style of the selected option's label, given its value (a red "Block", for one). */
  selectedTextStyle?: (value: T) => StyleProp<TextStyle>;
}) {
  const styles = useStyles();
  return (
    <View
      style={[styles.segment, style]}
      accessibilityRole={role === 'radio' ? 'radiogroup' : 'tablist'}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segmentButton, selected && styles.segmentSelected]}
            accessibilityRole={role}
            accessibilityState={{ selected }}
          >
            {o.icon}
            <WholeWordsText
              style={[styles.segmentText, textStyle, selected && styles.segmentTextSelected, selected && selectedTextStyle?.(o.value)]}
            >
              {o.label}
            </WholeWordsText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: common(c).row,
  texts: { flex: 1, gap: 2 },
  title: common(c).label,
  hint: common(c).hint,
  disabled: { opacity: 0.4 },
  link: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingVertical: 9 },
  linkText: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  segment: common(c).segment,
  segmentButton: {
    ...common(c).segmentButton,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 2,
    borderRadius: radii.inner,
  },
  segmentSelected: common(c).segmentSelected,
  segmentText: common(c).segmentText,
  segmentTextSelected: common(c).segmentTextSelected,
}));
