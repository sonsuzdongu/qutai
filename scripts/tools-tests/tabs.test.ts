// The tab tools' list (src/agent/tools/shared.ts tabList, tools/tabs.ts): what the model is told about open tabs,
// and what it is not told about tabs on a site the user blocked (SITE-28) or incognito tabs (INC-2).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ToolContext } from '../../src/agent/executeTool.ts';
import { tabList } from '../../src/agent/tools/shared.ts';
import { tabsTool } from '../../src/agent/tools/tabs.ts';

function setup(blocked: string[] = []) {
  const tabs = [
    { id: 'a', url: 'https://shop.example/cart', title: 'Your cart', isNewTab: false, incognito: false, groupId: null },
    { id: 'b', url: 'https://www.bank.example/accounts/TR12?holder=deniz', title: 'Deniz Yilmaz – 4.250 TL', isNewTab: false, incognito: false, groupId: null },
    { id: 'c', url: 'https://secret.example/x', title: 'Private thing', isNewTab: false, incognito: true, groupId: null },
  ];
  const browser = {
    tabs,
    activeId: 'a',
    getTab: (id: string) => tabs.find((t) => t.id === id),
    getGroup: () => undefined,
    switchTab(id: string) {
      browser.activeId = id;
    },
  };
  const ctx = {
    browser,
    agentTab: { id: 'a' },
    privacy: { touchedIncognito: false },
    sites: { levelFor: (host: string) => (blocked.includes(host) ? 'blocked' : 'default'), personalFor: () => 'ask' },
  } as unknown as ToolContext;
  return { ctx, tabs };
}

test('a tab on a Blocked site is listed by its site only: no title, no address', () => {
  const { ctx } = setup(['bank.example']);
  const list = tabList(ctx);
  assert.match(list, /- id=a "Your cart" https:\/\/shop\.example\/cart/);
  assert.match(list, /- id=b bank\.example \(the user blocked Qutai on this site/);
  for (const hidden of ['Deniz', '4.250', 'TR12', 'holder', '/accounts']) assert.ok(!list.includes(hidden), hidden);
  // Not blocked: listed as any tab.
  assert.match(tabList(setup().ctx), /- id=b "Deniz Yilmaz – 4\.250 TL" https:\/\/www\.bank\.example\/accounts\/TR12\?holder=deniz/);
});

test("switching to a tab on a Blocked site doesn't give its address either", async () => {
  const { ctx } = setup(['bank.example']);
  const out = await tabsTool('switch_tab', { tab_id: 'b' }, ctx, undefined);
  assert.match(out!.content, /^Switched to tab id=b \(bank\.example \(the user blocked Qutai/);
  assert.ok(!out!.content.includes('TR12'));
  const listed = await tabsTool('list_tabs', {}, ctx, undefined);
  assert.ok(!listed!.content.includes('TR12'));
});

test('an incognito tab keeps its own rule in a normal conversation', () => {
  const list = tabList(setup(['secret.example']).ctx);
  assert.match(list, /- id=c \(title and address not shown in a normal conversation/);
  assert.ok(!list.includes('Private thing') && !list.includes('secret.example'));
});
