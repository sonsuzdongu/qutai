import { t } from '../i18n';
import { endpointHost } from './customEndpoint';
import type { ProviderId } from './types';

/**
 * Own-key consent (docs/design/02-ai-providers.md, AI-32): before the first request goes to a provider the
 * user chose with their own key, the user accepts a screen naming where the data goes. Accepted once per provider, and
 * for the custom endpoint once per host (another host asks again). Pure code; the phone's storage and the screen are
 * handed in (src/ai/consent.ts, src/components/AiConsent.ts), so Node tests use their own.
 *
 * Qutai Credits has its own disclosure (CRED-4) and never asks here.
 */

/** Raise when the screen's substance changes, so everyone is asked again. */
export const AI_CONSENT_VERSION = 1;

export type ConsentTarget = { provider: ProviderId; endpoint?: string };

/** Where the data goes, as the screen names it. */
export type ConsentSubject = { provider: ProviderId; key: string; name: string; privacyUrl: string | null };

/** The providers' own privacy policies (none for a custom endpoint: Qutai doesn't know who runs it). */
export const PRIVACY_URLS: Partial<Record<ProviderId, string>> = {
  anthropic: 'https://www.anthropic.com/legal/privacy',
  openai: 'https://openai.com/policies/privacy-policy/',
  gemini: 'https://policies.google.com/privacy',
  openrouter: 'https://openrouter.ai/privacy',
};

const NAMES: Partial<Record<ProviderId, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
};

/**
 * What is asked for: the provider, or for the custom endpoint `custom:<host>` (the address's host, lower case; a
 * different port or path on the same host is the same place). Null when nothing is asked here (Qutai Credits).
 */
export function consentSubject(target: ConsentTarget): ConsentSubject | null {
  const { provider } = target;
  if (provider === 'qutai') return null;
  if (provider === 'custom') {
    const host = endpointHost(target.endpoint ?? '') || (target.endpoint ?? '').trim().toLowerCase();
    return { provider, key: `custom:${host}`, name: host || t('aiConsent.customUnnamed'), privacyUrl: null };
  }
  return { provider, key: provider, name: NAMES[provider] ?? provider, privacyUrl: PRIVACY_URLS[provider] ?? null };
}

/** A request that was not sent because the screen was not accepted (cancelled, or no one could answer it). */
export class ConsentNeededError extends Error {
  constructor() {
    super(t('aiConsent.notAccepted'));
    this.name = 'ConsentNeededError';
  }
}

/** Where acceptances are kept: one string. On the phone, secure storage bound to this device (never in a backup). */
export type ConsentStorage = { read: () => Promise<string | null>; write: (value: string) => Promise<void> };

/** The screen: resolves true only when the user pressed Accept. */
export type ConsentAsker = (subject: ConsentSubject, signal?: AbortSignal) => Promise<boolean>;

/** What storage holds, read back; anything else (another version, a damaged value) counts as nothing accepted. */
export function parseAccepted(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const data = JSON.parse(raw) as { v?: unknown; keys?: unknown };
    if (data.v !== AI_CONSENT_VERSION || !Array.isArray(data.keys)) return new Set();
    return new Set(data.keys.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 300));
  } catch {
    return new Set();
  }
}

export function serializeAccepted(keys: Set<string>): string {
  return JSON.stringify({ v: AI_CONSENT_VERSION, keys: [...keys].sort() });
}

export function createConsentStore(storage: ConsentStorage) {
  let accepted: Set<string> | null = null;
  let loading: Promise<Set<string>> | null = null;
  let asker: ConsentAsker | null = null;
  /** One screen per subject at a time: requests that need the same answer wait for the same screen. */
  const pending = new Map<string, Promise<boolean>>();

  const load = (): Promise<Set<string>> => {
    if (accepted) return Promise.resolve(accepted);
    loading ??= storage
      .read()
      .catch(() => null)
      .then((raw) => (accepted = parseAccepted(raw)));
    return loading;
  };

  /** Only the screen's Accept button gets here (through `ensure`): nothing else can accept, the assistant included. */
  const accept = async (key: string) => {
    const keys = await load();
    keys.add(key);
    await storage.write(serializeAccepted(keys)).catch(() => {});
  };

  return {
    /** The screen, registered once by the app (src/components/AiConsent.ts). Without it nothing is ever accepted. */
    setAsker(fn: ConsentAsker | null) {
      asker = fn;
    },
    /** Whether this target was accepted on this phone. */
    async accepted(target: ConsentTarget): Promise<boolean> {
      const subject = consentSubject(target);
      if (!subject) return true;
      return (await load()).has(subject.key);
    },
    /**
     * True when the target may be sent to: accepted before, or accepted now on the screen (which this waits for).
     * False when cancelled, dismissed, aborted, or when there is no screen to ask with; nothing is stored then.
     */
    async ensure(target: ConsentTarget, signal?: AbortSignal): Promise<boolean> {
      const subject = consentSubject(target);
      if (!subject) return true;
      if ((await load()).has(subject.key)) return true;
      const waiting = pending.get(subject.key);
      if (waiting) return waiting;
      if (!asker || signal?.aborted) return false;
      const ask = asker;
      const answer = (async () => {
        try {
          const yes = await ask(subject, signal);
          if (yes) await accept(subject.key);
          return yes;
        } catch {
          return false;
        } finally {
          pending.delete(subject.key);
        }
      })();
      pending.set(subject.key, answer);
      return answer;
    },
  };
}

export type ConsentStore = ReturnType<typeof createConsentStore>;
