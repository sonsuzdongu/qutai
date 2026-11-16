// The Qutai Credits balance under the panel's title is never cut (src/components/statusFit.ts): the model's name
// gives way to it, and goes when only a few letters of it would be left.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactModelName, MIN_LABEL_WIDTH, statusFullFits, statusLabelFits } from '../../src/components/statusFit.ts';

test('the name stays while there is room beside the balance and the arrow', () => {
  assert.equal(statusLabelFits(220, 80, 200, 1), true);
  assert.equal(statusLabelFits(80 + 29 + MIN_LABEL_WIDTH, 80, 200, 1), true);
});

test('the name goes when too little of it would be left', () => {
  assert.equal(statusLabelFits(80 + 29 + MIN_LABEL_WIDTH - 1, 80, 200, 1), false);
  assert.equal(statusLabelFits(150, 110, 200, 1), false);
});

test('larger text needs more room, up to the 1.4 cap', () => {
  assert.equal(statusLabelFits(200, 90, 200, 1), true);
  assert.equal(statusLabelFits(200, 90, 200, 1.3), false);
  assert.equal(statusLabelFits(260, 90, 200, 2), statusLabelFits(260, 90, 200, 1.4));
});

test('a short name that fits whole stays, even with less room than for a long one', () => {
  // 130 under the title, 55 for the balance: 46 left.
  assert.equal(statusLabelFits(130, 55, 40, 1), true);
  assert.equal(statusLabelFits(130, 55, 47, 1), false);
  assert.equal(statusLabelFits(130, 55, 0, 1), false);
});

test('before anything is measured the name shows', () => {
  assert.equal(statusLabelFits(0, 0, 0, 1), true);
  assert.equal(statusLabelFits(200, 0, 0, 1), true);
});

test('own key: the whole line shows only when it fits with the arrow', () => {
  assert.equal(statusFullFits(200, 183, 1), true);
  assert.equal(statusFullFits(200, 184, 1), false);
  assert.equal(statusFullFits(200, 180, 1.3), false);
  assert.equal(statusFullFits(200, 0, 1), false);
  assert.equal(statusFullFits(0, 120, 1), false);
});

test("the short line drops the model's maker", () => {
  assert.equal(compactModelName('Anthropic: Claude Sonnet 5.5'), 'Claude Sonnet 5.5');
  assert.equal(compactModelName('meta-llama/llama-4-maverick'), 'llama-4-maverick');
  assert.equal(compactModelName('Claude Sonnet 5.5'), 'Claude Sonnet 5.5');
  assert.equal(compactModelName('gpt-5.5'), 'gpt-5.5');
  assert.equal(compactModelName('model/'), 'model/');
  assert.equal(compactModelName('qwen3:32b'), 'qwen3:32b');
});
