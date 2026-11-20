// The Android "send the form again?" answer path (src/browser/formResubmission.ts and the patched WebView's reading
// of it in RNCWebView.setFormResubmissionAnswer, mirrored by readFormAnswer).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORM_ANSWER_IDLE, FORM_ANSWER_TIMEOUT_MS, formAnswer, readFormAnswer } from '../../src/browser/formResubmission';

test('the app answers the open question; the WebView reads it', () => {
  assert.equal(formAnswer(3, true), '3 resend');
  assert.equal(formAnswer(3, false), '3 keep');
  assert.equal(readFormAnswer(formAnswer(3, true), 3), 'resend');
  assert.equal(readFormAnswer(formAnswer(3, false), 3), 'keep');
});

test('an answer to an older question, the idle value or garbage changes nothing (the 30 s fallback stays)', () => {
  assert.equal(readFormAnswer(formAnswer(2, true), 3), null);
  assert.equal(readFormAnswer(FORM_ANSWER_IDLE, 1), null);
  assert.equal(readFormAnswer('3', 3), null);
  assert.equal(readFormAnswer('x resend', 3), null);
  assert.equal(readFormAnswer(null, 3), null);
  assert.equal(FORM_ANSWER_TIMEOUT_MS, 30000, 'must match RNCWebView.FORM_RESUBMISSION_TIMEOUT_MS');
});

test('the patched WebView has the same limit and answers a dropped question with "don\'t send again"', async () => {
  const { readFileSync } = await import('node:fs');
  const java = readFileSync('node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java', 'utf8');
  assert.equal(Number(/FORM_RESUBMISSION_TIMEOUT_MS = (\d+)/.exec(java)?.[1]), FORM_ANSWER_TIMEOUT_MS);
  // Destroying the WebView answers an open question.
  const destroy = java.slice(java.indexOf('public void destroy()'));
  assert.match(destroy.slice(0, destroy.indexOf('super.destroy()')), /answerFormResubmission\(false\)/);
});
