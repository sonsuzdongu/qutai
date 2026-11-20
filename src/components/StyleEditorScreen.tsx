import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MAX_CSS_LENGTH, sanitizeCss, type CssProblem } from '../content/userCss';
import { MAX_STYLE_NAME } from '../content/userStyles';
import { t, type MessageKey } from '../i18n';
import { AppModal } from '../ui/AppModal';
import { makeStyles, readableColumn, usePalette, radii, common } from '../ui/theme';
import { KeyboardAwareScrollView } from './KeyboardAware';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost } from './Dialog';
import { ErrorDetails } from './ErrorDetails';
import { ScreenHeader } from './ScreenHeader';

/** What the editor opens with; `title` is the screen's title ("Edit style", "Add a style"). */
export type StyleDraft = { title: string; name: string; css: string; where?: string };

/** The user's sentence for a refused stylesheet (the sanitiser's detail goes under Details). */
export function cssProblemText(problem: CssProblem): string {
  return t(`styles.problem.${problem}` as MessageKey);
}

/**
 * Edits a user style's name and CSS (docs/page-customisation.md). The CSS is sanitised on Save: refused CSS is not
 * saved, and the reason is shown as a sentence with the sanitiser's detail under Details.
 */
export function StyleEditorScreen({
  draft,
  onSave,
  onClose,
}: {
  draft: StyleDraft | null;
  /** Resolves when saved; the CSS given is the sanitiser's output. */
  onSave: (name: string, css: string) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <AppModal visible={!!draft} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {draft && <Editor draft={draft} onSave={onSave} onClose={onClose} />}
      <DialogHost />
    </AppModal>
  );
}

function Editor({ draft, onSave, onClose }: { draft: StyleDraft; onSave: (name: string, css: string) => Promise<void>; onClose: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const [name, setName] = useState(draft.name);
  const [css, setCss] = useState(draft.css);
  const [problem, setProblem] = useState<{ text: string; detail: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const result = sanitizeCss(css);
    if (!result.ok) {
      setProblem({ text: cssProblemText(result.problem), detail: result.detail });
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), result.css);
      onClose();
    } catch (e) {
      setProblem({ text: t('styles.saveFailed'), detail: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
      <ScreenHeader
        title={draft.title}
        left={{ label: t('common.cancel'), onPress: onClose }}
        right={{ label: t('common.save'), disabled: saving, onPress: () => void save() }}
      />
      <KeyboardAwareScrollView contentContainerStyle={[styles.content, readableColumn]} keyboardShouldPersistTaps="handled">
        {draft.where ? <Text style={styles.hint}>{draft.where}</Text> : null}
        <Text style={styles.label}>{t('styles.nameLabel')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={MAX_STYLE_NAME}
          style={styles.input}
          placeholderTextColor={palette.textSecondary}
          placeholder={t('styles.namePlaceholder')}
          accessibilityLabel={t('styles.nameLabel')}
        />
        <Text style={styles.label}>{t('styles.cssLabel')}</Text>
        <TextInput
          value={css}
          onChangeText={(text) => {
            setCss(text);
            setProblem(null);
          }}
          multiline
          maxLength={MAX_CSS_LENGTH}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          style={[styles.input, styles.code]}
          placeholder={'a {\n  color: red;\n}'}
          placeholderTextColor={palette.textSecondary}
          accessibilityLabel={t('styles.cssLabel')}
        />
        {problem && (
          <View style={styles.problem} accessibilityLiveRegion="polite">
            <Text style={styles.problemText}>{problem.text}</Text>
            <ErrorDetails details={problem.detail} />
          </View>
        )}
        {/* A word joiner keeps "!important" on one line. */}
        <Text style={styles.hint}>{t('styles.cssHint').replace('!important', '!\u2060important')}</Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: c.text, marginTop: 8 },
  hint: common(c).hint,
  input: { backgroundColor: c.surface, borderRadius: radii.control, padding: 12, fontSize: 16, color: c.text },
  code: { minHeight: 220, fontSize: 14, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  problem: { backgroundColor: c.surface, borderRadius: radii.control, padding: 12, gap: 4 },
  problemText: { fontSize: 15, color: c.danger },
}));
