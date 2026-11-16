import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CatalogModel, searchCatalog } from '../ai/openrouterCatalog';
import { Catalog, getCatalog, loadCatalog, onCatalogChange, refreshCatalog } from '../ai/openrouterModels';
import { t } from '../i18n';
import { plainError } from '../ai/plainError';
import { formatDateTime, formatNumber } from '../i18n/format';
import { makeStyles, usePalette } from '../ui/theme';
import { Radio } from '../ui/Radio';

/** Rows shown at once; the rest are reached by searching. */
const MAX_ROWS = 40;

/** The cached catalogue, kept current as it is loaded or refreshed anywhere. */
export function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState(getCatalog);
  useEffect(() => {
    const off = onCatalogChange(setCatalog);
    loadCatalog().then(setCatalog);
    return off;
  }, []);
  return catalog;
}

/** One line under a model: its id, context window and whether it takes images. */
export function modelDetail(m: CatalogModel): string {
  return [
    m.id,
    m.context ? t('settings.contextTokens', { count: formatNumber(m.context) }) : '',
    m.images ? '' : t('settings.noImageInput'),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The full list of OpenRouter models that take tools, searchable, from the cached catalogue with a refresh action.
 * Fetched with the user's key the first time it is opened.
 */
export function ModelCatalogPicker({
  apiKey,
  selected,
  onSelect,
}: {
  apiKey: string;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const catalog = useCatalog();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const key = apiKey.trim();

  const refresh = () => {
    if (!key || loading) return;
    setLoading(true);
    setError('');
    refreshCatalog(key)
      .catch((e) => setError(plainError(e).message))
      .finally(() => setLoading(false));
  };

  // The first time the list is opened without a cached copy.
  useEffect(() => {
    loadCatalog().then((cached) => {
      if (!cached && key) refresh();
    });
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = useMemo(() => searchCatalog(catalog?.models ?? [], query), [catalog, query]);

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <TextInput
          placeholderTextColor={palette.textSecondary}
          style={[styles.input, styles.search]}
          value={query}
          onChangeText={setQuery}
          placeholder={t('settings.searchModels')}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <Pressable
          onPress={refresh}
          disabled={!key || loading}
          style={styles.refresh}
          accessibilityRole="button"
          accessibilityState={{ disabled: !key || loading }}
        >
          <Text style={[styles.refreshText, (!key || loading) && styles.disabled]}>{t('settings.refreshModels')}</Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.status}>
          <ActivityIndicator />
          <Text style={styles.hint}>{t('settings.modelsLoading')}</Text>
        </View>
      ) : !key && !catalog ? (
        <Text style={styles.hint}>{t('settings.modelsNeedKey')}</Text>
      ) : error ? (
        <Text style={styles.error}>{t('settings.modelsFailed', { error })}</Text>
      ) : catalog ? (
        <Text style={styles.hint}>{t('settings.modelsUpdated', { date: formatDateTime(new Date(catalog.at)) })}</Text>
      ) : null}

      {matches.slice(0, MAX_ROWS).map((m) => (
        <Pressable
          key={m.id}
          style={styles.option}
          onPress={() => onSelect(m.id)}
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === m.id }}
        >
          <Radio selected={selected === m.id} />
          <View style={styles.optionBody}>
            <Text style={styles.optionText}>{m.name}</Text>
            <Text style={styles.detail} numberOfLines={2}>
              {modelDetail(m)}
            </Text>
          </View>
        </Pressable>
      ))}
      {catalog && matches.length === 0 && <Text style={styles.hint}>{t('settings.noModels')}</Text>}
      {matches.length > MAX_ROWS && (
        <Text style={styles.hint}>{t('settings.modelsMore', { count: matches.length - MAX_ROWS })}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { gap: 6 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1 },
  refresh: { paddingHorizontal: 8, paddingVertical: 10 },
  refreshText: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  error: { fontSize: 13, color: c.danger, lineHeight: 18 },
  input: {
    color: c.text,
    // Grows with large text sizes instead of clipping the text.
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  optionBody: { flex: 1 },
  optionText: { color: c.text, fontSize: 15 },
  detail: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
}));
