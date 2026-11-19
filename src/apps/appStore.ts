import { getRandomBytes } from 'expo-crypto';
import { loadScriptKey } from '../device/scriptKey';
import { getLocale } from '../i18n';
import { getDb } from '../storage/db';
import { AppStore } from './store';

/**
 * The app's one AppStore (docs/mini-apps.md): Qutai's database, this install's seal key (the same secure-storage key
 * as kept scripts), random ids from the system, and sorting in the interface language.
 */
let collator: Intl.Collator | null = null;
function collate(a: string, b: string): number {
  try {
    collator ??= new Intl.Collator(getLocale(), { sensitivity: 'base', numeric: true });
    return collator.compare(a, b);
  } catch {
    return a.localeCompare(b);
  }
}

export const appStore = new AppStore({
  db: getDb,
  key: loadScriptKey,
  random: (n) => getRandomBytes(n),
  collate,
});

const listeners = new Set<() => void>();
/** "My apps" and the cards refresh when an app is created, changed, undone, renamed or deleted. */
export const appsChanged = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emit() {
    listeners.forEach((l) => l());
  },
};
