// Tokens and list-price cost of "Tell me about yourself" (src/intro/): the extraction request (round 1, a typical
// spoken introduction) and the follow-up answers (round 2), with an own key and through Qutai Credits (where the relay
// adds the agent profile's system prompt and core tools, and the instructions travel in the user turn).
// Estimates with tokens.ts (no tokenizer, ±10–20 %); prices from src/ai/prices.ts, no caching (one-off requests).
// Usage: npm run measure:intro
import { readFileSync } from 'node:fs';
import { PRICES, findPrice } from '../../src/ai/prices';
import { answersTurn, extractionPrompt, transcriptTurn } from '../../src/intro/extract';
import { estimateTokens } from './tokens';

const SAID =
  "Hi, I'm Deniz. I'm thirty-four and I live in Izmir, in Karşıyaka. I'm vegetarian, and I'm allergic to peanuts, " +
  'so please keep that in mind with food orders. I also have celiac disease, so nothing with gluten. When I order ' +
  "online I usually pay cash on delivery, and please don't ring the doorbell because my baby sleeps, just call me. " +
  'I wear size 39 shoes and I like Decathlon and Mavi. I prefer short answers, to the point. I have a cat called Pamuk.';
const item = (topic: string, value: string, quote: string, choice?: string) => ({
  topic,
  value,
  quote,
  stated: true,
  ...(choice ? { choice } : {}),
});
const ROUND1_ANSWER = JSON.stringify({
  items: [
    item('name', 'Deniz', "I'm Deniz"),
    item('age', '34', "I'm thirty-four"),
    item('city', 'Izmir (Karşıyaka)', 'I live in Izmir, in Karşıyaka'),
    item('diet', 'vegetarian', "I'm vegetarian"),
    item('allergy', 'peanuts', "I'm allergic to peanuts"),
    item('health', 'celiac disease, no gluten', 'I also have celiac disease'),
    item('payment', 'cash on delivery', 'I usually pay cash on delivery', 'cod'),
    item('delivery', "Don't ring the doorbell, call instead", "please don't ring the doorbell"),
    item('shopping', 'Shoe size 39', 'I wear size 39 shoes'),
    item('shopping', 'Likes Decathlon and Mavi', 'I like Decathlon and Mavi'),
    item('style', 'short answers', 'I prefer short answers', 'short'),
    item('other', 'Has a cat called Pamuk', 'I have a cat called Pamuk'),
  ],
  none: [],
  declined: [],
});
const ANSWERS = answersTurn([
  { about: 'what to call them', text: 'Just Deniz is fine' },
  { about: 'the city they live in', text: 'Izmir' },
]);
const ROUND2_ANSWER = JSON.stringify({
  items: [item('name', 'Deniz', 'Just Deniz is fine'), item('city', 'Izmir', 'Izmir')],
  none: [],
  declined: [],
});

const prompt = extractionPrompt('en');
/** Per-message wrapping in every provider's format: a few tokens. */
const WRAP = 8;
const profile = JSON.parse(readFileSync(new URL('../../agent-profile/profile.json', import.meta.url), 'utf8'));
const coreTools = profile.tools.filter((tool: { group: string }) => tool.group === 'core');
const relayExtra = estimateTokens(profile.system.base) + estimateTokens(JSON.stringify(coreTools));

type Run = { name: string; input: number; output: number };
const own1: Run = {
  name: 'round 1, own key',
  input: estimateTokens(prompt) + estimateTokens(transcriptTurn(SAID)) + WRAP,
  output: estimateTokens(ROUND1_ANSWER),
};
const own2: Run = {
  name: 'round 2, own key',
  input: estimateTokens(prompt) + estimateTokens(ANSWERS) + WRAP,
  output: estimateTokens(ROUND2_ANSWER),
};
const credits1: Run = { name: 'round 1, Qutai Credits', input: own1.input + relayExtra, output: own1.output };
const credits2: Run = { name: 'round 2, Qutai Credits', input: own2.input + relayExtra, output: own2.output };

console.log(`Extraction prompt: ${prompt.length} characters, ~${estimateTokens(prompt)} tokens`);
console.log(`Sample introduction: ${SAID.split(/\s+/).length} words, ~${estimateTokens(SAID)} tokens`);
console.log(`Relay additions in credits mode (agent system prompt + ${coreTools.length} core tools): ~${relayExtra} tokens\n`);
for (const r of [own1, own2, credits1, credits2]) console.log(`${r.name.padEnd(24)} input ~${r.input}, output ~${r.output}`);

const now = Date.now();
const models = [...new Map(PRICES.map((p) => [`${p.provider}/${p.model}`, p])).values()];
const usd = (dollars: number) => `$${dollars.toFixed(4)}`;
const cost = (provider: string, model: string, r: Run) => {
  const row = findPrice(provider as never, model, r.input, now);
  return row ? (r.input * row.input + r.output * row.output) / 1e12 : NaN;
};
console.log('\nList price (no caching): round 1 | round 1 + round 2 | credits-mode tokens, both rounds, at the same list price');
for (const p of models) {
  const one = cost(p.provider, p.model, own1);
  const both = one + cost(p.provider, p.model, own2);
  const relay = cost(p.provider, p.model, credits1) + cost(p.provider, p.model, credits2);
  console.log(`${`${p.provider} ${p.model}`.padEnd(34)} ${usd(one)} | ${usd(both)} | ${usd(relay)}`);
}
