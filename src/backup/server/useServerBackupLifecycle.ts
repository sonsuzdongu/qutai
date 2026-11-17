import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { loadServerBackup, maybeAutoBackup, serverBackupEnabled } from './index';

/**
 * The daily automatic backup's only triggers (docs/server-backup.md): the app opening, coming back to the foreground,
 * signing in and unlocking. Never a background service in this version. `incognito`: the tab in front is incognito
 * (the run is skipped and says so).
 */
export function useServerBackupLifecycle(o: { incognito: boolean; locked: boolean; signedIn: boolean }): void {
  const latest = useRef(o);
  useEffect(() => {
    latest.current = o;
  });
  useEffect(() => {
    if (!serverBackupEnabled) return;
    void loadServerBackup();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !latest.current.locked) void maybeAutoBackup({ incognito: latest.current.incognito });
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (serverBackupEnabled && o.signedIn && !o.locked && AppState.currentState === 'active') {
      void maybeAutoBackup({ incognito: latest.current.incognito });
    }
  }, [o.signedIn, o.locked]);
}
