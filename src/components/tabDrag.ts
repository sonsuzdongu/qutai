import { Animated, PanResponder } from 'react-native';
import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';

export type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };
export type DropTarget = { kind: 'tab' | 'group'; id: string; x: number; y: number; w: number; h: number };

/** Consecutive tabs of the same group (or of no group) form a section. */
export type TabSection = { key: string; groupId: string | null; tabs: Tab[] };

export function sectionsOf(tabs: Tab[], browser: Browser): TabSection[] {
  const out: TabSection[] = [];
  for (const tab of tabs) {
    const groupId = browser.getGroup(tab.groupId) ? tab.groupId! : null;
    const last = out[out.length - 1];
    if (last && last.groupId === groupId) last.tabs.push(tab);
    else out.push({ key: groupId ?? `tab-${tab.id}`, groupId, tabs: [tab] });
  }
  return out;
}

/** Where a dragged tab lands: before/after the tab under the finger, or into a group via its header. */
export function dropTab(browser: Browser, id: string, targets: DropTarget[], x: number, y: number) {
  const hit = targets.find((r) => r.id !== id && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (!hit) return;
  if (hit.kind === 'group') {
    browser.setGroup(id, hit.id);
    return;
  }
  const target = browser.getTab(hit.id);
  const tab = browser.getTab(id);
  if (!target || !tab) return;
  if ((target.groupId ?? null) !== (tab.groupId ?? null)) browser.setGroup(id, target.groupId ?? null);
  browser.moveTab(id, target.id, x > hit.x + hit.w / 2);
}

/**
 * Long-press-and-drag for tab cards. A long press picks the card up; moving drags it and
 * releasing drops it. A long press released without moving opens the card's menu instead.
 */
export class TabDrag {
  id: string | null = null;
  readonly pan = new Animated.ValueXY();
  private granted = false;
  private targets: DropTarget[] = [];
  private views = new Map<string, { kind: 'tab' | 'group'; view: Measurable }>();
  private handlers: {
    drop: (id: string, x: number, y: number) => void;
    menu: (id: string) => void;
    change: () => void;
  } = {
    drop: () => {},
    menu: () => {},
    change: () => {},
  };

  readonly responder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => this.id !== null,
    onPanResponderGrant: () => {
      this.granted = true;
    },
    onPanResponderMove: (_e, g) => this.pan.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_e, g) => {
      const id = this.id;
      this.end();
      if (id) this.handlers.drop(id, g.moveX, g.moveY);
    },
    onPanResponderTerminate: () => this.end(),
  });

  setHandlers(handlers: TabDrag['handlers']) {
    this.handlers = handlers;
  }

  /** Ref callback for cards and group headers (drop targets). */
  register(kind: 'tab' | 'group', id: string, view: Measurable | null) {
    const key = `${kind}:${id}`;
    if (view) this.views.set(key, { kind, view });
    else this.views.delete(key);
  }

  start(id: string) {
    this.id = id;
    this.granted = false;
    this.pan.setValue({ x: 0, y: 0 });
    this.targets = [];
    this.views.forEach(({ kind, view }, key) =>
      view.measureInWindow((x, y, w, h) => this.targets.push({ kind, id: key.slice(kind.length + 1), x, y, w, h })),
    );
    this.handlers.change();
  }

  /** The finger lifted from the card itself: if it never moved, this was a plain long press. */
  pressOut(id: string) {
    if (this.id !== id) return;
    // The drag gesture takes over (and ends the press) only after a move, so wait a moment.
    setTimeout(() => {
      if (this.id === id && !this.granted) {
        this.end();
        this.handlers.menu(id);
      }
    }, 80);
  }

  get dropTargets(): DropTarget[] {
    return this.targets;
  }

  private end() {
    this.id = null;
    this.granted = false;
    this.pan.setValue({ x: 0, y: 0 });
    this.handlers.change();
  }
}
