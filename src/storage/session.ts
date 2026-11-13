import type { Browser, ClosedTab } from '../browser/Browser';
import { Db, getJson, setJson } from './db';

export type SavedTab = { url: string; title: string };
export type Session = { tabs: SavedTab[]; activeIndex: number };

const KEY = 'session';

/** Normal tabs only: incognito tabs never touch the disk. */
export function sessionFromBrowser(browser: Browser): Session {
  const tabs = browser.tabsOf(false);
  const activeIndex = tabs.findIndex((t) => t.id === browser.activeId);
  return {
    tabs: tabs.map((t) => ({ url: t.url, title: t.title })),
    activeIndex: activeIndex === -1 ? tabs.length - 1 : activeIndex,
  };
}

export async function loadSession(db: Db): Promise<Session | null> {
  const session = await getJson<Session>(db, KEY);
  if (!session || !Array.isArray(session.tabs)) return null;
  const tabs = session.tabs.filter((t) => typeof t?.url === 'string' && /^https?:\/\//i.test(t.url));
  if (tabs.length === 0) return null;
  const activeIndex = Math.min(Math.max(0, Number(session.activeIndex) || 0), tabs.length - 1);
  return { tabs, activeIndex };
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
