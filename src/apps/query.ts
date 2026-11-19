/**
 * The document store's queries (docs/mini-apps.md › Queries): filters, search, order and paging over one collection's
 * documents, in JavaScript (the per-app quota keeps a collection small). Pure code, also runs in Node.
 */

export type Doc = Record<string, unknown> & { id: string; createdAt: number; updatedAt: number };

export type Condition = {
  eq?: unknown;
  ne?: unknown;
  lt?: unknown;
  lte?: unknown;
  gt?: unknown;
  gte?: unknown;
  in?: unknown[];
  contains?: unknown;
  startsWith?: string;
  exists?: boolean;
};

export type Query = {
  where?: Record<string, unknown>;
  search?: { text: string; fields?: string[] };
  orderBy?: string | { field: string; dir?: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
};

export const MAX_QUERY_LIMIT = 500;
export const DEFAULT_QUERY_LIMIT = 100;
const OPS = new Set(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'contains', 'startsWith', 'exists']);
const FIELD = /^[A-Za-z0-9_$-]{1,64}(\.[A-Za-z0-9_$-]{1,64}){0,4}$/;

/** Null when the query is well-formed; otherwise why not (for E_BAD_ARGS). */
export function checkQuery(q: unknown): string | null {
  if (q === undefined || q === null) return null;
  if (typeof q !== 'object' || Array.isArray(q)) return 'the query must be an object';
  const query = q as Record<string, unknown>;
  for (const key of Object.keys(query))
    if (!['where', 'search', 'orderBy', 'limit', 'offset', 'collection'].includes(key)) return `unknown query field ${key}`;
  if (query.where !== undefined) {
    if (!query.where || typeof query.where !== 'object' || Array.isArray(query.where)) return 'where must be an object';
    for (const [field, cond] of Object.entries(query.where)) {
      if (!FIELD.test(field)) return `bad field name ${field}`;
      if (isCondition(cond)) {
        for (const op of Object.keys(cond as object)) if (!OPS.has(op)) return `unknown operator ${op}`;
        const c = cond as Condition;
        if (c.in !== undefined && !Array.isArray(c.in)) return 'in takes a list';
        if (c.startsWith !== undefined && typeof c.startsWith !== 'string') return 'startsWith takes text';
        if (c.exists !== undefined && typeof c.exists !== 'boolean') return 'exists takes true or false';
      }
    }
  }
  if (query.search !== undefined) {
    const s = query.search as { text?: unknown; fields?: unknown };
    if (!s || typeof s !== 'object' || typeof s.text !== 'string') return 'search needs { text }';
    if (s.fields !== undefined && (!Array.isArray(s.fields) || s.fields.some((f) => typeof f !== 'string' || !FIELD.test(f))))
      return 'search.fields must be field names';
  }
  if (query.orderBy !== undefined) {
    const list = typeof query.orderBy === 'string' ? [{ field: query.orderBy }] : query.orderBy;
    if (!Array.isArray(list) || list.length > 4) return 'orderBy: a field name or up to 4 { field, dir }';
    for (const o of list as { field?: unknown; dir?: unknown }[]) {
      if (!o || typeof o.field !== 'string' || !FIELD.test(o.field)) return 'orderBy needs field names';
      if (o.dir !== undefined && o.dir !== 'asc' && o.dir !== 'desc') return 'dir is asc or desc';
    }
  }
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || (query.limit as number) < 1 || (query.limit as number) > MAX_QUERY_LIMIT))
    return `limit is 1 to ${MAX_QUERY_LIMIT}`;
  if (query.offset !== undefined && (!Number.isInteger(query.offset) || (query.offset as number) < 0)) return 'offset is 0 or more';
  return null;
}

/** An object in `where` is always a set of operators; to compare with an object, use { eq: {...} }. */
function isCondition(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function fieldValue(doc: Record<string, unknown>, path: string): unknown {
  let value: unknown = doc;
  for (const part of path.split('.')) {
    if (!value || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

/**
 * Text for searching: lower case without accents, Turkish İ/I/ı handled so "istanbul", "İSTANBUL" and "Istanbul" meet,
 * and "ş", "ç", "ğ", "ö", "ü" match their plain letters (people type both on phones).
 */
export function foldText(text: string): string {
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss');
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

function compare(a: unknown, b: unknown, collate: (x: string, y: string) => number): number {
  // Missing values sort last in ascending order.
  const missingA = a === undefined || a === null;
  const missingB = b === undefined || b === null;
  if (missingA || missingB) return missingA === missingB ? 0 : missingA ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  if (typeof a === 'string' && typeof b === 'string') return collate(a, b);
  return collate(JSON.stringify(a), JSON.stringify(b));
}

function ordered(a: unknown, b: unknown): number | null {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return null;
}

function matchCondition(value: unknown, cond: unknown): boolean {
  if (!isCondition(cond)) return equal(value, cond);
  const c = cond as Condition;
  if (c.exists !== undefined && (value !== undefined && value !== null) !== c.exists) return false;
  if ('eq' in c && !equal(value, c.eq)) return false;
  if ('ne' in c && equal(value, c.ne)) return false;
  for (const [op, test] of [
    ['lt', (d: number) => d < 0],
    ['lte', (d: number) => d <= 0],
    ['gt', (d: number) => d > 0],
    ['gte', (d: number) => d >= 0],
  ] as const) {
    if (op in c) {
      const d = ordered(value, c[op]);
      if (d === null || !test(d)) return false;
    }
  }
  if (c.in !== undefined && !c.in.some((v) => equal(value, v))) return false;
  if ('contains' in c) {
    if (Array.isArray(value)) {
      if (!value.some((v) => equal(v, c.contains))) return false;
    } else if (typeof value === 'string' && typeof c.contains === 'string') {
      if (!foldText(value).includes(foldText(c.contains))) return false;
    } else return false;
  }
  if (c.startsWith !== undefined && !(typeof value === 'string' && foldText(value).startsWith(foldText(c.startsWith)))) return false;
  return true;
}

function stringsOf(value: unknown, out: string[], depth = 0) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value) && depth < 3) value.forEach((v) => stringsOf(v, out, depth + 1));
  else if (value && typeof value === 'object' && depth < 3) Object.values(value).forEach((v) => stringsOf(v, out, depth + 1));
}

export function matches(doc: Doc, query: Query): boolean {
  for (const [field, cond] of Object.entries(query.where ?? {})) if (!matchCondition(fieldValue(doc, field), cond)) return false;
  const words = query.search ? foldText(query.search.text).split(/\s+/).filter(Boolean) : [];
  if (words.length) {
    const texts: string[] = [];
    if (query.search?.fields?.length) query.search.fields.forEach((f) => stringsOf(fieldValue(doc, f), texts));
    else
      for (const [key, value] of Object.entries(doc)) if (key !== 'id') stringsOf(value, texts);
    const haystack = foldText(texts.join('\n'));
    if (!words.every((w) => haystack.includes(w))) return false;
  }
  return true;
}

/** Runs a checked query: the page of matching documents and how many matched in all. */
export function runQuery(
  docs: Doc[],
  query: Query = {},
  collate: (a: string, b: string) => number = (a, b) => a.localeCompare(b),
): { docs: Doc[]; total: number } {
  const found = docs.filter((d) => matches(d, query));
  const order = typeof query.orderBy === 'string' ? [{ field: query.orderBy, dir: 'asc' as const }] : (query.orderBy ?? []);
  found.sort((a, b) => {
    for (const o of order) {
      const d = compare(fieldValue(a, o.field), fieldValue(b, o.field), collate);
      if (d) return o.dir === 'desc' ? -d : d;
    }
    return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
  const offset = query.offset ?? 0;
  const limit = query.limit ?? DEFAULT_QUERY_LIMIT;
  return { docs: found.slice(offset, offset + limit), total: found.length };
}
