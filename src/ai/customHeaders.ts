/**
 * Extra HTTP headers for the custom OpenAI-compatible endpoint (for example `cf-aig-authorization` for an
 * authenticated Cloudflare AI Gateway). Values can be secrets: they are stored like the API key (settings.ts, the
 * device's secure storage), shown masked, never written to the "What was sent to the AI" log, and go into a backup
 * only together with the API keys when the user opts in (inside the encrypted file). Pure, so it can be tested
 * outside the app.
 *
 * Rules: at most MAX_CUSTOM_HEADERS rows; a name is an HTTP token (letters, digits and !#$%&'*+-.^_`|~), at most
 * 100 characters, unique ignoring case; a value is printable ASCII without line breaks, at most 1000 characters,
 * not empty. Names the app sets itself or that the network layer owns are refused (RESERVED, plus `proxy-*` and
 * `sec-*`). `authorization` is refused while the API key is set (the key is sent as `Authorization: Bearer`);
 * with the key empty it is allowed, for a server that wants another scheme (`Basic …`, a bare token). A row whose
 * name and value are both empty is ignored.
 */

export type CustomHeader = { name: string; value: string };

export const MAX_CUSTOM_HEADERS = 5;
export const MAX_HEADER_NAME = 100;
export const MAX_HEADER_VALUE = 1000;

/** Set by the app (content-type, accept, authorization with a key) or by the network layer. */
export const RESERVED_HEADERS = [
  'accept',
  'accept-charset',
  'accept-encoding',
  'connection',
  'content-length',
  'content-type',
  'cookie',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'user-agent',
  'via',
];

export type HeaderError =
  | 'nameEmpty'
  | 'nameChars'
  | 'nameLong'
  | 'reserved'
  | 'authWithKey'
  | 'duplicate'
  | 'valueEmpty'
  | 'valueLineBreak'
  | 'valueChars'
  | 'valueLong';

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function isBlank(h: CustomHeader): boolean {
  return !h.name.trim() && !h.value.trim();
}

/** What is wrong with each row (null: fine or blank), in the same order as `headers`. */
export function headerProblems(headers: CustomHeader[], apiKey: string): (HeaderError | null)[] {
  const seen = new Set<string>();
  return headers.map((h) => {
    if (isBlank(h)) return null;
    const name = h.name.trim();
    const lower = name.toLowerCase();
    let error: HeaderError | null = null;
    if (!name) error = 'nameEmpty';
    else if (!TOKEN.test(name)) error = 'nameChars';
    else if (name.length > MAX_HEADER_NAME) error = 'nameLong';
    else if (RESERVED_HEADERS.includes(lower) || lower.startsWith('proxy-') || lower.startsWith('sec-'))
      error = 'reserved';
    else if (lower === 'authorization' && apiKey.trim()) error = 'authWithKey';
    else if (seen.has(lower)) error = 'duplicate';
    else if (/[\r\n]/.test(h.value)) error = 'valueLineBreak';
    else if (!h.value.trim()) error = 'valueEmpty';
    else if (!/^[\x20-\x7e\t]*$/.test(h.value)) error = 'valueChars';
    else if (h.value.trim().length > MAX_HEADER_VALUE) error = 'valueLong';
    if (name) seen.add(lower);
    return error;
  });
}

/** Trimmed rows without blank ones, for saving (rows with a problem are kept so the user sees them again). */
export function cleanCustomHeaders(headers: CustomHeader[]): CustomHeader[] {
  return headers
    .filter((h) => !isBlank(h))
    .slice(0, MAX_CUSTOM_HEADERS)
    .map((h) => ({ name: h.name.trim(), value: h.value.trim() }));
}

/**
 * Every header for a request to the custom endpoint: the extra headers that pass the rules, then the API key as
 * `authorization` when there is one (so a stored row can never replace it). Rows with a problem are left out
 * rather than sent, since the rule for `authorization` depends on the key, which may change after saving.
 */
export function buildCustomHeaders(apiKey: string, extra: CustomHeader[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  const problems = headerProblems(extra, apiKey);
  extra.forEach((h, i) => {
    if (!problems[i] && !isBlank(h)) out[h.name.trim().toLowerCase()] = h.value.trim();
  });
  const key = apiKey.trim();
  if (key) out.authorization = `Bearer ${key}`;
  return out;
}
