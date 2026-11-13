import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';

type Result = { index: number; count: number };

const SEARCH_DELAY_MS = 200;

/** Replaces the address bar while searching the page; matches are highlighted by the page script. */
export function FindBar({ tab, darkMode, onClose }: { tab: Tab; darkMode?: boolean; onClose: () => void }) {
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
          placeholderTextColor={dark ? '#8f8e99' : '#999'}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit={false}
        />
        <Text style={[styles.count, searched && result.count === 0 && styles.none]}>{label}</Text>
      </View>
      <Button label="▲" onPress={() => step(-1)} disabled={!result.count} dark={dark} a11y={t('find.previous')} />
      <Button label="▼" onPress={() => step(1)} disabled={!result.count} dark={dark} a11y={t('find.next')} />
      <Button label="✕" onPress={close} dark={dark} a11y={t('common.close')} />
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  dark,
  a11y,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  dark: boolean;
  a11y: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={styles.button} accessibilityLabel={a11y}>
      <Text style={[styles.buttonText, dark && styles.textDark, disabled && styles.disabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    backgroundColor: '#f5f4ef',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d6d3c9',
  },
  barDark: { backgroundColor: '#24232b', borderBottomColor: '#3a3944' },
  field: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldDark: { backgroundColor: '#3a3944' },
  input: { flex: 1, fontSize: 15, color: '#222', paddingVertical: 0, height: '100%' },
  textDark: { color: '#f2f1f5' },
  count: { fontSize: 13, color: '#888' },
  none: { color: '#b3261e' },
  button: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, color: '#333' },
  disabled: { opacity: 0.3 },
});
