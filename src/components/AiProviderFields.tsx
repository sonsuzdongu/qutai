import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getProvider, PROVIDER_ORDER } from '../ai/providers';
import type { ProviderId } from '../ai/types';
import { t } from '../i18n';
import type { Settings } from '../storage/settings';
import { makeStyles, usePalette } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { ModelCatalogPicker, modelDetail, useCatalog } from './ModelCatalogPicker';

export type AiChoice = Pick<Settings, 'provider' | 'apiKeys' | 'models'>;

/** Trims keys and fills empty model ids with the provider's default, before saving. */
export function cleanAiChoice<T extends AiChoice>(value: T): T {
  const apiKeys = { ...value.apiKeys };
  const models = { ...value.models };
  PROVIDER_ORDER.forEach((id) => {
    apiKeys[id] = apiKeys[id].trim();
    models[id] = models[id].trim() || getProvider(id).defaultModel;
  });
  return { ...value, apiKeys, models };
}

/** AI provider, its API key and the model: shared by Settings and the first-run setup. */
export function AiProviderFields({ value, onChange }: { value: AiChoice; onChange: (next: AiChoice) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const provider = getProvider(value.provider);
  const model = value.models[value.provider];
  const catalog = useCatalog();
  const [browsing, setBrowsing] = useState(false);
  const inCatalog = provider.catalog ? catalog?.models.find((m) => m.id === model) : undefined;
  const isCustomModel = !provider.models.some((m) => m.id === model) && !inCatalog;
  const setApiKey = (key: string) => onChange({ ...value, apiKeys: { ...value.apiKeys, [value.provider]: key } });
  const setModel = (id: string) => onChange({ ...value, models: { ...value.models, [value.provider]: id } });

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{t('settings.provider')}</Text>
      <View style={styles.segment}>
        {PROVIDER_ORDER.map((id: ProviderId) => {
          const selected = id === value.provider;
          return (
            <Pressable
              key={id}
              onPress={() => onChange({ ...value, provider: id })}
              style={[styles.segmentButton, selected && styles.segmentSelected]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {getProvider(id).label.replace('Google ', '')}
              </Text>
              {!!value.apiKeys[id] && <Text style={styles.keyDot}>●</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t('settings.apiKey', { provider: provider.label })}</Text>
      <TextInput
        placeholderTextColor={palette.textSecondary}
        key={value.provider}
        style={styles.input}
        value={value.apiKeys[value.provider]}
        onChangeText={setApiKey}
        placeholder={provider.keyPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Text style={styles.hint}>
        {t('settings.keyHint')}{' '}
        <Text style={styles.link} onPress={() => Linking.openURL(provider.keyUrl)}>
          {t('settings.getKey')}
        </Text>
      </Text>

      <Text style={styles.label}>{t('settings.model')}</Text>
      {provider.catalog && <Text style={styles.subLabel}>{t('settings.recommendedModels')}</Text>}
      {provider.models.map((m) => {
        const info = provider.catalog ? catalog?.models.find((c) => c.id === m.id) : undefined;
        return (
          <Pressable
            key={m.id}
            style={styles.option}
            onPress={() => setModel(m.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: model === m.id }}
          >
            <Radio selected={model === m.id} />
            <View style={styles.optionBody}>
              <Text style={styles.optionText}>{m.tag ? `${m.name} (${t(`model.${m.tag}`)})` : m.name}</Text>
              {info && <Text style={styles.detail}>{modelDetail(info)}</Text>}
            </View>
          </Pressable>
        );
      })}
      {provider.catalog && inCatalog && !provider.models.some((m) => m.id === model) && !browsing && (
        <Pressable style={styles.option} accessibilityRole="radio" accessibilityState={{ selected: true }}>
          <Radio selected />
          <View style={styles.optionBody}>
            <Text style={styles.optionText}>{inCatalog.name}</Text>
            <Text style={styles.detail}>{modelDetail(inCatalog)}</Text>
          </View>
        </Pressable>
      )}
      {provider.catalog && (
        <Pressable onPress={() => setBrowsing((b) => !b)} style={styles.browse} accessibilityRole="button">
          <Text style={styles.link}>{browsing ? t('settings.hideAllModels') : t('settings.allModels')}</Text>
        </Pressable>
      )}
      {provider.catalog && browsing && (
        <ModelCatalogPicker apiKey={value.apiKeys[value.provider]} selected={model} onSelect={setModel} />
      )}
      <Pressable style={styles.option} onPress={() => !isCustomModel && setModel('')} accessibilityRole="radio">
        <Radio selected={isCustomModel} />
        <Text style={styles.optionText}>{t('settings.customModel')}</Text>
      </Pressable>
      {isCustomModel && (
        <TextInput
          placeholderTextColor={palette.textSecondary}
          style={styles.input}
          value={model}
          onChangeText={setModel}
          placeholder={t('settings.customModelPlaceholder', { model: provider.defaultModel })}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
      )}
      {inCatalog && !inCatalog.images && <Text style={styles.hint}>{t('settings.noImagesHint')}</Text>}
      <Text style={styles.hint}>{t('settings.modelHint')}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { gap: 8 },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  link: { color: c.tintText, fontWeight: '600' },
  // Wraps onto a second row when the providers don't fit side by side.
  segment: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: c.sunken, borderRadius: 10, padding: 3 },
  segmentButton: {
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentSelected: { backgroundColor: c.surface },
  segmentText: { fontSize: 14, color: c.textSecondary },
  segmentTextSelected: { color: c.text, fontWeight: '700' },
  keyDot: { fontSize: 8, color: '#3a9b5c' },
  input: {
    color: c.text,
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  optionText: { color: c.text, fontSize: 15 },
  optionBody: { flex: 1 },
  detail: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  subLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  browse: { paddingVertical: 8 },
}));
