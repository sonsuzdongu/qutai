import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { t, useLanguage } from '../i18n';
import { isShortcutId, SHORTCUTS, type ShortcutId } from '../ui/keyShortcuts';
import { offersTabStrip } from '../ui/tabStrip';
import { stripDevice } from './macDevice';

/**
 * Keyboard shortcuts on a Mac and on an iPad with a hardware keyboard (UI-76): registers SHORTCUTS with the native
 * side (UIKeyCommand in modules/qutai-entry) and calls `onShortcut` with the id of the one pressed. Nothing on a phone
 * or on Android, and nothing on a binary built before the native method existed.
 */
type NativeShortcuts = {
  setKeyShortcuts?(items: { id: string; input: string; modifiers: string[]; title: string }[]): void;
  addListener?(event: 'onShortcut', listener: (event: { id?: unknown }) => void): { remove(): void };
};

const native =
  Platform.OS === 'ios' && offersTabStrip(stripDevice)
    ? requireOptionalNativeModule<NativeShortcuts>('QutaiEntry')
    : null;

/** Re-registers the titles when the app's language changes. */
export function useKeyShortcuts(onShortcut: (id: ShortcutId) => void) {
  const language = useLanguage();
  const handler = useRef(onShortcut);
  // The latest handler (it sees the current tab), without re-subscribing on every render.
  useEffect(() => {
    handler.current = onShortcut;
  });
  useEffect(() => {
    if (typeof native?.setKeyShortcuts !== 'function') return;
    try {
      native.setKeyShortcuts(
        SHORTCUTS.map((s) => ({
          id: s.id,
          input: s.input,
          modifiers: s.modifiers,
          title: t(s.title.key, s.title.values),
        })),
      );
    } catch {
      // An older binary: no shortcuts.
    }
  }, [language]);
  useEffect(() => {
    if (typeof native?.addListener !== 'function') return;
    const sub = native.addListener('onShortcut', (event) => {
      if (isShortcutId(event?.id)) handler.current(event.id);
    });
    return () => sub.remove();
  }, []);
}
