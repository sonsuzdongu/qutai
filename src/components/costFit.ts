/**
 * Which form of an answer's figure fits beside its row of icons (AnswerCostInline). Pure, for the tests.
 *
 * Order: the full text ("≈ $0.012 · 3.4k tokens") when it fits; otherwise the amount alone ("≈ $0.012"), the token
 * part dropped first; the amount is never dropped (when even it doesn't fit, its one-line Text cuts it short with "…").
 * Widths are the texts' natural widths in points; `padding` is the horizontal padding around the text, both sides.
 */
export function costFit(full: number, amount: number, room: number, padding: number): 'full' | 'amount' {
  return full + padding <= room ? 'full' : 'amount';
}

