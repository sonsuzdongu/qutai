import { postJson, postSse } from './http';
import { Citation, canReplay, ModelReply, ModelRequest, Provider, StopReason, ToolCall, Turn } from './types';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';

type Item = { type?: string; [key: string]: unknown };

type Response = {
  status: string;
  incomplete_details?: { reason?: string } | null;
  output: Item[];
};

function toInput(turns: Turn[], model: string): Item[] {
  const input: Item[] = [];
  for (const turn of turns) {
    if (turn.role === 'user') {
      input.push({ role: 'user', content: turn.text });
    } else if (turn.role === 'tool_results') {
      turn.results.forEach((r) => {
        const text = r.isError ? `[error] ${r.content}` : r.content;
        input.push({
          type: 'function_call_output',
          call_id: r.callId,
          output: r.images?.length
            ? [
                { type: 'input_text', text },
                ...r.images.map((img) => ({
                  type: 'input_image',
                  image_url: `data:${img.mediaType};base64,${img.data}`,
                })),
              ]
            : text,
        });
      });
    } else if (canReplay(turn, 'openai', model)) {
      // With store: false, every output item (encrypted reasoning, message phase, calls) is replayed unchanged.
      input.push(...(turn.raw as Item[]));
    } else {
      if (turn.text) input.push({ role: 'assistant', content: turn.text });
      turn.toolCalls.forEach((c) =>
        input.push({ type: 'function_call', call_id: c.id, name: c.name, arguments: JSON.stringify(c.input) }),
      );
    }
  }
  return input;
}

function parseArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function call(req: ModelRequest): Promise<ModelReply> {
  const body = {
    model: req.model,
    instructions: req.system,
    input: toInput(req.turns, req.model),
    tools: [
      ...req.tools.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
        // Our schemas have optional fields, which strict mode doesn't allow.
        strict: false,
      })),
      ...(req.webSearch ? [{ type: 'web_search' }] : []),
    ],
    store: false,
    max_output_tokens: 32000,
  };
  const headers = { authorization: `Bearer ${req.apiKey}` };
  const res = req.onText
    ? await streamResponse(headers, body, req.signal, req.onText)
    : await postJson<Response>(RESPONSES_URL, headers, body, req.signal);
  return toReply(res);
}

/** Streams text deltas; the final event carries the complete response, so nothing has to be rebuilt. */
async function streamResponse(
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal: AbortSignal,
  onText: (delta: string) => void,
): Promise<Response> {
  let final: Response | null = null;
  let lastItem = -1;
  await postSse(RESPONSES_URL, headers, { ...body, stream: true }, signal, ({ data }) => {
    const e = data as Item & { response?: Response & { error?: { message?: string } }; message?: string };
    if (e.type === 'response.output_text.delta' && typeof e.delta === 'string') {
      // Separate the texts of different output messages like the final reply does.
      const item = Number(e.output_index ?? 0);
      if (lastItem !== -1 && item !== lastItem) onText('\n\n');
      lastItem = item;
      onText(e.delta);
    } else if (e.type === 'response.completed' || e.type === 'response.incomplete') {
      final = e.response ?? null;
    } else if (e.type === 'response.failed') {
      throw new Error(e.response?.error?.message ?? 'The response failed');
    } else if (e.type === 'error') {
      throw new Error(typeof e.message === 'string' ? e.message : 'Stream error');
    }
  });
  if (!final) throw new Error('The response ended unexpectedly');
  return final;
}

function toReply(res: Response): ModelReply {
  const texts: string[] = [];
  let refused = false;
  const toolCalls: ToolCall[] = [];
  const citations: Citation[] = [];
  const searches: string[] = [];
  for (const item of res.output ?? []) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content as Item[]) {
        if (part.type === 'output_text' && typeof part.text === 'string' && part.text.trim())
          texts.push(part.text.trim());
        for (const a of (part.annotations as Item[] | undefined) ?? []) {
          if (a.type === 'url_citation' && typeof a.url === 'string')
            citations.push({ url: a.url, title: String(a.title ?? '') });
        }
        if (part.type === 'refusal') refused = true;
      }
    } else if (item.type === 'web_search_call') {
      const action = (item.action ?? {}) as Item;
      if (typeof action.query === 'string') searches.push(action.query);
      if (Array.isArray(action.queries)) searches.push(...action.queries.filter((q) => typeof q === 'string'));
    } else if (item.type === 'function_call') {
      toolCalls.push({
        id: item.call_id as string,
        name: item.name as string,
        input: parseArguments(item.arguments),
      });
    }
  }

  let stop: StopReason = toolCalls.length > 0 ? 'tool_use' : 'end';
  if (res.status === 'incomplete') {
    stop = res.incomplete_details?.reason === 'content_filter' ? 'refusal' : 'max_tokens';
  }
  if (refused) stop = 'refusal';

  return { text: texts.join('\n\n'), toolCalls, stop, raw: res.output, citations, searches: [...new Set(searches)] };
}

export const openai: Provider = {
  id: 'openai',
  label: 'OpenAI',
  keyPlaceholder: 'sk-...',
  keyUrl: 'https://platform.openai.com/api-keys',
  models: [
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', tag: 'recommended' },
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', tag: 'fastest' },
    { id: 'gpt-6-astra', name: 'GPT-6 Astra', tag: 'strongest' },
  ],
  defaultModel: 'gpt-5.6-terra',
  call,
};
