// The Cloudflare address notice (src/ai/cloudflare.ts): which pasted addresses are Cloudflare API addresses, which of
// them is already the chat address (`…/ai/v1`), the chat address the others change to, the model a `/ai/run/<model>`
// path names, and the addresses that must not match (an AI Gateway address included). A fake account id throughout.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectCloudflareApi } from '../../src/ai/cloudflare.ts';

const ID = '0123456789abcdef0123456789abcdef';
const ACCOUNT = `https://api.cloudflare.com/client/v4/accounts/${ID}`;
const CHAT = `${ACCOUNT}/ai/v1`;

test('the chat address (…/ai/v1, with or without a pasted /chat/completions) is fine: no warning', () => {
  for (const input of [
    CHAT,
    `${CHAT}/`,
    `${CHAT}/chat/completions`,
    `${CHAT}/chat/completions/`,
    `api.cloudflare.com/client/v4/accounts/${ID}/ai/v1`,
    `  HTTPS://API.Cloudflare.com/client/v4/accounts/${ID}/AI/V1  `,
    `https://api.cloudflare.com/client/v4/accounts/${ID.toUpperCase()}/ai/v1`,
  ]) {
    assert.deepEqual(detectCloudflareApi(input), { accountId: ID, chatReady: true, chatUrl: CHAT }, input);
  }
});

test('other paths under the account get the warning, and change to the chat address', () => {
  for (const input of [
    `${ACCOUNT}/ai/run`,
    `${ACCOUNT}/ai/v1/run`,
    `${ACCOUNT}/ai`,
    `${ACCOUNT}/ai/`,
    `${ACCOUNT}/ai/v1/responses`,
    `${ACCOUNT}/ai/v1/embeddings`,
    `${ACCOUNT}/ai/v1/messages`,
    `${ACCOUNT}/ai/v1/models`,
    `${ACCOUNT}/ai/models/search`,
    `${ACCOUNT}/ai-gateway/gateways`,
    ACCOUNT,
    `${ACCOUNT}/`,
    `api.cloudflare.com/client/v4/accounts/${ID}/ai/run`,
  ]) {
    assert.deepEqual(detectCloudflareApi(input), { accountId: ID, chatReady: false, chatUrl: CHAT }, input);
  }
});

test('a model named in /ai/run/<model> is passed on for the hint', () => {
  const cases: [string, string][] = [
    [`${ACCOUNT}/ai/run/@cf/meta/llama-3.1-8b-instruct`, '@cf/meta/llama-3.1-8b-instruct'],
    [`${ACCOUNT}/ai/run/@cf/moonshotai/kimi-k2.6/`, '@cf/moonshotai/kimi-k2.6'],
    [`${ACCOUNT}/ai/v1/run/@cf/openai/gpt-oss-120b`, '@cf/openai/gpt-oss-120b'],
    [`${ACCOUNT}/ai/run/%40cf/meta/llama-3.1-8b-instruct`, '@cf/meta/llama-3.1-8b-instruct'],
    [`${ACCOUNT}/ai/run/@hf/nousresearch/hermes-2-pro-mistral-7b`, '@hf/nousresearch/hermes-2-pro-mistral-7b'],
    [`${ACCOUNT}/ai/run/@cf/meta/llama-3.1-8b-instruct/chat/completions`, '@cf/meta/llama-3.1-8b-instruct'],
  ];
  for (const [input, model] of cases) {
    assert.deepEqual(detectCloudflareApi(input), { accountId: ID, chatReady: false, chatUrl: CHAT, model }, input);
  }
});

test('no model for a run path without a Workers AI model id, or with odd characters', () => {
  for (const input of [
    `${ACCOUNT}/ai/run/llama`,
    `${ACCOUNT}/ai/run/@cf`,
    `${ACCOUNT}/ai/run/@cf/meta/llama%3Cscript%3E`,
    `${ACCOUNT}/ai/run/%E0%A4%A`,
    `${ACCOUNT}/ai/run/@xx/meta/llama`,
  ]) {
    const result = detectCloudflareApi(input);
    assert.ok(result, input);
    assert.equal(result.chatReady, false, input);
    assert.equal(result.model, undefined, input);
  }
});

test('non-matches: AI Gateway addresses, other hosts, wrong shapes, and what the normaliser refuses', () => {
  for (const input of [
    '',
    `https://gateway.ai.cloudflare.com/v1/${ID}/default/compat`,
    `https://gateway.ai.cloudflare.com/v1/${ID}/default/compat/chat/completions`,
    `https://gateway.ai.cloudflare.com/v1/${ID}/my-gateway/openai`,
    `https://gateway.ai.cloudflare.com/v1/${ID}/my-gateway/workers-ai/v1`,
    `https://api.cloudflare.com.example.com/client/v4/accounts/${ID}/ai/v1`,
    `https://evil-api.cloudflare.com/client/v4/accounts/${ID}/ai/v1`,
    `https://example.com/client/v4/accounts/${ID}/ai/run`,
    `https://api.cloudflare.com:8443/client/v4/accounts/${ID}/ai/run`,
    `https://api.cloudflare.com/client/v4/accounts/${ID.slice(1)}/ai/run`,
    `https://api.cloudflare.com/client/v4/accounts/${ID}0/ai/run`,
    `https://api.cloudflare.com/client/v4/accounts/${ID.replace('0', 'g')}/ai/run`,
    `https://api.cloudflare.com/client/v4/zones/${ID}`,
    `https://api.cloudflare.com/client/v5/accounts/${ID}/ai/run`,
    `https://api.cloudflare.com/x/client/v4/accounts/${ID}/ai/run`,
    `http://api.cloudflare.com/client/v4/accounts/${ID}/ai/run`,
    `https://user:pass@api.cloudflare.com/client/v4/accounts/${ID}/ai/run`,
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai/v1?token=abc`,
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai/run#x`,
    `ftp://api.cloudflare.com/client/v4/accounts/${ID}/ai/run`,
    'https://llm.example.com/v1',
  ]) {
    assert.equal(detectCloudflareApi(input), null, input);
  }
});
