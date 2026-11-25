/**
 * The desktop-style tab strip (UI-74 in docs/design/27-interface.md) and the address bar's default place on a Mac
 * (UI-73). Pure: no React Native, so it is tested with node:test (scripts/layout-tests/tabStrip.test.ts).
 */
import type { WindowSize } from './layout';

/** The narrowest window that shows the strip, in points: an iPad upright (744 to 834) and every Mac window wider than
 * this get it; iPad Split View and Slide Over halves (320 to 694) and narrow Mac windows hide it. */
export const TAB_STRIP_MIN_WIDTH = 700;
/** A tab's width in the strip: as wide as the room allows between these, like a desktop browser. */
export const STRIP_TAB_MIN = 120;
export const STRIP_TAB_MAX = 220;

export type StripDevice = 'mac' | 'tablet' | 'android' | 'phone';

/**
 * Whether the device is a Mac (the iOS build on Apple Silicon) or an iPad: those start with the address bar at the top
 * and offer the tab strip. Decided by the kind of device, never by the window's width, so a large phone on its side or
 * an Android device never gets them (owner, 25 Nov 2026).
 */
export function offersTabStrip(device: StripDevice): boolean {
  return device === 'mac' || device === 'tablet';
}

/**
 * The address bar's place when the user has never chosen one: at the top on a Mac or an iPad (like a desktop browser),
 * at the bottom everywhere else (UI-36). A stored choice, from Settings or a restored backup, always wins.
 */
export function addressBarPositionFor(stored: string | null | undefined, wideDevice: boolean): 'top' | 'bottom' {
  if (stored === 'top' || stored === 'bottom') return stored;
  return wideDevice ? 'top' : 'bottom';
}

/**
 * Whether the tab strip shows: only on a Mac or an iPad, with the setting on, the address bar at the top and a window at
 * least TAB_STRIP_MIN_WIDTH wide. Phones and Android never get it, so they look exactly as before.
 */
export function showTabStrip(
  window: WindowSize,
  device: StripDevice,
  position: 'top' | 'bottom',
  enabled: boolean,
): boolean {
  return offersTabStrip(device) && enabled && position === 'top' && window.width >= TAB_STRIP_MIN_WIDTH;
}

/** One tab's width: the room shared by the tabs, kept between STRIP_TAB_MIN and STRIP_TAB_MAX (then it scrolls). */
export function stripTabWidth(room: number, tabs: number): number {
  if (tabs <= 0) return STRIP_TAB_MAX;
  return Math.max(STRIP_TAB_MIN, Math.min(STRIP_TAB_MAX, Math.floor(room / tabs)));
}

export type StripTabIn = { id: string; groupId?: string | null };
export type StripGroupIn = {
  id: string;
  name: string;
  color: string;
  collapsed?: boolean;
};

export type StripItem =
  | {
      kind: 'group';
      key: string;
      groupId: string;
      name: string;
      color: string;
      collapsed: boolean;
      count: number;
    }
  | {
      kind: 'tab';
      key: string;
      tabId: string;
      groupColor: string | null;
      active: boolean;
    };

/**
 * What the strip draws, in the tabs' order: a group's coloured label before its tabs (they keep the group's colour on
 * their edge), and a collapsed group as its label alone, except the active tab, which always stays visible. Tabs whose
 * group no longer exists are plain tabs.
 */
export function stripItems(tabs: StripTabIn[], groups: StripGroupIn[], activeId: string | null): StripItem[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const counts = new Map<string, number>();
  for (const tab of tabs)
    if (tab.groupId && byId.has(tab.groupId)) counts.set(tab.groupId, (counts.get(tab.groupId) ?? 0) + 1);
  const out: StripItem[] = [];
  let current: string | null = null;
  for (const tab of tabs) {
    const group = tab.groupId ? byId.get(tab.groupId) : undefined;
    const groupId = group ? group.id : null;
    if (group && groupId !== current) {
      out.push({
        kind: 'group',
        key: `group-${group.id}-${tab.id}`,
        groupId: group.id,
        name: group.name,
        color: group.color,
        collapsed: !!group.collapsed,
        count: counts.get(group.id) ?? 0,
      });
    }
    current = groupId;
    const active = tab.id === activeId;
    if (group?.collapsed && !active) continue;
    out.push({
      kind: 'tab',
      key: `tab-${tab.id}`,
      tabId: tab.id,
      groupColor: group ? group.color : null,
      active,
    });
  }
  return out;
}
