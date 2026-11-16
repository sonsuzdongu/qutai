import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import { darkPalette, makeStyles, usePalette } from '../ui/theme';
import { Icon, IconName } from '../ui/Icon';

type Result = { index: number; count: number };

const SEARCH_DELAY_MS = 200;

/** Replaces the address bar while searching the page; matches are highlighted by the page script. */
export function FindBar({ tab, darkMode, onClose }: { tab: Tab; darkMode?: boolean; onClose: () => void }) {
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Result & { query: string }>({ query: '', index: -1, count: 0 });
  const dark = tab.incognito || !!darkMode;

  useEffect(() => {
    const timer = setTimeout(() => {
      tab
        .run<Result>('findInPage', [query])
        .catch(() => ({ index: -1, count: 0 }))
        .then((r) => setResult({ ...r, query }));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [tab, query]);

  const step = (delta: number) => {
    tab
      .run<Result>('findStep', [delta])
      .then((r) => setResult({ ...r, query }))
      .catch(() => {});
  };

  const close = () => {
    tab.run('clearFind').catch(() => {});
    onClose();
  };

  const searched = result.query === query && query.trim() !== '';
  const label = searched ? (result.count ? `${result.index + 1}/${result.count}` : t('find.none')) : '';

  return (
    <View style={[styles.bar, dark && styles.barDark]}>
      <View style={[styles.field, dark && styles.fieldDark]}>
        <TextInput
          style={[styles.input, dark && styles.textDark]}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => step(1)}
          placeholder={t('find.placeholder')}
          placeholderTextColor={dark ? '#a9a8b3' : '#6b6862'}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit={false}
        />
        <Text style={[styles.count, searched && result.count === 0 && styles.none]}>{label}</Text>
      </View>
      <Button
        icon="chevronUp"
        onPress={() => step(-1)}
        disabled={!result.count}
        dark={dark}
        a11y={t('find.previous')}
      />
      <Button icon="chevronDown" onPress={() => step(1)} disabled={!result.count} dark={dark} a11y={t('find.next')} />
      <Button icon="close" onPress={close} dark={dark} a11y={t('common.close')} />
    </View>
  );
}

function Button({
  icon,
  onPress,
  disabled,
  dark,
  a11y,
}: {
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  dark: boolean;
  a11y: string;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={styles.button} accessibilityRole="button" accessibilityLabel={a11y}>
      <Icon
        name={icon}
        size={20}
        color={dark ? darkPalette.text : palette.text}
        style={disabled ? styles.disabled : undefined}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    backgroundColor: c.chrome,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  barDark: { backgroundColor: '#24232b', borderBottomColor: '#3a3944' },
  field: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldDark: { backgroundColor: '#3a3944' },
  input: { flex: 1, fontSize: 15, color: c.text, paddingVertical: 0, height: '100%' },
  textDark: { color: '#f2f1f5' },
  count: { fontSize: 13, color: c.textSecondary },
  none: { color: c.danger },
  button: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, color: c.text },
  disabled: { opacity: 0.3 },
}));
