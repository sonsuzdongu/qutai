import type { Tab } from '../browser/Tab';
import {
  blockLine,
  checkBlockDomain,
  hideLine,
  judgeMeasure,
  MAX_AREA_SHARE,
  MAX_MATCHES,
  MAX_TEXT_SHARE,
  parseRuleLine,
  ScopeKind,
  scopeForUrl,
  selectorProblem,
  SiteRule,
  TryMeasure,
  TryVerdict,
} from '../content/siteRules';
import { t } from '../i18n';
import type { ToolContext, ToolOutput } from './executeTool';
import { siteKey } from './sitePolicy';
import { uiLabel, uiPath } from './uiLabels';

/**
 * The assistant's site rules (content/siteRules.ts): find the empty boxes ads leave, try hiding them, save rules for
 * the current site (always with the user's approval, which also picks the scope), list and remove them.
 */

const MAX_PER_CALL = 10;

/** The context the tools need: the store and the approval (wired in App.tsx). */
export type SiteRulesAccess = {
  list(): SiteRule[];
  /** url: the page the rules were made on. */
  add(site: string, lines: string[], url: string): Promise<SiteRule[]>;
  remove(ids: string[]): Promise<SiteRule[]>;
  /** Whether hiding and blocking work on this site now (the master switch is on, the site is not an "off" site). */
  activeOn(site: string): boolean;
};

/** What the save dialog shows; it resolves with the scope the user picked, or null when declined. */
export type SiteRulesApproval = {
  site: string;
  url: string;
  hide: string[];
  block: string[];
  incognito: boolean;
};

export function describeSiteRulesCall(name: string, input: Record<string, unknown>): string {
  if (name === 'try_hide') {
    if (input.action === 'find') return t('action.hideFind');
    if (input.action === 'undo') return t('action.hideUndo');
    return t('action.hideTry');
  }
  if (name === 'save_site_rules') return t('action.saveSiteRules');
  return input.action === 'remove' ? t('action.removeSiteRules') : t('action.listSiteRules');
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean) : [];
}

const PROBLEM_TEXT: Record<string, string> = {
  empty: 'empty',
  tooLong: 'too long',
  syntax: 'not a plain CSS selector (no braces, semicolons, @, comments or backslashes)',
  tooBroad:
    'too broad: it must name an id, class or attribute, and must not end in *, html, body or head (it would hide ' +
    'far more than the ad)',
};

const VERDICT_TEXT: Record<Exclude<TryVerdict, { ok: true }>['reason'], string> = {
  invalid: 'the page cannot parse this selector',
  noMatch: 'it matches nothing on this page',
  count: `it matches more than ${MAX_MATCHES} elements`,
  area: `it would hide boxes with text covering more than ${Math.round(MAX_AREA_SHARE * 100)}% of the page's area`,
  text: `it would hide more than ${Math.round(MAX_TEXT_SHARE * 100)}% of the page's text`,
};

function pct(share: number): string {
  return `${Math.round(share * 1000) / 10}%`;
}

/** Selectors checked offline first; the problems go back to the model. */
function checkSelectors(selectors: string[]): { ok: string[]; refused: string[] } {
  const ok: string[] = [];
  const refused: string[] = [];
  for (const s of selectors) {
    const problem = selectorProblem(s);
    if (problem) refused.push(`- ${JSON.stringify(s)}: refused, ${PROBLEM_TEXT[problem]}.`);
    else ok.push(s);
  }
  return { ok, refused };
}

function measureLine(m: TryMeasure, verdict: TryVerdict): string {
  const what = `${m.count} match${m.count === 1 ? '' : 'es'} (${m.visible} visible), ${pct(m.area)} of the page area with text, ${pct(m.text)} of its text`;
  return verdict.ok
    ? `- ${JSON.stringify(m.selector)}: ${what}.`
    : `- ${JSON.stringify(m.selector)}: refused, ${VERDICT_TEXT[verdict.reason]} (${what}).`;
}

function siteOf(tab: Tab): string | null {
  return siteKey(tab.url);
}

type FoundBox = {
  selector: string;
  tag: string;
  width: number;
  height: number;
  top: number;
  adLike: boolean;
  frameSrc?: string;
};

export async function siteRulesTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
  tab: Tab,
): Promise<ToolOutput> {
  const site = siteOf(tab);
  if (!site) return { content: 'Site rules work on web pages (http or https) only.', isError: true };
  const access = ctx.siteRules;
  if (!access) return { content: 'Site rules are not available here.', isError: true };

  if (name === 'try_hide') {
    if (input.action === 'find') {
      const found = await tab.run<{ page: { w: number; h: number }; boxes: FoundBox[] }>('hideFind', [], 8000);
      if (!found.boxes.length) {
        return {
          content:
            'No empty boxes or ad frames found. Read the page or the source (read_source with a selector) for the ' +
            'container around the gap, or look with view_screenshot.',
          isError: false,
        };
      }
      const lines = found.boxes.map(
        (b) =>
          `- ${JSON.stringify(b.selector)} ${b.tag} ${b.width}×${b.height}px at y=${b.top}${b.adLike ? ', looks like an ad' : ''}` +
          (b.frameSrc ? `, frame ${b.frameSrc}` : ''),
      );
      return {
        content:
          `Page ${found.page.w}×${found.page.h}px. Boxes that take room but show nothing:\n${lines.join('\n')}\n` +
          'Suggested selectors may be fragile; prefer a stable id, class or attribute you see in read_source.',
        isError: false,
      };
    }
    if (input.action === 'undo') {
      const result = await tab.run<{ removed: boolean }>('hideUndo', [], 5000);
      return { content: result.removed ? 'The tried selectors are shown again.' : 'Nothing was being tried.', isError: false };
    }
    if (input.action !== 'try') return { content: 'action must be find, try or undo.', isError: true };
    const selectors = strings(input.selectors);
    if (!selectors.length) return { content: 'Give the CSS selectors to try in selectors.', isError: true };
    if (selectors.length > MAX_PER_CALL) return { content: `At most ${MAX_PER_CALL} selectors at a time.`, isError: true };
    const { ok, refused } = checkSelectors(selectors);
    // Measured without hiding first, so over-broad ones never flash off the page.
    const measured = ok.length
      ? await tab.run<{ results: TryMeasure[] }>('hideMeasure', [ok], 8000)
      : { results: [] as TryMeasure[] };
    const lines = [...refused];
    const good: string[] = [];
    for (const m of measured.results) {
      const verdict = judgeMeasure(m);
      lines.push(measureLine(m, verdict));
      if (verdict.ok) good.push(m.selector);
    }
    if (!good.length) {
      await tab.run('hideUndo', [], 5000).catch(() => {});
      return { content: `Nothing hidden.\n${lines.join('\n')}`, isError: true };
    }
    const tried = await tab.run<{ heightBefore: number; heightAfter: number }>('hideTry', [good], 8000);
    const notice = access.activeOn(site)
      ? ''
      : `\nNote: ad blocking is off for ${site} (${offPlace()}), so saved hiding rules would not apply here until it is on.`;
    return {
      content:
        `Hidden on this page for now (not saved): ${good.length} selector${good.length === 1 ? '' : 's'}. Page height ` +
        `${tried.heightBefore}px → ${tried.heightAfter}px.\n${lines.join('\n')}\n` +
        'Check the gap is gone and nothing else disappeared (view_screenshot), then save_site_rules if the user ' +
        `wants it kept, or try_hide undo.${notice}`,
      isError: false,
    };
  }

  if (name === 'save_site_rules') {
    const hide = strings(input.hide);
    const block = strings(input.block_domains);
    if (!hide.length && !block.length) return { content: 'Give selectors in hide and/or domains in block_domains.', isError: true };
    if (hide.length > MAX_PER_CALL || block.length > MAX_PER_CALL)
      return { content: `At most ${MAX_PER_CALL} selectors and ${MAX_PER_CALL} domains at a time.`, isError: true };
    const { ok, refused } = checkSelectors(hide);
    const problems = [...refused];
    const domains: string[] = [];
    for (const raw of block) {
      const checked = checkBlockDomain(raw, site);
      if ('domain' in checked) domains.push(checked.domain);
      else
        problems.push(
          `- ${JSON.stringify(raw)}: refused, ${checked.problem === 'ownSite' ? `that is ${site} itself (blocking it would break the site)` : 'not a domain'}.`,
        );
    }
    if (ok.length) {
      // The same limits as try_hide, measured on the page as it is.
      const measured = await tab.run<{ results: TryMeasure[] }>('hideMeasure', [ok], 8000);
      for (const m of measured.results) {
        const verdict = judgeMeasure(m);
        // Already hidden by a saved rule or the try: no visible match, which is fine to save.
        if (!verdict.ok && !(verdict.reason === 'noMatch' && m.count > 0)) problems.push(measureLine(m, verdict));
      }
    }
    if (problems.length) {
      return { content: `Nothing saved; fix these first (try_hide shows what a selector covers):\n${problems.join('\n')}`, isError: true };
    }
    if (!ctx.confirmSiteRules) return { content: 'Saving needs the user\'s approval, which is not available here.', isError: true };
    const scope = await ctx.confirmSiteRules({ site, url: tab.url, hide: ok, block: domains, incognito: tab.incognito });
    if (!scope) return { content: 'The user did not save the rules. Nothing was saved.', isError: true };
    const lines = linesFor(tab.url, scope, ok, domains);
    if (!lines) return { content: 'This page has no address rules can be saved for.', isError: true };
    const added = await access.add(site, lines, tab.url.replace(/#.*$/, ''));
    await tab.run('hideUndo', [], 5000).catch(() => {});
    return {
      content:
        `Saved ${added.length} rule${added.length === 1 ? '' : 's'}${ok.length ? ` (hiding applies to: ${scope}, chosen by the user)` : ''}${domains.length ? ' (blocked domains: on every site)' : ''}. They apply ` +
        `from now on; the user manages them in ${rulesPlace()}.` +
        (added.length < lines.length ? ' Rules the site already had were not added again.' : ''),
      isError: false,
    };
  }

  // site_rules
  const mine = rulesFor(access.list(), site);
  if (input.action === 'list' || input.action === undefined) {
    if (!mine.length) return { content: `No own rules for ${site}.`, isError: false };
    return {
      content:
        `Own rules for ${site} (${rulesPlace()}):\n` +
        mine.map((r) => `- [${r.id}] ${r.line}${r.enabled ? '' : ' (off)'} (${r.source === 'assistant' ? 'saved by you' : 'added by the user'})`).join('\n'),
      isError: false,
    };
  }
  if (input.action !== 'remove') return { content: 'action must be list or remove.', isError: true };
  const ids = strings(input.ids);
  const targets = mine.filter((r) => ids.includes(r.id));
  if (!targets.length) return { content: `None of these ids is a rule of ${site}; call site_rules list.`, isError: true };
  const allowed = ctx.confirm
    ? await ctx.confirm(
        { lines: [{ icon: 'shield', text: t('siteRules.confirmRemove', { count: targets.length, site }) }, ...targets.map((r) => ({ text: r.line }))] },
        site,
      )
    : false;
  if (!allowed) return { content: 'The user did not remove the rules.', isError: true };
  const removed = await access.remove(targets.map((r) => r.id));
  return { content: `Removed ${removed.length} rule${removed.length === 1 ? '' : 's'} of ${site}.`, isError: false };
}

/** The rules listed under the current site: its own, and hiding rules from a parent site that cover it. */
function rulesFor(rules: SiteRule[], site: string): SiteRule[] {
  return rules.filter((r) => {
    if (r.site === site) return true;
    const parsed = parseRuleLine(r.line);
    return parsed?.kind === 'hide' && parsed.scope.kind === 'subdomains' && site.endsWith(`.${parsed.scope.host}`);
  });
}

/** The rule lines to save; null when the address has no site. */
export function linesFor(url: string, scope: ScopeKind, selectors: string[], domains: string[]): string[] | null {
  const target = scopeForUrl(url, scope);
  if (!target) return null;
  return [...selectors.map((s) => hideLine(target, s)), ...domains.map(blockLine)];
}

function rulesPlace(): string {
  return uiPath('settings.title', 'settings.privacySection', 'settings.filterLists', 'siteRules.title');
}

function offPlace(): string {
  return `${uiLabel('site.blockingTitle')} in ${uiLabel('site.title')}`;
}
