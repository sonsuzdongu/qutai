import type { Browser, ClosedTab, TabGroup } from '../browser/Browser';
import { Db, getJson, setJson } from './db';

export type SavedTab = { url: string; title: string; uid?: string; groupId?: string };
export type Session = { tabs: SavedTab[]; activeIndex: number; groups?: TabGroup[] };

const KEY = 'session';

/** Normal tabs only: incognito tabs never touch the disk. */
export function sessionFromBrowser(browser: Browser): Session {
  const tabs = browser.tabsOf(false);
  const activeIndex = tabs.findIndex((t) => t.id === browser.activeId);
  return {
    tabs: tabs.map((t) => ({ url: t.url, title: t.title, uid: t.uid, ...(t.groupId ? { groupId: t.groupId } : {}) })),
    groups: browser.groups.filter((g) => tabs.some((t) => t.groupId === g.id)),
    activeIndex: activeIndex === -1 ? tabs.length - 1 : activeIndex,
  };
}

export async function loadSession(db: Db): Promise<Session | null> {
  const session = await getJson<Session>(db, KEY);
  if (!session || !Array.isArray(session.tabs)) return null;
  const tabs = session.tabs
    .filter((t) => typeof t?.url === 'string' && /^https?:\/\//i.test(t.url))
    .map((t) => ({
      url: t.url,
      title: String(t.title ?? ''),
      uid: typeof t.uid === 'string' ? t.uid : undefined,
      groupId: typeof t.groupId === 'string' ? t.groupId : undefined,
    }));
  if (tabs.length === 0) return null;
  const activeIndex = Math.min(Math.max(0, Number(session.activeIndex) || 0), tabs.length - 1);
  const groups = Array.isArray(session.groups)
    ? session.groups.filter(
        (g) => typeof g?.id === 'string' && typeof g.name === 'string' && typeof g.color === 'string',
      )
    : [];
  return { tabs, activeIndex, groups };
}

export async function saveSession(db: Db, session: Session): Promise<void> {
  await setJson(db, KEY, session);
}

const CLOSED_KEY = 'recentlyClosed';

export async function loadRecentlyClosed(db: Db): Promise<ClosedTab[]> {
  const list = await getJson<ClosedTab[]>(db, CLOSED_KEY);
  return Array.isArray(list) ? list.filter((t) => typeof t?.url === 'string' && /^https?:\/\//i.test(t.url)) : [];
}

export async function saveRecentlyClosed(db: Db, list: ClosedTab[]): Promise<void> {
  await setJson(db, CLOSED_KEY, list);
}
