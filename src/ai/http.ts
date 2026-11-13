import { waitForForeground } from '../utils/foreground';
import { t } from '../i18n';
import { sleep } from '../utils/sleep';

const MAX_RETRIES = 3;

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
    try {
      const err = await res.json();
      // Anthropic and OpenAI use { error: { message } }; Gemini may also return an array.
      const e = Array.isArray(err) ? err[0]?.error : err?.error;
      detail = e?.message ?? '';
    } catch {}
    throw new Error(`${t('error.api', { status: res.status })}${detail ? `: ${detail}` : ''}`);
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

export type SseEvent = { event: string; data: unknown };

/** Splits server-sent events out of a text buffer; returns the parsed events and the unfinished rest. */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    const text = data.join('\n');
    if (!text || text === '[DONE]') continue;
    try {
      events.push({ event, data: JSON.parse(text) });
    } catch {
      // Not JSON (comments, keep-alives): ignored.
    }
  }
  return { events, rest };
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
    const decoder = new TextDecoder();
    let buffer = '';
    let received = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSse(buffer);
        buffer = parsed.rest;
        for (const event of parsed.events) {
          received = true;
          onEvent(event);
        }
      }
      buffer += decoder.decode();
      parseSse(buffer + '\n\n').events.forEach(onEvent);
      return;
    } catch (e) {
      if (signal.aborted || received || attempt >= MAX_RETRIES) throw e;
      await waitForForeground(signal);
      await sleep(1000 * 2 ** attempt);
    }
  }
}
