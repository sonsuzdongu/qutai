// What the address bar's suggestion list shows while the user types (docs/design: address bar suggestions).
// Pure logic, no React Native, so it runs in the Node tests (scripts/omnibox-tests): when to look up, which answer
// may replace what is on screen, and when the list may change under the user's finger.

/** One history or bookmark row. Kept structural so this file doesn't import the storage layer. */
export type LocalItem = { url: string; title: string; bookmarked: boolean; visits: number };

/** What the list shows: the query the results belong to (not necessarily the text in the field right now). */
export type Shown<L extends LocalItem = LocalItem> = { query: string; local: L[]; remote: string[] };

export type Timers = {
  now(): number;
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
};

export type RemoteLookup = (query: string, signal: AbortSignal) => Promise<string[]> | null;

export type OmniboxResultsOptions<L extends LocalItem> = {
  /** History and bookmarks for a query (never called with an empty query). */
  lookupLocal(query: string): Promise<L[]>;
  /**
   * Search engine suggestions, or null when nothing may leave the phone for this query. Can be replaced later with
   * `setRemote` (suggestions switched on or off, another engine).
   */
  lookupRemote?: RemoteLookup;
  onChange(shown: Shown<L>): void;
  timers?: Timers;
  debounceMs?: number;
  maxWaitMs?: number;
  remoteGraceMs?: number;
  freezeMaxMs?: number;
};

/**
 * Typing faster than this skips the letters in between; the first letter after a pause is looked up at once.
 * A history lookup takes about 3 ms on a Mac at 5,000 visits and an estimated 10 to 25 ms on a mid-range phone, and
 * thumb typing is about 100 to 250 ms per letter, so 120 ms lets slow typing refresh on every letter and fast typing
 * on every few.
 */
export const LOOKUP_DEBOUNCE_MS = 120;
/** While letters keep coming, the list still refreshes at least this often. */
export const LOOKUP_MAX_WAIT_MS = 360;
/** History results wait at most this long for the search engine's, so both usually land together. */
export const REMOTE_GRACE_MS = 150;
/** Safety net: a touch whose end never arrives stops holding the list back after this long. */
export const FREEZE_MAX_MS = 3000;

const realTimers: Timers = {
  now: () => Date.now(),
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const fold = (s: string) => s.toLocaleLowerCase().trim();

/**
 * `next` in its own order, except that rows also shown before keep their earlier order among themselves (new rows
 * take the places `next` gives them). Rows that stay therefore never swap places between two letters.
 */
export function keepOrder<T>(prev: readonly T[], next: readonly T[], key: (item: T) => string): T[] {
  const before = new Map(prev.map((item, i) => [key(item), i]));
  const kept = next.filter((item) => before.has(key(item))).sort((a, b) => before.get(key(a))! - before.get(key(b))!);
  let k = 0;
  return next.map((item) => (before.has(key(item)) ? kept[k++] : item));
}

/** Search suggestions without the typed text itself, which always has its own "search for" row. */
export function withoutQuery(query: string, items: readonly string[]): string[] {
  const q = fold(query);
  const seen = new Set<string>();
  return items.filter((s) => {
    const f = fold(s);
    if (!f || f === q || seen.has(f)) return false;
    seen.add(f);
    return true;
  });
}

type Lookup<L> = {
  seq: number;
  query: string;
  local: L[] | null;
  remote: string[] | null;
  /** No search engine request was made for this lookup. */
  remoteSkipped: boolean;
  controller: AbortController;
  grace: unknown;
};

/**
 * Debounces lookups and decides what the list shows:
 * - the list is never emptied between letters: what is shown stays until the next answer lands, then is replaced;
 * - an answer for an older lookup never replaces a newer one (each lookup has a number);
 * - history and search engine answers for the same text are shown together, unless the network takes longer than
 *   REMOTE_GRACE_MS (then history shows first and the engine's rows follow);
 * - while a finger is on the list, nothing changes under it; the latest answer is shown when the finger lifts.
 */
export class OmniboxResults<L extends LocalItem = LocalItem> {
  private readonly o: Required<Omit<OmniboxResultsOptions<L>, 'timers' | 'lookupRemote'>> & { timers: Timers };
  private lookupRemote: RemoteLookup;
  private remoteKey: string | null = null;
  private shown: Shown<L> = { query: '', local: [], remote: [] };
  private shownSeq = 0;
  private seq = 0;
  private current: Lookup<L> | null = null;
  private lastChangeAt = -Infinity;
  private pendingSince: number | null = null;
  private pendingQuery: string | null = null;
  private wantedQuery: string | null = null;
  private debounce: unknown = null;
  private frozen = false;
  private freezeTimer: unknown = null;
  private held: Shown<L> | null = null;
  private disposed = false;
  /** Lookups started; for the tests and the measurement. */
  launches: string[] = [];

  constructor(options: OmniboxResultsOptions<L>) {
    this.o = {
      debounceMs: LOOKUP_DEBOUNCE_MS,
      maxWaitMs: LOOKUP_MAX_WAIT_MS,
      remoteGraceMs: REMOTE_GRACE_MS,
      freezeMaxMs: FREEZE_MAX_MS,
      ...options,
      timers: options.timers ?? realTimers,
    };
    this.lookupRemote = options.lookupRemote ?? (() => null);
  }

  /**
   * Replaces the search engine lookup. `key` names its settings; returns true when they changed since the last call
   * (then the caller looks the text up again with `force`).
   */
  setRemote(key: string, lookup: RemoteLookup): boolean {
    this.lookupRemote = lookup;
    const changed = this.remoteKey !== null && this.remoteKey !== key;
    this.remoteKey = key;
    return changed;
  }

  get value(): Shown<L> {
    return this.shown;
  }

  /** The trimmed text in the field changed (or should be looked up again, with `force`). */
  setQuery(query: string, { force = false }: { force?: boolean } = {}): void {
    if (this.disposed) return;
    if (!force && query === this.wantedQuery) return;
    this.wantedQuery = query;
    const now = this.o.timers.now();
    const idle = now - this.lastChangeAt >= this.o.debounceMs;
    this.lastChangeAt = now;
    if (!query || idle || force) {
      // A cleared field, the first letter after a pause, or a changed setting: at once.
      this.cancelPending();
      this.launch(query);
      return;
    }
    this.pendingQuery = query;
    this.pendingSince ??= now;
    if (this.debounce !== null) this.o.timers.clear(this.debounce);
    const due = Math.min(now + this.o.debounceMs, this.pendingSince + this.o.maxWaitMs);
    this.debounce = this.o.timers.set(() => this.flush(), Math.max(0, due - now));
  }

  touchStart(): void {
    if (this.disposed) return;
    this.frozen = true;
    if (this.freezeTimer !== null) this.o.timers.clear(this.freezeTimer);
    this.freezeTimer = this.o.timers.set(() => this.touchEnd(), this.o.freezeMaxMs);
  }

  touchEnd(): void {
    if (this.freezeTimer !== null) this.o.timers.clear(this.freezeTimer);
    this.freezeTimer = null;
    if (!this.frozen) return;
    this.frozen = false;
    const held = this.held;
    this.held = null;
    if (held && !this.disposed) this.show(held);
  }

  dispose(): void {
    this.disposed = true;
    this.cancelPending();
    this.current?.controller.abort();
    if (this.current?.grace != null) this.o.timers.clear(this.current.grace);
    if (this.freezeTimer !== null) this.o.timers.clear(this.freezeTimer);
  }

  private cancelPending(): void {
    if (this.debounce !== null) this.o.timers.clear(this.debounce);
    this.debounce = null;
    this.pendingQuery = null;
    this.pendingSince = null;
  }

  private flush(): void {
    const query = this.pendingQuery;
    this.cancelPending();
    if (query !== null && !this.disposed) this.launch(query);
  }

  private launch(query: string): void {
    const previous = this.current;
    if (previous) {
      previous.controller.abort();
      if (previous.grace != null) this.o.timers.clear(previous.grace);
    }
    this.launches.push(query);
    const lookup: Lookup<L> = {
      seq: ++this.seq,
      query,
      local: null,
      remote: null,
      remoteSkipped: true,
      controller: new AbortController(),
      grace: null,
    };
    this.current = lookup;
    if (!query) {
      this.commit(lookup, [], []);
      return;
    }
    const remote = this.lookupRemote(query, lookup.controller.signal);
    if (remote) {
      lookup.remoteSkipped = false;
      remote
        .catch(() => [] as string[])
        .then((items) => this.remoteArrived(lookup, items));
    }
    this.o
      .lookupLocal(query)
      .catch(() => [] as L[])
      .then((items) => this.localArrived(lookup, items));
  }

  private localArrived(lookup: Lookup<L>, items: L[]): void {
    if (this.disposed || lookup.seq <= this.shownSeq) return;
    lookup.local = items;
    if (lookup.remoteSkipped || lookup.remote !== null) {
      this.commit(lookup, items, lookup.remote ?? []);
      return;
    }
    // Wait a moment for the search engine so both lists change in one step.
    lookup.grace = this.o.timers.set(() => {
      lookup.grace = null;
      if (lookup.seq > this.shownSeq && lookup.local) this.commit(lookup, lookup.local, null);
    }, this.o.remoteGraceMs);
  }

  private remoteArrived(lookup: Lookup<L>, items: string[]): void {
    if (this.disposed || lookup.controller.signal.aborted) return;
    lookup.remote = items;
    if (lookup.seq === this.shownSeq) {
      // History already showed for this text: the engine's rows join it.
      this.commit(lookup, this.latestLocal(lookup), items);
    } else if (lookup.seq > this.shownSeq && lookup.local) {
      if (lookup.grace != null) this.o.timers.clear(lookup.grace);
      lookup.grace = null;
      this.commit(lookup, lookup.local, items);
    }
  }

  private latestLocal(lookup: Lookup<L>): L[] {
    return lookup.local ?? (this.held ?? this.shown).local;
  }

  /** `remote` null: the engine hasn't answered yet; its earlier rows that still contain the text stay until it does. */
  private commit(lookup: Lookup<L>, local: L[], remote: string[] | null): void {
    const base = this.held ?? this.shown;
    const q = fold(lookup.query);
    const remoteNext =
      remote !== null
        ? withoutQuery(lookup.query, remote)
        : lookup.remoteSkipped
          ? []
          : withoutQuery(lookup.query, base.remote.filter((s) => fold(s).includes(q)));
    this.shownSeq = lookup.seq;
    this.show({
      query: lookup.query,
      local: keepOrder(base.local, local, (item) => item.url),
      remote: keepOrder(base.remote, remoteNext, (s) => s),
    });
  }

  private show(next: Shown<L>): void {
    if (this.frozen) {
      this.held = next;
      return;
    }
    this.shown = next;
    this.o.onChange(next);
  }
}
