// A tool result has two readers (src/agent/stepLine.ts): the model reads its English content unchanged; the chat
// shows the user a line in the app's language. The reported case (16 Nov 2026): with the app in Turkish, tapping
// "Reddet" on an approval dialog showed the model's "The user declined this. Ask them how to proceed." as a red error.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { setLanguage } from '../../src/i18n/index.ts';
import { formatPercent, formatSize } from '../../src/i18n/format.ts';
import { declinedNotice, errorNotice, pageErrorNotice, settingNotice, stepLine } from '../../src/agent/stepLine.ts';

afterEach(() => setLanguage('en'));

const MODEL_TEXT = 'The user declined this. Ask them how to proceed.';

test('a declined step is an ordinary info line in Turkish, and the model text stays English', () => {
  setLanguage('tr');
  const result = { content: MODEL_TEXT, isError: true, notice: declinedNotice() };
  assert.deepEqual(stepLine(result), { type: 'info', text: 'Reddettiniz', icon: 'close' });
  assert.equal(result.content, MODEL_TEXT);
});

test('a declined step reads "You declined this" in English', () => {
  assert.deepEqual(stepLine({ content: MODEL_TEXT, isError: true, notice: declinedNotice() }), {
    type: 'info',
    text: 'You declined this',
    icon: 'close',
  });
});

test('a failure without a notice shows a translated line, the model text only as details', () => {
  setLanguage('tr');
  const line = stepLine({ content: 'Element ref=12 not found (page changed?). Call read_page again.', isError: true });
  assert.equal(line?.type, 'error');
  assert.equal(line?.text, 'Bu adım yapılamadı');
  assert.equal(line?.type === 'error' && line.details, 'Element ref=12 not found (page changed?). Call read_page again.');
});

test('a translated error keeps the model text as details', () => {
  setLanguage('tr');
  const line = stepLine({ content: 'The page did not answer: timeout', isError: true, notice: errorNotice('Sayfa yanıt vermedi') });
  assert.deepEqual(line, { type: 'error', text: 'Sayfa yanıt vermedi', details: 'The page did not answer: timeout' });
});

test('a refusal by the user\'s own setting is not shown as an error', () => {
  const line = stepLine({ content: 'blocked', isError: true, notice: settingNotice('Qutai is blocked') });
  assert.equal(line?.type, 'info');
});

test('a successful step adds no line', () => {
  assert.equal(stepLine({ content: 'Clicked.', isError: false }), null);
});

test('the page timeout from Tab.run is recognised', () => {
  setLanguage('tr');
  assert.equal(pageErrorNotice(new Error('The page did not respond (it may still be loading).'))?.text, 'Sayfa yanıt vermedi');
  assert.equal(pageErrorNotice(new Error('Unknown page error')), undefined);
});

test('percentages and sizes follow the language', () => {
  assert.equal(formatPercent(120), '120%');
  assert.equal(formatSize(3.25 * 1024 * 1024), '3.3 MB');
  setLanguage('tr');
  assert.equal(formatPercent(120), '%120');
  assert.equal(formatSize(3.25 * 1024 * 1024), '3,3 MB');
});
