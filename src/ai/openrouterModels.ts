import { getDb, getJson as readJson, setJson, withDb } from '../storage/db';
import { getJson } from './http';
import { CatalogModel, parseCatalog } from './openrouterCatalog';

const MODELS_URL = 'https://openrouter.ai/api/v1/models?supported_parameters=tools';
const CACHE_KEY = 'openrouter:models';

export type Catalog = { at: number; models: CatalogModel[] };

let catalog: Catalog | null = null;
let loading: Promise<Catalog | null> | null = null;
const listeners = new Set<(c: Catalog | null) => void>();

function publish(next: Catalog | null) {
  catalog = next;
  listeners.forEach((fn) => fn(next));
}

/** The cached catalogue, read from disk once. */
export function loadCatalog(): Promise<Catalog | null> {
  if (catalog) return Promise.resolve(catalog);
  loading ??= (async () => {
    try {
      const saved = await readJson<Catalog>(await getDb(), CACHE_KEY);
      if (saved && Array.isArray(saved.models) && !catalog) publish(saved);
    } catch {}
    return catalog;
  })();
  return loading;
}

/** Fetches the catalogue with the user's key (models their account can't use may still be listed) and caches it. */
export async function refreshCatalog(apiKey: string, signal?: AbortSignal): Promise<Catalog> {
  const json = await getJson<unknown>(MODELS_URL, apiKey ? { authorization: `Bearer ${apiKey}` } : {}, signal);
  const next: Catalog = { at: Date.now(), models: parseCatalog(json) };
  publish(next);
  // A cache: when it can't be written the list is fetched again next time (recorded only).
  void withDb('openrouter.cache', (db) => setJson(db, CACHE_KEY, next));
  return next;
}

export function getCatalog(): Catalog | null {
  return catalog;
}

/** A model from the cached catalogue (undefined until loaded, or for an id it doesn't list). */
export function catalogModel(id: string): CatalogModel | undefined {
  return catalog?.models.find((m) => m.id === id);
}

export function onCatalogChange(fn: (c: Catalog | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
