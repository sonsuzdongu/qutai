// restyle_page and page_cookies (src/agent/pageCustomTool.ts, docs/page-customisation.md): CSS is sanitised before the
// user is asked, nothing touches the page without the approval, site modes refuse what they must, and cookie values
// never reach the model's text, the step line or anything the tool returns.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ToolContext } from '../../src/agent/executeTool.ts';
import { pageCustomTool, type CookieAccess, type PageStylesAccess, type StyleApproval } from '../../src/agent/pageCustomTool.ts';
import { PAGE_CUSTOM_TOOLS } from '../../src/agent/pageCustomTools.ts';
import { decide, policyName } from '../../src/agent/sitePolicy.ts';
import { SYSTEM_PROMPT } from '../../src/agent/systemPrompt.ts';
import { TOOLS } from '../../src/agent/tools.ts';
import type { Tab } from '../../src/browser/Tab.ts';
import { cookieMetadata, formatCookieList, parseCookieInfoLine, type StoreCookie } from '../../src/content/cookieInfo.ts';

const tabAt = (url: string, incognito = false) => ({ url, incognito, id: 't1' }) as unknown as Tab;

function stylesAccess(answer: boolean) {
  const asked: StyleApproval[] = [];
  const applied: { css: string; description: string }[] = [];
  const access: PageStylesAccess = {
    approve: async (a) => {
      asked.push(a);
      return answer;
    },
    applyTrial: async (_tab, css, description) => {
      applied.push({ css, description });
    },
    undoTrial: async () => true,
    kept: () => [],
  };
  return { access, asked, applied };
}

const ctxWith = (extra: Partial<ToolContext>) => extra as ToolContext;

test('the tools are offered and the prompt points at them, briefly', () => {
  const names = TOOLS.map((t) => t.name);
  for (const tool of PAGE_CUSTOM_TOOLS) assert.ok(names.includes(tool.name), tool.name);
  assert.match(SYSTEM_PROMPT, /restyle_page apply/);
  assert.match(SYSTEM_PROMPT, /make the links red/);
  assert.match(SYSTEM_PROMPT, /page_cookies list; you never see values/);
  assert.match(SYSTEM_PROMPT, /tracker is a judgement/);
  for (const tool of PAGE_CUSTOM_TOOLS) assert.ok(tool.description.length < 400, `${tool.name} description stays short`);
});

test('site modes: blocked refuses everything, read-only refuses applying styles and deleting cookies only', () => {
  const cases: [string, Record<string, unknown>, 'readonly' | 'blocked', 'refuse' | 'run'][] = [
    ['restyle_page', { action: 'apply' }, 'readonly', 'refuse'],
    ['restyle_page', { action: 'undo' }, 'readonly', 'run'],
    ['restyle_page', { action: 'list' }, 'readonly', 'run'],
    ['page_cookies', { action: 'list' }, 'readonly', 'run'],
    ['page_cookies', { action: 'delete' }, 'readonly', 'refuse'],
    ['restyle_page', { action: 'apply' }, 'blocked', 'refuse'],
    ['page_cookies', { action: 'list' }, 'blocked', 'refuse'],
    ['page_cookies', { action: 'delete' }, 'blocked', 'refuse'],
  ];
  for (const [name, input, level, expected] of cases) {
    const decision = decide(policyName(name, input), 'example.com', level, false);
    assert.equal(decision.kind === 'refuse' ? 'refuse' : 'run', expected, `${name} ${String(input.action)} on ${level}`);
  }
});

test('refused CSS never reaches the approval or the page', async () => {
  const { access, asked, applied } = stylesAccess(true);
  for (const css of ['@import "https://e/x.css";', 'a{background:url(https://e/x)}', '[data-qutai]{display:none}', '']) {
    const out = await pageCustomTool('restyle_page', { action: 'apply', css, description: 'x' }, ctxWith({ pageStyles: access }), tabAt('https://example.com/'));
    assert.equal(out.isError, true, css);
  }
  assert.equal(asked.length, 0);
  assert.equal(applied.length, 0);
});

test('a style is applied only after approval, as the sanitised CSS', async () => {
  const declined = stylesAccess(false);
  const no = await pageCustomTool('restyle_page', { action: 'apply', css: 'a{color:red}', description: 'Red links' }, ctxWith({ pageStyles: declined.access }), tabAt('https://example.com/'));
  assert.equal(no.isError, true);
  assert.equal(declined.applied.length, 0, 'declined: nothing applied');

  const approved = stylesAccess(true);
  const yes = await pageCustomTool(
    'restyle_page',
    { action: 'apply', css: 'a{color:red} /* comment */', description: '  Red   links ' },
    ctxWith({ pageStyles: approved.access }),
    tabAt('https://www.example.com/x#y'),
  );
  assert.equal(yes.isError, false);
  assert.deepEqual(approved.asked[0], { site: 'example.com', url: 'https://www.example.com/x#y', description: 'Red links', css: 'a {\n  color: red !important;\n}\n', incognito: false });
  assert.deepEqual(approved.applied, [{ css: 'a {\n  color: red !important;\n}\n', description: 'Red links' }]);
  assert.match(yes.content, /never keep it yourself/);
});

test('incognito: the approval says so and the result says nothing is kept', async () => {
  const { access, asked } = stylesAccess(true);
  const out = await pageCustomTool('restyle_page', { action: 'apply', css: 'a{color:red}', description: 'Red' }, ctxWith({ pageStyles: access }), tabAt('https://example.com/', true));
  assert.equal(asked[0].incognito, true);
  assert.match(out.content, /incognito tab: nothing is saved/);
});

test('a description is required', async () => {
  const { access, asked } = stylesAccess(true);
  const out = await pageCustomTool('restyle_page', { action: 'apply', css: 'a{color:red}' }, ctxWith({ pageStyles: access }), tabAt('https://example.com/'));
  assert.equal(out.isError, true);
  assert.equal(asked.length, 0);
});

const SECRET = 'S3cr3t-VALUE-must-not-leak';
const COOKIES: StoreCookie[] = [
  parseCookieInfoLine(`SID=${SECRET}; Domain=.example.com; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Secure; HttpOnly; SameSite=Lax`, 'https://example.com/')!,
  parseCookieInfoLine(`theme=${SECRET}2; Path=/`, 'https://example.com/')!,
  parseCookieInfoLine(`_ga=${SECRET}3; Domain=.tracker.example.net; Path=/; SameSite=None; Secure`, 'https://tracker.example.net/')!,
];

function cookieAccess(answer: boolean) {
  const removed: unknown[] = [];
  const offered: unknown[] = [];
  const asked: unknown[] = [];
  const access: CookieAccess = {
    read: async () => ({ cookies: COOKIES, detailed: true, platform: 'android' }),
    remove: async (_tab, keys) => {
      removed.push(...keys);
      return keys.length;
    },
    confirmDelete: async (a) => {
      asked.push(a);
      return answer;
    },
    offer: (_tab, site, count) => offered.push({ site, count }),
  };
  return { access, removed, offered, asked };
}

test('cookie list: metadata and handles only; no value in the text, the card or the metadata', async () => {
  const { access, offered } = cookieAccess(true);
  const tab = tabAt('https://example.com/');
  const out = await pageCustomTool('page_cookies', { action: 'list' }, ctxWith({ cookies: access }), tab);
  assert.equal(out.isError, false);
  assert.ok(!out.content.includes(SECRET), 'no value in what the model reads');
  assert.ok(!JSON.stringify(out).includes(SECRET), 'nor anywhere in the tool output');
  assert.ok(!JSON.stringify(offered).includes(SECRET), 'nor in the card');
  assert.match(out.content, /\[c1\] "SID": path \/, expires 2037-10-21, \d+ chars, HttpOnly, Secure, SameSite=Lax/);
  assert.match(out.content, /example\.com \(first-party, 2\)/);
  assert.match(out.content, /tracker\.example\.net \(third-party, 1\)/);
  assert.match(out.content, /judgement/);
  const { list } = cookieMetadata(COOKIES, 'example.com');
  for (const meta of list) {
    assert.deepEqual(Object.keys(meta).sort(), ['domain', 'expires', 'handle', 'httpOnly', 'limited', 'name', 'party', 'path', 'sameSite', 'secure', 'size'].sort());
    assert.ok(!JSON.stringify(meta).includes(SECRET));
  }
  assert.ok(!formatCookieList(list, 'example.com', '').includes(SECRET));
});

test('cookie delete: only handles of the last list of this page, only after approval', async () => {
  const tab = tabAt('https://example.com/');
  const first = cookieAccess(true);
  const before = await pageCustomTool('page_cookies', { action: 'delete', handles: ['c1'] }, ctxWith({ cookies: first.access }), tabAt('https://example.com/'));
  assert.equal(before.isError, true, 'no list yet for this tab');

  await pageCustomTool('page_cookies', { action: 'list' }, ctxWith({ cookies: first.access }), tab);
  const unknown = await pageCustomTool('page_cookies', { action: 'delete', handles: ['c99'] }, ctxWith({ cookies: first.access }), tab);
  assert.equal(unknown.isError, true);
  assert.equal(first.asked.length, 0);

  const declined = cookieAccess(false);
  await pageCustomTool('page_cookies', { action: 'list' }, ctxWith({ cookies: declined.access }), tab);
  const no = await pageCustomTool('page_cookies', { action: 'delete', handles: ['c1'] }, ctxWith({ cookies: declined.access }), tab);
  assert.equal(no.isError, true);
  assert.equal(declined.removed.length, 0, 'declined: nothing deleted');
  assert.ok(!JSON.stringify(declined.asked).includes(SECRET), 'the approval shows names and domains, never values');

  // Approved: the same listing's handles still work.
  const yes = await pageCustomTool('page_cookies', { action: 'delete', handles: ['c1', 'c3'] }, ctxWith({ cookies: first.access }), tab);
  assert.equal(yes.isError, false);
  assert.equal(first.removed.length, 2);
  assert.ok(!JSON.stringify(first.removed).includes(SECRET), 'deleting goes by key, never by value');
  assert.match(yes.content, /sign in/);
});

test('the page moved on: old handles are refused', async () => {
  const { access } = cookieAccess(true);
  const tab = tabAt('https://example.com/a') as unknown as { url: string };
  await pageCustomTool('page_cookies', { action: 'list' }, ctxWith({ cookies: access }), tab as unknown as Tab);
  tab.url = 'https://example.com/b';
  const out = await pageCustomTool('page_cookies', { action: 'delete', handles: ['c1'] }, ctxWith({ cookies: access }), tab as unknown as Tab);
  assert.equal(out.isError, true);
});
