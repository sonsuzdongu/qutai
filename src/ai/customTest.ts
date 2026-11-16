import { t } from '../i18n';
import { createChatAccumulator, fromChatResponse } from './chatWire';
import { customHeaders } from './custom';
import type { CustomHeader } from './customHeaders';
import { classifyFailure, type FailureKind, isHtml, serverMessage } from './serverError';
import { createSseDecoder } from './sse';
import { wellFormedJson } from '../utils/wellFormed';

const TIMEOUT_MS = 30000;
/** A 1×1 PNG, for asking whether the server takes images. */
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';


export type CheckState = 'ok' | 'warn' | 'fail' | 'skip';
/**
 * One line of the test. A line is 'ok' only for what a request actually showed; 'skip' is "not checked": no request
 * got far enough to tell. `reason` says which failure a 'chat' line is.
 */
export type Check = {
  key: 'reach' | 'auth' | 'model' | 'address' | 'chat' | 'tools' | 'stream' | 'images';
  state: CheckState;
  reason?: 'network' | 'rateLimit' | 'server' | 'badRequest' | 'badResponse';
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
      body: init.body ? wellFormedJson(init.body) : undefined,
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

/** The values sent that must never be shown back: the key and the extra headers' values. */
const secretsOf = (apiKey: string, extra: CustomHeader[]) => [apiKey, ...extra.map((h) => h.value)];

/** The status and the server's own short message (credentials removed), e.g. `400: No route for that URI`. */
function errorText(a: Answer, secrets: string[] = []): string {
  if (a.status === 0) return a.error ?? '';
  const message = serverMessage(a.text, a.json, secrets);
  return `${a.status}${message ? `: ${message}` : isHtml(a.text) ? `: ${t('custom.htmlPage')}` : ''}`;
}

/** Model ids from `GET /models`, when the server implements it (null otherwise). */
export async function fetchCustomModels(
  baseUrl: string,
  apiKey: string,
  extraHeaders: CustomHeader[],
  signal: AbortSignal,
): Promise<string[] | { error: string }> {
  const a = await send(`${baseUrl}/models`, { method: 'GET', headers: customHeaders(apiKey, extraHeaders) }, signal);
  if (a.status !== 200) return { error: errorText(a, secretsOf(apiKey, extraHeaders)) };
  const data = (a.json as { data?: unknown } | undefined)?.data;
  if (!Array.isArray(data)) return { error: t('custom.noModelList') };
  return [...new Set(data.map((m) => (m && typeof m.id === 'string' ? m.id : '')).filter(Boolean))].sort();
}

/** The failures after which the server evidently checked the key (an OpenAI-style server authenticates first). */
const PAST_AUTH: FailureKind[] = ['model', 'tools', 'badRequest'];

/**
 * "Test connection": a handful of tiny requests (fixed text, nothing of the user's), reported one line each so the
 * user knows what works before starting a task. The assistant needs tool calling; streaming and images are
 * optional (a failed stream is repeated without streaming; without images, screenshots become a tool error).
 *
 * Each line says only what was verified: "reachable" is any HTTP answer; the key counts as accepted after a 2xx (or
 * an OpenAI-style refusal of the request itself, which comes after authentication); the model counts as found when
 * the server lists it or answers with it. A chat request that fails for another reason gets its own line (wrong
 * address, rate limit, server error, refused request), and the key and model lines then say "not checked".
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
  const secrets = secretsOf(apiKey, extraHeaders);
  const err = (a: Answer) => errorText(a, secrets);
  const chatUrl = `${baseUrl}/chat/completions`;
  const noKeyDetail = apiKey.trim() ? undefined : t('custom.noKeyNeeded');

  // 1. Reachable, and the model listed (when /models exists and answers with a list).
  const list = await send(`${baseUrl}/models`, { method: 'GET', headers }, signal);
  if (list.status === 0) {
    add({ key: 'reach', state: 'fail', detail: list.error });
    return checks;
  }
  add({ key: 'reach', state: 'ok' });
  if (list.status === 401 || list.status === 403) {
    add({ key: 'auth', state: 'fail', detail: err(list) });
    return checks;
  }
  const data = (list.json as { data?: unknown } | undefined)?.data;
  const ids =
    list.status === 200 && Array.isArray(data) ? data.map((m) => (m && typeof m.id === 'string' ? m.id : '')) : null;
  const listed = !!ids?.includes(model);

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

  // The key and model lines, from what the list and this answer showed.
  const keyAndModel = (keyOk: boolean, model: Check) => {
    add(keyOk || ids ? { key: 'auth', state: 'ok', detail: noKeyDetail } : { key: 'auth', state: 'skip' });
    add(model);
  };
  const modelUnverified = (): Check =>
    listed ? { key: 'model', state: 'ok' } : { key: 'model', state: 'skip' };

  if (tools.status === 0) {
    keyAndModel(false, modelUnverified());
    add({ key: 'chat', state: 'fail', reason: 'network', detail: tools.error });
    return checks;
  }

  if (tools.status !== 200) {
    const kind = classifyFailure(tools.status, tools.text, tools.json);
    if (kind === 'auth') {
      add({ key: 'auth', state: 'fail', detail: err(tools) });
      return checks;
    }
    if (kind === 'model') {
      keyAndModel(true, {
        key: 'model',
        state: 'fail',
        detail: ids && !listed ? `${t('custom.modelNotListed')} ${err(tools)}` : err(tools),
      });
      return checks;
    }
    keyAndModel(PAST_AUTH.includes(kind), modelUnverified());
    if (kind === 'tools') add({ key: 'tools', state: 'fail', detail: err(tools) });
    else if (kind === 'path') add({ key: 'address', state: 'fail', detail: addressDetail(baseUrl, err(tools)) });
    else add({ key: 'chat', state: 'fail', reason: kind, detail: err(tools) });
    return checks;
  }

  // A 200 that isn't JSON (a web page, a single-page app answering every path) is not the API.
  if (tools.json === undefined) {
    keyAndModel(false, modelUnverified());
    add({ key: 'address', state: 'fail', detail: addressDetail(baseUrl, err(tools)) });
    return checks;
  }
  let called = false;
  try {
    called = !!fromChatResponse(tools.json).message.tool_calls?.some((c) => c.function.name === 'ping');
  } catch (e) {
    keyAndModel(false, modelUnverified());
    add({ key: 'chat', state: 'fail', reason: 'badResponse', detail: e instanceof Error ? e.message : String(e) });
    return checks;
  }
  keyAndModel(
    true,
    ids && !listed ? { key: 'model', state: 'warn', detail: t('custom.modelNotListed') } : { key: 'model', state: 'ok' },
  );
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
          detail: `${streamError || err(stream)} ${t('custom.streamFallback')}`.trim(),
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
  add(image.status === 200 ? { key: 'images', state: 'ok' } : { key: 'images', state: 'warn', detail: err(image) });
  return checks;
}

/** The server's answer, where the request went, and what to check (the /v1 hint when the path has no version). */
function addressDetail(baseUrl: string, answer: string): string {
  const path = baseUrl.replace(/^[a-z]+:\/\/[^/]*/i, '');
  const hint = /\/v\d+(\/|$)/i.test(path) ? t('custom.addressCheck') : t('custom.v1Hint');
  return `${answer}\n${t('custom.addressTried', { url: `${baseUrl}/chat/completions` })} ${hint}`;
}
