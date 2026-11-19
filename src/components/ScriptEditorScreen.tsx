import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkScript, MAX_SCRIPT_BYTES } from '../content/scriptCheck';
import { MAX_SCRIPT_NAME } from '../content/userScripts';
import { t } from '../i18n';
import { AppModal } from '../ui/AppModal';
import { makeStyles, readableColumn, usePalette } from '../ui/theme';
import { KeyboardAwareScrollView } from './KeyboardAware';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost } from './Dialog';
import { ErrorDetails } from './ErrorDetails';
import { ScreenHeader } from './ScreenHeader';

/** What the editor opens with. */
export type ScriptDraft = { title: string; name: string; code: string; where?: string };

/**
 * Views and edits a kept script's name and code (docs/page-customisation.md › Kept scripts). Save runs the static
 * check (refused code isn't saved; the reason is a sentence with the checker's lines under Details); changed code is
 * then approved in the dialog before it is saved (onSave does that and resolves false when the user declines).
 */
export function ScriptEditorScreen({
  draft,
  onSave,
  onClose,
}: {
  draft: ScriptDraft | null;
  /** Resolves true when saved, false when the user didn't approve the new code. */
  onSave: (name: string, code: string) => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <AppModal visible={!!draft} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {draft && <Editor draft={draft} onSave={onSave} onClose={onClose} />}
      <DialogHost />
    </AppModal>
  );
}

function Editor({ draft, onSave, onClose }: { draft: ScriptDraft; onSave: (name: string, code: string) => Promise<boolean>; onClose: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const [name, setName] = useState(draft.name);
  const [code, setCode] = useState(draft.code);
  const [problem, setProblem] = useState<{ text: string; detail: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const result = checkScript(code, 'kept');
    if (!result.ok) {
      setProblem({ text: t('scripts.refusedBody'), detail: result.problems.join('\n') });
      return;
    }
    setSaving(true);
    try {
      if (await onSave(name.trim(), code)) onClose();
      else setProblem({ text: t('scripts.notApproved'), detail: '' });
    } catch (e) {
      setProblem({ text: t('scripts.saveFailed'), detail: e instanceof Error ? e.message : String(e) });
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
          maxLength={MAX_SCRIPT_NAME}
          style={styles.input}
          placeholderTextColor={palette.textSecondary}
          accessibilityLabel={t('styles.nameLabel')}
        />
        <Text style={styles.label}>{t('scripts.codeLabel')}</Text>
        <TextInput
          value={code}
          onChangeText={(text) => {
            setCode(text);
            setProblem(null);
          }}
          multiline
          maxLength={MAX_SCRIPT_BYTES}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          style={[styles.input, styles.code]}
          accessibilityLabel={t('scripts.codeLabel')}
        />
        {problem && (
          <View style={styles.problem} accessibilityLiveRegion="polite">
            <Text style={styles.problemText}>{problem.text}</Text>
            {problem.detail ? <ErrorDetails details={problem.detail} /> : null}
          </View>
        )}
        <Text style={styles.hint}>{t('scripts.codeHint')}</Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: c.text, marginTop: 8 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  input: { backgroundColor: c.surface, borderRadius: 12, padding: 12, fontSize: 16, color: c.text },
  code: { minHeight: 260, fontSize: 14, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  problem: { backgroundColor: c.surface, borderRadius: 12, padding: 12, gap: 4 },
  problemText: { fontSize: 15, color: c.danger },
}));
