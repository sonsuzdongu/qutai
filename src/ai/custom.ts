import { Platform } from 'react-native';
import { t } from '../i18n';
import { createChatCompletionsCall } from './chatCompletions';
import type { Provider } from './types';

/**
 * Plain http is possible only where the platform lets the app make cleartext requests to a local address: iOS,
 * through App Transport Security's local-networking exception. Android release builds allow no cleartext, and its
 * network security config can't name private address ranges, so Android is https-only (docs/permissions.md).
 */
export const ALLOW_CLEARTEXT = Platform.OS === 'ios';

/** The key is optional (local servers often need none); only sent when there is one. */
export const customHeaders = (apiKey: string): Record<string, string> =>
  apiKey.trim() ? { authorization: `Bearer ${apiKey.trim()}` } : {};

/**
 * A self-hosted or company server that speaks OpenAI's Chat Completions (Ollama, LM Studio, vLLM, a gateway).
 * The base URL is a setting (`customBaseUrl`, checked by customEndpoint.ts) and reaches the adapter as
 * `req.endpoint`. No output limit is sent: servers differ in which field they read, and their default is the
 * model's own.
 */
export const custom: Provider = {
  id: 'custom',
  get label() {
    return t('provider.custom');
  },
  get shortLabel() {
    return t('provider.customShort');
  },
  keyPlaceholder: '',
  keyUrl: '',
  models: [],
  defaultModel: '',
  needsEndpoint: true,
  webSearch: false,
  call: createChatCompletionsCall({
    id: 'custom',
    endpoint: (req) => {
      if (!req.endpoint) throw new Error(t('error.noEndpoint'));
      return { url: `${req.endpoint}/chat/completions`, headers: customHeaders(req.apiKey) };
    },
    maxTokens: () => undefined,
  }),
};
