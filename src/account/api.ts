import type { ApiErrorCode } from './types';

/**
 * HTTP client for Qutai's server (pro mode only). Pure code, no React Native imports, so the tests in
 * `scripts/account-tests/` run it in Node against a local server.
 *
 * Nothing here logs: request and response bodies carry tokens.
 */

/** What went wrong with a request: the server's own error codes, or one of ours when no answer came. */
export type AccountErrorCode = ApiErrorCode | 'network' | 'timeout' | 'bad_response';

export class AccountApiError extends Error {
  constructor(
    readonly code: AccountErrorCode,
    /** HTTP status, 0 when there was no answer. */
    readonly status: number,
    /** The server's request id (for support), when it sent one. */
    readonly requestId: string | null = null,
  ) {
    super(code);
    this.name = 'AccountApiError';
  }
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type ApiRequest = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  accessToken?: string;
  timeoutMs?: number;
};

export const DEFAULT_TIMEOUT_MS = 15_000;

const KNOWN_CODES: ReadonlySet<string> = new Set<ApiErrorCode>([
  'bad_request',
  'unauthorized',
  'forbidden',
  'account_suspended',
  'not_found',
  'method_not_allowed',
  'rate_limited',
  'not_implemented',
  'unavailable',
  'internal',
]);

/** Fallback when an error answer has no readable body (a proxy's page, an empty 502). */
function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status === 501) return 'not_implemented';
  if (status === 503 || status === 502 || status === 504) return 'unavailable';
  if (status >= 500) return 'internal';
  return 'bad_request';
}

export function createApi(baseUrl: string, fetchImpl: Fetch = fetch) {
  const base = baseUrl.replace(/\/+$/, '');

  /** Sends one request; resolves with the parsed JSON (or null for 204), rejects with AccountApiError. */
  async function request<T>({ method, path, body, accessToken, timeoutMs = DEFAULT_TIMEOUT_MS }: ApiRequest): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let response: Response;
    try {
      response = await fetchImpl(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new AccountApiError(timedOut ? 'timeout' : 'network', 0);
    } finally {
      clearTimeout(timer);
    }

    const requestId = response.headers.get('X-Request-Id');
    if (response.status === 204) return null as T;
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AccountApiError(response.ok ? 'bad_response' : codeForStatus(response.status), response.status, requestId);
    }
    if (response.ok) return data as T;
    const error = (data as { error?: { code?: unknown; requestId?: unknown } } | null)?.error;
    const code = typeof error?.code === 'string' && KNOWN_CODES.has(error.code) ? (error.code as ApiErrorCode) : codeForStatus(response.status);
    throw new AccountApiError(code, response.status, typeof error?.requestId === 'string' ? error.requestId : requestId);
  }

  return { request };
}

export type Api = ReturnType<typeof createApi>;
