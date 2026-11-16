// The Cloudflare address notice (src/ai/cloudflare.ts): which pasted addresses are Cloudflare API addresses, the AI
// Gateway address they convert to, and the addresses that must not match. A fake account id throughout.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectCloudflareApi } from '../../src/ai/cloudflare.ts';

const ID = '0123456789abcdef0123456789abcdef';
const GATEWAY = `https://gateway.ai.cloudflare.com/v1/${ID}/default/compat`;

test('Workers AI REST addresses (not OpenAI-compatible) are detected and convert to the AI Gateway address', () => {
  for (const input of [
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai/run`,
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai`,
    `https://api.cloudflare.com/client/v4/accounts/${ID}`,
    `https://api.cloudflare.com/client/v4/accounts/${ID}/`,
    `api.cloudflare.com/client/v4/accounts/${ID}/ai/run`,
    `  HTTPS://API.Cloudflare.com/client/v4/accounts/${ID}/ai/run/  `,
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai/v1/responses`,
  ]) {
    assert.deepEqual(detectCloudflareApi(input), { accountId: ID, openAiCompatible: false, gatewayUrl: GATEWAY }, input);
  }
});

test("Workers AI's OpenAI-compatible address is detected as compatible (the notice never calls it incompatible)", () => {
  for (const input of [
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai/v1`,
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai/v1/`,
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai/v1/chat/completions`,
  ]) {
    assert.deepEqual(detectCloudflareApi(input), { accountId: ID, openAiCompatible: true, gatewayUrl: GATEWAY }, input);
  }
});

test('an upper-case account id is lower-cased in the gateway address', () => {
  assert.equal(detectCloudflareApi(`https://api.cloudflare.com/client/v4/accounts/${ID.toUpperCase()}/ai/run`)?.gatewayUrl, GATEWAY);
});

test('non-matches: other hosts, the gateway itself, wrong shapes, and what the normaliser refuses', () => {
  for (const input of [
    '',
    GATEWAY,
    `https://gateway.ai.cloudflare.com/v1/${ID}/default/compat/chat/completions`,
    `https://gateway.ai.cloudflare.com/v1/${ID}/my-gateway/openai`,
    `https://api.cloudflare.com.example.com/client/v4/accounts/${ID}/ai/run`,
    `https://evil-api.cloudflare.com/client/v4/accounts/${ID}/ai/run`,
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
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai/run?token=abc`,
    `https://api.cloudflare.com/client/v4/accounts/${ID}/ai/run#x`,
    `ftp://api.cloudflare.com/client/v4/accounts/${ID}/ai/run`,
    'https://llm.example.com/v1',
  ]) {
    assert.equal(detectCloudflareApi(input), null, input);
  }
});
