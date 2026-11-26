import type { Tab } from '../../browser/Tab';
import { t } from '../../i18n';
import { errorNotice, pageErrorNotice } from '../stepLine';
import { sleep } from '../../utils/sleep';
import { type PageSnapshot, blockedSite, normalizeUrl, noteOpened, tabList } from './shared';
import { formatPage } from './page';
import type { ToolContext, ToolOutput } from '../executeTool';

/**
 * The tab tools: listing, opening, switching, reading and closing tabs, notes and waiting. They work without the
 * assistant's tab, which the user may have closed.
 */

/** Reads another tab in the background, without bringing it to the front or moving the agent there. */
export async function readTab(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutput> {
  const target = ctx.browser.getTab(String(input.tab_id ?? ''));
  if (!target) return { content: `No tab with id=${String(input.tab_id)}.\n${tabList(ctx)}`, isError: true };
  if (target.incognito && ctx.privacy) ctx.privacy.touchedIncognito = true;
  if (target.isNewTab)
    return {
      content: `Tab ${target.id} shows the new tab page; no web page is loaded.`,
      isError: true,
      notice: errorNotice(t('step.noPage')),
    };
  try {
    if (target.asleep) {
      // A sleeping tab gets its WebView back off screen; the page loads from its saved address.
      const loaded = target.waitForNextLoad(undefined, ctx.signal);
      target.wake();
      await loaded;
    }
    const page = await target.run<PageSnapshot>('readPage', [input.offset ?? 0], undefined, ctx.signal);
    ctx.outbound?.notePage(page.content, page.url);
    const hint =
      target.id === ctx.agentTab.id
        ? ''
        : '\n[Read only. To click or type here, call switch_tab first, then read_page.]';
    return { content: formatPage(target, page, 'read_tab') + hint, isError: false };
  } catch (e) {
    return { content: `Error: ${e instanceof Error ? e.message : String(e)}`, isError: true, notice: pageErrorNotice(e) };
  }
}

/**
 * The tab tools; null for any other tool. They work without the assistant's tab (`tab` undefined after the user closed
 * it): listing, switching to or opening a tab is how the assistant goes on.
 */
export async function tabsTool(name: string, input: Record<string, unknown>, ctx: ToolContext, tab: Tab | undefined): Promise<ToolOutput | null> {
  const { browser } = ctx;
  try {
    switch (name) {
      case 'list_tabs':
        return { content: tabList(ctx), isError: false };
      case 'open_tab': {
        await tab?.captureThumbnail();
        // Tabs opened from an incognito tab (or from an incognito conversation whose tab was closed) stay incognito,
        // like in regular browsers. It joins the current tab's group, so the task's tabs stay together.
        const opened = browser.openTab(normalizeUrl(input.url), {
          incognito: tab ? tab.incognito : !!ctx.privacy?.touchedIncognito,
          openerId: tab?.id,
          group: true,
        });
        noteOpened(ctx, opened.id);
        ctx.agentTab.id = opened.id;
        await opened.waitForNextLoad(undefined, ctx.signal);
        return { content: `Opened tab id=${opened.id} at ${opened.url}. Call read_page to see it.`, isError: false };
      }
      case 'switch_tab': {
        const target = browser.getTab(String(input.tab_id));
        if (!target) return { content: `No tab with id=${input.tab_id}.\n${tabList(ctx)}`, isError: true };
        // Its address is in this result: an incognito tab makes the conversation incognito first (INC-2).
        if (target.incognito && ctx.privacy) ctx.privacy.touchedIncognito = true;
        if (tab && browser.activeId === tab.id) await tab.captureThumbnail();
        ctx.agentTab.id = target.id;
        browser.switchTab(target.id);
        return { content: `Switched to tab id=${target.id} (${blockedSite(ctx, target.url) ?? target.url}).`, isError: false };
      }
      case 'close_tab': {
        const id = String(input.tab_id);
        if (!browser.getTab(id)) return { content: `No tab with id=${id}.`, isError: true };
        browser.closeTab(id);
        // The assistant closed its own tab: it goes on in the one now on screen, which the list below marks.
        if (ctx.agentTab.id === id) ctx.agentTab.id = browser.active.id;
        return { content: `Closed tab ${id}. Open tabs:\n${tabList(ctx)}`, isError: false };
      }
      case 'take_notes':
        // The notes live in the call itself, which is never compacted; nothing to store here.
        return { content: 'Noted. These notes stay in your context.', isError: false };
      case 'close_tabs': {
        const ids = new Set((Array.isArray(input.tab_ids) ? input.tab_ids : []).map(String));
        const groupId = input.group_id ? String(input.group_id) : null;
        if (groupId && !browser.getGroup(groupId)) return { content: `No group with id=${groupId}.`, isError: true };
        if (groupId) browser.tabs.filter((x) => x.groupId === groupId).forEach((x) => ids.add(x.id));
        const keep = input.keep_tab_id ? String(input.keep_tab_id) : null;
        if (keep) ids.delete(keep);
        const closing = [...ids].filter((id) => browser.getTab(id));
        if (!closing.length) return { content: `Nothing to close.\n${tabList(ctx)}`, isError: true };
        const ownClosed = closing.includes(ctx.agentTab.id);
        browser.closeTabs(closing);
        if (keep && browser.getTab(keep)) browser.switchTab(keep);
        if (ownClosed) ctx.agentTab.id = browser.active.id;
        return { content: `Closed ${closing.length} tab(s). Open tabs:\n${tabList(ctx)}`, isError: false };
      }
      case 'wait': {
        const seconds = Math.min(Math.max(Number(input.seconds) || 1, 0), 10);
        await sleep(seconds * 1000, ctx.signal);
        return { content: `Waited ${seconds}s.`, isError: false };
      }
      default:
        return null;
    }
  } catch (e) {
    return { content: `Error: ${e instanceof Error ? e.message : String(e)}`, isError: true, notice: pageErrorNotice(e) };
  }
}
