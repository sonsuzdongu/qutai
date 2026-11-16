// The interface's two dictionaries (src/i18n/en.ts, tr.ts) carry the same keys, and each Turkish string fills in the
// same {placeholders} as its English one. TypeScript catches a key missing from tr.ts, but not an extra key there
// (a renamed key left behind) or a placeholder lost in translation, which would show as "{host}" on screen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../../src/i18n/en.ts';
import { tr } from '../../src/i18n/tr.ts';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('every English key has a Turkish string', () => {
  const missing = Object.keys(en).filter((key) => !(key in tr) || !(tr as Record<string, string>)[key]?.trim());
  assert.deepEqual(missing, [], `missing or empty in tr.ts: ${missing.join(', ')}`);
});

test('tr.ts has no key that en.ts lacks', () => {
  const extra = Object.keys(tr).filter((key) => !(key in en));
  assert.deepEqual(extra, [], `only in tr.ts: ${extra.join(', ')}`);
});

test('each Turkish string uses the same placeholders as the English one', () => {
  const differ = Object.entries(en).flatMap(([key, text]) => {
    const turkish = (tr as Record<string, string>)[key];
    if (turkish === undefined) return [];
    const a = placeholders(text).join(',');
    const b = placeholders(turkish).join(',');
    return a === b ? [] : [`${key}: en {${a}} tr {${b}}`];
  });
  assert.deepEqual(differ, [], differ.join('\n'));
});
