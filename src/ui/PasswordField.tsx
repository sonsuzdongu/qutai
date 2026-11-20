import { useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { t } from '../i18n';
import { Icon } from './Icon';
import { passwordHints, repairSecureReentry, type Selection } from './passwordInput';
import { common, makeStyles, usePalette } from './theme';

type Props = {
  /** What the field is ("Password", "Repeat password"): its placeholder and its name for the screen reader. */
  label: string;
  value: string;
  onChange: (text: string) => void;
  /** 'new': a password made up now (with a repeat field); 'current': one the user already has. Sets the autofill hints. */
  purpose: 'new' | 'current';
  /** Shown under the field in red and announced; the field gets a red border. */
  error?: string | null;
  /** Return key: 'go' and this when given, 'next' otherwise. */
  onSubmit?: () => void;
  autoFocus?: boolean;
};

/**
 * The one password field of Qutai's own screens (backup passwords; design record UI-33). The text is hidden; an eye
 * inside the field, at its end (the right edge, the left in right-to-left layouts), shows and hides it. Each field has
 * its own eye.
 *
 * - The eye is a 44 pt button whose name says what it will do ("Show password" / "Hide password"); the change is
 *   announced. While hidden, the screen reader does not read the text (the system's secure field).
 * - Tapping the eye keeps the keyboard open (the screens' scroll views keep handled taps) and the cursor where it was:
 *   switching the field between secure and plain moves the cursor on both systems, so the selection is put back.
 *   Android's switch to a monospace font is undone by React Native itself (ReactEditText.setInputType keeps the font).
 * - iOS wipes a field that turns secure while it is edited on the next key; the first change after hiding is repaired
 *   (passwordInput.ts).
 * - No autocorrection, capitalisation or suggestions; while visible on Android the keyboard is told it is a password
 *   ('visible-password') so it does not learn it.
 */
export function PasswordField({ label, value, onChange, purpose, error, onSubmit, autoFocus }: Props) {
  const styles = useStyles();
  const palette = usePalette();
  const [visible, setVisible] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const selection = useRef<Selection>({ start: value.length, end: value.length });
  const focused = useRef(false);
  /** iOS: hidden again while focused, so the next change may be the system wiping the field. */
  const resecured = useRef(false);

  /** Puts the cursor back after the native field changed under it. */
  const restoreSelection = (keep: Selection) =>
    requestAnimationFrame(() => {
      const field = input.current;
      if (!field) return;
      if (!field.isFocused()) field.focus();
      field.setSelection(keep.start, keep.end);
    });

  const toggle = () => {
    const next = !visible;
    setVisible(next);
    resecured.current = Platform.OS === 'ios' && !next && focused.current;
    AccessibilityInfo.announceForAccessibility(t(next ? 'password.shown' : 'password.hidden'));
    if (focused.current) restoreSelection({ ...selection.current });
  };

  const change = (text: string) => {
    if (resecured.current) {
      resecured.current = false;
      const repaired = repairSecureReentry(value, text, selection.current);
      if (repaired !== text) {
        // The field showed only the new key; the value puts the text back, and the cursor goes after the edit (before
        // the text that followed the selection).
        const after = value.length - Math.min(value.length, Math.max(selection.current.start, selection.current.end));
        const at = Math.max(0, repaired.length - after);
        onChange(repaired);
        restoreSelection({ start: at, end: at });
        return;
      }
    }
    onChange(text);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.field, !!error && styles.fieldError]}>
        <TextInput
          ref={input}
          style={styles.input}
          value={value}
          onChangeText={change}
          onSelectionChange={(e) => {
            selection.current = e.nativeEvent.selection;
          }}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            resecured.current = false;
          }}
          placeholder={label}
          placeholderTextColor={palette.textSecondary}
          accessibilityLabel={label}
          secureTextEntry={!visible}
          keyboardType={visible && Platform.OS === 'android' ? 'visible-password' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          {...passwordHints(purpose)}
          maxLength={200}
          autoFocus={autoFocus}
          onSubmitEditing={onSubmit}
          returnKeyType={onSubmit ? 'go' : 'next'}
        />
        <Pressable
          onPress={toggle}
          style={styles.eye}
          accessibilityRole="button"
          accessibilityLabel={t(visible ? 'password.hide' : 'password.show')}
        >
          <Icon name={visible ? 'passwordHide' : 'passwordShow'} size={20} color={palette.textSecondary} />
        </Pressable>
      </View>
      {!!error && (
        <Text style={styles.error} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => {
  const input = common(c).input;
  return {
    wrap: { gap: 6 },
    /** The box of common().input, holding the text and the eye side by side. */
    field: {
      flexDirection: 'row',
      alignItems: 'stretch',
      minHeight: input.minHeight,
      borderRadius: input.borderRadius,
      backgroundColor: input.backgroundColor,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    fieldError: { borderColor: c.danger },
    input: {
      ...input,
      flex: 1,
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingEnd: 0,
    },
    eye: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    error: { ...common(c).hint, color: c.danger },
  };
});
