import { useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { normalizeBaseUrl } from '../ai/customEndpoint';
import { getProvider, isConfigured, PROVIDER_ORDER } from '../ai/providers';
import type { ProviderId } from '../ai/types';
import { t } from '../i18n';
import type { Settings } from '../storage/settings';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { ALLOW_CLEARTEXT } from '../ai/custom';
import { cleanCustomHeaders } from '../ai/customHeaders';
import { baseUrlProblem, CustomEndpointFields, customHeadersProblem } from './CustomEndpointFields';
import { ModelCatalogPicker, modelDetail, useCatalog } from './ModelCatalogPicker';
import { creditsConsented, useCreditsConsent } from '../credits';
import { useAccountState } from '../account';
import { askCreditsDisclosure } from './CreditsDisclosure';
import { CreditsFields } from './CreditsFields';
import { dialog } from './Dialog';
import { WholeWordsText } from './WholeWordsText';

export type AiChoice = Pick<
  Settings,
  'provider' | 'apiKeys' | 'models' | 'customBaseUrl' | 'customImages' | 'customHeaders'
>;

/**
 * Trims keys, fills empty model ids with the provider's default and normalises the custom endpoint's address,
 * before saving. An address that isn't valid is dropped (the fields show why; Settings won't save it).
 */
export function cleanAiChoice<T extends AiChoice>(value: T): T {
  const apiKeys = { ...value.apiKeys };
  const models = { ...value.models };
  PROVIDER_ORDER.forEach((id) => {
    apiKeys[id] = apiKeys[id].trim();
    models[id] = models[id].trim() || getProvider(id).defaultModel;
  });
  const url = normalizeBaseUrl(value.customBaseUrl, { allowCleartext: ALLOW_CLEARTEXT });
  return {
    ...value,
    apiKeys,
    models,
    customBaseUrl: url.ok ? url.url : '',
    customHeaders: cleanCustomHeaders(value.customHeaders),
  };
}

/**
 * Why the choice can't be saved as typed (an address for the custom endpoint that isn't valid, or an extra header
 * that breaks the rules), or null.
 */
export function aiChoiceProblem(value: AiChoice): string | null {
  return (
    (value.customBaseUrl.trim() ? baseUrlProblem(value.customBaseUrl) : null) ??
    customHeadersProblem(value.customHeaders, value.apiKeys.custom)
  );
}

/**
 * AI provider, its API key and the model: shared by Settings and the first-run setup. Pro mode: Qutai Credits can be
 * picked only while signed in (`onSignIn` opens the account page; without it the user is told where to sign in), and
 * setup's own-key path leaves it out (`hideCredits`: setup has its own Qutai path).
 */
export function AiProviderFields({
  value,
  onChange,
  hideCredits = false,
  onSignIn,
}: {
  value: AiChoice;
  onChange: (next: AiChoice) => void;
  hideCredits?: boolean;
  onSignIn?: () => void;
}) {
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
  // Followed so the dot on "Qutai Credits" appears as soon as it can be used.
  useCreditsConsent();
  const account = useAccountState();
  /** Qutai Credits is picked only signed in, and after the disclosure was accepted (asked the first time). */
  const pick = async (id: ProviderId) => {
    if (id === 'qutai' && id !== value.provider && account.status !== 'signedIn') {
      const answer = await dialog.show({
        title: t('credits.signInFirstTitle'),
        message: t(onSignIn ? 'credits.signInFirstBody' : 'credits.error.notSignedIn'),
        buttons: onSignIn
          ? [{ text: t('common.cancel'), style: 'cancel' }, { text: t('credits.signIn'), primary: true }]
          : [{ text: t('common.ok'), primary: true }],
      });
      if (onSignIn && answer.button === 1) onSignIn();
      return;
    }
    if (id === 'qutai' && !creditsConsented() && !(await askCreditsDisclosure())) return;
    onChange({ ...value, provider: id });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{t('settings.provider')}</Text>
      <View style={styles.segment}>
        {PROVIDER_ORDER.filter((id) => !(hideCredits && id === 'qutai')).map((id: ProviderId) => {
          const selected = id === value.provider;
          return (
            <Pressable
              key={id}
              onPress={() => void pick(id)}
              style={[styles.segmentButton, selected && styles.segmentSelected]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <WholeWordsText style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {getProvider(id).shortLabel ?? getProvider(id).label.replace('Google ', '')}
              </WholeWordsText>
              {isConfigured(cleanAiChoice(value), id) && <View style={styles.keyDot} />}
            </Pressable>
          );
        })}
      </View>

      {value.provider === 'qutai' ? (
        <CreditsFields onSignIn={onSignIn} />
      ) : provider.needsEndpoint ? (
        <CustomEndpointFields value={value} onChange={(next) => onChange({ ...value, ...next })} />
      ) : (
        <>
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
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { gap: 8 },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  link: { color: c.tintText, fontWeight: '600' },
  // Wraps onto a second row when the providers don't fit side by side.
  segment: { ...common(c).segment, flexWrap: 'wrap' },
  segmentButton: {
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radii.inner,
  },
  segmentSelected: common(c).segmentSelected,
  segmentText: common(c).segmentText,
  segmentTextSelected: common(c).segmentTextSelected,
  keyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3a9b5c' },
  input: common(c).input,
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  optionText: { color: c.text, fontSize: 15 },
  optionBody: { flex: 1 },
  detail: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  subLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  browse: { paddingVertical: 8 },
}));
