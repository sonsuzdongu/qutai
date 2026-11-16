import { ApiError, postJson, postSse } from './http';
import { t } from '../i18n';
import { createGeminiAccumulator, GeminiInteraction, GeminiStep, GeminiStreamError } from './geminiStream';
import { geminiUsage } from './usage';
import { Citation, canReplay, ModelReply, ModelRequest, Provider, StopReason, ToolCall, Turn } from './types';

const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

type Step = GeminiStep;
type Interaction = GeminiInteraction;

/**
 * Streaming is experimental for Gemini (Settings › Assistant, off by default). Once the API has rejected
 * a request because of a streamed reply in its history, it stays off until the app restarts.
 */
let streamingRejected = false;

export function geminiStreamingAvailable(): boolean {
  return !streamingRejected;
}

function toSteps(turns: Turn[], model: string): Step[] {
  const steps: Step[] = [];
  for (const turn of turns) {
    if (turn.role === 'user') {
      steps.push({
        type: 'user_input',
        content: [
          { type: 'text', text: turn.text },
          ...(turn.images ?? []).map((img) => ({ type: 'image', data: img.data, mime_type: img.mediaType })),
        ],
      });
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

function requestBody(req: ModelRequest) {
  return {
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
  };
}

/** One request, streamed or not; both end in the same interaction shape and the same reply. */
async function request(req: ModelRequest, stream: boolean): Promise<ModelReply> {
  const headers = { 'x-goog-api-key': req.apiKey };
  const onText = req.onText;
  if (!stream || !onText) {
    return toReply(await postJson<Interaction>(INTERACTIONS_URL, headers, requestBody(req), req.signal));
  }

  const acc = createGeminiAccumulator();
  let interaction: Interaction;
  try {
    await postSse(INTERACTIONS_URL, headers, { ...requestBody(req), stream: true }, req.signal, ({ event, data }) => {
      // Each event names its type in its data; the SSE event line says the same.
      const named = data && typeof data === 'object' && !('event_type' in data) ? { ...data, event_type: event } : data;
      let text: string;
      try {
        text = acc.push(named);
      } catch (e) {
        if (e instanceof GeminiStreamError) throw e;
        throw new GeminiStreamError(e instanceof Error ? e.message : String(e), 'malformed');
      }
      if (text) onText(text);
    });
    interaction = acc.finish();
  } catch (e) {
    // Stopping, lost connections, the API's own errors and verdicts stay what they are; anything else
    // that went wrong while reading the stream is a problem with the stream.
    if (req.signal.aborted || e instanceof TypeError) throw e;
    if (e instanceof ApiError || e instanceof GeminiStreamError) throw e;
    throw new GeminiStreamError(e instanceof Error ? e.message : String(e), 'malformed');
  }
  return { ...toReply(interaction), streamed: true };
}

/** The stream failed in a way that a request without streaming may not: worth one repeat. */
function streamFailed(e: unknown): boolean {
  if (e instanceof GeminiStreamError) return e.problem !== 'blocked';
  return e instanceof ApiError;
}

/**
 * The API rejected the history because of a thought signature: the documented
 * `missing_thought_signature` code, or a 400 whose message names a thought signature.
 */
function rejectsHistory(e: unknown): boolean {
  if ((e instanceof ApiError || e instanceof GeminiStreamError) && e.code === 'missing_thought_signature') return true;
  return e instanceof ApiError && e.status === 400 && /thought[\s_-]?signature/i.test(e.message);
}

/**
 * Streams when asked to (the experimental setting), with two fallbacks so a mistake in rebuilding the
 * stream can't break a conversation, each tried once per request: a stream that fails is repeated
 * without streaming, and a request the API rejects over a streamed reply in its history is repeated
 * with those replies sent as text and tool calls, after which streaming stays off.
 */
async function call(req: ModelRequest): Promise<ModelReply> {
  const streamedTurns = req.turns.filter(
    (turn): turn is Extract<Turn, { role: 'assistant' }> =>
      turn.role === 'assistant' && !!turn.streamed && canReplay(turn, 'gemini', req.model),
  );
  try {
    return await request(req, !!req.onText);
  } catch (e) {
    if (req.signal.aborted) throw e;
    if (streamedTurns.length > 0 && rejectsHistory(e)) {
      // Dropped for good, as when the provider or model changes mid-chat: these turns are rebuilt
      // from their text and tool calls in this request and every later one.
      streamedTurns.forEach((turn) => {
        turn.raw = null;
      });
      streamingRejected = true;
      const reply = await request(req, false);
      return { ...reply, notice: t('chat.geminiStreamingOff') };
    }
    if (req.onText && streamFailed(e)) return await request(req, false);
    throw e;
  }
}

function toReply(res: Interaction): ModelReply {
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

  // A stream's usage arrives with interaction.completed, which the accumulator keeps.
  const usage = geminiUsage(res.usage);
  return { text: texts.join('\n\n'), toolCalls, stop, raw: steps, citations, searches, searchWidget, ...(usage ? { usage } : {}) };
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
  webSearch: true,
  call,
};
