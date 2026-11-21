// "Deneme adlı görevi çalıştır" through the app's real tool pipeline (src/agent/executeTool.ts, TOOL-30), after the
// 21 Nov split of the tools into src/agent/tools/: list_saved_tasks and get_saved_task reach the saved tasks the
// panel gives them (TASK-7), work in an incognito conversation like the saved tasks list, ask nothing themselves,
// and running a saved task changes no approval: the page actions it leads to still ask as before. Its text reaches
// the model as a tool result, so the address, memory and settings checks, which read only the user's own messages,
// never take it for something the user typed (they may ask more, never less).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeTool, type ToolContext } from '../../src/agent/executeTool.ts';
import type { SavedTasksAccess } from '../../src/agent/savedTaskTool.ts';
import { TOOL_TABLE } from '../../src/agent/toolTable.ts';
import { TOOLS } from '../../src/agent/tools.ts';
import { Browser } from '../../src/browser/Browser.ts';
import type { SavedTask } from '../../src/storage/savedTasks.ts';

const task = (id: string, name: string, prompt: string, over: Partial<SavedTask> = {}) =>
  ({ id, name, prompt, target: 'current', url: null, research: false, ...over }) as unknown as SavedTask;

function setup({ incognito = false, confirmByDefault = false } = {}) {
  const browser = new Browser();
  const tab = browser.active;
  tab.url = 'https://www.example.com/';
  if (incognito) (tab as unknown as { incognito: boolean }).incognito = true;
  const used: string[] = [];
  const asked: unknown[] = [];
  const savedTasks: SavedTasksAccess = {
    list: async () => [
      task('t1', 'Deneme', 'Bugünün ({date}) hava durumunu bul ve bana özetle.'),
      task('t2', 'Haftalık alışveriş', 'Sepetimi kontrol et.'),
    ],
    fill: (prompt) => prompt.replace('{date}', '21.11.2026'),
    markUsed: (id) => used.push(id),
  };
  const ctx = {
    browser,
    agentTab: { id: tab.id },
    askedFrom: { id: tab.id },
    privacy: { touchedIncognito: incognito },
    confirmByDefault,
    sites: { levelFor: () => 'default', personalFor: () => 'ask' },
    savedTasks,
    confirm: async (description: unknown) => {
      asked.push(description);
      return false;
    },
  } as unknown as ToolContext;
  return { ctx, used, asked };
}

test('both saved-task tools are offered to the model and have a row in the pipeline table', () => {
  for (const name of ['list_saved_tasks', 'get_saved_task']) {
    assert.ok(TOOLS.some((t) => t.name === name), `${name} in TOOLS`);
    assert.ok(name in TOOL_TABLE, `${name} in TOOL_TABLE`);
  }
});

test('"Deneme adlı görevi çalıştır": found by name through executeTool, its text given to carry out, marked used, nothing asked', async () => {
  const { ctx, used, asked } = setup();
  const out = await executeTool('get_saved_task', { name: 'deneme' }, ctx);
  assert.equal(out.isError, false);
  assert.match(out.content, /Saved task "Deneme" \(id t1\), written by the user/);
  assert.match(out.content, /Bugünün \(21\.11\.2026\) hava durumunu bul/);
  assert.match(out.content, /under the usual safety and confirmation rules/);
  assert.deepEqual(used, ['t1']);
  assert.equal(asked.length, 0);
});

test('list_saved_tasks through executeTool lists every task by name and id', async () => {
  const { ctx, asked } = setup();
  const out = await executeTool('list_saved_tasks', {}, ctx);
  assert.equal(out.isError, false);
  assert.match(out.content, /"Deneme" \(id t1\)/);
  assert.match(out.content, /"Haftalık alışveriş" \(id t2\)/);
  assert.equal(asked.length, 0);
});

test('an incognito conversation can run a saved task too, like the saved tasks list in the panel', async () => {
  const { ctx, used } = setup({ incognito: true });
  const out = await executeTool('get_saved_task', { name: 'Deneme' }, ctx);
  assert.equal(out.isError, false);
  assert.deepEqual(used, ['t1']);
});

test('running a saved task skips no approval: with "Ask before every action" on, the next page action still asks', async () => {
  const { ctx, asked } = setup({ confirmByDefault: true });
  await executeTool('get_saved_task', { name: 'Deneme' }, ctx);
  assert.equal(asked.length, 0);
  const out = await executeTool('navigate', { url: 'https://www.example.com/weather' }, ctx);
  assert.equal(asked.length, 1, 'the navigation asked');
  assert.equal(out.isError, true);
  assert.match(out.content, /declined/);
});
