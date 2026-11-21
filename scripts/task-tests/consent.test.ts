// Own-key consent on the send path (AI-32): a message to a provider whose screen was not accepted waits for it; Cancel
// sends nothing, keeps the message in the input and says why; the custom endpoint is asked for its own host.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS } from '../../src/storage/settings';
import { answers, makeHost } from './host';

test('cancel on the consent screen: nothing sent, the message stays in the input', async () => {
  let runs = 0;
  const h = makeHost(async (opts) => {
    runs++;
    await answers()(opts);
  });
  h.consent.accept = false;
  await h.send('summarise this page');
  const chat = h.browser.conversationOf(h.browser.active);
  assert.equal(runs, 0);
  assert.equal(chat.draft, 'summarise this page');
  assert.equal(chat.turns.length, 0);
  assert.ok(chat.items.some((i) => i.kind === 'error'));
  assert.deepEqual(h.consent.asked, [{ provider: 'anthropic', endpoint: undefined }]);
});

test('accepted: the message goes out', async () => {
  let runs = 0;
  const h = makeHost(async (opts) => {
    runs++;
    await answers()(opts);
  });
  await h.send('hello');
  assert.equal(runs, 1);
  assert.equal(h.consent.asked.length, 1);
});

test('the custom endpoint is asked with its address', async () => {
  const h = makeHost(answers());
  h.setSettings({
    provider: 'custom',
    customBaseUrl: 'https://gateway.example/v1',
    models: { ...DEFAULT_SETTINGS.models, custom: 'llama' },
  });
  h.consent.accept = false;
  await h.send('hi');
  assert.deepEqual(h.consent.asked, [{ provider: 'custom', endpoint: 'https://gateway.example/v1' }]);
});
