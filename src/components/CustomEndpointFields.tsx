import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ALLOW_CLEARTEXT } from '../ai/custom';
import { detectCloudflareApi } from '../ai/cloudflare';
import { BaseUrlError, normalizeBaseUrl } from '../ai/customEndpoint';
import { cleanCustomHeaders, CustomHeader, HeaderError, headerProblems, MAX_CUSTOM_HEADERS } from '../ai/customHeaders';
import { Check, fetchCustomModels, testCustomEndpoint } from '../ai/customTest';
import type { MessageKey } from '../i18n';
import { t } from '../i18n';
import type { Settings } from '../storage/settings';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { ThemedSwitch } from '../ui/ThemedSwitch';

/** Colours of the connection test's marks: passed, and passed with a warning. */
const MARK_OK = '#3a9b5c';
const MARK_WARN = '#b26a00';

type Value = Pick<Settings, 'apiKeys' | 'models' | 'customBaseUrl' | 'customImages' | 'customHeaders'>;

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

const HEADER_ERRORS: Record<HeaderError, MessageKey> = {
  nameEmpty: 'custom.headerNameEmpty',
  nameChars: 'custom.headerNameChars',
  nameLong: 'custom.headerNameLong',
  reserved: 'custom.headerReserved',
  authWithKey: 'custom.headerAuthWithKey',
  duplicate: 'custom.headerDuplicate',
  valueEmpty: 'custom.headerValueEmpty',
  valueLineBreak: 'custom.headerValueLineBreak',
  valueChars: 'custom.headerValueChars',
  valueLong: 'custom.headerValueLong',
};

/** The first problem with the extra headers, as a message naming the header (never its value), or null. */
export function customHeadersProblem(headers: CustomHeader[], apiKey: string): string | null {
  const problems = headerProblems(headers, apiKey);
  const i = problems.findIndex(Boolean);
  return i < 0 ? null : t(HEADER_ERRORS[problems[i]!], { name: headers[i].name.trim() });
}

const MAX_LISTED = 50;

/** The text of a test line: its key and state, or for a failed chat request, why it failed. */
function checkLabel(c: Check): MessageKey {
  if (c.key === 'chat') return `custom.check.chat.${c.reason ?? 'badRequest'}`;
  if (c.key === 'address') return 'custom.check.address.fail';
  if (c.state === 'skip') return c.key === 'auth' || c.key === 'model' ? `custom.check.${c.key}.skip` : `custom.check.${c.key}.warn`;
  return `custom.check.${c.key}.${c.state}`;
}

const CHECK_A11Y: Record<Check['state'], MessageKey> = {
  ok: 'custom.checkPassed',
  warn: 'custom.checkWarning',
  fail: 'custom.checkFailed',
  skip: 'custom.checkSkipped',
};

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
  // The Cloudflare notice: the address the user chose to keep, and the address changed to with the model the old
  // one named (for the follow-up hint).
  const [keptCloudflare, setKeptCloudflare] = useState('');
  const [fixedCloudflare, setFixedCloudflare] = useState<{ url: string; model?: string } | null>(null);
  const cloudflare = detectCloudflareApi(value.customBaseUrl);
  const warnCloudflare = !!cloudflare && !cloudflare.chatReady && url.ok && keptCloudflare !== url.url;
  const fixedShown = !!fixedCloudflare && value.customBaseUrl.trim() === fixedCloudflare.url;
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const set = (patch: Partial<Value>) => onChange({ ...value, ...patch });
  const headers = value.customHeaders;
  const headerErrors = headerProblems(headers, apiKey);
  // Blank rows dropped; a row with a problem is left out when sending (customHeaders.ts).
  const sentHeaders = cleanCustomHeaders(headers);
  const setHeader = (i: number, patch: Partial<CustomHeader>) =>
    set({ customHeaders: headers.map((h, j) => (j === i ? { ...h, ...patch } : h)) });

  const fetchModels = async () => {
    if (!url.ok || busy) return;
    controller.current = new AbortController();
    setBusy('models');
    setModelsError('');
    try {
      const result = await fetchCustomModels(url.url, apiKey, sentHeaders, controller.current.signal);
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
      const result = await testCustomEndpoint(
        url.url,
        apiKey,
        sentHeaders,
        model.trim(),
        controller.current.signal,
        setChecks,
      );
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
      {!!cloudflare && cloudflare.chatReady && !fixedShown && (
        <Text style={styles.hint}>{t('custom.cfChatInfo')}</Text>
      )}
      {warnCloudflare && cloudflare && (
        <View style={styles.notice}>
          <View style={styles.noticeRow}>
            <Icon name="insecure" size={18} color={MARK_WARN} style={styles.checkMark} />
            <View style={styles.flex}>
              <Text style={styles.optionText}>{t('custom.cfWrongPath')}</Text>
              <Text style={styles.hint} selectable>
                {cloudflare.chatUrl}
              </Text>
              {!!cloudflare.model && (
                <Text style={styles.hint}>{t('custom.cfWrongPathModel', { model: cloudflare.model })}</Text>
              )}
            </View>
          </View>
          <View style={styles.noticeActions}>
            <Pressable
              onPress={() => {
                setFixedCloudflare({ url: cloudflare.chatUrl, model: cloudflare.model });
                setChecks(null);
                set({ customBaseUrl: cloudflare.chatUrl });
              }}
              style={styles.textButton}
              accessibilityRole="button"
              accessibilityLabel={t('custom.cfFixA11y', { url: cloudflare.chatUrl })}
            >
              <Text style={styles.link}>{t('custom.cfFix')}</Text>
            </Pressable>
            <Pressable
              onPress={() => url.ok && setKeptCloudflare(url.url)}
              style={styles.textButton}
              accessibilityRole="button"
              accessibilityLabel={t('custom.cfKeepA11y')}
            >
              <Text style={styles.link}>{t('custom.cfKeep')}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {fixedShown && fixedCloudflare && (
        <View style={styles.notice}>
          <Text style={styles.optionText}>{t('custom.cfFixed')}</Text>
          {!!fixedCloudflare.model && (
            <Text style={styles.hint}>{t('custom.cfFixedModel', { model: fixedCloudflare.model })}</Text>
          )}
        </View>
      )}
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

      <Text style={styles.label}>{t('custom.headers')}</Text>
      <Text style={styles.hint}>{t('custom.headersHint')}</Text>
      {headers.map((h, i) => (
        <View key={i} style={styles.headerRow}>
          <View style={styles.row}>
            <TextInput
              placeholderTextColor={palette.textSecondary}
              style={[styles.input, styles.flex]}
              value={h.name}
              onChangeText={(name) => setHeader(i, { name })}
              placeholder={t('custom.headerName')}
              accessibilityLabel={t('custom.headerName')}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => set({ customHeaders: headers.filter((_, j) => j !== i) })}
              style={styles.textButton}
              accessibilityRole="button"
              accessibilityLabel={t('custom.headerRemove', { name: h.name.trim() })}
            >
              <Text style={styles.link}>{t('custom.headerRemoveShort')}</Text>
            </Pressable>
          </View>
          <TextInput
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            value={h.value}
            onChangeText={(v) => setHeader(i, { value: v })}
            placeholder={t('custom.headerValue')}
            accessibilityLabel={t('custom.headerValue')}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          {!!headerErrors[i] && (
            <Text style={styles.error}>{t(HEADER_ERRORS[headerErrors[i]!], { name: h.name.trim() })}</Text>
          )}
        </View>
      ))}
      {headers.length < MAX_CUSTOM_HEADERS && (
        <Pressable
          onPress={() => set({ customHeaders: [...headers, { name: '', value: '' }] })}
          style={styles.textButton}
          accessibilityRole="button"
        >
          <Text style={styles.link}>{t('custom.headerAdd')}</Text>
        </Pressable>
      )}

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
        <View
          key={c.key}
          style={styles.check}
          accessible
          accessibilityLabel={`${t(CHECK_A11Y[c.state])}: ${t(checkLabel(c))}${c.detail ? `. ${c.detail}` : ''}`}
        >
          <Icon
            name={c.state === 'ok' ? 'check' : c.state === 'fail' ? 'close' : c.state === 'skip' ? 'info' : 'insecure'}
            size={18}
            color={
              c.state === 'ok'
                ? MARK_OK
                : c.state === 'fail'
                  ? palette.danger
                  : c.state === 'skip'
                    ? palette.textSecondary
                    : MARK_WARN
            }
            style={styles.checkMark}
          />
          <View style={styles.flex}>
            <Text style={styles.optionText}>{t(checkLabel(c))}</Text>
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
  headerRow: { gap: 6, marginTop: 4 },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  privacy: { fontSize: 13, color: c.text, lineHeight: 18, marginTop: 8 },
  warn: { fontSize: 13, color: c.danger, lineHeight: 18 },
  error: { fontSize: 13, color: c.danger, lineHeight: 18 },
  link: { color: c.tintText, fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.4 },
  textButton: { paddingHorizontal: 4, paddingVertical: 10 },
  spinner: { alignSelf: 'flex-start' },
  input: common(c).input,
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  optionText: { color: c.text, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: {
    marginTop: 12,
    height: 44,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  buttonText: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  notice: {
    gap: 4,
    padding: 12,
    borderRadius: radii.control,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  noticeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noticeActions: { flexDirection: 'row', gap: 16, justifyContent: 'flex-end' },
  checkMark: { marginTop: 1 },
}));
