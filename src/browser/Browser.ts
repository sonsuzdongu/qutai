import { useSyncExternalStore } from 'react';
import { Conversation, groupChatKey } from '../chat/Conversation';
import { forgetIncognitoOutgoing } from '../device/outgoing';
import { forgetIncognitoFiles } from '../device/composedFile';
import { forgetIncognitoAttachments } from '../device/attachments';
import { closePdf } from '../pdf/reader';
import { endIncognitoProfile, newIncognitoProfile } from '../device/webviewProfile';
import type { Session } from '../storage/session';
import { NEW_TAB_URL, Tab } from './Tab';
import { clearCertificateExceptions, removeTabCertificateExceptions } from './certificateExceptions';
import { t } from '../i18n';

/** New tabs open the app's own new tab page. */
export const HOME_URL = NEW_TAB_URL;

export type TabGroup = { id: string; name: string; color: string; collapsed?: boolean };

export const GROUP_COLORS = ['#c96442', '#3a86ff', '#2a9d8f', '#d4a72c', '#9b5de5', '#e05780'];

/** A new group's name: the opener's site ("trendyol.com"), or "Group n" (in the UI language) for pages without one. */
export function groupNameFor(url: string, n: number): string {
  const host = /^https?:\/\/([^/:?#]+)/i.exec(url)?.[1]?.replace(/^www\./i, '');
  return host || t('tabs.groupName', { number: n });
}

/** uid lets a reopened tab get its conversation back (a group's too, when it was the group's last tab). */
export type ClosedTab = { url: string; title: string; closedAt: number; uid?: string };

/** What undoing "close all tabs in the group" needs (kept in memory only, for the undo bar). */
export type ClosedGroup = {
  group: TabGroup;
  /** Its normal tabs in order; entry is the tab's line in recently closed (web pages only). */
  tabs: { url: string; title: string; uid: string; entry?: ClosedTab }[];
  /** The group's conversation and the closed tab it is kept under meanwhile. */
  chat?: { chat: Conversation; uid: string };
  /** Index in `tabs` of the tab that was active, or -1. */
  activeIndex: number;
  /** The tab that followed the group, so it comes back in the same place. */
  afterId?: string;
  /** The new tab opened because no tab was left. */
  placeholderId?: string;
};

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
  private chatLoadListeners = new Set<(chat: Conversation) => void>();
  /** Tabs that joined a group, in order, whose conversation the group hasn't decided on yet (by group id). */
  private pendingJoins = new Map<string, Tab[]>();

  private counter = 0;
  /**
   * Android: the WebView profile shared by the open incognito tabs (one private session; a new one, with a new
   * name, after the last incognito tab closes). Undefined while no incognito tab is open or without profile support.
   */
  private incognitoProfile: string | undefined;
  /** The tab the agent is working in, which must not fall asleep under it. */
  private agentTab: { id: string } | null = null;
  /** Other tabs the running task reads (read_tab): they stay awake until it ends. */
  private taskTabs = new Set<string>();
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
   * Called when a conversation that may not be on screen must be read from disk now (to decide which
   * conversation a group keeps). The listener reads it once and calls `restore`.
   */
  /** The incognito session ended (its last tab closed): downloads forget its entries. */
  onIncognitoEnd(listener: () => void) {
    this.incognitoEndListeners.add(listener);
    return () => {
      this.incognitoEndListeners.delete(listener);
    };
  }

  private incognitoEndListeners = new Set<() => void>();

  onChatLoadNeeded(listener: (chat: Conversation) => void) {
    this.chatLoadListeners.add(listener);
    return () => {
      this.chatLoadListeners.delete(listener);
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

  /** "Continue anyway" exceptions are forgotten (clearing the cache); the WebViews get the empty list. */
  clearCertificateExceptions() {
    clearCertificateExceptions();
    this.emit();
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
    if (incognito) tab.profile = this.incognitoProfile ??= newIncognitoProfile();
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
    return this.closeTabs([id]).remembered.length > 0;
  }

  /**
   * Closes these tabs in one step (one change notification and session save). Normal web pages are
   * remembered in recently closed in their tab order, the first on top, so reopening them one by one
   * puts them back in order. A group whose last tab closes keeps its conversation under one of its
   * remembered tabs (the active one if it was there, else the first), so reopening that tab brings it back.
   */
  closeTabs(ids: string[]): { remembered: ClosedTab[]; chats: Map<string, { chat: Conversation; uid: string }> } {
    const closing = this.tabs.filter((t) => ids.includes(t.id));
    const chats = new Map<string, { chat: Conversation; uid: string }>();
    if (closing.length === 0) return { remembered: [], chats };
    const active = this.active;
    const sameMode = this.tabsOf(active.incognito);
    const indexInMode = sameMode.indexOf(active);

    this.tabs = this.tabs.filter((t) => !closing.includes(t));
    const now = Date.now();
    const kept = closing.filter((t) => !t.incognito && /^https?:\/\//i.test(t.url));
    const remembered = kept.map((t) => ({ url: t.url, title: t.title, closedAt: now, uid: t.uid }));
    if (remembered.length) {
      this.recentlyClosed = [...remembered, ...this.recentlyClosed].slice(0, MAX_RECENTLY_CLOSED);
    }
    closing.forEach((t) => t.conversation.stop());
    for (const groupId of new Set(closing.flatMap((t) => (t.groupId ? [t.groupId] : [])))) {
      if (this.tabs.some((t) => t.groupId === groupId)) continue;
      // The group goes with its last tab; its conversation is kept under a closed tab, like a closed
      // tab's own, so reopening it from recently closed brings the conversation back.
      const chat = this.groupChats.get(groupId);
      this.groupChats.delete(groupId);
      if (!chat) continue;
      chat.stop();
      if (chat.isBlank) continue;
      const members = closing.filter((t) => t.groupId === groupId);
      const heir =
        kept.find((t) => t === active && t.groupId === groupId) ??
        kept.find((t) => t.groupId === groupId) ??
        members[members.length - 1];
      this.moveChat(chat, heir.uid);
      chats.set(groupId, { chat, uid: heir.uid });
    }
    closing.forEach((t) => {
      t.dispose();
      // An incognito tab's "Continue anyway" exceptions go with it.
      if (t.incognito) removeTabCertificateExceptions(t.id);
    });
    this.dropEmptyGroups();
    this.endIncognitoSessionIfOver();

    if (this.tabs.length === 0) {
      this.openTab(HOME_URL);
      return { remembered, chats };
    }
    if (closing.includes(active)) {
      // Return to the tab that opened the active one, like regular browsers. Otherwise prefer the
      // next tab in the same mode (else the one before); leaving incognito falls back to the last normal tab.
      const opener = active.openerId ? this.getTab(active.openerId) : undefined;
      const open = (t: Tab) => !closing.includes(t);
      const next =
        opener ??
        sameMode.slice(indexInMode + 1).find(open) ??
        sameMode.slice(0, indexInMode).reverse().find(open) ??
        this.tabs[this.tabs.length - 1];
      this.setActive(next);
      next.wake();
    }
    this.emit();
    return { remembered, chats };
  }

  /**
   * The assistant is working in this group: one of its conversations runs a task, or the agent's
   * working tab is one of its tabs.
   */
  isTaskRunningIn(groupId: string): boolean {
    const members = this.tabs.filter((t) => t.groupId === groupId);
    return (
      !!this.groupChats.get(groupId)?.running ||
      members.some((t) => t.conversation.running || t.id === this.agentTab?.id)
    );
  }

  /**
   * Closes every tab of a group in one step, stopping a task the assistant runs there (also one whose
   * working tab is in the group). Returns what undoing it needs, or null when there is nothing to bring
   * back (incognito tabs are never remembered).
   */
  closeGroup(id: string): ClosedGroup | null {
    const group = this.getGroup(id);
    const members = this.tabs.filter((t) => t.groupId === id);
    if (!group || members.length === 0) return null;
    // Only one task runs at a time, so a running conversation is the one using the agent's tab.
    if (members.some((t) => t.id === this.agentTab?.id)) {
      this.conversations.filter((c) => c.running).forEach((c) => c.stop());
    }
    const last = this.tabs.indexOf(members[members.length - 1]);
    const after = this.tabs.slice(last + 1).find((t) => t.groupId !== id);
    const activeIndex = members.findIndex((t) => t.id === this.activeId);
    const before = new Set(this.tabs);
    const { remembered, chats } = this.closeTabs(members.map((t) => t.id));
    const restorable = members.filter((t) => !t.incognito);
    if (restorable.length === 0) return null;
    const placeholder = this.tabs.find((t) => !before.has(t));
    return {
      group: { ...group },
      tabs: restorable.map((t) => ({
        url: t.url,
        title: t.title,
        uid: t.uid,
        entry: remembered.find((c) => c.uid === t.uid),
      })),
      chat: chats.get(id),
      activeIndex: activeIndex >= 0 && !members[activeIndex].incognito ? restorable.indexOf(members[activeIndex]) : -1,
      afterId: after?.id,
      placeholderId: placeholder?.id,
    };
  }

  /**
   * Undoes `closeGroup`: the group comes back with its name, colour and conversation, its tabs in
   * their order where they were (asleep, except the one that was active). Tabs already reopened from
   * recently closed meanwhile are left out; if that took the conversation along, the group starts a new one.
   */
  restoreGroup(closed: ClosedGroup) {
    const tabs = closed.tabs.filter((t) => !t.entry || this.recentlyClosed.includes(t.entry));
    if (tabs.length === 0) return;
    const entries = new Set(tabs.map((t) => t.entry));
    this.recentlyClosed = this.recentlyClosed.filter((c) => !entries.has(c));
    const group = { ...closed.group };
    if (this.getGroup(group.id)) group.id = `${group.id}r`;
    this.groups.push(group);

    const heirBack = closed.chat && tabs.some((t) => t.uid === closed.chat!.uid);
    let chat = heirBack ? closed.chat!.chat : undefined;
    if (!chat) {
      chat = new Conversation(this.emit, groupChatKey(group.id));
      chat.loaded = true;
    }
    this.groupChats.set(group.id, chat);
    if (heirBack) this.moveChat(chat, groupChatKey(group.id));

    const activate = closed.activeIndex >= 0 ? closed.tabs[closed.activeIndex] : undefined;
    const restored = tabs.map((saved) => {
      const tab = new Tab(String(++this.counter), saved.url, false, undefined, this.emit, saved.uid);
      tab.title = saved.title;
      tab.groupId = group.id;
      if (saved !== activate) {
        tab.asleep = true;
        tab.lastActiveAt = 0;
      }
      return tab;
    });
    const after = closed.afterId ? this.getTab(closed.afterId) : undefined;
    this.tabs.splice(after ? this.tabs.indexOf(after) : this.tabs.length, 0, ...restored);

    const active = restored[tabs.indexOf(activate!)];
    if (active) {
      this.setActive(active);
      // The new tab opened only because nothing was left goes again if it was never used.
      const placeholder = closed.placeholderId ? this.getTab(closed.placeholderId) : undefined;
      if (placeholder?.isNewTab && placeholder.conversation.isEmpty && !placeholder.conversation.draft) {
        this.tabs.splice(this.tabs.indexOf(placeholder), 1);
        placeholder.dispose();
      }
    }
    this.sleepInactive();
    this.emit();
  }

  private setActive(tab: Tab) {
    const now = Date.now();
    const previous = this.getTab(this.activeId);
    if (previous) previous.lastActiveAt = now;
    tab.lastActiveAt = now;
    this.activeId = tab.id;
  }

  /** The tab the running task works in, or null between tasks. */
  get agentTabId(): string | null {
    return this.agentTab?.id ?? null;
  }

  /** Keeps the agent's tab (the object is updated as the agent moves between tabs) awake. */
  setAgentTab(agentTab: { id: string } | null) {
    this.agentTab = agentTab;
    this.taskTabs.clear();
  }

  /**
   * Keeps another tab the running task reads awake until the task ends (also when Qutai is in the background, where
   * a sleeping tab cannot get its WebView back until the user returns).
   */
  keepAwakeForTask(id: string) {
    if (this.agentTab && this.getTab(id)) this.taskTabs.add(id);
  }

  /**
   * Puts the least recently used background tabs to sleep until at most `maxAwake` tabs have a
   * WebView. The active tab, the agent's tab, incognito tabs, tabs using the camera or microphone and
   * tabs playing sound always stay awake.
   */
  sleepInactive(maxAwake = MAX_AWAKE_TABS) {
    const keep = new Set([this.activeId, this.agentTab?.id, ...this.taskTabs]);
    const awake = this.tabs.filter((t) => !t.asleep && !t.isNewTab);
    const sleepable = awake
      .filter((t) => !t.incognito && !t.media.capturing && !t.playback.audible && !keep.has(t.id))
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
   * A tab joined a group: the group's conversation wins. A group that has none yet (just created, or
   * its saved one turned out to be empty) takes over the tab's, and the tab starts a new one of its own.
   * Otherwise the tab's own conversation is left as it is (saved under the tab) and comes back if the tab
   * leaves. Joins are decided in the order the tabs joined, each once the group's and the tab's
   * conversations have been read from disk, so the outcome is the same as if both had been loaded.
   */
  private joinGroupChat(tab: Tab, groupId: string) {
    if (!this.groupChats.has(groupId)) return;
    const queue = this.pendingJoins.get(groupId) ?? [];
    queue.push(tab);
    this.pendingJoins.set(groupId, queue);
    this.settleGroupChat(groupId);
  }

  /** Decides the pending joins of a group in order, reading conversations from disk first where needed. */
  private settleGroupChat(groupId: string) {
    const queue = this.pendingJoins.get(groupId) ?? [];
    while (queue.length) {
      const shared = this.groupChats.get(groupId);
      if (!shared) break;
      const tab = queue[0];
      if (tab.groupId !== groupId || !this.tabs.includes(tab)) {
        // It left the group (or closed) before its join was decided: nothing to decide.
        queue.shift();
        continue;
      }
      const unread = [shared, tab.conversation].filter((c) => !c.loaded);
      if (unread.length) {
        unread.forEach((chat) => {
          chat.whenLoaded(() => this.settleGroupChat(groupId));
          this.chatLoadListeners.forEach((l) => l(chat));
        });
        return;
      }
      queue.shift();
      this.decideJoin(tab, groupId, shared);
      this.emit();
    }
    this.pendingJoins.delete(groupId);
  }

  /** `joinGroupChat`'s rule, once both conversations have been read from disk. */
  private decideJoin(tab: Tab, groupId: string, shared: Conversation) {
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
      // listener removes what was saved before (after it was read, so it is still shown).
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
    for (const id of this.pendingJoins.keys()) {
      if (!this.groupChats.has(id)) this.pendingJoins.delete(id);
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

  /**
   * Closes every incognito tab, which ends the incognito session: their cookies and site data are discarded (iOS:
   * each tab's own data store; Android with profile support: the session's profile, see webviewProfile.ts).
   */
  closeAllIncognito() {
    this.closeTabs(this.tabsOf(true).map((t) => t.id));
  }

  /**
   * The last incognito tab is gone: its profile's data is removed once React has destroyed the last WebView using it
   * (native side), and the next incognito tab starts a new session with a new profile.
   */
  private endIncognitoSessionIfOver() {
    if (this.tabs.some((t) => t.incognito)) return;
    // Files the assistant made in incognito conversations go with the session.
    forgetIncognitoFiles();
    // And the copies of files handed from incognito conversations to other apps.
    try {
      forgetIncognitoOutgoing();
    } catch {
      // Nothing to remove.
    }
    // So do the files attached in incognito conversations, and a PDF still open in the reader.
    try {
      forgetIncognitoAttachments();
    } catch {
      // Nothing to remove.
    }
    closePdf();
    this.incognitoEndListeners.forEach((l) => l());
    if (!this.incognitoProfile) return;
    endIncognitoProfile(this.incognitoProfile);
    this.incognitoProfile = undefined;
  }
}

/** Re-renders the calling component whenever tabs change. */
export function useBrowser(browser: Browser) {
  useSyncExternalStore(browser.subscribe, browser.getVersion);
  return browser;
}
