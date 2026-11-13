import { postJson } from './http';
import { Citation, canReplay, ModelReply, ModelRequest, Provider, StopReason, ToolCall, Turn } from './types';

type Block = { type: string; [key: string]: unknown };
type Message = { role: 'user' | 'assistant'; content: Block[] };

type Response = {
  content: Block[];
  stop_reason: string;
};

function toMessages(turns: Turn[], model: string): Message[] {
  const messages: Message[] = [];
  const push = (role: Message['role'], blocks: Block[]) => {
    const last = messages[messages.length - 1];
    // The API expects alternating roles; merge when an interrupted run left two user turns in a row.
    if (last?.role === role) last.content.push(...blocks);
    else messages.push({ role, content: blocks });
  };

  for (const turn of turns) {
    if (turn.role === 'user') {
      push('user', [{ type: 'text', text: turn.text }]);
    } else if (turn.role === 'tool_results') {
      push(
        'user',
        turn.results.map((r) => ({
          type: 'tool_result',
          tool_use_id: r.callId,
          content: r.images?.length
            ? [
                { type: 'text', text: r.content },
                ...r.images.map((img) => ({
                  type: 'image',
                  source: { type: 'base64', media_type: img.mediaType, data: img.data },
                })),
              ]
            : r.content,
          ...(r.isError ? { is_error: true } : {}),
        })),
      );
    } else if (canReplay(turn, 'anthropic', model)) {
      // Thinking blocks must be sent back exactly as received.
      push('assistant', turn.raw as Block[]);
    } else {
      const blocks: Block[] = [];
      if (turn.text) blocks.push({ type: 'text', text: turn.text });
      turn.toolCalls.forEach((c) => blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input }));
      push('assistant', blocks);
    }
  }
  return messages;
}

function toStop(reason: string): StopReason {
  switch (reason) {
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
      return 'max_tokens';
    case 'refusal':
      return 'refusal';
    case 'pause_turn':
      return 'pause';
    default:
      return 'end';
  }
}

// The basic version: later ones filter results through code execution by default.
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 5 };

async function call(req: ModelRequest): Promise<ModelReply> {
  const res = await postJson<Response>(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': req.apiKey, 'anthropic-version': '2023-06-01' },
    {
      model: req.model,
      max_tokens: 8192,
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      tools: req.webSearch ? [...req.tools, WEB_SEARCH_TOOL] : req.tools,
      messages: toMessages(req.turns, req.model),
    },
    req.signal,
  );

  // Cited answers arrive as many text blocks that split sentences, so consecutive text blocks
  // are joined as they are; other blocks (searches, tool calls) start a new paragraph.
  const paragraphs: string[] = [''];
  const citations: Citation[] = [];
  const searches: string[] = [];
  for (const b of res.content) {
    if (b.type === 'text' && typeof b.text === 'string') {
      paragraphs[paragraphs.length - 1] += b.text;
      for (const c of (b.citations as Block[] | undefined) ?? []) {
        if (typeof c.url === 'string') citations.push({ url: c.url, title: String(c.title ?? '') });
      }
    } else {
      paragraphs.push('');
      if (b.type === 'server_tool_use' && b.name === 'web_search') {
        const query = (b.input as { query?: unknown } | undefined)?.query;
        if (typeof query === 'string') searches.push(query);
      }
    }
  }
  const text = paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n');
  const toolCalls: ToolCall[] = res.content
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({ id: b.id as string, name: b.name as string, input: (b.input as Record<string, unknown>) ?? {} }));

  return { text, toolCalls, stop: toStop(res.stop_reason), raw: res.content, citations, searches };
}

export const anthropic: Provider = {
  id: 'anthropic',
  label: 'Anthropic',
  keyPlaceholder: 'sk-ant-...',
  keyUrl: 'https://platform.claude.com/settings/keys',
  models: [
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', tag: 'recommended' },
    { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', tag: 'fastest' },
    { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', tag: 'strongest' },
  ],
  defaultModel: 'claude-sonnet-5-5',
  call,
};
