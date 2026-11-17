// Working mode (docs/working-mode.md): where the action marker is drawn (src/agent/markerGeometry.ts), the step
// strip's line without flicker (src/chat/stripLine.ts) and the panel ↔ strip state machine (src/chat/workingView.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markerPoint, markerRect, ringFor, MIN_RING, MARKER_DWELL_MS } from '../../src/agent/markerGeometry.ts';
import { currentStripLine, emptyStripLine, MIN_LINE_MS, offerLine, plainAnswer, tickLine } from '../../src/chat/stripLine.ts';
import { idleView, stripVisible, workingStep, type WorkingEvent, type WorkingView } from '../../src/chat/workingView.ts';

// ---------- Marker geometry ----------

// The page under a top address bar (56 pt) and the status bar (24 pt): the tab's container in window coordinates.
const view = { x: 0, y: 80, width: 360, height: 600 };
const origin = { x: 0, y: 0 };

test('the dwell is one constant in the approved range', () => {
  assert.ok(MARKER_DWELL_MS >= 250 && MARKER_DWELL_MS <= 400);
});

test('a box in fractions of the visible page lands on the container, offset by the address bar', () => {
  assert.deepEqual(markerRect({ x: 0.25, y: 0.5, width: 0.5, height: 0.1 }, view, origin), {
    x: 90,
    y: 380,
    width: 180,
    height: 60,
  });
});

test('the layer’s own window origin is subtracted (a layer inside the safe area)', () => {
  const r = markerRect({ x: 0, y: 0, width: 1, height: 1 }, view, { x: 0, y: 24 });
  assert.deepEqual(r, { x: 0, y: 56, width: 360, height: 600 });
});

test('the address bar at the bottom: the page starts right under the status bar', () => {
  const bottomBar = { x: 0, y: 24, width: 360, height: 600 };
  assert.equal(markerRect({ x: 0, y: 0, width: 0.1, height: 0.1 }, bottomBar, origin)?.y, 24);
});

test('pinch zoom needs nothing more: fractions of the visual viewport map to the whole view', () => {
  // Zoomed 2×: a 50 css-px button whose box is a quarter of the visual viewport is a quarter of the view.
  const r = markerRect({ x: 0.5, y: 0.5, width: 0.25, height: 0.25 }, view, origin)!;
  assert.equal(r.width, 90);
  assert.equal(r.height, 150);
});

test('a box partly outside the visible page is clipped; one entirely outside gives no marker', () => {
  assert.deepEqual(markerRect({ x: -0.1, y: 0.9, width: 0.3, height: 0.2 }, view, origin), {
    x: 0,
    y: 620,
    width: 72,
    height: 60,
  });
  assert.equal(markerRect({ x: 0.1, y: 1.2, width: 0.3, height: 0.2 }, view, origin), null);
  assert.equal(markerRect({ x: 0.1, y: 0.1, width: 0, height: 0.2 }, view, origin), null);
  assert.equal(markerRect(null, view, origin), null);
  assert.equal(markerRect({ x: NaN, y: 0, width: 1, height: 1 }, view, origin), null);
  assert.equal(markerRect({ x: 0, y: 0, width: 1, height: 1 }, { ...view, width: 0 }, origin), null);
});

test('a click_at point maps the same way and must be inside the page', () => {
  assert.deepEqual(markerPoint(0.5, 0.5, view, origin), { x: 180, y: 380 });
  assert.equal(markerPoint(1.2, 0.5, view, origin), null);
});

test('the ring is centred on the target and never smaller than MIN_RING', () => {
  const tiny = ringFor({ x: 10, y: 10, width: 4, height: 4 });
  assert.equal(tiny.size, MIN_RING);
  assert.equal(tiny.cx, 12);
  const wide = ringFor({ x: 0, y: 0, width: 300, height: 40 });
  assert.ok(wide.size <= 96);
});

// ---------- Strip line ----------

test('the first line shows at once; a quick second one waits for the first one’s minimum time', () => {
  let s = offerLine(emptyStripLine, 'Reading the page', 1000);
  assert.equal(s.state.shown, 'Reading the page');
  assert.equal(s.wakeAt, null);
  s = offerLine(s.state, 'Clicking', 1200);
  assert.equal(s.state.shown, 'Reading the page');
  assert.equal(s.wakeAt, 1000 + MIN_LINE_MS);
  s = tickLine(s.state, 1000 + MIN_LINE_MS);
  assert.equal(s.state.shown, 'Clicking');
});

test('lines replaced while waiting are skipped: only the newest is shown next', () => {
  let s = offerLine(emptyStripLine, 'A', 0);
  s = offerLine(s.state, 'B', 100);
  s = offerLine(s.state, 'C', 200);
  s = offerLine(s.state, 'D', 300);
  assert.equal(s.state.next, 'D');
  s = tickLine(s.state, MIN_LINE_MS);
  assert.equal(s.state.shown, 'D');
  assert.equal(s.state.next, null);
});

test('an early timer waits again; a line equal to the shown one cancels the waiting one', () => {
  let s = offerLine(emptyStripLine, 'A', 0);
  s = offerLine(s.state, 'B', 10);
  const early = tickLine(s.state, 400);
  assert.equal(early.state.shown, 'A');
  assert.equal(early.wakeAt, MIN_LINE_MS);
  s = offerLine(s.state, 'A', 500);
  assert.equal(s.state.next, null);
  assert.equal(tickLine(s.state, 5000).state.shown, 'A');
});

test('a line after the minimum time replaces the shown one at once', () => {
  const s = offerLine(offerLine(emptyStripLine, 'A', 0).state, 'B', MIN_LINE_MS + 1);
  assert.equal(s.state.shown, 'B');
});

test('the strip line comes from the latest step line since the user’s message', () => {
  assert.equal(currentStripLine([{ kind: 'user', text: 'find' }]), 'thinking');
  assert.deepEqual(
    currentStripLine([
      { kind: 'user', text: 'find' },
      { kind: 'action', text: 'Reading the page' },
      { kind: 'action', text: 'Clicking (ref 3)' },
    ]),
    { text: 'Clicking (ref 3)' },
  );
  assert.deepEqual(
    currentStripLine([
      { kind: 'user', text: 'x' },
      { kind: 'action', text: 'Clicking' },
      { kind: 'error', text: "This step didn't work" },
    ]),
    { text: "This step didn't work" },
  );
  assert.equal(
    currentStripLine([
      { kind: 'user', text: 'x' },
      { kind: 'action', text: 'Reading' },
      { kind: 'assistant', text: '', streaming: true },
    ]),
    'answering',
  );
  // An earlier task's lines don't count.
  assert.equal(currentStripLine([{ kind: 'action', text: 'Old' }, { kind: 'user', text: 'new' }]), 'thinking');
});

test('the answer card shows the answer without Markdown marks', () => {
  assert.equal(
    plainAnswer('## Result\n\n**Lokanta Moda** is open until [22:00](https://example.test).\n\n- Soup\n- `Bread`'),
    'Result\n\nLokanta Moda is open until 22:00.\n\n• Soup\n• Bread',
  );
});

// ---------- Panel ↔ strip ----------

const run = (events: WorkingEvent[], from: WorkingView = idleView) => events.reduce(workingStep, from);
const end = (outcome: 'done' | 'failed' | 'needsAnswer' | 'stopped', hasAnswer = true, sameConversation = true): WorkingEvent => ({
  type: 'end',
  outcome,
  hasAnswer,
  sameConversation,
});

test('a task started in the open panel drops into the strip and opens the panel when done', () => {
  const working = run([{ type: 'start', panelOpen: true, collapse: true }]);
  assert.equal(working.panel, false);
  assert.ok(stripVisible(working));
  const done = workingStep(working, end('done'));
  assert.equal(done.phase, 'idle');
  assert.equal(done.panel, true);
  assert.equal(stripVisible(done), false);
});

test('a task started with the panel closed (voice) shows the strip alone and ends in the answer card', () => {
  const working = run([{ type: 'start', panelOpen: false, collapse: true }]);
  assert.ok(stripVisible(working));
  const done = workingStep(working, end('done'));
  assert.equal(done.answer, true);
  assert.equal(done.panel, false);
  assert.equal(workingStep(done, { type: 'dismissAnswer' }).answer, false);
  // Opening the chat from the card.
  const opened = workingStep(done, { type: 'userOpen' });
  assert.equal(opened.panel, true);
  assert.equal(opened.answer, false);
});

test('a voice task that fails or asks a question opens the panel', () => {
  for (const outcome of ['failed', 'needsAnswer'] as const) {
    const v = run([{ type: 'start', panelOpen: false, collapse: true }, end(outcome)]);
    assert.equal(v.panel, true, outcome);
    assert.equal(v.answer, false, outcome);
  }
  // Done without any text to show: the panel.
  assert.equal(run([{ type: 'start', panelOpen: false, collapse: true }, end('done', false)]).panel, true);
});

test('the user’s open panel wins until the task ends; closing it brings the strip back', () => {
  let v = run([{ type: 'start', panelOpen: true, collapse: true }, { type: 'userOpen' }]);
  assert.equal(v.panel, true);
  assert.equal(v.pinned, true);
  // A dialog and its answer leave it open.
  v = run([{ type: 'asking', on: true }, { type: 'asking', on: false }], v);
  assert.equal(v.panel, true);
  v = workingStep(v, { type: 'userClose' });
  assert.ok(stripVisible(v));
});

test('an approval expands the strip into the panel and drops back once answered', () => {
  let v = run([{ type: 'start', panelOpen: false, collapse: true }, { type: 'asking', on: true }]);
  assert.equal(v.phase, 'asking');
  assert.equal(v.panel, true);
  assert.equal(stripVisible(v), false);
  v = workingStep(v, { type: 'asking', on: true });
  assert.equal(v.panel, true);
  v = workingStep(v, { type: 'asking', on: false });
  assert.equal(v.phase, 'working');
  assert.equal(v.panel, false);
  assert.ok(stripVisible(v));
});

test('Stop opens nothing; the panel stays only if the user had opened it', () => {
  assert.equal(run([{ type: 'start', panelOpen: true, collapse: true }, end('stopped')]).panel, false);
  assert.equal(run([{ type: 'start', panelOpen: false, collapse: true }, { type: 'userOpen' }, end('stopped')]).panel, true);
  assert.equal(run([{ type: 'start', panelOpen: false, collapse: true }, { type: 'asking', on: true }, end('stopped')]).panel, false);
});

test('a task that ends in another conversation than the one on screen opens nothing (the toast says so)', () => {
  const v = run([{ type: 'start', panelOpen: false, collapse: true }, end('done', true, false)]);
  assert.equal(v.panel, false);
  assert.equal(v.answer, false);
});

test('with a screen reader the panel the user is in does not collapse', () => {
  const v = run([{ type: 'start', panelOpen: true, collapse: false }]);
  assert.equal(v.panel, true);
  assert.equal(stripVisible(v), false);
  // A voice start still uses the strip.
  assert.ok(stripVisible(run([{ type: 'start', panelOpen: false, collapse: false }])));
});

test('events while idle change nothing but the user’s own open and close', () => {
  assert.deepEqual(workingStep(idleView, { type: 'asking', on: true }), idleView);
  assert.deepEqual(workingStep(idleView, end('done')), idleView);
  assert.equal(workingStep(idleView, { type: 'userOpen' }).panel, true);
});
