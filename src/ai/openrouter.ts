import { createChatCompletionsCall } from './chatCompletions';
import { OPENROUTER_RECOMMENDED } from './openrouterCatalog';
import type { Provider } from './types';

const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * App attribution (https://openrouter.ai/docs/app-attribution): the app's public name and repository, the same
 * for every user; nothing about the user.
 */
const ATTRIBUTION = {
  'HTTP-Referer': 'https://github.com/sonsuzdongu/qutai',
  'X-OpenRouter-Title': 'Qutai',
  // The older name of the title header, still read by OpenRouter.
  'X-Title': 'Qutai',
};

/** Below every current tool-calling model's limit; lowered to the model's own limit when the catalogue gives it. */
const MAX_OUTPUT = 16384;

export const openrouter: Provider = {
  id: 'openrouter',
  label: 'OpenRouter',
  keyPlaceholder: 'sk-or-...',
  keyUrl: 'https://openrouter.ai/settings/keys',
  models: OPENROUTER_RECOMMENDED,
  defaultModel: OPENROUTER_RECOMMENDED[0].id,
  catalog: true,
  // OpenRouter's web search runs on every request as a plugin (billed per search, so per agent step), and its
  // newer server tool is documented for the Responses API only: off here; the assistant searches in the browser.
  webSearch: false,
  call: createChatCompletionsCall({
    id: 'openrouter',
    endpoint: (req) => ({ url: CHAT_URL, headers: { authorization: `Bearer ${req.apiKey}`, ...ATTRIBUTION } }),
    maxTokens: (req) => ({
      field: 'max_completion_tokens',
      value: Math.min(MAX_OUTPUT, req.maxOutputTokens ?? MAX_OUTPUT),
    }),
  }),
};
