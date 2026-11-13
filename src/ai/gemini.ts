import { postJson } from './http';
import { t } from '../i18n';
import { Citation, canReplay, ModelReply, ModelRequest, Provider, StopReason, ToolCall, Turn } from './types';

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
      tools: [
        ...req.tools.map((t) => ({
          type: 'function',
          name: t.name,
          description: t.description,
          ...(hasParameters(t.input_schema) ? { parameters: t.input_schema } : {}),
        })),
        ...(req.webSearch ? [{ type: 'google_search' }] : []),
      ],
      generation_config: { max_output_tokens: 32000 },
      store: false,
    },
    req.signal,
  );

  const steps = res.steps ?? [];
  const texts: string[] = [];
  const toolCalls: ToolCall[] = [];
  const citations: Citation[] = [];
  const searches: string[] = [];
  let searchWidget: string | undefined;
  for (const step of steps) {
    if (step.type === 'model_output' && Array.isArray(step.content)) {
      for (const part of step.content as Step[]) {
        if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) texts.push(part.text.trim());
        for (const a of (part.annotations as Step[] | undefined) ?? []) {
          if (a.type === 'url_citation' && typeof a.url === 'string')
            citations.push({ url: a.url, title: String(a.title ?? '') });
        }
      }
    } else if (step.type === 'google_search_result' && Array.isArray(step.result)) {
      for (const r of step.result as Step[]) {
        if (typeof r.search_suggestions === 'string' && r.search_suggestions.trim())
          searchWidget = r.search_suggestions;
      }
    } else if (step.type === 'google_search_call') {
      const queries = (step.arguments as { queries?: unknown } | undefined)?.queries;
      if (Array.isArray(queries)) searches.push(...queries.filter((q): q is string => typeof q === 'string'));
    } else if (step.type === 'function_call') {
      toolCalls.push({
        id: step.id as string,
        name: step.name as string,
        input: (step.arguments as Record<string, unknown>) ?? {},
      });
    }
  }

  if (res.status === 'failed') throw new Error(t('error.geminiFailed'));

  let stop: StopReason = toolCalls.length > 0 ? 'tool_use' : 'end';
  if (res.status === 'incomplete') stop = 'max_tokens';

  return { text: texts.join('\n\n'), toolCalls, stop, raw: steps, citations, searches, searchWidget };
}

export const gemini: Provider = {
  id: 'gemini',
  label: 'Google Gemini',
  keyPlaceholder: 'AIza...',
  keyUrl: 'https://aistudio.google.com/apikey',
  models: [
    { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', tag: 'recommended' },
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'fastest' },
    { id: 'gemini-4-carbon', name: 'Gemini 4 Carbon', tag: 'strongest' },
  ],
  defaultModel: 'gemini-4-hydrogen',
  call,
};
