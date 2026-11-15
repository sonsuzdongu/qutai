import { t } from '../i18n';
import { createChatAccumulator, fromChatResponse } from './chatWire';
import { customHeaders } from './custom';
import type { CustomHeader } from './customHeaders';
import { createSseDecoder } from './sse';

const TIMEOUT_MS = 30000;
/** A 1×1 PNG, for asking whether the server takes images. */
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export type CheckState = 'ok' | 'warn' | 'fail' | 'skip';
export type Check = {
  key: 'reach' | 'auth' | 'model' | 'tools' | 'stream' | 'images';
  state: CheckState;
  detail?: string;
};

/** status 0: no answer (error says why). */
type Answer = { status: number; json?: unknown; text: string; error?: string };

/** One request with a timeout; never throws (except when the caller stops it). */
async function send(
  url: string,
  init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: unknown },
  signal: AbortSignal,
  readStream?: (bytes: Uint8Array) => void,
): Promise<Answer> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const stop = () => timeout.abort();
  signal.addEventListener('abort', stop);
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: timeout.signal,
    });
    if (readStream && res.ok && res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        readStream(value);
      }
      return { status: res.status, text: '' };
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text };
  } catch (e) {
    if (signal.aborted) throw e;
    return {
      status: 0,
      text: '',
      error: timeout.signal.aborted ? t('custom.timeout') : e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', stop);
  }
}

/** The server's own error message, shortened. */
function errorText(a: Answer): string {
  if (a.status === 0) return a.error ?? '';
  const e = (a.json as { error?: unknown } | undefined)?.error;
  const message =
    typeof e === 'string'
      ? e
      : typeof (e as { message?: unknown })?.message === 'string'
        ? (e as { message: string }).message
        : a.text;
  return `${a.status}${message ? `: ${message.replace(/\s+/g, ' ').slice(0, 200)}` : ''}`;
}

/** Model ids from `GET /models`, when the server implements it (null otherwise). */
export async function fetchCustomModels(
  baseUrl: string,
  apiKey: string,
  extraHeaders: CustomHeader[],
  signal: AbortSignal,
): Promise<string[] | { error: string }> {
  const a = await send(`${baseUrl}/models`, { method: 'GET', headers: customHeaders(apiKey, extraHeaders) }, signal);
  if (a.status !== 200) return { error: errorText(a) };
  const data = (a.json as { data?: unknown } | undefined)?.data;
  if (!Array.isArray(data)) return { error: t('custom.noModelList') };
  return [...new Set(data.map((m) => (m && typeof m.id === 'string' ? m.id : '')).filter(Boolean))].sort();
}

/**
 * "Test connection": a handful of tiny requests (fixed text, nothing of the user's), reported one line each so the
 * user knows what works before starting a task. The assistant needs tool calling; streaming and images are
 * optional (a failed stream is repeated without streaming; without images, screenshots become a tool error).
 */
export async function testCustomEndpoint(
  baseUrl: string,
  apiKey: string,
  extraHeaders: CustomHeader[],
  model: string,
  signal: AbortSignal,
  onProgress: (checks: Check[]) => void,
): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (c: Check) => {
    checks.push(c);
    onProgress([...checks]);
  };
  const headers = customHeaders(apiKey, extraHeaders);
  const chatUrl = `${baseUrl}/chat/completions`;

  // 1. Reachable and authenticated, and the model listed (when /models exists).
  const list = await send(`${baseUrl}/models`, { method: 'GET', headers }, signal);
  if (list.status === 0) {
    add({ key: 'reach', state: 'fail', detail: list.error });
    return checks;
  }
  add({ key: 'reach', state: 'ok' });
  if (list.status === 401 || list.status === 403) {
    add({ key: 'auth', state: 'fail', detail: errorText(list) });
    return checks;
  }
  const data = (list.json as { data?: unknown } | undefined)?.data;
  const ids =
    list.status === 200 && Array.isArray(data) ? data.map((m) => (m && typeof m.id === 'string' ? m.id : '')) : null;

  // 2. Tool calling, with one tool the model is asked to call.
  const tools = await send(
    chatUrl,
    {
      method: 'POST',
      headers,
      body: {
        model,
        messages: [{ role: 'user', content: 'Call the ping tool now.' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'ping',
              description: 'Checks the connection.',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        max_tokens: 200,
      },
    },
    signal,
  );
  if (tools.status === 401 || tools.status === 403) {
    add({ key: 'auth', state: 'fail', detail: errorText(tools) });
    return checks;
  }
  add({ key: 'auth', state: 'ok', detail: apiKey.trim() ? undefined : t('custom.noKeyNeeded') });
  const modelMissing =
    tools.status === 404 ||
    (tools.status >= 400 &&
      /model/i.test(errorText(tools)) &&
      /not.?found|does not exist|unknown/i.test(errorText(tools)));
  if (ids && !ids.includes(model))
    add({ key: 'model', state: modelMissing ? 'fail' : 'warn', detail: t('custom.modelNotListed') });
  else if (modelMissing) add({ key: 'model', state: 'fail', detail: errorText(tools) });
  else add({ key: 'model', state: 'ok' });
  if (modelMissing) return checks;
  if (tools.status !== 200) {
    add({ key: 'tools', state: 'fail', detail: errorText(tools) });
    return checks;
  }
  let called = false;
  try {
    called = !!fromChatResponse(tools.json).message.tool_calls?.some((c) => c.function.name === 'ping');
  } catch (e) {
    add({ key: 'tools', state: 'fail', detail: e instanceof Error ? e.message : String(e) });
    return checks;
  }
  add({ key: 'tools', state: called ? 'ok' : 'warn', detail: called ? undefined : t('custom.toolsNotCalled') });

  // 3. Streaming.
  const acc = createChatAccumulator();
  const decoder = createSseDecoder();
  let streamed = '';
  let streamError = '';
  const stream = await send(
    chatUrl,
    {
      method: 'POST',
      headers,
      body: { model, messages: [{ role: 'user', content: 'Reply with the word OK.' }], max_tokens: 20, stream: true },
    },
    signal,
    (bytes) => {
      try {
        for (const e of decoder.push(bytes)) streamed += acc.push(e.data);
      } catch (e) {
        streamError = e instanceof Error ? e.message : String(e);
      }
    },
  );
  let streamOk = stream.status === 200 && !streamError;
  if (streamOk) {
    try {
      decoder.end().forEach((e) => (streamed += acc.push(e.data)));
      acc.finish();
    } catch (e) {
      streamOk = false;
      streamError = e instanceof Error ? e.message : String(e);
    }
  }
  add(
    streamOk
      ? { key: 'stream', state: 'ok' }
      : {
          key: 'stream',
          state: 'warn',
          detail: `${streamError || errorText(stream)} ${t('custom.streamFallback')}`.trim(),
        },
  );

  // 4. Images.
  const image = await send(
    chatUrl,
    {
      method: 'POST',
      headers,
      body: {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What colour is this image? One word.' },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${TINY_PNG}` } },
            ],
          },
        ],
        max_tokens: 20,
      },
    },
    signal,
  );
  add(
    image.status === 200 ? { key: 'images', state: 'ok' } : { key: 'images', state: 'warn', detail: errorText(image) },
  );
  return checks;
}
