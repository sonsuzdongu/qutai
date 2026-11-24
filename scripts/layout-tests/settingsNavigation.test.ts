// Settings' back step (src/components/settingsNavigation.ts, used by SettingsModal.tsx): the main page closes,
// Qutai Credits returns to Account, the Assistant's own pages return to Assistant even with unsaved AI fields (they
// stay as typed), the Assistant page asks before unsaved AI fields are thrown away, every other page
// returns to the main page; and the AI fields that wait for Save.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backStep, pickAi, type SettingsPage } from '../../src/components/settingsNavigation.ts';
import { DEFAULT_SETTINGS } from '../../src/storage/settings.ts';

test('the back step from each page', () => {
  assert.deepEqual(backStep('main', false), { kind: 'close' });
  assert.deepEqual(backStep('main', true), { kind: 'close' });
  assert.deepEqual(backStep('credits', true), { kind: 'page', page: 'account' });
  assert.deepEqual(backStep('assistant', false), { kind: 'page', page: 'main' });
  assert.deepEqual(backStep('assistant', true), { kind: 'askDiscard' });
  for (const page of ['assistantPermissions', 'assistantVoice', 'assistantTasks'] as SettingsPage[]) {
    assert.deepEqual(backStep(page, false), { kind: 'page', page: 'assistant' }, page);
    assert.deepEqual(backStep(page, true), { kind: 'page', page: 'assistant' }, page);
  }
  for (const page of ['account', 'privacy', 'appearance', 'language', 'search', 'backup', 'about'] as SettingsPage[]) {
    assert.deepEqual(backStep(page, true), { kind: 'page', page: 'main' }, page);
  }
});

test('the AI fields are the provider, keys, models and the custom endpoint, nothing else', () => {
  const ai = pickAi({ ...DEFAULT_SETTINGS, provider: 'custom', customBaseUrl: 'https://llm.example/v1' });
  assert.deepEqual(Object.keys(ai).sort(), ['apiKeys', 'customBaseUrl', 'customHeaders', 'customImages', 'models', 'provider']);
  assert.equal(ai.provider, 'custom');
  assert.equal(ai.customBaseUrl, 'https://llm.example/v1');
});
