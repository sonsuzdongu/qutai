import { t } from '../i18n';
import { ApiError, postJson, postSse } from './http';
import {
  buildChatBody,
  ChatResult,
  ChatStreamError,
  createChatAccumulator,
  fromChatResponse,
  replaysReasoning,
  toChatReply,
} from './chatWire';
import { canReplay, ModelReply, ModelRequest, ProviderId, Turn } from './types';

/** How one Chat Completions provider is reached; the messages, stream and reply are the same for all (chatWire.ts). */
export type ChatProviderConfig = {
  id: ProviderId;
  endpoint: (req: ModelRequest) => { url: string; headers: Record<string, string> };
  /** The output limit for a request (undefined: the server's default) and the field it goes in. */
  maxTokens: (req: ModelRequest) => { field: 'max_tokens' | 'max_completion_tokens'; value: number } | undefined;
  /**
   * Ask for usage at the end of a stream with `stream_options.include_usage` (compatible servers send none
   * otherwise; OpenRouter always sends it and documents the option as having no effect, so it leaves it out).
   */
  streamUsage?: boolean;
};

/** The server refused the stream_options field: the request is repeated without it, and it isn't sent again. */
function rejectsStreamOptions(e: unknown): boolean {
  const status = e instanceof ApiError ? e.status : e instanceof ChatStreamError ? e.status : undefined;
  return (status === 400 || status === 422) && /stream_options|include_usage/i.test((e as Error).message);
}

/**
 * The API said the model can't take tools. Neither OpenRouter nor the compatible servers document one wording,
 * so it is recognised by status and by naming tools ("No endpoints found that support tool use", Ollama's
 * "does not support tools", vLLM's tool-choice flags).
 */
function rejectsTools(e: unknown): boolean {
  const status = e instanceof ApiError ? e.status : e instanceof ChatStreamError ? e.status : undefined;
  return (status === 400 || status === 404 || status === 422) && /\btool/i.test((e as Error).message);
}

/** The API rejected a request that carried images. */
function rejectsImages(e: unknown, req: ModelRequest): boolean {
  const status = e instanceof ApiError ? e.status : e instanceof ChatStreamError ? e.status : undefined;
  const hasImages = req.turns.some((turn) => turn.role === 'tool_results' && turn.results.some((r) => r.images?.length));
  return hasImages && (status === 400 || status === 404 || status === 422) && /image|vision|multimodal/i.test((e as Error).message);
}

export function createChatCompletionsCall(config: ChatProviderConfig) {
  let streamUsage = !!config.streamUsage;
  async function request(req: ModelRequest, stream: boolean): Promise<ChatResult> {
    const { url, headers } = config.endpoint(req);
    const body = buildChatBody({
      model: req.model,
      system: req.system,
      tools: req.tools,
      turns: req.turns,
      provider: config.id,
      stream,
      maxTokens: config.maxTokens(req),
      streamUsage,
    });
    const onText = req.onText;
    if (!stream || !onText) return fromChatResponse(await postJson<unknown>(url, headers, body, req.signal));
    const acc = createChatAccumulator();
    await postSse(url, headers, body, req.signal, ({ data }) => {
      const text = acc.push(data);
      if (text) onText(text);
    });
    return acc.finish();
  }

  /**
   * Two fallbacks, each tried once per request: a request rejected while it replays reasoning details is
   * repeated with those turns rebuilt from text and tool calls (as after a model switch), and a stream that
   * fails for any reason but a lost connection or an HTTP error is repeated without streaming.
   */
  return async function call(req: ModelRequest): Promise<ModelReply> {
    const stream = !!req.onText;
    const reply = (result: ChatResult) => toChatReply(result, config.id);
    try {
      return reply(await request(req, stream));
    } catch (e) {
      if (req.signal.aborted) throw e;
      if (stream && streamUsage && rejectsStreamOptions(e)) {
        streamUsage = false;
        return reply(await request(req, stream));
      }
      if (rejectsTools(e)) throw new ApiError(t('error.noToolSupport'), 400);
      if (rejectsImages(e, req)) throw new ApiError(t('error.noImageSupport'), 400);
      const status = e instanceof ApiError ? e.status : e instanceof ChatStreamError ? e.status : undefined;
      if (status === 400 && replaysReasoning(req.turns, config.id, req.model)) {
        req.turns.forEach((turn: Turn) => {
          if (turn.role === 'assistant' && canReplay(turn, config.id, req.model)) turn.raw = null;
        });
        return reply(await request(req, stream));
      }
      if (stream && !(e instanceof ApiError) && !(e instanceof TypeError)) return reply(await request(req, false));
      throw e;
    }
  };
}
