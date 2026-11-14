// Server-sent events, without dependencies: used by http.ts and testable outside the app.

export type SseEvent = { event: string; data: unknown };

/** Splits server-sent events out of a text buffer; returns the parsed events and the unfinished rest. */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    const text = data.join('\n');
    if (!text || text === '[DONE]') continue;
    try {
      events.push({ event, data: JSON.parse(text) });
    } catch {
      // Not JSON (comments, keep-alives): ignored.
    }
  }
  return { events, rest };
}

/**
 * Turns the bytes of a response body into events, however the network splits them (inside a
 * multi-byte character, a line or a JSON string).
 */
export function createSseDecoder() {
  const decoder = new TextDecoder();
  let buffer = '';
  return {
    push(bytes: Uint8Array): SseEvent[] {
      buffer += decoder.decode(bytes, { stream: true });
      const parsed = parseSse(buffer);
      buffer = parsed.rest;
      return parsed.events;
    },
    /** The body ended: whatever is left is the last event. */
    end(): SseEvent[] {
      buffer += decoder.decode();
      const events = parseSse(buffer + '\n\n').events;
      buffer = '';
      return events;
    },
  };
}
