import { normalizeBaseUrl } from './customEndpoint';

/**
 * A Cloudflare API address pasted as the custom endpoint (`https://api.cloudflare.com/client/v4/accounts/<id>/…`),
 * and whether it is the chat address Qutai needs. Pure, tested in scripts/custom-endpoint-tests.
 *
 * Cloudflare's documentation (read 16 Nov 2026):
 * - The OpenAI-compatible chat endpoint is `…/accounts/{account_id}/ai/v1/chat/completions`, so the base URL is
 *   `…/accounts/{account_id}/ai/v1`; the key is a Cloudflare API token with Account › Workers AI › Read
 *   (https://developers.cloudflare.com/ai-gateway/usage/rest-api/,
 *   https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/).
 * - Models there: Workers AI's as `@cf/author/model` (these also need the `cf-aig-gateway-id` header), other
 *   providers' as `author/model` (`anthropic/…`, `openai/…`, `google/…`), billed through Unified Billing or a key
 *   stored in AI Gateway (https://developers.cloudflare.com/ai-gateway/features/unified-billing/).
 * - Other paths under the account (`/ai/run/<model>`, `/ai/v1/responses`, `/ai/v1/messages`, `/ai/v1/embeddings`)
 *   are other APIs: Qutai's requests to `<base>/chat/completions` find no route there.
 * - AI Gateway's `/compat` endpoint is deprecated for single-model chat; a gateway address is a different host and
 *   never matches here.
 */
export type CloudflareAddress = {
  accountId: string;
  /** The address is already the OpenAI-compatible chat base (`…/ai/v1`). */
  chatReady: boolean;
  /** The chat base URL for the same account. */
  chatUrl: string;
  /** A Workers AI model named in a pasted `…/ai/run/<model>` path, for the hint (never filled in by itself). */
  model?: string;
};

const PREFIX = 'https://api.cloudflare.com';
const ACCOUNT_PATH = /^\/client\/v4\/accounts\/([0-9a-f]{32})(\/.*)?$/i;
const RUN_MODEL = /^\/ai\/(?:v1\/)?run\/(.+)$/i;
/** A Workers AI model id: `@cf/…` or `@hf/…`, plain characters only. */
const MODEL_ID = /^@(cf|hf)\/[a-z0-9._-]+(\/[a-z0-9._:-]+)*$/i;

function runModel(rest: string): string | undefined {
  const m = RUN_MODEL.exec(rest);
  if (!m) return undefined;
  let id = m[1];
  try {
    id = decodeURIComponent(id);
  } catch {
    return undefined;
  }
  return MODEL_ID.test(id) ? id : undefined;
}

/**
 * The Cloudflare API address in `input`, or null. Exact: host `api.cloudflare.com` over https with no port, and the
 * path `/client/v4/accounts/<32 hex digits>` (and anything after it). Read through the endpoint normaliser, so an
 * address it refuses (a user name or password, a query or fragment, plain http) never matches, a pasted
 * `/chat/completions` is already removed, and `gateway.ai.cloudflare.com` or another host never matches.
 */
export function detectCloudflareApi(input: string): CloudflareAddress | null {
  const url = normalizeBaseUrl(input, { allowCleartext: false });
  if (!url.ok || !url.url.startsWith(`${PREFIX}/`)) return null;
  const m = ACCOUNT_PATH.exec(url.url.slice(PREFIX.length));
  if (!m) return null;
  const accountId = m[1].toLowerCase();
  const rest = m[2] ?? '';
  const model = runModel(rest);
  return {
    accountId,
    chatReady: /^\/ai\/v1$/i.test(rest),
    chatUrl: `${PREFIX}/client/v4/accounts/${accountId}/ai/v1`,
    ...(model ? { model } : {}),
  };
}
