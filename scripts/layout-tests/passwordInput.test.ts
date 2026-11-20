// The shared password field's repair of iOS wiping a field that turns secure while edited (src/ui/passwordInput.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passwordHints, repairSecureReentry } from '../../src/ui/passwordInput.ts';

const at = (n: number) => ({ start: n, end: n });

test('ordinary edits after hiding are kept as the field reports them', () => {
  assert.equal(repairSecureReentry('secret12', 'secret123', at(8)), 'secret123'); // typed at the end
  assert.equal(repairSecureReentry('secret12', 'secXret12', at(3)), 'secXret12'); // typed in the middle
  assert.equal(repairSecureReentry('secret12', 'secret1', at(8)), 'secret1'); // backspace at the end
  assert.equal(repairSecureReentry('secret12', 'secet12', at(4)), 'secet12'); // backspace in the middle
  assert.equal(repairSecureReentry('secret12', 'seXt12', { start: 2, end: 5 }), 'seXt12'); // selection replaced
  assert.equal(repairSecureReentry('secret12', 'secret12ab', at(8)), 'secret12ab'); // pasted
});

test('a wipe on the next key is undone: the key is applied at the cursor', () => {
  assert.equal(repairSecureReentry('secret12', '3', at(8)), 'secret123');
  assert.equal(repairSecureReentry('secret12', 'X', at(3)), 'secXret12');
  assert.equal(repairSecureReentry('secret12', 'ab', at(8)), 'secret12ab');
  assert.equal(repairSecureReentry('secret12', 'X', { start: 2, end: 5 }), 'seXt12');
});

test('a wipe by backspace removes one character (or the selection), not everything', () => {
  assert.equal(repairSecureReentry('secret12', '', at(8)), 'secret1');
  assert.equal(repairSecureReentry('secret12', '', at(4)), 'secet12');
  assert.equal(repairSecureReentry('secret12', '', at(0)), 'secret12');
  assert.equal(repairSecureReentry('secret12', '', { start: 2, end: 5 }), 'set12');
});

test('replacing everything selected, or an empty field, is left alone', () => {
  assert.equal(repairSecureReentry('secret12', 'x', { start: 0, end: 8 }), 'x');
  assert.equal(repairSecureReentry('', 'x', at(0)), 'x');
});

test('a selection reported out of range does not break the text', () => {
  assert.equal(repairSecureReentry('secret12', '3', at(99)), 'secret123');
  assert.equal(repairSecureReentry('secret12', '3', { start: 8, end: 3 }), 'sec3');
});

test('autofill hints: a new password versus one the user already has', () => {
  assert.deepEqual(passwordHints('new'), { autoComplete: 'new-password', textContentType: 'newPassword' });
  assert.deepEqual(passwordHints('current'), { autoComplete: 'current-password', textContentType: 'password' });
});
