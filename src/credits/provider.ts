import { callAnthropic } from '../ai/anthropic';
import type { RequestCost } from '../ai/cost';
import { callGemini } from '../ai/gemini';
import { ApiError } from '../ai/http';
import { callOpenAI } from '../ai/openai';
import { t } from '../i18n';
import type { ModelReply, ModelRequest, Provider } from '../ai/types';
import { EMPTY_USAGE } from '../ai/usage';
import type { Wire } from '../ai/wire';
import { AGENT_PROFILE_ID } from './agentProfileId';
import type { CreditsClient } from './client';
import { RelayError } from './errors';
import { preflight } from './rules';
import type { PublicConfig, RelayProvider, RelayRequest } from './types';

/**
 * "Qutai Credits" (pro mode only): the assistant's requests go to Qutai's relay (`POST /relay`) instead of to the
 * provider, paid with the signed-in user's credits. The conversation is built and the answer read by the same
 * adapters as with an own key (anthropic.ts, openai.ts, gemini.ts), so the assistant behaves the same; only the wire
 * differs (src/ai/wire.ts): it sends the conversation from the adapter's body, never its headers, so no own API key
 * ever goes to Qutai's server, and the server's key is never seen by the app.
 *
 * The system prompt and tools are the server's copy of the app's (the agent profile, `AGENT_PROFILE_ID`); what is
 * the user's own goes as `context` (the memory section and the custom instructions), as the server requires.
 */

/** What one task step needs besides the conversation (set by runAgent, see ModelRequest.agent). */
export type RelayStep = NonNullable<ModelRequest['agent']>;

export type CreditsDeps = {
  /** Null while signed out (or when credits are off in this build). */
  client: () => CreditsClient | null;
  /** The server's configuration, refreshed when it is old; rejects with a RelayError when it can't be had. */
  config: () => Promise<PublicConfig>;
  appVersion: string;
};

const ADAPTERS: Record<RelayProvider, (req: ModelRequest, wire: Wire) => Promise<ModelReply>> = {
  anthropic: callAnthropic,
  openai: callOpenAI,
  gemini: callGemini,
};

/** Adds up what the requests of one call (Gemini may repeat one without streaming) were charged. */
function chargeCounter() {
  let total = 0;
  return {
    add(n: number) {
      total += Math.max(0, n);
    },
    get total() {
      return total;
    },
  };
}

/** The conversation inside the body an adapter built: Anthropic's `messages`, OpenAI's and Gemini's `input`. */
function conversationOf(provider: RelayProvider, body: Record<string, unknown>): unknown[] {
  const input = provider === 'anthropic' ? body.messages : body.input;
  if (!Array.isArray(input)) throw new RelayError('bad_request', 0);
  return input;
}

/**
 * The provider's own refusal of the request (`upstream_rejected`) becomes the error a direct call gets, so the
 * adapters react the same way (e.g. Gemini's thought-signature fallback); the rest stay RelayErrors.
 */
function asAdapterError(e: unknown): unknown {
  if (e instanceof RelayError && e.kind === 'upstream_rejected' && e.upstream) {
    const u = e.upstream;
    return new ApiError(`${t('error.api', { status: u.status })}${u.message ? `: ${u.message}` : ''}`, u.status, u.code);
  }
  return e;
}

export function relayWire(
  client: CreditsClient,
  base: Omit<RelayRequest, 'stream' | 'input'>,
  counter: { add(n: number): void },
): Wire {
  return {
    replayAs: 'qutai',
    async json<T>(_url: string, _headers: Record<string, string>, body: Record<string, unknown>, signal: AbortSignal) {
      try {
        const { json, charge } = await client.relayJson<T>({ ...base, stream: false, input: conversationOf(base.provider, body) }, signal);
        counter.add(charge.charged);
        return json;
      } catch (e) {
        counter.add(chargedBy(e));
        throw asAdapterError(e);
      }
    },
    async sse(_url, _headers, body, signal, onEvent) {
      try {
        const charge = await client.relayStream({ ...base, stream: true, input: conversationOf(base.provider, body) }, signal, onEvent);
        counter.add(charge.charged);
      } catch (e) {
        counter.add(chargedBy(e));
        throw asAdapterError(e);
      }
    },
  };
}

/** Micro-credits a failed request was charged (a RelayError's own, or one the client attached to another error). */
export function chargedBy(e: unknown): number {
  if (e instanceof RelayError) return e.charged;
  const n = e && typeof e === 'object' ? (e as { qutaiCharged?: unknown }).qutaiCharged : undefined;
  return typeof n === 'number' ? n : 0;
}

/** The figures of a call that failed after being charged, for the answer's total and the sent log. */
function withCost<E>(e: E, cost: RequestCost): E {
  if (e && typeof e === 'object') {
    try {
      Object.defineProperty(e, 'requestCost', { value: cost, configurable: true });
    } catch {}
  }
  return e;
}

export function createCreditsProvider(deps: CreditsDeps): Omit<Provider, 'label' | 'models' | 'defaultModel'> {
  return {
    id: 'qutai',
    keyPlaceholder: '',
    keyUrl: '',
    webSearch: true,
    async call(req: ModelRequest): Promise<ModelReply> {
      const client = deps.client();
      if (!client) throw new RelayError('not_signed_in', 0);
      const config = await deps.config();
      const model = preflight(config, deps.appVersion, req.model);
      const agent: RelayStep = req.agent ?? { step: 0, memoryTools: false };
      const limits = config.limits;
      const counter = chargeCounter();
      const base: Omit<RelayRequest, 'stream' | 'input'> = {
        provider: model.provider as RelayProvider,
        model: model.model,
        profile: AGENT_PROFILE_ID,
        step: agent.step,
        options: {
          // Only where the server allows it for this model; otherwise the assistant searches in the browser.
          ...(req.webSearch && model.webSearch ? { webSearch: true } : {}),
          ...(req.research ? { research: true } : {}),
          ...(agent.memoryTools ? { memoryTools: true } : {}),
        },
        context: {
          ...(agent.memory ? { memory: agent.memory } : {}),
          ...(agent.customInstructions
            ? { customInstructions: agent.customInstructions.slice(0, limits.maxCustomInstructionsChars ?? Infinity) }
            : {}),
        },
      };
      const wire = relayWire(client, base, counter);
      // The adapter gets no key: the relay wire never sends the headers it builds.
      const adapterReq: ModelRequest = { ...req, apiKey: '' };
      try {
        const reply = await ADAPTERS[base.provider](adapterReq, wire);
        const cost: RequestCost = { usage: reply.usage ?? EMPTY_USAGE, credits: counter.total, source: 'server' };
        return { ...reply, cost };
      } catch (e) {
        if (counter.total > 0) withCost(e, { usage: EMPTY_USAGE, credits: counter.total, source: 'server' });
        throw e;
      }
    },
  };
}
