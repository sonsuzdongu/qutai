// One table and one ordered pipeline for every tool call (TOOL-30, 20 Nov 2026 code review; src/agent/toolTable.ts,
// src/agent/executeTool.ts): every tool has a row (a new tool without one fails here and is refused by the app), the
// rows agree with the site permission's own lists, and the three fixes that came with it: download_file's own
// address goes through the outbound check with nothing requested before the user answers, incognito tabs' titles and
// addresses stay out of normal conversations, and a call after the user closed the assistant's tab fails instead of
// acting on the tab on screen. Runs the app's real executeTool, Browser and Tab, without a browser engine.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { executeTool, type ToolContext } from '../../src/agent/executeTool';
import { OutboundGuard } from '../../src/agent/outbound';
import { ACTIONS_NEEDING_CONFIRMATION } from '../../src/agent/sitePolicy';
import { prepareStepTarget, stepTabTitle } from '../../src/agent/stepTarget';
import { GATE_ORDER, TOOL_TABLE } from '../../src/agent/toolTable';
import { MEMORY_TOOLS, TOOLS } from '../../src/agent/tools';
import { Browser } from '../../src/browser/Browser';
import { makeWorld } from './world';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function setup(userTexts: string[] = ['Find the user guide for my kettle.']) {
  const browser = new Browser();
  const agent = browser.active;
  agent.url = 'https://www.mutfakdunyasi.com.tr/kettle';
  const world = makeWorld({
    browser,
    agentTabId: agent.id,
    memories: [['identity', 'Phone: +90 532 418 77 05']],
    contacts: [],
    userTexts: () => userTexts,
  });
  const order: string[] = [];
  const ctx: ToolContext = {
    ...world.ctx,
    outbound: new OutboundGuard([agent.url], () => userTexts, () => world.memory.list()),
    confirm: async (description) => {
      order.push(`dialog: ${description.lines.map((l) => l.text).join(' | ')}`);
      return false;
    },
  };
  globalThis.fetch = (async (url: string, init?: { method?: string }) => {
    order.push(`request: ${init?.method ?? 'GET'} ${url}`);
    return new Response(null, { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': '1000' } });
  }) as typeof fetch;
  return { browser, agent, ctx, order, world };
}

test('every tool the model can call has a row; a tool without one is refused', async () => {
  const names = [...TOOLS, ...MEMORY_TOOLS].map((t) => t.name);
  assert.deepEqual(names.filter((n) => !(n in TOOL_TABLE)), [], 'tools without a row in src/agent/toolTable.ts');
  assert.deepEqual(Object.keys(TOOL_TABLE).filter((n) => !names.includes(n)), [], 'rows for tools that no longer exist');
  const { ctx } = setup();
  const out = await executeTool('format_disk', {}, ctx);
  assert.equal(out.isError, true);
  assert.match(out.content, /Unknown tool/);
});

test('the rows agree with each other and with the site permission', () => {
  for (const [name, spec] of Object.entries(TOOL_TABLE)) {
    // Gates are in pipeline order, each once.
    const order = spec.gates.map((g) => GATE_ORDER.indexOf(g));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${name}: gates out of order`);
    assert.equal(new Set(spec.gates).size, spec.gates.length, name);
    // A model-written address is always checked; the check needs one.
    assert.equal(!!spec.address, spec.gates.includes('outbound'), `${name}: address and outbound go together`);
    // The site permission is checked wherever there is a page.
    assert.equal(spec.target !== 'none', spec.gates.includes('site'), `${name}: site gate and target`);
    // "Ask before every action" covers the site permission's actions, except tools that ask on their own.
    assert.equal(spec.gates.includes('confirm'), ACTIONS_NEEDING_CONFIRMATION.has(name) && !spec.confirmsItself, `${name}: confirm`);
    // Nothing that asks the user runs unseen in the background.
    assert.ok(!(spec.background && spec.confirmsItself), `${name}: background and confirms itself`);
  }
  assert.deepEqual(TOOL_TABLE.type.gates, ['site', 'secret', 'personal', 'press', 'confirm']);
  assert.deepEqual(TOOL_TABLE.click.gates, ['site', 'press', 'confirm']);
  assert.deepEqual(TOOL_TABLE.download_file.gates, ['site', 'outbound']);
});

test('download_file: a model-written address carrying the user\'s details is asked about, and nothing is requested first', async () => {
  const { ctx, order, world } = setup();
  const out = await executeTool('download_file', { url: 'https://kettle-manuals.example/get?phone=5324187705' }, ctx);
  assert.equal(out.isError, true);
  assert.match(out.content, /Not opened: the address carries details from the user's memory/);
  assert.equal(order.length, 1);
  assert.match(order[0], /^dialog: /);
  assert.equal(order.filter((o) => o.startsWith('request')).length, 0);
  assert.equal(world.log.cards.length, 0);
});

test('download_file: an ordinary model-written address is not requested before the download dialog is answered', async () => {
  const { ctx, order } = setup();
  const out = await executeTool('download_file', { url: 'https://www.mutfakdunyasi.com.tr/manuals/kettle.pdf' }, ctx);
  assert.match(out.content, /declined the download/);
  assert.deepEqual(order.map((o) => o.split(':')[0]), ['dialog'], order.join('\n'));
});

test('incognito tabs: no title or address in a normal conversation; reading or switching makes it incognito first', async () => {
  const { browser, ctx } = setup();
  const secret = browser.openTab('https://clinic.example/results/4471', { incognito: true, activate: false });
  secret.title = 'Test results – Deniz Arslan';
  const listed = await executeTool('list_tabs', {}, ctx);
  assert.ok(!listed.content.includes('clinic.example') && !listed.content.includes('Deniz'), listed.content);
  assert.match(listed.content, new RegExp(`id=${secret.id} .*incognito`));
  // The step line of a tab call never names an incognito tab.
  const input = { tab_id: secret.id };
  await prepareStepTarget('close_tab', input, browser, ctx.agentTab.id);
  assert.equal(stepTabTitle(input), '');
  // Switching to it: the conversation is incognito before its address is in a result.
  const switched = await executeTool('switch_tab', { tab_id: secret.id }, ctx);
  assert.equal(ctx.privacy?.touchedIncognito, true);
  assert.match(switched.content, /clinic\.example/);
  const now = await executeTool('list_tabs', {}, ctx);
  assert.match(now.content, /clinic\.example/);
});

test('the user closed the assistant\'s tab: the next page call fails clearly and nothing touches the tab on screen', async () => {
  const { browser, agent, ctx } = setup();
  const opened = browser.openTab('https://shop.example/cart');
  ctx.agentTab.id = opened.id;
  browser.closeTab(opened.id);
  const onScreen = browser.active;
  assert.equal(onScreen.id, agent.id);
  const ran: string[] = [];
  onScreen.run = (async (command: string) => {
    ran.push(command);
    return null;
  }) as never;
  for (const [name, input] of [
    ['click', { ref: 12 }],
    ['type', { ref: 4, text: 'hello' }],
    ['read_page', {}],
    ['navigate', { url: 'https://shop.example/' }],
    ['download_file', { ref: 7 }],
  ] as const) {
    const out = await executeTool(name, { ...input }, ctx);
    assert.equal(out.isError, true, name);
    assert.match(out.content, /was closed, so nothing was done/, name);
  }
  assert.deepEqual(ran, []);
  assert.equal(ctx.agentTab.id, opened.id, 'the assistant is not moved to the tab on screen');
  // The tab tools still work, and switching is how it goes on.
  assert.match((await executeTool('list_tabs', {}, ctx)).content, new RegExp(`id=${agent.id}`));
  assert.match((await executeTool('take_notes', { notes: 'x' }, ctx)).content, /Noted/);
  await executeTool('switch_tab', { tab_id: agent.id }, ctx);
  assert.equal(ctx.agentTab.id, agent.id);
  await executeTool('read_page', {}, ctx);
  assert.deepEqual(ran, ['readPage']);
});
