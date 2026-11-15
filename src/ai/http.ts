import { Platform } from 'react-native';
import { waitForForeground } from '../utils/foreground';
import { t } from '../i18n';
import { sleep } from '../utils/sleep';
import { createSseDecoder, SseEvent } from './sse';

const MAX_RETRIES = 3;

/** The provider answered with an error status; `code` is its machine-readable error code, when it gave one. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
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

/** An error response to an ApiError with the provider's own message, when it gave one. */
async function toApiError(res: Response): Promise<ApiError> {
  let detail = '';
  let code: string | undefined;
  try {
    const err = await res.json();
    // Anthropic, OpenAI and OpenRouter use { error: { message } }; Gemini may also return an array.
    const e = Array.isArray(err) ? err[0]?.error : err?.error;
    detail = typeof e === 'string' ? e : (e?.message ?? '');
    if (typeof e?.code === 'string') code = e.code;
  } catch {}
  return new ApiError(`${t('error.api', { status: res.status })}${detail ? `: ${detail}` : ''}`, res.status, code);
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
