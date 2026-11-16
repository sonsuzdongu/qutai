/**
 * The one-time removal of the "Always reply in Turkish" example line (src/agent/retiredInstructions.ts): what it
 * matches, what it leaves, and the same rule when a backup made before the change is restored (restoredCustomInstructions, used by
 * src/backup/payload.ts).
 * Run: npm run test:instructions (Node's built-in test runner, like scripts/cost-tests/).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  removeRetiredInstructionLines,
  restoredCustomInstructions,
  RETIRED_INSTRUCTION_LINES,
} from '../../src/agent/retiredInstructions.ts';

describe('removeRetiredInstructionLines', () => {
  it('knows the two texts the example chip wrote (English and Turkish labels)', () => {
    assert.deepEqual([...RETIRED_INSTRUCTION_LINES], ['Always reply in Turkish', 'Her zaman Türkçe yanıt ver']);
  });

  it('removes the line when it is the whole text', () => {
    assert.equal(removeRetiredInstructionLines('Always reply in Turkish'), '');
    assert.equal(removeRetiredInstructionLines('Her zaman Türkçe yanıt ver'), '');
  });

  it('removes it as added after other lines, keeping them', () => {
    assert.equal(removeRetiredInstructionLines('Answer briefly\nAlways reply in Turkish'), 'Answer briefly');
    assert.equal(
      removeRetiredInstructionLines('Kısa yanıt ver\nHer zaman Türkçe yanıt ver\nMetrik birimler kullan'),
      'Kısa yanıt ver\nMetrik birimler kullan',
    );
  });

  it('removes both when both are there, and does not leave a run of blank lines', () => {
    assert.equal(
      removeRetiredInstructionLines('A\n\nAlways reply in Turkish\n\nHer zaman Türkçe yanıt ver\nB'),
      'A\n\nB',
    );
  });

  it('leaves text the user wrote, even when it is close', () => {
    for (const text of [
      'Always reply in Turkish.',
      'always reply in Turkish',
      'Always reply in Turkish please',
      ' Always reply in Turkish',
      'Always reply in Turkish ',
      'Always  reply in Turkish',
      'Her zaman Türkçe yanıt ver.',
      'Her zaman türkçe yanıt ver',
      'Her zaman Türkçe yanıt verin',
      'Please always reply in Turkish',
      'Answer briefly. Always reply in Turkish',
      'Always reply in English',
    ]) {
      assert.equal(removeRetiredInstructionLines(text), text, JSON.stringify(text));
      assert.equal(removeRetiredInstructionLines(`Answer briefly\n${text}`), `Answer briefly\n${text}`);
    }
  });

  it('returns the same text when there is nothing to remove', () => {
    assert.equal(removeRetiredInstructionLines(''), '');
    assert.equal(removeRetiredInstructionLines('Answer briefly\nPrefer metric units'), 'Answer briefly\nPrefer metric units');
  });

  it('handles Windows line ends', () => {
    assert.equal(removeRetiredInstructionLines('Answer briefly\r\nAlways reply in Turkish'), 'Answer briefly');
  });
});

describe('restoring a backup', () => {
  it('removes the line from a backup made before the change (no marker)', () => {
    assert.equal(restoredCustomInstructions('Answer briefly\nHer zaman Türkçe yanıt ver', undefined), 'Answer briefly');
  });

  it('keeps a backup made after the change as it is (the user typed it there themselves)', () => {
    assert.equal(
      restoredCustomInstructions('Answer briefly\nAlways reply in Turkish', true),
      'Answer briefly\nAlways reply in Turkish',
    );
  });

  it('does not take a marker that is not exactly true', () => {
    assert.equal(restoredCustomInstructions('Always reply in Turkish', 'true'), '');
    assert.equal(restoredCustomInstructions('Always reply in Turkish', 1), '');
  });

  it('still cleans the text as before', () => {
    assert.equal(restoredCustomInstructions('  A\r\n\n\n\nB  ', true), 'A\n\nB');
    assert.equal(restoredCustomInstructions('x'.repeat(600), undefined).length, 500);
  });
});
