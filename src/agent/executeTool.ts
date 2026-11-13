import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import { savePagePdf } from '../device/pdf';
import { t } from '../i18n';
import { captureForModel, saveScreenshot } from '../device/screenshot';
import { speak, speakPage } from '../device/speech';
import type { ToolImage } from '../ai/types';
import { sleep } from '../utils/sleep';
import type { MemoryStore } from './memory';

type PageSnapshot = {
  url: string;
  title: string;
  scroll: { y: number; viewportHeight: number; pageHeight: number };
  truncated: boolean;
  nextOffset: number | null;
  content: string;
};

export type ToolContext = {
  browser: Browser;
  /** The tab the agent works in. It can differ from the tab the user is looking at. */
  agentTab: { id: string };
  /** Asks the user before an action that changes the page. Resolve false to block it. */
  confirm?: (description: string) => Promise<boolean>;
  /** Set when the agent works in an incognito tab, so the conversation is never saved to disk. */
  privacy?: { touchedIncognito: boolean };
  /** Long-term memory about the user; absent when memory is turned off. */
  memory?: MemoryStore;
};

/** Tools that need a loaded web page. */
const PAGE_TOOLS = new Set([
  'read_page',
  'click',
  'type',
  'select_option',
  'scroll',
  'scroll_to',
  'save_pdf',
  'save_screenshot',
  'view_screenshot',
]);

const ACTIONS_NEEDING_CONFIRMATION = new Set([
  'navigate',
  'open_tab',
  'click',
  'type',
  'select_option',
  'save_screenshot',
]);

/** Short label shown in the chat for each tool call. */
export function describeToolCall(name: string, input: Record<string, unknown>): string {
  const str = (value: unknown) => String(value ?? '');
  switch (name) {
    case 'read_page':
      return t('action.readPage');
    case 'navigate':
      return t('action.navigate', { url: str(input.url) });
    case 'go_back':
      return t('action.goBack');
    case 'click':
      return t('action.click', { ref: str(input.ref) });
    case 'type':
      return t('action.type', { ref: str(input.ref), text: str(input.text).slice(0, 40) });
    case 'select_option':
      return t('action.select', { ref: str(input.ref), value: str(input.value) });
    case 'scroll':
      return t('action.scroll', { direction: str(input.direction) });
    case 'scroll_to':
      return t('action.scrollTo', { ref: str(input.ref) });
    case 'save_pdf':
      return t('action.savePdf');
    case 'save_screenshot':
      return t('action.saveScreenshot');
    case 'view_screenshot':
      return t('action.viewScreenshot');
    case 'read_aloud':
      return t(input.text ? 'action.readAloudText' : 'action.readAloudPage');
    case 'list_tabs':
      return t('action.listTabs');
    case 'open_tab':
      return t('action.openTab', { url: str(input.url) });
    case 'switch_tab':
      return t('action.switchTab', { id: str(input.tab_id) });
    case 'close_tab':
      return t('action.closeTab', { id: str(input.tab_id) });
    case 'wait':
      return t('action.wait', { seconds: str(input.seconds) });
    case 'remember':
      return t('action.remember', { text: str(input.text).slice(0, 80) });
    case 'forget':
      return t('action.forget');
    default:
      return `🔧 ${name}`;
  }
}

async function memoryTool(
  name: 'remember' | 'forget',
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ content: string; isError: boolean }> {
  if (!ctx.memory) return { content: 'Memory is turned off in settings.', isError: true };
  // Incognito conversations leave nothing behind, memories included.
  if (ctx.privacy?.touchedIncognito) {
    return {
      content: 'Not saved: this conversation involves incognito tabs, so nothing is remembered.',
      isError: true,
    };
  }
  try {
    if (name === 'remember') {
      const memory = await ctx.memory.add(String(input.text ?? ''));
      return { content: `Remembered [${memory.id}]: ${memory.text}`, isError: false };
    }
    const removed = await ctx.memory.remove(String(input.id ?? ''));
    return removed
      ? { content: 'Forgotten.', isError: false }
      : { content: `No memory with id ${String(input.id)}.`, isError: true };
  } catch (e) {
    return { content: e instanceof Error ? e.message : String(e), isError: true };
  }
}

function normalizeUrl(raw: unknown): string {
  const url = String(raw || '').trim();
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function currentTab(ctx: ToolContext): Tab {
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  if (tab) return tab;
  // The user closed the agent's tab; continue in whatever is on screen.
  ctx.agentTab.id = ctx.browser.active.id;
  return ctx.browser.active;
}

/** Screenshots can only be taken of the tab on screen, so bring the agent's tab to the front first. */
async function showTab(ctx: ToolContext, tab: Tab) {
  if (ctx.browser.activeId === tab.id) return;
  ctx.browser.switchTab(tab.id);
  await sleep(400);
}

function tabList(ctx: ToolContext): string {
  return ctx.browser.tabs
    .map((t) => {
      const marks = [
        t.incognito && 'incognito',
        t.id === ctx.agentTab.id && 'you are here',
        t.id === ctx.browser.activeId && 'visible to user',
      ]
        .filter(Boolean)
        .join(', ');
      const page = t.isNewTab ? 'new tab page (no web page)' : `"${t.title || '(no title)'}" ${t.url}`;
      return `- id=${t.id} ${page}${marks ? ` (${marks})` : ''}`;
    })
    .join('\n');
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ content: string; isError: boolean; images?: ToolImage[] }> {
  const { browser } = ctx;

  if (ctx.confirm && ACTIONS_NEEDING_CONFIRMATION.has(name)) {
    const allowed = await ctx.confirm(describeToolCall(name, input));
    if (!allowed) {
      return { content: 'The user declined this action. Ask them how to proceed.', isError: true };
    }
  }

  if (name === 'remember' || name === 'forget') return memoryTool(name, input, ctx);

  const tab = currentTab(ctx);
  if (tab.incognito && ctx.privacy) ctx.privacy.touchedIncognito = true;
  if (tab.asleep) {
    const loaded = tab.waitForNextLoad();
    tab.wake();
    await loaded;
  }

  if (tab.isNewTab && PAGE_TOOLS.has(name)) {
    return {
      content: 'This tab shows the new tab page; no web page is loaded. Use navigate to open one.',
      isError: name !== 'read_page',
    };
  }

  try {
    switch (name) {
      case 'read_page': {
        const page = await tab.run<PageSnapshot>('readPage', [input.offset ?? 0]);
        const header = [
          ...(tab.loadError ? [`Page failed to load: ${tab.loadError.description} (${tab.loadError.kind})`] : []),
          `Tab: ${tab.id}`,
          `URL: ${page.url}`,
          `Title: ${page.title}`,
          `Scroll: y=${page.scroll.y}, viewport=${page.scroll.viewportHeight}, page height=${page.scroll.pageHeight}`,
        ].join('\n');
        const note = page.truncated
          ? `\n[Content truncated. Call read_page with offset=${page.nextOffset} to read the rest.]`
          : '';
        return { content: `${header}\n\n${page.content}${note}`, isError: false };
      }
      case 'navigate': {
        const url = normalizeUrl(input.url);
        await tab.navigate(url);
        if (tab.loadError) {
          return {
            content: `Could not load ${url}: ${tab.loadError.description} (${tab.loadError.kind}).`,
            isError: true,
          };
        }
        return { content: `Opened ${tab.url || url}. Call read_page to see it.`, isError: false };
      }
      case 'go_back': {
        await tab.goBack();
        return { content: `Went back. Now at ${tab.url}.`, isError: false };
      }
      case 'click': {
        const urlBefore = tab.url;
        const tabsBefore = new Set(browser.tabs.map((t) => t.id));
        const result = await tab.run<string>('click', [input.ref]);
        await tab.settle();
        const opened = browser.tabs.find((t) => !tabsBefore.has(t.id));
        if (opened) {
          ctx.agentTab.id = opened.id;
          await opened.settle();
          return {
            content: `${result} It opened a new tab (id=${opened.id}, ${opened.url}); you are now in it.`,
            isError: false,
          };
        }
        const nav = tab.url !== urlBefore ? ` Page changed to ${tab.url}.` : '';
        return { content: result + nav, isError: false };
      }
      case 'type': {
        const submit = input.submit === true;
        const result = await tab.run<string>('type', [
          input.ref,
          String(input.text ?? ''),
          input.clear !== false,
          submit,
        ]);
        if (submit) await tab.settle();
        return { content: result, isError: false };
      }
      case 'select_option': {
        const result = await tab.run<string>('select', [input.ref, String(input.value ?? '')]);
        await sleep(300);
        return { content: result, isError: false };
      }
      case 'scroll': {
        const result = await tab.run<string>('scroll', [input.direction, input.amount ?? 1]);
        await sleep(400);
        return { content: result, isError: false };
      }
      case 'scroll_to': {
        const result = await tab.run<string>('scrollTo', [input.ref]);
        return { content: result, isError: false };
      }
      case 'save_pdf': {
        const pdf = await savePagePdf(tab);
        const missing = pdf.imagesMissing > 0 ? ` ${pdf.imagesMissing} image(s) could not be embedded.` : '';
        return {
          content: `Created "${pdf.fileName}" (${pdf.pages} page(s)) and showed the share sheet to the user.${missing}`,
          isError: false,
        };
      }
      case 'view_screenshot': {
        await showTab(ctx, tab);
        const image = await captureForModel(tab);
        return { content: `Screenshot of the visible area of ${tab.url}.`, isError: false, images: [image] };
      }
      case 'read_aloud': {
        const text = typeof input.text === 'string' ? input.text.trim() : '';
        if (text) {
          await speak(text, typeof input.language === 'string' ? input.language : undefined);
          return { content: `Started reading ${text.length} characters aloud.`, isError: false };
        }
        if (tab.isNewTab) return { content: 'No web page is loaded in this tab.', isError: true };
        const page = await speakPage(tab);
        const note = page.truncated ? ' The page is long; only the beginning is read.' : '';
        return { content: `Started reading the page aloud (${page.chars} characters).${note}`, isError: false };
      }
      case 'save_screenshot': {
        await showTab(ctx, tab);
        await saveScreenshot(tab);
        return { content: "Saved a screenshot of the visible area to the user's photo library.", isError: false };
      }
      case 'list_tabs':
        return { content: tabList(ctx), isError: false };
      case 'open_tab': {
        await tab.captureThumbnail();
        // Tabs opened from an incognito tab stay incognito, like in regular browsers.
        const opened = browser.openTab(normalizeUrl(input.url), { incognito: tab.incognito, openerId: tab.id });
        ctx.agentTab.id = opened.id;
        await opened.waitForNextLoad();
        return { content: `Opened tab id=${opened.id} at ${opened.url}. Call read_page to see it.`, isError: false };
      }
      case 'switch_tab': {
        const target = browser.getTab(String(input.tab_id));
        if (!target) return { content: `No tab with id=${input.tab_id}.\n${tabList(ctx)}`, isError: true };
        if (browser.activeId === tab.id) await tab.captureThumbnail();
        ctx.agentTab.id = target.id;
        browser.switchTab(target.id);
        return { content: `Switched to tab id=${target.id} (${target.url}).`, isError: false };
      }
      case 'close_tab': {
        const id = String(input.tab_id);
        if (!browser.getTab(id)) return { content: `No tab with id=${id}.`, isError: true };
        browser.closeTab(id);
        if (ctx.agentTab.id === id) ctx.agentTab.id = browser.active.id;
        return { content: `Closed tab ${id}. Open tabs:\n${tabList(ctx)}`, isError: false };
      }
      case 'wait': {
        const seconds = Math.min(Math.max(Number(input.seconds) || 1, 0), 10);
        await sleep(seconds * 1000);
        return { content: `Waited ${seconds}s.`, isError: false };
      }
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (e) {
    return { content: `Error: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  }
}
