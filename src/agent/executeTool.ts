import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import { savePagePdf } from '../device/pdf';
import { t } from '../i18n';
import { captureForModel, saveScreenshot } from '../device/screenshot';
import { speak, speakPage } from '../device/speech';
import type { ToolImage } from '../ai/types';
import { sleep } from '../utils/sleep';
import type { ActionEntry } from '../storage/actionLog';
import type { HistoryMatch } from '../storage/history';
import type { MemoryStore } from './memory';
import { decide, SitePolicy, siteKey } from './sitePolicy';

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
  /** Asks the user before an action that changes the page (host: the site it acts on). Resolve false to block it. */
  confirm?: (description: string, host: string | null) => Promise<boolean>;
  /** The global "ask before actions" setting, for sites without their own permission. Defaults to true when confirm is set. */
  confirmByDefault?: boolean;
  /** Per-site permissions (allow, ask, read-only, blocked). */
  sites?: SitePolicy;
  /** Browsing history search (search_history); absent in tests or when unavailable. */
  history?: { search(query: string, from: number, to: number): Promise<HistoryMatch[]> };
  /** Opens the email composer; resolves with what the user did (sent, saved, cancelled…). */
  composeEmail?: (draft: EmailDraft) => Promise<string>;
  /** Records what the agent did, for the action history. Not called for incognito tabs. */
  log?: (entry: ActionEntry) => void;
  /** Set when the agent works in an incognito tab, so the conversation is never saved to disk. */
  privacy?: { touchedIncognito: boolean };
  /** Long-term memory about the user; absent when memory is turned off. */
  memory?: MemoryStore;
};

/** Tools that need a loaded web page. */
const PAGE_TOOLS = new Set([
  'read_page',
  'click',
  'click_at',
  'type',
  'select_option',
  'scroll',
  'scroll_to',
  'save_pdf',
  'save_screenshot',
  'view_screenshot',
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
    case 'click_at':
      return t('action.clickAt', { x: str(input.x), y: str(input.y) });
    case 'read_aloud':
      return t(input.text ? 'action.readAloudText' : 'action.readAloudPage');
    case 'list_tabs':
      return t('action.listTabs');
    case 'open_tab':
      return t('action.openTab', { url: str(input.url) });
    case 'switch_tab':
      return t('action.switchTab', { id: str(input.tab_id) });
    case 'read_tab':
      return t('action.readTab', { id: str(input.tab_id) });
    case 'search_history':
      return t('action.searchHistory', { query: str(input.query) });
    case 'draft_email':
      return t('action.draftEmail', { subject: str(input.subject).slice(0, 60) });
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

function formatPage(tab: Tab, page: PageSnapshot, tool: 'read_page' | 'read_tab'): string {
  const header = [
    ...(tab.loadError ? [`Page failed to load: ${tab.loadError.description} (${tab.loadError.kind})`] : []),
    `Tab: ${tab.id}`,
    `URL: ${page.url}`,
    `Title: ${page.title}`,
    `Scroll: y=${page.scroll.y}, viewport=${page.scroll.viewportHeight}, page height=${page.scroll.pageHeight}`,
  ].join('\n');
  const more = tool === 'read_tab' ? `read_tab with tab_id=${tab.id} and` : 'read_page with';
  const note = page.truncated ? `\n[Content truncated. Call ${more} offset=${page.nextOffset} to read the rest.]` : '';
  return `${header}\n\n${page.content}${note}`;
}

/** Reads another tab in the background, without bringing it to the front or moving the agent there. */
async function readTab(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ content: string; isError: boolean }> {
  const target = ctx.browser.getTab(String(input.tab_id ?? ''));
  if (!target) return { content: `No tab with id=${String(input.tab_id)}.\n${tabList(ctx)}`, isError: true };
  if (target.incognito && ctx.privacy) ctx.privacy.touchedIncognito = true;
  if (target.isNewTab)
    return { content: `Tab ${target.id} shows the new tab page; no web page is loaded.`, isError: true };
  try {
    if (target.asleep) {
      // A sleeping tab gets its WebView back off screen; the page loads from its saved address.
      const loaded = target.waitForNextLoad();
      target.wake();
      await loaded;
    }
    const page = await target.run<PageSnapshot>('readPage', [input.offset ?? 0]);
    const hint =
      target.id === ctx.agentTab.id
        ? ''
        : '\n[Read only. To click or type here, call switch_tab first, then read_page.]';
    return { content: formatPage(target, page, 'read_tab') + hint, isError: false };
  } catch (e) {
    return { content: `Error: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  }
}

const DAY_MS = 86_400_000;

function formatVisit(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function searchHistoryTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  if (!ctx.history) return { content: 'History is not available.', isError: true };
  const now = Date.now();
  const since = Math.max(0, Number(input.since_days_ago ?? 90) || 0);
  const until = Math.max(0, Number(input.until_days_ago ?? 0) || 0);
  const query = String(input.query ?? '');
  const matches = await ctx.history.search(query, now - since * DAY_MS, now - until * DAY_MS);
  const header = `Today: ${formatVisit(now)}. History matches for "${query}" (${since}–${until} days ago):`;
  if (matches.length === 0)
    return {
      content: `${header}\nNo pages found. Try fewer or other keywords, or a longer time range.`,
      isError: false,
    };
  const lines = matches.map(
    (m) =>
      `- ${formatVisit(m.lastVisit)} · ${m.title || '(no title)'} — ${m.url}${m.visits > 1 ? ` (${m.visits} visits)` : ''}`,
  );
  return { content: `${header}\n${lines.join('\n')}`, isError: false };
}

async function draftEmail(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  if (!ctx.composeEmail) return { content: 'Email drafts are not available.', isError: true };
  const raw = Array.isArray(input.to) ? input.to : typeof input.to === 'string' ? [input.to] : [];
  const to = raw.map((a) => String(a).trim()).filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
  try {
    const status = await ctx.composeEmail({ to, subject: String(input.subject ?? ''), body: String(input.body ?? '') });
    return {
      content: `The email composer was shown; the user's choice: ${status}. You cannot send it yourself.`,
      isError: false,
    };
  } catch (e) {
    return {
      content: `Could not open the email composer: ${e instanceof Error ? e.message : String(e)}`,
      isError: true,
    };
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

type ToolOutput = { content: string; isError: boolean; images?: ToolImage[] };

export type EmailDraft = { to: string[]; subject: string; body: string };

/** Actions kept in the action history; bookkeeping (listing tabs, waiting, scrolling) is left out. */
const LOGGED_TOOLS = new Set([
  'navigate',
  'go_back',
  'click',
  'click_at',
  'type',
  'select_option',
  'read_page',
  'read_tab',
  'view_screenshot',
  'save_pdf',
  'save_screenshot',
  'read_aloud',
  'open_tab',
  'close_tab',
  'remember',
  'forget',
  'draft_email',
]);

/** The page a tool acts on: the destination for navigation, the read tab for read_tab, else the agent's tab. */
function actionTarget(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): { url: string; tab?: Tab } | null {
  if (name === 'navigate' || name === 'open_tab') return { url: normalizeUrl(input.url) };
  if (
    [
      'list_tabs',
      'switch_tab',
      'close_tab',
      'wait',
      'remember',
      'forget',
      'ask_user',
      'search_history',
      'draft_email',
    ].includes(name)
  )
    return null;
  const tab =
    name === 'read_tab'
      ? ctx.browser.getTab(String(input.tab_id ?? ''))
      : (ctx.browser.getTab(ctx.agentTab.id) ?? ctx.browser.active);
  return tab ? { url: tab.url, tab } : null;
}

export async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const target = actionTarget(name, input, ctx);
  const host = target ? siteKey(target.url) : null;
  const level = host && ctx.sites ? ctx.sites.levelFor(host) : 'default';
  const decision = decide(name, host, level, ctx.confirm ? (ctx.confirmByDefault ?? true) : false);
  const fromTab = ctx.browser.getTab(ctx.agentTab.id);

  const record = (result: ToolOutput): ToolOutput => {
    const incognito = !!(ctx.privacy?.touchedIncognito || target?.tab?.incognito || fromTab?.incognito);
    if (ctx.log && LOGGED_TOOLS.has(name) && !incognito) {
      ctx.log({
        at: Date.now(),
        host,
        url: target && host ? target.url : null,
        tool: name,
        // Typed text can be personal, so the history only says where something was typed.
        description:
          name === 'type' ? t('action.typeRedacted', { ref: String(input.ref ?? '') }) : describeToolCall(name, input),
        ok: !result.isError,
      });
    }
    return result;
  };

  // Refused and declined actions are recorded too, so the history shows what was stopped.
  if (decision.kind === 'refuse') return record({ content: decision.reason, isError: true });
  if (decision.kind === 'confirm' && ctx.confirm) {
    const allowed = await ctx.confirm(describeToolCall(name, input), host);
    if (!allowed) return record({ content: 'The user declined this action. Ask them how to proceed.', isError: true });
  }
  return record(await runTool(name, input, ctx));
}

async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const { browser } = ctx;

  if (name === 'remember' || name === 'forget') return memoryTool(name, input, ctx);
  if (name === 'read_tab') return readTab(input, ctx);
  if (name === 'search_history') return searchHistoryTool(input, ctx);
  if (name === 'draft_email') return draftEmail(input, ctx);

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
        return { content: formatPage(tab, page, 'read_page'), isError: false };
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
        const { width, height, ...image } = await captureForModel(tab);
        tab.modelScreenshotSize = { width, height };
        return {
          content:
            `Screenshot of the visible area of ${tab.url} (${width}×${height} pixels). ` +
            'To click something that has no ref, call click_at with x and y in these pixels.',
          isError: false,
          images: [image],
        };
      }
      case 'click_at': {
        const size = tab.modelScreenshotSize;
        if (!size)
          return { content: 'Call view_screenshot first; click_at uses its pixel coordinates.', isError: true };
        const x = Number(input.x);
        const y = Number(input.y);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > size.width || y > size.height) {
          return {
            content: `x and y must be inside the screenshot (0–${size.width}, 0–${size.height}).`,
            isError: true,
          };
        }
        const result = await tab.run<string>('clickAt', [x / size.width, y / size.height]);
        // The page may have changed; old coordinates are no longer reliable.
        tab.modelScreenshotSize = null;
        await tab.settle();
        return { content: `${result}. Take a new screenshot to see the result.`, isError: false };
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
