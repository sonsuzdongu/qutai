/**
 * The server backup client (src/backup/server/client.ts) against a fake server in this process: headers and checksum,
 * token renewal, error shapes, the download check, cancel; and a file export and a server backup being the same file
 * (encrypt on "device A", upload, download on "device B", open with the password). Run: npm run test:backup.
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { decryptBackup, encryptBackup } from '../../src/backup/crypto.ts';
import { createServerBackupClient, fileSha256, ServerBackupHttpError, type TokenSource } from '../../src/backup/server/client.ts';

type Stored = { id: string; bytes: Uint8Array; sha256: string; createdAt: number; device: string | null; uploadId: string };

/** A tiny in-memory imitation of the routes (backend README › Server backup), enough for the client's behaviour. */
function fakeServer(o: { token?: string; corruptDownload?: boolean } = {}) {
  const store: Stored[] = [];
  const seen: { method: string; path: string; headers: Record<string, string> }[] = [];
  let token = o.token ?? 'tok-1';
  const fetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const path = new URL(url).pathname;
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>));
    seen.push({ method: init.method ?? 'GET', path, headers });
    if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (headers.Authorization !== `Bearer ${token}`) return Response.json({ error: { code: 'unauthorized', requestId: 'r' } }, { status: 401 });
    if (path === '/backups' && init.method === 'POST') {
      const bytes = new Uint8Array(init.body as Uint8Array);
      const sha = createHash('sha256').update(bytes).digest('hex');
      if (sha !== headers['X-Backup-Sha256']) return Response.json({ error: { code: 'bad_request', reason: 'checksum_mismatch' } }, { status: 400 });
      const earlier = store.find((s) => s.uploadId === headers['X-Backup-Upload-Id']);
      const row = earlier ?? {
        id: crypto.randomUUID(),
        bytes,
        sha256: sha,
        createdAt: Date.now() + store.length,
        device: decodeURIComponent(headers['X-Backup-Device'] ?? ''),
        uploadId: headers['X-Backup-Upload-Id']!,
      };
      if (!earlier) store.push(row);
      return Response.json({ backup: view(row), replayed: !!earlier, removed: 0 }, { status: earlier ? 200 : 201 });
    }
    if (path === '/backups' && init.method === 'GET') {
      return Response.json({ backups: store.map(view), limits: { maxBytes: 52428800, keep: 3, uploadsPerDay: 12, uploadBytesPerDay: 1, downloadsPerDay: 30 } });
    }
    const m = /^\/backups\/(.+)$/.exec(path);
    if (m) {
      const row = store.find((s) => s.id === m[1]);
      if (!row) return Response.json({ error: { code: 'not_found' } }, { status: 404 });
      if (init.method === 'DELETE') {
        store.splice(store.indexOf(row), 1);
        return new Response(null, { status: 204 });
      }
      const body = o.corruptDownload ? row.bytes.map((b, i) => (i === 100 ? b ^ 1 : b)) : row.bytes;
      return new Response(body, { headers: { 'Content-Length': String(body.length), 'X-Backup-Sha256': row.sha256 } });
    }
    return Response.json({ error: { code: 'not_found' } }, { status: 404 });
  };
  const view = (s: Stored) => ({ id: s.id, createdAt: s.createdAt, size: s.bytes.length, sha256: s.sha256, formatVersion: s.bytes[8], appVersion: '1.0.0', deviceLabel: s.device });
  return { fetch, store, seen, rotate: (next: string) => void (token = next) };
}

function tokens(current: () => string, renewTo?: string): TokenSource {
  return {
    get: async () => current(),
    renew: async () => {
      if (!renewTo) throw new Error('session over');
      return renewTo;
    },
    suspended() {},
    ended() {},
  };
}

const random = async (n: number) => new Uint8Array(randomBytes(n));
const meta = (uploadId = 'upload-id-0123456789') => ({ uploadId, appVersion: '1.0.0', deviceLabel: 'iPhone · iOS 26.1' });

describe('server backup client', () => {
  it('uploads with the checksum, upload id and an encoded device label, and lists newest first', async () => {
    const server = fakeServer();
    const client = createServerBackupClient({ baseUrl: 'https://api.test/', tokens: tokens(() => 'tok-1'), fetch: server.fetch });
    const file = await encryptBackup(new TextEncoder().encode('{"app":"qutai"}'), 'correct horse battery', random);
    const { backup, replayed } = await client.upload(file, meta());
    assert.equal(replayed, false);
    const sent = server.seen.at(-1)!;
    assert.equal(sent.headers['X-Backup-Sha256'], createHash('sha256').update(file).digest('hex'));
    assert.equal(sent.headers['X-Backup-Upload-Id'], 'upload-id-0123456789');
    assert.equal(sent.headers['X-Backup-Device'], encodeURIComponent('iPhone · iOS 26.1'));
    assert.equal(backup.deviceLabel, 'iPhone · iOS 26.1');
    await client.upload(await encryptBackup(new Uint8Array([1]), 'correct horse battery', random), meta('upload-id-second-0000'));
    const listed = await client.list();
    assert.equal(listed.backups.length, 2);
    assert.ok(listed.backups[0]!.createdAt >= listed.backups[1]!.createdAt);
    assert.equal(listed.limits?.keep, 3);
  });

  it('a repeated upload id is answered, not stored twice', async () => {
    const server = fakeServer();
    const client = createServerBackupClient({ baseUrl: 'https://api.test', tokens: tokens(() => 'tok-1'), fetch: server.fetch });
    const file = await encryptBackup(new Uint8Array([1, 2, 3]), 'correct horse battery', random);
    await client.upload(file, meta());
    const again = await client.upload(file, meta());
    assert.equal(again.replayed, true);
    assert.equal(server.store.length, 1);
  });

  it('renews a refused token once and retries', async () => {
    const server = fakeServer({ token: 'tok-2' });
    const client = createServerBackupClient({ baseUrl: 'https://api.test', tokens: tokens(() => 'tok-1', 'tok-2'), fetch: server.fetch });
    assert.deepEqual((await client.list()).backups, []);
    assert.deepEqual(
      server.seen.map((s) => s.headers.Authorization),
      ['Bearer tok-1', 'Bearer tok-2'],
    );
  });

  it('says signed out when the session is over', async () => {
    const server = fakeServer({ token: 'other' });
    const client = createServerBackupClient({ baseUrl: 'https://api.test', tokens: tokens(() => 'tok-1'), fetch: server.fetch });
    await assert.rejects(client.list(), (e: unknown) => e instanceof ServerBackupHttpError && e.code === 'unauthorized');
  });

  it('keeps the server code, reason, request id and Retry-After of an error', async () => {
    const client = createServerBackupClient({
      baseUrl: 'https://api.test',
      tokens: tokens(() => 'tok-1'),
      fetch: async () =>
        Response.json(
          { error: { code: 'rate_limited', reason: 'daily_upload_limit', requestId: 'req-9', message: 'ignored <b>text</b>' } },
          { status: 429, headers: { 'Retry-After': '7200' } },
        ),
    });
    await assert.rejects(client.upload(new Uint8Array(80), meta()), (e: unknown) => {
      assert.ok(e instanceof ServerBackupHttpError);
      assert.deepEqual([e.code, e.status, e.reason, e.requestId, e.retryAfter], ['rate_limited', 429, 'daily_upload_limit', 'req-9', 7200]);
      return true;
    });
  });

  it('maps a 413 without a readable body and a dropped connection', async () => {
    const tooBig = createServerBackupClient({ baseUrl: 'https://api.test', tokens: tokens(() => 't'), fetch: async () => new Response('<html>', { status: 413 }) });
    await assert.rejects(tooBig.upload(new Uint8Array(80), meta()), (e: unknown) => e instanceof ServerBackupHttpError && e.code === 'payload_too_large');
    const offline = createServerBackupClient({
      baseUrl: 'https://api.test',
      tokens: tokens(() => 't'),
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    await assert.rejects(offline.list(), (e: unknown) => e instanceof ServerBackupHttpError && e.code === 'network');
  });

  it('refuses a download whose bytes do not match the checksum', async () => {
    const server = fakeServer({ corruptDownload: true });
    const client = createServerBackupClient({ baseUrl: 'https://api.test', tokens: tokens(() => 'tok-1'), fetch: server.fetch });
    const { backup } = await client.upload(await encryptBackup(new Uint8Array(500), 'correct horse battery', random), meta());
    await assert.rejects(client.download(backup), (e: unknown) => e instanceof ServerBackupHttpError && e.code === 'checksum');
  });

  it('stops when cancelled', async () => {
    const server = fakeServer();
    const client = createServerBackupClient({ baseUrl: 'https://api.test', tokens: tokens(() => 'tok-1'), fetch: server.fetch });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(client.list(controller.signal), (e: unknown) => e instanceof ServerBackupHttpError && e.code === 'aborted');
  });

  it('device A backs up, device B restores with the password: the same file as an export', async () => {
    const server = fakeServer();
    const deviceA = createServerBackupClient({ baseUrl: 'https://api.test', tokens: tokens(() => 'tok-1'), fetch: server.fetch });
    const deviceB = createServerBackupClient({ baseUrl: 'https://api.test', tokens: tokens(() => 'tok-1'), fetch: server.fetch });
    const payload = JSON.stringify({ app: 'qutai', payloadVersion: 1, createdAt: 1, appVersion: '1.0.0', schemaVersion: 9, history: [{ url: 'https://example.com/', title: 'x', visitedAt: 1 }] });
    const file = await encryptBackup(new TextEncoder().encode(payload), 'correct horse battery', random);
    await deviceA.upload(file, meta());
    const [newest] = (await deviceB.list()).backups;
    const progress: number[] = [];
    const downloaded = await deviceB.download(newest!, undefined, (f) => progress.push(f));
    assert.deepEqual(downloaded, file);
    assert.equal(fileSha256(downloaded), newest!.sha256);
    assert.equal(progress.at(-1), 1);
    assert.equal(new TextDecoder().decode(await decryptBackup(downloaded, 'correct horse battery')), payload);
    await assert.rejects(decryptBackup(downloaded, 'wrong password!!'), (e: unknown) => (e as { code?: string }).code === 'wrong-password');
    await deviceB.remove(newest!.id);
    assert.equal((await deviceA.list()).backups.length, 0);
  });
});
