import type { CustomHeader } from './customHeaders';
import { recordRequest, recordRequestCost } from './audit';
import { failedRequestCost, priceRequest } from './cost';
import { creditsEnabled } from '../config/features';
import { creditsProvider, creditsReady } from '../credits';
import { anthropic } from './anthropic';
import { custom } from './custom';
import { gemini } from './gemini';
import { openai } from './openai';
import { openrouter } from './openrouter';
import { catalogModel } from './openrouterModels';
import type { Provider, ProviderId } from './types';

/**
 * The adapters are reached only through here, and every call is recorded for "What was sent to the AI"
 * before it goes out. Recording never throws, so it can't fail a request. The reply's usage is priced here
 * (cost.ts; a cost the adapter already set, such as a server's charge, is kept) and added to the log entry.
 */
function recorded(provider: Provider): Provider {
  // Over the adapter rather than a copy of it, so labels that follow the app's language stay getters.
  const wrapped: Provider = Object.create(provider);
  wrapped.call = async (req) => {
    const at = Date.now();
    const id = recordRequest(provider.id, req);
    let reply;
    try {
      reply = await provider.call(req);
    } catch (e) {
      // Qutai Credits: a request that failed part-way may still have been charged.
      const charged = failedRequestCost(e);
      if (charged && id) recordRequestCost(id, charged);
      throw e;
    }
    const cost = reply.cost ?? (reply.usage ? priceRequest(provider.id, req.model, reply.usage, at) : undefined);
    if (!cost) return reply;
    if (id) recordRequestCost(id, cost);
    return { ...reply, cost };
  };
  return wrapped;
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  anthropic: recorded(anthropic),
  openai: recorded(openai),
  gemini: recorded(gemini),
  openrouter: recorded(openrouter),
  custom: recorded(custom),
  qutai: recorded(creditsProvider),
};

/**
 * Every provider this build offers, in the order the settings list them. Nothing else may assume how many there are.
 * Qutai Credits only in pro mode with a server address (`creditsEnabled`).
 */
export const PROVIDER_ORDER: ProviderId[] = [
  'anthropic',
  'openai',
  'gemini',
  'openrouter',
  'custom',
  ...(creditsEnabled ? (['qutai'] as const) : []),
];

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS[id];
}

export function modelLabel(id: ProviderId, model: string): string {
  const provider = getProvider(id);
  const listed = provider.models.find((m) => m.id === model)?.name;
  if (listed) return listed;
  // Qutai Credits never names the model behind it, wherever a label is shown (CRED-44).
  if (id === 'qutai') return '';
  return (provider.catalog && catalogModel(model)?.name) || model;
}

/** The AI part of the settings (structurally; settings.ts imports this file). */
export type AiConfig = {
  apiKeys: Record<ProviderId, string>;
  models: Record<ProviderId, string>;
  /** The custom endpoint's base URL, checked when it was saved ('' when not set up). */
  customBaseUrl: string;
  /** The custom endpoint's model takes images (set by "Test connection", changeable by the user). */
  customImages: boolean;
  /** The custom endpoint's extra headers (customHeaders.ts); values are secrets like the keys. */
  customHeaders: CustomHeader[];
};

/**
 * The provider can be used: a key, or for the custom endpoint an address and a model (the key is optional there).
 * Qutai Credits: signed in and the disclosure accepted (it has no key; the account pays).
 */
export function isConfigured(cfg: AiConfig, id: ProviderId): boolean {
  if (id === 'qutai') return creditsReady();
  if (getProvider(id).needsEndpoint) return !!cfg.customBaseUrl.trim() && !!cfg.models[id]?.trim();
  return !!cfg.apiKeys[id]?.trim();
}

export type RequestTarget = {
  provider: ProviderId;
  model: string;
  apiKey: string;
  endpoint?: string;
  extraHeaders?: CustomHeader[];
  /** The model takes images; when false, view_screenshot returns a tool error. */
  images: boolean;
  maxOutputTokens?: number;
};

/**
 * Everything a request to this provider and model needs from the settings, and what is known about the model
 * before sending (from OpenRouter's catalogue, or the custom endpoint's image setting; other providers' models all
 * take images). `model` defaults to the provider's model in the settings.
 */
export function requestTarget(cfg: AiConfig, id: ProviderId, model = cfg.models[id]): RequestTarget {
  const provider = getProvider(id);
  // Qutai Credits never gets a key: the server's own is used, on the server.
  const base: RequestTarget = { provider: id, model, apiKey: id === 'qutai' ? '' : (cfg.apiKeys[id] ?? ''), images: true };
  if (provider.needsEndpoint) return { ...base, endpoint: cfg.customBaseUrl, extraHeaders: cfg.customHeaders, images: cfg.customImages };
  if (!provider.catalog) return base;
  const info = catalogModel(model);
  return { ...base, images: info?.images ?? true, ...(info?.maxOutput ? { maxOutputTokens: info.maxOutput } : {}) };
}
