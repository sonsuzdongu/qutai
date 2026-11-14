/**
 * OpenRouter's model catalogue (GET https://openrouter.ai/api/v1/models, "List all models and their
 * properties"), reduced to what the model picker and the agent need. Pure: catalogue JSON in, models out.
 */

import type { ModelTag } from './types';

export type CatalogModel = {
  id: string;
  name: string;
  /** Context window in tokens (0: not given). */
  context: number;
  /** Takes image input; without it, `view_screenshot` returns a tool error telling the model to use read_page. */
  images: boolean;
  /** The output limit of the model's top provider, when given. */
  maxOutput?: number;
};

/**
 * A short, hand-picked list shown above the full catalogue: current models that are good at many-step tool use.
 * Plain data, meant to be updated as models come and go (ids from the catalogue; names are shown until the
 * catalogue has been fetched). Prices are never kept here: they change, and the catalogue has them.
 */
export const OPENROUTER_RECOMMENDED: { id: string; name: string; tag?: ModelTag }[] = [
  { id: 'anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', tag: 'recommended' },
  { id: 'openai/gpt-6.1-terra', name: 'GPT-6.1 Terra' },
  { id: 'google/gemini-4-hydrogen', name: 'Gemini 4 Hydrogen' },
  { id: 'anthropic/claude-haiku-5.5', name: 'Claude Haiku 5.5', tag: 'fastest' },
  { id: 'anthropic/claude-opus-5.5', name: 'Claude Opus 5.5', tag: 'strongest' },
];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Models that accept `tools` (the assistant can't work without them), sorted by name. */
export function parseCatalog(json: unknown): CatalogModel[] {
  const data = isObj(json) && Array.isArray(json.data) ? json.data : [];
  const out: CatalogModel[] = [];
  const seen = new Set<string>();
  for (const m of data) {
    if (!isObj(m) || typeof m.id !== 'string' || !m.id || seen.has(m.id)) continue;
    const params = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
    if (!params.includes('tools')) continue;
    const arch = isObj(m.architecture) ? m.architecture : {};
    const inputs = Array.isArray(arch.input_modalities) ? arch.input_modalities : [];
    const top = isObj(m.top_provider) ? m.top_provider : {};
    const maxOutput = typeof top.max_completion_tokens === 'number' && top.max_completion_tokens > 0 ? top.max_completion_tokens : undefined;
    seen.add(m.id);
    out.push({
      id: m.id,
      name: typeof m.name === 'string' && m.name ? m.name.slice(0, 120) : m.id,
      context: typeof m.context_length === 'number' ? m.context_length : 0,
      images: inputs.includes('image'),
      ...(maxOutput ? { maxOutput } : {}),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive match on the id and the name, every word of the query. */
export function searchCatalog(models: CatalogModel[], query: string): CatalogModel[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return models;
  return models.filter((m) => {
    const hay = `${m.id} ${m.name}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
