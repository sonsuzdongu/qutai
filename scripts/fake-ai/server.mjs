#!/usr/bin/env node
// A fake AI server for trying the assistant on a device or simulator without a provider key or any spend: it speaks
// OpenAI's Chat Completions (GET /v1/models, POST /v1/chat/completions, streamed or not), which the app's
// "Custom endpoint" provider uses. Point Settings › Assistant › Custom endpoint at http://localhost:<port>/v1 (iOS
// Simulator; Android emulator: http://10.0.2.2:<port>/v1 is refused by the app's https rule there, so use
// `adb reverse tcp:<port> tcp:<port>` and http://localhost:<port>/v1), model "fake".
//
// The answer is scripted from the user's message (case-insensitive word) and how many tool results followed it:
//   "fill"     read_page → type "Qutai test" into the first text field → click the first button → summary
//   "approve"  get_location (asks for confirmation) → summary
//   "slow"     waits 25 s, then answers (Stop, backgrounding during a request, the keep-alive)
//   "long"     read_page, scroll, read_page, scroll, read_page with 3 s pauses (rotation mid-task)
//   anything else: a short text answer
// "Tell me about yourself" (setup / Settings › Memory, src/intro/): a request whose system prompt (or, in Qutai
// Credits' form, user turn) is the extraction prompt gets JSON items found with simple English and Turkish patterns
// ("I'm Deniz", "my name is", "I live in", "allergic to", "vegetarian", "don't ring", "cash on delivery", "short
// answers", "About name: …" answers). The word "garbage" gets an answer that is not JSON; "slow" waits 25 s.
// Nothing is understood for real; it is enough to drive every screen of the flow.
// Usage: node scripts/fake-ai/server.mjs [port]   (default 8793; listens on 127.0.0.1 only)
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 8793);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lastUserIndex(messages) {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return i;
  return -1;
}
const text = (m) => (typeof m.content === 'string' ? m.content : (m.content ?? []).map((p) => p.text ?? '').join(' '));

const INTRO_MARK = 'facts a browsing assistant should remember';

/** The words of `text` matching `re` (first group), with the whole match as the quote. */
function grab(text, re) {
  const m = re.exec(text);
  return m ? { value: m[1].trim().replace(/[.,;]+$/, ''), quote: m[0].trim().replace(/[.,;]+$/, '') } : null;
}

/** A pretend extraction: JSON in the shape src/intro/extract.ts reads. */
function introAnswer(text) {
  if (/\bgarbage\b/i.test(text)) return 'I am not able to produce JSON today.';
  const items = [];
  const add = (topic, found, extra = {}) => found && items.push({ topic, value: found.value, quote: found.quote, stated: true, ...extra });
  // An answer to a follow-up: the answer itself is the user's words.
  const about = (topic) => {
    const found = grab(text, new RegExp(`About ${topic}[^:]*: (.+)`, 'i'));
    return found && { value: found.value, quote: found.value };
  };
  add('name', grab(text, /(?:[Mm]y name is|[Cc]all me|I'm|I am|[Bb]en|[Aa]dım) ([A-ZÇĞİÖŞÜ][\p{L}]+)/u) ?? about('what to call them'));
  add('city', grab(text, /(?:I live in|[Ll]iving in) ([A-ZÇĞİÖŞÜ][\p{L}]+)/u) ?? grab(text, /([A-ZÇĞİÖŞÜ][\p{L}]+)'?(?:da|de|ta|te) yaşıyorum/u) ?? about('the city'));
  add('age', grab(text, /(?:i'm|i am) (\d{1,3})(?: years old)?/i) ?? grab(text, /(\d{1,3}) yaşındayım/i));
  for (const m of text.matchAll(/allergic to ([\p{L} ]+?)(?:[.,;]|$| and )/giu)) add('allergy', { value: m[1], quote: m[0].replace(/[.,;]$/, '').replace(/ and $/, '') });
  add('allergy', grab(text, /([\p{L}]+(?: [\p{L}]+)?) alerjim var/u));
  add('diet', grab(text, /\b(vegetarian|vegan|vejetaryen(?:im)?|halal)\b/i));
  add('delivery', grab(text, /(don't ring the (?:door)?bell|zile basmayın)/i));
  if (/cash on delivery|kapıda ödeme/i.test(text)) add('payment', grab(text, /(cash on delivery|kapıda ödeme)/i), { choice: 'cod' });
  if (/short answers|kısa yanıt/i.test(text)) add('style', grab(text, /(short answers|kısa yanıt\p{L}*)/iu), { choice: 'short' });
  const food = about('food');
  if (food && !items.some((i) => i.topic === 'allergy' || i.topic === 'diet')) add('diet', food);
  const none = /no allergies|alerjim yok/i.test(text) ? ['allergy'] : [];
  return JSON.stringify({ items, none, declined: [] });
}

/** The scripted next step: { delay, content, toolCalls }. */
function nextStep(messages) {
  const system = messages.find((m) => m.role === 'system');
  const first = messages.find((m) => m.role === 'user');
  if ((system && text(system).includes(INTRO_MARK)) || (first && text(first).includes(INTRO_MARK))) {
    // iOS types curly apostrophes ("I’m"); the patterns use straight ones.
    const said = text(first).split('The text:\n').pop().replace(/[’‘]/g, "'");
    return { delay: /\bslow\b/i.test(said) ? 25000 : 600, content: introAnswer(said) };
  }
  const u = lastUserIndex(messages);
  const user = u >= 0 ? text(messages[u]).toLowerCase() : '';
  const results = messages.slice(u + 1).filter((m) => m.role === 'tool');
  const n = results.length;
  const lastResult = n ? text(results[n - 1]) : '';
  const call = (name, args) => ({ toolCalls: [{ name, args }] });
  if (/\bfill\b/.test(user)) {
    if (n === 0) return call('read_page', {});
    if (n === 1) {
      const field = lastResult.match(/\[ref=(\d+)\] (?:input:(?:text|email|search|tel)|textarea)/);
      return field ? call('type', { ref: Number(field[1]), text: 'Qutai test' }) : { content: 'No text field on this page.' };
    }
    if (n === 2) {
      const page = text(results[0]);
      const button = page.match(/\[ref=(\d+)\] (?:button|input:submit)/);
      return button ? call('click', { ref: Number(button[1]) }) : { content: 'Typed; there is no button to click.' };
    }
    return { content: 'Done: I typed "Qutai test" into the first field and clicked the first button.' };
  }
  if (/\bapprove\b/.test(user)) {
    if (n === 0) return call('get_location', { purpose: 'testing the approval dialog' });
    return { content: `The location step ended: ${lastResult.slice(0, 120)}` };
  }
  if (/\bslow\b/.test(user)) return { delay: 25000, content: 'This slow answer took 25 seconds.' };
  if (/\blong\b/.test(user)) {
    const plan = [['read_page', {}], ['scroll', { direction: 'down' }], ['read_page', {}], ['scroll', { direction: 'down' }], ['read_page', {}]];
    if (n < plan.length) return { delay: 3000, ...call(plan[n][0], plan[n][1]) };
    return { content: 'Read the page in five steps.' };
  }
  return { content: 'Hello from the fake AI server. Nothing was sent to any provider.' };
}

let callNo = 0;
function toolCallsOf(step) {
  return (step.toolCalls ?? []).map((c) => ({ id: `call_${++callNo}`, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } }));
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && /\/models$/.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ object: 'list', data: [{ id: 'fake', object: 'model', owned_by: 'qutai-test' }] }));
  }
  if (req.method !== 'POST' || !/\/chat\/completions$/.test(req.url)) {
    res.writeHead(404);
    return res.end();
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || '{}');
  const step = nextStep(body.messages ?? []);
  console.log(`${new Date().toISOString()} request ${raw.length} bytes, ${body.messages?.length ?? 0} messages, ${body.tools?.length ?? 0} tools → ${step.toolCalls?.[0]?.name ?? 'text'}`);
  let aborted = false;
  req.on('close', () => (aborted = true));
  if (step.delay) await sleep(step.delay);
  if (aborted) return;
  const toolCalls = toolCallsOf(step);
  const finish = toolCalls.length ? 'tool_calls' : 'stop';
  const usage = { prompt_tokens: Math.round(raw.length / 4), completion_tokens: 20, total_tokens: Math.round(raw.length / 4) + 20 };
  if (!body.stream) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        id: `chatcmpl-${callNo}`,
        object: 'chat.completion',
        model: 'fake',
        choices: [{ index: 0, finish_reason: finish, message: { role: 'assistant', content: step.content ?? null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) } }],
        usage,
      }),
    );
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  const send = (o) => res.write(`data: ${JSON.stringify({ id: `chatcmpl-${callNo}`, object: 'chat.completion.chunk', model: 'fake', ...o })}\n\n`);
  if (step.content) {
    for (const word of step.content.split(/(?<= )/)) {
      send({ choices: [{ index: 0, delta: { content: word }, finish_reason: null }] });
      await sleep(30);
    }
  }
  toolCalls.forEach((c, i) => send({ choices: [{ index: 0, delta: { tool_calls: [{ index: i, ...c }] }, finish_reason: null }] }));
  send({ choices: [{ index: 0, delta: {}, finish_reason: finish }] });
  if (body.stream_options?.include_usage) send({ choices: [], usage });
  res.end('data: [DONE]\n\n');
});

server.listen(port, '127.0.0.1', () => console.log(`fake AI server on http://127.0.0.1:${port}/v1 (model "fake")`));
