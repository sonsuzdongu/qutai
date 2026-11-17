// The owner chose the formal address for Turkish ("siz"); the assistant's own answers sometimes said "sen". The
// system prompt asks for the formal form in every language that has one, unless the user asks otherwise.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SYSTEM_PROMPT } from '../../src/agent/systemPrompt.ts';

test('the prompt asks for the formal address in the languages that distinguish it', () => {
  for (const form of ['"siz"', '"Sie"', '"vous"', '"usted"', '"вы"', '"você"']) assert.ok(SYSTEM_PROMPT.includes(form), form);
  assert.match(SYSTEM_PROMPT, /Address the user formally/);
  assert.match(SYSTEM_PROMPT, /unless they ask to be addressed informally/);
});

test('the address rule stays one short sentence (it is sent with every request)', () => {
  const sentence = SYSTEM_PROMPT.match(/Address the user formally[^.]*\./)?.[0] ?? '';
  assert.ok(sentence.length > 0 && sentence.length < 220, String(sentence.length));
});
