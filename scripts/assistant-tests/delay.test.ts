// schedule_notification with a relative time (16 Nov 2026, on the phone): "set a notification for 10 seconds from
// now" got a question about the clock time and a notification 3 minutes later. The tool now takes delay_seconds,
// counted from the user's confirmation, next to the absolute time (src/agent/scheduling.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { delayLabel, MAX_DELAY_SECONDS, parseDelaySeconds, planSchedule } from '../../src/agent/scheduling.ts';
import { TOOLS } from '../../src/agent/tools.ts';
import { SYSTEM_PROMPT } from '../../src/agent/systemPrompt.ts';
import { setLanguage } from '../../src/i18n/index.ts';

const NOW = new Date(2026, 10, 16, 13, 35, 0).getTime();
const base = { title: 'Ping', body: 'Time is up' };

test('delay_seconds: whole seconds from 1 to 30 days; numeric strings are taken', () => {
  assert.equal(parseDelaySeconds(10), 10);
  assert.equal(parseDelaySeconds(1), 1);
  assert.equal(parseDelaySeconds('600'), 600);
  assert.equal(parseDelaySeconds(' 45 '), 45);
  assert.equal(parseDelaySeconds(MAX_DELAY_SECONDS), MAX_DELAY_SECONDS);
  for (const bad of [0, -5, 1.5, MAX_DELAY_SECONDS + 1, '10s', 'ten', '', null, undefined, Number.NaN, Infinity, true]) {
    assert.equal(typeof parseDelaySeconds(bad), 'string', `rejects ${String(bad)}`);
  }
});

test('a relative time becomes a plan with the delay and the estimated moment', () => {
  const plan = planSchedule('schedule_notification', { ...base, delay_seconds: 10 }, NOW);
  assert.ok(typeof plan === 'object' && plan.kind === 'notification');
  assert.equal(plan.delaySeconds, 10);
  assert.equal(plan.at.getTime(), NOW + 10_000);
});

test('the absolute form still works, and is never in the past', () => {
  const plan = planSchedule('schedule_notification', { ...base, time: '2026-11-16T13:40' }, NOW);
  assert.ok(typeof plan === 'object' && plan.kind === 'notification');
  assert.equal(plan.delaySeconds, undefined);
  assert.equal(plan.at.getTime(), new Date(2026, 10, 16, 13, 40).getTime());
  const past = planSchedule('schedule_notification', { ...base, time: '2026-11-16T13:30' }, NOW);
  assert.match(String(past), /in the past/);
});

test('exactly one of time and delay_seconds', () => {
  assert.match(String(planSchedule('schedule_notification', { ...base }, NOW)), /delay_seconds/);
  assert.match(
    String(planSchedule('schedule_notification', { ...base, time: '2026-11-16T14:00', delay_seconds: 10 }, NOW)),
    /not both/,
  );
  assert.match(String(planSchedule('schedule_notification', { ...base, delay_seconds: 0 }, NOW)), /whole number/);
  // An empty time with a delay is the relative form.
  const plan = planSchedule('schedule_notification', { ...base, time: '', delay_seconds: 30 }, NOW);
  assert.ok(typeof plan === 'object' && plan.kind === 'notification' && plan.delaySeconds === 30);
});

test('the tool and the prompt tell the model to use the delay for relative times', () => {
  const tool = TOOLS.find((t) => t.name === 'schedule_notification');
  assert.ok(tool);
  const schema = tool.input_schema as { properties: Record<string, { type: string }>; required: string[] };
  assert.equal(schema.properties.delay_seconds.type, 'integer');
  assert.deepEqual(schema.required, ['title', 'body']);
  assert.match(tool.description, /relative time.*delay_seconds/s);
  assert.match(tool.description, /never ask for a clock time/);
  assert.match(SYSTEM_PROMPT, /delay_seconds straight away/);
});

test('the delay in the confirmation, in both languages', () => {
  setLanguage('en');
  assert.equal(delayLabel(10), '10 s');
  assert.equal(delayLabel(60), '1 min');
  assert.equal(delayLabel(90), '1 min 30 s');
  assert.equal(delayLabel(5400), '1 h 30 min');
  assert.equal(delayLabel(3600 + 5), '1 h');
  assert.equal(delayLabel(2 * 86400 + 3 * 3600), '2 day(s) 3 h');
  setLanguage('tr');
  assert.equal(delayLabel(10), '10 sn');
  assert.equal(delayLabel(5400), '1 sa 30 dk');
  setLanguage('en');
});
