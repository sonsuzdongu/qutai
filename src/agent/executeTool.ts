import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import { savePagePdf } from '../device/pdf';
import { captureForModel, saveScreenshot } from '../device/screenshot';
import { speak, speakPage } from '../device/speech';
import type { ToolImage } from '../ai/types';
import { sleep } from '../utils/sleep';

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
};

const ACTIONS_NEEDING_CONFIRMATION = new Set([
  'navigate',
  'open_tab',
  'click',
  'type',
  'select_option',
  'save_screenshot',
]);

/** Short Turkish label shown in the chat for each tool call. */
export function describeToolCall(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'read_page':
      return '📄 Sayfa okunuyor';
    case 'navigate':
      return `🌐 Açılıyor: ${input.url}`;
    case 'go_back':
      return '⬅️ Geri gidiliyor';
    case 'click':
      return `👆 Tıklanıyor (ref ${input.ref})`;
    case 'type':
      return `⌨️ Yazılıyor (ref ${input.ref}): "${String(input.text).slice(0, 40)}"`;
    case 'select_option':
      return `🔽 Seçiliyor (ref ${input.ref}): ${input.value}`;
    case 'scroll':
      return `↕️ Kaydırılıyor: ${input.direction}`;
    case 'scroll_to':
      return `↕️ Öğeye kaydırılıyor (ref ${input.ref})`;
    case 'save_pdf':
      return '📄 PDF hazırlanıyor';
    case 'save_screenshot':
      return '📸 Ekran görüntüsü kaydediliyor';
    case 'view_screenshot':
      return '👁 Sayfaya bakılıyor';
    case 'read_aloud':
      return input.text ? '🔊 Sesli okunuyor' : '🔊 Sayfa sesli okunuyor';
    case 'list_tabs':
      return '🗂 Sekmeler listeleniyor';
    case 'open_tab':
      return `➕ Yeni sekme: ${input.url}`;
    case 'switch_tab':
      return `🔀 Sekmeye geçiliyor (${input.tab_id})`;
    case 'close_tab':
      return `✖️ Sekme kapatılıyor (${input.tab_id})`;
    case 'wait':
      return `⏳ ${input.seconds} sn bekleniyor`;
    default:
      return `🔧 ${name}`;
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
      return `- id=${t.id} "${t.title || '(no title)'}" ${t.url}${marks ? ` (${marks})` : ''}`;
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

  const tab = currentTab(ctx);

  try {
    switch (name) {
      case 'read_page': {
        const page = await tab.run<PageSnapshot>('readPage', [input.offset ?? 0]);
        const header = [
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
