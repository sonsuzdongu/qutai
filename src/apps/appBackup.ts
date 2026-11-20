import type { Db } from '../storage/db';
import { checkAppData, type AppData } from './appFile';
import { KNOWN_PERMISSIONS, checkPackage, packageHash, packageSealMatches, packageSize, type AppManifest, type AppPackage } from './manifest';
import { readAppData, writeAppData } from './store';

/**
 * Apps in the encrypted backup, which is also the server backup (docs/mini-apps.md › Backup and restore): the current
 * version of each app with its seal, state and grants, and, when the user keeps "Apps' data" on, its data. On restore
 * the seal counts only when it verifies with this phone's key: on another phone (or after a reinstall) an app comes
 * back switched off, unsealed and without grants, with its data intact. Pure code over the Db interface.
 */

export type BackupApp = {
  manifest: AppManifest;
  files: Record<string, string>;
  sha256: string;
  seal: string | null;
  state: 'active' | 'disabled';
  grants: Record<string, 'granted' | 'denied'>;
  createdAt: number;
  updatedAt: number;
  openedAt: number | null;
  data?: AppData;
};

export type BackupApps = { withData: boolean; items: BackupApp[] };

/** Apps in one backup at most (far more than anyone has; a cap for untrusted input). */
export const MAX_BACKUP_APPS = 500;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const time = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 8.64e15 ? Math.floor(v) : 0);

function cleanGrants(v: unknown): BackupApp['grants'] {
  const out: BackupApp['grants'] = {};
  if (!isObj(v)) return out;
  for (const [k, g] of Object.entries(v))
    if ((KNOWN_PERMISSIONS as readonly string[]).includes(k) && (g === 'granted' || g === 'denied')) out[k] = g;
  return out;
}

/** Reads the backup's apps section; apps that fail a check are dropped one by one (never the whole backup). */
export function readBackupApps(raw: unknown): BackupApps | undefined {
  if (!isObj(raw) || !Array.isArray(raw.items)) return undefined;
  const withData = raw.withData === true;
  const items: BackupApp[] = [];
  const ids = new Set<string>();
  for (const item of raw.items.slice(0, MAX_BACKUP_APPS)) {
    if (!isObj(item) || !isObj(item.manifest) || !isObj(item.files) || typeof item.sha256 !== 'string') continue;
    const pkg = { manifest: item.manifest as unknown as AppManifest, files: item.files as Record<string, string> };
    if (checkPackage(pkg).length || packageHash(pkg) !== item.sha256 || ids.has(pkg.manifest.id)) continue;
    let data: AppData | undefined;
    if (item.data !== undefined) {
      const checked = checkAppData(item.data);
      // Data that fails its checks is left out; the app itself still comes back.
      if (!('problem' in checked)) data = checked.data;
    }
    ids.add(pkg.manifest.id);
    items.push({
      manifest: pkg.manifest,
      files: pkg.files,
      sha256: item.sha256,
      seal: typeof item.seal === 'string' && /^[0-9a-f]{64}$/.test(item.seal) ? item.seal : null,
      state: item.state === 'disabled' ? 'disabled' : 'active',
      grants: cleanGrants(item.grants),
      createdAt: time(item.createdAt),
      updatedAt: time(item.updatedAt),
      openedAt: item.openedAt == null ? null : time(item.openedAt),
      ...(data ? { data } : {}),
    });
  }
  return { withData, items };
}

/** Reads every app (current version) for a backup; with each app's data when `withData`. */
export async function collectBackupApps(db: Db, withData: boolean): Promise<BackupApps> {
  const rows = await db.getAllAsync<{
    id: string;
    state: string;
    grants: string;
    created_at: number;
    updated_at: number;
    opened_at: number | null;
    manifest: string;
    files: string;
    hash: string;
    seal: string | null;
  }>(
    `SELECT a.id, a.state, a.grants, a.created_at, a.updated_at, a.opened_at, v.manifest, v.files, v.hash, v.seal
     FROM apps a JOIN app_versions v ON v.app_id = a.id AND v.version = a.current_version ORDER BY a.created_at`,
    [],
  );
  const items: BackupApp[] = [];
  for (const r of rows) {
    let pkg: AppPackage;
    try {
      pkg = { manifest: JSON.parse(r.manifest), files: JSON.parse(r.files) };
    } catch {
      continue;
    }
    let grants: unknown = {};
    try {
      grants = JSON.parse(r.grants);
    } catch {}
    items.push({
      manifest: pkg.manifest,
      files: pkg.files,
      sha256: packageHash(pkg),
      seal: r.seal,
      state: r.state === 'disabled' ? 'disabled' : 'active',
      grants: cleanGrants(grants),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      openedAt: r.opened_at,
      ...(withData ? { data: await readAppData(db, r.id) } : {}),
    });
  }
  return { withData, items };
}

/** Bytes of all apps' data as the quota counts them (the "Apps' data" switch shows it). */
export async function appsDataBytes(db: Db): Promise<number> {
  const kv = await db.getFirstAsync<{ s: number | null }>('SELECT SUM(size) AS s FROM app_kv', []);
  const docs = await db.getFirstAsync<{ s: number | null }>('SELECT SUM(size) AS s FROM app_docs', []);
  return (kv?.s ?? 0) + (docs?.s ?? 0);
}

/** What a restored app becomes on this phone: as it was when the seal verifies, otherwise off, unsealed, no grants. */
export function restoredAppState(app: BackupApp, key: Uint8Array | null): { sealed: boolean; state: 'active' | 'disabled'; seal: string | null; grants: string } {
  const sealed = packageSealMatches({ manifest: app.manifest, files: app.files }, app.seal, key);
  return sealed
    ? { sealed, state: app.state, seal: app.seal, grants: JSON.stringify(app.grants) }
    : { sealed, state: 'disabled', seal: null, grants: '{}' };
}

/**
 * Writes the backup's apps inside the restore's transaction (the caller holds it). Merge: an app whose id is here is
 * kept as it is (versions and data); others are added. Replace: every app on the phone goes, then the backup's are
 * written; a backup made without apps' data keeps the phone's data of the apps it has.
 */
export async function restoreApps(db: Db, apps: BackupApps, mode: 'merge' | 'replace', key: Uint8Array | null, now: number): Promise<void> {
  const ids = apps.items.map((a) => a.manifest.id);
  if (mode === 'replace') {
    const marks = ids.map(() => '?').join(', ');
    if (apps.withData || !ids.length) {
      await db.runAsync('DELETE FROM app_kv', []);
      await db.runAsync('DELETE FROM app_docs', []);
    } else {
      await db.runAsync(`DELETE FROM app_kv WHERE app_id NOT IN (${marks})`, ids);
      await db.runAsync(`DELETE FROM app_docs WHERE app_id NOT IN (${marks})`, ids);
    }
    await db.runAsync('DELETE FROM app_versions', []);
    await db.runAsync('DELETE FROM apps', []);
  }
  const here = new Set((await db.getAllAsync<{ id: string }>('SELECT id FROM apps', [])).map((r) => r.id));
  for (const app of apps.items) {
    const id = app.manifest.id;
    if (here.has(id)) continue;
    const s = restoredAppState(app, key);
    await db.runAsync(
      'INSERT INTO apps (id, name, current_version, state, grants, created_at, updated_at, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, app.manifest.name, app.manifest.version, s.state, s.grants, app.createdAt || now, app.updatedAt || now, app.openedAt],
    );
    await db.runAsync(
      'INSERT INTO app_versions (app_id, version, manifest, files, size, hash, seal, source, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)',
      [id, app.manifest.version, JSON.stringify(app.manifest), JSON.stringify(app.files), packageSize(app.files), app.sha256, s.seal, 'restore', now],
    );
    if (app.data) {
      // Replace without data kept the phone's rows of this id; the backup's data (when it has some) wins over them.
      await db.runAsync('DELETE FROM app_kv WHERE app_id = ?', [id]);
      await db.runAsync('DELETE FROM app_docs WHERE app_id = ?', [id]);
      await writeAppData(db, id, app.data);
    }
  }
}
