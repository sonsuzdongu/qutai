import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { t, useLanguage } from '../i18n';
import { isShortcutEvent, SHORTCUTS, type ShortcutEvent } from '../ui/keyShortcuts';
import { offersTabStrip } from '../ui/tabStrip';
import { stripDevice } from './macDevice';

/**
 * Keyboard shortcuts on a Mac and on an iPad with a hardware keyboard (UI-76): registers SHORTCUTS with the native
 * side (UIKeyCommand in modules/qutai-entry) and calls `onShortcut` with the id of the one pressed. Nothing on a phone
 * or on Android, and nothing on a binary built before the native method existed.
 */
type NativeItem = { id: string; input: string; modifiers: string[]; title: string; hidden: boolean };
type NativeShortcuts = {
  setKeyShortcuts?(items: NativeItem[]): void;
  addListener?(event: 'onShortcut', listener: (event: { id?: unknown }) => void): { remove(): void };
};

const native =
  Platform.OS === 'ios' && offersTabStrip(stripDevice)
    ? requireOptionalNativeModule<NativeShortcuts>('QutaiEntry')
    : null;

/** The app's shortcuts, and the arrow keys while the address bar's suggestions show (UI-88): registered together. */
let appItems: NativeItem[] = [];
let suggestionKeysOn = false;

/** The address bar's suggestion keys: the arrows and Escape, without modifiers (UI-88, browser/omniboxSelection.ts). */
export type SuggestionKey = 'up' | 'down' | 'escape';
const SUGGESTION_KEYS: SuggestionKey[] = ['up', 'down', 'escape'];
const suggestionId = (key: SuggestionKey) => `suggestion:${key}`;

function register() {
  if (typeof native?.setKeyShortcuts !== 'function') return;
  const keys: NativeItem[] = suggestionKeysOn
    ? SUGGESTION_KEYS.map((key) => ({ id: suggestionId(key), input: key, modifiers: [], title: '', hidden: true }))
    : [];
  try {
    native.setKeyShortcuts([...appItems, ...keys]);
  } catch {
    // An older binary: no shortcuts.
  }
}

/**
 * The arrow keys and Escape for the address bar's suggestions, only while `active` (the field is being edited and the
 * list shows): taken from the page and the text field then, and given back as soon as the list goes. A binary that
 * doesn't know the named keys ignores them.
 */
export function useSuggestionKeys(active: boolean, onKey: (key: SuggestionKey) => void) {
  const handler = useRef(onKey);
  useEffect(() => {
    handler.current = onKey;
  });
  const on = active && native !== null;
  useEffect(() => {
    if (!on) return;
    suggestionKeysOn = true;
    register();
    const sub =
      typeof native?.addListener === 'function'
        ? native.addListener('onShortcut', (event) => {
            const key = SUGGESTION_KEYS.find((k) => suggestionId(k) === event?.id);
            if (key) handler.current(key);
          })
        : null;
    return () => {
      sub?.remove();
      suggestionKeysOn = false;
      register();
    };
  }, [on]);
}

/** Re-registers the titles when the app's language changes. */
export function useKeyShortcuts(onShortcut: (id: ShortcutEvent) => void) {
  const language = useLanguage();
  const handler = useRef(onShortcut);
  // The latest handler (it sees the current tab), without re-subscribing on every render.
  useEffect(() => {
    handler.current = onShortcut;
  });
  useEffect(() => {
    appItems = SHORTCUTS.map((s) => ({
      id: s.id,
      input: s.input,
      modifiers: s.modifiers,
      title: t(s.title.key, s.title.values),
      hidden: s.hidden === true,
    }));
    register();
  }, [language]);
  useEffect(() => {
    if (typeof native?.addListener !== 'function') return;
    const sub = native.addListener('onShortcut', (event) => {
      if (isShortcutEvent(event?.id)) handler.current(event.id);
    });
    return () => sub.remove();
  }, []);
}
