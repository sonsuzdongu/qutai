import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { Browser } from '../browser/Browser';
import { getDb } from './db';
import { saveSession, sessionFromBrowser } from './session';

const SAVE_DELAY_MS = 800;

/**
 * Saves the open (non-incognito) tabs shortly after they change, and right away when the
 * app leaves the foreground, since the OS may kill it there without warning.
 */
export function usePersistSession(browser: Browser) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSaved = '';

    const save = () => {
      timer = null;
      const session = sessionFromBrowser(browser);
      const json = JSON.stringify(session);
      if (json === lastSaved) return;
      lastSaved = json;
      getDb()
        .then((db) => saveSession(db, session))
        .catch(() => {
          lastSaved = '';
        });
    };

    const unsubscribe = browser.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY_MS);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      if (timer) clearTimeout(timer);
      save();
    });

    return () => {
      unsubscribe();
      appState.remove();
      if (timer) clearTimeout(timer);
    };
  }, [browser]);
}
