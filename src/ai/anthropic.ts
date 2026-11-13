import { postJson } from './http';
import { canReplay, ModelReply, ModelRequest, Provider, StopReason, ToolCall, Turn } from './types';

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
          content: r.content,
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
    default:
      return 'end';
  }
}

async function call(req: ModelRequest): Promise<ModelReply> {
  const res = await postJson<Response>(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': req.apiKey, 'anthropic-version': '2023-06-01' },
    {
      model: req.model,
      max_tokens: 8192,
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      tools: req.tools,
      messages: toMessages(req.turns, req.model),
    },
    req.signal,
  );

  const text = res.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => (b.text as string).trim())
    .filter(Boolean)
    .join('\n\n');
  const toolCalls: ToolCall[] = res.content
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({ id: b.id as string, name: b.name as string, input: (b.input as Record<string, unknown>) ?? {} }));

  return { text, toolCalls, stop: toStop(res.stop_reason), raw: res.content };
}

export const anthropic: Provider = {
  id: 'anthropic',
  label: 'Anthropic',
  keyPlaceholder: 'sk-ant-...',
  keyUrl: 'https://platform.claude.com/settings/keys',
  models: [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (önerilen)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (en hızlı)' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (en güçlü)' },
  ],
  defaultModel: 'claude-sonnet-5-5',
  call,
};
