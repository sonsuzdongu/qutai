/**
 * A streamed answer that goes silent: the connection stays open but nothing arrives, so the step would hang until
 * the user presses Stop. Ten minutes without a single byte (keep-alives count as bytes) ends the read. The limit is
 * long on purpose: a reasoning model or a slow local server may think for minutes before its first word.
 */
export const STREAM_STALL_MS = 10 * 60_000;

/** No data arrived for `STREAM_STALL_MS`; plainError.ts reads it as a timeout. */
export class StreamStalledError extends Error {
  constructor() {
    super('The response timed out: nothing arrived for 10 minutes.');
    this.name = 'TimeoutError';
  }
}

/**
 * One `read()` of a stream's body that gives up after `ms` of silence: the body is then cancelled (which closes the
 * connection) and StreamStalledError thrown.
 */
export function readOrStall<T>(reader: { read(): Promise<T>; cancel(): Promise<void> }, ms = STREAM_STALL_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reader.cancel().catch(() => {});
      reject(new StreamStalledError());
    }, ms);
    reader.read().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
