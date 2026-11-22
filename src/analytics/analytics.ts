import type { AnalyticsEvent, EventBatch, EventName, EventProps } from './events';

/**
 * The event layer (pro builds only). An interface with one sink today, Qutai's own server (`POST /events`); a Firebase
 * sink could be added later behind the same `AnalyticsSink` without touching the places that track.
 *
 * Rules kept here, so no caller can get them wrong (docs/design/37-server-and-analytics.md):
 * - nothing is recorded unless consent is "allowed" and the server collects (`GET /config` › `analytics`);
 * - nothing is recorded while the user is in an incognito tab or conversation (`incognito()`);
 * - events wait in memory only (lost when the app is closed), at most MAX_QUEUE, and go in batches;
 * - withdrawing consent drops what waits and the install id (consent.ts makes a new one only after a new "Allow").
 * Pure code: the tests run it in Node.
 */

export interface AnalyticsSink {
  send(batch: EventBatch): Promise<void>;
}

export interface AnalyticsDeps {
  /** "allowed" only after the user's Allow; anything else records nothing. */
  consent: () => 'ask' | 'allowed' | 'declined';
  installId: () => string | null;
  /** Whether the server collects; null while not known yet (events wait until it is). */
  serverCollects: () => Promise<boolean>;
  incognito: () => boolean;
  sink: AnalyticsSink;
  meta: () => { appVersion: string; platform: 'ios' | 'android'; locale: string };
  now?: () => number;
}

export const MAX_QUEUE = 200;
export const BATCH_SIZE = 50;
export const FLUSH_EVERY_MS = 60_000;

export class Analytics {
  private queue: AnalyticsEvent[] = [];
  private inflight: Promise<void> | null = null;
  private lastFlush = 0;

  constructor(private readonly deps: AnalyticsDeps) {}

  track<N extends EventName>(name: N, props?: EventProps<N>): void {
    if (this.deps.consent() !== 'allowed' || this.deps.incognito()) return;
    if (this.queue.length >= MAX_QUEUE) return;
    const now = (this.deps.now ?? Date.now)();
    this.queue.push({ name, at: now, props: { ...(props ?? {}) } as Record<string, string> });
    if (this.queue.length >= BATCH_SIZE || now - this.lastFlush >= FLUSH_EVERY_MS) void this.flush();
  }

  /** Sends what waits (also when the app goes to the background). A failed batch is dropped, never retried forever. */
  flush(): Promise<void> {
    if (this.inflight) return this.inflight;
    if (this.queue.length === 0) return Promise.resolve();
    this.lastFlush = (this.deps.now ?? Date.now)();
    this.inflight = this.send().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async send(): Promise<void> {
    {
      const installId = this.deps.installId();
      if (this.deps.consent() !== 'allowed' || !installId) {
        this.queue = [];
        return;
      }
      if (!(await this.deps.serverCollects())) {
        this.queue = [];
        return;
      }
      while (this.queue.length > 0) {
        const events = this.queue.splice(0, BATCH_SIZE);
        // Consent may have been withdrawn while waiting.
        if (this.deps.consent() !== 'allowed') {
          this.queue = [];
          return;
        }
        await this.deps.sink.send({ installId, ...this.deps.meta(), events }).catch(() => undefined);
      }
    }
  }

  /** Consent withdrawn: forget everything that waits. */
  clear(): void {
    this.queue = [];
  }

  /** For the tests. */
  pending(): number {
    return this.queue.length;
  }
}
