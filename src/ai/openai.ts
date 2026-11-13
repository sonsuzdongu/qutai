import { postJson } from './http';
import { canReplay, ModelReply, ModelRequest, Provider, StopReason, ToolCall, Turn } from './types';

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
  const res = await postJson<Response>(
    'https://api.openai.com/v1/responses',
    { authorization: `Bearer ${req.apiKey}` },
    {
      model: req.model,
      instructions: req.system,
      input: toInput(req.turns, req.model),
      tools: req.tools.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
        // Our schemas have optional fields, which strict mode doesn't allow.
        strict: false,
      })),
      store: false,
      max_output_tokens: 32000,
    },
    req.signal,
  );

  const texts: string[] = [];
  let refused = false;
  const toolCalls: ToolCall[] = [];
  for (const item of res.output ?? []) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content as Item[]) {
        if (part.type === 'output_text' && typeof part.text === 'string' && part.text.trim())
          texts.push(part.text.trim());
        if (part.type === 'refusal') refused = true;
      }
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

  return { text: texts.join('\n\n'), toolCalls, stop, raw: res.output };
}

export const openai: Provider = {
  id: 'openai',
  label: 'OpenAI',
  keyPlaceholder: 'sk-...',
  keyUrl: 'https://platform.openai.com/api-keys',
  models: [
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra (önerilen)' },
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna (en hızlı)' },
    { id: 'gpt-6-astra', label: 'GPT-6 Astra (en güçlü)' },
  ],
  defaultModel: 'gpt-5.6-terra',
  call,
};
