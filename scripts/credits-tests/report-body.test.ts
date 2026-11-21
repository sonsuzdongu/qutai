// Reports (src/report/body.ts, design record SAFE-2 to SAFE-5): what the app sends to `POST /reports`. Here with the
// credits tests because reports, like credits, exist only in builds with Qutai's server.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REPORT_CONTENT_MAX, REPORT_NOTE_MAX, cut, reportBody } from '../../src/report/body.ts';

const info = { version: '0.1.8', platform: 'ios', language: 'tr' };

test('sends only the kind and reason when nothing else was chosen', () => {
  assert.deepEqual(reportBody({ kind: 'answer', reason: 'offensive' }, info), {
    kind: 'answer',
    reason: 'offensive',
    appVersion: '0.1.8',
    platform: 'ios',
    language: 'tr',
  });
});

test('the reported text goes only when given, trimmed and cut to the server limit', () => {
  const body = reportBody({ kind: 'answer', reason: 'dangerous', content: `  ${'a'.repeat(REPORT_CONTENT_MAX + 50)}  ` }, info);
  assert.equal(body.content.length, REPORT_CONTENT_MAX);
  assert.equal('content' in reportBody({ kind: 'answer', reason: 'dangerous', content: null }, info), false);
  assert.equal('content' in reportBody({ kind: 'answer', reason: 'dangerous', content: '   ' }, info), false);
});

test('a note is sent only with "Other", cut to the limit', () => {
  assert.equal('note' in reportBody({ kind: 'answer', reason: 'offensive', note: 'why' }, info), false);
  const body = reportBody({ kind: 'answer', reason: 'other', note: 'x'.repeat(REPORT_NOTE_MAX + 1) }, info);
  assert.equal(body.note.length, REPORT_NOTE_MAX);
});

test('an app name goes only with an app report; the provider when known', () => {
  assert.equal(reportBody({ kind: 'app', reason: 'other', note: 'n', appName: 'Water tracker' }, info).appName, 'Water tracker');
  assert.equal('appName' in reportBody({ kind: 'answer', reason: 'other', note: 'n', appName: 'x' }, info), false);
  assert.equal(reportBody({ kind: 'answer', reason: 'misleading', provider: 'own' }, info).provider, 'own');
});

test('leaves out device facts the server would refuse', () => {
  const body = reportBody({ kind: 'answer', reason: 'sexual' }, { version: 'not a version!', platform: 'web', language: 'pt-BR' });
  assert.deepEqual(body, { kind: 'answer', reason: 'sexual', language: 'pt-BR' });
});

test('cut never splits a surrogate pair', () => {
  assert.equal(cut('ab😀', 3), 'ab');
  assert.equal(cut('ab😀', 4), 'ab😀');
  assert.equal(cut('abc', 10), 'abc');
});
