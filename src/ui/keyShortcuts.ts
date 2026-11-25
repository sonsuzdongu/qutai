/**
 * Keyboard shortcuts on a Mac and on an iPad with a hardware keyboard (UI-76 in docs/design/27-interface.md). The
 * native side (modules/qutai-entry, UIKeyCommand) registers exactly these and reports the id; what each one does is
 * decided in App.tsx. Pure: tested with node:test (scripts/layout-tests/keyShortcuts.test.ts).
 *
 * Text editing keys (⌘C, ⌘V, ⌘X, ⌘A, ⌘Z, ⇧⌘Z) are never registered, so they stay with text fields and the page.
 */

import type { MessageKey } from '../i18n';

export type ShortcutModifier = 'command' | 'shift' | 'control' | 'alternate';

export type ShortcutId =
  | 'newTab'
  | 'newIncognitoTab'
  | 'closeTab'
  | 'reopenTab'
  | 'reload'
  | 'focusAddress'
  | 'find'
  | 'back'
  | 'forward'
  /** ⌘E: open or close the assistant panel, as a tap on the Qutai button (UI-89). */
  | 'toggleAssistant'
  | 'nextTab'
  | 'prevTab'
  /** ⌘+ (also ⌘=), ⌘−, ⌘0: the page zoom for the site (UI-84, browser/pageZoom.ts). */
  | 'zoomIn'
  | 'zoomOut'
  | 'actualSize'
  /** ⌥Space, the Qutai button's push-to-talk (UI-81): reported as voiceDown / voiceUp, never as itself. */
  | 'voice'
  | `tab${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

/** The title shown in iPad's ⌘-hold overlay: an i18n key with its values. */
export type ShortcutTitle = { key: MessageKey; values?: Record<string, string | number> };

export type Shortcut = {
  id: ShortcutId;
  /** The key as UIKeyCommand takes it; 'tab' is the Tab key. */
  input: string;
  modifiers: ShortcutModifier[];
  title: ShortcutTitle;
  /** Another key for the same shortcut (⌘= for ⌘+): works, but not listed twice in iPad's ⌘-hold overlay. */
  hidden?: boolean;
};

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Every shortcut, in the order the ⌘-hold overlay lists them. */
export const SHORTCUTS: Shortcut[] = [
  { id: 'newTab', input: 't', modifiers: ['command'], title: { key: 'menu.newTab' } },
  { id: 'newIncognitoTab', input: 'n', modifiers: ['command', 'shift'], title: { key: 'menu.newIncognitoTab' } },
  { id: 'closeTab', input: 'w', modifiers: ['command'], title: { key: 'tabs.closeTab' } },
  { id: 'reopenTab', input: 't', modifiers: ['command', 'shift'], title: { key: 'shortcuts.reopenTab' } },
  { id: 'reload', input: 'r', modifiers: ['command'], title: { key: 'menu.reload' } },
  { id: 'focusAddress', input: 'l', modifiers: ['command'], title: { key: 'shortcuts.focusAddress' } },
  { id: 'find', input: 'f', modifiers: ['command'], title: { key: 'menu.find' } },
  { id: 'back', input: '[', modifiers: ['command'], title: { key: 'address.back' } },
  { id: 'forward', input: ']', modifiers: ['command'], title: { key: 'menu.forward' } },
  { id: 'toggleAssistant', input: 'e', modifiers: ['command'], title: { key: 'shortcuts.toggleAssistant' } },
  { id: 'nextTab', input: 'tab', modifiers: ['control'], title: { key: 'shortcuts.nextTab' } },
  { id: 'prevTab', input: 'tab', modifiers: ['control', 'shift'], title: { key: 'shortcuts.prevTab' } },
  { id: 'zoomIn', input: '+', modifiers: ['command'], title: { key: 'shortcuts.zoomIn' } },
  // ⌘= is ⌘+ without Shift on most keyboards; ⇧⌘+ / ⇧⌘= where + or = needs Shift (a Turkish Q keyboard: ⇧4, ⇧0).
  { id: 'zoomIn', input: '=', modifiers: ['command'], title: { key: 'shortcuts.zoomIn' }, hidden: true },
  { id: 'zoomIn', input: '+', modifiers: ['command', 'shift'], title: { key: 'shortcuts.zoomIn' }, hidden: true },
  { id: 'zoomIn', input: '=', modifiers: ['command', 'shift'], title: { key: 'shortcuts.zoomIn' }, hidden: true },
  { id: 'zoomOut', input: '-', modifiers: ['command'], title: { key: 'shortcuts.zoomOut' } },
  { id: 'actualSize', input: '0', modifiers: ['command'], title: { key: 'shortcuts.actualSize' } },
  { id: 'voice', input: ' ', modifiers: ['alternate'], title: { key: 'shortcuts.voice' } },
  ...DIGITS.map((n): Shortcut => ({
    id: `tab${n}`,
    input: String(n),
    modifiers: ['command'],
    title: n === 9 ? { key: 'shortcuts.lastTab' } : { key: 'shortcuts.tab', values: { n } },
  })),
];

/** Keys that belong to text editing: never a shortcut (a guard for SHORTCUTS, checked by the tests). */
export const TEXT_EDITING: { input: string; modifiers: ShortcutModifier[] }[] = [
  { input: 'c', modifiers: ['command'] },
  { input: 'v', modifiers: ['command'] },
  { input: 'x', modifiers: ['command'] },
  { input: 'a', modifiers: ['command'] },
  { input: 'z', modifiers: ['command'] },
  { input: 'z', modifiers: ['command', 'shift'] },
];

/** What the native side reports: a shortcut, or the voice key going down or up. */
export type ShortcutEvent = Exclude<ShortcutId, 'voice'> | 'voiceDown' | 'voiceUp' | 'voiceCancel';

export function isShortcutEvent(value: unknown): value is ShortcutEvent {
  return (
    value === 'voiceDown' ||
    value === 'voiceUp' ||
    value === 'voiceCancel' ||
    (value !== 'voice' && isShortcutId(value))
  );
}

export function isShortcutId(value: unknown): value is ShortcutId {
  return typeof value === 'string' && SHORTCUTS.some((s) => s.id === value);
}

/**
 * The tab a tab-switching shortcut goes to among `ids` (the current kind's tabs in order, as the strip shows them):
 * ⌘1…⌘8 the first to eighth tab (none when there are fewer), ⌘9 the last, ⌃Tab / ⌃⇧Tab the next / previous one,
 * wrapping around. Null when nothing changes (no such tab, or it is the active one).
 */
export function shortcutTab(id: ShortcutId, ids: string[], activeId: string | null): string | null {
  if (ids.length === 0) return null;
  let target: string | undefined;
  if (id === 'nextTab' || id === 'prevTab') {
    const at = activeId ? ids.indexOf(activeId) : -1;
    if (at < 0) target = ids[0];
    else target = ids[(at + (id === 'nextTab' ? 1 : -1) + ids.length) % ids.length];
  } else if (/^tab[1-9]$/.test(id)) {
    const n = Number(id.slice(3));
    target = n === 9 ? ids[ids.length - 1] : ids[n - 1];
  }
  return target && target !== activeId ? target : null;
}
