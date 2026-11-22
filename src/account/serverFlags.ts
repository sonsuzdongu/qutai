import type { DeviceCheckConfig } from './deviceProof';

/**
 * What the server's `GET /config` says about device verification and product analytics (pro builds only), read at most
 * every TTL_MS for both. No answer: neither is on for now (device proofs aren't sent, events wait or are dropped).
 */

const TTL_MS = 10 * 60_000;

export interface ServerFlags {
  deviceCheck: DeviceCheckConfig | null;
  analytics: boolean;
}

let cached: { value: ServerFlags; at: number } | null = null;
let pending: Promise<ServerFlags> | null = null;

export function parseServerFlags(body: unknown): ServerFlags {
  const b = (typeof body === 'object' && body !== null ? body : {}) as { deviceCheck?: Partial<DeviceCheckConfig>; analytics?: unknown };
  const d = b.deviceCheck;
  return {
    deviceCheck:
      d && (d.mode === 'log' || d.mode === 'enforce')
        ? {
            mode: d.mode,
            playCloudProjectNumber: typeof d.playCloudProjectNumber === 'string' && /^\d{1,20}$/.test(d.playCloudProjectNumber) ? d.playCloudProjectNumber : null,
            appAttest: d.appAttest === true,
          }
        : null,
    analytics: b.analytics === true,
  };
}

export function serverFlags(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<ServerFlags> {
  if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.value);
  pending ??= (async () => {
    try {
      const res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/config`, { headers: { Accept: 'application/json' } });
      const value = parseServerFlags(await res.json());
      cached = { value, at: Date.now() };
      return value;
    } catch {
      return { deviceCheck: null, analytics: false };
    } finally {
      pending = null;
    }
  })();
  return pending;
}
