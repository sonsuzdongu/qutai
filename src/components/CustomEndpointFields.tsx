import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ALLOW_CLEARTEXT } from '../ai/custom';
import { BaseUrlError, normalizeBaseUrl } from '../ai/customEndpoint';
import { Check, fetchCustomModels, testCustomEndpoint } from '../ai/customTest';
import type { MessageKey } from '../i18n';
import { t } from '../i18n';
import type { Settings } from '../storage/settings';
import { makeStyles, usePalette } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { ThemedSwitch } from '../ui/ThemedSwitch';

type Value = Pick<Settings, 'apiKeys' | 'models' | 'customBaseUrl' | 'customImages'>;

const ERRORS: Record<BaseUrlError, MessageKey> = {
  empty: 'custom.urlEmpty',
  invalid: 'custom.urlInvalid',
  scheme: 'custom.urlScheme',
  credentials: 'custom.urlCredentials',
  query: 'custom.urlQuery',
  cleartextPublic: 'custom.urlCleartextPublic',
  cleartextPlatform: 'custom.urlCleartextPlatform',
};

/** What is wrong with a typed base URL, or null. */
export function baseUrlProblem(url: string): string | null {
  const result = normalizeBaseUrl(url, { allowCleartext: ALLOW_CLEARTEXT });
  return result.ok ? null : t(ERRORS[result.error]);
}

const MAX_LISTED = 50;

/** The custom OpenAI-compatible endpoint: address, optional key, model, images, and "Test connection". */
export function CustomEndpointFields({ value, onChange }: { value: Value; onChange: (next: Value) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const url = normalizeBaseUrl(value.customBaseUrl, { allowCleartext: ALLOW_CLEARTEXT });
  const typed = value.customBaseUrl.trim().length > 0;
  const apiKey = value.apiKeys.custom;
  const model = value.models.custom;
  const [models, setModels] = useState<string[] | null>(null);
  const [modelsError, setModelsError] = useState('');
  const [busy, setBusy] = useState<'models' | 'test' | null>(null);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const set = (patch: Partial<Value>) => onChange({ ...value, ...patch });

  const fetchModels = async () => {
    if (!url.ok || busy) return;
    controller.current = new AbortController();
    setBusy('models');
    setModelsError('');
    try {
      const result = await fetchCustomModels(url.url, apiKey, controller.current.signal);
      if (Array.isArray(result)) setModels(result);
      else setModelsError(result.error);
    } catch {
      // Stopped.
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (!url.ok || !model.trim() || busy) return;
    controller.current = new AbortController();
    setBusy('test');
    setChecks([]);
    try {
      const result = await testCustomEndpoint(url.url, apiKey, model.trim(), controller.current.signal, setChecks);
      const images = result.find((c) => c.key === 'images');
      if (images) set({ customImages: images.state === 'ok' });
    } catch {
      setChecks(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.privacy}>{t('custom.privacy')}</Text>

      <Text style={styles.label}>{t('custom.baseUrl')}</Text>
      <TextInput
        placeholderTextColor={palette.textSecondary}
        style={styles.input}
        value={value.customBaseUrl}
        onChangeText={(customBaseUrl) => set({ customBaseUrl })}
        placeholder={ALLOW_CLEARTEXT ? 'http://192.168.1.20:11434/v1' : 'https://llm.example.com/v1'}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        textContentType="URL"
      />
      {typed && !url.ok && <Text style={styles.error}>{t(ERRORS[url.error])}</Text>}
      {url.ok && url.url !== value.customBaseUrl.trim() && (
        <Text style={styles.hint}>{t('custom.urlNormalised', { url: url.url })}</Text>
      )}
      {url.ok && url.cleartext && <Text style={styles.warn}>{t('custom.cleartextNote')}</Text>}
      {url.ok && url.missingV1 && <Text style={styles.hint}>{t('custom.v1Hint')}</Text>}
      {!ALLOW_CLEARTEXT && <Text style={styles.hint}>{t('custom.httpsOnlyAndroid')}</Text>}

      <Text style={styles.label}>{t('custom.apiKey')}</Text>
      <TextInput
        placeholderTextColor={palette.textSecondary}
        style={styles.input}
        value={apiKey}
        onChangeText={(key) => set({ apiKeys: { ...value.apiKeys, custom: key } })}
        placeholder={t('custom.apiKeyPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Text style={styles.hint}>{t('settings.keyHint')}</Text>

      <Text style={styles.label}>{t('settings.model')}</Text>
      <View style={styles.row}>
        <TextInput
          placeholderTextColor={palette.textSecondary}
          style={[styles.input, styles.flex]}
          value={model}
          onChangeText={(id) => set({ models: { ...value.models, custom: id } })}
          placeholder={t('custom.modelPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          onPress={fetchModels}
          disabled={!url.ok || !!busy}
          style={styles.textButton}
          accessibilityRole="button"
          accessibilityState={{ disabled: !url.ok || !!busy }}
        >
          <Text style={[styles.link, (!url.ok || !!busy) && styles.disabled]}>{t('custom.fetchModels')}</Text>
        </Pressable>
      </View>
      {busy === 'models' && <ActivityIndicator style={styles.spinner} />}
      {!!modelsError && <Text style={styles.error}>{t('custom.modelsFailed', { error: modelsError })}</Text>}
      {models && models.length === 0 && <Text style={styles.hint}>{t('custom.noModels')}</Text>}
      {models?.slice(0, MAX_LISTED).map((id) => (
        <Pressable
          key={id}
          style={styles.option}
          onPress={() => set({ models: { ...value.models, custom: id } })}
          accessibilityRole="radio"
          accessibilityState={{ selected: model === id }}
        >
          <Radio selected={model === id} />
          <Text style={[styles.optionText, styles.flex]}>{id}</Text>
        </Pressable>
      ))}
      <Text style={styles.hint}>{t('custom.toolsRequired')}</Text>

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>{t('custom.images')}</Text>
          <Text style={styles.hint}>{t('custom.imagesHint')}</Text>
        </View>
        <ThemedSwitch
          value={value.customImages}
          onValueChange={(customImages) => set({ customImages })}
          accessibilityLabel={t('custom.images')}
        />
      </View>

      <Pressable
        onPress={busy === 'test' ? () => controller.current?.abort() : test}
        disabled={busy === 'models' || (busy !== 'test' && (!url.ok || !model.trim()))}
        style={[
          styles.button,
          (busy === 'models' || (busy !== 'test' && (!url.ok || !model.trim()))) && styles.disabled,
        ]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{busy === 'test' ? t('common.stop') : t('custom.test')}</Text>
      </Pressable>
      {checks?.map((c) => (
        <View key={c.key} style={styles.check}>
          <Text
            style={[
              styles.checkMark,
              c.state === 'ok' ? styles.markOk : c.state === 'fail' ? styles.markFail : styles.markWarn,
            ]}
          >
            {c.state === 'ok' ? '✓' : c.state === 'fail' ? '✕' : '!'}
          </Text>
          <View style={styles.flex}>
            <Text style={styles.optionText}>{t(`custom.check.${c.key}.${c.state === 'skip' ? 'warn' : c.state}`)}</Text>
            {!!c.detail && (
              <Text style={styles.hint} selectable>
                {c.detail}
              </Text>
            )}
          </View>
        </View>
      ))}
      {busy === 'test' && <ActivityIndicator style={styles.spinner} />}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { gap: 8 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  privacy: { fontSize: 13, color: c.text, lineHeight: 18, marginTop: 8 },
  warn: { fontSize: 13, color: c.danger, lineHeight: 18 },
  error: { fontSize: 13, color: c.danger, lineHeight: 18 },
  link: { color: c.tintText, fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.4 },
  textButton: { paddingHorizontal: 4, paddingVertical: 10 },
  spinner: { alignSelf: 'flex-start' },
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
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  optionText: { color: c.text, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  buttonText: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkMark: { width: 18, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  markOk: { color: '#3a9b5c' },
  markWarn: { color: '#b26a00' },
  markFail: { color: c.danger },
}));
