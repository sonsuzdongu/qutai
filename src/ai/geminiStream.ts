/**
 * Rebuilds a Gemini Interactions API response from its server-sent events, so a streamed reply can be
 * stored and replayed exactly like a non-streamed one (thought steps and their signatures included).
 * Pure and without dependencies: events in, interaction out (see gemini.ts for the network side).
 *
 * The stream, per https://ai.google.dev/gemini-api/docs/streaming: `interaction.created`, then for each
 * step `step.start` (the step's type and any fields it already has), `step.delta`s, `step.stop`, and
 * finally `interaction.completed` (status and usage, without the steps). A non-streamed response's
 * `steps` are the assembled steps. Anything not understood here fails the stream rather than producing
 * a turn that differs from the non-streamed one: the caller then repeats the request without streaming.
 */

export type GeminiStep = { type?: string; [key: string]: unknown };

export type GeminiInteraction = {
  status: string;
  steps?: GeminiStep[];
  [key: string]: unknown;
};

/** Error codes the docs list for output blocked by policy (https://ai.google.dev/gemini-api/docs/api-errors). */
const BLOCKED_CODES = new Set([
  'safety',
  'recitation',
  'language',
  'prohibited_content',
  'spii',
  'blocklist',
  'image_safety',
  'image_prohibited_content',
  'image_recitation',
  'image_other',
  'content_blocked',
]);

/**
 * Why a stream couldn't be turned into a response. 'blocked': the API's own verdict on the content,
 * which a repeat wouldn't change; the rest are problems with the stream itself.
 */
export type StreamProblem = 'error_event' | 'blocked' | 'incomplete' | 'malformed';

export class GeminiStreamError extends Error {
  constructor(
    message: string,
    readonly problem: StreamProblem,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'GeminiStreamError';
  }
}

type Event = { event_type?: string; [key: string]: unknown };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Accumulates one stream. `push` takes each event's JSON data and returns the answer text it adds
 * (for showing as it is written); `finish` returns the complete interaction, or throws when the
 * stream didn't complete properly.
 */
export function createGeminiAccumulator() {
  const steps: (GeminiStep | undefined)[] = [];
  const args: Record<number, string> = {};
  let meta: Record<string, unknown> = {};
  let status = '';
  let completed = false;
  let finalSteps: GeminiStep[] | null = null;
  let lastTextStep = -1;

  const malformed = (what: string) => new GeminiStreamError(`Malformed Gemini stream: ${what}`, 'malformed');

  /** Text shown while streaming; texts of separate output steps are separate paragraphs, as in the reply. */
  const shown = (index: number, text: string) => {
    if (!text) return '';
    const separator = lastTextStep !== -1 && lastTextStep !== index ? '\n\n' : '';
    lastTextStep = index;
    return separator + text;
  };

  const stepAt = (index: unknown) => {
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) throw malformed('step index');
    const step = steps[index];
    if (!step) throw malformed(`event for step ${index} before its start`);
    return step;
  };

  /** Parses a function call's streamed arguments into the object a non-streamed call carries. */
  const closeArguments = (index: number) => {
    if (!(index in args)) return;
    const step = steps[index]!;
    const json = args[index];
    delete args[index];
    if (!json.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw malformed(`arguments of step ${index}`);
    }
    if (!isObject(parsed)) throw malformed(`arguments of step ${index}`);
    step.arguments = { ...(isObject(step.arguments) ? step.arguments : {}), ...parsed };
  };

  const applyDelta = (index: number, step: GeminiStep, delta: Record<string, unknown>): string => {
    const type = delta.type;
    if (step.type === 'model_output') {
      const content = Array.isArray(step.content) ? (step.content as GeminiStep[]) : (step.content = []);
      const last = content[content.length - 1];
      if (type === 'text') {
        if (typeof delta.text !== 'string') throw malformed('text delta');
        if (last?.type === 'text' && typeof last.text === 'string') last.text += delta.text;
        else content.push({ type: 'text', text: delta.text });
        return shown(index, delta.text);
      }
      if (type === 'text_annotation_delta') {
        if (!Array.isArray(delta.annotations)) throw malformed('annotation delta');
        let target = last?.type === 'text' ? last : undefined;
        if (!target) content.push((target = { type: 'text', text: '' }));
        target.annotations = [...((target.annotations as unknown[] | undefined) ?? []), ...delta.annotations];
        return '';
      }
      // Images, audio and other output content arrive whole, in the shape the content array keeps.
      content.push({ ...delta });
      return '';
    }
    if (type === 'thought_signature') {
      if (typeof delta.signature !== 'string') throw malformed('thought signature');
      step.signature = delta.signature;
      return '';
    }
    if (type === 'thought_summary') {
      // "A new summary item to be added to the thought" (API reference, ThoughtSummaryDelta).
      if (delta.content !== undefined) {
        step.summary = [...((step.summary as unknown[] | undefined) ?? []), delta.content];
      }
      return '';
    }
    if (type === 'arguments_delta') {
      if (typeof delta.arguments !== 'string') throw malformed('arguments delta');
      args[index] = (args[index] ?? '') + delta.arguments;
      return '';
    }
    // Built-in tool steps (google_search_call, google_search_result, …) and anything newer: the delta
    // carries the step's own fields. Lists grow, other values are set; unknown fields are kept.
    for (const [key, value] of Object.entries(delta)) {
      if (key === 'type') continue;
      const current = step[key];
      step[key] = Array.isArray(current) && Array.isArray(value) ? [...current, ...value] : value;
    }
    return '';
  };

  return {
    push(data: unknown): string {
      if (!isObject(data)) return '';
      const e = data as Event;
      switch (e.event_type) {
        case 'interaction.created':
          if (isObject(e.interaction)) {
            meta = { ...meta, ...e.interaction };
            if (typeof e.interaction.status === 'string') status = e.interaction.status;
          }
          return '';
        case 'interaction.status_update':
          if (typeof e.status === 'string') status = e.status;
          return '';
        case 'step.start': {
          const index = e.index;
          if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) throw malformed('step index');
          if (steps[index]) throw malformed(`step ${index} started twice`);
          if (!isObject(e.step)) throw malformed(`step ${index}`);
          const step = clone(e.step) as GeminiStep;
          steps[index] = step;
          // A step may start with content already in it (e.g. the first words of the answer).
          if (step.type === 'model_output' && Array.isArray(step.content)) {
            return (step.content as GeminiStep[])
              .map((part) => (part.type === 'text' && typeof part.text === 'string' ? shown(index, part.text) : ''))
              .join('');
          }
          return '';
        }
        case 'step.delta': {
          const step = stepAt(e.index);
          if (!isObject(e.delta)) throw malformed('delta');
          return applyDelta(e.index as number, step, clone(e.delta));
        }
        case 'step.stop':
          stepAt(e.index);
          closeArguments(e.index as number);
          return '';
        case 'interaction.completed':
          if (!isObject(e.interaction)) throw malformed('completion');
          completed = true;
          meta = { ...meta, ...e.interaction };
          if (typeof e.interaction.status === 'string') status = e.interaction.status;
          // Should the completion ever carry the assembled steps, they are the server's own: use them.
          if (Array.isArray(e.interaction.steps) && e.interaction.steps.length > 0)
            finalSteps = clone(e.interaction.steps as GeminiStep[]);
          return '';
        case 'error': {
          const error = isObject(e.error) ? e.error : {};
          const code = typeof error.code === 'string' ? error.code : undefined;
          const message = typeof error.message === 'string' && error.message ? error.message : 'Gemini stream error';
          throw new GeminiStreamError(message, code && BLOCKED_CODES.has(code) ? 'blocked' : 'error_event', code);
        }
        default:
          // Keep-alives and event types added later: skipped, as the docs ask.
          return '';
      }
    },

    finish(): GeminiInteraction {
      if (!completed) {
        throw new GeminiStreamError('The Gemini stream ended before the reply was complete', 'incomplete');
      }
      if (!status) throw malformed('no status');
      steps.forEach((step, index) => step && closeArguments(index));
      const out = finalSteps ?? steps.filter((s): s is GeminiStep => !!s);
      // Every thought carries a signature ("always present"); one without would be replayed broken.
      for (const step of out) {
        if (step.type === 'thought' && (typeof step.signature !== 'string' || !step.signature))
          throw malformed('thought without a signature');
        if (step.type === 'function_call' && (typeof step.name !== 'string' || !isObject(step.arguments)))
          throw malformed('incomplete function call');
      }
      const rest = { ...meta };
      delete rest.steps;
      return { ...rest, status, steps: out };
    },
  };
}

/** The whole stream at once: the events' JSON data in order, the interaction out. */
export function accumulateGeminiStream(events: unknown[]): GeminiInteraction {
  const acc = createGeminiAccumulator();
  events.forEach((e) => acc.push(e));
  return acc.finish();
}
