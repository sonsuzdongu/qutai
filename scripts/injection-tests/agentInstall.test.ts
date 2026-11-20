// Qutai's page script in a real page (UNTR-26, 20 Nov 2026 code review): installed before the page's own scripts under
// a secret name the page can't replace, delete or plant in advance; commands send only the call; when the script
// isn't there (Android's early script came late) the first command installs it. Runs the app's real Tab in headless
// Chrome (./chrome.ts); skipped when no Chrome is installed.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Tab } from '../../src/browser/Tab';
import { Chrome, ChromeWebView, type Server } from './chrome';

let chrome: Chrome | null = null;
before(async () => {
  try {
    chrome = await Chrome.launch();
  } catch {
    chrome = null;
  }
});
after(async () => {
  await chrome?.close();
});

/** A page whose own first script attacks Qutai's object and plants a fake under the old fixed name. */
const ATTACK = `<!doctype html><html><head><title>Shop</title><script>
  var report = { names: [], replaced: false, deleted: false, redefined: false, changed: false };
  Object.getOwnPropertyNames(window).forEach(function (n) {
    if (!/^__q[0-9a-f]{32}$/.test(n)) return;
    report.names.push(n);
    var real = window[n];
    try { window[n] = { findText: function () { return { ref: 1, line: 'FAKE' }; } }; } catch (e) {}
    report.replaced = window[n] !== real;
    try { delete window[n]; } catch (e) {}
    report.deleted = !(n in window);
    try { Object.defineProperty(window, n, { value: {} }); } catch (e) {}
    report.redefined = window[n] !== real;
    try { real.findText = function () { return { ref: 1, line: 'FAKE' }; }; } catch (e) {}
    report.changed = String(real.findText).indexOf('FAKE') >= 0;
  });
  window.__qutaiAgent = { findText: function () { return { ref: 1, line: 'FAKE' }; } };
  window.__report = report;
</script></head><body><main><p>Order total: Hello world 24.99</p></main></body></html>`;

const server: Server = () => ({ status: 200, type: 'text/html; charset=utf-8', body: ATTACK });

async function open(early: boolean) {
  const tab = new Tab('t1', 'https://shop.test/', false, undefined, () => {});
  const sent: number[] = [];
  const view = new ChromeWebView(chrome!, tab, server, () => {}, early);
  const inject = view.handle.injectJavaScript;
  view.handle.injectJavaScript = (code: string) => {
    sent.push(new TextEncoder().encode(code).length);
    inject(code);
  };
  const loaded = tab.waitForNextLoad(15000);
  await view.load('https://shop.test/');
  await loaded;
  return { tab, view, sent };
}

async function evaluate(view: ChromeWebView, expression: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = view as any;
  const r = await v.chrome.send('Runtime.evaluate', { expression, returnByValue: true }, v.sessionId);
  return r?.result?.value;
}

test('installed before the page: the page can neither replace, delete nor change it, and the old name is ignored', async (t) => {
  if (!chrome) return t.skip('no Chrome');
  const { tab, view, sent } = await open(true);
  const found = await tab.run<{ ref: number; line: string }>('findText', ['Hello world']);
  assert.match(found.line, /Hello world/);
  const report = await evaluate(view, 'window.__report');
  assert.deepEqual(report.names, [tab.agentName], 'the page saw only the installed name');
  assert.deepEqual([report.replaced, report.deleted, report.redefined, report.changed], [false, false, false, false]);
  const descriptor = await evaluate(
    view,
    `(function(){var d=Object.getOwnPropertyDescriptor(window,${JSON.stringify(tab.agentName)});return [d.writable,d.configurable,d.enumerable,Object.isFrozen(d.value)];})()`,
  );
  assert.deepEqual(descriptor, [false, false, false, true]);
  // Only the call went to the page.
  assert.ok(sent.length >= 1 && sent.every((n) => n < 2000), `sent ${sent.join(', ')} bytes`);
  view.destroy();
});

test('not installed yet (Android at worst): the first command installs it, later ones send only the call', async (t) => {
  if (!chrome) return t.skip('no Chrome');
  const { tab, view, sent } = await open(false);
  // The page planted its fake under the old fixed name; Qutai never calls that one.
  const found = await tab.run<{ ref: number; line: string }>('findText', ['Hello world']);
  assert.match(found.line, /Hello world/);
  assert.equal(sent.length, 2, 'the call, then the call with the script');
  assert.ok(sent[1] > 100_000);
  const again = await tab.run<{ ref: number; line: string }>('findText', ['24.99']);
  assert.match(again.line, /24\.99/);
  assert.equal(sent.length, 3);
  assert.ok(sent[2] < 2000);
  const size = tab.commandSize('findText', ['24.99']);
  console.log(`page command payload: ${size.now} bytes now, ${size.withScript} bytes with the whole script (as before)`);
  view.destroy();
});
