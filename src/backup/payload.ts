import { isSiteLevel, type SiteLevel } from '../agent/sitePolicy';
import { cleanCustomHeaders, type CustomHeader, headerProblems, MAX_CUSTOM_HEADERS } from '../ai/customHeaders';
import { restoredCustomInstructions } from '../agent/retiredInstructions';
import {
  cleanMemoryText,
  hiddenKindOf,
  hiddenLabelProblem,
  isMemoryCategory,
  MAX_MEMORIES,
  type MemoryCategory,
  sensitiveReason,
} from '../agent/memory';
import { parseAnswerCost } from '../ai/cost';
import { normalizeBaseUrl } from '../ai/customEndpoint';
import type { ProviderId } from '../ai/types';
import { READER_FONTS, READER_THEMES } from '../browser/reader';
import { isSearchEngine } from '../browser/search';
import { cleanTask, MAX_SAVED_TASKS, TASK_TARGETS, type TaskSchedule, type TaskTarget } from '../storage/savedTasks';
import { cutText, wellFormed } from '../utils/wellFormed';
import { storedCards } from '../chat/optionCards';
import { MAX_RULES, parseRuleLine, siteHost as ruleSite } from '../content/siteRules';
import { readBackupStyles, type BackupStyle } from '../content/userStyles';
import { readBackupScripts, type BackupScript } from '../content/userScripts';
import { readBackupApps, type BackupApps } from '../apps/appBackup';

/**
 * What goes inside a backup: versioned JSON by kind of data, independent of the SQLite schema, so a
 * newer app can read an older backup (missing kinds and fields are simply absent) and an older app
 * refuses a newer one. Pure code; parseBackup treats the file as untrusted input.
 *
 * {
 *   app: "qutai", payloadVersion: 1, createdAt: ms, appVersion: "1.2.0", schemaVersion: 9,
 *   bookmarks?: { folders: [{ id, parentId, title, createdAt }], items: [{ url, title, createdAt, folderId }] },
 *   history?: [{ url, title, visitedAt }],
 *   memories?: [{ text, category?, createdAt, updatedAt, sensitive?, label? }],   // category: absent before categories
 *            // (= general); sensitive (hidden from the AI) and label: absent before hidden memories (= not hidden)
 *   tasks?: [{ name, prompt, target, url, research, createdAt, lastUsedAt, schedule, paused, private, autoRun }],
 *   sites?: { permissions: [{ host, level }], location: [{ host, setting }], media?: [{ host, kind, setting }],
 *            blockingOff?: [host], personal?: [{ host, setting }],
 *            rules?: [{ line, enabled, source, site, url?, createdAt }],   // the user's own site rules (filter lines)
 *            styles?: [{ name, scope, css, enabled, source, site, url?, createdAt }],   // user styles, CSS sanitised
 *            // again on restore (docs/page-customisation.md)
 *            scripts?: [{ name, scope, code, runAt, enabled, seal, source, site, url?, createdAt }] },   // kept scripts:
 *            // checked again on restore; switched on only when the seal verifies with this phone's own key
 *   settings?: { theme: "dark", textZoom: 120, models: { anthropic: "…" }, … },
 *   apiKeys?: { anthropic?: "…", openai?: "…", gemini?: "…", openrouter?: "…", custom?: "…" },   // only when the user opted in
 *   customHeaders?: [{ name, value }],   // the custom endpoint's extra headers: secrets, so only with apiKeys' opt-in
 *   tabs?: { tabs: [{ url, title, uid, groupId? }], activeIndex, groups: [{ id, name, color, collapsed? }] },
 *   chats?: [{ key, items: [...], turns: [...] }],   // key: a tab's uid or "group:<id>"; an item's cost: numbers only
 *   activity?: [{ at, host, url, tool, description, ok }],
 *   apps?: { withData, items: [{ manifest, files, sha256, seal, state, grants, createdAt, updatedAt, openedAt,
 *            data?: { kv, docs } }] }   // the user's apps, current version only (src/apps/appBackup.ts); a version
 *            // without it ignores the section. Seal and grants count only where the seal verifies (this phone's key)
 * }
 *
 * Never included: the "What was sent to the AI" list (ai_requests), which is a log of this phone's requests.
 *
 * A kind that is present replaces or merges with the phone's data on import; an absent kind is left alone.
 */

export const PAYLOAD_VERSION = 1;

export type BackupFolder = { id: number; parentId: number | null; title: string; createdAt: number };
export type BackupBookmark = { url: string; title: string; createdAt: number; folderId: number | null };
export type BackupVisit = { url: string; title: string; visitedAt: number };
export type BackupMemory = {
  text: string;
  category: MemoryCategory;
  createdAt: number;
  updatedAt: number;
  /** Hidden from the AI provider; absent in backups made before hidden memories. */
  sensitive?: boolean;
  label?: string;
};
export type BackupTask = {
  name: string;
  prompt: string;
  target: TaskTarget;
  url: string | null;
  research: boolean;
  createdAt: number;
  lastUsedAt: number | null;
  schedule: TaskSchedule | null;
  paused: boolean;
  private: boolean;
  autoRun: boolean;
};
export type BackupSitePermission = { host: string; level: Exclude<SiteLevel, 'default'> };
export type BackupLocation = { host: string; setting: 'allow' | 'block' };
/** A site's camera or microphone setting (not in backups made before it existed). */
export type BackupMedia = { host: string; kind: 'camera' | 'microphone'; setting: 'allow' | 'block' };
export type BackupSiteRule = {
  line: string;
  enabled: boolean;
  source: 'assistant' | 'manual';
  site: string;
  url?: string;
  createdAt: number;
};
export type { BackupStyle };
export type BackupTab = { url: string; title: string; uid: string; groupId?: string };
export type BackupGroup = { id: string; name: string; color: string; collapsed?: boolean };
export type BackupChat = { key: string; items: unknown[]; turns: unknown[] };
export type BackupAction = {
  at: number;
  host: string | null;
  url: string | null;
  tool: string;
  description: string;
  ok: boolean;
};

/** Preferences that travel with a backup. Locks and first-run state stay with the phone. */
export type BackupSettings = Partial<{
  provider: ProviderId;
  models: Partial<Record<ProviderId, string>>;
  /** The custom endpoint's base URL (not in backups made before it existed). */
  customBaseUrl: string;
  confirmActions: boolean;
  searchEngine: string;
  searchSuggestions: boolean;
  textZoom: number;
  memoryEnabled: boolean;
  /** Not in backups made before custom instructions existed. */
  customInstructions: string;
  /**
   * True in backups made after the retired example lines were taken out on the phone (agent/retiredInstructions.ts);
   * without it, restoring removes them from customInstructions as the phone did.
   */
  retiredInstructionsRemoved: boolean;
  webSearch: boolean;
  blockAds: boolean;
  hideCookieBanners: boolean;
  theme: 'system' | 'light' | 'dark';
  darkSites: boolean;
  addressBarPosition: 'top' | 'bottom';
  haptics: boolean;
  httpsOnly: boolean;
  blockThirdPartyCookies: boolean;
  showAssistantButton: boolean;
  keepAddressBarVisible: boolean;
  forceZoom: boolean;
  backgroundPlayback: boolean;
  pictureInPicture: boolean;
  readerTheme: string;
  readerFont: string;
  readerEasyReading: boolean;
  voiceAutoSend: boolean;
  voiceHoldToTalk: boolean;
}>;

export type BackupPayload = {
  app: 'qutai';
  payloadVersion: number;
  createdAt: number;
  appVersion: string;
  schemaVersion: number;
  bookmarks?: { folders: BackupFolder[]; items: BackupBookmark[] };
  history?: BackupVisit[];
  memories?: BackupMemory[];
  tasks?: BackupTask[];
  sites?: {
    permissions: BackupSitePermission[];
    location: BackupLocation[];
    media?: BackupMedia[];
    /** Sites where ad and tracker blocking is off. */
    blockingOff?: string[];
    /** Whether the assistant may enter personal details there (not in backups made before it existed). */
    personal?: BackupLocation[];
    /** The user's own site rules (content/siteRules.ts); not in backups made before them. */
    rules?: BackupSiteRule[];
    /** User styles (content/userStyles.ts); not in backups made before them. */
    styles?: BackupStyle[];
    /** Kept scripts (content/userScripts.ts); never read as anything else by versions that don't know them. */
    scripts?: BackupScript[];
  };
  settings?: BackupSettings;
  apiKeys?: Partial<Record<ProviderId, string>>;
  customHeaders?: CustomHeader[];
  tabs?: { tabs: BackupTab[]; activeIndex: number; groups: BackupGroup[] };
  chats?: BackupChat[];
  activity?: BackupAction[];
  /** The user's apps (docs/mini-apps.md › Backup and restore); not in backups made before them. */
  apps?: BackupApps;
};

/** The payload could not be used. */
export class PayloadError extends Error {
  constructor(public code: 'invalid' | 'newer-version') {
    super(code);
    this.name = 'PayloadError';
  }
}

/** Every provider, checked by the compiler, so a new one can't be forgotten here. */
const PROVIDER_IDS = Object.keys({ anthropic: true, openai: true, gemini: true, openrouter: true, custom: true, qutai: true } satisfies Record<
  ProviderId,
  true
>) as ProviderId[];

const LIMITS = {
  url: 8192,
  title: 1000,
  folders: 10_000,
  bookmarks: 100_000,
  history: 200_000,
  sites: 10_000,
  tabs: 500,
  groups: 200,
  chats: 500,
  chatItems: 300,
  chatTurns: 2000,
  chatText: 200_000,
  activity: 5000,
  apiKey: 500,
};

// ---------- Small validators: each returns the clean value or undefined ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
// Well-formed: a backup from an older version may hold half an emoji, which a provider refuses once it is sent.
const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' ? wellFormed(cutText(v, max)) : undefined);
const time = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 8.64e15 ? Math.floor(v) : 0;
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const oneOf = <T extends string>(v: unknown, values: readonly T[]): T | undefined =>
  typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : undefined;

/** An http(s) address without control characters or spaces, not too long. */
export function webUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > LIMITS.url) return undefined;
  if (!/^https?:\/\/[^\s/?#]+[^\s]*$/i.test(v) || /[\u0000-\u001f\u007f]/.test(v)) return undefined;
  return v;
}

/** A host as the app stores it ("example.com", "sub.example.com:8080", "[::1]"), lower case. */
export function siteHost(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length === 0 || v.length > 260) return undefined;
  const host = v.toLowerCase();
  return /^(?:[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?(?:\.[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?)*|\[[0-9a-f:.]+\])(?::\d{1,5})?$/.test(
    host,
  )
    ? host
    : undefined;
}

/** Ids for tabs and groups: short, plain characters (they become storage keys). */
const id = (v: unknown): string | undefined => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : undefined);
/** Tool call ids come from the provider; any short printable string. */
const callId = (v: unknown): string | undefined =>
  typeof v === 'string' && /^[\x21-\x7e]{1,200}$/.test(v) ? v : undefined;

// ---------- Kinds ----------

function parseBookmarks(v: unknown): BackupPayload['bookmarks'] {
  if (!isObj(v)) return undefined;
  const folders = new Map<number, BackupFolder>();
  for (const f of list(v.folders, LIMITS.folders)) {
    if (!isObj(f) || !Number.isSafeInteger(f.id) || folders.has(f.id as number)) continue;
    const title = str(f.title, LIMITS.title)?.trim();
    if (!title) continue;
    const parentId = Number.isSafeInteger(f.parentId) ? (f.parentId as number) : null;
    folders.set(f.id as number, { id: f.id as number, parentId, title, createdAt: time(f.createdAt) });
  }
  // Parents must exist, and a chain of parents must end at the top (no cycles).
  for (const folder of folders.values()) {
    if (folder.parentId !== null && !folders.has(folder.parentId)) folder.parentId = null;
  }
  for (const folder of folders.values()) {
    const seen = new Set<number>([folder.id]);
    let parent = folder.parentId;
    while (parent !== null) {
      if (seen.has(parent)) {
        folder.parentId = null;
        break;
      }
      seen.add(parent);
      parent = folders.get(parent)?.parentId ?? null;
    }
  }
  const urls = new Set<string>();
  const items: BackupBookmark[] = [];
  for (const b of list(v.items, LIMITS.bookmarks)) {
    if (!isObj(b)) continue;
    const url = webUrl(b.url);
    if (!url || urls.has(url)) continue;
    urls.add(url);
    const folderId =
      Number.isSafeInteger(b.folderId) && folders.has(b.folderId as number) ? (b.folderId as number) : null;
    items.push({ url, title: str(b.title, LIMITS.title) ?? '', createdAt: time(b.createdAt), folderId });
  }
  return { folders: [...folders.values()], items };
}

function parseHistory(v: unknown): BackupVisit[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return list(v, LIMITS.history).flatMap((h) => {
    const url = isObj(h) ? webUrl(h.url) : undefined;
    return url && isObj(h) ? [{ url, title: str(h.title, LIMITS.title) ?? '', visitedAt: time(h.visitedAt) }] : [];
  });
}

function parseMemories(v: unknown): BackupMemory[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out: BackupMemory[] = [];
  for (const m of list(v, MAX_MEMORIES * 2)) {
    if (!isObj(m) || typeof m.text !== 'string') continue;
    const text = cleanMemoryText(m.text);
    // Backups made before categories have none: those memories are general, as after the database migration.
    const category = isMemoryCategory(m.category) ? m.category : 'general';
    // The same rules as saving a memory in the app: no passwords, codes or card numbers, no duplicates.
    if (!text || sensitiveReason(text, category) || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    // ID and passport numbers are hidden however old the backup is, as they are when saved in the app; a label that
    // would give the value away is dropped.
    const sensitive = m.sensitive === true || !!hiddenKindOf(text);
    const label = typeof m.label === 'string' ? m.label.replace(/\s+/g, ' ').trim() : '';
    out.push({
      text,
      category,
      createdAt: time(m.createdAt),
      updatedAt: time(m.updatedAt),
      ...(sensitive ? { sensitive } : {}),
      ...(sensitive && label && !hiddenLabelProblem(label, text) ? { label } : {}),
    });
    if (out.length >= MAX_MEMORIES) break;
  }
  return out;
}

function parseTasks(v: unknown): BackupTask[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return list(v, MAX_SAVED_TASKS).flatMap((x) => {
    if (!isObj(x) || typeof x.prompt !== 'string') return [];
    const target = oneOf(x.target, TASK_TARGETS) ?? 'page';
    try {
      // The same rules as saving a task in the app (an address only for "open a page first", http(s) only).
      const task = cleanTask({
        name: typeof x.name === 'string' ? x.name : '',
        prompt: x.prompt,
        target,
        url: typeof x.url === 'string' ? x.url : null,
        research: x.research === true,
        // Checked like a schedule read from the database; reminders are scheduled after the app restarts.
        schedule: x.schedule as TaskSchedule | null,
        paused: x.paused === true,
        private: x.private === true,
        autoRun: x.autoRun === true,
      });
      return [{ ...task, createdAt: time(x.createdAt), lastUsedAt: Number.isFinite(x.lastUsedAt) ? time(x.lastUsedAt) : null }];
    } catch {
      return [];
    }
  });
}

function parseSites(v: unknown): BackupPayload['sites'] {
  if (!isObj(v)) return undefined;
  const permissions = new Map<string, BackupSitePermission>();
  for (const p of list(v.permissions, LIMITS.sites)) {
    if (!isObj(p)) continue;
    const host = siteHost(p.host);
    if (host && isSiteLevel(p.level) && p.level !== 'default') permissions.set(host, { host, level: p.level });
  }
  const location = new Map<string, BackupLocation>();
  for (const l of list(v.location, LIMITS.sites)) {
    if (!isObj(l)) continue;
    const host = siteHost(l.host);
    const setting = oneOf(l.setting, ['allow', 'block'] as const);
    if (host && setting) location.set(host, { host, setting });
  }
  const media = new Map<string, BackupMedia>();
  for (const m of list(v.media, LIMITS.sites * 2)) {
    if (!isObj(m)) continue;
    const host = siteHost(m.host);
    const kind = oneOf(m.kind, ['camera', 'microphone'] as const);
    const setting = oneOf(m.setting, ['allow', 'block'] as const);
    if (host && kind && setting) media.set(`${kind} ${host}`, { host, kind, setting });
  }
  const blockingOff = new Set<string>();
  for (const h of list(v.blockingOff, LIMITS.sites)) {
    const host = siteHost(h);
    if (host) blockingOff.add(host);
  }
  const personal = new Map<string, BackupLocation>();
  for (const l of list(v.personal, LIMITS.sites)) {
    if (!isObj(l)) continue;
    const host = siteHost(l.host);
    const setting = oneOf(l.setting, ['allow', 'block'] as const);
    if (host && setting) personal.set(host, { host, setting });
  }
  const rules = new Map<string, BackupSiteRule>();
  for (const r of list(v.rules, MAX_RULES)) {
    if (!isObj(r) || typeof r.line !== 'string' || !parseRuleLine(r.line)) continue;
    const site = typeof r.site === 'string' ? ruleSite(r.site) : null;
    if (!site) continue;
    const url = typeof r.url === 'string' && /^https?:\/\//i.test(r.url) ? cutText(r.url, 2048) : undefined;
    rules.set(r.line.trim(), {
      line: r.line.trim(),
      enabled: r.enabled !== false,
      source: r.source === 'assistant' ? 'assistant' : 'manual',
      site,
      ...(url ? { url } : {}),
      createdAt: time(r.createdAt),
    });
  }
  // Styles are checked like a style read from a rules file: the CSS through the sanitiser, the scope and the name.
  const styles = readBackupStyles(v.styles);
  // Scripts are checked like a script read from a rules file; their seal decides on the phone (restoredState).
  const scripts = readBackupScripts(v.scripts);
  return {
    permissions: [...permissions.values()],
    location: [...location.values()],
    media: [...media.values()],
    blockingOff: [...blockingOff],
    personal: [...personal.values()],
    rules: [...rules.values()],
    ...(styles.length ? { styles } : {}),
    ...(scripts.length ? { scripts } : {}),
  };
}

const BOOLEAN_SETTINGS = [
  'confirmActions',
  'searchSuggestions',
  'memoryEnabled',
  'webSearch',
  'blockAds',
  'hideCookieBanners',
  'darkSites',
  'haptics',
  'httpsOnly',
  'blockThirdPartyCookies',
  'showAssistantButton',
  'keepAddressBarVisible',
  'forceZoom',
  'backgroundPlayback',
  'pictureInPicture',
  'readerEasyReading',
  'voiceAutoSend',
  'voiceHoldToTalk',
] as const;

function parseSettings(v: unknown): BackupSettings | undefined {
  if (!isObj(v)) return undefined;
  const out: BackupSettings = {};
  for (const key of BOOLEAN_SETTINGS) {
    const value = bool(v[key]);
    if (value !== undefined) out[key] = value;
  }
  const provider = oneOf(v.provider, PROVIDER_IDS);
  if (provider) out.provider = provider;
  if (isObj(v.models)) {
    const models: Partial<Record<ProviderId, string>> = {};
    for (const p of PROVIDER_IDS) {
      const model = v.models[p];
      if (typeof model === 'string' && /^[\w.:/@-]{1,100}$/.test(model)) models[p] = model;
    }
    out.models = models;
  }
  if (typeof v.customBaseUrl === 'string' && v.customBaseUrl.length <= 500) {
    // Checked again for this phone's platform when applied (an iPhone's http address can't be used on Android).
    const url = normalizeBaseUrl(v.customBaseUrl, { allowCleartext: true });
    if (url.ok) out.customBaseUrl = url.url;
  }
  if (isSearchEngine(v.searchEngine)) out.searchEngine = v.searchEngine;
  if (typeof v.textZoom === 'number' && Number.isFinite(v.textZoom)) out.textZoom = v.textZoom;
  const theme = oneOf(v.theme, ['system', 'light', 'dark'] as const);
  if (theme) out.theme = theme;
  const position = oneOf(v.addressBarPosition, ['top', 'bottom'] as const);
  if (position) out.addressBarPosition = position;
  const readerTheme = oneOf(v.readerTheme, READER_THEMES);
  if (readerTheme) out.readerTheme = readerTheme;
  const readerFont = oneOf(v.readerFont, READER_FONTS);
  if (readerFont) out.readerFont = readerFont;
  if (typeof v.customInstructions === 'string')
    out.customInstructions = restoredCustomInstructions(v.customInstructions, v.retiredInstructionsRemoved);
  return out;
}

function parseApiKeys(v: unknown): BackupPayload['apiKeys'] {
  if (!isObj(v)) return undefined;
  const out: Partial<Record<ProviderId, string>> = {};
  for (const p of PROVIDER_IDS) {
    const key = v[p];
    // Keys are printable ASCII without spaces.
    if (typeof key === 'string' && key.length <= LIMITS.apiKey && /^[\x21-\x7e]+$/.test(key)) out[p] = key;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The custom endpoint's extra headers; rows that break the rules (customHeaders.ts) are dropped. */
function parseCustomHeaders(v: unknown): BackupPayload['customHeaders'] {
  const rows = list(v, MAX_CUSTOM_HEADERS).flatMap((h) =>
    isObj(h) && typeof h.name === 'string' && typeof h.value === 'string' ? [{ name: h.name, value: h.value }] : [],
  );
  // Checked without a key, so that an `authorization` row survives; it is checked again when used.
  const problems = headerProblems(rows, '');
  const out = cleanCustomHeaders(rows.filter((_, i) => !problems[i]));
  return out.length ? out : undefined;
}

function parseTabs(v: unknown): BackupPayload['tabs'] {
  if (!isObj(v)) return undefined;
  const groups = new Map<string, BackupGroup>();
  for (const g of list(v.groups, LIMITS.groups)) {
    if (!isObj(g)) continue;
    const gid = id(g.id);
    const name = str(g.name, 100);
    const color = typeof g.color === 'string' && /^#[0-9a-f]{6}$/i.test(g.color) ? g.color : undefined;
    if (gid && name !== undefined && color && !groups.has(gid)) {
      groups.set(gid, { id: gid, name, color, ...(g.collapsed === true ? { collapsed: true } : {}) });
    }
  }
  const uids = new Set<string>();
  const tabs: BackupTab[] = [];
  let activeIndex = 0;
  list(v.tabs, LIMITS.tabs).forEach((tab, i) => {
    if (!isObj(tab)) return;
    const url = webUrl(tab.url);
    const uid = id(tab.uid);
    if (!url || !uid || uids.has(uid)) return;
    uids.add(uid);
    if (i === v.activeIndex) activeIndex = tabs.length;
    const groupId = id(tab.groupId);
    tabs.push({
      url,
      title: str(tab.title, LIMITS.title) ?? '',
      uid,
      ...(groupId && groups.has(groupId) ? { groupId } : {}),
    });
  });
  // Only groups that still have a tab.
  const used = new Set(tabs.map((tab) => tab.groupId));
  return { tabs, activeIndex, groups: [...groups.values()].filter((g) => used.has(g.id)) };
}

const ITEM_KINDS = ['user', 'assistant', 'action', 'error', 'info', 'choices', 'sources', 'call', 'sms', 'whatsapp', 'file', 'options'] as const;
const FILE_FORMATS = ['csv', 'md', 'txt', 'json'] as const;

function parseChatItem(v: unknown): Record<string, unknown> | undefined {
  if (!isObj(v)) return undefined;
  const itemId = str(v.id, 64);
  const kind = oneOf(v.kind, ITEM_KINDS);
  const text = str(v.text, LIMITS.chatText);
  if (!itemId || !kind || text === undefined) return undefined;
  const item: Record<string, unknown> = { id: itemId, kind, text };
  if (Array.isArray(v.options)) item.options = v.options.filter((o) => typeof o === 'string').slice(0, 10);
  if (typeof v.chosen === 'string') item.chosen = cutText(v.chosen, 1000);
  if (Array.isArray(v.sources)) {
    item.sources = v.sources.slice(0, 50).flatMap((s) => {
      const url = isObj(s) ? webUrl(s.url) : undefined;
      return url && isObj(s) ? [{ url, title: str(s.title, LIMITS.title) ?? '', incognito: false }] : [];
    });
  }
  if (isObj(v.call) && typeof v.call.number === 'string' && /^\+?[\d*#]{1,30}$/.test(v.call.number)) {
    item.call = {
      number: v.call.number,
      ...(typeof v.call.name === 'string' ? { name: v.call.name.slice(0, 200) } : {}),
    };
  }
  if (
    isObj(v.sms) &&
    typeof v.sms.number === 'string' &&
    /^\+?\d{3,15}$/.test(v.sms.number) &&
    typeof v.sms.body === 'string'
  ) {
    item.sms = {
      number: v.sms.number,
      body: cutText(v.sms.body, 1000),
      ...(typeof v.sms.name === 'string' ? { name: cutText(v.sms.name, 200) } : {}),
    };
  }
  if (
    isObj(v.whatsapp) &&
    typeof v.whatsapp.body === 'string' &&
    (v.whatsapp.number === undefined || (typeof v.whatsapp.number === 'string' && /^\+\d{8,15}$/.test(v.whatsapp.number)))
  ) {
    item.whatsapp = {
      body: cutText(v.whatsapp.body, 2000),
      ...(typeof v.whatsapp.number === 'string' ? { number: v.whatsapp.number } : {}),
      ...(typeof v.whatsapp.name === 'string' ? { name: cutText(v.whatsapp.name, 200) } : {}),
    };
  }
  // A composed file's card: only its name and size (the content is never stored, so it shows as expired).
  const format = isObj(v.file) ? oneOf(v.file.format, FILE_FORMATS) : undefined;
  if (isObj(v.file) && format && str(v.file.id, 64) && str(v.file.name, 200) && Number.isFinite(v.file.size)) {
    item.file = {
      id: str(v.file.id, 64),
      name: str(v.file.name, 200),
      format,
      size: Math.max(0, Math.floor(v.file.size as number)),
      ...(Number.isFinite(v.file.rows) ? { rows: Math.max(0, Math.floor(v.file.rows as number)) } : {}),
    };
  }
  // Option cards: the same checks as when they were made (https links and pictures, plain text, at most 8); the
  // incognito flag is never in a backup (incognito conversations aren't saved).
  if (kind === 'options') {
    const cards = storedCards(v.cards);
    if (cards.length) item.cards = cards;
  }
  // The tokens and approximate cost of a task's requests: numbers, the provider and model ids (ai/cost.ts).
  const cost = parseAnswerCost(v.cost);
  if (cost) item.cost = cost;
  // Left out: Google's search widget (HTML from the file would be shown in a web view) and "still writing".
  return item;
}

/**
 * The model-facing history. The provider's own raw message format is dropped (it would be sent to the
 * provider as it is); the app rebuilds requests from text and tool calls when raw is missing.
 */
function parseTurn(v: unknown): Record<string, unknown> | undefined {
  if (!isObj(v)) return undefined;
  if (v.role === 'user') {
    const text = str(v.text, LIMITS.chatText);
    return text === undefined ? undefined : { role: 'user', text };
  }
  if (v.role === 'assistant') {
    const text = str(v.text, LIMITS.chatText) ?? '';
    const toolCalls = list(v.toolCalls, 50).flatMap((c) =>
      isObj(c) && callId(c.id) && typeof c.name === 'string' && isObj(c.input)
        ? [{ id: c.id, name: cutText(c.name, 100), input: c.input }]
        : [],
    );
    return { role: 'assistant', text, toolCalls, raw: null, rawProvider: 'none', rawModel: '' };
  }
  if (v.role === 'tool_results') {
    const results = list(v.results, 50).flatMap((r) =>
      isObj(r) && callId(r.callId) && typeof r.name === 'string' && typeof r.content === 'string'
        ? [
            {
              callId: r.callId,
              name: cutText(r.name, 100),
              content: cutText(r.content, LIMITS.chatText),
              isError: r.isError === true,
            },
          ]
        : [],
    );
    return { role: 'tool_results', results };
  }
  return undefined;
}

function parseChats(v: unknown): BackupChat[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const keys = new Set<string>();
  return list(v, LIMITS.chats).flatMap((c) => {
    if (!isObj(c) || typeof c.key !== 'string' || !/^(?:group:)?[\w-]{1,64}$/.test(c.key) || keys.has(c.key)) return [];
    keys.add(c.key);
    const items = list(c.items, LIMITS.chatItems).flatMap((i) => parseChatItem(i) ?? []);
    const turns = list(c.turns, LIMITS.chatTurns).flatMap((t) => parseTurn(t) ?? []);
    return items.length || turns.length ? [{ key: c.key, items, turns }] : [];
  });
}

function parseActivity(v: unknown): BackupAction[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return list(v, LIMITS.activity).flatMap((a) => {
    if (!isObj(a)) return [];
    const tool = str(a.tool, 100);
    const description = str(a.description, 2000);
    if (!tool || description === undefined) return [];
    return [
      {
        at: time(a.at),
        host: a.host === null ? null : (siteHost(a.host) ?? null),
        url: a.url === null ? null : (webUrl(a.url) ?? null),
        tool,
        description,
        ok: a.ok === true,
      },
    ];
  });
}

// ---------- Whole payload ----------

export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload);
}

/**
 * Parses and cleans a decrypted payload. Entries that don't pass are dropped one by one; unknown fields
 * are ignored. Throws PayloadError when it isn't a Qutai backup or was made by a newer app.
 */
export function parseBackup(json: string): BackupPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new PayloadError('invalid');
  }
  if (
    !isObj(raw) ||
    raw.app !== 'qutai' ||
    !Number.isSafeInteger(raw.payloadVersion) ||
    (raw.payloadVersion as number) < 1
  ) {
    throw new PayloadError('invalid');
  }
  if ((raw.payloadVersion as number) > PAYLOAD_VERSION) throw new PayloadError('newer-version');
  const payload: BackupPayload = {
    app: 'qutai',
    payloadVersion: raw.payloadVersion as number,
    createdAt: time(raw.createdAt),
    appVersion: str(raw.appVersion, 40) ?? '',
    schemaVersion: Number.isSafeInteger(raw.schemaVersion) ? (raw.schemaVersion as number) : 0,
  };
  const sections = {
    bookmarks: parseBookmarks(raw.bookmarks),
    history: parseHistory(raw.history),
    memories: parseMemories(raw.memories),
    tasks: parseTasks(raw.tasks),
    sites: parseSites(raw.sites),
    settings: parseSettings(raw.settings),
    apiKeys: parseApiKeys(raw.apiKeys),
    customHeaders: parseCustomHeaders(raw.customHeaders),
    tabs: parseTabs(raw.tabs),
    chats: parseChats(raw.chats),
    activity: parseActivity(raw.activity),
    apps: readBackupApps(raw.apps),
  };
  for (const [key, value] of Object.entries(sections)) {
    if (value !== undefined) (payload as Record<string, unknown>)[key] = value;
  }
  return payload;
}

/** Counts per kind for the import summary; a kind the backup doesn't have is absent. */
export type BackupSummary = {
  createdAt: number;
  appVersion: string;
  bookmarks?: number;
  folders?: number;
  history?: number;
  memories?: number;
  tasks?: number;
  sites?: number;
  settings?: boolean;
  tabs?: number;
  chats?: number;
  activity?: number;
  /** Apps, and whether the backup has their data. */
  apps?: number;
  appsWithData?: boolean;
  /** Providers whose API key is in the backup (custom also when only its extra headers are). */
  apiKeys: ProviderId[];
};

export function summarize(p: BackupPayload): BackupSummary {
  return {
    createdAt: p.createdAt,
    appVersion: p.appVersion,
    ...(p.bookmarks ? { bookmarks: p.bookmarks.items.length, folders: p.bookmarks.folders.length } : {}),
    ...(p.history ? { history: p.history.length } : {}),
    ...(p.memories ? { memories: p.memories.length } : {}),
    ...(p.tasks ? { tasks: p.tasks.length } : {}),
    ...(p.sites
      ? {
          sites: new Set([
            ...[...p.sites.permissions, ...p.sites.location, ...(p.sites.media ?? []), ...(p.sites.personal ?? [])].map(
              (s) => s.host,
            ),
            ...(p.sites.blockingOff ?? []),
            ...(p.sites.rules ?? []).map((r) => r.site),
            ...(p.sites.styles ?? []).flatMap((st) => (st.site === '*' ? [] : [st.site])),
            ...(p.sites.scripts ?? []).map((sc) => sc.site),
          ]).size,
        }
      : {}),
    ...(p.settings ? { settings: true } : {}),
    ...(p.tabs ? { tabs: p.tabs.tabs.length } : {}),
    ...(p.chats ? { chats: p.chats.length } : {}),
    ...(p.activity ? { activity: p.activity.length } : {}),
    ...(p.apps ? { apps: p.apps.items.length, appsWithData: p.apps.withData } : {}),
    apiKeys: [
      ...new Set([
        ...(p.apiKeys ? (Object.keys(p.apiKeys) as ProviderId[]) : []),
        ...(p.customHeaders ? (['custom'] as const) : []),
      ]),
    ],
  };
}
