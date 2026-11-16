/**
 * Saved by earlier versions, the assistant's steps and the history began with an emoji (a page before "Reading the
 * page"); the app now draws an icon instead. This takes such a leading emoji (and the space after it) off text the
 * app wrote itself. Never used on what the user, the AI model or a page wrote.
 */
const LEADING_SYMBOL =
  /^(?:[\u2190-\u21FF\u2300-\u23FF\u2460-\u24FF\u25A0-\u27BF\u2900-\u297F\u2B00-\u2BFF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDEFF])\uFE0F?\s+/;

export function withoutLeadingSymbol(text: string): string {
  return text.replace(LEADING_SYMBOL, '');
}
