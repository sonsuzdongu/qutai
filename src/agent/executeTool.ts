import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import { Platform } from 'react-native';
import { addCalendarEvent, addReminder, DeviceToolError, readCalendarEvents } from '../device/calendar';
import { openDefaultBrowserSettings } from '../device/defaultBrowser';
import { notificationOrigin, scheduleNotification } from '../device/notifications';
import { renderPagePdf, renderPdfFromScreenshots, shareRenderedPdf, type RenderedPdf } from '../device/pdf';
import type { EmailOutcome } from '../device/email';
import type { ComposedRef, Shareable, ShareOffer } from '../chat/shareable';
import { AlwaysAllowKind, kindForDownload, kindForSchedule } from './alwaysAllow';
import { draftEmailTool, shareLog, shareTool, uploadFileTool } from './shareTools';
import { t } from '../i18n';
import { captureForModel, saveFullPageScreenshot, saveScreenshot } from '../device/screenshot';
import { fileNameFromUrl, isRiskyDownload, probeDownload } from '../device/download';
import { composedFileName, composeFile, FileOffer, isFileFormat, keepComposedFile } from '../device/composedFile';
import { formatSize } from '../i18n/format';
import { CallOffer, normalizePhone } from '../device/phone';
import { MAX_SMS_BODY, SmsOffer } from '../device/sms';
import { MAX_WHATSAPP_BODY, normalizeWhatsAppNumber, WhatsAppOffer } from '../device/whatsapp';
import { ensureLocationPermission, LocationUnavailableError, readPosition } from '../device/location';
import { openSystemSettings, PermissionDeniedError } from '../device/settings';
import { speak, speakPage } from '../device/speech';
import type { ToolImage } from '../ai/types';
import type { AttachmentInfo } from '../chat/attachments';
import { readPdfTool, viewAttachmentTool } from './fileTools';
import { uiLabel, uiPath } from './uiLabels';
import { declinedNotice, errorNotice, incognitoNotice, pageErrorNotice, settingNotice, type StepNotice } from './stepLine';
import type { IconLine, IconLines } from '../ui/Icon';
import { toolIcon } from './toolIcons';
import { editImageTool, uploadImageTool } from './imageTools';
import { BOOKMARK_READS, bookmarkNeedsUser, bookmarksTool, describeBookmarkCall } from './bookmarkTool';
import { getSavedTaskTool, listSavedTasksTool, type SavedTasksAccess } from './savedTaskTool';
import { describeSettingsCall, settingsTool } from './settingsTool';
import type { Settings } from '../storage/settings';
import { sleep } from '../utils/sleep';
import type { ActionEntry } from '../storage/actionLog';
import type { HistoryMatch, SiteVisits } from '../storage/history';
import type { Bookmark } from '../storage/bookmarks';
import type { Db } from '../storage/db';
import { containsHidden, HiddenNeedle, hiddenNeedles, MEMORY_ID, redactHidden } from './hiddenValues';
import { hiddenKindOf, hiddenLabel, hiddenValue, isMemoryCategory, looksLikeIdNumber, Memory, MemoryStore } from './memory';
import { findPersonalData, PERSONAL_KINDS, PersonalKind, personalNeedles } from './personalData';
import { decide, SitePolicy, siteKey } from './sitePolicy';
import {
  describeCalendarRead,
  describePlan,
  formatCalendarRead,
  localIso,
  planCalendarRead,
  planSchedule,
  SCHEDULING_TOOLS,
  SchedulingTool,
} from './scheduling';
import { cutText } from '../utils/wellFormed';
import type { ScopeKind } from '../content/siteRules';
import { describeSiteRulesCall, siteRulesTool, type SiteRulesAccess, type SiteRulesApproval } from './siteRulesTool';
import { SITE_RULE_TOOL_NAMES } from './siteRuleTools';

type PageSnapshot = {
  url: string;
  title: string;
  scroll: { y: number; viewportHeight: number; pageHeight: number };
  truncated: boolean;
  nextOffset: number | null;
  content: string;
  /** Invalid form fields on the page ("ref=N "label": reason"); empty without errors. */
  formErrors?: string[];
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
  /**
   * The tab the user asked from (agentTab can move to other tabs during the task). A notification the assistant
   * schedules leads back to it when tapped.
   */
  askedFrom?: { id: string };
  /**
   * Asks the user before an action that changes the page (host: the site it acts on). Resolve false to block it.
   * `kind`: a low-risk phone action the user may allow for good ("Don't ask again", agent/alwaysAllow.ts).
   */
  confirm?: (description: string | IconLines, host: string | null, kind?: AlwaysAllowKind) => Promise<boolean>;
  /** The global "ask before actions" setting, for sites without their own permission. Defaults to true when confirm is set. */
  confirmByDefault?: boolean;
  /** Per-site permissions (allow, ask, read-only, blocked). */
  sites?: SitePolicy;
  /** Browsing history search (search_history); absent in tests or when unavailable. */
  history?: {
    search(query: string, from: number, to: number): Promise<HistoryMatch[]>;
    /** Most visited sites (by_site), ranked by visits; hidden top sites left out. */
    sites(query: string, from: number, to: number): Promise<SiteVisits[]>;
  };
  /** The user's bookmarks (bookmarks tool); absent in tests or when unavailable. */
  bookmarks?: {
    db(): Promise<Db>;
    /** Bookmarks the tool removed: the screen offers to put them back ("Undo" in a toast). */
    removed(bookmarks: Bookmark[]): void;
  };
  /** The user's saved tasks (list_saved_tasks, get_saved_task), read only; absent in tests or when unavailable. */
  savedTasks?: SavedTasksAccess;
  /**
   * Qutai's own settings (settings tool): the current values, and changes applied through the same path as the
   * Settings screen. Only the allowlist in agent/settingsTool.ts is ever changed.
   */
  appSettings?: {
    get(): Settings;
    change(patch: Partial<Settings>): Promise<void>;
  };
  /**
   * Opens the email composer with the draft and its files; resolves with how it reached the user (the composer and
   * what they did there, a mailto: link, or the share sheet when files go and no composer is available).
   */
  composeEmail?: (draft: EmailDraft) => Promise<EmailOutcome>;
  /**
   * Adds a share card (share), or the card of an email draft that took files: the files and text, and for a share a
   * button the user taps to open WhatsApp or the share sheet. It never sends.
   */
  offerShare?: (offer: ShareOffer) => void;
  /** The files composed with save_file in this conversation (its cards), for tools that hand files out. */
  composedFiles?: () => ComposedRef[];
  /**
   * Keeps a PDF made by save_pdf as a file of the conversation (a card with Share, and Save on Android) and resolves
   * with its manifest; absent: the PDF goes to the share sheet as before.
   */
  offerPdf?: (pdf: RenderedPdf) => AttachmentInfo;
  /** Adds a Call button to the conversation (offer_call). It never dials: only the user's tap on it does. */
  offerCall?: (offer: CallOffer) => void;
  /** Adds a card with Share / Save buttons for a composed file (save_file). Nothing is written until the user taps. */
  offerFile?: (file: FileOffer) => void;
  /** Adds an "Open in Messages" card to the conversation (draft_sms). It never sends: the user does, in Messages. */
  offerSms?: (offer: SmsOffer) => void;
  /** Adds an "Open in WhatsApp" card (draft_whatsapp). It never sends: the user does, in WhatsApp. */
  offerWhatsApp?: (offer: WhatsAppOffer) => void;
  /**
   * Starts a download the user confirmed (download_file), like the tab's own downloads, without waiting for it;
   * "permission" when Android 9 and older asks for storage first.
   */
  startDownload?: (tab: Tab, url: string, name: string, type: string | null) => Promise<void>;
  /** Shows Qutai's own Settings screen (open_settings with target "app"). */
  showAppSettings?: () => void;
  /** Records what the agent did, for the action history. Not called for incognito tabs. */
  log?: (entry: ActionEntry) => void;
  /** Set when the agent works in an incognito tab, so the conversation is never saved to disk. */
  privacy?: { touchedIncognito: boolean };
  /** Long-term memory about the user; absent when memory is turned off. */
  memory?: MemoryStore;
  /**
   * Asks before the assistant enters remembered personal details (`kinds`) on `host` for the first time in a task.
   * 'once' covers the site until the task ends; 'always' is saved by the caller; 'deny' or null (dismissed) refuses.
   */
  confirmPersonal?: (
    host: string,
    kinds: PersonalKind[],
    incognito: boolean,
  ) => Promise<'deny' | 'once' | 'always' | null>;
  /** This task's answers to confirmPersonal, by site (set by runAgent for each task). */
  personalGrants?: { allowed: Set<string>; declined: Set<string> };
  /**
   * Asks before Qutai types a hidden memory (`what`: what it is, never the value) into `field` on `host`: the first
   * time for each hidden value and site in a task, even where personal details are always allowed. True to type it.
   */
  confirmHidden?: (host: string, what: string, field: string, incognito: boolean) => Promise<boolean>;
  /** The files the user attached in this conversation (its manifest), for tools that take an attachment id. */
  attachments?: () => AttachmentInfo[];
  /** The model takes image input (false: tools that would return images say so instead). */
  imageInput?: boolean;
  /** Adds an edited image (edit_image) to the conversation as a card, which also puts it in its attachments. */
  offerImage?: (info: AttachmentInfo) => void;
  /**
   * Asks the user with a picture in the dialog (upload_image: "Give this image to <site>?"), every time: no "always
   * allow", whatever the site's setting. Resolve false when declined or dismissed.
   */
  confirmImage?: (options: {
    title: string;
    message: string;
    /** upload_image shows the image; upload_file has none (the message names the file). */
    image?: { uri: string; aspectRatio: number };
    confirmText: string;
  }) => Promise<boolean>;
  /** An image was given to a page (kept when old edited images are pruned). */
  imageUsed?: (id: string) => void;
  /** The user's own site rules (try_hide, save_site_rules, site_rules; agent/siteRulesTool.ts). */
  siteRules?: SiteRulesAccess;
  /**
   * Asks before site rules are saved, every time (never "don't ask again"): shows the selectors and domains and lets
   * the user pick where hiding applies. Resolves with the scope, or null when declined or dismissed.
   */
  confirmSiteRules?: (approval: SiteRulesApproval) => Promise<ScopeKind | null>;
};

/** Tools that need a loaded web page. */
const PAGE_TOOLS = new Set([
  'try_hide',
  'save_site_rules',
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
  'upload_image',
  'upload_file',
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
      return input.memory !== undefined && input.memory !== null && input.memory !== ''
        ? t('action.typeHidden', { ref: str(input.ref) })
        : t('action.type', { ref: str(input.ref), text: cutText(str(input.text), 40) });
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
    case 'view_attachment':
      return t('action.viewAttachment');
    case 'edit_image':
      return t('action.editImage');
    case 'upload_image':
      return t('action.uploadImage', { ref: str(input.ref) });
    case 'upload_file':
      return t('action.uploadFile', { ref: str(input.ref) });
    case 'share':
      return t(input.app === 'whatsapp' ? 'action.shareWhatsApp' : 'action.share');
    case 'read_pdf':
      return input.view_pages !== undefined && input.view_pages !== null
        ? t('action.viewPdfPages')
        : t('action.readPdf');
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
      if (input.by_site === true)
        return str(input.query).trim()
          ? t('action.topSitesFor', { query: str(input.query) })
          : t('action.topSites');
      return t('action.searchHistory', { query: str(input.query) });
    case 'bookmarks':
      return describeBookmarkCall(input);
    case 'list_saved_tasks':
      return t('action.listSavedTasks');
    case 'get_saved_task':
      return t('action.getSavedTask', { name: cutText(str(input.name).trim() || str(input.id), 60) });
    case 'settings':
      return describeSettingsCall(input);
    case 'try_hide':
    case 'save_site_rules':
    case 'site_rules':
      return describeSiteRulesCall(name, input);
    case 'draft_email':
      return t('action.draftEmail', { subject: cutText(str(input.subject), 60) });
    case 'offer_call':
      return t('action.offerCall', { who: cutText(str(input.name).trim() || str(input.phone), 60) });
    case 'draft_sms':
      return t('action.draftSms', { who: cutText(str(input.name).trim() || str(input.phone), 60) });
    case 'draft_whatsapp':
      return str(input.name).trim() || str(input.phone).trim()
        ? t('action.draftWhatsApp', { who: cutText(str(input.name).trim() || str(input.phone), 60) })
        : t('action.draftWhatsAppNoNumber');
    case 'close_tab':
      return t('action.closeTab', { id: str(input.tab_id) });
    case 'close_tabs':
      return t('action.closeTabs');
    case 'take_notes':
      return t('action.takeNotes');
    case 'wait':
      return t('action.wait', { seconds: str(input.seconds) });
    case 'remember':
      // An ID or passport number is saved hidden: the chat and the action history don't repeat it either.
      return looksLikeIdNumber(str(input.text))
        ? t('action.rememberHidden')
        : t('action.remember', { text: cutText(str(input.text), 80) });
    case 'forget':
      return t('action.forget');
    case 'add_calendar_event':
      return t('action.addCalendarEvent', { title: cutText(str(input.title), 60) });
    case 'add_reminder':
      return t('action.addReminder', { title: cutText(str(input.title), 60) });
    case 'schedule_notification':
      return t('action.scheduleNotification', { title: cutText(str(input.title), 60) });
    case 'get_location':
      return t('action.getLocation');
    case 'save_file':
      return t('action.saveFile', { name: composedFileName(input.name, isFileFormat(input.format) ? input.format : 'txt') });
    case 'download_file':
      return typeof input.url === 'string' && input.url.trim()
        ? t('action.downloadFile', { name: fileNameFromUrl(input.url.trim()) })
        : t('action.downloadFileRef', { ref: str(input.ref) });
    case 'read_calendar':
      return t('action.readCalendar');
    case 'open_settings':
      return t(
        input.target === 'app'
          ? 'action.openAppSettings'
          : input.target === 'default_browser'
            ? 'action.openDefaultBrowserSettings'
            : 'action.openSystemSettings',
      );
    default:
      return name;
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
  const errors = page.formErrors?.length ? `\nForm errors:\n${page.formErrors.map((e) => `- ${e}`).join('\n')}` : '';
  return `${header}${errors}\n\n${page.content}${note}`;
}

/**
 * Validation errors after type, select_option or a submitting click: on the field itself, or on its form after a
 * submit, so the model sees them without another read_page. Empty when there are none or the page has changed.
 */
async function formReport(tab: Tab, ref: unknown, submitted: boolean): Promise<string> {
  try {
    const errors = await tab.run<string[]>('formReport', [ref, submitted], 3000);
    if (!errors.length) return '';
    const what = submitted ? 'The form reports errors' : 'The field reports an error';
    return `\n${what}:\n${errors.map((e) => `- ${e}`).join('\n')}\nFix these before submitting again.`;
  } catch {
    return '';
  }
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
    return { content: `Error: ${e instanceof Error ? e.message : String(e)}`, isError: true, notice: pageErrorNotice(e) };
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
  if (input.by_site === true) {
    const sites = await ctx.history.sites(query, now - since * DAY_MS, now - until * DAY_MS);
    const about = query.trim() ? ` for "${query}"` : '';
    const head = `Today: ${formatVisit(now)}. Most visited sites${about} (${since}–${until} days ago), by visits:`;
    if (sites.length === 0)
      return { content: `${head}\nNo sites found. Try fewer or other keywords, or a longer time range.`, isError: false };
    const rows = sites.map(
      (s) =>
        `- ${s.host}: ${s.visits} visit${s.visits === 1 ? '' : 's'}, last ${formatVisit(s.lastVisit)} · ` +
        `${s.title || '(no title)'} — ${s.url}`,
    );
    return { content: `${head}\n${rows.join('\n')}`, isError: false };
  }
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

/** Who a call was offered to, for the action history: the name, never the number. */
function offerCallLog(input: Record<string, unknown>): string {
  const name = typeof input.name === 'string' ? cutText(input.name.trim(), 60) : '';
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
  const name = typeof input.name === 'string' ? cutText(input.name.replace(/\s+/g, ' ').trim(), 80) : '';
  ctx.offerCall({ number: phone.number, ...(name ? { name } : {}) });
  return {
    content:
      `A call button labelled ${uiLabel('chat.call')} for ${name ? `${name}, ` : ''}${phone.number} is shown in the ` +
      'chat. No call has been made: the user taps the button to call themselves. Do not say you called; tell them ' +
      'where the number came from.',
    isError: false,
  };
}

/** Who a text message was prepared for, for the action history: the name, never the number or the text. */
function draftSmsLog(input: Record<string, unknown>): string {
  const name = typeof input.name === 'string' ? cutText(input.name.trim(), 60) : '';
  return name ? t('action.draftSmsLogged', { name }) : t('action.draftSmsLoggedNoName');
}

/**
 * Shows a prepared text message in the chat. Nothing opens or is sent here: page content is untrusted and
 * premium-rate numbers exist, so the card shows the full number and text first, the user's tap opens the
 * Messages app, and the user sends it there.
 */
function draftSmsTool(input: Record<string, unknown>, ctx: ToolContext): ToolOutput {
  if (!ctx.offerSms) return { content: 'Text message drafts are not available here.', isError: true };
  const phone = normalizePhone(input.phone);
  if (!phone.ok) return { content: `${phone.error} No message was prepared.`, isError: true };
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body) return { content: 'The message text is empty. No message was prepared.', isError: true };
  if (body.length > MAX_SMS_BODY)
    return { content: `The text is longer than ${MAX_SMS_BODY} characters; shorten it. No message was prepared.`, isError: true };
  const name = typeof input.name === 'string' ? cutText(input.name.replace(/\s+/g, ' ').trim(), 80) : '';
  ctx.offerSms({ number: phone.number, body, ...(name ? { name } : {}) });
  return {
    content:
      `A text message to ${name ? `${name}, ` : ''}${phone.number} is shown in the chat with a ` +
      `${uiLabel('chat.openInMessages')} button. Nothing has been sent: the user opens it in their messaging app and ` +
      'sends it themselves. Do not say it was sent.',
    isError: false,
  };
}

/** Who a WhatsApp message was prepared for, for the action history: the name, never the number or the text. */
function draftWhatsAppLog(input: Record<string, unknown>): string {
  const name = typeof input.name === 'string' ? cutText(input.name.trim(), 60) : '';
  return name ? t('action.draftWhatsAppLogged', { name }) : t('action.draftWhatsAppLoggedNoName');
}

/**
 * Shows a prepared WhatsApp message in the chat, like draft_sms: the card shows the full number (international, as
 * WhatsApp will use it) and text, the user's tap opens WhatsApp, and the user sends it there. Without a number the
 * user picks the chat in WhatsApp.
 */
function draftWhatsAppTool(input: Record<string, unknown>, ctx: ToolContext): ToolOutput {
  if (!ctx.offerWhatsApp) return { content: 'WhatsApp drafts are not available here.', isError: true };
  const rawPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
  let number: string | undefined;
  if (rawPhone) {
    const phone = normalizeWhatsAppNumber(rawPhone);
    if (!phone.ok) return { content: `${phone.error} No message was prepared.`, isError: true };
    number = phone.number;
  }
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body) return { content: 'The message text is empty. No message was prepared.', isError: true };
  if (body.length > MAX_WHATSAPP_BODY)
    return {
      content: `The text is longer than ${MAX_WHATSAPP_BODY} characters; shorten it. No message was prepared.`,
      isError: true,
    };
  const name = typeof input.name === 'string' ? cutText(input.name.replace(/\s+/g, ' ').trim(), 80) : '';
  ctx.offerWhatsApp({ body, ...(number ? { number } : {}), ...(name ? { name } : {}) });
  const to = number ? `to ${name ? `${name}, ` : ''}${number} ` : '(the user picks the chat in WhatsApp) ';
  return {
    content:
      `A WhatsApp message ${to}is shown in the chat with a ${uiLabel('chat.openInWhatsApp')} button. Nothing has ` +
      'been sent: the user opens it in WhatsApp and sends it themselves. Do not say it was sent.',
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
      content:
        `Opened Qutai's own settings screen, ${uiLabel('settings.title')}. Its sections: ` +
        `${uiPath('settings.assistant')} (AI provider, model and key, memory, saved tasks; site permissions are in the page menu, not here), ` +
        `${uiPath('settings.privacySection')}, ${uiPath('settings.appearance')}, ${uiPath('settings.search')}, ` +
        `${uiPath('backup.section')}, ${uiPath('settings.about')}. Tell the user briefly what to change there, ` +
        'naming the section as written here; they close it when done.',
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
        "Tell the user where to find it themselves: Qutai's page in the phone's settings app, under its apps.",
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
      notice: incognitoNotice(),
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
  if (!(await ctx.confirm(describePlan(plan, android), null, kindForSchedule(plan.kind))))
    return { content: 'The user declined this. Ask them how to proceed.', isError: true, notice: declinedNotice() };
  try {
    if (plan.kind === 'event') {
      const { calendar, note } = await addCalendarEvent(plan);
      return { content: `Added the event to the calendar "${calendar}".${note}`, isError: false };
    }
    if (plan.kind === 'reminder') {
      const where = await addReminder(plan);
      return { content: `Added the reminder to ${where}`, isError: false };
    }
    const from = ctx.browser.getTab(ctx.askedFrom?.id ?? ctx.agentTab.id);
    await scheduleNotification(plan, from ? notificationOrigin(from) : null);
    return {
      content:
        plan.delaySeconds !== undefined
          ? `Scheduled the notification. Qutai will show it ${plan.delaySeconds} seconds from now.`
          : 'Scheduled the notification. Qutai will show it at that time.',
      isError: false,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { content: e instanceof DeviceToolError ? message : `Could not add it: ${message}`, isError: true };
  }
}

/** What the action history says about read_calendar: that it was read and the range, never the events. */
function readCalendarLog(input: Record<string, unknown>): string {
  const plan = planCalendarRead(input);
  if (typeof plan === 'string') return t('action.readCalendar');
  const when = (date: Date) => localIso(date).replace('T', ' ');
  return t('action.readCalendarLogged', { from: when(plan.start), to: when(plan.end) });
}

/**
 * The user's calendar for the assistant. Same rules as the write tools: never in incognito conversations, and the
 * user confirms every read with the range and where it goes, whatever the "ask before actions" setting.
 */
async function readCalendarTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  if (ctx.privacy?.touchedIncognito || tab?.incognito) {
    return {
      content:
        "Not allowed: this conversation involves incognito tabs, so Qutai doesn't read the calendar from it. Tell the " +
        'user they can ask again from a normal tab. Do not guess their availability.',
      isError: true,
      notice: incognitoNotice(),
    };
  }
  const plan = planCalendarRead(input);
  if (typeof plan === 'string') return { content: plan, isError: true };
  if (!ctx.confirm) return { content: "This needs the user's confirmation, which is not available here.", isError: true };
  if (!(await ctx.confirm(describeCalendarRead(plan), null, 'calendarRead'))) {
    return {
      content:
        "The user declined to share their calendar. Don't guess their schedule or availability: ask them directly.",
      isError: true,
      notice: declinedNotice(),
    };
  }
  try {
    const entries = await readCalendarEvents(plan);
    return { content: formatCalendarRead(plan, entries), isError: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof DeviceToolError) return { content: message, isError: true };
    return {
      content: `Could not read the calendar: ${message}. Don't guess the user's availability.`,
      isError: true,
    };
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
      notice: incognitoNotice(),
    };
  }
  if (!ctx.confirm) return { content: "This needs the user's confirmation, which is not available here.", isError: true };
  const purpose = typeof input.purpose === 'string' ? cutText(input.purpose.trim(), 200) : '';
  const site = tab && !tab.isNewTab ? siteKey(tab.url) : null;
  const lines = [t('location.agentConfirm')];
  if (purpose) lines.push(`“${purpose}”`);
  if (site) lines.push(t('location.agentSite', { host: site }));
  if (!(await ctx.confirm(lines.join('\n\n'), null, 'location'))) {
    return {
      content: "The user declined to share their location. Don't guess it: ask them where to start from.",
      isError: true,
      notice: declinedNotice(),
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
          "Location services are turned off on the phone. Tell the user to turn on location in the phone's " +
          'settings, or ask them for a starting point.',
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

/**
 * Downloads a file for the user through Qutai's downloads (src/browser/downloadRequests.ts). The user confirms every download with its name, site
 * and, when a HEAD request tells, type and size, with a warning for files that install or run code and archives. The
 * file is never opened, and the model only hears that it started and where the user finds it.
 */
async function downloadFileTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  if (!ctx.startDownload) return { content: 'Downloads are not available here.', isError: true };
  const tab = currentTab(ctx);
  if (tab.incognito && ctx.privacy) ctx.privacy.touchedIncognito = true;
  const hasRef = input.ref !== undefined && input.ref !== null && input.ref !== '';
  let url = typeof input.url === 'string' ? input.url.trim() : '';
  if (hasRef) {
    if (tab.isNewTab)
      return {
        content: 'No web page is loaded in this tab, so there is no link to download.',
        isError: true,
        notice: errorNotice(t('step.noPage')),
      };
    try {
      url = await tab.run<string>('linkHref', [input.ref]);
    } catch (e) {
      return { content: e instanceof Error ? e.message : String(e), isError: true };
    }
  }
  if (!url) return { content: 'Give the ref of the link to the file, or its address as url.', isError: true };
  if (!/^https?:\/\//i.test(url))
    return { content: `Only http(s) addresses can be downloaded (got ${url.slice(0, 40)}).`, isError: true };
  // The page's own site was checked like any action; the file's site has to allow it as well.
  const fileHost = siteKey(url);
  const level = fileHost && ctx.sites ? ctx.sites.levelFor(fileHost) : 'default';
  if (fileHost && (level === 'blocked' || level === 'readonly')) {
    return {
      content: `The file is on ${fileHost}, where the user doesn't allow Qutai to act. Tell them to download it themselves.`,
      isError: true,
    };
  }
  if (!ctx.confirm) return { content: "This needs the user's confirmation, which is not available here.", isError: true };
  const probe = await probeDownload(url);
  const name = probe.name || fileNameFromUrl(url);
  const host = fileHost ?? url;
  const details = [
    name,
    t('downloads.agentFrom', { host }),
    ...(probe.type ? [t('downloads.agentType', { type: probe.type })] : []),
    ...(probe.size ? [t('downloads.agentSize', { size: formatSize(probe.size) })] : []),
  ].join('\n');
  const android = Platform.OS === 'android';
  const risky = isRiskyDownload(name, probe.type);
  const lines: IconLine[] = [
    { text: t('downloads.agentConfirm') },
    { text: details },
    ...(risky ? [{ icon: 'insecure' as const, text: t('downloads.agentRisky', { host }) }] : []),
    { text: t(android ? 'downloads.agentWhereAndroid' : 'downloads.agentWhereIos') },
  ];
  // "Don't ask again" covers ordinary files only: never a risky one, never from an incognito conversation.
  const kind = kindForDownload({ risky, incognito: !!(ctx.privacy?.touchedIncognito || tab.incognito) });
  if (!(await ctx.confirm({ lines, spaced: true }, null, kind)))
    return { content: 'The user declined the download. Ask them how to proceed.', isError: true, notice: declinedNotice() };
  try {
    await ctx.startDownload(tab, url, name, probe.type);
    return {
      content:
        `Started downloading "${name}"; it appears in Qutai's ${uiLabel('downloads.title')} screen ` +
        `(${uiPath('address.menu', 'menu.library', 'menu.downloads')}) with its progress, where the user opens ` +
        'or shares it' +
        (android ? " (the file is saved in the phone's Downloads folder)" : '') +
        '. You cannot open or read it.',
      isError: false,
    };
  } catch (e) {
    return { content: `Could not start the download: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  }
}

/**
 * A file composed from what the assistant gathered, offered as a chat card. Nothing is written to shared storage
 * here: the user's tap shares or saves it. Kept in memory only (incognito ones until the incognito session ends).
 */
/** The buttons on a save_file card, as the card shows them on this platform (AssistantPanel FileCard). */
function fileButtons(): string {
  return Platform.OS === 'ios'
    ? `a ${uiLabel('chat.fileShareIos')} button`
    : `${uiLabel('chat.fileSave')} and ${uiLabel('chat.fileShare')} buttons`;
}

/** The buttons on a PDF card (AssistantPanel PdfCard), as the card shows them on this platform. */
function pdfButtons(): string {
  return Platform.OS === 'ios' ? `a ${uiLabel('chat.fileShareIos')} button` : `${uiLabel('chat.fileSave')} and ${uiLabel('chat.fileShare')} buttons`;
}

function saveFileTool(input: Record<string, unknown>, ctx: ToolContext): ToolOutput {
  if (!ctx.offerFile) return { content: 'Files are not available here.', isError: true };
  const file = composeFile(input);
  if (typeof file === 'string') return { content: `${file} No file was made.`, isError: true };
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  const incognito = !!(ctx.privacy?.touchedIncognito || tab?.incognito);
  const offer = keepComposedFile(file, incognito);
  ctx.offerFile(offer);
  const rows = file.rows !== undefined ? `, ${file.rows} data row${file.rows === 1 ? '' : 's'}` : '';
  return {
    content:
      `A card for "${file.name}" (${formatSize(file.size)}${rows}), id=${offer.id}, is shown in the chat with ${fileButtons()}. ` +
      'To attach it to an email, share it to an app or put it into a web page, use this id with draft_email, share or upload_file. ' +
      'Nothing is saved yet: the user taps a button to share or save it. It is kept only while the app runs' +
      `${incognito ? ' and this incognito session lasts' : ''}. Do not repeat the whole content in your reply.`,
    isError: false,
  };
}

/** Two decimal coordinates, e.g. "41.0082, 28.9784": a location is not something to remember. */
const COORDINATES = /-?\d{1,3}\.\d{3,}\s*[,;/ ]\s*-?\d{1,3}\.\d{3,}/;
/** A date and time as read_calendar returns them ("2026-11-15T19:30"); two or more look like a copied schedule. */
const CALENDAR_TIMES = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/g;

/** Memory is off: the setting by its on-screen name and where it is. */
function memoryOff(rest: string): string {
  return (
    `Memory is turned off (${uiLabel('settings.memoryEnabled')} in ${uiPath('settings.title', 'settings.assistant')})` +
    rest
  );
}

async function memoryTool(
  name: 'remember' | 'forget',
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutput> {
  if (!ctx.memory) return { content: memoryOff('.'), isError: true };
  // Incognito conversations leave nothing behind, memories included.
  if (ctx.privacy?.touchedIncognito) {
    return {
      content: 'Not saved: this conversation involves incognito tabs, so nothing is remembered.',
      isError: true,
      notice: incognitoNotice(),
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
      if ((String(input.text ?? '').match(CALENDAR_TIMES) ?? []).length >= 2) {
        return {
          content:
            "Not saved: the user's schedule (calendar events) is never kept in memory. If the user asked you to " +
            'remember one particular event, save that one alone.',
          isError: true,
        };
      }
      // Required in the schema, but a provider may still leave it out: such a fact goes to general.
      const category = isMemoryCategory(input.category) ? input.category : 'general';
      const memory = await ctx.memory.add(String(input.text ?? ''), category);
      if (memory.sensitive) {
        return {
          content:
            `Remembered [${memory.id}] (${memory.category}) as a hidden value: ${hiddenLabel(memory)}. From now on you ` +
            "see only that it is saved; to enter it in a form, call type with memory set to its id. Don't repeat " +
            'the value in your reply.',
          isError: false,
        };
      }
      return { content: `Remembered [${memory.id}] (${memory.category}): ${memory.text}`, isError: false };
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

/** content: what the model reads (English). notice: what the chat shows the user instead (agent/stepLine.ts). */
export type ToolOutput = { content: string; isError: boolean; images?: ToolImage[]; notice?: StepNotice };

export type EmailDraft = {
  to: string[];
  subject: string;
  body: string;
  /** Files of the conversation to attach (src/chat/shareable.ts); empty for none. */
  attachments: Shareable[];
  /** Their copies go to the session-only folder. */
  incognito: boolean;
  /** Images the user attached go as picked, metadata included (only when the user asked for the original). */
  original?: boolean;
};

/** Actions kept in the action history; bookkeeping (listing tabs, waiting, scrolling) is left out. */
const LOGGED_TOOLS = new Set([
  'save_site_rules',
  'site_rules',
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
  'draft_sms',
  'draft_whatsapp',
  'add_calendar_event',
  'add_reminder',
  'schedule_notification',
  'open_settings',
  // Changes only: list and search are left out (see isLogged).
  'bookmarks',
  // Changes only, each with the setting's name and new value.
  'settings',
  // Only that the location was read: the coordinates are never written to the history.
  'get_location',
  // Only that the calendar was read and the range: the events are never written to the history.
  'read_calendar',
  'download_file',
  'save_file',
  'read_pdf',
  // Only that an image was given to the site and where: never the image.
  'upload_image',
  // Only that a file was given to the site and where: never the file.
  'upload_file',
  // Only that a share was prepared and to which app: never the files, text or number.
  'share',
]);

/** Whether a call goes in the action history: tools in LOGGED_TOOLS, but not the ones that only read. */
function isLogged(name: string, input: Record<string, unknown>): boolean {
  if (!LOGGED_TOOLS.has(name)) return false;
  if (name === 'bookmarks') return !BOOKMARK_READS.has(String(input.action));
  if (name === 'settings') return input.action === 'set';
  if (name === 'site_rules') return input.action === 'remove';
  return true;
}

/** The page a tool acts on: the destination for navigation, the read tab for read_tab, else the agent's tab. */
function actionTarget(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): { url: string; tab?: Tab } | null {
  if (name === 'navigate' || name === 'open_tab') return { url: normalizeUrl(input.url) };
  // A PDF the user attached comes from no site.
  if (name === 'read_pdf' && input.attachment_id !== undefined && input.attachment_id !== '') return null;
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
      'bookmarks',
      'list_saved_tasks',
      'get_saved_task',
      'settings',
      'draft_email',
      'offer_call',
      'draft_sms',
      'draft_whatsapp',
      'share',
      'save_file',
      'view_attachment',
      'edit_image',
      'open_settings',
      'get_location',
      'read_calendar',
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

/** Tools that confirm on their own every time, whatever the "ask before actions" setting. */
const ALWAYS_CONFIRMED = new Set(['get_location', 'read_calendar', 'download_file', 'upload_image', 'upload_file']);

/**
 * Tools that can run while the app is in the background with "Keep working in the background" on (Android): they
 * read or act on a page through the tab's existing WebView, or only touch the app's own state. Everything else
 * needs the user or the screen: screenshots and PDFs (views that are not drawn), new tabs and waking tabs (their
 * WebView is created by the paused UI), the email composer, settings, and every tool that asks for confirmation.
 */
const BACKGROUND_TOOLS = new Set([
  'read_page',
  'read_source',
  'navigate',
  'go_back',
  'click',
  'click_at',
  'type',
  'select_option',
  'scroll',
  'scroll_to',
  'read_tab',
  'list_tabs',
  'switch_tab',
  'close_tab',
  'close_tabs',
  'take_notes',
  'wait',
  'remember',
  'forget',
  'search_history',
  // Only the app's own data; asking calls (deleting a folder, many removals) wait for the user, see backgroundBlocker.
  'bookmarks',
  // Read the user's saved tasks only.
  'list_saved_tasks',
  'get_saved_task',
  // Reading only: a change waits until the user is back, so they see it happen (backgroundBlocker).
  'settings',
  // Only reads a file the user attached.
  'view_attachment',
  // Works on the phone only and adds a card.
  'edit_image',
  // Only add a card to the conversation; the user acts on it later.
  'offer_call',
  'draft_sms',
  'draft_whatsapp',
  // Adds a card; the user's tap on it opens WhatsApp or the share sheet later.
  'share',
  'save_file',
]);

/**
 * Why this call cannot run while the app is in the background, or null when it can. Checked before the call, so a
 * step that needs the user pauses the task (with a notification) instead of waiting unseen; nothing is approved
 * because the user is away.
 */
export function backgroundBlocker(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): 'confirm' | 'onScreen' | 'tab' | null {
  if (!BACKGROUND_TOOLS.has(name))
    return SCHEDULING_TOOLS.has(name) || ALWAYS_CONFIRMED.has(name) ? 'confirm' : 'onScreen';
  if (name === 'bookmarks' && bookmarkNeedsUser(input, ctx.agentTab)) return 'confirm';
  if (name === 'settings' && input.action !== 'get') return 'onScreen';
  const target = actionTarget(name, input, ctx);
  const host = target ? siteKey(target.url) : null;
  const level = host && ctx.sites ? ctx.sites.levelFor(host) : 'default';
  const decision = decide(name, host, level, ctx.confirm ? (ctx.confirmByDefault ?? true) : false);
  if (decision.kind === 'confirm' && ctx.confirm) return 'confirm';
  // The tab the call works in needs a live WebView: a sleeping tab's (or a page opened from the new tab page) would
  // have to be created. Page tools on the new tab page only answer that no page is loaded.
  const tab =
    name === 'read_tab'
      ? ctx.browser.getTab(String(input.tab_id ?? ''))
      : PAGE_TOOLS.has(name) || name === 'navigate' || name === 'go_back'
        ? (ctx.browser.getTab(ctx.agentTab.id) ?? ctx.browser.active)
        : undefined;
  if (tab && (tab.asleep || (tab.isNewTab ? name === 'navigate' : !tab.webview))) return 'tab';
  return null;
}

/**
 * Runs one tool call. Every result passes through the hidden-value redaction (agent/hiddenValues.ts) before it is
 * returned, so no hidden memory's value goes back to the model, into the conversation, the chat's error line or the
 * "What was sent to the AI" log, whatever the tool read.
 */
export async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const result = await executeUnredacted(name, input, ctx);
  const needles = await hiddenNeedlesFor(ctx);
  if (!needles.length) return result;
  return { ...result, content: redactHidden(result.content, needles) };
}

/** The current hidden memories as search patterns; empty without memory or hidden memories (no scan then). */
async function hiddenNeedlesFor(ctx: ToolContext): Promise<HiddenNeedle[]> {
  if (!ctx.memory) return [];
  const memories = await ctx.memory.list().catch(() => [] as Memory[]);
  return memories.some((m) => m.sensitive) ? hiddenNeedles(memories) : [];
}

/**
 * The hidden memory a type call asks for (`memory`: its id), or a tool error. Text and memory together, an id that
 * isn't one, an unknown id or a memory that isn't hidden are refused.
 */
async function hiddenForType(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ memory: Memory } | { error: string } | null> {
  if (input.memory === undefined || input.memory === null || input.memory === '') return null;
  if (typeof input.text === 'string' && input.text !== '')
    return { error: 'Give either text or memory, not both. Nothing was typed.' };
  const id = typeof input.memory === 'string' ? input.memory.trim() : '';
  if (!MEMORY_ID.test(id))
    return { error: 'memory must be the id of a hidden memory as listed in your instructions, without brackets.' };
  if (!ctx.memory) return { error: memoryOff(', so no saved value can be entered.') };
  const memory = await ctx.memory.get(id).catch(() => null);
  if (!memory) return { error: `No memory with id ${id}. Nothing was typed.` };
  if (!memory.sensitive)
    return { error: `Memory ${id} is not hidden: type its text yourself with text instead. Nothing was typed.` };
  return { memory };
}

async function executeUnredacted(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
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
    if (ctx.log && isLogged(name, input) && !incognito) {
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
              : name === 'draft_sms'
              ? draftSmsLog(input)
              : name === 'draft_whatsapp'
              ? draftWhatsAppLog(input)
              : name === 'share'
              ? shareLog(input)
              : name === 'read_calendar'
              ? readCalendarLog(input)
              : name in SCHEDULING_LOG_KEYS
              ? t(SCHEDULING_LOG_KEYS[name as SchedulingTool])
              : describeToolCall(name, input),
        ok: !result.isError,
      });
    }
    return result;
  };

  // Refused and declined actions are recorded too, so the history shows what was stopped.
  if (decision.kind === 'refuse') {
    const shown = t(level === 'blocked' ? 'step.siteBlocked' : 'step.siteReadOnly', { host: host ?? '' });
    return record({ content: decision.reason, isError: true, notice: settingNotice(shown) });
  }
  // These confirm on their own, with the details of what will be added.
  if (SCHEDULING_TOOLS.has(name)) return record(await schedulingTool(name as SchedulingTool, input, ctx));
  // Asks every time, whatever the "ask before actions" setting.
  if (name === 'get_location') return record(await locationTool(input, ctx));
  if (name === 'read_calendar') return record(await readCalendarTool(input, ctx));
  if (name === 'download_file') return record(await downloadFileTool(input, ctx));
  // A hidden memory is looked up here and its value only handed to the page-typing path (runTool).
  const hidden = name === 'type' ? await hiddenForType(input, ctx) : null;
  if (hidden && 'error' in hidden) return record({ content: hidden.error, isError: true });
  if (name === 'type' && !hidden && typeof input.text !== 'string')
    return record({ content: 'Give the text to type (or memory for a hidden saved value).', isError: true });
  // Remembered personal details need the site's permission, checked here in the app, not left to the prompt.
  let personalAsked = false;
  if (hidden && target) {
    const gate = await hiddenGate(hidden.memory, input, target.url, host, ctx, target.tab);
    if (gate.kind === 'refuse') return record({ content: gate.reason, isError: true, notice: gate.notice });
    personalAsked = true;
  } else if ((name === 'type' || name === 'select_option') && host) {
    const gate = await personalGate(name, input, host, ctx, target?.tab);
    if (gate.kind === 'refuse') return record({ content: gate.reason, isError: true, notice: gate.notice });
    personalAsked = gate.kind === 'asked';
  }
  // The personal-information question already named this entry; asking "may I type?" right after would be twice.
  if (decision.kind === 'confirm' && ctx.confirm && !personalAsked) {
    const allowed = await ctx.confirm({ lines: [{ icon: toolIcon(name, input), text: describeToolCall(name, input) }] }, host);
    if (!allowed)
      return record({ content: 'The user declined this action. Ask them how to proceed.', isError: true, notice: declinedNotice() });
  }
  return record(await runTool(name, input, ctx, hidden?.memory));
}

/** What the confirmation calls a hidden memory: "ID or passport number" for those, else the user's label. */
function hiddenWhat(memory: Memory): string {
  return hiddenKindOf(memory.text) ? t('personal.kind.idNumber') : hiddenLabel(memory);
}

/**
 * Whether a hidden memory may be typed on this page. Never on an http page, a blocked site (or one where personal
 * details are blocked) or without a confirmation dialog. Otherwise the user is asked the first time each hidden value
 * goes to a site in a task, even where personal details are always allowed; the dialog shows the site and the
 * field's label, and the answer lasts until the task ends.
 */
async function hiddenGate(
  memory: Memory,
  input: Record<string, unknown>,
  url: string,
  host: string | null,
  ctx: ToolContext,
  tab: Tab | undefined,
): Promise<{ kind: 'run' } | { kind: 'refuse'; reason: string; notice: StepNotice }> {
  if (!host || !/^https:\/\//i.test(url)) {
    return {
      kind: 'refuse',
      reason: 'Hidden values are entered only on https pages. Nothing was typed; tell the user, who can enter it themselves.',
      notice: settingNotice(t('step.httpsOnly')),
    };
  }
  if ((ctx.sites?.personalFor(host) ?? 'ask') === 'block') {
    return {
      kind: 'refuse',
      reason:
        `The user has blocked Qutai from entering their saved personal information on ${host} (a setting for this ` +
        'site). Nothing was typed. Tell the user: they can fill it in themselves, or change ' +
        personalSettingPlace(),
      notice: settingNotice(t('step.personalBlocked', { host })),
    };
  }
  const key = `hidden:${host}:${memory.id}`;
  const declined = {
    kind: 'refuse' as const,
    reason:
      `The user did not allow entering their saved ${hiddenLabel(memory)} on ${host}. Nothing was typed. Don't try ` +
      "again on this site in this task and don't ask for the value; tell the user, who can fill it in themselves.",
    notice: { ...declinedNotice(), text: t('step.personalDeclined', { host }) },
  };
  if (ctx.personalGrants?.allowed.has(key)) return { kind: 'run' };
  if (ctx.personalGrants?.declined.has(key) || !ctx.confirmHidden) return declined;
  const field = tab ? await tab.run<string>('fieldLabel', [input.ref], 3000).catch(() => '') : '';
  const incognito = !!(ctx.privacy?.touchedIncognito || tab?.incognito);
  if (await ctx.confirmHidden(host, hiddenWhat(memory), field, incognito)) {
    ctx.personalGrants?.allowed.add(key);
    return { kind: 'run' };
  }
  ctx.personalGrants?.declined.add(key);
  return declined;
}

/**
 * For view_screenshot while hidden memories exist: fields showing a hidden value are made transparent for the capture
 * (the returned function restores them), and a hidden value elsewhere in the page's text refuses the screenshot. The
 * page only sends its field values and text to the app; no hidden value is sent into the page to look for.
 */
async function maskHiddenForCapture(tab: Tab, ctx: ToolContext): Promise<{ restore: () => Promise<void> } | string> {
  const nothing = { restore: async () => {} };
  const needles = await hiddenNeedlesFor(ctx);
  if (!needles.length) return nothing;
  const screen = await tab.run<{ fields: string[]; text: string }>('screenFields', [], 5000);
  if (containsHidden(screen.text, needles)) {
    return (
      'Not captured: the page shows one of the user\'s hidden saved values as text, and a screenshot would show it ' +
      'to you. Use read_page instead (hidden values appear there as [hidden: …]).'
    );
  }
  const indices = screen.fields.flatMap((value, i) => (containsHidden(value, needles) ? [i] : []));
  if (!indices.length) return nothing;
  await tab.run('maskFields', [indices], 3000);
  return { restore: () => tab.run('maskEnd', [], 3000).then(() => undefined, () => undefined) };
}

/**
 * Whether `type` / `select_option` may enter its text on `host`: text holding none of the remembered personal details
 * (agent/personalData.ts) runs; otherwise the site's "Personal information" setting decides, and 'ask' asks once per
 * site and task. Nothing about the text is logged or returned.
 */
async function personalGate(
  name: string,
  input: Record<string, unknown>,
  host: string,
  ctx: ToolContext,
  tab: Tab | undefined,
): Promise<{ kind: 'run' | 'asked' } | { kind: 'refuse'; reason: string; notice: StepNotice }> {
  if (!ctx.memory) return { kind: 'run' };
  const text = String((name === 'type' ? input.text : input.value) ?? '');
  if (!text.trim()) return { kind: 'run' };
  const memories = await ctx.memory.list().catch(() => []);
  const kinds = findPersonalData(text, personalNeedles(memories));
  if (!kinds.size) return { kind: 'run' };
  const setting = ctx.sites?.personalFor(host) ?? 'ask';
  if (setting === 'allow') return { kind: 'run' };
  const declined = {
    kind: 'refuse' as const,
    reason:
      `The user did not allow entering their saved personal information on ${host}. Don't enter it on this site in ` +
      'this task and don\'t ask again; tell the user, who can fill it in themselves.',
    notice: { ...declinedNotice(), text: t('step.personalDeclined', { host }) },
  };
  if (setting === 'block') {
    return {
      kind: 'refuse',
      reason:
        `The user has blocked Qutai from entering their saved personal information on ${host} (a setting for this ` +
        'site). Don\'t enter it here. Tell the user: they can fill it in themselves, or change ' +
        personalSettingPlace(),
      notice: settingNotice(t('step.personalBlocked', { host })),
    };
  }
  if (ctx.personalGrants?.allowed.has(host)) return { kind: 'run' };
  if (ctx.personalGrants?.declined.has(host) || !ctx.confirmPersonal) return declined;
  const incognito = !!(ctx.privacy?.touchedIncognito || tab?.incognito);
  const answer = await ctx.confirmPersonal(
    host,
    PERSONAL_KINDS.filter((k) => kinds.has(k)),
    incognito,
  );
  if (answer === 'once' || answer === 'always') {
    ctx.personalGrants?.allowed.add(host);
    return { kind: 'asked' };
  }
  ctx.personalGrants?.declined.add(host);
  return declined;
}

/** Where the per-site personal-information setting is, by its on-screen names. */
function personalSettingPlace(): string {
  return (
    `${uiLabel('site.personalTitle')} in this site's sheet ${uiLabel('site.title')} (from the ` +
    `${uiLabel('address.menu')}), where ${uiLabel('site.allSites')} lists every site.`
  );
}

/** `hidden`: the hidden memory type enters instead of `text` (already checked and confirmed by the caller). */
async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
  hidden?: Memory,
): Promise<ToolOutput> {
  const { browser } = ctx;

  if (name === 'remember' || name === 'forget') return memoryTool(name, input, ctx);
  if (name === 'read_tab') return readTab(input, ctx);
  if (name === 'search_history') return searchHistoryTool(input, ctx);
  if (name === 'bookmarks') return bookmarksTool(input, ctx);
  if (name === 'list_saved_tasks') return listSavedTasksTool(ctx.savedTasks);
  if (name === 'get_saved_task') return getSavedTaskTool(input, ctx.savedTasks);
  if (name === 'settings') return settingsTool(input, ctx);
  if (name === 'draft_email') return draftEmailTool(input, ctx);
  if (name === 'share') return shareTool(input, ctx);
  if (name === 'open_settings') return openSettingsTool(input, ctx);
  if (name === 'offer_call') return offerCallTool(input, ctx);
  if (name === 'draft_sms') return draftSmsTool(input, ctx);
  if (name === 'draft_whatsapp') return draftWhatsAppTool(input, ctx);
  if (name === 'save_file') return saveFileTool(input, ctx);
  if (name === 'view_attachment') return viewAttachmentTool(input, ctx);
  if (name === 'edit_image') return editImageTool(input, ctx);
  if (name === 'read_pdf') return readPdfTool(input, ctx);

  const tab = currentTab(ctx);
  if (tab.incognito && ctx.privacy) ctx.privacy.touchedIncognito = true;
  if (tab.asleep) {
    const loaded = tab.waitForNextLoad();
    tab.wake();
    await loaded;
  }

  // Reader mode lies over the page: read_page and read_source still read the page itself, while
  // anything that looks at or acts on it shows the page again, so the user sees what happens.
  if (tab.reader && PAGE_TOOLS.has(name) && name !== 'read_page' && name !== 'read_source') {
    await tab.leaveReader();
  }

  if (tab.isNewTab && PAGE_TOOLS.has(name)) {
    return {
      content: 'This tab shows the new tab page; no web page is loaded. Use navigate to open one.',
      isError: name !== 'read_page',
    };
  }
  if (SITE_RULE_TOOL_NAMES.has(name)) {
    if (tab.isNewTab)
      return {
        content: 'This tab shows the new tab page; open a web page first.',
        isError: true,
        notice: errorNotice(t('step.noPage')),
      };
    try {
      return await siteRulesTool(name, input, ctx, tab);
    } catch (e) {
      return {
        content: `The page did not answer: ${e instanceof Error ? e.message : String(e)}`,
        isError: true,
        notice: errorNotice(t('step.pageNoAnswer')),
      };
    }
  }
  // Confirms on its own with the image, every time.
  if (name === 'upload_image') return uploadImageTool(input, ctx, tab);
  if (name === 'upload_file') return uploadFileTool(input, ctx, tab);

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
        if (tab.url !== urlBefore) return { content: `${result} Page changed to ${tab.url}.`, isError: false };
        return { content: result + (await formReport(tab, input.ref, true)), isError: false };
      }
      case 'type': {
        const submit = input.submit === true;
        const urlBefore = tab.url;
        // A hidden value goes straight from memory to the page script, never into a result or a log.
        const result = await tab.run<string>('type', [
          input.ref,
          hidden ? hiddenValue(hidden) : String(input.text ?? ''),
          input.clear !== false,
          submit,
        ]);
        if (submit) await tab.settle();
        // Pages often validate a moment after input; a submit that left the page has nothing to report.
        else await sleep(150);
        const report = tab.url === urlBefore ? await formReport(tab, input.ref, submit) : '';
        if (hidden) {
          return {
            content:
              `Entered the saved ${hiddenLabel(hidden)} into ref=${String(input.ref)}${submit ? ' and submitted' : ''}; ` +
              `the value stays hidden from you.${report}`,
            isError: false,
          };
        }
        return { content: result + report, isError: false };
      }
      case 'select_option': {
        const result = await tab.run<string>('select', [input.ref, String(input.value ?? '')]);
        await sleep(300);
        return { content: result + (await formReport(tab, input.ref, false)), isError: false };
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
        let pdf: RenderedPdf;
        let cut = '';
        if (input.from_screenshots === true) {
          // Screens are captured from the view, so the tab has to be on screen.
          await showTab(ctx, tab);
          const shot = await renderPdfFromScreenshots(tab);
          pdf = shot;
          if (shot.truncated)
            cut = ` The page was very long, so only its first ${shot.screens} screens are in the PDF (the limit for endless pages).`;
        } else {
          pdf = await renderPagePdf(tab);
          if (pdf.imagesMissing > 0) cut = ` ${pdf.imagesMissing} image(s) could not be embedded.`;
        }
        const how = input.from_screenshots === true ? ' from screenshots' : '';
        if (!ctx.offerPdf) {
          await shareRenderedPdf(pdf);
          return { content: `Created "${pdf.fileName}"${how} (${pdf.pages} page(s)) and showed the share sheet to the user.${cut}`, isError: false };
        }
        const info = ctx.offerPdf(pdf);
        return {
          content:
            `Created "${info.name}"${how} (${pdf.pages} page(s), ${formatSize(info.size)}), id=${info.id}. It is shown in ` +
            `the chat as a card with ${pdfButtons()}; nothing was sent. It stays with this conversation: attach it ` +
            'to an email with draft_email, send it with share, or put it into a web page with upload_file, using ' +
            `this id.${cut}`,
          isError: false,
        };
      }
      case 'view_screenshot': {
        await showTab(ctx, tab);
        const mask = await maskHiddenForCapture(tab, ctx);
        if (typeof mask === 'string') return { content: mask, isError: true };
        let shot: Awaited<ReturnType<typeof captureForModel>>;
        try {
          shot = await captureForModel(tab);
        } finally {
          await mask.restore();
        }
        const { width, height, ...image } = shot;
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
        if (tab.isNewTab)
          return { content: 'No web page is loaded in this tab.', isError: true, notice: errorNotice(t('step.noPage')) };
        const page = await speakPage(tab);
        const note = page.truncated ? ' The page is long; only the beginning is read.' : '';
        return { content: `Started reading the page aloud (${page.chars} characters).${note}`, isError: false };
      }
      case 'save_screenshot': {
        await showTab(ctx, tab);
        if (input.full_page === true) {
          const shot = await saveFullPageScreenshot(tab);
          const saved =
            shot.images > 1
              ? `Saved a full-page screenshot to the user's photo library as ${shot.images} images, because the page ` +
                'is too long for one image on this phone; they are cut between screens.'
              : "Saved a full-page screenshot to the user's photo library as one image.";
          const cut = shot.truncated
            ? ` The page was very long; only its first ${shot.screens} screens were captured (the limit for endless pages).`
            : '';
          return { content: `${saved}${cut}`, isError: false };
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
    return { content: `Error: ${e instanceof Error ? e.message : String(e)}`, isError: true, notice: pageErrorNotice(e) };
  }
}
