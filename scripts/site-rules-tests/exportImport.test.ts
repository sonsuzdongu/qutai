// Exporting and importing the user's own rules ("My rules" › Export / Import): a plain text file of filter lines.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportRules, importRules, type SiteRule } from '../../src/content/siteRules.ts';

const rule = (line: string, enabled = true, site = 'example.com'): SiteRule => ({
  id: line,
  line,
  enabled,
  createdAt: 1,
  source: 'assistant',
  site,
});

const RULES = [
  rule('*.example.com##.ad-gap'),
  rule('example.com##div[data-ad-slot]'),
  rule('example.com/entry/*###top-banner', false),
  rule('https://example.com/a?b=1##.sponsor'),
  rule('||ads.example.net^', true, 'example.com'),
  rule('*.xn--eki-tza.com##.reklam'),
];

test('export then import gives back every rule with its switch', () => {
  const text = exportRules(RULES, new Date(0));
  assert.match(text, /^! Title: Qutai site rules\n/);
  assert.match(text, /\n! off: example\.com\/entry\/\*###top-banner\n/);
  const back = importRules(text);
  assert.deepEqual(
    back.rules.map((r) => [r.line, r.enabled]),
    RULES.map((r) => [r.line, r.enabled]),
  );
  assert.equal(back.duplicates, 0);
  assert.equal(back.invalid, 0);
  assert.deepEqual(
    back.rules.map((r) => r.site),
    ['example.com', 'example.com', 'example.com', 'example.com', 'ads.example.net', 'xn--eki-tza.com'],
  );
});

test('import skips what the phone has, repeats, invalid and over-broad lines, and ignores comments', () => {
  const text = [
    '[Adblock Plus 2.0]',
    '! a comment',
    '',
    '*.example.com##.ad-gap',
    '*.other.com##.ad',
    '*.other.com##.ad',
    'other.com##body',
    'other.com##div',
    'other.com##.x{color:red}',
    '##.no-site',
    '||com^',
    'not a rule',
    '||tracker.example.org^',
    '﻿',
  ].join('\r\n');
  const result = importRules(text, ['*.example.com##.ad-gap']);
  assert.deepEqual(result.rules.map((r) => r.line), ['*.other.com##.ad', '||tracker.example.org^']);
  assert.equal(result.duplicates, 2);
  assert.equal(result.invalid, 6);
});
