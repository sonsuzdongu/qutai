/**
 * A tab's navigation from the moment it is asked for until the new page has arrived (docs/design/14-tabs-and-conversations.md,
 * "Pending navigation"). Pure: no React Native, tested in scripts/navigation-tests/.
 *
 * Why it exists (20 Nov 2026, a phone on a slow connection): the WebView reports a load start only once the site has
 * answered on Android (onPageStarted), so between a tap and the site's first byte nothing on screen changed. A
 * pending navigation begins when the app lets a top-frame navigation through (a tap on a link) or starts one itself
 * (address bar, back, forward, reload, the new tab page), so the progress line and the "opening…" line can show at
 * once.
 *
 * Every navigation gets the tab's next number. Timers and late events carry the number they were started for and
 * change nothing once a newer navigation has begun, so an old page's events never touch a newer navigation, and a
 * tab's events only ever reach its own tracker (each Tab owns one).
 */

/** Who started it: the page (a link tap, a script, a redirect) or the user through the app (address bar, bookmark,
 * history, the new tab page, back, forward, reload). Decides what the address bar may show before the page commits. */
export type NavigationOrigin = 'page' | 'app';

/** Why a navigation ended. 'loaded': the page arrived (the line fills and fades); the others hide the line at once. */
export type NavigationEnd = 'loaded' | 'error' | 'stopped' | 'download' | 'gone' | 'closed' | 'replaced';

export type PendingNavigation = {
  /** The tab's navigation number. */
  id: number;
  /** Where it is going (the latest address after redirects). */
  url: string;
  origin: NavigationOrigin;
  startedAt: number;
  /** The site answered and the new page commits: the address bar may show it, slowness lines go away. */
  responded: boolean;
  /** The WebView's own progress (0-1) since the site answered. */
  progress: number;
};

/** How long without an answer before the "isn't answering yet" line. */
export const SLOW_AFTER_MS = 4000;
/** How long without an answer before "the connection is very slow" with Try again. */
export const VERY_SLOW_AFTER_MS = 25000;

/** The line while waiting for the site: starts at 10 %, creeps up ever more slowly and never passes 30 %. */
export const WAIT_START = 0.1;
export const WAIT_HOLD = 0.3;
/** Time constant of the creep: about two thirds of the way to 30 % after this long. */
const WAIT_TAU_MS = 3000;

export function waitingProgress(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  return WAIT_START + (WAIT_HOLD - WAIT_START) * (1 - Math.exp(-t / WAIT_TAU_MS));
}

/**
 * Where the progress line should be: while waiting, the creep; once the site answered, the WebView's real progress
 * mapped onto the rest of the line (it reports about 10 % at the start of a load). Never below `shown`, so the line
 * never moves backwards within one navigation.
 */
export function lineTarget(nav: Pick<PendingNavigation, 'startedAt' | 'responded' | 'progress'>, now: number, shown = 0): number {
  const waiting = waitingProgress(now - nav.startedAt);
  const real = nav.responded ? WAIT_HOLD + (1 - WAIT_HOLD) * clamp01((nav.progress - 0.1) / 0.9) : 0;
  // The page may report 100 % before the load end; the line fills only when the navigation ends as loaded.
  return Math.max(shown, waiting, Math.min(real, 0.95));
}

export type Slowness = 'none' | 'slow' | 'verySlow';

/** The line under the address bar: only while no answer has come; the app never cancels the load itself. */
export function slowness(nav: Pick<PendingNavigation, 'startedAt' | 'responded'> | null, now: number, online = true): Slowness {
  if (!nav || nav.responded || !online) return 'none';
  const waited = now - nav.startedAt;
  if (waited >= VERY_SLOW_AFTER_MS) return 'verySlow';
  if (waited >= SLOW_AFTER_MS) return 'slow';
  return 'none';
}

/** When the slowness line next changes (for a timer), or null when it won't. */
export function nextSlownessChange(nav: Pick<PendingNavigation, 'startedAt' | 'responded'> | null, now: number): number | null {
  if (!nav || nav.responded) return null;
  for (const at of [SLOW_AFTER_MS, VERY_SLOW_AFTER_MS]) {
    if (now - nav.startedAt < at) return nav.startedAt + at;
  }
  return null;
}

/**
 * What the address bar shows (Chrome's rule against address spoofing): a navigation the page started keeps the
 * committed page's address and lock until the new page commits, and names the destination's host in a separate line;
 * one the user started in the app may show its address at once. After stop or an error the pending navigation is
 * gone, so the committed page shows again.
 */
export function shownAddress(committedUrl: string, nav: Pick<PendingNavigation, 'url' | 'origin' | 'responded'> | null): {
  url: string;
  /** The host being opened, for "example.com opening…"; null when nothing is shown. */
  opening: string | null;
} {
  if (!nav || nav.responded) return { url: committedUrl, opening: null };
  // Back and forward don't know their address until the WebView says it.
  if (nav.origin === 'app') return { url: nav.url || committedUrl, opening: null };
  return { url: committedUrl, opening: hostOf(nav.url) };
}

/** "www.example.com" → "example.com"; null for addresses without a host. */
export function hostOf(url: string): string | null {
  const host = /^[a-z][a-z0-9+.-]*:\/\/([^/?#@]*@)?([^/?#:]+)/i.exec(url)?.[2];
  return host ? host.toLowerCase().replace(/^www\./, '') : null;
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/**
 * A tab's navigations. `onChange` runs after every change; `schedule` sets a timer (injectable for tests) used to
 * wake the UI when the slowness line changes.
 */
export class NavigationTracker {
  private counter = 0;
  pending: PendingNavigation | null = null;
  /** How the last navigation ended, for the line's last frame (fill and fade, or vanish). */
  lastEnd: { id: number; reason: NavigationEnd } | null = null;
  private timer: unknown = null;

  constructor(
    private onChange: () => void,
    private clock: () => number = Date.now,
    private schedule: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
    private cancel: (handle: unknown) => void = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  ) {}

  /** The latest navigation number (0 before any). */
  get current(): number {
    return this.counter;
  }

  /**
   * A navigation begins. A redirect or a script's second hop while one is waiting keeps that one (its number, start
   * and line) and only updates where it goes; the user's own new navigation always starts a new one.
   */
  begin(url: string, origin: NavigationOrigin): number {
    const p = this.pending;
    if (p && !p.responded && origin === 'page' && p.origin === 'page') {
      p.url = url;
      this.onChange();
      return p.id;
    }
    if (p) this.lastEnd = { id: p.id, reason: 'replaced' };
    const id = ++this.counter;
    this.pending = { id, url, origin, startedAt: this.clock(), responded: false, progress: 0 };
    this.arm();
    this.onChange();
    return id;
  }

  /** A redirect or the WebView's own start for the waiting navigation: only where it goes changes. False if none waits. */
  redirect(url: string): boolean {
    const p = this.pending;
    if (!p || p.responded) return false;
    if (url && url !== p.url) {
      p.url = url;
      this.onChange();
    }
    return true;
  }

  /**
   * The site answered: the new page commits (Android: the WebView's load start; iOS: the first progress beyond the
   * start value). Starts one (already answered) when the page navigated without telling the app first.
   */
  respond(url?: string, id = this.counter): void {
    if (!this.pending) {
      if (url === undefined) return;
      this.begin(url, 'page');
    } else if (id !== this.pending.id) {
      return;
    }
    const p = this.pending!;
    if (p.responded) return;
    p.responded = true;
    if (url) p.url = url;
    this.disarm();
    this.onChange();
  }

  /** The WebView's own progress for the current navigation. Values at or above 1 don't end it (a load end does). */
  progress(value: number, id = this.counter): void {
    const p = this.pending;
    if (!p || id !== p.id || !p.responded) return;
    const next = clamp01(value);
    if (next <= p.progress) return;
    p.progress = next;
    this.onChange();
  }

  /** It ended. An end meant for an older navigation (by number) changes nothing. */
  end(reason: NavigationEnd, id = this.counter): void {
    const p = this.pending;
    if (!p || id !== p.id) return;
    this.pending = null;
    this.lastEnd = { id: p.id, reason };
    this.disarm();
    this.onChange();
  }

  private arm() {
    this.disarm();
    const p = this.pending;
    if (!p) return;
    const at = nextSlownessChange(p, this.clock());
    if (at === null) return;
    const id = p.id;
    this.timer = this.schedule(() => {
      this.timer = null;
      if (this.pending?.id !== id) return;
      this.onChange();
      this.arm();
    }, Math.max(0, at - this.clock()) + 20);
  }

  private disarm() {
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
  }

  /** The tab closed or fell asleep: nothing it started may change anything any more. */
  dispose() {
    if (this.pending) this.end('closed');
    this.disarm();
  }
}

/**
 * Whether an allowed top-frame navigation is the user's tap on the page: iOS names link taps and form submissions;
 * Android's WebView doesn't say, so a touch on this tab's page a moment ago counts.
 */
export function isUserTap(os: string, navigationType: string | undefined, touchedRecently: boolean): boolean {
  if (os === 'ios') return navigationType === 'click' || navigationType === 'formsubmit';
  return touchedRecently;
}

/**
 * Whether a window a page opens comes to the front: only when that page is on screen and the user just touched it.
 * A window that arrives late (a slow site answered after the user went to another tab) or that the page opens on its
 * own opens behind, so it never takes the screen from what the user is doing (20 Nov 2026 report).
 */
export function windowOpensInFront(openerOnScreen: boolean, touchedRecently: boolean): boolean {
  return openerOnScreen && touchedRecently;
}
