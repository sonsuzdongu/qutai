import type { CreditsClient } from './client';
import { RelayError } from './errors';
import type { CreditsResponse, LedgerEntry, PublicConfig } from './types';

/**
 * What the app knows about Qutai Credits at the moment (pro mode only): the server's configuration (models and their
 * prices, limits, maintenance, the lowest app version) and the signed-in user's balance and latest ledger entries.
 * Pure code with listeners, so the screens can follow it and the tests can run it in Node.
 *
 * The configuration is cached: the server lets it be kept a minute (`Cache-Control: max-age=60`). A task asks for one
 * no older than that; when the server can't be reached, a copy up to an hour old still serves (the relay checks
 * everything again itself).
 */
export type CreditsState = {
  config: PublicConfig | null;
  configAt: number;
  /** Why the last attempt to read the configuration failed, while there is none. */
  configError: RelayError | null;
  /** Micro-credits, or null until known. */
  balance: number | null;
  balanceAt: number;
  /** The latest ledger entries from `GET /credits` (newest first), or null until read. */
  entries: LedgerEntry[] | null;
};

export const CONFIG_FRESH_MS = 60_000;
export const CONFIG_USABLE_MS = 60 * 60_000;

const EMPTY: CreditsState = { config: null, configAt: 0, configError: null, balance: null, balanceAt: 0, entries: null };

export function createCreditsStore(deps: { client: () => CreditsClient | null; publicClient: () => CreditsClient | null; now?: () => number }) {
  const now = deps.now ?? Date.now;
  let state: CreditsState = EMPTY;
  const listeners = new Set<() => void>();
  let loadingConfig: Promise<PublicConfig> | null = null;
  let loadingCredits: Promise<CreditsResponse> | null = null;

  const set = (patch: Partial<CreditsState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  /** The configuration, read again when older than `maxAgeMs`; one request at a time. */
  async function config(maxAgeMs = CONFIG_FRESH_MS): Promise<PublicConfig> {
    if (state.config && now() - state.configAt < maxAgeMs) return state.config;
    if (!loadingConfig) {
      const client = deps.publicClient();
      if (!client) throw new RelayError('unavailable', 0);
      const run = client.config();
      loadingConfig = run;
      run.then(
        (config) => set({ config, configAt: now(), configError: null }),
        (e) => set({ configError: e instanceof RelayError ? e : new RelayError('unknown', 0) }),
      );
      const clear = () => {
        if (loadingConfig === run) loadingConfig = null;
      };
      run.then(clear, clear);
    }
    try {
      return await loadingConfig;
    } catch (e) {
      if (state.config && now() - state.configAt < CONFIG_USABLE_MS) return state.config;
      throw e;
    }
  }

  /** Balance and the latest entries from `GET /credits`. */
  async function refreshCredits(limit = 100): Promise<CreditsResponse> {
    if (!loadingCredits) {
      const client = deps.client();
      if (!client) throw new RelayError('not_signed_in', 0);
      const run = client.credits(limit);
      loadingCredits = run;
      run.then(
        (r) => set({ balance: r.balance, balanceAt: now(), entries: r.entries }),
        () => {},
      );
      const clear = () => {
        if (loadingCredits === run) loadingCredits = null;
      };
      run.then(clear, clear);
    }
    return loadingCredits;
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    config,
    refreshCredits,
    /** A balance from a settlement or a response header. */
    setBalance(balance: number) {
      set({ balance, balanceAt: now() });
    },
    /** Signed out, or another user signed in: the balance and entries were someone else's. */
    forgetAccount() {
      set({ balance: null, balanceAt: 0, entries: null });
    },
  };
}

export type CreditsStore = ReturnType<typeof createCreditsStore>;
