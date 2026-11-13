import { useSyncExternalStore } from 'react';
import type { Session } from '../storage/session';
import { Tab } from './Tab';

export const HOME_URL = 'https://www.google.com';

export type ClosedTab = { url: string; title: string; closedAt: number };

const MAX_RECENTLY_CLOSED = 25;

/** Holds all tabs and notifies React when anything about them changes. */
export class Browser {
  tabs: Tab[] = [];
  activeId = '';
  /** Closed normal tabs, newest first. Incognito tabs are never remembered. */
  recentlyClosed: ClosedTab[] = [];

  private counter = 0;
  private version = 0;
  private listeners = new Set<() => void>();
  private visitListeners = new Set<(tab: Tab) => void>();

  constructor(session?: Session | null, recentlyClosed: ClosedTab[] = []) {
    this.recentlyClosed = recentlyClosed.slice(0, MAX_RECENTLY_CLOSED);
    if (session?.tabs.length) {
      session.tabs.forEach((saved, i) => {
        const tab = this.openTab(saved.url, { activate: i === session.activeIndex, asleep: i !== session.activeIndex });
        tab.title = saved.title;
      });
    } else {
      this.openTab(HOME_URL);
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;

  /** Called when a normal (non-incognito) tab finishes loading a page; used for history. */
  onVisit(listener: (tab: Tab) => void) {
    this.visitListeners.add(listener);
    return () => {
      this.visitListeners.delete(listener);
    };
  }

  notifyVisit(tab: Tab) {
    if (tab.incognito) return;
    this.visitListeners.forEach((l) => l(tab));
  }

  private emit = () => {
    this.version++;
    this.listeners.forEach((l) => l());
  };

  get active(): Tab {
    return this.getTab(this.activeId) ?? this.tabs[0];
  }

  getTab(id: string): Tab | undefined {
    return this.tabs.find((t) => t.id === id);
  }

  tabsOf(incognito: boolean): Tab[] {
    return this.tabs.filter((t) => t.incognito === incognito);
  }

  openTab(
    url: string = HOME_URL,
    {
      activate = true,
      incognito = false,
      openerId,
      asleep = false,
    }: { activate?: boolean; incognito?: boolean; openerId?: string; asleep?: boolean } = {},
  ): Tab {
    const tab = new Tab(String(++this.counter), url, incognito, openerId, this.emit);
    tab.asleep = asleep && !activate;
    this.tabs.push(tab);
    if (activate || !this.activeId) this.activeId = tab.id;
    this.emit();
    return tab;
  }

  switchTab(id: string) {
    const tab = this.getTab(id);
    if (!tab || id === this.activeId) return;
    this.activeId = id;
    tab.wake();
    this.emit();
  }

  /** Returns true when the tab was remembered in recently closed (normal web pages only). */
  closeTab(id: string): boolean {
    const tab = this.getTab(id);
    if (!tab) return false;
    const sameMode = this.tabsOf(tab.incognito);
    const indexInMode = sameMode.indexOf(tab);

    this.tabs.splice(this.tabs.indexOf(tab), 1);
    const remembered = !tab.incognito && /^https?:\/\//i.test(tab.url);
    if (remembered) {
      this.recentlyClosed = [{ url: tab.url, title: tab.title, closedAt: Date.now() }, ...this.recentlyClosed].slice(
        0,
        MAX_RECENTLY_CLOSED,
      );
    }
    tab.dispose();

    if (this.tabs.length === 0) {
      this.openTab(HOME_URL);
      return remembered;
    }
    if (this.activeId === id) {
      // Return to the tab that opened this one, like regular browsers. Otherwise prefer the
      // neighbour in the same mode; leaving incognito falls back to the last normal tab.
      const opener = tab.openerId ? this.getTab(tab.openerId) : undefined;
      const remaining = sameMode.filter((t) => t !== tab);
      const next = opener ?? remaining[Math.min(indexInMode, remaining.length - 1)] ?? this.tabs[this.tabs.length - 1];
      this.activeId = next.id;
      next.wake();
    }
    this.emit();
    return remembered;
  }

  /** Reopens a recently closed tab (the latest by default) and shows it. */
  reopenClosed(index = 0): Tab | undefined {
    const closed = this.recentlyClosed[index];
    if (!closed) return undefined;
    this.recentlyClosed = this.recentlyClosed.filter((_, i) => i !== index);
    const tab = this.openTab(closed.url);
    tab.title = closed.title;
    return tab;
  }

  /** Closes every incognito tab, which discards their cookies and storage on iOS. */
  closeAllIncognito() {
    this.tabsOf(true).forEach((t) => this.closeTab(t.id));
  }
}

/** Re-renders the calling component whenever tabs change. */
export function useBrowser(browser: Browser) {
  useSyncExternalStore(browser.subscribe, browser.getVersion);
  return browser;
}
