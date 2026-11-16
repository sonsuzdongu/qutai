import { postJson, postSse } from './http';
import type { SseEvent } from './sse';
import type { ProviderId } from './types';

/**
 * How an adapter's request reaches the provider. The adapters build the whole request body and read the answer; the
 * wire only carries it. Own-key providers use the direct wire (the provider's URL, the user's key in the headers).
 * Qutai Credits (pro mode, src/credits/) uses a wire that sends only the conversation from the body to Qutai's relay,
 * which adds the server's key, system prompt and tools, and passes the provider's answer back unchanged; the
 * headers (with the user's own key, if any) never leave the phone on that wire.
 */
export type Wire = {
  /** Raw output is replayed only to the provider id that produced it (its own key, or Qutai Credits). */
  replayAs: ProviderId;
  json<T>(url: string, headers: Record<string, string>, body: Record<string, unknown>, signal: AbortSignal): Promise<T>;
  sse(
    url: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
    signal: AbortSignal,
    onEvent: (event: SseEvent) => void,
  ): Promise<void>;
};

export function directWire(id: ProviderId): Wire {
  return { replayAs: id, json: postJson, sse: postSse };
}
