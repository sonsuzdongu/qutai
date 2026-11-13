import { postJson } from './http';
import { canReplay, ModelReply, ModelRequest, Provider, StopReason, ToolCall, Turn } from './types';

type Step = { type?: string; [key: string]: unknown };

type Interaction = {
  status: string;
  steps?: Step[];
};

function toSteps(turns: Turn[], model: string): Step[] {
  const steps: Step[] = [];
  for (const turn of turns) {
    if (turn.role === 'user') {
      steps.push({ type: 'user_input', content: [{ type: 'text', text: turn.text }] });
    } else if (turn.role === 'tool_results') {
      turn.results.forEach((r) =>
        steps.push({
          type: 'function_result',
          call_id: r.callId,
          name: r.name,
          result: [
            { type: 'text', text: r.content },
            ...(r.images ?? []).map((img) => ({ type: 'image', data: img.data, mime_type: img.mediaType })),
          ],
          ...(r.isError ? { is_error: true } : {}),
        }),
      );
    } else if (canReplay(turn, 'gemini', model)) {
      // In stateless mode, model steps (thoughts and their signatures) are sent back exactly as received.
      steps.push(...(turn.raw as Step[]));
    } else {
      if (turn.text) steps.push({ type: 'model_output', content: [{ type: 'text', text: turn.text }] });
      turn.toolCalls.forEach((c) => steps.push({ type: 'function_call', id: c.id, name: c.name, arguments: c.input }));
    }
  }
  return steps;
}

function hasParameters(schema: Record<string, unknown>) {
  const props = schema.properties as Record<string, unknown> | undefined;
  return !!props && Object.keys(props).length > 0;
}

async function call(req: ModelRequest): Promise<ModelReply> {
  const res = await postJson<Interaction>(
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    { 'x-goog-api-key': req.apiKey },
    {
      model: req.model,
      system_instruction: req.system,
      input: toSteps(req.turns, req.model),
      tools: req.tools.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        ...(hasParameters(t.input_schema) ? { parameters: t.input_schema } : {}),
      })),
      generation_config: { max_output_tokens: 32000 },
      store: false,
    },
    req.signal,
  );

  const steps = res.steps ?? [];
  const texts: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const step of steps) {
    if (step.type === 'model_output' && Array.isArray(step.content)) {
      for (const part of step.content as Step[]) {
        if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) texts.push(part.text.trim());
      }
    } else if (step.type === 'function_call') {
      toolCalls.push({
        id: step.id as string,
        name: step.name as string,
        input: (step.arguments as Record<string, unknown>) ?? {},
      });
    }
  }

  if (res.status === 'failed') throw new Error('Gemini isteği başarısız oldu.');

  let stop: StopReason = toolCalls.length > 0 ? 'tool_use' : 'end';
  if (res.status === 'incomplete') stop = 'max_tokens';

  return { text: texts.join('\n\n'), toolCalls, stop, raw: steps };
}

export const gemini: Provider = {
  id: 'gemini',
  label: 'Google Gemini',
  keyPlaceholder: 'AIza...',
  keyUrl: 'https://aistudio.google.com/apikey',
  models: [
    { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (önerilen)' },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (en hızlı)' },
    { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon (en güçlü)' },
  ],
  defaultModel: 'gemini-4-hydrogen',
  call,
};
