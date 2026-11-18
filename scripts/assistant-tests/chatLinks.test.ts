// 18 Nov 2026: a link tapped in the assistant's chat opened as a separate tab, outside the conversation's tab group.
// It now joins the group (or forms one with the conversation's tab), like tabs the assistant opens during a task.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatLinkPlan } from '../../src/browser/chatLinks.ts';

const normal = { id: '1', incognito: false };
const incognito = { id: '2', incognito: true };

test('a link in a normal conversation opens in its group, shown at once', () => {
  assert.deepEqual(chatLinkPlan({ url: 'https://a.example/', owner: normal, conversationIncognito: false }), {
    kind: 'open',
    url: 'https://a.example/',
    incognito: false,
    openerId: '1',
    group: true,
    activate: true,
  });
});

test('a link in an incognito conversation stays incognito and joins the incognito group', () => {
  const plan = chatLinkPlan({ url: 'https://a.example/', owner: incognito, conversationIncognito: true });
  assert.equal(plan.kind === 'open' && plan.incognito, true);
  assert.equal(plan.kind === 'open' && plan.group, true);
  assert.equal(plan.kind === 'open' && plan.openerId, '2');
});

test('"Open in new tab" from the long-press menu: the same group, behind', () => {
  const plan = chatLinkPlan({ url: 'https://a.example/', owner: normal, conversationIncognito: false, background: true });
  assert.equal(plan.kind === 'open' && plan.activate, false);
  assert.equal(plan.kind === 'open' && plan.group, true);
});

test('a source still open in the same mode is shown in its tab', () => {
  const openTabs = [
    { id: '7', url: 'https://a.example/', incognito: true },
    { id: '8', url: 'https://a.example/', incognito: false },
  ];
  assert.deepEqual(
    chatLinkPlan({ url: 'https://a.example/', owner: normal, conversationIncognito: false, sourceIncognito: false, openTabs }),
    { kind: 'switch', tabId: '8' },
  );
});

test('a source read in incognito, in a normal conversation: incognito, on its own (no mixed groups)', () => {
  const plan = chatLinkPlan({
    url: 'https://b.example/',
    owner: normal,
    conversationIncognito: false,
    sourceIncognito: true,
    openTabs: [{ id: '8', url: 'https://b.example/', incognito: false }],
  });
  assert.equal(plan.kind, 'open');
  assert.equal(plan.kind === 'open' && plan.incognito, true);
  assert.equal(plan.kind === 'open' && plan.group, false);
  assert.equal(plan.kind === 'open' && plan.openerId, undefined);
});
