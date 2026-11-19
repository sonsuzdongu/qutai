/**
 * Per-tab user style state that lives in memory only (docs/page-customisation.md › Styles): the style the user
 * approved but did not keep (the trial, gone with the next page load), and "Styles off for this page" (until switched
 * on again or the tab is closed). The kept styles are in the rule store (storage/siteRules.ts).
 */
export type StyleTrial = { css: string; description: string; url: string };

type TabState = { trial: StyleTrial | null; off: boolean };

const states = new Map<string, TabState>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version++;
  listeners.forEach((l) => l());
}

function stateOf(tabId: string): TabState {
  return states.get(tabId) ?? { trial: null, off: false };
}

export const pageStyleState = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getVersion: () => version,
  trial: (tabId: string): StyleTrial | null => stateOf(tabId).trial,
  off: (tabId: string): boolean => stateOf(tabId).off,
  setTrial(tabId: string, trial: StyleTrial | null) {
    states.set(tabId, { ...stateOf(tabId), trial });
    changed();
  },
  setOff(tabId: string, off: boolean) {
    states.set(tabId, { ...stateOf(tabId), off });
    changed();
  },
  /** A new document loaded in the tab: the trial is gone from the page. */
  pageLoaded(tabId: string) {
    const state = states.get(tabId);
    if (!state?.trial) return;
    states.set(tabId, { ...state, trial: null });
    changed();
  },
  closed(tabId: string) {
    if (states.delete(tabId)) changed();
  },
};
