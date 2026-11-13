/** Lowercases with Turkish dotted/dotless i folded together, so "istanbul" also finds "İSTANBUL". */
export function foldForSearch(text: string): string {
  return text.replace(/[İIı]/g, 'i').toLowerCase().normalize('NFC');
}

/** Whether a tab's title or address contains every word of the query. */
export function matchesTabQuery(tab: { title: string; url: string; isNewTab?: boolean }, query: string): boolean {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = foldForSearch(`${tab.title} ${tab.isNewTab ? '' : tab.url}`);
  return words.every((word) => haystack.includes(word));
}
