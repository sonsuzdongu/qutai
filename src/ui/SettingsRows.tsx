import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { WholeWordsText } from '../components/WholeWordsText';
import { Icon, type IconName } from './Icon';
import { common, makeStyles, radii, usePalette } from './theme';
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

/**
 * A group of settings (design record UI-54): an optional heading (a header for screen readers), the rows in one card
 * with a thin line between them, and an optional grey note under the card. Rows are GroupSwitch, GroupLink and
 * GroupItem (anything else, padded like a row); `null`/`false` children are skipped, so a row can be conditional.
 */
export function SettingsSection({
  title,
  footer,
  children,
  style,
}: {
  title?: string;
  footer?: string | ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <Text style={styles.heading} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {rows.length > 0 && (
        <View style={styles.card}>
          {rows.map((row, i) => (
            <View key={row.key ?? i} style={i > 0 && styles.line}>
              {row}
            </View>
          ))}
        </View>
      )}
      {typeof footer === 'string' ? <Text style={styles.footer}>{footer}</Text> : footer}
    </View>
  );
}

/** A switch row inside a SettingsSection card. */
export function GroupSwitch(props: Parameters<typeof SwitchRow>[0]) {
  const styles = useStyles();
  return <SwitchRow {...props} style={[styles.groupRow, props.style]} />;
}

/** Anything else inside a SettingsSection card (a text field, a list, a note), with a row's padding. */
export function GroupItem({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.groupRow, styles.item, style]}>{children}</View>;
}

/**
 * A row that opens a page or does one thing, inside a SettingsSection card: an optional icon, the title, an optional
 * grey line under it (a summary or the current value), and a chevron. `danger`: red title and no chevron (sign out of
 * everything, delete); `chevron={false}` for an action that opens nothing.
 */
export function GroupLink({
  title,
  value,
  summary,
  icon,
  onPress,
  danger,
  chevron = !danger,
  disabled,
  right,
  accessibilityHint,
}: {
  title: string;
  /** The current choice, in the accent colour under the title ("Automatic"). */
  value?: string;
  summary?: string;
  icon?: IconName;
  onPress: () => void;
  danger?: boolean;
  chevron?: boolean;
  disabled?: boolean;
  /** Shown instead of the chevron (a spinner while it works). */
  right?: ReactNode;
  accessibilityHint?: string;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.groupRow, styles.linkRow, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
    >
      {icon && (
        <View style={styles.iconTile}>
          <Icon name={icon} size={18} color={danger ? palette.danger : palette.tintText} />
        </View>
      )}
      <View style={styles.texts}>
        <Text style={[styles.title, danger && styles.danger]}>{title}</Text>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {summary ? <Text style={styles.hint}>{summary}</Text> : null}
      </View>
      {right ?? (chevron ? <Icon name="chevronRight" size={18} color={palette.textSecondary} /> : null)}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  section: { gap: 6, marginTop: 18 },
  heading: { fontSize: 13, fontWeight: '600', color: c.textSecondary, marginHorizontal: 4, letterSpacing: 0.2 },
  card: { ...common(c).card, overflow: 'hidden' },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
  footer: { ...common(c).hint, marginHorizontal: 4 },
  groupRow: { paddingHorizontal: 14, paddingVertical: 12 },
  item: { gap: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.sunken,
  },
  danger: { color: c.danger },
  value: { fontSize: 15, color: c.tintText, fontWeight: '600' },
  pressed: { backgroundColor: c.pressed },
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
