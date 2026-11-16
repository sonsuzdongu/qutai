/**
 * The figure in an answer's row of icons (src/components/costFit.ts): the token part goes first, the amount stays.
 * Run: npm run test:cost.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { costFit } from '../../src/components/costFit.ts';

const PAD = 12;

describe('costFit', () => {
  it('shows the full text when it fits', () => {
    assert.equal(costFit(140, 60, 160, PAD), 'full');
    assert.equal(costFit(148, 60, 160, PAD), 'full');
  });
  it('drops the token part first when the full text does not fit', () => {
    assert.equal(costFit(149, 60, 160, PAD), 'amount');
    assert.equal(costFit(300, 60, 80, PAD), 'amount');
  });
  it('keeps the amount when even it does not fit (the Text cuts it with …)', () => {
    assert.equal(costFit(300, 120, 40, PAD), 'amount');
  });
});
