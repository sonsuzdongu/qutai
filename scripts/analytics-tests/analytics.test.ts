/**
 * Product analytics, the app's side (src/analytics/): consent, incognito, the server switch, batching, withdrawal, the
 * error kinds, and that the vocabulary matches the server's allowlist. Run: npm test -- analytics.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { Analytics, BATCH_SIZE, MAX_QUEUE } from '../../src/analytics/analytics.ts';
import { errorClassOf } from '../../src/analytics/errorClass.ts';
import { EVENT_SCHEMA, type EventBatch } from '../../src/analytics/events.ts';

function setup(over: { consent?: 'ask' | 'allowed' | 'declined'; incognito?: boolean; collects?: boolean } = {}) {
  const state = { consent: over.consent ?? 'allowed', incognito: over.incognito ?? false, collects: over.collects ?? true };
  const sent: EventBatch[] = [];
  let now = 1_000_000;
  const a = new Analytics({
    consent: () => state.consent,
    installId: () => (state.consent === 'allowed' ? '3f2b8c1e-5a6d-4e7f-8a9b-0c1d2e3f4a5b' : null),
    serverCollects: async () => state.collects,
    incognito: () => state.incognito,
    sink: { send: async (b) => void sent.push(b) },
    meta: () => ({ appVersion: '0.1.13', platform: 'android', locale: 'tr' }),
    now: () => now,
  });
  return { a, sent, state, tick: (ms: number) => (now += ms) };
}

describe('analytics', () => {
  it('records nothing without consent, in incognito, or while the server does not collect', async () => {
    for (const over of [{ consent: 'ask' as const }, { consent: 'declined' as const }, { incognito: true }]) {
      const { a, sent } = setup(over);
      a.track('setup_finished');
      await a.flush();
      assert.equal(a.pending(), 0);
      assert.deepEqual(sent, []);
    }
    const off = setup({ collects: false });
    off.a.track('setup_finished');
    await off.a.flush();
    assert.deepEqual(off.sent, []);
  });

  it('sends batches with the install id and the app facts only', async () => {
    const { a, sent, tick } = setup();
    a.track('setup_finished');
    await a.flush();
    tick(1000);
    a.track('task_failed', { provider: 'qutai', errorClass: 'network' });
    await a.flush();
    assert.equal(sent.length, 2);
    assert.deepEqual(Object.keys(sent[0]!).sort(), ['appVersion', 'events', 'installId', 'locale', 'platform']);
    assert.deepEqual(sent[1]!.events, [{ name: 'task_failed', at: 1_001_000, props: { provider: 'qutai', errorClass: 'network' } }]);
  });

  it('keeps at most MAX_QUEUE waiting and sends at most BATCH_SIZE per request', async () => {
    const { a, sent, state } = setup();
    state.collects = true;
    for (let i = 0; i < MAX_QUEUE + 20; i++) a.track('feature_used', { feature: 'voice_input' });
    await a.flush();
    assert.ok(sent.every((b) => b.events.length <= BATCH_SIZE));
    assert.ok(sent.reduce((n, b) => n + b.events.length, 0) <= MAX_QUEUE);
  });

  it('drops what waits when consent is withdrawn', async () => {
    const { a, sent, state } = setup();
    a.track('setup_finished');
    state.consent = 'declined';
    a.clear();
    await a.flush();
    assert.deepEqual(sent, []);
  });

  it('turns errors into a few fixed words, never their text', () => {
    assert.equal(errorClassOf({ kind: 'network', message: 'https://secret.example' }), 'network');
    assert.equal(errorClassOf({ kind: 'insufficient_credits' }), 'insufficient_credits');
    assert.equal(errorClassOf({ status: 429 }), 'rate_limited');
    assert.equal(errorClassOf({ status: 503 }), 'provider');
    assert.equal(errorClassOf({ status: 401 }), 'refused');
    assert.equal(errorClassOf(new Error('some page text')), 'other');
  });

  it('has the same vocabulary as the server allowlist', async () => {
    const server = new URL('../../backend/packages/shared/src/events.ts', import.meta.url);
    if (!existsSync(server)) return; // A checkout without backend/.
    const { EVENT_SCHEMA: SERVER } = (await import(server.href)) as { EVENT_SCHEMA: unknown };
    assert.deepEqual(JSON.parse(JSON.stringify(EVENT_SCHEMA)), JSON.parse(JSON.stringify(SERVER)));
  });
});
