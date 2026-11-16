import { isLanguage, LANGUAGE_INFO } from '../i18n/languages';

/**
 * Credits as text. The server counts in micro-credits (1 credit = 1 000 000); people read credits with a few
 * decimals. Built from whole numbers (no floating point), like the dollar figures in ai/cost.ts.
 */

const MICRO = 1_000_000;

/** Groups thousands with `group` ("12,345"). */
function grouped(whole: number, group: string): string {
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

/**
 * "12.35", "0.42", "0.0031", "< 0.0001", "1,234": two decimals from 1 credit up (none from 10 000), more below 1 so a
 * small charge doesn't read as zero. Negative amounts (a balance after a refund) get a minus sign.
 */
export function formatCredits(micro: number, opts: { decimal?: string; group?: string } = {}): string {
  const decimal = opts.decimal ?? '.';
  const group = opts.group ?? ',';
  if (!Number.isSafeInteger(micro)) return '–';
  if (micro === 0) return '0';
  const sign = micro < 0 ? '-' : '';
  const abs = Math.abs(micro);
  if (abs < 100) return `< ${sign ? '-' : ''}0${decimal}0001`;
  const digits = abs >= 10_000 * MICRO ? 0 : abs >= MICRO ? 2 : abs >= 10_000 ? 2 : 4;
  const step = 10 ** (6 - digits);
  const units = Math.floor((abs + step / 2) / step);
  const scale = 10 ** digits;
  const whole = Math.floor(units / scale);
  const fraction = digits ? decimal + String(units % scale).padStart(digits, '0') : '';
  return `${sign}${grouped(whole, group)}${fraction}`;
}

/** Separators for a language (one of src/i18n/languages.ts): Turkish writes 1.234,56, English 1,234.56. */
export function separators(language: string): { decimal: string; group: string } {
  const info = isLanguage(language) ? LANGUAGE_INFO[language] : LANGUAGE_INFO.en;
  return { decimal: info.decimal, group: info.group };
}
