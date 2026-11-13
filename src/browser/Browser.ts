import { useSyncExternalStore } from 'react';
import { Tab } from './Tab';

export const HOME_URL = 'https://www.google.com';

/** Holds all tabs and notifies React when anything about them changes. */
export class Browser {
  tabs: Tab[] = [];
  activeId = '';

  private counter = 0;
  private version = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.openTab(HOME_URL);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;

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

  openTab(url: string = HOME_URL, { activate = true, incognito = false } = {}): Tab {
    const tab = new Tab(String(++this.counter), url, incognito, this.emit);
    this.tabs.push(tab);
    if (activate || !this.activeId) this.activeId = tab.id;
    this.emit();
    return tab;
  }

  switchTab(id: string) {
    if (!this.getTab(id) || id === this.activeId) return;
    this.activeId = id;
    this.emit();
  }

  closeTab(id: string) {
    const tab = this.getTab(id);
    if (!tab) return;
    const sameMode = this.tabsOf(tab.incognito);
    const indexInMode = sameMode.indexOf(tab);

    this.tabs.splice(this.tabs.indexOf(tab), 1);
    tab.dispose();

    if (this.tabs.length === 0) {
      this.openTab(HOME_URL);
      return;
    }
    if (this.activeId === id) {
      // Prefer the neighbour in the same mode; leaving incognito falls back to the last normal tab.
      const remaining = sameMode.filter((t) => t !== tab);
      const next = remaining[Math.min(indexInMode, remaining.length - 1)] ?? this.tabs[this.tabs.length - 1];
      this.activeId = next.id;
    }
    this.emit();
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
