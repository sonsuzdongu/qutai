import { normalizeBaseUrl } from './customEndpoint';

/**
 * A Cloudflare API address pasted as the custom endpoint (`https://api.cloudflare.com/client/v4/accounts/<id>/…`,
 * Workers AI's REST API), and the AI Gateway address it can be converted to. Pure, tested in
 * scripts/custom-endpoint-tests.
 *
 * Cloudflare's documentation (read 16 Nov 2026):
 * - AI Gateway's OpenAI-compatible endpoint is `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat`
 *   plus `/chat/completions`; the model is `{provider}/{model}` (`anthropic/…`, `openai/…`, `google-ai-studio/…`), the
 *   provider's key goes in Authorization, and an authenticated gateway also needs `cf-aig-authorization`
 *   (https://developers.cloudflare.com/ai-gateway/usage/chat-completion/,
 *   https://developers.cloudflare.com/ai-gateway/configuration/authentication/).
 * - The gateway `default` is created automatically on the first authenticated request
 *   (https://developers.cloudflare.com/ai-gateway/get-started/).
 * - Workers AI's own OpenAI-compatible endpoint is `…/accounts/{account_id}/ai/v1` (Cloudflare API token as the key),
 *   so an address ending in `/ai/v1` is not called incompatible
 *   (https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/).
 */
export type CloudflareAddress = {
  accountId: string;
  /** The address is Workers AI's OpenAI-compatible one (`…/ai/v1`); otherwise another Cloudflare API path. */
  openAiCompatible: boolean;
  /** The AI Gateway OpenAI-compatible base URL for the same account, gateway `default`. */
  gatewayUrl: string;
};

const ACCOUNT_PATH = /^\/client\/v4\/accounts\/([0-9a-f]{32})(\/.*)?$/i;

/**
 * The Cloudflare API address in `input`, or null. Exact: host `api.cloudflare.com` over https with no port, and the
 * path `/client/v4/accounts/<32 hex digits>` (and anything after it). Read through the endpoint normaliser, so an
 * address it refuses (a user name or password, a query or fragment, plain http) never matches, and
 * `gateway.ai.cloudflare.com` or another host never does.
 */
export function detectCloudflareApi(input: string): CloudflareAddress | null {
  const url = normalizeBaseUrl(input, { allowCleartext: false });
  if (!url.ok) return null;
  const prefix = 'https://api.cloudflare.com/';
  if (!url.url.startsWith(prefix)) return null;
  const m = ACCOUNT_PATH.exec(url.url.slice(prefix.length - 1));
  if (!m) return null;
  const accountId = m[1].toLowerCase();
  return {
    accountId,
    openAiCompatible: /^\/ai\/v1$/i.test(m[2] ?? ''),
    gatewayUrl: `https://gateway.ai.cloudflare.com/v1/${accountId}/default/compat`,
  };
}
