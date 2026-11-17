/**
 * Replays a scripted task (tasks.ts) through the app's real request code: the history kept as runAgent keeps it,
 * compacted by src/agent/history.ts, the system prompt and tool list of src/agent/, and the provider adapters
 * (src/ai/anthropic.ts, openai.ts, gemini.ts) over a fake wire that records each request body and answers with
 * the scripted step in that provider's own response format. No request leaves the machine.
 *
 * Each recorded body is then split into the parts the provider caches in order (tools, system, then each message
 * block or input item), every part's tokens are estimated (tokens.ts), and the provider's prompt caching is
 * simulated over the task's requests (rules read on 17 Nov 2026, see docs/performance-2026-11.md):
 * - Anthropic: prefix order tools → system → messages; a cache entry is written at each cache_control breakpoint
 *   (top-level cache_control puts one on the last block); a read is the longest earlier-written prefix ending at
 *   most 20 blocks before a breakpoint; at least 512 tokens (Claude 5.5 models); writes 1.25× input, reads 0.1×.
 * - OpenAI (GPT-5.6, implicit mode): a breakpoint at the end of the latest message; reads are the longest
 *   earlier-written prefix; at least 1,024 tokens; writes (30 min) and reads priced by the table.
 * - Gemini (implicit caching, Interactions API): the longest prefix shared with an earlier request is read, at least
 *   4,096 tokens; Gemini 4 re-processes the last 2,050 tokens when a request adds fewer than 2,050; no write price.
 */
import { callAnthropic } from '../../src/ai/anthropic';
import { priceRequest } from '../../src/ai/cost';
import { callGemini } from '../../src/ai/gemini';
import { callOpenAI } from '../../src/ai/openai';
import { EMPTY_USAGE, type Usage } from '../../src/ai/usage';
import type { ModelReply, ModelRequest, ToolResult, Turn } from '../../src/ai/types';
import type { Wire } from '../../src/ai/wire';
import { identityNote } from '../../src/agent/identity';
import { COMPACT_BATCH, compactHistory } from '../../src/agent/history';
import { memoryPrompt, type Memory } from '../../src/agent/memory';
import { SYSTEM_PROMPT } from '../../src/agent/systemPrompt';
import { MEMORY_TOOLS, TOOLS } from '../../src/agent/tools';
import { rng } from './fixtures';
import type { ScriptedStep, Task } from './tasks';
import { estimateTokens, IMAGE_TOKENS } from './tokens';

export type SimProvider = 'anthropic' | 'openai' | 'gemini';
export const MODELS: Record<SimProvider, string> = {
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-5.6-terra',
  gemini: 'gemini-4-hydrogen',
};
const AT = Date.parse('2026-11-17T12:00:00Z');

export type Part = 'system' | 'tools' | 'history' | 'page' | 'toolResults' | 'images';
export type RequestRecord = {
  parts: Record<Part, number>;
  prompt: number;
  output: number;
  usage: Usage;
  nanos: number;
};
export type TaskRecord = { task: string; provider: SimProvider; requests: RequestRecord[] };

const PAGE_TOOLS = new Set(['read_page', 'read_tab', 'read_source', 'read_pdf']);

const MEMORIES: Memory[] = [
  ['identity', 'Name: Deniz Kaya'],
  ['addresses', 'Home: Moda Caddesi 12, Kadıköy, Istanbul'],
  ['shopping', 'Prefers oat milk, avoids palm oil'],
  ['shopping', 'Clothes size M, shoe size 42'],
  ['travel', 'Prefers aisle seats and morning flights'],
  ['food', 'Vegetarian'],
  ['budget', 'Hotels up to 150 EUR a night'],
  ['general', 'Writes in English, reads Turkish news'],
].map(([category, text], i) => ({
  id: `m${i}`,
  text,
  category: category as Memory['category'],
  createdAt: AT - i * 86400000,
  updatedAt: AT - i * 86400000,
  sensitive: false,
  label: null,
}));

function userText(m: Task['messages'][number], provider: SimProvider): string {
  const where = m.tab.url === 'about:blank' ? 'a new tab' : `"${m.tab.title}" (${m.tab.url})`;
  const context = `[Current tab ${m.tab.id}: ${where}. Open tabs: 1. Current time: Tuesday 17 November 2026, 14:05 (Europe/Istanbul). Qutai's interface language: English.]`;
  return `${m.user}\n\n${context.slice(0, -1)} ${identityNote({ mode: 'own', provider, model: MODELS[provider] })}]`;
}

/** A screenshot's base64 (about 180 KB of JPEG), the same every time. */
const SCREENSHOT = (() => {
  const r = rng(7);
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let s = '';
  for (let i = 0; i < 240000; i++) s += abc[Math.floor(r() * 64)];
  return s;
})();

/** The scripted step as the provider would answer it. */
function fakeAnswer(provider: SimProvider, step: ScriptedStep, ids: string[], n: number): unknown {
  const sig = (len: number) => {
    const r = rng(1000 + n);
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(65 + Math.floor(r() * 26));
    return s;
  };
  if (provider === 'anthropic') {
    return {
      content: [
        ...(step.text ? [{ type: 'text', text: step.text }] : []),
        ...step.calls.map((c, i) => ({ type: 'tool_use', id: ids[i], name: c.name, input: c.input })),
      ],
      stop_reason: step.calls.length ? 'tool_use' : 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  }
  if (provider === 'openai') {
    return {
      status: 'completed',
      output: [
        // Reasoning models return an encrypted reasoning item, replayed with the next request (store: false).
        { type: 'reasoning', id: `rs_${n}`, summary: [], encrypted_content: sig(900) },
        ...(step.text ? [{ type: 'message', id: `msg_${n}`, role: 'assistant', content: [{ type: 'output_text', text: step.text, annotations: [] }] }] : []),
        ...step.calls.map((c, i) => ({ type: 'function_call', id: `fc_${n}_${i}`, call_id: ids[i], name: c.name, arguments: JSON.stringify(c.input) })),
      ],
    };
  }
  return {
    status: 'completed',
    steps: [
      // Gemini's thought step with its signature, replayed in stateless mode.
      { type: 'thought', signature: sig(400) },
      ...(step.text ? [{ type: 'model_output', content: [{ type: 'text', text: step.text }] }] : []),
      ...step.calls.map((c, i) => ({ type: 'function_call', id: ids[i], name: c.name, arguments: c.input })),
    ],
  };
}

type Segment = { key: string; tokens: number; part: Part; breakpoint: boolean };

/** Tokens of a JSON value with image data left out (images are counted per image). */
function jsonTokens(v: unknown): { tokens: number; images: number } {
  let images = 0;
  const text = JSON.stringify(v, (k, val) => {
    if ((k === 'data' || k === 'image_url') && typeof val === 'string' && val.length > 1000) {
      images++;
      return '';
    }
    return val;
  });
  return { tokens: estimateTokens(text), images };
}

/** A part's identity for the cache: its content, without the cache_control marker (not part of the prefix). */
const hash = (v: unknown) => JSON.stringify(v, (k, val) => (k === 'cache_control' ? undefined : val));

/** The request split into cacheable parts in the provider's prefix order. */
function segments(provider: SimProvider, body: any): Segment[] {
  const out: Segment[] = [];
  const add = (v: unknown, part: Part, breakpoint = false) => {
    const { tokens, images } = jsonTokens(v);
    out.push({ key: hash(v), tokens: tokens + images * IMAGE_TOKENS, part: images ? 'images' : part, breakpoint });
    if (images) out[out.length - 1].tokens = tokens + images * IMAGE_TOKENS;
  };
  if (provider === 'anthropic') {
    add(body.tools, 'tools');
    for (const b of body.system) add(b, 'system', !!b.cache_control);
    const names = new Map<string, string>();
    for (const m of body.messages) {
      const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
      for (const b of blocks) {
        if (b.type === 'tool_use') names.set(b.id, b.name);
        const part: Part = b.type === 'tool_result' ? (PAGE_TOOLS.has(names.get(b.tool_use_id) ?? '') ? 'page' : 'toolResults') : 'history';
        add(b, part, !!b.cache_control);
      }
    }
    if (body.cache_control) out[out.length - 1].breakpoint = true;
    return out;
  }
  const system = provider === 'openai' ? body.instructions : body.system_instruction;
  add(system, 'system');
  add(body.tools, 'tools');
  const names = new Map<string, string>();
  for (const item of body.input) {
    if (item.type === 'function_call') names.set(item.call_id ?? item.id, item.name);
    let part: Part = 'history';
    if (item.type === 'function_call_output') part = PAGE_TOOLS.has(names.get(item.call_id) ?? '') ? 'page' : 'toolResults';
    if (item.type === 'function_result') part = PAGE_TOOLS.has(item.name) ? 'page' : 'toolResults';
    add(item, part);
  }
  out[out.length - 1].breakpoint = true;
  return out;
}

/** Prompt caching over one task's requests. */
function cacheSim(provider: SimProvider) {
  const written = new Set<string>();
  let previous: string[] = [];
  let previousTokens = 0;
  return (segs: Segment[]): { read: number; write: number } => {
    const prefixKeys: string[] = [];
    const cum: number[] = [];
    let acc = '';
    let total = 0;
    for (const s of segs) {
      acc += '\u0000' + s.key;
      prefixKeys.push(acc);
      total += s.tokens;
      cum.push(total);
    }
    if (provider === 'gemini') {
      let i = 0;
      while (i < segs.length && i < previous.length && previous[i] === prefixKeys[i]) i++;
      let read = i ? cum[i - 1] : 0;
      // Gemini 4: the last 2,050 tokens of the previous request are re-processed when this one adds fewer.
      if (read && total - previousTokens < 2050) read = Math.max(0, read - 2050);
      if (read < 4096) read = 0;
      previous = prefixKeys;
      previousTokens = total;
      return { read, write: 0 };
    }
    const min = provider === 'anthropic' ? 512 : 1024;
    const bps = segs.map((s, i) => (s.breakpoint ? i : -1)).filter((i) => i >= 0);
    let hit = -1;
    for (const bp of bps) {
      const lookback = provider === 'anthropic' ? 20 : Infinity;
      for (let i = bp; i >= 0 && bp - i < lookback; i--) {
        if (written.has(prefixKeys[i])) {
          hit = Math.max(hit, i);
          break;
        }
      }
    }
    const read = hit >= 0 ? cum[hit] : 0;
    let write = 0;
    const last = bps.length ? bps[bps.length - 1] : -1;
    if (last > hit && cum[last] >= min) write = cum[last] - read;
    for (const bp of bps) if (cum[bp] >= min) written.add(prefixKeys[bp]);
    return { read: read >= min ? read : 0, write: read >= min ? write : write + read };
  };
}

export async function simulate(task: Task, provider: SimProvider): Promise<TaskRecord> {
  const model = MODELS[provider];
  const turns: Turn[] = [];
  const requests: RequestRecord[] = [];
  const cache = cacheSim(provider);
  let n = 0;
  const system = SYSTEM_PROMPT + (task.memory ? memoryPrompt(MEMORIES, true) : '');
  const tools = task.memory ? [...TOOLS, ...MEMORY_TOOLS] : TOOLS;
  for (const message of task.messages) {
    turns.push({ role: 'user', text: userText(message, provider) });
    for (const step of message.steps) {
      n++;
      const ids = step.calls.map((_, i) => `call_${n}_${i}`);
      let body: any;
      const wire: Wire = {
        replayAs: provider,
        async json<T>(_url: string, _h: Record<string, string>, b: Record<string, unknown>) {
          body = b;
          return fakeAnswer(provider, step, ids, n) as T;
        },
        async sse() {
          throw new Error('not streamed');
        },
      };
      const req: ModelRequest = {
        apiKey: 'test',
        model,
        system,
        tools,
        webSearch: false,
        turns: compactHistory(turns, undefined, Number(process.env.TOKENS_BATCH ?? COMPACT_BATCH)),
        signal: new AbortController().signal,
        audit: { conversation: 'c', incognito: false, host: null, resultHosts: new Map() } as ModelRequest['audit'],
      };
      const call = provider === 'anthropic' ? callAnthropic : provider === 'openai' ? callOpenAI : callGemini;
      const reply: ModelReply = await call(req, wire);
      // What runAgent keeps.
      turns.push({ role: 'assistant', text: reply.text, toolCalls: reply.toolCalls, raw: reply.raw, rawProvider: provider, rawModel: model });
      if (step.calls.length) {
        const results: ToolResult[] = step.calls.map((c, i) => ({
          callId: reply.toolCalls[i].id,
          name: c.name,
          content: c.result,
          isError: !!c.isError,
          ...(c.screenshot ? { images: [{ mediaType: 'image/jpeg' as const, data: SCREENSHOT }] } : {}),
        }));
        turns.push({ role: 'tool_results', results });
      }

      const segs = segments(provider, body);
      const parts: Record<Part, number> = { system: 0, tools: 0, history: 0, page: 0, toolResults: 0, images: 0 };
      for (const s of segs) parts[s.part] += s.tokens;
      const prompt = segs.reduce((a, s) => a + s.tokens, 0);
      const { read, write } = cache(segs);
      const output = estimateTokens((step.text ?? '') + JSON.stringify(step.calls.map((c) => ({ name: c.name, input: c.input }))));
      const usage: Usage = { ...EMPTY_USAGE, input: prompt - read - write, cacheRead: read, cacheWrite: write, output };
      const priced = priceRequest(provider, model, usage, AT);
      requests.push({ parts, prompt, output, usage, nanos: priced.nanos ?? 0 });
    }
  }
  return { task: task.id, provider, requests };
}
