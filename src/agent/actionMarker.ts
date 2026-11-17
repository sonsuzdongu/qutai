import { AppState, Dimensions } from 'react-native';
import type { Tab } from '../browser/Tab';
import { isRunningInBackground } from '../device/backgroundTask';
import { sleep } from '../utils/sleep';
import { screenshotStillValid } from '../ui/layout';
import { FractionBox, MARKER_DWELL_MS, markerPoint, markerRect, Rect, ringFor } from './markerGeometry';

/**
 * The on-page action marker (docs/working-mode.md): just before the assistant clicks or types, the app shows where,
 * in its own layer above the WebView (components/ActionMarkerLayer.tsx), then waits MARKER_DWELL_MS. Nothing goes into
 * the page's DOM (the page only reports the element's box), nothing changes in the tool's result, and nothing is sent
 * or stored. Every failure here is silent: the step then runs exactly as it would without the marker.
 */

export type Mark =
  | { id: number; kind: 'ring'; cx: number; cy: number; size: number }
  | { id: number; kind: 'frame'; rect: Rect }
  | { id: number; kind: 'scroll'; direction: 'up' | 'down'; view: Rect }
  | { id: number; kind: 'sweep'; view: Rect };

/** A mark before it gets its id. */
type NewMark = { [K in Mark['kind']]: Omit<Extract<Mark, { kind: K }>, 'id'> }[Mark['kind']];

type Environment = {
  /** "Show where the assistant acts" is on. */
  enabled: () => boolean;
  /** This tab is the one on screen, with nothing (the panel, reader mode, another screen) over its page. */
  visible: (tab: Tab) => boolean;
};

let env: Environment | null = null;
let layerOrigin: { x: number; y: number } | null = null;
let current: Mark | null = null;
let counter = 0;
let clearTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

/** Called by App.tsx with what decides whether a marker is shown. */
export function setMarkerEnvironment(next: Environment | null) {
  env = next;
}

/** The marker layer's own window origin (measured on layout). */
export function setMarkerLayerOrigin(origin: { x: number; y: number } | null) {
  layerOrigin = origin;
}

export const markerStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get: () => current,
};

function show(mark: NewMark, ms: number) {
  current = { ...mark, id: ++counter } as Mark;
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(clearMark, ms);
  listeners.forEach((l) => l());
}

export function clearMark() {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  if (!current) return;
  current = null;
  listeners.forEach((l) => l());
}

/** The tab's page in window coordinates, or null when it can't be measured. */
function measurePage(tab: Tab): Promise<Rect | null> {
  const container = tab.container;
  if (!container) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 300);
    try {
      container.measureInWindow((x, y, width, height) => {
        clearTimeout(timer);
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

const MARKED = new Set(['click', 'type', 'select_option', 'click_at', 'scroll', 'scroll_to', 'read_page']);

/** How long each step waited for its marker, for measuring the dwell's cost (development builds log it). */
export const markerTimings: { tool: string; ms: number }[] = [];

/**
 * Shows the marker for a page step that is about to run, and waits the dwell for clicks and typing. Never throws;
 * returns at once when no marker applies (setting off, in the background, the tab not on screen…).
 */
export async function markBeforeAction(tab: Tab, name: string, input: Record<string, unknown>): Promise<void> {
  if (!MARKED.has(name) || !env || !env.enabled() || !layerOrigin) return;
  if (isRunningInBackground() || AppState.currentState !== 'active') return;
  if (tab.isNewTab || tab.reader || tab.asleep || !env.visible(tab)) return;
  const started = Date.now();
  try {
    const page = await measurePage(tab);
    const origin = layerOrigin;
    if (!page || !origin) return;
    let dwell = false;
    switch (name) {
      case 'click':
      case 'type':
      case 'select_option':
      case 'scroll_to': {
        const box = await tab
          .run<FractionBox | null>('actionRect', [input.ref, name === 'click' ? 'click' : 'field'], 1500)
          .catch(() => null);
        const rect = markerRect(box, page, origin);
        if (!rect) return;
        if (name === 'click') show({ kind: 'ring', ...ringFor(rect) }, 900);
        else show({ kind: 'frame', rect }, name === 'scroll_to' ? 700 : 1100);
        dwell = name !== 'scroll_to';
        break;
      }
      case 'click_at': {
        const size = tab.modelScreenshotSize;
        const x = Number(input.x);
        const y = Number(input.y);
        // Taken before the screen turned: the step is refused, so nothing to mark.
        if (!size || !screenshotStillValid(size.window, Dimensions.get('window'))) return;
        const point = markerPoint(x / size.width, y / size.height, page, origin);
        if (!point) return;
        show({ kind: 'ring', cx: point.x, cy: point.y, size: 40 }, 900);
        dwell = true;
        break;
      }
      case 'scroll': {
        const direction = input.direction === 'up' || input.direction === 'top' ? 'up' : 'down';
        show({ kind: 'scroll', direction, view: { ...page, x: page.x - origin.x, y: page.y - origin.y } }, 700);
        break;
      }
      case 'read_page':
        show({ kind: 'sweep', view: { ...page, x: page.x - origin.x, y: page.y - origin.y } }, 900);
        break;
    }
    if (dwell) await sleep(MARKER_DWELL_MS);
  } catch {
    // The step runs as it would without the marker.
  } finally {
    const ms = Date.now() - started;
    markerTimings.push({ tool: name, ms });
    if (markerTimings.length > 50) markerTimings.shift();
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log(`[marker] ${name} +${ms}ms`);
  }
}
