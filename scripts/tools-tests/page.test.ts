// The page tools (src/agent/tools/page.ts) once a call passed its checks, against a fake tab that answers the page
// script's commands: what the model reads after reading, navigating, clicking, typing, scrolling and click_at, form
// errors, the wrapped site-rule, script and page-customisation steps, and errors.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ToolContext } from '../../src/agent/executeTool.ts';
import { formatPage, formatSource, pageCustomStep, pageTool, scriptStep, siteRulesStep } from '../../src/agent/tools/page.ts';
import type { Tab } from '../../src/browser/Tab.ts';
import { PermissionDeniedError } from '../../src/device/settings.ts';
import { pageErrorNotice } from '../../src/agent/stepLine.ts';
import { windowKey } from '../../src/ui/layout.ts';
import { Dimensions } from 'react-native';

type Answers = Record<string, (args: unknown[]) => unknown>;

function fakeTab(answers: Answers = {}, over: Record<string, unknown> = {}) {
  const calls: [string, unknown[]][] = [];
  const tab = {
    id: 'tab-1',
    url: 'https://shop.example/',
    title: 'Shop',
    isNewTab: false,
    reader: false,
    asleep: false,
    incognito: false,
    loadError: null as null | { description: string; kind: string },
    modelScreenshotSize: null as null | { width: number; height: number; window: string },
    async run(command: string, args: unknown[] = []) {
      calls.push([command, args]);
      const answer = answers[command];
      if (!answer) throw new Error(`no answer for ${command}`);
      return answer(args);
    },
    async settle() {},
    async navigate(url: string) {
      calls.push(['navigate', [url]]);
      tab.url = url;
    },
    async goBack() {
      tab.url = 'https://shop.example/previous';
    },
    ...over,
  };
  return { tab, calls };
}

function ctxFor(tab: ReturnType<typeof fakeTab>['tab'], extra: Partial<ToolContext> = {}) {
  const tabs = [tab as unknown as Tab];
  const ctx = {
    browser: { tabs, getTab: (id: string) => tabs.find((t) => t.id === id), activeId: tab.id },
    agentTab: { id: tab.id },
    ...extra,
  } as unknown as ToolContext;
  return { ctx, tabs };
}

const page = (over = {}) => ({
  url: 'https://shop.example/',
  title: 'Shop',
  scroll: { y: 0, viewportHeight: 800, pageHeight: 2400 },
  truncated: false,
  nextOffset: null,
  content: '[1] button "Buy"',
  ...over,
});

test('read_page: the page between untrusted markers, a header the app wrote, and the outbound guard sees it', async () => {
  const { tab } = fakeTab({ readPage: () => page({ truncated: true, nextOffset: 4000, formErrors: ['ref=3 "Email": required'] }) });
  const noted: string[] = [];
  const { ctx } = ctxFor(tab, { outbound: { notePage: (content: string) => noted.push(content) } as never });
  const out = await pageTool('read_page', {}, ctx, tab as unknown as Tab);
  assert.equal(out.isError, false);
  assert.match(out.content, /^Tab: tab-1\nURL: https:\/\/shop.example\/\nScroll: y=0, viewport=800, page height=2400\n/);
  assert.match(out.content, /Title: Shop\nForm errors:\n- ref=3 "Email": required\n\n\[1\] button "Buy"/);
  assert.match(out.content, /\[Content truncated\. Call read_page with offset=4000 to read the rest\.\]$/);
  assert.deepEqual(noted, ['[1] button "Buy"']);
});

test('formatPage names a failed load first; read_tab\'s note names the tab', () => {
  const { tab } = fakeTab({}, { loadError: { description: 'Not found', kind: 'http' } });
  const text = formatPage(tab as unknown as Tab, page({ truncated: true, nextOffset: 10 }), 'read_tab');
  assert.match(text, /^Page failed to load: Not found \(http\)\n/);
  assert.match(text, /Call read_tab with tab_id=tab-1 and offset=10/);
});

test('read_source: whole page or a selector, with the range read', async () => {
  const { tab, calls } = fakeTab({
    readSource: ([, selector]) => ({ url: tab.url, title: 'Shop', total: 900, matches: selector ? 2 : null, offset: 0, truncated: true, nextOffset: 500, content: '<div>' }),
  });
  const { ctx } = ctxFor(tab);
  const out = await pageTool('read_source', { selector: ' .price ' }, ctx, tab as unknown as Tab);
  assert.deepEqual(calls[0], ['readSource', [0, '.price']]);
  assert.match(out.content, /Selector: \.price \(2 element\(s\)\)\nCharacters 0–5 of 900/);
  assert.match(out.content, /Call read_source with selector="\.price" and offset=500/);
  const whole = formatSource(tab as unknown as Tab, { url: 'u', title: 't', total: 5, matches: null, offset: 0, truncated: false, nextOffset: null, content: 'abcde' }, '');
  assert.match(whole, /HTML source from the DOM/);
});

test('navigate: an address without a scheme gets https; a failed load is an error', async () => {
  const { tab, calls } = fakeTab();
  const { ctx } = ctxFor(tab);
  const ok = await pageTool('navigate', { url: 'example.org/path' }, ctx, tab as unknown as Tab);
  assert.deepEqual(calls[0], ['navigate', ['https://example.org/path']]);
  assert.equal(ok.content, 'Opened https://example.org/path. Call read_page to see it.');
  tab.loadError = { description: 'Host not found', kind: 'dns' };
  const failed = await pageTool('navigate', { url: 'https://nowhere.invalid' }, ctx, tab as unknown as Tab);
  assert.equal(failed.isError, true);
  assert.equal(failed.content, 'Could not load https://nowhere.invalid: Host not found (dns).');
});

test('go_back says where it is now', async () => {
  const { tab } = fakeTab();
  const { ctx } = ctxFor(tab);
  assert.equal((await pageTool('go_back', {}, ctx, tab as unknown as Tab)).content, 'Went back. Now at https://shop.example/previous.');
});

test('click: the page\'s answer, a page change, a new tab it opened (the assistant moves there), form errors', async () => {
  // Same page, form errors after the press.
  let { tab } = fakeTab({ click: () => 'Clicked "Buy".', formReport: () => ['"Card": required'] });
  let { ctx } = ctxFor(tab);
  let out = await pageTool('click', { ref: 1 }, ctx, tab as unknown as Tab);
  assert.equal(out.content, 'Clicked "Buy".\nThe form reports errors:\n- "Card": required\nFix these before submitting again.');

  // The page changed.
  ({ tab } = fakeTab({ click: () => { tab.url = 'https://shop.example/cart'; return 'Clicked "Cart".'; } }));
  ({ ctx } = ctxFor(tab));
  out = await pageTool('click', { ref: 2 }, ctx, tab as unknown as Tab);
  assert.equal(out.content, 'Clicked "Cart". Page changed to https://shop.example/cart.');

  // A new tab.
  const made = fakeTab();
  const fresh = { ...fakeTab().tab, id: 'tab-2', url: 'https://help.example/' };
  ({ tab } = made);
  const world = ctxFor(tab);
  tab.run = async () => {
    world.tabs.push(fresh as unknown as Tab);
    return 'Clicked "Help".';
  };
  out = await pageTool('click', { ref: 3 }, world.ctx, tab as unknown as Tab);
  assert.equal(out.content, 'Clicked "Help". It opened a new tab (id=tab-2, https://help.example/); you are now in it.');
  assert.equal(world.ctx.agentTab.id, 'tab-2');
});

test('type: the text goes to the page; a hidden memory\'s value goes to the page but never into the result', async () => {
  const { tab, calls } = fakeTab({ type: () => 'Typed into "Name".', formReport: () => [] });
  const { ctx } = ctxFor(tab);
  const out = await pageTool('type', { ref: 4, text: 'Ada' }, ctx, tab as unknown as Tab);
  assert.equal(out.content, 'Typed into "Name".');
  assert.deepEqual(calls[0], ['type', [4, 'Ada', true, false]]);

  const memory = { id: 'm1', text: 'Passport number: X1234567', category: 'personal', sensitive: true, label: 'passport number' };
  const hidden = await pageTool('type', { ref: 5, memory: 'm1', submit: true }, ctx, tab as unknown as Tab, memory as never);
  const typed = calls.find((c, i) => i > 0 && c[0] === 'type')!;
  assert.match(String(typed[1][1]), /X1234567/);
  assert.doesNotMatch(hidden.content, /X1234567/);
  assert.match(hidden.content, /^Entered the saved .+ into ref=5 and submitted; the value stays hidden from you\./);
});

test('scroll_to and select_option pass the page\'s answer through', async () => {
  const { tab } = fakeTab({ scrollTo: () => 'Scrolled to ref=9.', select: ([, v]) => `Selected ${v}.`, formReport: () => [] });
  const { ctx } = ctxFor(tab);
  assert.equal((await pageTool('scroll_to', { ref: 9 }, ctx, tab as unknown as Tab)).content, 'Scrolled to ref=9.');
  assert.equal((await pageTool('select_option', { ref: 9, value: 'L' }, ctx, tab as unknown as Tab)).content, 'Selected L.');
});

test('click_at needs a screenshot first and a point inside it; then the old coordinates are dropped', async () => {
  const { tab, calls } = fakeTab({ clickAt: () => 'Clicked at the point' });
  const { ctx } = ctxFor(tab);
  const before = await pageTool('click_at', { x: 10, y: 10 }, ctx, tab as unknown as Tab);
  assert.equal(before.content, 'Call view_screenshot first; click_at uses its pixel coordinates.');
  // The window key the stand-in Dimensions gives (the same one the screenshot would have stored).
  const key = windowKey(Dimensions.get('window'));
  tab.modelScreenshotSize = { width: 400, height: 800, window: key };
  const outside = await pageTool('click_at', { x: 500, y: 10 }, ctx, tab as unknown as Tab);
  assert.equal(outside.content, 'x and y must be inside the screenshot (0–400, 0–800).');
  const ok = await pageTool('click_at', { x: 100, y: 200 }, ctx, tab as unknown as Tab);
  assert.deepEqual(calls.at(-1), ['clickAt', [0.25, 0.25]]);
  assert.equal(ok.content, 'Clicked at the point. Take a new screenshot to see the result.');
  assert.equal(tab.modelScreenshotSize, null);
});

test('an unknown name is refused; a page error and a missing permission are explained', async () => {
  const { tab } = fakeTab({ scroll: () => { throw new Error('boom'); } });
  const { ctx } = ctxFor(tab);
  const unknown = await pageTool('fly', {}, ctx, tab as unknown as Tab);
  assert.deepEqual(unknown, { content: 'Unknown tool: fly', isError: true });
  const failed = await pageTool('scroll', { direction: 'down' }, ctx, tab as unknown as Tab);
  assert.equal(failed.isError, true);
  assert.equal(failed.content, 'Error: boom');
  assert.deepEqual(failed.notice, pageErrorNotice(new Error('boom')));
  tab.run = async () => { throw new PermissionDeniedError('Photos are not allowed.', false); };
  const denied = await pageTool('scroll_to', { ref: 1 }, ctx, tab as unknown as Tab);
  assert.match(denied.content, /^Permission denied: Photos are not allowed\. Offer the user/);
  assert.equal(denied.notice, undefined);
});

test('the wrapped steps: site rules need a page; a page or script that fails is reported with a notice', async () => {
  const { tab } = fakeTab({}, { isNewTab: true });
  const { ctx } = ctxFor(tab);
  const noPage = await siteRulesStep('site_rules', {}, ctx, tab as unknown as Tab);
  assert.equal(noPage.content, 'This tab shows the new tab page; open a web page first.');
  assert.ok(noPage.notice);
  tab.isNewTab = false;
  const silent = await siteRulesStep('try_hide', { description: 'x' }, ctx, tab as unknown as Tab);
  assert.equal(silent.isError, true);
  const script = await scriptStep('run_script', { code: '1' }, ctx, tab as unknown as Tab);
  assert.equal(script.isError, true);
  const styles = await pageCustomStep('page_cookies', { action: 'list' }, ctx, tab as unknown as Tab);
  assert.equal(styles.isError, true);
});
