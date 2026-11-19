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
  remoteDebounceMs?: number;
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
/**
 * The typed text goes to the search engine only after typing has paused this long (owner, 19 Nov 2026): a word typed
 * without a pause is one request, with the finished text.
 */
export const REMOTE_DEBOUNCE_MS = 200;
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
};

/**
 * Debounces lookups and decides what the list shows:
 * - the list is never emptied between letters: what is shown stays until the next answer lands, then is replaced;
 * - an answer for older text never replaces a newer one (each lookup and each engine request has a number);
 * - history is looked up on its own schedule (LOOKUP_DEBOUNCE_MS, at once after a pause); the search engine is asked
 *   only after typing has paused for REMOTE_DEBOUNCE_MS, and its rows replace its earlier rows when they land. When
 *   history lands first, the engine's earlier rows that still contain the text stay until then; the others go;
 * - while a finger is on the list, nothing changes under it; the latest answer is shown when the finger lifts.
 */
export class OmniboxResults<L extends LocalItem = LocalItem> {
  private readonly o: Required<Omit<OmniboxResultsOptions<L>, 'timers' | 'lookupRemote'>> & { timers: Timers };
  private lookupRemote: RemoteLookup;
  private remoteKey: string | null = null;
  private shown: Shown<L> = { query: '', local: [], remote: [] };
  private shownSeq = 0;
  private seq = 0;
  private lastChangeAt = -Infinity;
  private pendingSince: number | null = null;
  private pendingQuery: string | null = null;
  private wantedQuery: string | null = null;
  private debounce: unknown = null;
  private remoteTimer: unknown = null;
  private remoteSeq = 0;
  private remoteController: AbortController | null = null;
  private frozen = false;
  private freezeTimer: unknown = null;
  private held: Shown<L> | null = null;
  private disposed = false;
  /** History lookups started; for the tests and the measurement. */
  launches: string[] = [];
  /** Search engine requests sent; for the tests and the measurement. */
  remoteRequests: string[] = [];

  constructor(options: OmniboxResultsOptions<L>) {
    this.o = {
      debounceMs: LOOKUP_DEBOUNCE_MS,
      maxWaitMs: LOOKUP_MAX_WAIT_MS,
      remoteDebounceMs: REMOTE_DEBOUNCE_MS,
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
    this.scheduleRemote(query);
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
    this.cancelRemote();
    if (this.freezeTimer !== null) this.o.timers.clear(this.freezeTimer);
  }

  private cancelPending(): void {
    if (this.debounce !== null) this.o.timers.clear(this.debounce);
    this.debounce = null;
    this.pendingQuery = null;
    this.pendingSince = null;
  }

  /** Any change of text stops the engine request waiting or under way; its answer would be for older text. */
  private cancelRemote(): void {
    if (this.remoteTimer !== null) this.o.timers.clear(this.remoteTimer);
    this.remoteTimer = null;
    this.remoteController?.abort();
    this.remoteController = null;
    this.remoteSeq++;
  }

  private scheduleRemote(query: string): void {
    this.cancelRemote();
    if (!query) return;
    this.remoteTimer = this.o.timers.set(() => this.sendRemote(query), this.o.remoteDebounceMs);
  }

  private sendRemote(query: string): void {
    this.remoteTimer = null;
    if (this.disposed) return;
    const controller = new AbortController();
    const seq = this.remoteSeq;
    const request = this.lookupRemote(query, controller.signal);
    if (!request) return;
    this.remoteController = controller;
    this.remoteRequests.push(query);
    request
      .catch(() => [] as string[])
      .then((items) => {
        if (this.disposed || controller.signal.aborted || seq !== this.remoteSeq) return;
        this.remoteController = null;
        const base = this.held ?? this.shown;
        this.show({ ...base, remote: keepOrder(base.remote, withoutQuery(query, items), (s) => s) });
      });
  }

  private flush(): void {
    const query = this.pendingQuery;
    this.cancelPending();
    if (query !== null && !this.disposed) this.launch(query);
  }

  private launch(query: string): void {
    this.launches.push(query);
    const lookup: Lookup<L> = { seq: ++this.seq, query, local: null };
    if (!query) {
      this.commit(lookup, []);
      return;
    }
    this.o
      .lookupLocal(query)
      .catch(() => [] as L[])
      .then((items) => {
        if (!this.disposed && lookup.seq > this.shownSeq) this.commit(lookup, items);
      });
  }

  /** New history rows; the engine's earlier rows that still contain the text stay until its next answer. */
  private commit(lookup: Lookup<L>, local: L[]): void {
    const base = this.held ?? this.shown;
    const q = fold(lookup.query);
    const remote = q ? withoutQuery(lookup.query, base.remote.filter((s) => fold(s).includes(q))) : [];
    this.shownSeq = lookup.seq;
    this.show({
      query: lookup.query,
      local: keepOrder(base.local, local, (item) => item.url),
      remote: keepOrder(base.remote, remote, (s) => s),
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
