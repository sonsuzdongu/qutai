// The page-side half of the payment and secret-field guards (PAY-9, PAY-26, PAY-27; src/browser/pageScript.ts:
// secretKind, pressContext, CHECKOUT_PATH, totalOnPage, payFrame, paymentChoice, cardOnPage), checked in a real
// rendered page. scripts/page-tests/guards.html checks itself and prints PASS or FAIL per field and press; this runs
// it in headless Chrome (./chrome.ts) with the working copy's page script and the app's own press rule
// (src/agent/pressContext.ts, the page's POST /classify), as scripts/page-tests/serve.mjs does by hand. Nothing leaves
// the machine: every request is answered here. Skipped when no Chrome is installed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { PAGE_SCRIPT } from '../../src/browser/pageScript';
import { changePress, payPress } from '../../src/agent/pressContext';
import { Chrome } from './chrome';

const ROOT = join(import.meta.dirname, '..', '..');
const ORIGIN = 'https://guards.test';

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

/** The page script as serve.mjs gives it to the test pages: under window.__qutaiAgent instead of the app's secret name. */
const agentJs = `(function () {\nvar __qutaiAgent = {};\n${PAGE_SCRIPT}\nwindow.__qutaiAgent = __qutaiAgent;\n})();`;

function answer(url: string, method: string, postData: string | undefined): { status: number; type: string; body: string } {
  const path = new URL(url).pathname;
  if (path === '/agent.js') return { status: 200, type: 'text/javascript; charset=utf-8', body: agentJs };
  if (path === '/classify' && method === 'POST') {
    const facts = JSON.parse(postData ?? 'null');
    return { status: 200, type: 'application/json', body: JSON.stringify({ pay: payPress(facts).pay, change: changePress(facts).change }) };
  }
  if (path === '/guards') {
    const html = readFileSync(join(ROOT, 'scripts', 'page-tests', 'guards.html'), 'utf8').replace('__AGENT_SRC__', '/agent.js');
    return { status: 200, type: 'text/html; charset=utf-8', body: html };
  }
  return { status: 404, type: 'text/plain', body: '' };
}

type Row = { name: string; ok: boolean; detail: string };

test('guards.html: every secret field, payment press and account press is judged as the page expects', async (t) => {
  if (!chrome) return t.skip('no Chrome');
  const c = chrome;
  const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (method: string, params: object = {}) => c.send(method, params, sessionId);
  const errors: string[] = [];
  c.listen(sessionId, (method, params) => {
    if (method === 'Fetch.requestPaused') {
      const res = answer(params.request.url, params.request.method, params.request.postData);
      void s('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: res.status,
        responseHeaders: [{ name: 'Content-Type', value: res.type }],
        body: Buffer.from(res.body, 'utf8').toString('base64'),
      }).catch(() => {});
    } else if (method === 'Runtime.exceptionThrown') {
      errors.push(String(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text));
    }
  });
  try {
    await s('Runtime.enable');
    await s('Page.enable');
    await s('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    await s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await s('Page.navigate', { url: `${ORIGIN}/guards` });
    let rows: Row[] | null = null;
    const deadline = Date.now() + 30000;
    while (!rows && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      const r = await s('Runtime.evaluate', { expression: 'window.__pageTestResults || null', returnByValue: true }).catch(() => null);
      rows = r?.result?.value ?? null;
      if (!rows && errors.length) break;
    }
    assert.ok(rows, `the page gave no results${errors.length ? ': ' + errors.join(' | ') : ' within 30 s'}`);
    // The page's own list: 6 secret kinds, 2 custom/box fields, 6 ordinary fields, 5 copies, 15 presses.
    assert.ok(rows.length >= 30, `only ${rows.length} rows`);
    const failed = rows.filter((r) => !r.ok).map((r) => `${r.name}: ${r.detail}`);
    assert.deepEqual(failed, [], 'FAIL rows in guards.html');
    for (const id of ['p-icon', 'p-go', 'p-apply', 'a-pass-save', 'd-yes']) {
      assert.ok(rows.some((r) => r.name.startsWith(`press ${id} `)), `no row for press ${id}`);
    }
  } finally {
    c.unlisten(sessionId);
    await c.send('Target.closeTarget', { targetId }).catch(() => {});
  }
});
