import { AppState, AppStateStatus } from 'react-native';

/**
 * Mobile OSes suspend the JS thread and the WebView shortly after the app is
 * backgrounded, so the agent pauses instead of failing half-way through a step.
 */
let current = (AppState.currentState as AppStateStatus | null) ?? 'active';
let backgroundCount = 0;
const waiters = new Set<() => void>();

AppState.addEventListener('change', (next) => {
  if (current === 'active' && next !== 'active') backgroundCount++;
  current = next;
  if (next === 'active') {
    waiters.forEach((resolve) => resolve());
    waiters.clear();
  }
});

export function isForeground() {
  return current === 'active';
}

/** Increments every time the app leaves the foreground. */
export function getBackgroundCount() {
  return backgroundCount;
}

export function waitForForeground(signal?: AbortSignal): Promise<void> {
  if (isForeground()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      waiters.delete(done);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    waiters.add(done);
    signal?.addEventListener('abort', done);
  });
}
