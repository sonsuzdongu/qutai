// Own-key consent (docs/design/02-ai-providers.md, AI-32): nothing goes to a provider chosen with the user's own key
// before the user accepted the screen naming it; a custom endpoint is asked again for another host; Cancel sends and
// stores nothing; acceptances never come back from a backup. Run: npm run test:assistant.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anthropic } from '../../src/ai/anthropic';
import { aiConsent } from '../../src/ai/consent';
import {
  AI_CONSENT_VERSION,
  ConsentNeededError,
  consentSubject,
  createConsentStore,
  parseAccepted,
  serializeAccepted,
  type ConsentSubject,
} from '../../src/ai/consentLogic';
import { custom } from '../../src/ai/custom';
import { PROVIDERS } from '../../src/ai/providers';
import type { ProviderRequest } from '../../src/ai/types';
import { parseBackup } from '../../src/backup/payload';
import { DEFAULT_SETTINGS } from '../../src/storage/settings';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const writes: string[] = [];
  return {
    storage: {
      read: async () => value,
      write: async (v: string) => {
        value = v;
        writes.push(v);
      },
    },
    writes,
    value: () => value,
  };
}

function asker(answers: boolean[]) {
  const asked: ConsentSubject[] = [];
  return {
    asked,
    fn: async (subject: ConsentSubject) => {
      asked.push(subject);
      return answers.shift() ?? false;
    },
  };
}

const request = (extra: Partial<ProviderRequest> = {}) =>
  ({ model: 'm', system: '', turns: [], tools: [], apiKey: 'k', signal: new AbortController().signal, ...extra }) as unknown as ProviderRequest;

test('subjects: a provider by id, a custom endpoint by host, Qutai Credits never', () => {
  assert.equal(consentSubject({ provider: 'anthropic' })?.key, 'anthropic');
  assert.equal(consentSubject({ provider: 'anthropic' })?.privacyUrl, 'https://www.anthropic.com/legal/privacy');
  const a = consentSubject({ provider: 'custom', endpoint: 'https://Gateway.Example:8443/v1' });
  assert.equal(a?.key, 'custom:gateway.example');
  assert.equal(a?.name, 'gateway.example');
  assert.equal(a?.privacyUrl, null);
  // Another path or port on the same host is the same place; another host is not.
  assert.equal(consentSubject({ provider: 'custom', endpoint: 'https://gateway.example/other/v1' })?.key, a?.key);
  assert.notEqual(consentSubject({ provider: 'custom', endpoint: 'https://evil.example/v1' })?.key, a?.key);
  assert.equal(consentSubject({ provider: 'qutai' }), null);
});

test('the gate in front of every adapter: no request before acceptance, and none after a cancel', async () => {
  const sent: ProviderRequest[] = [];
  const original = anthropic.call;
  anthropic.call = async (req) => {
    sent.push(req);
    return { turn: { role: 'assistant', text: 'hi', toolCalls: [], raw: null, rawProvider: 'anthropic', rawModel: 'm' } } as never;
  };
  try {
    // No screen registered (nobody to ask, such as a request started where no dialog can show): refused.
    aiConsent.setAsker(null);
    await assert.rejects(PROVIDERS.anthropic.call(request()), ConsentNeededError);
    assert.equal(sent.length, 0);

    // Cancel: nothing sent, nothing remembered, asked again next time.
    const first = asker([false, true]);
    aiConsent.setAsker(first.fn);
    await assert.rejects(PROVIDERS.anthropic.call(request()), ConsentNeededError);
    assert.equal(sent.length, 0);
    assert.equal(await aiConsent.accepted({ provider: 'anthropic' }), false);

    // Accept: the request goes out, and later ones go without asking.
    await PROVIDERS.anthropic.call(request());
    await PROVIDERS.anthropic.call(request());
    assert.equal(sent.length, 2);
    assert.equal(first.asked.length, 2);
    assert.equal(first.asked[0].name, 'Anthropic');
  } finally {
    anthropic.call = original;
    aiConsent.setAsker(null);
  }
});

test('a custom endpoint is asked again when its host changes', async () => {
  const sent: string[] = [];
  const original = custom.call;
  custom.call = async (req) => {
    sent.push(req.endpoint ?? '');
    return { turn: { role: 'assistant', text: 'hi', toolCalls: [], raw: null, rawProvider: 'custom', rawModel: 'm' } } as never;
  };
  try {
    const ask = asker([true, false]);
    aiConsent.setAsker(ask.fn);
    await PROVIDERS.custom.call(request({ endpoint: 'https://one.example/v1' }));
    await PROVIDERS.custom.call(request({ endpoint: 'https://one.example:8080/v1' }));
    assert.equal(ask.asked.length, 1);
    // Another host: asked again; cancelled, so nothing goes there.
    await assert.rejects(PROVIDERS.custom.call(request({ endpoint: 'https://two.example/v1' })), ConsentNeededError);
    assert.equal(ask.asked.length, 2);
    assert.equal(ask.asked[1].name, 'two.example');
    assert.deepEqual(sent, ['https://one.example/v1', 'https://one.example:8080/v1']);
  } finally {
    custom.call = original;
    aiConsent.setAsker(null);
  }
});

test('Qutai Credits is never asked here (it has its own disclosure)', async () => {
  const store = createConsentStore(memoryStorage().storage);
  const ask = asker([]);
  store.setAsker(ask.fn);
  assert.equal(await store.ensure({ provider: 'qutai' }), true);
  assert.equal(ask.asked.length, 0);
});

test('requests waiting for the same answer share one screen', async () => {
  const mem = memoryStorage();
  const store = createConsentStore(mem.storage);
  let release!: (v: boolean) => void;
  let shown = 0;
  store.setAsker(() => {
    shown++;
    return new Promise<boolean>((r) => (release = r));
  });
  const a = store.ensure({ provider: 'openai' });
  const b = store.ensure({ provider: 'openai' });
  await new Promise((r) => setTimeout(r, 0));
  release(true);
  assert.deepEqual(await Promise.all([a, b]), [true, true]);
  assert.equal(shown, 1);
  assert.deepEqual(parseAccepted(mem.value()), new Set(['openai']));
});

test('cancel or an aborted request stores nothing', async () => {
  const mem = memoryStorage();
  const store = createConsentStore(mem.storage);
  store.setAsker(async () => false);
  assert.equal(await store.ensure({ provider: 'gemini' }), false);
  const aborted = new AbortController();
  aborted.abort();
  store.setAsker(async () => true);
  assert.equal(await store.ensure({ provider: 'gemini' }, aborted.signal), false);
  assert.deepEqual(mem.writes, []);
});

test('stored acceptances: another version or a damaged value counts as nothing accepted', () => {
  assert.deepEqual(parseAccepted(serializeAccepted(new Set(['anthropic', 'custom:a.example']))), new Set(['anthropic', 'custom:a.example']));
  assert.deepEqual(parseAccepted(JSON.stringify({ v: AI_CONSENT_VERSION + 1, keys: ['anthropic'] })), new Set());
  assert.deepEqual(parseAccepted('{not json'), new Set());
  assert.deepEqual(parseAccepted(JSON.stringify({ v: AI_CONSENT_VERSION, keys: [1, '', 'openai'] })), new Set(['openai']));
});

test('restore: a backup never carries acceptances back (they are not settings and not in the payload)', () => {
  assert.ok(!Object.keys(DEFAULT_SETTINGS).some((k) => /consent/i.test(k)));
  const forged = {
    app: 'qutai',
    payloadVersion: 1,
    createdAt: 1,
    appVersion: '0.1.9',
    schemaVersion: 1,
    aiConsent: serializeAccepted(new Set(['anthropic'])),
    ai_consent_accepted: serializeAccepted(new Set(['anthropic'])),
    settings: { theme: 'dark', aiConsent: ['anthropic'], ai_consent_accepted: 'x' },
  };
  const parsed = parseBackup(JSON.stringify(forged));
  const text = JSON.stringify(parsed);
  assert.ok(!/consent/i.test(text), text);
});
