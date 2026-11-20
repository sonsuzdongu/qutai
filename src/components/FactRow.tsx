import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { t } from '../i18n';
import { Icon, type IconName } from '../ui/Icon';
import { makeStyles, radii, usePalette } from '../ui/theme';

/**
 * One remembered fact in a list the user can correct (design record UI-28): the voice introduction's review, the
 * profile questions' summary and Settings › Memory. A tap edits it in place (or opens the screen's own editor),
 * the cross removes it. Everything below the fact (what it replaces, a "hide" switch) comes as children.
 */
export function FactRow({
  icon,
  text,
  onEdit,
  editHint = t('memory.editHint'),
  onRemove,
  removeLabel = t('memory.delete'),
  editing,
  accessory,
  children,
}: {
  icon?: IconName;
  text: string;
  /** Absent: the fact is shown but not editable here. */
  onEdit?: () => void;
  editHint?: string;
  onRemove: () => void;
  removeLabel?: string;
  /** The fact being edited in place: a multi-line field that saves when it loses focus or on Done. */
  editing?: { text: string; onChange: (text: string) => void; onDone: () => void; label: string; maxLength?: number };
  /** Beside the text, before the cross (a "Reveal" button). */
  accessory?: ReactNode;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const main = (
    <>
      {icon ? <Icon name={icon} size={18} color={palette.textSecondary} /> : null}
      {editing ? (
        <TextInput
          style={styles.input}
          value={editing.text}
          onChangeText={editing.onChange}
          onBlur={editing.onDone}
          onSubmitEditing={editing.onDone}
          autoFocus
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
          maxLength={editing.maxLength}
          accessibilityLabel={editing.label}
        />
      ) : (
        <Text style={styles.text}>{text}</Text>
      )}
      {editing ? null : accessory}
      <Pressable onPress={onRemove} hitSlop={10} style={styles.remove} accessibilityRole="button" accessibilityLabel={removeLabel}>
        <Icon name="close" size={14} color={palette.textSecondary} />
      </Pressable>
    </>
  );
  return (
    <View style={styles.row}>
      {onEdit && !editing ? (
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityHint={editHint}
        >
          {main}
        </Pressable>
      ) : (
        <View style={styles.main}>{main}</View>
      )}
      {Children.toArray(children).length ? <View style={styles.below}>{children}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    borderRadius: radii.control,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
    overflow: 'hidden',
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6, paddingVertical: 10 },
  below: { gap: 8, paddingLeft: 14, paddingRight: 6, paddingBottom: 10 },
  pressed: { backgroundColor: c.pressed },
  text: { flex: 1, color: c.text, fontSize: 15, lineHeight: 20 },
  input: { flex: 1, color: c.text, fontSize: 15, lineHeight: 20, paddingVertical: 0, marginRight: 8 },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
}));
