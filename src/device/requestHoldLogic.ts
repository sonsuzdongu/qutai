/**
 * Keeping one AI request alive while Qutai is in the background (pure logic; the native side is in
 * modules/qutai-agent, the React Native glue in requestHold.ts; tested in scripts/assistant-tests/requestHold.test.ts).
 *
 * Why: with the user's OWN key, a request still running when the user leaves Qutai can be cut by the phone; the app
 * then sends it again on return and the provider bills it twice. So while such a request is in flight the app asks the
 * system to let it finish: Android runs the existing foreground service in a short "finishing a reply" mode (a quiet
 * notification, only while the request runs and Qutai is in the background, hard cap REQUEST_HOLD_MAX_MS), iOS asks
 * for background time (beginBackgroundTask, ended as soon as the request ends). It applies with "Keep working in the
 * background" off too, and covers only finishing the request already sent: the task itself does not go on.
 *
 * Which requests: own-key providers only (Qutai Credits charges a re-sent step once by its step key). Incognito
 * conversations on Android: none, since the hold shows a notification and nothing about incognito use may appear in
 * one (the same rule as "Keep working in the background"); iOS background time is invisible, so it applies there.
 * The notification permission is never asked for: without it Android still runs the service and only hides its
 * notification.
 */

/** Android's hard cap for one hold (the native side enforces it; the service stops when it is reached). */
export const REQUEST_HOLD_MAX_MS = 3 * 60_000;

export type HoldPlatform = 'android' | 'ios' | 'other';

export interface HoldRequest {
  platform: HoldPlatform;
  /** The request goes to the user's own key (not Qutai Credits). */
  ownKey: boolean;
  incognito: boolean;
}

/** Whether a request may hold the app alive while it runs. */
export function mayHold(r: HoldRequest): boolean {
  if (!r.ownKey || r.platform === 'other') return false;
  if (r.platform === 'android' && r.incognito) return false;
  return true;
}

/**
 * Counts the requests in flight that may hold, and tells the native side `true` when the first starts and `false`
 * when the last ends (several at once share one hold). `begin` returns the end call, which is safe to call twice.
 */
export function createRequestHold(setNative: (inFlight: boolean) => void) {
  let inFlight = 0;
  return {
    begin(r: HoldRequest): () => void {
      if (!mayHold(r)) return () => {};
      inFlight++;
      if (inFlight === 1) setNative(true);
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        inFlight--;
        if (inFlight === 0) setNative(false);
      };
    },
    /** Runs `work` (one request) inside a hold; the hold ends however the request ends. */
    async around<T>(r: HoldRequest, work: () => Promise<T>): Promise<T> {
      const end = this.begin(r);
      try {
        return await work();
      } finally {
        end();
      }
    },
    inFlight: () => inFlight,
  };
}
