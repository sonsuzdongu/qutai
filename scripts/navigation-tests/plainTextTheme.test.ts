// Plain-text documents follow the theme (src/browser/plainTextTheme.ts, UI-69).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPlainTextType, PLAIN_TEXT_THEME_SCRIPT } from '../../src/browser/plainTextTheme.ts';

test('JSON, plain text, CSV and +json types are plain text; HTML, XML and images are not', () => {
  for (const type of ['application/json', 'application/json; charset=utf-8', 'text/plain', 'TEXT/PLAIN', 'text/csv', 'application/ld+json', 'application/x-ndjson']) {
    assert.ok(isPlainTextType(type), type);
  }
  for (const type of ['text/html', 'application/xhtml+xml', 'text/xml', 'image/png', '', null, undefined]) {
    assert.ok(!isPlainTextType(type), String(type));
  }
});

test('the page script styles only the main frame, once, with the scheme colours', () => {
  assert.match(PLAIN_TEXT_THEME_SCRIPT, /window\.top !== window/);
  assert.match(PLAIN_TEXT_THEME_SCRIPT, /background: Canvas; color: CanvasText/);
  assert.match(PLAIN_TEXT_THEME_SCRIPT, /__qutaiPlainText/);
});
