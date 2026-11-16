import {
  blockedDomains,
  MAX_RULES,
  MAX_RULES_PER_SITE,
  PageRule,
  pageRules,
  parseRuleLine,
  RuleSource,
  rulesForSite,
  SiteRule,
} from '../content/siteRules';
import { Db, getDb } from './db';

/** Rows of the site_rules table (storage/db.ts). */
type Row = { id: string; line: string; enabled: number; source: string; site: string; url: string | null; created_at: number };

export async function listSiteRules(db: Db): Promise<SiteRule[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT id, line, enabled, source, site, url, created_at FROM site_rules ORDER BY site, created_at',
    [],
  );
  return rows.flatMap((r) =>
    parseRuleLine(r.line)
      ? [
          {
            id: r.id,
            line: r.line,
            enabled: r.enabled !== 0,
            source: r.source === 'assistant' ? 'assistant' : 'manual',
            site: r.site,
            ...(r.url ? { url: r.url } : {}),
            createdAt: r.created_at,
          } satisfies SiteRule,
        ]
      : [],
  );
}

const newId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export class SiteRuleError extends Error {
  constructor(readonly code: 'tooMany' | 'invalid') {
    super(code);
  }
}

/**
 * The user's own site rules (content/siteRules.ts) with an in-memory copy: tabs read the hiding rules and blocked
 * domains synchronously; listeners (screens, the WebViews, the network blocker) are told about changes.
 */
export class SiteRuleStore {
  rules: SiteRule[] = [];
  /** For the WebViews; new arrays only when the rules change. */
  page: PageRule[] = [];
  domains: string[] = [];
  version = 0;
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;

  constructor(private getDb: () => Promise<Db>) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;

  private set(rules: SiteRule[]) {
    this.rules = rules;
    this.page = pageRules(rules);
    this.domains = blockedDomains(rules);
    this.version++;
    this.listeners.forEach((l) => l());
  }

  load(): Promise<void> {
    this.loading ??= this.getDb()
      .then(listSiteRules)
      .then((rules) => this.set(rules))
      .catch(() => {});
    return this.loading;
  }

  /** Reads the table again (after a backup was imported). */
  async reload(): Promise<void> {
    this.loading = null;
    await this.load();
  }

  forSite(site: string): SiteRule[] {
    return rulesForSite(this.rules, site);
  }

  /** Adds rule lines (already checked) for a site; a line the site already has is not added twice. */
  async add(site: string, lines: string[], source: RuleSource, url?: string): Promise<SiteRule[]> {
    await this.load();
    const have = new Set(this.rules.map((r) => r.line));
    const fresh = [...new Set(lines.map((l) => l.trim()))].filter((l) => !have.has(l));
    if (fresh.some((l) => !parseRuleLine(l))) throw new SiteRuleError('invalid');
    if (
      this.rules.length + fresh.length > MAX_RULES ||
      this.rules.filter((r) => r.site === site).length + fresh.length > MAX_RULES_PER_SITE
    ) {
      throw new SiteRuleError('tooMany');
    }
    const now = Date.now();
    const added = fresh.map((line, i): SiteRule => ({
      id: newId() + i,
      line,
      enabled: true,
      source,
      site,
      ...(url ? { url } : {}),
      createdAt: now,
    }));
    const db = await this.getDb();
    for (const r of added) {
      await db.runAsync(
        'INSERT INTO site_rules (id, line, enabled, source, site, url, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)',
        [r.id, r.line, r.source, r.site, r.url ?? null, r.createdAt],
      );
    }
    this.set([...this.rules, ...added]);
    return added;
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.load();
    this.set(this.rules.map((r) => (r.id === id ? { ...r, enabled } : r)));
    await (await this.getDb()).runAsync('UPDATE site_rules SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
  }

  /** Replaces a rule's line (a changed scope); the line must be valid. */
  async setLine(id: string, line: string): Promise<void> {
    await this.load();
    if (!parseRuleLine(line)) throw new SiteRuleError('invalid');
    this.set(this.rules.map((r) => (r.id === id ? { ...r, line } : r)));
    await (await this.getDb()).runAsync('UPDATE site_rules SET line = ? WHERE id = ?', [line, id]);
  }

  async remove(ids: string[]): Promise<SiteRule[]> {
    await this.load();
    const gone = this.rules.filter((r) => ids.includes(r.id));
    if (!gone.length) return [];
    this.set(this.rules.filter((r) => !ids.includes(r.id)));
    const db = await this.getDb();
    for (const r of gone) await db.runAsync('DELETE FROM site_rules WHERE id = ?', [r.id]);
    return gone;
  }
}

/** The app's one store (tabs, the assistant and the filter lists screen share it). */
export const siteRules = new SiteRuleStore(getDb);
