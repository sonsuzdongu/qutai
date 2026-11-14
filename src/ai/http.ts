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
 * POSTs JSON with retries for rate limits, overloads and requests cut off
 * when the OS suspended the app. Resolves with a successful response.
 */
async function postWithRetry(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
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

    let detail = '';
    let code: string | undefined;
    try {
      const err = await res.json();
      // Anthropic and OpenAI use { error: { message } }; Gemini may also return an array.
      const e = Array.isArray(err) ? err[0]?.error : err?.error;
      detail = e?.message ?? '';
      if (typeof e?.code === 'string') code = e.code;
    } catch {}
    throw new ApiError(`${t('error.api', { status: res.status })}${detail ? `: ${detail}` : ''}`, res.status, code);
  }
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
