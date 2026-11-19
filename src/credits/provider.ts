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
import { checkServer, offeredModels, preflight } from './rules';
import { defaultTier, expectedModel, tierTarget } from './tiers';
import type { PublicConfig, RelayPause, RelayProvider, RelayRequest, RelayServed, Tier } from './types';
import { cutText } from '../utils/wellFormed';

/**
 * "Qutai Credits" (pro mode only): the assistant's requests go to Qutai's relay (`POST /relay`) instead of to the
 * provider, paid with the signed-in user's credits. The conversation is built and the answer read by the same
 * adapters as with an own key (anthropic.ts, openai.ts, gemini.ts), so the assistant behaves the same; only the wire
 * differs (src/ai/wire.ts): it sends the conversation from the adapter's body, never its headers, so no own API key
 * ever goes to Qutai's server, and the server's key is never seen by the app.
 *
 * The system prompt and tools are the server's copy of the app's (the agent profile, `AGENT_PROFILE_ID`); what is
 * the user's own goes as `context` (the memory section and the custom instructions), as the server requires.
 *
 * Tiers (backend/README.md › Relay › Tiers): when `/config` lists tiers, the request uses the tier `/config` marks as
 * default (never one the user chose: there is no choice since 20 Nov 2026, CRED-39; `req.model` is not read) and is
 * `{ tier, provider: <format>, route? }`; the format, the expected model and the route come from the conversation's
 * last answer on that tier (tiers.ts tierTarget), and the reply says what served it (`reply.served`, kept with the
 * turn). `409 tier_moved` rebuilds the conversation for the tier's new provider (another adapter, so no other
 * provider's raw output) and sends once more without a route; a second move is an error. `400 tier_unknown` (the
 * default changed after `/config` was read) reads `/config` again and sends once on the new default. Without tiers on
 * the server, the older direct form is sent: `req.model` when the server offers it, else its first model.
 */

/** What one task step needs besides the conversation (set by runAgent, see ModelRequest.agent). */
export type RelayStep = NonNullable<ModelRequest['agent']>;

export type CreditsDeps = {
  /** Null while signed out (or when credits are off in this build). */
  client: () => CreditsClient | null;
  /** The server's configuration, refreshed when it is old; rejects with a RelayError when it can't be had. */
  config: () => Promise<PublicConfig>;
  /** Reads the configuration again now (the server said a tier is unknown, or moved). */
  refreshConfig?: () => Promise<PublicConfig>;
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

/** What the answers of one call said besides their content: who served the last one, and whether it paused. */
export type AnswerNotes = { served?: RelayServed; paused?: RelayPause };

export function relayWire(
  client: CreditsClient,
  base: Omit<RelayRequest, 'stream' | 'input'>,
  counter: { add(n: number): void },
  notes: AnswerNotes = {},
): Wire {
  const note = (charge: { served?: RelayServed; paused?: RelayPause }) => {
    if (charge.served) notes.served = charge.served;
    notes.paused = charge.paused;
  };
  return {
    replayAs: 'qutai',
    async json<T>(_url: string, _headers: Record<string, string>, body: Record<string, unknown>, signal: AbortSignal) {
      try {
        const { json, charge } = await client.relayJson<T>({ ...base, stream: false, input: conversationOf(base.provider, body) }, signal);
        counter.add(charge.charged);
        note(charge);
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
        note(charge);
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
      const agent: RelayStep = req.agent ?? { step: 0, memoryTools: false };
      const counter = chargeCounter();
      const notes: AnswerNotes = {};
      // The adapter gets no key: the relay wire never sends the headers it builds.
      const send = async (request: Omit<RelayRequest, 'stream' | 'input' | 'profile' | 'step' | 'options' | 'context'>, model: string, webSearch: boolean, limits: Record<string, number>) => {
        const base: Omit<RelayRequest, 'stream' | 'input'> = {
          ...request,
          profile: AGENT_PROFILE_ID,
          step: agent.step,
          options: {
            // Only where the server allows it for this model; otherwise the assistant searches in the browser.
            ...(req.webSearch && webSearch ? { webSearch: true } : {}),
            ...(req.research ? { research: true } : {}),
            ...(agent.memoryTools ? { memoryTools: true } : {}),
          },
          context: {
            ...(agent.memory ? { memory: agent.memory } : {}),
            ...(agent.customInstructions
              ? { customInstructions: cutText(agent.customInstructions, limits.maxCustomInstructionsChars ?? Infinity) }
              : {}),
          },
          ...(agent.continuation ? { continuation: agent.continuation } : {}),
          ...(agent.stepKey ? { stepKey: agent.stepKey } : {}),
        };
        return ADAPTERS[base.provider]({ ...req, apiKey: '', model }, relayWire(client, base, counter, notes));
      };
      try {
        let reply: ModelReply;
        if (config.tiers.length > 0) {
          checkServer(config, deps.appVersion);
          const tier = defaultTier(config) as Tier;
          reply = await callTier(tier, req.turns, send, !!agent.continuation, deps);
        } else {
          const offered = offeredModels(config);
          const model = preflight(config, deps.appVersion, offered.some((m) => m.model === req.model) ? req.model : (offered[0]?.model ?? req.model));
          reply = await send({ provider: model.provider as RelayProvider, model: model.model }, model.model, model.webSearch, config.limits);
          notes.served ??= { provider: model.provider as RelayProvider, model: model.model };
        }
        const served = notes.served;
        const cost: RequestCost = {
          usage: reply.usage ?? EMPTY_USAGE,
          credits: counter.total,
          source: 'server',
          ...(served ? { served: { provider: served.provider, model: served.model } } : {}),
        };
        return {
          ...reply,
          cost,
          ...(served ? { served } : {}),
          ...(reply.stop === 'pause' && notes.paused ? { continuation: notes.paused } : {}),
        };
      } catch (e) {
        if (counter.total > 0) withCost(e, { usage: EMPTY_USAGE, credits: counter.total, source: 'server' });
        throw e;
      }
    },
  };
}

type Send = (
  request: Pick<RelayRequest, 'provider' | 'model' | 'tier' | 'route'>,
  model: string,
  webSearch: boolean,
  limits: Record<string, number>,
) => Promise<ModelReply>;

/**
 * One request on a tier, with the one retry `tier_moved` allows: rebuilt for the provider the tier runs on now, without
 * a route. A continuation can't move (it is bound to the model that paused): that ends as `continuation_invalid`.
 * `tier_unknown` (the default tier was renamed or removed after `/config` was read): one more try on the default of a
 * freshly read `/config`, when that is another tier.
 */
async function callTier(
  tier: Tier,
  turns: ModelRequest['turns'],
  send: Send,
  continuing: boolean,
  deps: CreditsDeps,
  retried = false,
): Promise<ModelReply> {
  const target = tierTarget(tier, turns);
  try {
    return await send({ tier: tier.id, provider: target.format, ...(target.route ? { route: target.route } : {}) }, target.model, tier.webSearch, tier.limits);
  } catch (e) {
    if (!(e instanceof RelayError)) throw e;
    if (e.kind === 'tier_unknown') {
      const fresh = deps.refreshConfig ? await deps.refreshConfig().catch(() => null) : null;
      const next = fresh ? defaultTier(fresh) : null;
      if (retried || continuing || !next || next.id === tier.id) throw e;
      return callTier(next, turns, send, continuing, deps, true);
    }
    if (e.kind !== 'tier_moved') throw e;
    deps.refreshConfig?.().catch(() => {});
    if (continuing) throw new RelayError('continuation_invalid', e.status);
    const to = e.movedTo ?? tier.format;
    if (to === target.format && !target.route) throw e;
    try {
      const reply = await send({ tier: tier.id, provider: to }, expectedModel(tier, to), tier.webSearch, tier.limits);
      // Never silently: the conversation goes on with another AI (rebuilt from its text and tool calls).
      return to === target.format ? reply : { ...reply, notice: reply.notice ?? t('credits.tierMovedNotice') };
    } catch (again) {
      if (again instanceof RelayError && again.kind === 'tier_moved') deps.refreshConfig?.().catch(() => {});
      throw again;
    }
  }
}
