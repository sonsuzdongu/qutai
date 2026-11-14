import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import { Platform } from 'react-native';
import { addCalendarEvent, addReminder, DeviceToolError } from '../device/calendar';
import { openDefaultBrowserSettings } from '../device/defaultBrowser';
import { scheduleNotification } from '../device/notifications';
import { savePagePdf, savePdfFromScreenshots } from '../device/pdf';
import { t } from '../i18n';
import { captureForModel, saveFullPageScreenshot, saveScreenshot } from '../device/screenshot';
import { CallOffer, normalizePhone } from '../device/phone';
import { ensureLocationPermission, LocationUnavailableError, readPosition } from '../device/location';
import { openSystemSettings, PermissionDeniedError } from '../device/settings';
import { speak, speakPage } from '../device/speech';
import type { ToolImage } from '../ai/types';
import { sleep } from '../utils/sleep';
import type { ActionEntry } from '../storage/actionLog';
import type { HistoryMatch } from '../storage/history';
import type { MemoryStore } from './memory';
import { decide, SitePolicy, siteKey } from './sitePolicy';
import { describePlan, planSchedule, SCHEDULING_TOOLS, SchedulingTool } from './scheduling';

type PageSnapshot = {
  url: string;
  title: string;
  scroll: { y: number; viewportHeight: number; pageHeight: number };
  truncated: boolean;
  nextOffset: number | null;
  content: string;
};

type SourceSnapshot = {
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
  /** Adds a Call button to the conversation (offer_call). It never dials: only the user's tap on it does. */
  offerCall?: (offer: CallOffer) => void;
  /** The AI provider's name (e.g. "Anthropic"), for confirmations that send something to it. */
  providerLabel?: string;
  /** Shows Qutai's own Settings screen (open_settings with target "app"). */
  showAppSettings?: () => void;
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
  'read_source',
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
    case 'read_source':
      return t('action.readSource');
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
      return t(input.from_screenshots === true ? 'action.savePdfScreenshots' : 'action.savePdf');
    case 'save_screenshot':
      return t(input.full_page === true ? 'action.saveFullScreenshot' : 'action.saveScreenshot');
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
    case 'offer_call':
      return t('action.offerCall', { who: (str(input.name).trim() || str(input.phone)).slice(0, 60) });
    case 'close_tab':
      return t('action.closeTab', { id: str(input.tab_id) });
    case 'close_tabs':
      return t('action.closeTabs');
    case 'take_notes':
      return t('action.takeNotes');
    case 'wait':
      return t('action.wait', { seconds: str(input.seconds) });
    case 'remember':
      return t('action.remember', { text: str(input.text).slice(0, 80) });
    case 'forget':
      return t('action.forget');
    case 'add_calendar_event':
      return t('action.addCalendarEvent', { title: str(input.title).slice(0, 60) });
    case 'add_reminder':
      return t('action.addReminder', { title: str(input.title).slice(0, 60) });
    case 'schedule_notification':
      return t('action.scheduleNotification', { title: str(input.title).slice(0, 60) });
    case 'get_location':
      return t('action.getLocation');
    case 'open_settings':
      return t(
        input.target === 'app'
          ? 'action.openAppSettings'
          : input.target === 'default_browser'
            ? 'action.openDefaultBrowserSettings'
            : 'action.openSystemSettings',
      );
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

function formatSource(tab: Tab, source: SourceSnapshot, selector: string): string {
  const end = source.offset + source.content.length;
  const header = [
    `Tab: ${tab.id}`,
    `URL: ${source.url}`,
    `Title: ${source.title}`,
    selector ? `Selector: ${selector} (${source.matches ?? 0} element(s))` : 'HTML source from the DOM',
    `Characters ${source.offset}–${end} of ${source.total}`,
  ].join('\n');
  const args = selector ? `selector=${JSON.stringify(selector)} and ` : '';
  const note = source.truncated
    ? `\n[Content truncated. Call read_source with ${args}offset=${source.nextOffset} to read the rest.]`
    : '';
  return `${header}\n\n${source.content}${note}`;
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

/** Who a call was offered to, for the action history: the name, never the number. */
function offerCallLog(input: Record<string, unknown>): string {
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 60) : '';
  return name ? t('action.offerCallLogged', { name }) : t('action.offerCallLoggedNoName');
}

/**
 * Shows a Call button in the chat. Nothing is dialled here: page content is untrusted, so the user's tap
 * on the button is the only thing that opens the dialer, and the button shows the full number first.
 */
function offerCallTool(input: Record<string, unknown>, ctx: ToolContext): ToolOutput {
  if (!ctx.offerCall) return { content: 'Call buttons are not available here.', isError: true };
  const phone = normalizePhone(input.phone);
  if (!phone.ok) return { content: `${phone.error} No button was shown.`, isError: true };
  const name = typeof input.name === 'string' ? input.name.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  ctx.offerCall({ number: phone.number, ...(name ? { name } : {}) });
  return {
    content:
      `A Call button for ${name ? `${name}, ` : ''}${phone.number} is shown in the chat. No call has been made: ` +
      'the user taps the button to call themselves. Do not say you called; tell them where the number came from.',
    isError: false,
  };
}

/**
 * Opens a settings screen. The phone's settings send Qutai to the background, so this returns as
 * soon as they are open: the run pauses until the user comes back, and the model is told to wait for them.
 */
async function openSettingsTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const target = String(input.target ?? 'system');
  if (target === 'app') {
    if (!ctx.showAppSettings) return { content: "Qutai's settings screen is not available here.", isError: true };
    ctx.showAppSettings();
    return {
      content: "Opened Qutai's own Settings screen. Tell the user briefly what to change there; they close it when done.",
      isError: false,
    };
  }
  if (target !== 'system' && target !== 'default_browser')
    return { content: 'target must be "system", "default_browser" or "app".', isError: true };
  try {
    if (target === 'default_browser') await openDefaultBrowserSettings();
    else await openSystemSettings();
  } catch (e) {
    return {
      content:
        `The phone refused to open its settings (${e instanceof Error ? e.message : String(e)}). ` +
        "Tell the user where to find it themselves: the phone's Settings app, then Apps, then Qutai.",
      isError: true,
    };
  }
  return {
    content:
      "Opened the phone's settings; the user has left Qutai to change the setting there. Don't call more tools now: " +
      'tell them in one short sentence what to change, and wait for them to say they are done.',
    isError: false,
  };
}

/** What the action history says about a scheduling tool: what kind of thing was added, not its content. */
const SCHEDULING_LOG_KEYS = {
  add_calendar_event: 'action.addCalendarEventLogged',
  add_reminder: 'action.addReminderLogged',
  schedule_notification: 'action.scheduleNotificationLogged',
} as const;

/**
 * Calendar events, reminders and notifications. Never from incognito conversations, and the user
 * confirms every write with its details, whatever the "ask before actions" setting.
 */
async function schedulingTool(name: SchedulingTool, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  if (ctx.privacy?.touchedIncognito || tab?.incognito) {
    return {
      content:
        'Not allowed: this conversation involves incognito tabs, so nothing is added to the calendar, reminders ' +
        'or notifications. Tell the user they can ask again from a normal tab.',
      isError: true,
    };
  }
  const plan = planSchedule(name, input);
  if (typeof plan === 'string') return { content: plan, isError: true };
  const android = Platform.OS === 'android';
  if (plan.kind === 'reminder' && android && !plan.due) {
    return {
      content:
        'On Android a reminder needs a due date and time (it becomes a calendar event with an alarm). ' +
        'Ask the user when they want to be reminded.',
      isError: true,
    };
  }
  if (!ctx.confirm) return { content: 'This needs the user\'s confirmation, which is not available here.', isError: true };
  if (!(await ctx.confirm(describePlan(plan, android), null)))
    return { content: 'The user declined this. Ask them how to proceed.', isError: true };
  try {
    if (plan.kind === 'event') {
      const calendar = await addCalendarEvent(plan);
      return { content: `Added the event to the calendar "${calendar}".`, isError: false };
    }
    if (plan.kind === 'reminder') {
      const where = await addReminder(plan);
      return { content: `Added the reminder to ${where}.`, isError: false };
    }
    await scheduleNotification(plan);
    return { content: 'Scheduled the notification. Qutai will show it at that time.', isError: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { content: e instanceof DeviceToolError ? message : `Could not add it: ${message}`, isError: true };
  }
}

/**
 * The user's location for the assistant. Never in incognito conversations (same rule as the calendar), the user
 * confirms every read, and the result goes only to the model: the action history just says it was read.
 */
async function locationTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  if (ctx.privacy?.touchedIncognito || tab?.incognito) {
    return {
      content:
        "Not allowed: this conversation involves incognito tabs, so Qutai doesn't share the location from it. Tell " +
        'the user they can ask again from a normal tab, or ask them for a starting point.',
      isError: true,
    };
  }
  if (!ctx.confirm) return { content: "This needs the user's confirmation, which is not available here.", isError: true };
  const purpose = typeof input.purpose === 'string' ? input.purpose.trim().slice(0, 200) : '';
  const site = tab && !tab.isNewTab ? siteKey(tab.url) : null;
  const lines = [t('location.agentConfirm', { provider: ctx.providerLabel || t('location.aiProvider') })];
  if (purpose) lines.push(`“${purpose}”`);
  if (site) lines.push(t('location.agentSite', { host: site }));
  if (!(await ctx.confirm(lines.join('\n\n'), null))) {
    return {
      content: "The user declined to share their location. Don't guess it: ask them where to start from.",
      isError: true,
    };
  }
  try {
    await ensureLocationPermission();
    const position = await readPosition({ highAccuracy: input.precise === true });
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    return {
      content:
        `Latitude: ${round(position.latitude)}\nLongitude: ${round(position.longitude)}\n` +
        `Accuracy: about ${Math.round(position.accuracy)} m\n` +
        `Measured: ${new Date(position.timestamp).toISOString()}\n` +
        'Use these coordinates for this task only (e.g. "lat,lng" in a maps directions URL). Never save them with ' +
        'remember. If the accuracy is large (approximate location), mention that the start point is approximate.',
      isError: false,
    };
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return {
        content:
          'Permission denied: the user has not allowed Qutai to use their location. Offer them (with ask_user) to ' +
          "open Qutai's page in the phone's settings with open_settings (target system), where they can allow it, " +
          'or ask them for a starting point. Do not call get_location again unless they say they allowed it.',
        isError: true,
      };
    }
    if (e instanceof LocationUnavailableError && e.reason === 'servicesOff') {
      return {
        content:
          "Location services are turned off on the phone. Tell the user to turn them on in the phone's settings " +
          '(Privacy / Location), or ask them for a starting point.',
        isError: true,
      };
    }
    if (e instanceof LocationUnavailableError && e.reason === 'needsBuild') {
      return { content: `${e.message} Tell the user it is not available yet and ask for a starting point.`, isError: true };
    }
    return {
      content: `Could not read the location (${e instanceof Error ? e.message : String(e)}). Ask the user for a starting point.`,
      isError: true,
    };
  }
}

/** Two decimal coordinates, e.g. "41.0082, 28.9784": a location is not something to remember. */
const COORDINATES = /-?\d{1,3}\.\d{3,}\s*[,;/ ]\s*-?\d{1,3}\.\d{3,}/;

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
      if (COORDINATES.test(String(input.text ?? ''))) {
        return {
          content: "Not saved: coordinates (the user's location) are never kept in memory. Use them for this task only.",
          isError: true,
        };
      }
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

/** The WebView cannot show view-source: pages; the model is pointed to read_source instead. */
function isViewSource(raw: unknown): boolean {
  return /^\s*view-source:/i.test(String(raw ?? ''));
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

/** Tabs the agent opened during a task, keyed by that task's agentTab object. */
const openedByTask = new WeakMap<object, Set<string>>();

function noteOpened(ctx: ToolContext, tabId: string) {
  const opened = openedByTask.get(ctx.agentTab) ?? new Set<string>();
  opened.add(tabId);
  openedByTask.set(ctx.agentTab, opened);
}

function tabList(ctx: ToolContext): string {
  const opened = openedByTask.get(ctx.agentTab);
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
  'read_source',
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
  'offer_call',
  'add_calendar_event',
  'add_reminder',
  'schedule_notification',
  'open_settings',
  // Only that the location was read: the coordinates are never written to the history.
  'get_location',
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
      'offer_call',
      'open_settings',
      'get_location',
      ...SCHEDULING_TOOLS,
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
  // Checked before the site permission, which would otherwise ask about a made-up host.
  if ((name === 'navigate' || name === 'open_tab') && isViewSource(input.url)) {
    return {
      content:
        'view-source: URLs cannot be opened in this browser. Call read_source to read the HTML source of the ' +
        'current page instead (navigate to the page itself first if needed).',
      isError: true,
    };
  }
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
          name === 'type'
            ? t('action.typeRedacted', { ref: String(input.ref ?? '') })
            : name === 'offer_call'
              ? offerCallLog(input)
              : name in SCHEDULING_LOG_KEYS
              ? t(SCHEDULING_LOG_KEYS[name as SchedulingTool])
              : describeToolCall(name, input),
        ok: !result.isError,
      });
    }
    return result;
  };

  // Refused and declined actions are recorded too, so the history shows what was stopped.
  if (decision.kind === 'refuse') return record({ content: decision.reason, isError: true });
  // These confirm on their own, with the details of what will be added.
  if (SCHEDULING_TOOLS.has(name)) return record(await schedulingTool(name as SchedulingTool, input, ctx));
  // Asks every time, whatever the "ask before actions" setting.
  if (name === 'get_location') return record(await locationTool(input, ctx));
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
  if (name === 'open_settings') return openSettingsTool(input, ctx);
  if (name === 'offer_call') return offerCallTool(input, ctx);

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
      case 'read_source': {
        const selector = typeof input.selector === 'string' ? input.selector.trim() : '';
        const source = await tab.run<SourceSnapshot>('readSource', [input.offset ?? 0, selector]);
        return { content: formatSource(tab, source, selector), isError: false };
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
        if (input.from_screenshots === true) {
          // Screens are captured from the view, so the tab has to be on screen.
          await showTab(ctx, tab);
          const pdf = await savePdfFromScreenshots(tab);
          const cut = pdf.truncated ? ' The page was very long, so only its first part is in the PDF.' : '';
          return {
            content: `Created "${pdf.fileName}" from screenshots (${pdf.pages} page(s)) and showed the share sheet to the user.${cut}`,
            isError: false,
          };
        }
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
        if (input.full_page === true) {
          const shot = await saveFullPageScreenshot(tab);
          const parts =
            shot.images > 1 ? ` The page was too long for one image, so it was saved as ${shot.images} images.` : '';
          const cut = shot.truncated ? ' The page was very long; only its first part was captured.' : '';
          return { content: `Saved a full-page screenshot to the user's photo library.${parts}${cut}`, isError: false };
        }
        await saveScreenshot(tab);
        return { content: "Saved a screenshot of the visible area to the user's photo library.", isError: false };
      }
      case 'list_tabs':
        return { content: tabList(ctx), isError: false };
      case 'open_tab': {
        await tab.captureThumbnail();
        // Tabs opened from an incognito tab stay incognito, like in regular browsers.
        // It joins the current tab's group, so the task's tabs stay together and can be closed together.
        const opened = browser.openTab(normalizeUrl(input.url), {
          incognito: tab.incognito,
          openerId: tab.id,
          group: true,
        });
        noteOpened(ctx, opened.id);
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
        browser.closeTabs(closing);
        if (keep && browser.getTab(keep)) browser.switchTab(keep);
        if (!browser.getTab(ctx.agentTab.id)) ctx.agentTab.id = browser.active.id;
        return { content: `Closed ${closing.length} tab(s). Open tabs:\n${tabList(ctx)}`, isError: false };
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
    if (e instanceof PermissionDeniedError) {
      return {
        content:
          `Permission denied: ${e.message} Offer the user (with ask_user) to open Qutai's page in the phone's ` +
          'settings with open_settings (target system), where they can allow it.',
        isError: true,
      };
    }
    return { content: `Error: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  }
}
