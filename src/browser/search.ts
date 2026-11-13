export type SearchEngineId = 'google' | 'duckduckgo' | 'bing' | 'yandex';

type SearchEngine = {
  id: SearchEngineId;
  name: string;
  searchUrl: (query: string) => string;
  /** OpenSearch-style suggestion endpoint answering `[query, [suggestions…]]`. Missing when the engine offers none. */
  suggestUrl?: (query: string, language: string) => string;
};

const q = encodeURIComponent;

export const SEARCH_ENGINES: Record<SearchEngineId, SearchEngine> = {
  google: {
    id: 'google',
    name: 'Google',
    searchUrl: (query) => `https://www.google.com/search?q=${q(query)}`,
    suggestUrl: (query, lang) =>
      `https://suggestqueries.google.com/complete/search?client=firefox&hl=${q(lang)}&q=${q(query)}`,
  },
  duckduckgo: {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    searchUrl: (query) => `https://duckduckgo.com/?q=${q(query)}`,
    suggestUrl: (query) => `https://duckduckgo.com/ac/?type=list&q=${q(query)}`,
  },
  // Bing's public suggestion endpoint answers 204 No Content, so it gets local suggestions only.
  bing: {
    id: 'bing',
    name: 'Bing',
    searchUrl: (query) => `https://www.bing.com/search?q=${q(query)}`,
  },
  yandex: {
    id: 'yandex',
    name: 'Yandex',
    searchUrl: (query) => `https://yandex.com/search/?text=${q(query)}`,
    suggestUrl: (query, lang) => `https://suggest.yandex.com/suggest-ff.cgi?uil=${q(lang)}&part=${q(query)}`,
  },
};

export const SEARCH_ENGINE_ORDER: SearchEngineId[] = ['google', 'duckduckgo', 'bing', 'yandex'];

export function isSearchEngine(value: unknown): value is SearchEngineId {
  return typeof value === 'string' && value in SEARCH_ENGINES;
}

/** Parses the OpenSearch suggestion format `[query, [suggestion, …], …]`. */
export function parseSuggestions(body: unknown, limit = 5): string[] {
  if (!Array.isArray(body) || !Array.isArray(body[1])) return [];
  return body[1].filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(0, limit);
}

/**
 * Live suggestions from the search engine. What the user types is sent to the engine,
 * so callers must not use this in incognito tabs or when the user turned suggestions off.
 */
export async function fetchSuggestions(
  engine: SearchEngineId,
  query: string,
  language: string,
  signal: AbortSignal,
): Promise<string[]> {
  const url = SEARCH_ENGINES[engine].suggestUrl?.(query, language);
  if (!url || !query.trim()) return [];
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  return parseSuggestions(await res.json());
}
