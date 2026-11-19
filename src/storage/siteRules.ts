import {
  blockedDomains,
  ImportedRule,
  MAX_RULES,
  MAX_RULES_PER_SITE,
  PageRule,
  pageRules,
  parseRuleLine,
  RuleSource,
  rulesForSite,
  SiteRule,
} from '../content/siteRules';
import {
  cleanStyleName,
  MAX_STYLES,
  MAX_STYLES_PER_SITE,
  PageStyle,
  pageStyles,
  parseStyleScope,
  UserStyle,
} from '../content/userStyles';
import { sanitizeCss } from '../content/userCss';
import { checkScript } from '../content/scriptCheck';
import {
  cleanScriptName,
  isScriptRunAt,
  MAX_SCRIPTS,
  MAX_SCRIPTS_PER_SITE,
  parseScriptScope,
  type ScriptLastRun,
  type ScriptRunAt,
  type UserScript,
} from '../content/userScripts';
import type { ImportedStyle } from '../content/rulesFile';
import { Db, getDb } from './db';

/** Rows of the site_rules table (storage/db.ts). */
type Row = { id: string; line: string; enabled: number; source: string; site: string; url: string | null; created_at: number };

export async function listSiteRules(db: Db): Promise<SiteRule[]> {
  const rows = await db.getAllAsync<Row>(
    "SELECT id, line, enabled, source, site, url, created_at FROM site_rules WHERE kind = 'filter' ORDER BY site, created_at",
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

type StyleRow = Row & { name: string | null; body: string | null };

/** The user styles (kind 'style'); a row whose scope or CSS no longer passes the checks is left out. */
export async function listUserStyles(db: Db): Promise<UserStyle[]> {
  const rows = await db.getAllAsync<StyleRow>(
    "SELECT id, line, enabled, source, site, url, created_at, name, body FROM site_rules WHERE kind = 'style' ORDER BY site, created_at",
    [],
  );
  return rows.flatMap((r) => {
    const scope = parseStyleScope(r.line);
    if (!scope || !r.body) return [];
    return [
      {
        id: r.id,
        name: cleanStyleName(r.name) || r.line,
        scope: r.line,
        css: r.body,
        enabled: r.enabled !== 0,
        source: r.source === 'assistant' ? 'assistant' : 'manual',
        site: r.site,
        ...(r.url ? { url: r.url } : {}),
        createdAt: r.created_at,
      } satisfies UserStyle,
    ];
  });
}

type ScriptRow = StyleRow & { meta: string | null };

/** A kept script's meta column: run time, the approval seal and the last run (status only). */
type ScriptMeta = { runAt?: unknown; seal?: unknown; lastRun?: unknown };

function readLastRun(value: unknown): ScriptLastRun | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as Record<string, unknown>;
  if (typeof r.at !== 'number' || !['ok', 'error', 'timeout', 'skipped'].includes(String(r.status))) return undefined;
  return { at: r.at, status: r.status as ScriptLastRun['status'], ...(typeof r.error === 'string' ? { error: r.error.slice(0, 40) } : {}) };
}

export function scriptMeta(s: Pick<UserScript, 'runAt' | 'seal' | 'lastRun'>): string {
  return JSON.stringify({ runAt: s.runAt, seal: s.seal, ...(s.lastRun ? { lastRun: s.lastRun } : {}) });
}

/** The kept scripts (kind 'script'); a row whose scope is no longer valid is left out. The code is checked when run. */
export async function listUserScripts(db: Db): Promise<UserScript[]> {
  const rows = await db.getAllAsync<ScriptRow>(
    "SELECT id, line, enabled, source, site, url, created_at, name, body, meta FROM site_rules WHERE kind = 'script' ORDER BY site, created_at",
    [],
  );
  return rows.flatMap((r) => {
    if (!parseScriptScope(r.line) || !r.body) return [];
    let meta: ScriptMeta = {};
    try {
      const parsed = r.meta ? JSON.parse(r.meta) : null;
      if (parsed && typeof parsed === 'object') meta = parsed;
    } catch {
      meta = {};
    }
    return [
      {
        id: r.id,
        name: cleanScriptName(r.name) || r.line,
        scope: r.line,
        code: r.body,
        runAt: isScriptRunAt(meta.runAt) ? meta.runAt : 'end',
        enabled: r.enabled !== 0,
        seal: typeof meta.seal === 'string' ? meta.seal : null,
        source: r.source === 'assistant' ? 'assistant' : 'manual',
        site: r.site,
        ...(r.url ? { url: r.url } : {}),
        createdAt: r.created_at,
        ...(readLastRun(meta.lastRun) ? { lastRun: readLastRun(meta.lastRun) } : {}),
      } satisfies UserScript,
    ];
  });
}

const newId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export class SiteRuleError extends Error {
  constructor(readonly code: 'tooMany' | 'invalid' | 'css' | 'script') {
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
  /** The user styles (content/userStyles.ts), and the enabled ones for the WebViews (new arrays only on changes). */
  styles: UserStyle[] = [];
  pageStyles: PageStyle[] = [];
  /** The kept scripts (content/userScripts.ts); new arrays only on changes. */
  scripts: UserScript[] = [];
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

  private setScripts(scripts: UserScript[]) {
    this.scripts = scripts;
    this.version++;
    this.listeners.forEach((l) => l());
  }

  private setStyles(styles: UserStyle[]) {
    this.styles = styles;
    this.pageStyles = pageStyles(styles);
    this.version++;
    this.listeners.forEach((l) => l());
  }

  load(): Promise<void> {
    this.loading ??= this.getDb()
      .then(async (db) => {
        const [rules, styles, scripts] = await Promise.all([
          listSiteRules(db),
          listUserStyles(db).catch(() => [] as UserStyle[]),
          listUserScripts(db).catch(() => [] as UserScript[]),
        ]);
        this.styles = styles;
        this.scripts = scripts;
        this.pageStyles = pageStyles(styles);
        this.set(rules);
      })
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

  /**
   * Adds rules read from an export file (already checked, duplicates removed) as the user's own, each with its switch.
   * Rules past the limits (MAX_RULES in all, MAX_RULES_PER_SITE per site) are left out; returns how many were added.
   */
  async addImported(entries: ImportedRule[]): Promise<number> {
    await this.load();
    const have = new Set(this.rules.map((r) => r.line));
    const perSite = new Map<string, number>();
    for (const r of this.rules) perSite.set(r.site, (perSite.get(r.site) ?? 0) + 1);
    const now = Date.now();
    const added: SiteRule[] = [];
    for (const [i, e] of entries.entries()) {
      if (have.has(e.line) || !parseRuleLine(e.line)) continue;
      const count = perSite.get(e.site) ?? 0;
      if (this.rules.length + added.length >= MAX_RULES || count >= MAX_RULES_PER_SITE) continue;
      have.add(e.line);
      perSite.set(e.site, count + 1);
      added.push({ id: newId() + i, line: e.line, enabled: e.enabled, source: 'manual', site: e.site, createdAt: now });
    }
    const db = await this.getDb();
    for (const r of added) {
      await db.runAsync(
        'INSERT INTO site_rules (id, line, enabled, source, site, url, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
        [r.id, r.line, r.enabled ? 1 : 0, r.source, r.site, r.createdAt],
      );
    }
    if (added.length) this.set([...this.rules, ...added]);
    return added.length;
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

  // ---------- User styles ----------

  /** Checks a style's CSS and name; throws SiteRuleError('css') when the CSS is refused. */
  private checked(css: string): string {
    const result = sanitizeCss(css);
    if (!result.ok) throw new SiteRuleError('css');
    return result.css;
  }

  /** Keeps a style (the CSS is sanitised again); site: where it is listed; url: the page it was made on. */
  async addStyle(entry: { name: string; scope: string; css: string; site: string; source: RuleSource; url?: string }): Promise<UserStyle> {
    await this.load();
    const scope = parseStyleScope(entry.scope);
    if (!scope) throw new SiteRuleError('invalid');
    const css = this.checked(entry.css);
    if (this.styles.length >= MAX_STYLES || this.styles.filter((s) => s.site === entry.site).length >= MAX_STYLES_PER_SITE) {
      throw new SiteRuleError('tooMany');
    }
    const style: UserStyle = {
      id: newId(),
      name: cleanStyleName(entry.name) || entry.scope,
      scope: entry.scope.trim(),
      css,
      enabled: true,
      source: entry.source,
      site: entry.site,
      ...(entry.url ? { url: entry.url } : {}),
      createdAt: Date.now(),
    };
    await (await this.getDb()).runAsync(
      "INSERT INTO site_rules (id, line, enabled, source, site, url, created_at, kind, name, body) VALUES (?, ?, 1, ?, ?, ?, ?, 'style', ?, ?)",
      [style.id, style.scope, style.source, style.site, style.url ?? null, style.createdAt, style.name, style.css],
    );
    this.setStyles([...this.styles, style]);
    return style;
  }

  /** Changes a style's name, CSS (sanitised again), scope or switch. */
  async updateStyle(id: string, patch: Partial<Pick<UserStyle, 'name' | 'css' | 'scope' | 'enabled'>>): Promise<void> {
    await this.load();
    const style = this.styles.find((s) => s.id === id);
    if (!style) return;
    const next: UserStyle = { ...style };
    if (patch.name !== undefined) next.name = cleanStyleName(patch.name) || style.name;
    if (patch.css !== undefined) next.css = this.checked(patch.css);
    if (patch.scope !== undefined) {
      if (!parseStyleScope(patch.scope)) throw new SiteRuleError('invalid');
      next.scope = patch.scope.trim();
    }
    if (patch.enabled !== undefined) next.enabled = patch.enabled;
    this.setStyles(this.styles.map((s) => (s.id === id ? next : s)));
    await (await this.getDb()).runAsync('UPDATE site_rules SET name = ?, body = ?, line = ?, enabled = ? WHERE id = ?', [
      next.name,
      next.css,
      next.scope,
      next.enabled ? 1 : 0,
      id,
    ]);
  }

  async removeStyles(ids: string[]): Promise<UserStyle[]> {
    await this.load();
    const gone = this.styles.filter((s) => ids.includes(s.id));
    if (!gone.length) return [];
    this.setStyles(this.styles.filter((s) => !ids.includes(s.id)));
    const db = await this.getDb();
    for (const s of gone) await db.runAsync('DELETE FROM site_rules WHERE id = ?', [s.id]);
    return gone;
  }

  /** Adds styles read from a rules file (already checked and without duplicates), switched on or off as chosen. */
  async addImportedStyles(entries: ImportedStyle[], enabled: boolean): Promise<number> {
    await this.load();
    let added = 0;
    const perSite = new Map<string, number>();
    for (const s of this.styles) perSite.set(s.site, (perSite.get(s.site) ?? 0) + 1);
    const fresh: UserStyle[] = [];
    const now = Date.now();
    for (const [i, e] of entries.entries()) {
      const count = perSite.get(e.site) ?? 0;
      if (this.styles.length + fresh.length >= MAX_STYLES || count >= MAX_STYLES_PER_SITE) continue;
      const css = sanitizeCss(e.css);
      if (!css.ok || !parseStyleScope(e.scope)) continue;
      perSite.set(e.site, count + 1);
      fresh.push({
        id: newId() + i,
        name: cleanStyleName(e.name) || e.scope,
        scope: e.scope,
        css: css.css,
        enabled: enabled && e.enabled,
        source: 'manual',
        site: e.site,
        createdAt: now,
      });
    }
    const db = await this.getDb();
    for (const s of fresh) {
      await db.runAsync(
        "INSERT INTO site_rules (id, line, enabled, source, site, url, created_at, kind, name, body) VALUES (?, ?, ?, ?, ?, NULL, ?, 'style', ?, ?)",
        [s.id, s.scope, s.enabled ? 1 : 0, s.source, s.site, s.createdAt, s.name, s.css],
      );
      added++;
    }
    if (fresh.length) this.setStyles([...this.styles, ...fresh]);
    return added;
  }

  // ---------- Kept scripts ----------

  private checkedScript(code: string): string {
    const result = checkScript(code, 'kept');
    if (!result.ok) throw new SiteRuleError('script');
    return result.code;
  }

  /**
   * Keeps a script; `seal` is the device's seal of the code the user approved (null: kept unapproved, switched off).
   * Never called for an incognito tab (the callers refuse first).
   */
  async addScript(entry: {
    name: string;
    scope: string;
    code: string;
    runAt: ScriptRunAt;
    site: string;
    source: RuleSource;
    seal: string | null;
    url?: string;
  }): Promise<UserScript> {
    await this.load();
    if (!parseScriptScope(entry.scope)) throw new SiteRuleError('invalid');
    const code = this.checkedScript(entry.code);
    if (this.scripts.length >= MAX_SCRIPTS || this.scripts.filter((s) => s.site === entry.site).length >= MAX_SCRIPTS_PER_SITE) {
      throw new SiteRuleError('tooMany');
    }
    const script: UserScript = {
      id: newId(),
      name: cleanScriptName(entry.name) || entry.scope,
      scope: entry.scope.trim(),
      code,
      runAt: entry.runAt,
      enabled: !!entry.seal,
      seal: entry.seal,
      source: entry.source,
      site: entry.site,
      ...(entry.url ? { url: entry.url } : {}),
      createdAt: Date.now(),
    };
    await (await this.getDb()).runAsync(
      "INSERT INTO site_rules (id, line, enabled, source, site, url, created_at, kind, name, body, meta) VALUES (?, ?, ?, ?, ?, ?, ?, 'script', ?, ?, ?)",
      [script.id, script.scope, script.enabled ? 1 : 0, script.source, script.site, script.url ?? null, script.createdAt, script.name, script.code, scriptMeta(script)],
    );
    this.setScripts([...this.scripts, script]);
    return script;
  }

  /**
   * Changes a kept script. New code must come with its new seal (the user approved it) or null (then the script is
   * switched off until approved). Switching on needs a seal that the caller has checked matches the code.
   */
  async updateScript(
    id: string,
    patch: Partial<Pick<UserScript, 'name' | 'scope' | 'runAt' | 'enabled' | 'seal' | 'lastRun'>> & { code?: string },
  ): Promise<void> {
    await this.load();
    const script = this.scripts.find((s) => s.id === id);
    if (!script) return;
    const next: UserScript = { ...script };
    if (patch.name !== undefined) next.name = cleanScriptName(patch.name) || script.name;
    if (patch.scope !== undefined) {
      if (!parseScriptScope(patch.scope)) throw new SiteRuleError('invalid');
      next.scope = patch.scope.trim();
    }
    if (patch.runAt !== undefined && isScriptRunAt(patch.runAt)) next.runAt = patch.runAt;
    if (patch.code !== undefined && patch.code !== script.code) {
      next.code = this.checkedScript(patch.code);
      next.seal = patch.seal ?? null;
      delete next.lastRun;
      if (!next.seal) next.enabled = false;
    } else if (patch.seal !== undefined) {
      next.seal = patch.seal;
    }
    if (patch.enabled !== undefined) next.enabled = patch.enabled && !!next.seal;
    if (patch.lastRun !== undefined) next.lastRun = patch.lastRun;
    this.setScripts(this.scripts.map((s) => (s.id === id ? next : s)));
    await (await this.getDb()).runAsync('UPDATE site_rules SET name = ?, body = ?, line = ?, enabled = ?, meta = ? WHERE id = ?', [
      next.name,
      next.code,
      next.scope,
      next.enabled ? 1 : 0,
      scriptMeta(next),
      id,
    ]);
  }

  async removeScripts(ids: string[]): Promise<UserScript[]> {
    await this.load();
    const gone = this.scripts.filter((s) => ids.includes(s.id));
    if (!gone.length) return [];
    this.setScripts(this.scripts.filter((s) => !ids.includes(s.id)));
    const db = await this.getDb();
    for (const s of gone) await db.runAsync('DELETE FROM site_rules WHERE id = ?', [s.id]);
    return gone;
  }

  /** Adds scripts read from a rules file: always switched off and unapproved (each is approved before its first run). */
  async addImportedScripts(entries: { name: string; scope: string; code: string; runAt: ScriptRunAt; site: string }[]): Promise<number> {
    await this.load();
    const have = new Set(this.scripts.map((s) => `${s.scope}\n${s.code}`));
    const perSite = new Map<string, number>();
    for (const s of this.scripts) perSite.set(s.site, (perSite.get(s.site) ?? 0) + 1);
    const fresh: UserScript[] = [];
    const now = Date.now();
    for (const [i, e] of entries.entries()) {
      const count = perSite.get(e.site) ?? 0;
      if (this.scripts.length + fresh.length >= MAX_SCRIPTS || count >= MAX_SCRIPTS_PER_SITE) continue;
      if (!parseScriptScope(e.scope) || !checkScript(e.code, 'kept').ok || have.has(`${e.scope}\n${e.code}`)) continue;
      have.add(`${e.scope}\n${e.code}`);
      perSite.set(e.site, count + 1);
      fresh.push({
        id: newId() + i,
        name: cleanScriptName(e.name) || e.scope,
        scope: e.scope,
        code: e.code,
        runAt: e.runAt,
        enabled: false,
        seal: null,
        source: 'manual',
        site: e.site,
        createdAt: now,
      });
    }
    const db = await this.getDb();
    for (const s of fresh) {
      await db.runAsync(
        "INSERT INTO site_rules (id, line, enabled, source, site, url, created_at, kind, name, body, meta) VALUES (?, ?, 0, ?, ?, NULL, ?, 'script', ?, ?, ?)",
        [s.id, s.scope, s.source, s.site, s.createdAt, s.name, s.code, scriptMeta(s)],
      );
    }
    if (fresh.length) this.setScripts([...this.scripts, ...fresh]);
    return fresh.length;
  }
}

/** The app's one store (tabs, the assistant and the filter lists screen share it). */
export const siteRules = new SiteRuleStore(getDb);
