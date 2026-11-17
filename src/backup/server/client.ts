import { sha256 } from '@noble/hashes/sha2.js';
import { hex } from './logic';

/**
 * Client for the server backup routes (backend README › Server backup). Pure code: the tokens and fetch are passed in,
 * so scripts/backup-tests/ run it in Node, against a fake and against a local server. Nothing here logs: the bodies
 * are the user's encrypted data and the headers carry tokens.
 */

export type ServerBackup = {
  id: string;
  createdAt: number;
  size: number;
  sha256: string;
  formatVersion: number;
  appVersion: string | null;
  deviceLabel: string | null;
};

export type BackupLimits = { maxBytes: number; keep: number; uploadsPerDay: number; uploadBytesPerDay: number; downloadsPerDay: number };

export class ServerBackupHttpError extends Error {
  constructor(
    /** The server's error code, or `network`, `timeout`, `aborted`, `bad_response`, `checksum` (download didn't match). */
    readonly code: string,
    readonly status: number,
    readonly reason: string | null = null,
    readonly requestId: string | null = null,
    /** 429: the server's Retry-After in seconds. */
    readonly retryAfter: number | null = null,
  ) {
    super(code);
    this.name = 'ServerBackupHttpError';
  }
}

export interface TokenSource {
  get(): Promise<string>;
  renew(stale: string): Promise<string>;
  suspended(): void;
  ended(): void;
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type UploadMeta = { uploadId: string; appVersion: string; deviceLabel: string };

const JSON_TIMEOUT_MS = 20_000;
/** Uploads and downloads: up to 50 MiB on a slow connection. */
const TRANSFER_TIMEOUT_MS = 10 * 60_000;

const REASON = /^[a-z_]{1,40}$/;

function retryAfterSeconds(value: string | null): number | null {
  if (!value || !/^\s*\d{1,9}\s*$/.test(value)) return null;
  return Math.min(Number(value), 86_400 * 2);
}

async function errorFrom(res: Response): Promise<ServerBackupHttpError> {
  let code = res.status === 401 ? 'unauthorized' : res.status === 413 ? 'payload_too_large' : res.status === 429 ? 'rate_limited' : res.status >= 500 ? 'unavailable' : 'bad_request';
  let reason: string | null = null;
  let requestId = res.headers.get('X-Request-Id');
  try {
    const body = (await res.json()) as { error?: { code?: unknown; reason?: unknown; requestId?: unknown } };
    if (typeof body.error?.code === 'string' && /^[a-z_]{1,40}$/.test(body.error.code)) code = body.error.code;
    if (typeof body.error?.reason === 'string' && REASON.test(body.error.reason)) reason = body.error.reason;
    if (typeof body.error?.requestId === 'string') requestId = body.error.requestId.slice(0, 64);
  } catch {}
  return new ServerBackupHttpError(code, res.status, reason, requestId, retryAfterSeconds(res.headers.get('Retry-After')));
}

function parseBackup(v: unknown): ServerBackup | null {
  if (typeof v !== 'object' || v === null) return null;
  const b = v as Record<string, unknown>;
  if (typeof b.id !== 'string' || typeof b.sha256 !== 'string' || typeof b.size !== 'number' || typeof b.createdAt !== 'number') return null;
  return {
    id: b.id,
    createdAt: b.createdAt,
    size: b.size,
    sha256: b.sha256.toLowerCase(),
    formatVersion: typeof b.formatVersion === 'number' ? b.formatVersion : 0,
    appVersion: typeof b.appVersion === 'string' ? b.appVersion.slice(0, 40) : null,
    deviceLabel: typeof b.deviceLabel === 'string' ? b.deviceLabel.slice(0, 60) : null,
  };
}

/** SHA-256 of the file, lowercase hex (the server checks it on upload; the app checks it on download). */
export function fileSha256(bytes: Uint8Array): string {
  return hex(sha256(bytes));
}

export function createServerBackupClient(options: { baseUrl: string; tokens: TokenSource; fetch?: Fetch }) {
  const base = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl: Fetch = options.fetch ?? ((input, init) => fetch(input, init));

  /** One request with the access token; one renewal and retry when the token was refused. Rejects with ServerBackupHttpError. */
  async function send(path: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
    const attempt = async (token: string): Promise<Response> => {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort);
      try {
        if (signal?.aborted) throw new ServerBackupHttpError('aborted', 0);
        return await fetchImpl(base + path, {
          ...init,
          headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
      } catch (e) {
        if (e instanceof ServerBackupHttpError) throw e;
        throw new ServerBackupHttpError(signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'network', 0);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
    };
    let token: string;
    try {
      token = await options.tokens.get();
    } catch {
      throw new ServerBackupHttpError('unauthorized', 401);
    }
    let res = await attempt(token);
    if (res.status === 401) {
      let fresh: string;
      try {
        fresh = await options.tokens.renew(token);
      } catch {
        throw new ServerBackupHttpError('unauthorized', 401);
      }
      res = await attempt(fresh);
      if (res.status === 401) {
        options.tokens.ended();
        throw await errorFrom(res);
      }
    }
    if (!res.ok) {
      const error = await errorFrom(res);
      if (error.code === 'account_suspended') options.tokens.suspended();
      throw error;
    }
    return res;
  }

  async function readJson<T>(res: Response): Promise<T> {
    try {
      return (await res.json()) as T;
    } catch {
      throw new ServerBackupHttpError('bad_response', res.status);
    }
  }

  return {
    /** `GET /backups`, newest first. */
    async list(signal?: AbortSignal): Promise<{ backups: ServerBackup[]; limits: BackupLimits | null }> {
      const res = await send('/backups', { method: 'GET', headers: { Accept: 'application/json' } }, JSON_TIMEOUT_MS, signal);
      const body = await readJson<{ backups?: unknown; limits?: unknown }>(res);
      if (!Array.isArray(body.backups)) throw new ServerBackupHttpError('bad_response', res.status);
      const backups = body.backups.flatMap((b) => parseBackup(b) ?? []).sort((a, b) => b.createdAt - a.createdAt);
      const l = body.limits as Partial<BackupLimits> | undefined;
      const limits =
        l && typeof l.maxBytes === 'number' && typeof l.keep === 'number'
          ? {
              maxBytes: l.maxBytes,
              keep: l.keep,
              uploadsPerDay: Number(l.uploadsPerDay) || 0,
              uploadBytesPerDay: Number(l.uploadBytesPerDay) || 0,
              downloadsPerDay: Number(l.downloadsPerDay) || 0,
            }
          : null;
      return { backups, limits };
    },

    /** `POST /backups`: the whole file in one request. Safe to repeat with the same `meta.uploadId`. */
    async upload(file: Uint8Array, meta: UploadMeta, signal?: AbortSignal): Promise<{ backup: ServerBackup; replayed: boolean; removed: number }> {
      const res = await send(
        '/backups',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/octet-stream',
            'X-Backup-Sha256': fileSha256(file),
            'X-Backup-Upload-Id': meta.uploadId,
            'X-Backup-App-Version': meta.appVersion,
            'X-Backup-Device': encodeURIComponent(meta.deviceLabel),
          },
          body: file as unknown as BodyInit,
        },
        TRANSFER_TIMEOUT_MS,
        signal,
      );
      const body = await readJson<{ backup?: unknown; replayed?: unknown; removed?: unknown }>(res);
      const backup = parseBackup(body.backup);
      if (!backup) throw new ServerBackupHttpError('bad_response', res.status);
      return { backup, replayed: body.replayed === true, removed: typeof body.removed === 'number' ? body.removed : 0 };
    },

    /**
     * `GET /backups/:id`: the file, checked against the SHA-256 the list and the answer give before anything opens it.
     * `onProgress` gets the fraction received when the platform streams the body.
     */
    async download(backup: Pick<ServerBackup, 'id' | 'size' | 'sha256'>, signal?: AbortSignal, onProgress?: (fraction: number) => void): Promise<Uint8Array> {
      const res = await send(`/backups/${encodeURIComponent(backup.id)}`, { method: 'GET' }, TRANSFER_TIMEOUT_MS, signal);
      let bytes: Uint8Array;
      try {
        const reader = res.body?.getReader?.();
        if (reader && backup.size > 0) {
          bytes = new Uint8Array(backup.size);
          let offset = 0;
          for (;;) {
            if (signal?.aborted) {
              await reader.cancel().catch(() => undefined);
              throw new ServerBackupHttpError('aborted', 0);
            }
            const { done, value } = await reader.read();
            if (done) break;
            if (offset + value.byteLength > bytes.length) throw new ServerBackupHttpError('checksum', res.status);
            bytes.set(value, offset);
            offset += value.byteLength;
            onProgress?.(offset / backup.size);
          }
          if (offset !== bytes.length) throw new ServerBackupHttpError('checksum', res.status);
        } else {
          bytes = new Uint8Array(await res.arrayBuffer());
        }
      } catch (e) {
        if (e instanceof ServerBackupHttpError) throw e;
        throw new ServerBackupHttpError(signal?.aborted ? 'aborted' : 'network', 0);
      }
      const expected = (res.headers.get('X-Backup-Sha256') ?? backup.sha256).toLowerCase();
      if (fileSha256(bytes) !== expected || expected !== backup.sha256.toLowerCase()) throw new ServerBackupHttpError('checksum', res.status);
      return bytes;
    },

    /** `DELETE /backups/:id`. */
    async remove(id: string): Promise<void> {
      await send(`/backups/${encodeURIComponent(id)}`, { method: 'DELETE' }, JSON_TIMEOUT_MS);
    },

    /** `DELETE /backups`: how many went. */
    async removeAll(): Promise<number> {
      const res = await send('/backups', { method: 'DELETE', headers: { Accept: 'application/json' } }, JSON_TIMEOUT_MS);
      const body = await readJson<{ removed?: unknown }>(res);
      return typeof body.removed === 'number' ? body.removed : 0;
    },
  };
}

export type ServerBackupClient = ReturnType<typeof createServerBackupClient>;
