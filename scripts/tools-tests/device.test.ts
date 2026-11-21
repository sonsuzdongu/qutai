// Phone tools that confirm on their own (src/agent/tools/device.ts): never from an incognito conversation, never
// without the confirmation dialog, nothing done when the user declines, and what each dialog asks. The phone's own
// calendar, location and notifications are not reached in these tests.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { ToolContext } from '../../src/agent/executeTool.ts';
import { locationTool, readCalendarLog, readCalendarTool, schedulingTool, SCHEDULING_LOG_KEYS } from '../../src/agent/tools/device.ts';
import { t } from '../../src/i18n/index.ts';

type Asked = { description: unknown; host: string | null; kind?: string };

function ctxWith({ incognitoTab = false, touched = false, answer = false as boolean | null, url = 'https://maps.example/route' } = {}) {
  const asked: Asked[] = [];
  const tab = { id: 'tab-1', url, isNewTab: false, incognito: incognitoTab };
  const ctx = {
    browser: { getTab: (id: string) => (id === tab.id ? tab : undefined) },
    agentTab: { id: tab.id },
    privacy: { touchedIncognito: touched },
    confirm:
      answer === null
        ? undefined
        : async (description: unknown, host: string | null, kind?: string) => {
            asked.push({ description, host, kind });
            return answer;
          },
  } as unknown as ToolContext;
  return { ctx, asked };
}

const tomorrow = () => {
  const d = new Date(Date.now() + 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const event = () => ({ title: 'Dentist', start: `${tomorrow()}T10:00`, end: `${tomorrow()}T11:00` });

afterEach(() => {
  delete process.env.QUTAI_TEST_OS;
});

test('incognito (its tab, or the conversation touched one): scheduling, calendar and location are refused, nothing asked', async () => {
  for (const setup of [{ incognitoTab: true }, { touched: true }]) {
    const { ctx, asked } = ctxWith({ ...setup, answer: true });
    for (const out of [
      await schedulingTool('add_calendar_event', event(), ctx),
      await readCalendarTool({ start: `${tomorrow()}T00:00`, end: `${tomorrow()}T23:59` }, ctx),
      await locationTool({}, ctx),
    ]) {
      assert.equal(out.isError, true);
      assert.match(out.content, /^Not allowed: this conversation involves incognito tabs/);
      assert.ok(out.notice);
    }
    assert.equal(asked.length, 0);
  }
});

test('without the confirmation dialog nothing runs', async () => {
  const { ctx } = ctxWith({ answer: null });
  const text = "This needs the user's confirmation, which is not available here.";
  assert.equal((await schedulingTool('add_calendar_event', event(), ctx)).content, text);
  assert.equal((await readCalendarTool({ start: `${tomorrow()}T00:00`, end: `${tomorrow()}T23:59` }, ctx)).content, text);
  assert.equal((await locationTool({}, ctx)).content, text);
});

test('declined: each says so, with a notice, and tells the model not to guess', async () => {
  const { ctx, asked } = ctxWith({ answer: false });
  const add = await schedulingTool('add_calendar_event', event(), ctx);
  assert.equal(add.content, 'The user declined this. Ask them how to proceed.');
  assert.equal(asked[0].kind, 'calendarEvent');
  const read = await readCalendarTool({ start: `${tomorrow()}T00:00`, end: `${tomorrow()}T23:59` }, ctx);
  assert.match(read.content, /^The user declined to share their calendar/);
  assert.equal(asked[1].kind, 'calendarRead');
  const where = await locationTool({ purpose: 'Directions to the dentist' }, ctx);
  assert.match(where.content, /^The user declined to share their location/);
  assert.equal(asked[2].kind, 'location');
  for (const out of [add, read, where]) assert.ok(out.notice);
});

test('the location question names the purpose and the site the assistant is on', async () => {
  const { ctx, asked } = ctxWith({ answer: false });
  await locationTool({ purpose: '  Directions  ' }, ctx);
  const text = String(asked[0].description);
  assert.ok(text.startsWith(t('location.agentConfirm')));
  assert.match(text, /“Directions”/);
  assert.ok(text.includes(t('location.agentSite', { host: 'maps.example' })));
  assert.equal(asked[0].host, null);
});

test('a plan the model got wrong is refused before asking', async () => {
  const { ctx, asked } = ctxWith({ answer: true });
  const out = await schedulingTool('add_calendar_event', { title: '' }, ctx);
  assert.equal(out.isError, true);
  const read = await readCalendarTool({ start: 'yesterday-ish' }, ctx);
  assert.equal(read.isError, true);
  assert.equal(asked.length, 0);
});

test('Android: a reminder without a due time is refused (it becomes a calendar event with an alarm)', async () => {
  process.env.QUTAI_TEST_OS = 'android';
  const { ctx, asked } = ctxWith({ answer: true });
  const out = await schedulingTool('add_reminder', { title: 'Call mum' }, ctx);
  assert.match(out.content, /^On Android a reminder needs a due date and time/);
  assert.equal(asked.length, 0);
});

test('the action history: what kind of thing was added, and the calendar range read, never the content', () => {
  assert.deepEqual(Object.keys(SCHEDULING_LOG_KEYS), ['add_calendar_event', 'add_reminder', 'schedule_notification']);
  assert.equal(readCalendarLog({ start: 'nonsense' }), t('action.readCalendar'));
  const line = readCalendarLog({ start: `${tomorrow()}T09:00`, end: `${tomorrow()}T17:00` });
  assert.ok(line.includes(`${tomorrow()} 09:00`), line);
});
