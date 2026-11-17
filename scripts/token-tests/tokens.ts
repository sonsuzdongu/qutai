/**
 * A token estimate without a tokenizer package or a provider call (the token-counting endpoints need a key, and a
 * tokenizer dependency was not added). It follows the way BPE tokenizers (o200k, Claude's, Gemini's SentencePiece)
 * split text: a word with its leading space is usually one token and long words several; runs of digits go in
 * groups of up to three; punctuation and JSON syntax merge into short runs; line breaks and indentation are cheap.
 * Calibrated on English prose (about 4.2 characters per token) and JSON (about 3 characters per token). It is an
 * estimate: absolute figures can be off by 10–20 %, and Claude's tokenizer counts more tokens than o200k for the
 * same text. Comparisons between two versions of the same request are what this script is for.
 */
export function estimateTokens(text: string): number {
  const pieces = text.match(/ ?[A-Za-z]+| ?[0-9]{1,3}| ?[^\sA-Za-z0-9]+|\s+|[^\x00-\x7f]/g) ?? [];
  let n = 0;
  for (const p of pieces) {
    const t = p.trimStart();
    if (!t) {
      n += p.length > 2 ? 1 : p.includes('\n') ? 1 : 0;
    } else if (/^[A-Za-z]/.test(t)) {
      n += t.length <= 8 ? 1 : Math.ceil(t.length / 5);
    } else if (/^[0-9]/.test(t)) {
      n += 1;
    } else {
      n += Math.ceil(t.length / 2);
    }
  }
  return n;
}

/**
 * Image input tokens: Anthropic counts width × height / 750 (a 1568 px edge is the most it takes before scaling); the
 * app's screenshots are sent at about 780 × 1568, about 1,630 tokens. OpenAI and Gemini count tiles and come out
 * lower; this script uses one figure for all three so the comparison is about what is sent, not the provider's
 * image arithmetic.
 */
export const IMAGE_TOKENS = 1630;
