// Kept scripts at run time (src/browser/keptScripts.ts, docs/page-customisation.md › Kept scripts): only sealed,
// switched-on scripts whose scope covers the tab's own address run, once per page load, never while the setting is
// off, in private tabs, on read-only, blocked or "scripts off" sites, with "Scripts off for this page", or on sensitive
// pages; the page can't add runs or report runs that weren't injected.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SiteLevel } from '../../src/agent/sitePolicy.ts';
import type { SiteScriptSetting } from '../../src/agent/scriptTool.ts';
import { keptScripts, type KeptTab } from '../../src/browser/keptScripts.ts';
import { scriptSeal, type ScriptLastRun, type UserScript } from '../../src/content/userScripts.ts';

const KEY = new Uint8Array(32).fill(3);

function script(id: string, extra: Partial<UserScript> = {}): UserScript {
  const code = extra.code ?? `document.body.dataset.k = "${id}";`;
  return { id, name: id, scope: 'example.com', code, runAt: 'end', enabled: true, seal: scriptSeal(code, KEY), source: 'assistant', site: 'example.com', createdAt: 1, ...extra };
}

function setup(options: { enabled?: boolean; level?: SiteLevel; site?: SiteScriptSetting; scripts?: UserScript[] } = {}) {
  const runs: { id: string; run: ScriptLastRun }[] = [];
  const state = { enabled: options.enabled ?? true, scripts: options.scripts ?? [script('a'), script('b', { runAt: 'idle' })] };
  keptScripts.configure({
    enabled: () => state.enabled,
    levelFor: () => options.level ?? 'default',
    siteSetting: () => options.site ?? 'default',
    scripts: () => state.scripts,
    key: () => KEY,
    recordRun: (id, run) => runs.push({ id, run }),
  });
  const injected: string[] = [];
  const tab: KeptTab = {
    id: `tab${Math.random()}`,
    url: 'https://example.com/list#x',
    incognito: false,
    messageNonce: 'N1',
    documents: 1,
    webview: { injectJavaScript: (code) => injected.push(code) },
  };
  const ready = (phase: string, url = 'https://example.com/list', facts = { password: false, oneTimeCode: false, card: false }) =>
    keptScripts.handleMessage(tab, JSON.stringify({ __qutaiKept: 'N1', phase, url, facts }));
  const ran = () => injected.map((code) => /id: "([^"]+)"|var ID = "([^"]+)"/.exec(code)?.[2] ?? '?');
  return { tab, ready, ran, runs, injected, state };
}

test('the scripts of the run time run once per page load; a new load runs them again', () => {
  const s = setup();
  s.ready('end');
  assert.deepEqual(s.ran(), ['a']);
  s.ready('end');
  s.ready('idle');
  assert.deepEqual(s.ran(), ['a', 'b']);
  s.ready('idle');
  assert.deepEqual(s.ran(), ['a', 'b'], 'never twice on one page');
  s.tab.documents = 2;
  s.ready('end');
  assert.deepEqual(s.ran(), ['a', 'b', 'a']);
  assert.ok(s.injected[0].includes(`"use strict";\n${s.state.scripts[0].code}\n  };`));
});

test('after the page moves itself, a script that now applies and has not run yet runs once', () => {
  const s = setup({ scripts: [script('list', { scope: 'https://example.com/list' }), script('item', { scope: 'https://example.com/item' })] });
  s.ready('end');
  assert.deepEqual(s.ran(), ['list']);
  s.tab.url = 'https://example.com/item';
  s.ready('spa', 'https://example.com/item');
  s.ready('spa', 'https://example.com/item');
  assert.deepEqual(s.ran(), ['list', 'item']);
});

test('nothing runs: setting off, private tab, read-only or blocked site, scripts off for the site or this page', () => {
  for (const options of [{ enabled: false }, { level: 'readonly' as const }, { level: 'blocked' as const }, { site: 'off' as const }]) {
    const s = setup(options);
    s.ready('end');
    assert.deepEqual(s.ran(), [], JSON.stringify(options));
  }
  const priv = setup();
  priv.tab.incognito = true;
  priv.ready('end');
  assert.deepEqual(priv.ran(), []);
  const off = setup();
  keptScripts.setOff(off.tab.id, true);
  off.ready('end');
  assert.deepEqual(off.ran(), []);
  keptScripts.setOff(off.tab.id, false);
  off.ready('end');
  assert.deepEqual(off.ran(), ['a']);
});

test('only sealed, switched-on scripts for this address; the page must report the tab’s own address', () => {
  const s = setup({
    scripts: [
      script('off', { enabled: false }),
      script('unsealed', { seal: null }),
      script('edited', { seal: scriptSeal('older code', KEY) }),
      script('elsewhere', { scope: 'other.example' }),
      script('ok'),
    ],
  });
  s.ready('end', 'https://evil.example/');
  assert.deepEqual(s.ran(), [], 'a page claiming another address gets nothing');
  s.ready('end');
  assert.deepEqual(s.ran(), ['ok']);
});

test('sensitive pages are skipped (and the skip recorded once) unless the site allows scripts there', () => {
  const s = setup();
  s.ready('end', 'https://example.com/list', { password: true, oneTimeCode: false, card: false });
  s.ready('end', 'https://example.com/list', { password: true, oneTimeCode: false, card: false });
  assert.deepEqual(s.ran(), []);
  assert.deepEqual(s.runs.map((r) => [r.id, r.run.status]), [['a', 'skipped']]);
  const allowed = setup({ site: 'sensitive' });
  allowed.ready('end', 'https://example.com/list', { password: true, oneTimeCode: false, card: false });
  assert.deepEqual(allowed.ran(), ['a']);
  const login = setup();
  login.tab.url = 'https://example.com/login';
  login.ready('end', 'https://example.com/login');
  assert.deepEqual(login.ran(), []);
});

test('run reports count only for runs injected on this load; never a value, only an error kind', () => {
  const s = setup();
  const report = (msg: Record<string, unknown>) => keptScripts.handleMessage(s.tab, JSON.stringify({ __qutaiScript: 'N1', ...msg }));
  report({ id: 'a', load: 1, status: 'ok' });
  assert.equal(s.runs.length, 0, 'not injected yet: the page made it up');
  s.ready('end');
  report({ id: 'a', load: 0, status: 'ok' });
  assert.equal(s.runs.length, 0, 'an older load');
  report({ id: 'a', load: 1, status: 'error', error: 'TypeError: secret page text 123' });
  assert.equal(s.runs.length, 1);
  assert.equal(s.runs[0].run.status, 'error');
  assert.equal(s.runs[0].run.error, 'Error', 'only a standard error kind is kept, never page text');
  report({ id: 'a', load: 1, status: 'error', error: 'RangeError' });
  assert.equal(s.runs[1].run.error, 'RangeError');
  assert.equal(keptScripts.handleMessage(s.tab, JSON.stringify({ __qutaiScript: 'OTHER', id: 'a', load: 1, status: 'ok' })), false);
  assert.equal(keptScripts.handleMessage(s.tab, 'not json'), false);
});
