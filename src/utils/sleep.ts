/** The error a wait ends with when its task is stopped (task/taskRunner.ts): tools treat it like any other failure. */
export class StoppedError extends Error {
  constructor() {
    super('Stopped by the user.');
    this.name = 'AbortError';
  }
}

/** Rejects at once when the signal has aborted. */
export function throwIfStopped(signal?: AbortSignal) {
  if (signal?.aborted) throw new StoppedError();
}

/**
 * Waits `ms`. With a task's signal, a Stop ends the wait at once with StoppedError, so a stopped task never sits out
 * a pause.
 */
export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new StoppedError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(new StoppedError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Settles with the promise, or with `stopped()` as soon as the signal aborts (the promise is left to finish on its own,
 * its outcome ignored). For work that can't be told to stop: a page query, a request a tool made.
 */
export function untilStopped<T>(work: Promise<T>, signal: AbortSignal | undefined, stopped: () => T): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) {
    work.catch(() => {});
    return Promise.resolve(stopped());
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      work.catch(() => {});
      resolve(stopped());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
