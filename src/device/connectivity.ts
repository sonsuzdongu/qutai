/**
 * Whether the phone has a network connection (expo-network), for the browser: a navigation started offline says so at
 * once, and a tab that failed because the phone was offline reloads once when the connection returns
 * (docs/design/14-tabs-and-conversations.md). iOS can't tell "connected" from "internet reachable", so only "no connection at all"
 * counts as offline; unknown counts as online (never claim offline without knowing).
 */
type Listener = () => void;

let online = true;
let started = false;
const listeners = new Set<Listener>();
const reconnectListeners = new Set<Listener>();

function set(next: boolean) {
  if (next === online) return;
  const back = next && !online;
  online = next;
  listeners.forEach((l) => l());
  if (back) reconnectListeners.forEach((l) => l());
}

type State = { isConnected?: boolean; type?: string };

/** Offline only when the platform says there is no connection at all. */
export function isOfflineState(state: State): boolean {
  return state.isConnected === false || state.type === 'NONE';
}

export const connectivity = {
  get online(): boolean {
    return online;
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Called when the connection comes back after being offline. */
  onReconnect(listener: Listener) {
    reconnectListeners.add(listener);
    return () => {
      reconnectListeners.delete(listener);
    };
  },
  /** Starts listening (once); without the native module everything stays "online". */
  async start() {
    if (started) return;
    started = true;
    try {
      const Network = await import('expo-network');
      Network.addNetworkStateListener((state) => set(!isOfflineState(state as State)));
      set(!isOfflineState((await Network.getNetworkStateAsync()) as State));
    } catch {
      // No network module (an older build): never claim offline.
    }
  },
};
