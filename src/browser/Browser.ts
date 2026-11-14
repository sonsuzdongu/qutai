import { useSyncExternalStore } from 'react';
import { Conversation, groupChatKey } from '../chat/Conversation';
import type { Session } from '../storage/session';
import { NEW_TAB_URL, Tab } from './Tab';

/** New tabs open the app's own new tab page. */
export const HOME_URL = NEW_TAB_URL;

export type TabGroup = { id: string; name: string; color: string; collapsed?: boolean };

export const GROUP_COLORS = ['#c96442', '#3a86ff', '#2a9d8f', '#d4a72c', '#9b5de5', '#e05780'];

/** A new group's name: the opener's site ("trendyol.com"), or "Group n" for pages without one. */
export function groupNameFor(url: string, n: number): string {
  const host = /^https?:\/\/([^/:?#]+)/i.exec(url)?.[1]?.replace(/^www\./i, '');
  return host || `Group ${n}`;
}

/** uid lets a reopened tab get its conversation back (a group's too, when it was the group's last tab). */
export type ClosedTab = { url: string; title: string; closedAt: number; uid?: string };

const MAX_RECENTLY_CLOSED = 25;
/** Background tabs beyond this many keep only their URL and title (each WebView costs a lot of memory). */
export const MAX_AWAKE_TABS = 5;

/** Holds all tabs and notifies React when anything about them changes. */
export class Browser {
  tabs: Tab[] = [];
  activeId = '';
  /** Closed normal tabs, newest first. Incognito tabs are never remembered. */
  recentlyClosed: ClosedTab[] = [];
  /** Tab groups; a group's tabs are kept next to each other in `tabs`. */
  groups: TabGroup[] = [];
  /** Each group's conversation, shared by its tabs (by group id). */
  private groupChats = new Map<string, Conversation>();
  private chatMoveListeners = new Set<(chat: Conversation, fromKey: string) => void>();

  private counter = 0;
  /** The tab the agent is working in, which must not fall asleep under it. */
  private agentTab: { id: string } | null = null;
  private version = 0;
  private listeners = new Set<() => void>();
  private visitListeners = new Set<(tab: Tab) => void>();

  constructor(session?: Session | null, recentlyClosed: ClosedTab[] = []) {
    this.recentlyClosed = recentlyClosed.slice(0, MAX_RECENTLY_CLOSED);
    if (session?.tabs.length) {
      this.groups = (session.groups ?? []).filter((g) => session.tabs.some((t) => t.groupId === g.id));
      // Group ids are saved with the session, so a restored group finds its saved conversation.
      this.groups.forEach((g) => this.groupChats.set(g.id, new Conversation(this.emit, groupChatKey(g.id))));
      session.tabs.forEach((saved, i) => {
        const tab = this.openTab(saved.url, {
          activate: i === session.activeIndex,
          asleep: i !== session.activeIndex,
          uid: saved.uid,
        });
        tab.title = saved.title;
        if (saved.groupId && this.groups.some((g) => g.id === saved.groupId)) tab.groupId = saved.groupId;
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

  /**
   * Called when a conversation moves to another storage key (from a tab to the group it founded, from a
   * dissolved group to one of its tabs…), so its saved copy can follow. fromKey is the old key; it equals
   * the current key when only the saved copy must be redone (a group took in an incognito tab).
   */
  onChatMoved(listener: (chat: Conversation, fromKey: string) => void) {
    this.chatMoveListeners.add(listener);
    return () => {
      this.chatMoveListeners.delete(listener);
    };
  }

  /**
   * The conversation shown and used for a tab: its group's if it is in one, otherwise its own.
   * A task running in the tab's own conversation stays with the tab until it ends, even if the
   * tab joined a group meanwhile, so it is never hidden or run twice.
   */
  conversationOf(tab: Tab): Conversation {
    const shared = tab.groupId ? this.groupChats.get(tab.groupId) : undefined;
    return shared && !tab.conversation.running ? shared : tab.conversation;
  }

  /** Every live conversation: each open tab's own and each group's. */
  get conversations(): Conversation[] {
    return [...this.tabs.map((t) => t.conversation), ...this.groupChats.values()];
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
      uid,
      group = false,
    }: {
      activate?: boolean;
      incognito?: boolean;
      openerId?: string;
      asleep?: boolean;
      uid?: string;
      /** Join the opener's tab group, starting one named after the opener's site if it has none. */
      group?: boolean;
    } = {},
  ): Tab {
    const tab = new Tab(String(++this.counter), url, incognito, openerId, this.emit, uid);
    tab.asleep = asleep && !activate;
    if (tab.asleep) tab.lastActiveAt = 0;
    this.tabs.push(tab);
    const opener = group && openerId ? this.getTab(openerId) : undefined;
    if (opener) {
      const groupId =
        opener.groupId ?? this.createGroup([opener.id], groupNameFor(opener.url, this.groups.length + 1)).id;
      this.setGroup(tab.id, groupId);
    }
    if (activate || !this.activeId) this.setActive(tab);
    this.sleepInactive();
    this.emit();
    return tab;
  }

  switchTab(id: string) {
    const tab = this.getTab(id);
    if (!tab || id === this.activeId) return;
    this.setActive(tab);
    tab.wake();
    this.sleepInactive();
    this.emit();
  }

  /** Returns true when the tab was remembered in recently closed (normal web pages only). */
  closeTab(id: string): boolean {
    const tab = this.getTab(id);
    if (!tab) return false;
    const sameMode = this.tabsOf(tab.incognito);
    const indexInMode = sameMode.indexOf(tab);

    this.tabs.splice(this.tabs.indexOf(tab), 1);
    const lastOfGroup = !!tab.groupId && !this.tabs.some((t) => t.groupId === tab.groupId);
    const remembered = !tab.incognito && /^https?:\/\//i.test(tab.url);
    if (remembered) {
      this.recentlyClosed = [
        { url: tab.url, title: tab.title, closedAt: Date.now(), uid: tab.uid },
        ...this.recentlyClosed,
      ].slice(0, MAX_RECENTLY_CLOSED);
    }
    tab.conversation.stop();
    if (lastOfGroup) {
      // The group goes with its last tab; its conversation is kept under the tab, like a closed
      // tab's own, so reopening it from recently closed brings the conversation back.
      const chat = this.groupChats.get(tab.groupId!);
      this.groupChats.delete(tab.groupId!);
      if (chat) {
        chat.stop();
        if (!chat.isBlank) this.moveChat(chat, tab.uid);
      }
    }
    tab.dispose();
    this.dropEmptyGroups();

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
      this.setActive(next);
      next.wake();
    }
    this.emit();
    return remembered;
  }

  private setActive(tab: Tab) {
    const now = Date.now();
    const previous = this.getTab(this.activeId);
    if (previous) previous.lastActiveAt = now;
    tab.lastActiveAt = now;
    this.activeId = tab.id;
  }

  /** Keeps the agent's tab (the object is updated as the agent moves between tabs) awake. */
  setAgentTab(agentTab: { id: string } | null) {
    this.agentTab = agentTab;
  }

  /**
   * Puts the least recently used background tabs to sleep until at most `maxAwake` tabs have a
   * WebView. The active tab, the agent's tab and incognito tabs always stay awake.
   */
  sleepInactive(maxAwake = MAX_AWAKE_TABS) {
    const keep = new Set([this.activeId, this.agentTab?.id]);
    const awake = this.tabs.filter((t) => !t.asleep && !t.isNewTab);
    const sleepable = awake
      .filter((t) => !t.incognito && !keep.has(t.id))
      .sort((a, b) => a.lastActiveAt - b.lastActiveAt);
    sleepable.slice(0, Math.max(0, awake.length - maxAwake)).forEach((t) => t.sleep());
  }

  getGroup(id: string | undefined): TabGroup | undefined {
    return id ? this.groups.find((g) => g.id === id) : undefined;
  }

  /** Starts a new group with these tabs ("Group 1", "Group 2"… until renamed). */
  createGroup(tabIds: string[], name: string): TabGroup {
    const group: TabGroup = {
      id: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      name,
      color: GROUP_COLORS[this.groups.length % GROUP_COLORS.length],
    };
    this.groups.push(group);
    // A new group has nothing to read from disk; its first tab with a conversation hands it over.
    const chat = new Conversation(this.emit, groupChatKey(group.id));
    chat.loaded = true;
    this.groupChats.set(group.id, chat);
    tabIds.forEach((id) => this.setGroup(id, group.id));
    this.emit();
    return group;
  }

  /** Puts a tab into a group (next to the group's other tabs) or takes it out (null). */
  setGroup(tabId: string, groupId: string | null) {
    const tab = this.getTab(tabId);
    if (!tab) return;
    if (groupId && !this.getGroup(groupId)) return;
    const previous = tab.groupId;
    tab.groupId = groupId ?? undefined;
    if (previous && previous !== groupId) {
      // Leaving: the conversation stays with the group and the tab shows its own again. If this was
      // the group's last tab, the group dissolves and its conversation comes along.
      const remaining = this.tabs.filter((t) => t.groupId === previous);
      if (remaining.length === 0) this.dissolveGroupChat(previous, [tab]);
    }
    if (groupId && previous !== groupId) this.joinGroupChat(tab, groupId);
    if (groupId) {
      const members = this.tabs.filter((t) => t.groupId === groupId && t !== tab);
      const last = members[members.length - 1];
      if (last) this.moveTab(tab.id, last.id, true);
    }
    this.dropEmptyGroups();
    this.emit();
  }

  renameGroup(id: string, name: string) {
    const group = this.getGroup(id);
    if (!group) return;
    group.name = name.trim().slice(0, 40) || group.name;
    this.emit();
  }

  toggleGroup(id: string) {
    const group = this.getGroup(id);
    if (!group) return;
    group.collapsed = !group.collapsed;
    this.emit();
  }

  /** Dissolves a group; its tabs stay open. */
  ungroup(id: string) {
    const members = this.tabs.filter((t) => t.groupId === id);
    members.forEach((t) => {
      t.groupId = undefined;
    });
    this.dissolveGroupChat(id, members);
    this.groups = this.groups.filter((g) => g.id !== id);
    this.emit();
  }

  /**
   * A tab joined a group: the group's conversation wins. A group that has none yet (just created)
   * takes over the tab's, and the tab starts a new one of its own. Otherwise the tab's own
   * conversation is left as it is (saved under the tab) and comes back if the tab leaves.
   */
  private joinGroupChat(tab: Tab, groupId: string) {
    const shared = this.groupChats.get(groupId);
    if (!shared) return;
    if (shared.isBlank && !tab.conversation.isBlank) {
      const own = tab.conversation;
      const fresh = new Conversation(this.emit, tab.uid, tab.incognito);
      fresh.loaded = true;
      tab.conversation = fresh;
      own.incognito ||= shared.incognito;
      this.groupChats.set(groupId, own);
      this.moveChat(own, groupChatKey(groupId));
    } else if (tab.incognito && !shared.incognito) {
      // A group that ever held an incognito tab never writes its conversation to disk; the
      // listener removes what was saved before.
      shared.incognito = true;
      this.chatMoveListeners.forEach((l) => l(shared, shared.key));
    }
  }

  /**
   * A group goes away while some of its tabs stay open: its conversation moves to the active one
   * (else the first) so it isn't lost, replacing that tab's own. A tab whose own conversation is
   * still running a task is skipped, so the task is never cut off.
   */
  private dissolveGroupChat(groupId: string, members: Tab[]) {
    const chat = this.groupChats.get(groupId);
    this.groupChats.delete(groupId);
    if (!chat || chat.isBlank) return;
    const heir = [...members]
      .sort((a, b) => Number(b.id === this.activeId) - Number(a.id === this.activeId))
      .find((t) => !t.conversation.running);
    if (!heir) return;
    heir.conversation = chat;
    chat.incognito ||= heir.incognito;
    this.moveChat(chat, heir.uid);
  }

  /** Gives a conversation a new storage key and lets the listeners move its saved copy. */
  private moveChat(chat: Conversation, key: string) {
    const from = chat.key;
    if (from === key) return;
    chat.key = key;
    this.chatMoveListeners.forEach((l) => l(chat, from));
  }

  /** Moves a tab right before (or after) another one. */
  moveTab(id: string, targetId: string, after = false) {
    const tab = this.getTab(id);
    const target = this.getTab(targetId);
    if (!tab || !target || tab === target) return;
    this.tabs.splice(this.tabs.indexOf(tab), 1);
    this.tabs.splice(this.tabs.indexOf(target) + (after ? 1 : 0), 0, tab);
    this.emit();
  }

  private dropEmptyGroups() {
    this.groups = this.groups.filter((g) => this.tabs.some((t) => t.groupId === g.id));
    for (const id of this.groupChats.keys()) {
      if (!this.groups.some((g) => g.id === id)) this.groupChats.delete(id);
    }
  }

  clearRecentlyClosed() {
    this.recentlyClosed = [];
    this.emit();
  }

  /** Reopens a recently closed tab (the latest by default) and shows it. */
  reopenClosed(index = 0): Tab | undefined {
    const closed = this.recentlyClosed[index];
    if (!closed) return undefined;
    this.recentlyClosed = this.recentlyClosed.filter((_, i) => i !== index);
    const tab = this.openTab(closed.url, { uid: closed.uid });
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
