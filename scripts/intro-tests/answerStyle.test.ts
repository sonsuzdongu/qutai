// The answer style is never asked; a finished setup adds the short-answers line unless one is there (INTRO-29).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withDefaultAnswerStyle } from '../../src/intro/answerStyle';

const SHORT = 'Answer briefly and to the point.';
const OTHERS = ['Give detailed answers with explanations.', 'Kısa ve öz yanıt ver.'];

test('empty instructions get the short-answers line, as picking it did', () => {
  assert.equal(withDefaultAnswerStyle('', SHORT, OTHERS), SHORT);
  assert.equal(withDefaultAnswerStyle('  \n ', SHORT, OTHERS), SHORT);
});

test('the user\'s own lines stay, the line goes after them', () => {
  assert.equal(withDefaultAnswerStyle('Call me Deniz.\n', SHORT, OTHERS), `Call me Deniz.\n${SHORT}`);
});

test('a style line already there (volunteered, either style, any of the known languages) wins; nothing is added twice', () => {
  for (const text of [SHORT, `x\n${SHORT}`, 'Give detailed answers with explanations.', ' Kısa ve öz yanıt ver. ']) {
    assert.equal(withDefaultAnswerStyle(text, SHORT, OTHERS), text);
  }
  const once = withDefaultAnswerStyle('a', SHORT, OTHERS);
  assert.equal(withDefaultAnswerStyle(once, SHORT, OTHERS), once);
});
