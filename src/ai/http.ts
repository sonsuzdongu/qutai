import { waitForForeground } from '../utils/foreground';
import { sleep } from '../utils/sleep';

const MAX_RETRIES = 3;

/**
 * POSTs JSON with retries for rate limits, overloads and requests cut off
 * when the OS suspended the app.
 */
export async function postJson<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
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

    if (res.ok) return (await res.json()) as T;

    const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }

    let detail = '';
    try {
      const err = await res.json();
      // Anthropic and OpenAI use { error: { message } }; Gemini may also return an array.
      const e = Array.isArray(err) ? err[0]?.error : err?.error;
      detail = e?.message ?? '';
    } catch {}
    throw new Error(`API hatası ${res.status}${detail ? `: ${detail}` : ''}`);
  }
}
