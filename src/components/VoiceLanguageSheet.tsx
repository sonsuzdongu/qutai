import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { voiceLanguages } from '../device/voiceInput';
import { languageName } from '../device/voiceLanguage';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { Radio } from '../ui/Radio';
import { makeStyles, usePalette } from '../ui/theme';
import { BottomSheet } from './BottomSheet';

/** The languages offered first; the rest come from the phone's recogniser under "More languages…". */
const MAIN = ['tr', 'en'];

type Props = {
  visible: boolean;
  /** The language picked (a language or a tag), or null for automatic. */
  value: string | null;
  /** The automatic row's text, e.g. "Automatic (follows the conversation)". */
  autoLabel: string;
  /** Under the automatic row: what it would choose now, e.g. "Now: Turkish". */
  autoHint?: string;
  onPick: (value: string | null) => void;
  onClose: () => void;
  dark?: boolean;
};

/**
 * Voice input's listening language: Automatic, Turkish, English, and "More languages…" listing what the phone's
 * recogniser offers (on Android, the on-device recogniser's languages: others may still work online).
 */
export function VoiceLanguageSheet({ visible, value, autoLabel, autoHint, onPick, onClose, dark }: Props) {
  const styles = useStyles();
  const palette = usePalette();
  const [more, setMore] = useState<string[] | null>(null);
  const [showMore, setShowMore] = useState(false);
  useEffect(() => {
    if (!showMore || more) return;
    voiceLanguages().then((list) =>
      setMore(
        list
          .filter((tag) => !MAIN.includes(tag.toLowerCase()))
          .map((tag) => ({ tag, name: languageName(tag) }))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((x) => x.tag),
      ),
    );
  }, [showMore, more]);

  // The long list folds away again for next time.
  const close = () => {
    setShowMore(false);
    onClose();
  };
  const choose = (next: string | null) => {
    close();
    onPick(next);
  };
  const row = (key: string, label: string, selected: boolean, onPress: () => void, hint?: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && (dark ? styles.pressedDark : styles.pressed)]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <Radio selected={selected} size={22} />
      <View style={styles.rowText}>
        <Text style={[styles.label, dark && styles.text]}>{label}</Text>
        {hint ? <Text style={[styles.hint, dark && styles.dim]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
  // A tag picked earlier from "More languages…" stays visible (and selected) in the short list.
  const extra = value && !MAIN.includes(value) ? value : null;

  return (
    <BottomSheet visible={visible} onClose={close} style={[styles.sheet, dark && styles.sheetDark]}>
      <Text style={[styles.title, dark && styles.dim]} accessibilityRole="header">
        {t('voice.languageTitle')}
      </Text>
      {row('auto', autoLabel, value === null, () => choose(null), autoHint)}
      {MAIN.map((code) => row(code, languageName(code), value === code, () => choose(code)))}
      {extra ? row(extra, languageName(extra), true, () => choose(extra)) : null}
      {!showMore ? (
        <Pressable
          onPress={() => setShowMore(true)}
          style={({ pressed }) => [styles.row, pressed && (dark ? styles.pressedDark : styles.pressed)]}
          accessibilityRole="button"
        >
          <Icon name="more" size={20} color={dark ? '#a9a8b3' : palette.textSecondary} />
          <Text style={[styles.label, dark && styles.text]}>{t('voice.moreLanguages')}</Text>
        </Pressable>
      ) : more === null ? (
        <ActivityIndicator style={styles.loading} />
      ) : more.length === 0 ? (
        <Text style={[styles.note, dark && styles.dim]}>{t('voice.noLanguageList')}</Text>
      ) : (
        <>
          <Text style={[styles.note, dark && styles.dim]}>{t('voice.moreLanguagesNote')}</Text>
          {more
            .filter((tag) => tag !== extra)
            .map((tag) => row(tag, languageName(tag), value === tag, () => choose(tag)))}
        </>
      )}
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { paddingTop: 14 },
  sheetDark: { backgroundColor: '#2b2a33' },
  title: { fontSize: 13, color: c.textSecondary, paddingHorizontal: 20, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  rowText: { flexShrink: 1 },
  pressed: { backgroundColor: c.pressed },
  pressedDark: { backgroundColor: '#3a3944' },
  label: { fontSize: 16, color: c.text },
  hint: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
  note: { fontSize: 13, color: c.textSecondary, paddingHorizontal: 20, paddingVertical: 8 },
  loading: { paddingVertical: 16 },
  text: { color: '#f2f1f5' },
  dim: { color: '#a9a8b3' },
}));
