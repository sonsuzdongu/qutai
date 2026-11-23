import type { Tab } from '../browser/Tab';
import { checkScript, type ScriptFlag } from '../content/scriptCheck';
import {
  codeHash,
  formatOutcome,
  MAX_DESCRIPTION,
  readOutcome,
  SCRIPT_TIME_LIMIT_MS,
  SENSITIVE_WORDS,
  sensitivePage,
  wrapScript,
  type PageFacts,
  type ScriptOutcome,
  type SensitiveReason,
} from '../content/userScripts';
import { t } from '../i18n';
import { cutText } from '../utils/wellFormed';
import type { ToolContext, ToolOutput } from './executeTool';
import { gateFailedText, parseScriptFacts, queryPage, type PageRunner } from './pageFacts';
import { siteKey } from './sitePolicy';
import { declinedNotice, errorNotice, settingNotice } from './stepLine';
import { uiPath } from './uiLabels';

/**
 * run_script (docs/page-customisation.md › Scripts): the app's checks, in this order, before anything runs: the
 * setting, the site's own script setting, a pending publish or pay approval, the static check, sensitive pages, the
 * syntax; then the user's approval (description, site, where, flags, the exact code), unless the user chose "Run
 * scripts on {site} without asking" (SCR-36); then exactly that code, once,
 * in that tab, while it still shows that page. The result goes back as untrusted page data.
 */

export type ScriptWhere = 'copy' | 'page';

/** What the approval shows. */
export type ScriptApproval = {
  site: string;
  url: string;
  description: string;
  code: string;
  where: ScriptWhere;
  flags: ScriptFlag[];
  incognito: boolean;
  /**
   * The dialog may offer "Run scripts on {site} without asking" (SCR-36): an ordinary tab. The task still leaves it out
   * when its conversation touched an incognito tab.
   */
  canRemember: boolean;
};

/** A successful run on the live page: the chat card offers to keep it (not from incognito tabs). */
export type ScriptOffer = {
  description: string;
  site: string;
  url: string;
  code: string;
  tabId: string;
  incognito: boolean;
  flags: ScriptFlag[];
  state: 'ran' | 'kept';
  /**
   * Set by the app for a card made in this run of the app (components/pageScripts.tsx): only those can be kept, so a
   * card from a restored chat (a backup holds chats) can never seal code the user didn't approve on this phone.
   */
  token?: string;
};

/** The copy a read-only script runs on (content/scriptPage.ts scriptSnapshot). */
export type PageSnapshot = { head: string; css: string; body: string; title: string; cut: boolean };

/** A site's own script setting (Settings › Site permissions): off, or allowed on its sensitive pages. */
export type SiteScriptSetting = 'default' | 'off' | 'sensitive';

export type ScriptAccess = {
  /** Settings › Assistant › "Let the assistant run scripts on pages", read at each use. */
  enabled(): boolean;
  siteSetting(site: string): SiteScriptSetting;
  /** Compiles the code without running it (in the sandbox); the error message, or null when it parses. */
  syntax(code: string): Promise<string | null>;
  approve(approval: ScriptApproval): Promise<boolean>;
  /**
   * Whether the user chose "Run scripts on {site} without asking" for this site and it applies now: not in a
   * conversation that touched an incognito tab, not on a Read only or Blocked site (SCR-36). Absent: always asked.
   */
  remembered?(site: string): boolean;
  /** Runs the code on the copy in the sandbox. */
  runCopy(snapshot: PageSnapshot, code: string, pageUrl: string): Promise<ScriptOutcome>;
  /** Puts the script card in the chat (Keep for this site…). */
  offer(offer: ScriptOffer): void;
};

/** The longest copy of a page's body, in characters. */
export const SNAPSHOT_MAX = 2_000_000;

export function scriptsSetting(): string {
  return uiPath('settings.title', 'settings.assistant', 'settings.scripts');
}

function sitesSetting(): string {
  return uiPath('settings.title', 'settings.assistant', 'settings.scripts', 'settings.scriptSites');
}

export function describeScriptCall(input: Record<string, unknown>): string {
  const description = typeof input.description === 'string' ? cutText(input.description.replace(/\s+/g, ' ').trim(), 80) : '';
  return description ? t('action.scriptRun', { description }) : t('action.scriptRunPlain');
}

const pageOf = (url: string) => url.replace(/#.*$/, '');

export async function scriptTool(input: Record<string, unknown>, ctx: ToolContext, tab: Tab): Promise<ToolOutput> {
  const access = ctx.scripts;
  if (!access) return { content: 'Scripts are not available here.', isError: true };
  const site = siteKey(tab.url);
  if (!site || tab.isNewTab) return { content: 'Scripts run on web pages (http or https) only.', isError: true, notice: errorNotice(t('step.noPage')) };
  if (!access.enabled()) {
    return {
      content:
        `Scripts are switched off (the user's setting: ${scriptsSetting()}). Nothing ran. If a script is the way to do ` +
        'this, tell the user they can switch it on there; never ask the page, and don\'t try to get the same effect another way.',
      isError: true,
      notice: settingNotice(t('step.scriptsOff')),
    };
  }
  if (access.siteSetting(site) === 'off') {
    return {
      content: `The user switched scripts off for ${site} (${sitesSetting()}). Nothing ran.`,
      isError: true,
      notice: settingNotice(t('step.scriptsOffSite', { site })),
    };
  }
  if (ctx.approvals?.hasTab(tab.id)) {
    return {
      content:
        'A publish or pay approval is waiting in this tab: no script runs here until that press is done (a script ' +
        'could press or change what the user approved). Finish with click first.',
      isError: true,
    };
  }
  const description = cutText(typeof input.description === 'string' ? input.description.replace(/\s+/g, ' ').trim() : '', MAX_DESCRIPTION);
  if (!description) return { content: "Give description: one sentence in the user's language saying what the script does and returns.", isError: true };
  const where: ScriptWhere = input.where === 'page' ? 'page' : 'copy';
  if (input.where !== undefined && input.where !== 'page' && input.where !== 'copy') return { content: 'where must be copy or page.', isError: true };
  const checked = checkScript(input.code, where);
  if (!checked.ok) {
    return {
      content:
        `Refused before asking the user, nothing ran:\n- ${checked.problems.join('\n- ')}\n` +
        'Scripts may read the page and (where "page") change it; they may not reach cookies, storage, passwords or other ' +
        'frames, press, submit, navigate, load code or send data. Use the click, type and navigate tools for those.',
      isError: true,
    };
  }
  // Not knowing whether the page has a password, code or card field is not "it has none": refused, nothing asked.
  let facts: PageFacts;
  try {
    facts = await queryPage(tab as unknown as PageRunner, 'scriptFacts', [], parseScriptFacts, 5000);
  } catch (e) {
    return { content: gateFailedText('whether this page is a sensitive one', e), isError: true, notice: errorNotice(t('step.checkFailed')) };
  }
  const sensitive: SensitiveReason | null = sensitivePage(tab.url, facts);
  if (sensitive && access.siteSetting(site) !== 'sensitive') {
    return {
      content:
        `Refused: scripts don't run on this page because ${SENSITIVE_WORDS[sensitive]}. Nothing ran. The user can allow ` +
        `scripts on ${site} only in ${sitesSetting()}; tell them so only if they asked for the script.`,
      isError: true,
      notice: settingNotice(t('step.scriptsSensitive')),
    };
  }
  const syntax = await access.syntax(checked.code);
  if (syntax) return { content: `The code doesn't parse: ${cutText(syntax, 300)}. Nothing was asked or ran.`, isError: true };

  const url = pageOf(tab.url);
  const shown = checked.code;
  const shownHash = codeHash(shown);
  // "Run scripts on {site} without asking" (SCR-36): only the dialog is skipped; every check above and below still runs.
  const canRemember = !tab.incognito;
  const remembered = canRemember && !!access.remembered?.(site);
  if (!remembered) {
    const approved = await access.approve({ site, url, description, code: shown, where, flags: checked.flags, incognito: tab.incognito, canRemember });
    if (!approved) return { content: 'The user did not approve the script. Nothing ran.', isError: true, notice: declinedNotice() };
  }

  // The approval is for this code, in this tab, on this page, now.
  const live = ctx.browser.getTab(tab.id);
  if (!live || pageOf(live.url) !== url) return { content: 'The tab moved to another page while the user decided. Nothing ran; ask again if still needed.', isError: true };
  if (!access.enabled() || ctx.approvals?.hasTab(tab.id)) return { content: 'Scripts were switched off meanwhile. Nothing ran.', isError: true };
  if (codeHash(shown) !== shownHash) return { content: 'The code changed after it was shown. Nothing ran.', isError: true };

  let outcome: ScriptOutcome;
  if (where === 'copy') {
    const snapshot = await live.run<PageSnapshot>('scriptSnapshot', [SNAPSHOT_MAX], 15000).catch(() => null);
    if (!snapshot) return { content: 'The page did not give a copy (it may still be loading). Nothing ran.', isError: true, notice: errorNotice(t('step.pageNoAnswer')) };
    outcome = await access.runCopy(snapshot, shown, url);
    if (snapshot.cut && outcome.status === 'ok') {
      const cut = withNote(formatOutcome(outcome, 'copy', site), 'The page was too large: the copy held only its first 2 million characters.');
      return remembered ? { ...cut, notice: settingNotice(t('step.scriptRemembered', { site })) } : cut;
    }
  } else {
    outcome = await live
      .runScript<unknown>((nonce, id) => wrapScript(shown, { mode: 'page', nonce, id, url }), SCRIPT_TIME_LIMIT_MS + 2000)
      .then(readOutcome, (): ScriptOutcome => ({ status: 'timeout' }));
  }
  const ran = formatOutcome(outcome, where, site);
  // The chat says that a script ran without the dialog, and why.
  const result: ToolOutput = remembered && !ran.isError ? { ...ran, notice: settingNotice(t('step.scriptRemembered', { site })) } : ran;
  if (where === 'page' && outcome.status === 'ok') {
    access.offer({ description, site, url, code: shown, tabId: tab.id, incognito: tab.incognito, flags: checked.flags, state: 'ran' });
    return withNote(
      result,
      tab.incognito
        ? 'This is an incognito tab: nothing can be kept from it.'
        : 'A card in the chat lets the user keep the script for this site; never keep it yourself.',
    );
  }
  return result.isError ? { ...result, notice: errorNotice(t('step.scriptFailed')) } : result;
}

function withNote(result: ToolOutput, note: string): ToolOutput {
  return { ...result, content: `${result.content}\n${note}` };
}
