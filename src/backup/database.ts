import { listSiteRules, listUserStyles } from '../storage/siteRules';
import { exportData as exportBookmarks } from '../storage/bookmarks';
import { Db, getJson, SqlValue } from '../storage/db';
import { listActions } from '../storage/actionLog';
import { listMemories } from '../storage/memory';
import { listSavedTasks, MAX_SAVED_TASKS } from '../storage/savedTasks';
import { loadSession } from '../storage/session';
import {
  listBlockingOff,
  listLocationSettings,
  listPersonalSettings,
  listMediaSettings,
  listSitePermissions,
} from '../storage/sitePermissions';
import type { BackupChat, BackupPayload, BackupTab } from './payload';

/**
 * Reads the database into a backup payload and writes a backup back. Settings and API keys live in
 * the secure store and are handled by the caller.
 */

export type ExportChoice = { tabs: boolean; chats: boolean; activity: boolean };

/** Conversations are saved as `chat:<tab uid>` or `chat:group:<group id>` in the kv table. */
const chatKey = (key: string) => `chat:${key}`;

const newUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export async function collectBackup(
  db: Db,
  choice: ExportChoice,
): Promise<Omit<BackupPayload, 'app' | 'payloadVersion' | 'createdAt' | 'appVersion'>> {
  const [version, bookmarks, history, memories, permissions, location, media, blockingOff, tasks, personal, rules, styles] =
    await Promise.all([
    db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []),
    exportBookmarks(db),
    db.getAllAsync<{ url: string; title: string; visited_at: number }>(
      'SELECT url, title, visited_at FROM history ORDER BY visited_at, id',
      [],
    ),
    listMemories(db),
    listSitePermissions(db),
    listLocationSettings(db),
    listMediaSettings(db),
    listBlockingOff(db),
    listSavedTasks(db),
    listPersonalSettings(db),
    listSiteRules(db),
    listUserStyles(db),
  ]);
  const payload: Omit<BackupPayload, 'app' | 'payloadVersion' | 'createdAt' | 'appVersion'> = {
    schemaVersion: version?.user_version ?? 0,
    bookmarks: {
      folders: bookmarks.folders,
      items: bookmarks.bookmarks.map(({ url, title, createdAt, folderId }) => ({ url, title, createdAt, folderId })),
    },
    history: history.map((h) => ({ url: h.url, title: h.title, visitedAt: h.visited_at })),
    memories: memories.map(({ text, category, createdAt, updatedAt, sensitive, label }) => ({
      text,
      category,
      createdAt,
      updatedAt,
      ...(sensitive ? { sensitive } : {}),
      ...(sensitive && label ? { label } : {}),
    })),
    tasks: tasks.map((task) => ({
      name: task.name,
      prompt: task.prompt,
      target: task.target,
      url: task.url,
      research: task.research,
      createdAt: task.createdAt,
      lastUsedAt: task.lastUsedAt,
      schedule: task.schedule,
      paused: task.paused,
      private: task.private,
      autoRun: task.autoRun,
    })),
    sites: {
      permissions: permissions.flatMap((p) => (p.level === 'default' ? [] : [{ host: p.host, level: p.level }])),
      location: location.flatMap((l) => (l.setting === 'ask' ? [] : [{ host: l.host, setting: l.setting }])),
      media: media.flatMap((m) => (m.setting === 'ask' ? [] : [{ host: m.host, kind: m.kind, setting: m.setting }])),
      blockingOff,
      personal: personal.flatMap((p) => (p.setting === 'ask' ? [] : [{ host: p.host, setting: p.setting }])),
      rules: rules.map(({ line, enabled, source, site, url, createdAt }) => ({
        line,
        enabled,
        source,
        site,
        ...(url ? { url } : {}),
        createdAt,
      })),
      styles: styles.map(({ name, scope, css, enabled, source, site, url, createdAt }) => ({
        name,
        scope,
        css,
        enabled,
        source,
        site,
        ...(url ? { url } : {}),
        createdAt,
      })),
    },
  };
  if (choice.tabs) {
    const session = await loadSession(db);
    const tabs: BackupTab[] = (session?.tabs ?? []).map((tab) => ({
      url: tab.url,
      title: tab.title,
      uid: tab.uid ?? newUid(),
      ...(tab.groupId ? { groupId: tab.groupId } : {}),
    }));
    const groups = (session?.groups ?? []).map(({ id, name, color, collapsed }) => ({
      id,
      name,
      color,
      ...(collapsed ? { collapsed: true } : {}),
    }));
    payload.tabs = { tabs, activeIndex: session?.activeIndex ?? 0, groups };
    if (choice.chats) {
      // The conversations of the tabs and groups in the backup; a chat without its tab would be thrown away.
      const keys = [...tabs.map((tab) => tab.uid), ...groups.map((g) => `group:${g.id}`)];
      const chats: BackupChat[] = [];
      for (const key of keys) {
        const chat = await getJson<{ items?: unknown; turns?: unknown }>(db, chatKey(key));
        if (chat && Array.isArray(chat.items) && Array.isArray(chat.turns)) {
          chats.push({ key, items: chat.items, turns: chat.turns });
        }
      }
      payload.chats = chats;
    }
  }
  if (choice.activity) {
    payload.activity = (await listActions(db, 5000)).map(({ at, host, url, tool, description, ok }) => ({
      at,
      host,
      url,
      tool,
      description,
      ok,
    }));
  }
  return payload;
}

export type ApplyMode = 'merge' | 'replace';

const BATCH = 200;

async function insertRows(db: Db, sql: string, columns: number, rows: SqlValue[][]): Promise<void> {
  const marks = `(${new Array(columns).fill('?').join(', ')})`;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db.runAsync(`${sql} VALUES ${batch.map(() => marks).join(', ')}`, batch.flat());
  }
}

/**
 * Writes a validated backup into the database in one transaction: if anything fails, nothing changes.
 * Kinds the backup doesn't contain are left alone.
 *
 * Merge keeps what is on the phone and adds what is missing:
 * - bookmarks: folders are matched by name under the same parent (created when missing); a URL that is
 *   already bookmarked keeps its title and folder.
 * - history: each visit is added unless the same URL at the same time is already there.
 * - memories: added unless the same text (any case) is remembered, up to the limit of 100.
 * - saved tasks: added unless a task with the same prompt is saved, up to the limit of 200.
 * - site permissions, personal information, location, camera and microphone: the backup's setting applies only to
 *   sites with none on the phone.
 * - site rules and user styles: added unless the phone has the same rule line, or a style with the same scope and CSS.
 * - tabs: the backup's tabs are added after the open ones (a tab or group already here is skipped).
 * - chats: added for the tabs and groups that don't have one.
 * - activity: entries are added unless the same one is already there.
 * Replace first erases the phone's data of each kind the backup contains.
 */
export async function applyBackup(db: Db, p: BackupPayload, mode: ApplyMode, now = Date.now()): Promise<void> {
  const replace = mode === 'replace';
  await db.withTransactionAsync(async () => {
    if (p.bookmarks) {
      if (replace) {
        await db.runAsync('DELETE FROM bookmarks', []);
        await db.runAsync('DELETE FROM bookmark_folders', []);
      }
      const existing = await db.getAllAsync<{ id: number; parent_id: number | null; title: string }>(
        'SELECT id, parent_id, title FROM bookmark_folders',
        [],
      );
      const byPlace = new Map(existing.map((f) => [`${f.parent_id ?? ''}/${f.title}`, f.id]));
      const mapped = new Map<number, number>();
      // Parents first: repeat until every folder has its place (parse removed cycles and dangling parents).
      // Replace keeps the backup's tree as it is, even two folders with the same name side by side.
      let pending = p.bookmarks.folders;
      while (pending.length) {
        const rest: typeof pending = [];
        for (const f of pending) {
          if (f.parentId !== null && !mapped.has(f.parentId)) {
            rest.push(f);
            continue;
          }
          const parent = f.parentId === null ? null : mapped.get(f.parentId)!;
          const place = `${parent ?? ''}/${f.title}`;
          let folderId = replace ? undefined : byPlace.get(place);
          if (folderId === undefined) {
            const result = await db.runAsync(
              'INSERT INTO bookmark_folders (parent_id, title, created_at) VALUES (?, ?, ?)',
              [parent, f.title, f.createdAt || now],
            );
            folderId = result.lastInsertRowId;
            byPlace.set(place, folderId);
          }
          mapped.set(f.id, folderId);
        }
        if (rest.length === pending.length) break;
        pending = rest;
      }
      await insertRows(
        db,
        'INSERT OR IGNORE INTO bookmarks (url, title, created_at, folder_id)',
        4,
        p.bookmarks.items.map((b) => [
          b.url,
          b.title,
          b.createdAt || now,
          b.folderId === null ? null : (mapped.get(b.folderId) ?? null),
        ]),
      );
    }

    if (p.history) {
      if (replace) await db.runAsync('DELETE FROM history', []);
      const seen = new Set(
        replace
          ? []
          : (await db.getAllAsync<{ url: string; visited_at: number }>('SELECT url, visited_at FROM history', [])).map(
              (h) => `${h.visited_at} ${h.url}`,
            ),
      );
      const rows: SqlValue[][] = [];
      for (const h of p.history) {
        const key = `${h.visitedAt} ${h.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push([h.url, h.title, h.visitedAt]);
      }
      await insertRows(db, 'INSERT INTO history (url, title, visited_at)', 3, rows);
    }

    if (p.memories) {
      if (replace) await db.runAsync('DELETE FROM memories', []);
      const texts = new Set(
        (await db.getAllAsync<{ text: string }>('SELECT text FROM memories', [])).map((m) => m.text.toLowerCase()),
      );
      const room = Math.max(0, 100 - texts.size);
      const fresh = p.memories.filter((m) => !texts.has(m.text.toLowerCase())).slice(0, room);
      await insertRows(
        db,
        'INSERT INTO memories (id, text, category, created_at, updated_at, sensitive, label)',
        7,
        fresh.map((m, i) => [
          `${Math.random().toString(36).slice(2, 8)}${(now + i).toString(36).slice(-4)}`,
          m.text,
          m.category,
          m.createdAt || now,
          m.updatedAt || now,
          m.sensitive ? 1 : 0,
          m.sensitive ? (m.label ?? null) : null,
        ]),
      );
    }

    if (p.tasks) {
      if (replace) await db.runAsync('DELETE FROM saved_tasks', []);
      const prompts = new Set(
        (await db.getAllAsync<{ prompt: string }>('SELECT prompt FROM saved_tasks', [])).map((x) => x.prompt),
      );
      const room = Math.max(0, MAX_SAVED_TASKS - prompts.size);
      const fresh = p.tasks.filter((x) => !prompts.has(x.prompt)).slice(0, room);
      await insertRows(
        db,
        'INSERT INTO saved_tasks (id, name, prompt, target, url, research, created_at, updated_at, last_used_at, ' +
          'schedule, schedule_paused, private, auto_run)',
        13,
        fresh.map((x, i) => [
          `${Math.random().toString(36).slice(2, 8)}${(now + i).toString(36).slice(-4)}`,
          x.name,
          x.prompt,
          x.target,
          x.url,
          x.research ? 1 : 0,
          x.createdAt || now,
          now,
          x.lastUsedAt,
          x.schedule ? JSON.stringify(x.schedule) : null,
          x.paused ? 1 : 0,
          x.private ? 1 : 0,
          x.autoRun ? 1 : 0,
        ]),
      );
    }

    if (p.sites) {
      if (replace) {
        await db.runAsync('DELETE FROM site_permissions', []);
        await db.runAsync('DELETE FROM site_location', []);
        await db.runAsync('DELETE FROM site_media', []);
        await db.runAsync('DELETE FROM site_blocking', []);
        await db.runAsync('DELETE FROM site_personal', []);
        await db.runAsync('DELETE FROM site_rules', []);
      }
      await insertRows(
        db,
        'INSERT OR IGNORE INTO site_permissions (host, level, updated_at)',
        3,
        p.sites.permissions.map((s) => [s.host, s.level, now]),
      );
      await insertRows(
        db,
        'INSERT OR IGNORE INTO site_location (host, setting, updated_at)',
        3,
        p.sites.location.map((s) => [s.host, s.setting, now]),
      );
      await insertRows(
        db,
        'INSERT OR IGNORE INTO site_media (host, kind, setting, updated_at)',
        4,
        (p.sites.media ?? []).map((s) => [s.host, s.kind, s.setting, now]),
      );
      await insertRows(
        db,
        'INSERT OR IGNORE INTO site_blocking (host, updated_at)',
        2,
        (p.sites.blockingOff ?? []).map((host) => [host, now]),
      );
      await insertRows(
        db,
        'INSERT OR IGNORE INTO site_personal (host, setting, updated_at)',
        3,
        (p.sites.personal ?? []).map((s) => [s.host, s.setting, now]),
      );
      // A rule the phone already has (the same line) is kept as it is.
      const have = new Set((await listSiteRules(db)).map((r) => r.line));
      await insertRows(
        db,
        'INSERT OR IGNORE INTO site_rules (id, line, enabled, source, site, url, created_at)',
        7,
        (p.sites.rules ?? [])
          .filter((r) => !have.has(r.line))
          .map((r, i) => [`b${now.toString(36)}${i}`, r.line, r.enabled ? 1 : 0, r.source, r.site, r.url ?? null, r.createdAt]),
      );
      // A style the phone already has (the same scope and CSS) is kept as it is; the CSS was sanitised when read.
      const haveStyles = new Set((await listUserStyles(db)).map((st) => `${st.scope}\n${st.css}`));
      await insertRows(
        db,
        'INSERT OR IGNORE INTO site_rules (id, line, enabled, source, site, url, created_at, kind, name, body)',
        10,
        (p.sites.styles ?? [])
          .filter((st) => !haveStyles.has(`${st.scope}\n${st.css}`))
          .map((st, i) => [
            `s${now.toString(36)}${i}`,
            st.scope,
            st.enabled ? 1 : 0,
            st.source,
            st.site,
            st.url ?? null,
            st.createdAt,
            'style',
            st.name,
            st.css,
          ]),
      );
    }

    let chatKeys: Set<string> | null = null;
    if (p.tabs) {
      const current = replace ? null : await loadSession(db);
      const uids = new Set(current?.tabs.map((tab) => tab.uid));
      const groupIds = new Set(current?.groups?.map((g) => g.id));
      const added = p.tabs.tabs.filter((tab) => !uids.has(tab.uid));
      const tabs = [...(current?.tabs ?? []), ...added];
      const groups = [...(current?.groups ?? []), ...p.tabs.groups.filter((g) => !groupIds.has(g.id))];
      const activeIndex = current ? current.activeIndex : Math.min(p.tabs.activeIndex, Math.max(0, tabs.length - 1));
      await db.runAsync(
        'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        ['session', JSON.stringify({ tabs, activeIndex, groups })],
      );
      chatKeys = new Set([...tabs.flatMap((tab) => (tab.uid ? [tab.uid] : [])), ...groups.map((g) => `group:${g.id}`)]);
    }

    if (p.chats) {
      if (replace) await db.runAsync("DELETE FROM kv WHERE key LIKE 'chat:%'", []);
      // Without the tabs, only chats for tabs and groups that are open on this phone are useful.
      const keep = chatKeys ?? new Set(await openChatKeys(db));
      await insertRows(
        db,
        'INSERT OR IGNORE INTO kv (key, value)',
        2,
        p.chats
          .filter((c) => keep.has(c.key))
          .map((c) => [chatKey(c.key), JSON.stringify({ items: c.items, turns: c.turns })]),
      );
    }

    if (p.activity) {
      if (replace) await db.runAsync('DELETE FROM agent_actions', []);
      const seen = new Set(
        (
          await db.getAllAsync<{ at: number; tool: string; description: string }>(
            'SELECT at, tool, description FROM agent_actions',
            [],
          )
        ).map((a) => `${a.at} ${a.tool} ${a.description}`),
      );
      await insertRows(
        db,
        'INSERT INTO agent_actions (at, host, url, tool, description, ok)',
        6,
        p.activity
          .filter((a) => !seen.has(`${a.at} ${a.tool} ${a.description}`))
          .map((a) => [a.at, a.host, a.url, a.tool, a.description, a.ok ? 1 : 0]),
      );
    }
  });
}

async function openChatKeys(db: Db): Promise<string[]> {
  const session = await loadSession(db);
  return [
    ...(session?.tabs ?? []).flatMap((tab) => (tab.uid ? [tab.uid] : [])),
    ...(session?.groups ?? []).map((g) => `group:${g.id}`),
  ];
}
