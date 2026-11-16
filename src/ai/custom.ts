import { Platform } from 'react-native';
import { t } from '../i18n';
import { createChatCompletionsCall } from './chatCompletions';
import { buildCustomHeaders, type CustomHeader } from './customHeaders';
import type { Provider } from './types';

/**
 * Plain http for the custom endpoint only where the platform limits cleartext to local addresses: iOS, through App
 * Transport Security's local-networking exception. Android allows cleartext for the whole app (the browser has to open
 * the http pages the user chooses, plugins/withCleartextBrowsing.js, and a network security config can't name private
 * address ranges), so the app's own requests stay https-only there by this rule and src/ai/http.ts
 * (docs/permissions.md).
 */
export const ALLOW_CLEARTEXT = Platform.OS === 'ios';

/**
 * The key is optional (local servers often need none); only sent when there is one. Extra headers the user added
 * (customHeaders.ts) go on every request to the endpoint: chat, model list and "Test connection".
 */
export const customHeaders = (apiKey: string, extra?: CustomHeader[]): Record<string, string> =>
  buildCustomHeaders(apiKey, extra);

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
      return { url: `${req.endpoint}/chat/completions`, headers: customHeaders(req.apiKey, req.extraHeaders) };
    },
    maxTokens: () => undefined,
    streamUsage: true,
  }),
};
