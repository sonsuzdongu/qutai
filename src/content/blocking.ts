import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import {
  compileIosRuleList,
  hasIosRuleList,
  hasNativeBlocking,
  loadAndroidBlocker,
  removeIosRuleLists,
} from '../device/contentBlocker';
import { getLanguage } from '../i18n';
import {
  androidBlockerFile,
  CompiledBlocker,
  contentRuleLists,
  hashText,
  ListStats,
  mergeLists,
  ParsedList,
  parseListInBatches,
} from './filterLists';

/**
 * Network ad and tracker blocking from filter lists the user picks (domain-based; see filterLists.ts).
 *
 * Lists are downloaded on the phone from their publishers' official addresses, only once the user has accepted the
 * terms in onboarding and while "Block ads and trackers" is on; nothing from them ships with the app. Each list is
 * parsed once after download (in batches, off the UI's way) and kept as its domain sets in the app's documents
 * folder (not in SQLite); the merged result is compiled for the platform (Android: a domain file the native matcher
 * reads; iOS: WebKit content rule lists cached in WKContentRuleListStore by a content hash), so starting the app
 * parses nothing. A list that fails to download, parse or compile leaves the previous version in use.
 *
 * Boundary: only the browser's tab WebViews block (they get the contentBlocking prop). Requests the app makes itself
 * (AI providers, list downloads, search suggestions, sync...) go through React Native's networking, never through
 * a tab, so lists can't touch them.
 */

export type ListKind = 'ads' | 'privacy' | 'regional' | 'custom';

export type CatalogueEntry = {
  id: string;
  name: string;
  url: string;
  homepage: string;
  license: string;
  licenseUrl: string;
  kind: ListKind;
  /** On in a fresh install (the Turkish list when the app is in Turkish; the other regional lists never). */
  defaultOn: () => boolean;
};

/**
 * Well-known, maintained lists whose licences allow a browser to download them on the user's phone (as uBlock
 * Origin, Brave and others do). None is bundled or stored in this repository.
 */
export const CATALOGUE: CatalogueEntry[] = [
  {
    id: 'easylist',
    name: 'EasyList',
    url: 'https://easylist.to/easylist/easylist.txt',
    homepage: 'https://easylist.to/',
    license: 'GPLv3 / CC BY-SA 3.0',
    licenseUrl: 'https://easylist.to/pages/licence.html',
    kind: 'ads',
    defaultOn: () => true,
  },
  {
    id: 'easyprivacy',
    name: 'EasyPrivacy',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    homepage: 'https://easylist.to/',
    license: 'GPLv3 / CC BY-SA 3.0',
    licenseUrl: 'https://easylist.to/pages/licence.html',
    kind: 'privacy',
    defaultOn: () => true,
  },
  {
    id: 'adguard-turkish',
    name: 'AdGuard Turkish filter',
    url: 'https://filters.adtidy.org/extension/ublock/filters/13.txt',
    homepage: 'https://github.com/AdguardTeam/AdguardFilters',
    license: 'GPLv3',
    licenseUrl: 'https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE',
    kind: 'regional',
    defaultOn: () => getLanguage() === 'tr',
  },
  // Regional lists for the other interface languages: offered, off until the user switches them on. Korean has no
  // list here: List-KR, the usual one, is built from !#include files this parser does not follow.
  {
    id: 'adguard-german',
    name: 'AdGuard German filter',
    url: 'https://filters.adtidy.org/extension/ublock/filters/6.txt',
    homepage: 'https://github.com/AdguardTeam/AdguardFilters',
    license: 'GPLv3',
    licenseUrl: 'https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE',
    kind: 'regional',
    defaultOn: () => false,
  },
  {
    id: 'adguard-spanish-portuguese',
    name: 'AdGuard Spanish/Portuguese filter',
    url: 'https://filters.adtidy.org/extension/ublock/filters/9.txt',
    homepage: 'https://github.com/AdguardTeam/AdguardFilters',
    license: 'GPLv3',
    licenseUrl: 'https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE',
    kind: 'regional',
    defaultOn: () => false,
  },
  {
    id: 'adguard-french',
    name: 'AdGuard French filter',
    url: 'https://filters.adtidy.org/extension/ublock/filters/16.txt',
    homepage: 'https://github.com/AdguardTeam/AdguardFilters',
    license: 'GPLv3',
    licenseUrl: 'https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE',
    kind: 'regional',
    defaultOn: () => false,
  },
  {
    id: 'adguard-japanese',
    name: 'AdGuard Japanese filter',
    url: 'https://filters.adtidy.org/extension/ublock/filters/7.txt',
    homepage: 'https://github.com/AdguardTeam/AdguardFilters',
    license: 'GPLv3',
    licenseUrl: 'https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE',
    kind: 'regional',
    defaultOn: () => false,
  },
  {
    id: 'adguard-russian',
    name: 'AdGuard Russian filter',
    url: 'https://filters.adtidy.org/extension/ublock/filters/1.txt',
    homepage: 'https://github.com/AdguardTeam/AdguardFilters',
    license: 'GPLv3',
    licenseUrl: 'https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE',
    kind: 'regional',
    defaultOn: () => false,
  },
  {
    id: 'abpindo',
    name: 'ABPindo (Indonesian)',
    url: 'https://raw.githubusercontent.com/ABPindo/indonesianadblockrules/master/subscriptions/abpindo.txt',
    homepage: 'https://github.com/ABPindo/indonesianadblockrules',
    license: 'GPLv3 / CC BY-SA 3.0',
    licenseUrl: 'https://raw.githubusercontent.com/ABPindo/indonesianadblockrules/master/LICENSE',
    kind: 'regional',
    defaultOn: () => false,
  },
];

/** Limits that keep a broken or hostile list from hurting the app. */
export const MAX_LIST_BYTES = 15 * 1024 * 1024;
export const MAX_TOTAL_DOMAINS = 400_000;
export const MAX_CUSTOM_LISTS = 10;
/** Automatic updates at most this often (lists say they expire after 4-5 days). */
export const UPDATE_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;
/** A list that never downloaded is retried at most this often. */
const RETRY_INTERVAL_MS = 60 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const RULE_LIST_PREFIX = 'qutai-cb-';

export type ListState = {
  id: string;
  name: string;
  url: string;
  homepage?: string;
  license?: string;
  licenseUrl?: string;
  kind: ListKind;
  enabled: boolean;
  etag?: string;
  lastModified?: string;
  /** When the list content last changed on the phone. */
  fetchedAt?: number;
  /** Last download attempt (also unchanged answers and failures). */
  checkedAt?: number;
  bytes?: number;
  stats?: ListStats;
  /** Blocked and exception domains Qutai uses from it. */
  domains?: number;
  /** Code of the last failure (see BlockingError), cleared by a success. */
  error?: BlockingErrorCode;
};

type Compiled = {
  /** Which list versions it was made from. */
  key: string;
  domains: number;
  /** iOS: the compiled WebKit rule lists. */
  ruleLists: string[];
  at: number;
};

type Persisted = { version: 1; lists: ListState[]; compiled?: Compiled };

export type BlockingErrorCode =
  | 'https'
  | 'duplicate'
  | 'tooManyLists'
  | 'network'
  | 'http'
  | 'tooBig'
  | 'noRules'
  | 'tooManyDomains'
  | 'compile'
  | 'storage';

export class BlockingError extends Error {
  constructor(
    readonly code: BlockingErrorCode,
    readonly status?: number,
  ) {
    super(code);
  }
}

export type BlockingStatus =
  { phase: 'idle' } | { phase: 'downloading'; name: string } | { phase: 'compiling'; done: number; total: number };

const dir = new Directory(Paths.document, 'content-blocking');
const stateFile = () => new File(dir, 'state.json');
const listFile = (id: string) => new File(dir, `list-${id}.json`);
const androidFile = () => new File(dir, 'blocker.txt');

function defaultLists(): ListState[] {
  return CATALOGUE.map((c) => ({
    id: c.id,
    name: c.name,
    url: c.url,
    homepage: c.homepage,
    license: c.license,
    licenseUrl: c.licenseUrl,
    kind: c.kind,
    enabled: c.defaultOn(),
  }));
}

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

class ContentBlockingStore {
  lists: ListState[] = defaultLists();
  compiled: Compiled | null = null;
  status: BlockingStatus = { phase: 'idle' };
  /** iOS: the rule lists tabs attach (empty until compiled). */
  ruleLists: string[] = [];
  /** Whether the WebViews block at the network level (a compiled set is active). */
  active = false;
  version = 0;
  private listeners = new Set<() => void>();
  private loaded: Promise<void> | null = null;
  /** One download / compile at a time. */
  private queue: Promise<unknown> = Promise.resolve();
  private master = false;
  /** Domains the user blocks with their own rules (content/siteRules.ts), merged with the lists' domains. */
  private userDomains: string[] = [];

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;

  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  /** Reads the saved state and hands the compiled blocker to the native side; parses nothing. */
  load(): Promise<void> {
    this.loaded ??= (async () => {
      try {
        const file = stateFile();
        if (file.exists) {
          const saved = JSON.parse(await file.text()) as Persisted;
          if (saved?.version === 1 && Array.isArray(saved.lists)) {
            // Catalogue entries keep their current names and addresses; their switches come from disk.
            const byId = new Map(saved.lists.map((l) => [l.id, l]));
            this.lists = [
              ...defaultLists().map((d) => {
                const s = byId.get(d.id);
                return s
                  ? {
                      ...s,
                      name: d.name,
                      url: d.url,
                      homepage: d.homepage,
                      license: d.license,
                      licenseUrl: d.licenseUrl,
                      kind: d.kind,
                    }
                  : d;
              }),
              ...saved.lists.filter((l) => l.kind === 'custom'),
            ];
            this.compiled = saved.compiled ?? null;
          }
        }
      } catch {
        // Unreadable state: start from the defaults (lists download again).
      }
      await this.applyNative();
      this.emit();
    })();
    return this.loaded;
  }

  /** The master switch ("Block ads and trackers"): with it off the native side holds nothing. */
  async setMaster(on: boolean): Promise<void> {
    await this.load();
    if (this.master === on) return;
    this.master = on;
    await this.applyNative();
    this.emit();
  }

  /**
   * On app start and when it comes back to the foreground: downloads lists that are due (never downloaded, or
   * older than the update interval), using ETag / Last-Modified so unchanged lists aren't downloaded again.
   * `allowed`: the user accepted the terms and blocking is on.
   */
  async autoUpdate(allowed: boolean): Promise<void> {
    await this.load();
    if (!allowed || !hasNativeBlocking()) return;
    const now = Date.now();
    const due = this.lists.filter((l) => {
      if (!l.enabled) return false;
      const last = l.checkedAt ?? 0;
      if (!l.fetchedAt) return now - last > RETRY_INTERVAL_MS;
      return now - last > UPDATE_INTERVAL_MS;
    });
    if (due.length) await this.update(due.map((l) => l.id)).catch(() => {});
    // A compile that didn't happen (e.g. the app was closed) or a lost iOS rule list.
    else if (this.needsCompile()) await this.recompile().catch(() => {});
  }

  /** The user's own blocked domains changed: compiled in with the lists (the same domains: nothing to do). */
  async setUserDomains(domains: string[]): Promise<void> {
    await this.load();
    const next = [...new Set(domains)].sort();
    if (next.join('\n') === this.userDomains.join('\n')) return;
    this.userDomains = next;
    if (this.needsCompile()) await this.recompile();
  }

  /** "Update now": every enabled list, unless unchanged on the server. */
  updateNow(): Promise<void> {
    return this.update(this.lists.filter((l) => l.enabled).map((l) => l.id));
  }

  /** Turns a list on or off; one never downloaded is downloaded when `allowed` (terms accepted, blocking on). */
  async setEnabled(id: string, enabled: boolean, allowed: boolean): Promise<void> {
    await this.load();
    this.patch(id, { enabled });
    await this.save();
    const list = this.lists.find((l) => l.id === id);
    if (enabled && list && !list.fetchedAt) {
      if (allowed) await this.update([id]);
    } else await this.recompile();
  }

  /** Adds a list by its https:// address after downloading and checking it; throws a BlockingError otherwise. */
  async addCustom(rawUrl: string): Promise<ListState> {
    await this.load();
    const url = rawUrl.trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BlockingError('https');
    }
    if (parsed.protocol !== 'https:' || !parsed.hostname) throw new BlockingError('https');
    if (this.lists.some((l) => l.url === url)) throw new BlockingError('duplicate');
    if (this.lists.filter((l) => l.kind === 'custom').length >= MAX_CUSTOM_LISTS)
      throw new BlockingError('tooManyLists');
    const list: ListState = {
      id: `custom-${Date.now().toString(36)}`,
      name: parsed.hostname + (parsed.pathname.length > 1 ? parsed.pathname : ''),
      url,
      kind: 'custom',
      enabled: true,
    };
    return this.run(async () => {
      const result = await this.download(list);
      if (result === 'unchanged') throw new BlockingError('noRules');
      Object.assign(list, result.state);
      const total = this.totalDomains([...this.enabledLists(), list]);
      if (total > MAX_TOTAL_DOMAINS) {
        listFile(list.id).delete();
        throw new BlockingError('tooManyDomains');
      }
      this.lists.push(list);
      await this.save();
      this.emit();
      await this.compileNow();
      return list;
    });
  }

  async removeCustom(id: string): Promise<void> {
    await this.load();
    const list = this.lists.find((l) => l.id === id);
    if (!list || list.kind !== 'custom') return;
    this.lists = this.lists.filter((l) => l.id !== id);
    await this.save();
    try {
      const file = listFile(id);
      if (file.exists) file.delete();
    } catch {}
    await this.recompile();
  }

  /** "Reset blocking": default lists only, everything downloaded or compiled removed, then downloaded again. */
  async reset(allowed: boolean): Promise<void> {
    await this.load();
    await this.run(async () => {
      try {
        if (dir.exists) dir.delete();
      } catch {}
      await removeIosRuleLists(RULE_LIST_PREFIX, []).catch(() => {});
      this.lists = defaultLists();
      this.compiled = null;
      await this.save();
      await this.applyNative();
      this.emit();
    });
    if (allowed) await this.updateNow().catch(() => {});
  }

  private enabledLists() {
    return this.lists.filter((l) => l.enabled && l.fetchedAt);
  }

  private totalDomains(lists: ListState[]) {
    return lists.reduce((sum, l) => sum + (l.domains ?? 0), 0);
  }

  private compileKey() {
    const lists = this.enabledLists()
      .map((l) => `${l.id}@${l.fetchedAt}`)
      .sort()
      .join(',');
    return this.userDomains.length ? `${lists}|user@${hashText(this.userDomains.join('\n'))}` : lists;
  }

  private needsCompile() {
    const key = this.compileKey();
    return (this.compiled?.key ?? '') !== key;
  }

  private patch(id: string, change: Partial<ListState>) {
    this.lists = this.lists.map((l) => (l.id === id ? { ...l, ...change } : l));
    this.emit();
  }

  private run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => {});
    return next;
  }

  private async update(ids: string[]): Promise<void> {
    await this.load();
    let failure: unknown = null;
    await this.run(async () => {
      for (const id of ids) {
        const list = this.lists.find((l) => l.id === id);
        if (!list) continue;
        try {
          const result = await this.download(list);
          this.patch(id, result === 'unchanged' ? { checkedAt: Date.now(), error: undefined } : result.state);
        } catch (e) {
          failure ??= e;
          this.patch(id, {
            checkedAt: Date.now(),
            error: e instanceof BlockingError ? e.code : 'network',
          });
        }
        await this.save();
      }
      this.status = { phase: 'idle' };
      this.emit();
      if (this.needsCompile()) await this.compileNow();
    });
    if (failure) throw failure;
  }

  /** Downloads and parses one list; writes its domain sets only when everything succeeded. */
  private async download(list: ListState): Promise<'unchanged' | { state: Partial<ListState> }> {
    this.status = { phase: 'downloading', name: list.name };
    this.emit();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    let text: string;
    let response: Response;
    try {
      const headers: Record<string, string> = { Accept: 'text/plain, */*' };
      // Only with data to fall back on: a missing file must be downloaded again in full.
      const haveData = !!list.fetchedAt && listFile(list.id).exists;
      if (haveData && list.etag) headers['If-None-Match'] = list.etag;
      if (haveData && list.lastModified) headers['If-Modified-Since'] = list.lastModified;
      try {
        response = await fetch(list.url, { headers, signal: controller.signal });
      } catch {
        throw new BlockingError('network');
      }
      if (response.status === 304) return 'unchanged';
      if (!response.ok) throw new BlockingError('http', response.status);
      const length = Number(response.headers.get('content-length'));
      if (length > MAX_LIST_BYTES) {
        controller.abort();
        throw new BlockingError('tooBig');
      }
      try {
        text = await response.text();
      } catch {
        throw new BlockingError('network');
      }
    } finally {
      clearTimeout(timer);
    }
    if (text.length > MAX_LIST_BYTES) throw new BlockingError('tooBig');
    const parsed: ParsedList = await parseListInBatches(text, pause);
    const domains = parsed.block.length + parsed.blockThirdParty.length + parsed.allow.length;
    if (domains === 0) throw new BlockingError('noRules');
    try {
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      await listFile(list.id).write(
        JSON.stringify({ block: parsed.block, blockThirdParty: parsed.blockThirdParty, allow: parsed.allow }),
      );
    } catch {
      throw new BlockingError('storage');
    }
    return {
      state: {
        etag: response.headers.get('etag') ?? undefined,
        lastModified: response.headers.get('last-modified') ?? undefined,
        fetchedAt: Date.now(),
        checkedAt: Date.now(),
        bytes: text.length,
        stats: parsed.stats,
        domains,
        error: undefined,
      },
    };
  }

  private recompile(): Promise<void> {
    return this.run(() => this.compileNow());
  }

  /** Merges the enabled lists and compiles them for this platform; the previous result stays on failure. */
  private async compileNow(): Promise<void> {
    if (!this.needsCompile() && (await this.compiledIsPresent())) {
      await this.applyNative();
      return;
    }
    const key = this.compileKey();
    const enabled = this.enabledLists();
    try {
      const parsed: Pick<ParsedList, 'block' | 'blockThirdParty' | 'allow'>[] = [];
      for (const list of enabled) {
        try {
          parsed.push(JSON.parse(await listFile(list.id).text()));
        } catch {
          // Its file is gone: download it again next time.
          this.patch(list.id, { fetchedAt: undefined, checkedAt: undefined });
        }
        await pause();
      }
      if (this.userDomains.length) parsed.push({ block: this.userDomains, blockThirdParty: [], allow: [] });
      const merged: CompiledBlocker = mergeLists(parsed);
      const domains = merged.block.length + merged.blockThirdParty.length + merged.allow.length;
      if (domains > MAX_TOTAL_DOMAINS) throw new BlockingError('tooManyDomains');
      let ruleLists: string[] = [];
      if (Platform.OS === 'android') {
        const target = androidFile();
        const temp = new File(dir, 'blocker.tmp');
        if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
        await temp.write(androidBlockerFile(merged));
        temp.move(target, { overwrite: true });
      } else if (Platform.OS === 'ios') {
        ruleLists = await this.compileIos(merged);
      }
      this.compiled = { key, domains, ruleLists, at: Date.now() };
      await this.save();
    } catch (e) {
      this.status = { phase: 'idle' };
      this.emit();
      throw e instanceof BlockingError ? e : new BlockingError('compile');
    }
    this.status = { phase: 'idle' };
    await this.applyNative();
    this.emit();
    if (Platform.OS === 'ios') await removeIosRuleLists(RULE_LIST_PREFIX, this.compiled.ruleLists).catch(() => {});
  }

  /** iOS: compiles each chunk not already in the store (identifiers carry a hash of the JSON). */
  private async compileIos(merged: CompiledBlocker): Promise<string[]> {
    const chunks = contentRuleLists(merged);
    const ids: string[] = [];
    this.status = { phase: 'compiling', done: 0, total: chunks.length };
    this.emit();
    for (let i = 0; i < chunks.length; i++) {
      const id = `${RULE_LIST_PREFIX}${hashText(chunks[i])}-${chunks[i].length.toString(36)}`;
      ids.push(id);
      if (!(await hasIosRuleList(id))) {
        const file = new File(Paths.cache, `${id}.json`);
        await file.write(chunks[i]);
        try {
          await compileIosRuleList(id, file.uri);
        } finally {
          try {
            file.delete();
          } catch {}
        }
      }
      this.status = { phase: 'compiling', done: i + 1, total: chunks.length };
      this.emit();
    }
    return ids;
  }

  private async compiledIsPresent(): Promise<boolean> {
    if (!this.compiled) return false;
    if (Platform.OS === 'android') return androidFile().exists;
    for (const id of this.compiled.ruleLists) if (!(await hasIosRuleList(id))) return false;
    return true;
  }

  /** Hands the compiled blocker to the native side (or nothing, when the master switch is off). */
  private async applyNative(): Promise<void> {
    const on = this.master && !!this.compiled && this.compiled.domains > 0;
    try {
      if (Platform.OS === 'android') {
        const file = androidFile();
        const count = on && file.exists ? await loadAndroidBlocker(file.uri) : await loadAndroidBlocker('');
        this.active = count > 0;
      } else if (Platform.OS === 'ios') {
        this.ruleLists = on ? (this.compiled?.ruleLists ?? []) : [];
        this.active = this.ruleLists.length > 0 && hasNativeBlocking();
      }
    } catch {
      this.active = false;
    }
  }

  private async save(): Promise<void> {
    try {
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const data: Persisted = { version: 1, lists: this.lists, compiled: this.compiled ?? undefined };
      await stateFile().write(JSON.stringify(data));
    } catch {}
  }
}

export const contentBlocking = new ContentBlockingStore();
