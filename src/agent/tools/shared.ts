import type { Tab } from '../../browser/Tab';
import { Platform } from 'react-native';
import { t } from '../../i18n';
import { uiLabel, uiPath } from '../uiLabels';
import { errorNotice } from '../stepLine';
import { sleep } from '../../utils/sleep';
import { siteKey } from '../../utils/webUrl';
import { HiddenNeedle, hiddenNeedles } from '../hiddenValues';
import { withScheme } from '../toolTable';
import type { ToolContext, ToolOutput } from '../executeTool';

/**
 * Helpers the tool modules share (src/agent/executeTool.ts runs the calls): the tab a call works in, the tab list,
 * snapshot types of the page script, and the wording of cards and settings the results name.
 */

/** The current hidden memories as search patterns; empty without memory or hidden memories (no scan then). */
export async function hiddenNeedlesFor(ctx: ToolContext): Promise<HiddenNeedle[]> {
  if (!ctx.memory) return [];
  const memories = await ctx.memory.list();
  return memories.some((m) => m.sensitive) ? hiddenNeedles(memories) : [];
}

export type PageSnapshot = {
  url: string;
  title: string;
  scroll: { y: number; viewportHeight: number; pageHeight: number };
  truncated: boolean;
  nextOffset: number | null;
  content: string;
  /** Invalid form fields on the page ("ref=N "label": reason"); empty without errors. */
  formErrors?: string[];
};

export type SourceSnapshot = {
  url: string;
  title: string;
  /** Length of the whole source (or of the selected elements) in characters. */
  total: number;
  /** How many elements matched the selector; null when the whole page was read. */
  matches: number | null;
  offset: number;
  truncated: boolean;
  nextOffset: number | null;
  content: string;
};

/** Memory is off: the setting by its on-screen name and where it is. */
export function memoryOff(rest: string): string {
  return (
    `Memory is turned off (${uiLabel('settings.memoryEnabled')} in ${uiPath('settings.title', 'settings.assistant')})` +
    rest
  );
}

/** The WebView cannot show view-source: pages; the model is pointed to read_source instead. */
export function isViewSource(raw: unknown): boolean {
  return /^\s*view-source:/i.test(String(raw ?? ''));
}

export const normalizeUrl = withScheme;

/** Thrown when a call needs the assistant's tab and the user closed it (executeUnredacted answers before that). */
export class AgentTabClosedError extends Error {}

/**
 * The assistant's tab. When the user closed it, the call fails (tabClosed) instead of acting on whichever tab is on
 * screen with element numbers from the closed page.
 */
export function currentTab(ctx: ToolContext): Tab {
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  if (tab) return tab;
  throw new AgentTabClosedError();
}

/** The tool error for a call that needs the assistant's tab after the user closed it. */
export function tabClosed(ctx: ToolContext): ToolOutput {
  return {
    content:
      `The tab you were working in (id=${ctx.agentTab.id}) was closed, so nothing was done: element numbers (ref) from ` +
      "its page don't apply to any other tab. Call list_tabs, then switch_tab to the tab to work in and read_page " +
      'there before clicking or typing, or open_tab to open a page.',
    isError: true,
    notice: errorNotice(t('step.tabClosed')),
  };
}

/** Screenshots can only be taken of the tab on screen, so bring the agent's tab to the front first. */
export async function showTab(ctx: ToolContext, tab: Tab) {
  if (ctx.browser.activeId === tab.id) return;
  ctx.browser.switchTab(tab.id);
  await sleep(400, ctx.signal);
}

/** Tabs the agent opened during a task, keyed by that task's agentTab object. */
export const openedByTask = new WeakMap<object, Set<string>>();

export function noteOpened(ctx: ToolContext, tabId: string) {
  const opened = openedByTask.get(ctx.agentTab) ?? new Set<string>();
  opened.add(tabId);
  openedByTask.set(ctx.agentTab, opened);
}

/**
 * The open tabs for the model. In a normal conversation an incognito tab is listed without its title and address
 * (INC-2: nothing of an incognito tab is written to disk or the sent log); reading or switching to it makes the
 * conversation incognito first. A tab on a site the user set to Blocked is listed by its site only: its title is the
 * page's own text and its address may say what the user is doing there, and Qutai reads nothing of a Blocked site
 * (SITE-4, SITE-28).
 */
export function tabList(ctx: ToolContext): string {
  const opened = openedByTask.get(ctx.agentTab);
  const incognitoChat = isIncognitoConversation(ctx);
  return ctx.browser.tabs
    .map((t) => {
      const group = ctx.browser.getGroup(t.groupId);
      const marks = [
        t.incognito && 'incognito',
        group && `group "${group.name}" group_id=${group.id}`,
        opened?.has(t.id) && 'opened by you in this task',
        t.id === ctx.agentTab.id && 'you are here',
        t.id === ctx.browser.activeId && 'visible to user',
      ]
        .filter(Boolean)
        .join(', ');
      const page = t.isNewTab
        ? 'new tab page (no web page)'
        : t.incognito && !incognitoChat
          ? '(title and address not shown in a normal conversation; read_tab or switch_tab makes it incognito)'
          : (blockedSite(ctx, t.url) ?? `"${t.title || '(no title)'}" ${t.url}`);
      return `- id=${t.id} ${page}${marks ? ` (${marks})` : ''}`;
    })
    .join('\n');
}

/**
 * What the model is told instead of a tab's title and address when the user set its site to Blocked; null for any
 * other tab.
 */
export function blockedSite(ctx: ToolContext, url: string): string | null {
  const host = siteKey(url);
  if (!host || ctx.sites?.levelFor(host) !== 'blocked') return null;
  return `${host} (the user blocked Qutai on this site: its title and address are not shown, and it can't be read or used)`;
}

/** The conversation already involves incognito tabs (its agent's tab is one, or it touched one). */
export function isIncognitoConversation(ctx: ToolContext): boolean {
  return !!(ctx.privacy?.touchedIncognito || ctx.browser.getTab(ctx.agentTab.id)?.incognito);
}

/** The buttons on a save_file card, as the card shows them on this platform (AssistantPanel FileCard). */
export function fileButtons(): string {
  return Platform.OS === 'ios'
    ? `a ${uiLabel('chat.fileShareIos')} button`
    : `${uiLabel('chat.fileSave')} and ${uiLabel('chat.fileShare')} buttons`;
}

/** The buttons on a PDF card (AssistantPanel PdfCard), as the card shows them on this platform. */
export function pdfButtons(): string {
  return Platform.OS === 'ios' ? `a ${uiLabel('chat.fileShareIos')} button` : `${uiLabel('chat.fileSave')} and ${uiLabel('chat.fileShare')} buttons`;
}
