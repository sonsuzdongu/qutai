/** Turns what the user typed into a URL: an address as-is (adding https://), anything else as a search. */
export function toUrl(input: string): string {
  const text = input.trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (!/\s/.test(text) && /\.[a-z]{2,}(\/|$|:)/i.test(text)) return `https://${text}`;
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}
