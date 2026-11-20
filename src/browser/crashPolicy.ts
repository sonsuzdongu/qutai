/**
 * What a tab does when its page's web process ends (crashed, or killed for memory) (`TABS` rules in
 * docs/design/14-tabs-and-conversations.md). Pure, tested in scripts/navigation-tests/crash.test.ts.
 *
 * - On screen, the first time: the page reloads by itself once.
 * - On screen, the same page's process ending again within CRASH_WINDOW_MS: a "This page stopped working" screen
 *   with Reload and Close tab; no more reloads by itself (a page that crashes on load would otherwise loop).
 * - Not on screen: nothing loads now; the tab reloads when the user comes back to it, as a sleeping tab does.
 */
export const CRASH_WINDOW_MS = 60_000;

export type ProcessEnd = { page: string; at: number };

export type ProcessGoneAction = 'reload' | 'screen' | 'reloadOnReturn';

export function processGoneAction(previous: ProcessEnd | null, page: string, now: number, onScreen: boolean): ProcessGoneAction {
  if (!onScreen) return 'reloadOnReturn';
  if (previous && previous.page === page && now - previous.at < CRASH_WINDOW_MS) return 'screen';
  return 'reload';
}

/** The page part of an address for "the same page": without the fragment. */
export function crashPage(url: string): string {
  const hash = url.indexOf('#');
  return hash === -1 ? url : url.slice(0, hash);
}

/** What the assistant's tools get when its tab's page died: a clear error instead of a wait that times out. */
export const PAGE_GONE_ERROR =
  'The page in this tab stopped working (its web process ended). It must be reloaded before it can be used.';
