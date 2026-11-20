/**
 * The phone around one measured task (README.md in this folder): the ToolContext App.tsx gives runAgent, with the
 * same defaults a new install has ("Ask before every action" off, payments and page scripts off, memory on), but
 * every dialog, card and change recorded instead of shown. The user in these runs did not ask for anything an
 * attacker wants, so every dialog is answered the way such a user would: declined.
 *
 * What stays real: the memory rules (src/storage/memory.ts addMemory over a small in-memory table), the contacts
 * rules (src/agent/contactTool.ts with the real handles), the settings allowlist, the approval gates, the site
 * permission logic, the option-card checks; all of it runs inside the app's own executeTool and runAgent.
 */
import type { ToolContext } from '../../src/agent/executeTool';
import { makeHandles, type ContactsAccess } from '../../src/agent/contactTool';
import type { Memory, MemoryCategory, MemoryStore } from '../../src/agent/memory';
import type { SitePolicy } from '../../src/agent/sitePolicy';
import type { Browser } from '../../src/browser/Browser';
import { DEFAULT_SETTINGS, type Settings } from '../../src/storage/settings';
import { addMemory, deleteMemory, listMemories } from '../../src/storage/memory';
import { randomBytes } from 'node:crypto';

export type Dialog = { kind: string; detail: string };
export type Card = { kind: string; detail: string };

/** What the run left behind, for the judges. */
export type WorldLog = {
  dialogs: Dialog[];
  cards: Card[];
  settingsChanged: Record<string, unknown>[];
  siteRulesSaved: string[];
  contactLookups: string[];
  scriptsRun: string[];
};

type Row = { id: string; text: string; category: string; created_at: number; updated_at: number; sensitive: number; label: string | null };

/** Just enough of expo-sqlite's Db for src/storage/memory.ts, so the real save rules run. */
function memoryDb(rows: Row[]) {
  return {
    async getAllAsync<T>(sql: string): Promise<T[]> {
      if (/FROM memories ORDER BY updated_at DESC/.test(sql)) return [...rows].sort((a, b) => b.updated_at - a.updated_at) as T[];
      throw new Error('fake db: ' + sql);
    },
    async getFirstAsync<T>(sql: string, args: unknown[]): Promise<T | null> {
      if (/COUNT\(\*\)/.test(sql)) return { n: rows.length } as T;
      if (/lower\(text\) = lower/.test(sql)) return (rows.find((r) => r.text.toLowerCase() === String(args[0]).toLowerCase()) ?? null) as T | null;
      if (/WHERE id = \?/.test(sql)) return (rows.find((r) => r.id === args[0]) ?? null) as T | null;
      throw new Error('fake db: ' + sql);
    },
    async runAsync(sql: string, args: unknown[]) {
      if (/^INSERT INTO memories/.test(sql)) {
        const [id, text, category, created_at, updated_at, sensitive, label] = args as [string, string, string, number, number, number, string | null];
        rows.push({ id, text, category, created_at, updated_at, sensitive, label });
      } else if (/^UPDATE memories SET updated_at/.test(sql)) {
        const r = rows.find((x) => x.id === args[4]);
        if (r) Object.assign(r, { updated_at: args[0], category: args[1], sensitive: args[2], label: args[3] });
      } else if (/^DELETE FROM memories WHERE id/.test(sql)) {
        const i = rows.findIndex((x) => x.id === args[0]);
        if (i >= 0) rows.splice(i, 1);
      } else throw new Error('fake db: ' + sql);
      return { changes: 1 };
    },
    async withTransactionAsync(fn: () => Promise<void>) {
      await fn();
    },
  };
}

export type Person = { id: string; givenName: string; familyName?: string; phones: string[]; emails: string[] };

export type WorldOptions = {
  browser: Browser;
  agentTabId: string;
  memories: [MemoryCategory, string][];
  contacts: Person[];
  /** The user's own messages in this conversation (what find_contact may take a name from). */
  userTexts: () => string[];
  attachments?: { id: string; name: string; kind: 'pdf' | 'image' }[];
};

export function makeWorld(o: WorldOptions) {
  const log: WorldLog = { dialogs: [], cards: [], settingsChanged: [], siteRulesSaved: [], contactLookups: [], scriptsRun: [] };
  const now = Date.now();
  const rows: Row[] = o.memories.map(([category, text], i) => ({
    id: `m${i + 1}`,
    text,
    category,
    created_at: now - (i + 1) * 86400000,
    updated_at: now - (i + 1) * 86400000,
    sensitive: 0,
    label: null,
  }));
  const db = memoryDb(rows) as never;
  const memory: MemoryStore = {
    list: () => listMemories(db),
    add: (text, category) => addMemory(db, text, category),
    get: async (id) => (await listMemories(db)).find((m: Memory) => m.id === id) ?? null,
    remove: async (id) => {
      const had = rows.some((r) => r.id === id);
      await deleteMemory(db, id);
      return had;
    },
  };
  let settings: Settings = { ...DEFAULT_SETTINGS };
  const sites: SitePolicy = { levelFor: () => 'default', personalFor: () => 'ask' };
  const handles = makeHandles((n) => new Uint8Array(randomBytes(n)));
  const scope = 'harness-' + Math.random().toString(36).slice(2);
  const contacts: ContactsAccess = {
    scope: () => scope,
    userTexts: o.userTexts,
    state: async () => 'granted',
    ask: async () => 'granted',
    names: async () => o.contacts.map((p) => ({ id: p.id, givenName: p.givenName, familyName: p.familyName })),
    values: async (id) => {
      const p = o.contacts.find((c) => c.id === id);
      log.contactLookups.push(p ? `${p.givenName} ${p.familyName ?? ''}`.trim() : id);
      return { phones: (p?.phones ?? []).map((number) => ({ number })), emails: (p?.emails ?? []).map((address) => ({ address })) };
    },
    pick: async (title) => {
      log.dialogs.push({ kind: 'contact-pick', detail: title });
      return null;
    },
    region: () => 'TR',
    handles,
  };
  const dialog = (kind: string, detail: unknown) => {
    log.dialogs.push({ kind, detail: typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400) });
  };

  const ctx: ToolContext = {
    browser: o.browser,
    agentTab: { id: o.agentTabId },
    askedFrom: { id: o.agentTabId },
    confirm: async (description, host) => {
      dialog('confirm', { description, host });
      return false;
    },
    confirmByDefault: settings.confirmActions,
    sites,
    privacy: { touchedIncognito: false },
    memory,
    appSettings: {
      get: () => settings,
      change: async (patch) => {
        log.settingsChanged.push(patch as Record<string, unknown>);
        settings = { ...settings, ...patch };
      },
    },
    confirmPersonal: async (host, kinds) => {
      dialog('personal', { host, kinds });
      return 'deny';
    },
    confirmHidden: async (host, what) => {
      dialog('hidden', { host, what });
      return false;
    },
    confirmImage: async (opts) => {
      dialog('image', opts.title);
      return false;
    },
    confirmOutward: async (approval) => {
      dialog('outward', approval);
      return false;
    },
    paymentsAllowed: () => settings.assistantPayments,
    siteRules: {
      list: () => [],
      add: async (site, lines) => {
        log.siteRulesSaved.push(`${site}: ${lines.join(' ')}`);
        return [];
      },
      remove: async () => [],
      activeOn: () => settings.blockAds,
    },
    confirmSiteRules: async (approval) => {
      dialog('site-rules', approval);
      return null;
    },
    pageStyles: {
      approve: async (approval) => {
        dialog('style', approval);
        return false;
      },
      applyTrial: async () => {},
      undoTrial: async () => {},
      kept: () => [],
    } as never,
    cookies: {
      read: async () => [],
      remove: async () => 0,
      confirmDelete: async (approval: unknown) => {
        dialog('cookie-delete', approval);
        return false;
      },
      offer: () => {},
    } as never,
    scripts: {
      enabled: () => settings.assistantScripts,
      siteSetting: () => 'default',
      syntax: async () => null,
      approve: async (approval) => {
        dialog('script', approval);
        return false;
      },
      runCopy: async (_s, code) => {
        log.scriptsRun.push(code);
        return { ok: false, error: 'not run in the measurement' } as never;
      },
      offer: () => {},
    },
    contacts,
    composeEmail: async (draft) => {
      log.cards.push({ kind: 'email', detail: JSON.stringify(draft).slice(0, 600) });
      return 'composer-cancelled' as never;
    },
    offerShare: (offer) => log.cards.push({ kind: 'share', detail: JSON.stringify(offer).slice(0, 600) }),
    offerCall: (offer) => log.cards.push({ kind: 'call', detail: JSON.stringify(offer) }),
    offerSms: (offer) => log.cards.push({ kind: 'sms', detail: JSON.stringify(offer) }),
    offerWhatsApp: (offer) => log.cards.push({ kind: 'whatsapp', detail: JSON.stringify(offer) }),
    offerFile: (file) => log.cards.push({ kind: 'file', detail: JSON.stringify(file).slice(0, 600) }),
    startDownload: async (_tab, url) => {
      log.cards.push({ kind: 'download', detail: url });
    },
    attachments: () =>
      (o.attachments ?? []).map((a) => ({ id: a.id, name: a.name, kind: a.kind, mimeType: a.kind === 'pdf' ? 'application/pdf' : 'image/jpeg', size: 1000 }) as never),
    imageInput: true,
    log: () => {},
  };
  return { ctx, log, memory, memoryRows: rows, settings: () => settings };
}
