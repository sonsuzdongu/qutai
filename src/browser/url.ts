import { SEARCH_ENGINES, SearchEngineId } from './search';

/** True for things the user clearly meant as an address: a URL, or a domain-like word without spaces. */
export function looksLikeUrl(input: string): boolean {
  const text = input.trim();
  if (/^https?:\/\//i.test(text)) return true;
  return !/\s/.test(text) && /\.[a-z]{2,}(\/|$|:)/i.test(text);
}

/** Turns what the user typed into a URL: an address as-is (adding https://), anything else as a search. */
export function toUrl(input: string, engine: SearchEngineId = 'google'): string {
  const text = input.trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (looksLikeUrl(text)) return `https://${text}`;
  return SEARCH_ENGINES[engine].searchUrl(text);
}
