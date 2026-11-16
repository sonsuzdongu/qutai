import { newSentId, recordSent, setSentCost, SentContent, SentItem, SentKind } from '../storage/sentLog';
import type { RequestCost } from './cost';
import { endpointHost } from './customEndpoint';
import type { ModelRequest, ProviderId, ToolImage, Turn } from './types';

/** Which kind of content a tool's result is, for the log. Anything else is a plain tool result. */
const TOOL_KINDS: Record<string, SentKind> = {
  read_page: 'page',
  read_source: 'source',
  view_screenshot: 'screenshot',
  view_attachment: 'attachment',
  read_pdf: 'pdf',
  read_tab: 'tab',
  search_history: 'history',
  bookmarks: 'bookmarks',
  settings: 'settings',
  get_location: 'location',
  read_calendar: 'calendar',
  add_calendar_event: 'calendar',
  add_reminder: 'calendar',
  schedule_notification: 'calendar',
};

/** The tool list is the same array for many requests; its size is measured once. */
const toolSizes = new WeakMap<object, number>();
/** Last memory section logged per conversation, so it shows when it is first sent or changes. */
const lastMemory = new Map<string, string>();

const imageBytes = (images: ToolImage[]) => images.reduce((sum, img) => sum + Math.floor((img.data.length * 3) / 4), 0);

/** Characters and images of a turn as sent (assistant turns: their text and tool calls). */
function turnSize(turn: Turn): { chars: number; images: number } {
  if (turn.role === 'user') return { chars: turn.text.length, images: turn.images?.length ?? 0 };
  if (turn.role === 'assistant') {
    let chars = turn.text.length;
    for (const call of turn.toolCalls) chars += call.name.length + JSON.stringify(call.input).length;
    return { chars, images: 0 };
  }
  let chars = 0;
  let images = 0;
  for (const r of turn.results) {
    chars += r.content.length;
    images += r.images?.length ?? 0;
  }
  return { chars, images };
}

function build(providerId: ProviderId, req: ModelRequest) {
  const { audit, turns } = req;
  const at = Date.now();

  // A request goes out after the user's message or the tool results; what follows the model's last
  // reply is new, everything before it was sent before and goes again as context.
  let lastReply = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === 'assistant') {
      lastReply = i;
      break;
    }
  }

  let toolChars = toolSizes.get(req.tools);
  if (toolChars === undefined) {
    toolChars = JSON.stringify(req.tools).length;
    toolSizes.set(req.tools, toolChars);
  }
  let totalChars = req.system.length + toolChars;
  let images = 0;
  let resentChars = 0;
  turns.forEach((turn, i) => {
    const size = turnSize(turn);
    totalChars += size.chars;
    images += size.images;
    if (i <= lastReply) resentChars += size.chars;
  });

  const items: SentItem[] = [];
  const content: SentContent[] = [];
  const memory = audit.memory;
  if (memory && memory.count > 0 && lastMemory.get(audit.conversation) !== memory.text) {
    lastMemory.set(audit.conversation, memory.text);
    items.push({ kind: 'memory', chars: memory.text.length, count: memory.count });
    content.push({ text: memory.text });
  }
  for (const turn of turns.slice(lastReply + 1)) {
    if (turn.role === 'user') {
      // Attached images are shown with the message, like screenshots with a tool result.
      items.push({ kind: 'message', chars: turn.text.length, ...(turn.images?.length ? { imageBytes: imageBytes(turn.images) } : {}) });
      content.push({ text: turn.text, ...(turn.images?.length ? { images: turn.images } : {}) });
    } else if (turn.role === 'tool_results') {
      for (const r of turn.results) {
        const kind = TOOL_KINDS[r.name] ?? 'tool';
        const host = audit.resultHosts?.get(r.callId);
        items.push({
          kind,
          chars: r.content.length,
          ...(host ? { host } : {}),
          ...(kind === 'tool' ? { tool: r.name } : {}),
          ...(r.images?.length ? { imageBytes: imageBytes(r.images) } : {}),
        });
        // The device's coordinates are sent, but not kept here.
        content.push(kind === 'location' ? {} : { text: r.content, ...(r.images?.length ? { images: r.images } : {}) });
      }
    }
  }

  return {
    id: newSentId(at),
    at,
    provider: providerId,
    model: req.model,
    // Where a custom endpoint's requests went (host only).
    ...(req.endpoint ? { endpoint: endpointHost(req.endpoint) } : {}),
    host: audit.host,
    conversation: audit.conversation,
    items,
    totalChars,
    images,
    resentTurns: lastReply + 1,
    resentChars,
    webSearch: req.webSearch,
    research: !!req.research,
    incognito: audit.incognito,
    content,
  };
}

/**
 * Records what a request sends, for "What was sent to the AI". Keeps references to the strings being
 * sent (no copies) and writes to disk in the background. Never throws.
 */
export function recordRequest(providerId: ProviderId, req: ModelRequest): string | null {
  try {
    const entry = build(providerId, req);
    recordSent(entry);
    return entry.id;
  } catch {
    // The log must never stop a request.
    return null;
  }
}

/** Adds what the request used and cost to its entry, once the reply is in. Never throws. */
export function recordRequestCost(id: string, cost: RequestCost): void {
  try {
    setSentCost(id, cost);
  } catch {}
}
