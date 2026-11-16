import { Platform } from 'react-native';
import { waitForForeground } from '../utils/foreground';
import { t } from '../i18n';
import { sleep } from '../utils/sleep';
import { classifyFailure, type FailureKind, serverMessage } from './serverError';
import { createSseDecoder, type SseEvent } from './sse';

const MAX_RETRIES = 3;

/**
 * The provider answered with an error status; `code` is its machine-readable error code, when it gave one, and `kind`
 * what the failure means (serverError.ts), e.g. 'path' when nothing at the address answers Chat Completions.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly kind?: FailureKind,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The app's own requests to AI providers are https-only. Android release builds allow cleartext for the pages the user
 * opens over http (plugins/withCleartextBrowsing.js), so this is where http is refused for them; iOS allows http to a
 * local custom endpoint (App Transport Security's local-networking exception, src/ai/custom.ts).
 */
function assertSecure(url: string) {
  if (/^https:\/\//i.test(url) || (Platform.OS === 'ios' && /^http:\/\//i.test(url))) return;
  throw new Error(t('custom.httpsOnlyAndroid'));
}

/**
 * POSTs JSON with retries for rate limits, overloads and requests cut off
 * when the OS suspended the app. Resolves with a successful response.
 */
async function postWithRetry(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
  assertSecure(url);
  const payload = JSON.stringify(body);

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: payload,
        signal,
      });
    } catch (e) {
      if (signal.aborted || attempt >= MAX_RETRIES) throw e;
      await waitForForeground(signal);
      await sleep(1000 * 2 ** attempt);
      continue;
    }

    if (res.ok) return res;

    const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }

    throw await toApiError(res);
  }
}

/**
 * An error response to an ApiError with the provider's own short message, when it gave one (in any of the shapes
 * serverError.ts reads, credentials removed), so the chat shows "API error 400: No route for that URI" rather than
 * the status alone.
 */
async function toApiError(res: Response): Promise<ApiError> {
  let text = '';
  try {
    text = await res.text();
  } catch {}
  let err: unknown;
  try {
    err = JSON.parse(text);
  } catch {}
  // Anthropic, OpenAI and OpenRouter use { error: { message, code } }; Gemini may also return an array.
  const e = (Array.isArray(err) ? err[0]?.error : (err as { error?: unknown } | undefined)?.error) as
    | { code?: unknown }
    | undefined;
  const code = typeof e?.code === 'string' ? e.code : undefined;
  const detail = serverMessage(text, err);
  return new ApiError(
    `${t('error.api', { status: res.status })}${detail ? `: ${detail}` : ''}`,
    res.status,
    code,
    classifyFailure(res.status, text, err),
  );
}

/** A GET for JSON (model lists), without retries: the user asked for it and can ask again. */
export async function getJson<T>(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<T> {
  assertSecure(url);
  const res = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

export async function postJson<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
  const res = await postWithRetry(url, headers, body, signal);
  return (await res.json()) as T;
}

/**
 * POSTs a streaming request and hands each server-sent event to onEvent as it arrives.
 * Retries like postJson, but only until the first event: after that, a retry would
 * repeat text the user has already seen.
 */
export async function postSse(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const res = await postWithRetry(url, { accept: 'text/event-stream', ...headers }, body, signal);
    if (!res.body) throw new Error('Streaming is not supported here');
    const reader = res.body.getReader();
    const decoder = createSseDecoder();
    let received = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of decoder.push(value)) {
          received = true;
          onEvent(event);
        }
      }
      decoder.end().forEach(onEvent);
      return;
    } catch (e) {
      if (signal.aborted || received || attempt >= MAX_RETRIES) throw e;
      await waitForForeground(signal);
      await sleep(1000 * 2 ** attempt);
    }
  }
}
