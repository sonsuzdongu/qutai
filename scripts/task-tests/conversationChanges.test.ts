// A streamed piece of an answer (every 50 ms) and each typed letter redraw only the chat panel, not the whole app
// (UI-29, 20 Nov 2026 code review): the conversation tells its own subscribers about every change and its owner (the
// browser) only about changes the rest of the app shows.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Conversation } from '../../src/chat/Conversation';
import { tick } from './host';

function watched() {
  let owner = 0;
  let panel = 0;
  const chat = new Conversation(() => owner++, 'tab-1');
  chat.subscribe(() => panel++);
  return { chat, counts: () => ({ owner, panel }) };
}

test('typing tells the panel each letter, the app only when the field becomes empty or not', () => {
  const { chat, counts } = watched();
  chat.setDraft('h');
  chat.setDraft('he');
  chat.setDraft('hello');
  assert.deepEqual(counts(), { owner: 1, panel: 3 });
  chat.setDraft('');
  assert.deepEqual(counts(), { owner: 2, panel: 4 });
});

test('a streamed answer: its first piece tells the app (an answer appeared), later pieces only the panel', async () => {
  const { chat, counts } = watched();
  chat.appendStreaming('Hel');
  await tick(60);
  assert.deepEqual(counts(), { owner: 1, panel: 1 });
  chat.appendStreaming('lo, ');
  await tick(60);
  chat.appendStreaming('world');
  await tick(60);
  assert.deepEqual(counts(), { owner: 1, panel: 3 });
  assert.equal(chat.items.at(-1)?.text, 'Hello, world');
  chat.finishStreaming();
  assert.equal(counts().owner, 2);
});

test('items that did not change stay the same objects, so their rows are not redrawn', async () => {
  const { chat } = watched();
  chat.add({ id: 'q', kind: 'user', text: 'Hi' });
  const question = chat.items[0];
  chat.appendStreaming('A');
  await tick(60);
  chat.appendStreaming('B');
  await tick(60);
  assert.equal(chat.items[0], question);
});
