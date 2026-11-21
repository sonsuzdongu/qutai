// "Don't ask again" on every device-permission confirmation ("Qutai wants to do this"), checked through the app's real
// tool pipeline (src/agent/executeTool.ts) after the 21 Nov split of the tools into src/agent/tools/ (SITE-9,
// SITE-10, SITE-11, INC-14; 16 Nov checklist, done in 289a687): a scheduled notification, a calendar event, a
// reminder, reading the calendar, the location and an ordinary download each ask with their kind, which is what puts
// the box in the dialog; actions on a web page and on the user's behalf ask with none. Every kind has its box label and
// its Settings switch (where it is taken back) in all ten languages. The phone's calendar, location, notifications
// and downloads are never reached: every dialog here is declined.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ALWAYS_ALLOW_KINDS } from '../../src/agent/alwaysAllow.ts';
import { executeTool, type ToolContext } from '../../src/agent/executeTool.ts';
import { OutboundGuard } from '../../src/agent/outbound.ts';
import { Browser } from '../../src/browser/Browser.ts';
import { de } from '../../src/i18n/de.ts';
import { en } from '../../src/i18n/en.ts';
import { es } from '../../src/i18n/es.ts';
import { fr } from '../../src/i18n/fr.ts';
import { id } from '../../src/i18n/id.ts';
import { ja } from '../../src/i18n/ja.ts';
import { ko } from '../../src/i18n/ko.ts';
import { ptBR } from '../../src/i18n/pt-BR.ts';
import { ru } from '../../src/i18n/ru.ts';
import { tr } from '../../src/i18n/tr.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Asked = { host: string | null; kind: string | undefined };
let linkHref = 'https://www.mutfakdunyasi.com.tr/manuals/kettle.pdf';

function setup({ incognito = false, confirmByDefault = false } = {}) {
  const browser = new Browser();
  const tab = browser.active;
  tab.url = 'https://www.mutfakdunyasi.com.tr/kettle';
  if (incognito) (tab as unknown as { incognito: boolean }).incognito = true;
  // The page's link behind a ref; nothing else of the page is needed here.
  (tab as unknown as { run: (command: string) => Promise<unknown> }).run = async (command) =>
    command === 'linkHref' ? linkHref : null;
  const asked: Asked[] = [];
  const userTexts = ['Download the kettle manual PDF, remind me tomorrow and check my calendar.'];
  const ctx = {
    browser,
    agentTab: { id: tab.id },
    askedFrom: { id: tab.id },
    privacy: { touchedIncognito: incognito },
    confirmByDefault,
    sites: { levelFor: () => 'default', personalFor: () => 'ask' },
    outbound: new OutboundGuard([tab.url], () => userTexts, async () => []),
    startDownload: async () => {
      throw new Error('never reached: the download was declined');
    },
    confirm: async (_description: unknown, host: string | null, kind?: string) => {
      asked.push({ host, kind });
      return false;
    },
  } as unknown as ToolContext;
  globalThis.fetch = (async () =>
    new Response(null, { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': '1000' } })) as typeof fetch;
  return { ctx, asked };
}

const day = () => {
  const d = new Date(Date.now() + 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DEVICE_CALLS: [string, Record<string, unknown>, string][] = [
  ['schedule_notification', { title: 'Tea', body: 'The tea is ready.', delay_seconds: 600 }, 'notification'],
  ['add_calendar_event', { title: 'Dentist', start: `${day()}T10:00`, end: `${day()}T11:00` }, 'calendarEvent'],
  ['add_reminder', { title: 'Buy filters', due: `${day()}T09:00` }, 'reminder'],
  ['read_calendar', { start: `${day()}T00:00`, end: `${day()}T23:59` }, 'calendarRead'],
  ['get_location', { purpose: 'Directions to the shop' }, 'location'],
  // A link on the page (its ref): an address the assistant wrote itself always asks, with no box (UNTR-22).
  ['download_file', { ref: 7 }, 'download'],
];

test('every device-permission confirmation asks with its kind, so its dialog offers "Don\'t ask again"', async () => {
  process.env.QUTAI_TEST_OS = 'ios';
  try {
    for (const [name, input, kind] of DEVICE_CALLS) {
      const { ctx, asked } = setup();
      const out = await executeTool(name, input, ctx);
      assert.equal(asked.length, 1, `${name} asked once: ${out.content}`);
      assert.deepEqual(asked[0], { host: null, kind }, name);
      assert.equal(out.isError, true, `${name}: declined, nothing done`);
      assert.match(out.content, /declined/);
    }
  } finally {
    delete process.env.QUTAI_TEST_OS;
  }
  // The six calls cover every kind there is.
  assert.deepEqual([...DEVICE_CALLS.map((c) => c[2])].sort(), [...ALWAYS_ALLOW_KINDS].sort());
});

test('a risky download (an app installer) asks with no kind: no box, it asks every time', async () => {
  const { ctx, asked } = setup();
  globalThis.fetch = (async () =>
    new Response(null, { status: 200, headers: { 'content-type': 'application/vnd.android.package-archive', 'content-length': '1000' } })) as typeof fetch;
  linkHref = 'https://www.mutfakdunyasi.com.tr/app/kettle.apk';
  try {
    await executeTool('download_file', { ref: 7 }, ctx);
  } finally {
    linkHref = 'https://www.mutfakdunyasi.com.tr/manuals/kettle.pdf';
  }
  assert.equal(asked.length, 1);
  assert.equal(asked[0].kind, undefined);
});

test('a download from an address the assistant wrote itself asks with no box (nothing is requested before the answer)', async () => {
  const { ctx, asked } = setup();
  await executeTool('download_file', { url: 'https://www.mutfakdunyasi.com.tr/manuals/kettle.pdf' }, ctx);
  assert.deepEqual(asked.map((a) => a.kind), [undefined]);
});

test('an incognito conversation: calendar, location and scheduling are refused unasked, a download asks with no box', async () => {
  for (const [name, input] of DEVICE_CALLS) {
    const { ctx, asked } = setup({ incognito: true });
    await executeTool(name, input, ctx);
    if (name === 'download_file') assert.deepEqual(asked.map((a) => a.kind), [undefined]);
    else assert.equal(asked.length, 0, `${name} refused before asking`);
  }
});

test('an action on a web page asks with the site and no kind: "Always allow on <site>", never "Don\'t ask again"', async () => {
  const { ctx, asked } = setup({ confirmByDefault: true });
  await executeTool('navigate', { url: 'https://www.mutfakdunyasi.com.tr/manuals' }, ctx);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].kind, undefined);
  assert.equal(asked[0].host, 'mutfakdunyasi.com.tr');
});

test('"Ask before actions" is read at each call, so a change during a task applies from the next step (TOOL-32)', async () => {
  const { ctx, asked } = setup();
  let ask = false;
  (ctx as { confirmByDefault: unknown }).confirmByDefault = () => ask;
  ask = true;
  await executeTool('navigate', { url: 'https://www.mutfakdunyasi.com.tr/manuals' }, ctx);
  assert.equal(asked.length, 1, 'switched on after the task started: the step asks');
});

test('every kind has its "Don\'t ask again" label and its Settings switch in all ten languages', () => {
  const dicts: Record<string, Record<string, string>> = { en, tr, de, es, 'pt-BR': ptBR, fr, ja, ko, ru, id };
  for (const [lang, dict] of Object.entries(dicts)) {
    for (const key of ['confirm.title', 'settings.alwaysAllowTitle', 'settings.alwaysAllowHint']) {
      assert.ok(dict[key]?.trim(), `${lang}: ${key}`);
    }
    for (const kind of ALWAYS_ALLOW_KINDS) {
      for (const key of [`confirm.dontAskAgain.${kind}`, `settings.alwaysAllow.${kind}`]) {
        assert.ok(dict[key]?.trim(), `${lang}: ${key}`);
        if (lang !== 'en') assert.notEqual(dict[key], (en as Record<string, string>)[key], `${lang}: ${key} is translated`);
      }
    }
  }
});
