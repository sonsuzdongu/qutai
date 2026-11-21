import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import type { RenderedPdf } from '../device/pdf';
import type { EmailOutcome } from '../device/email';
import type { ComposedRef, Shareable, ShareOffer } from '../chat/shareable';
import { AlwaysAllowKind } from './alwaysAllow';
import { draftEmailTool, shareLog, shareTool, uploadFileTool } from './shareTools';
import { t } from '../i18n';
import { FileOffer } from '../device/composedFile';
import { CallOffer } from '../device/phone';
import { SmsOffer } from '../device/sms';
import { WhatsAppOffer } from '../device/whatsapp';
import { findContactTool, type ContactsAccess } from './contactTool';
import type { ToolImage } from '../ai/types';
import type { AttachmentInfo } from '../chat/attachments';
import { readPdfTool, viewAttachmentTool } from './fileTools';
import { declinedNotice, settingNotice, type StepNotice } from './stepLine';
import type { IconLines } from '../ui/Icon';
import { toolIcon } from './toolIcons';
import { editImageTool, uploadImageTool } from './imageTools';
import { bookmarkNeedsUser, bookmarksTool } from './bookmarkTool';
import { getSavedTaskTool, listSavedTasksTool, type SavedTasksAccess } from './savedTaskTool';
import { settingsTool } from './settingsTool';
import type { Settings } from '../storage/settings';
import type { ActionEntry } from '../storage/actionLog';
import type { HistoryMatch, SiteVisits } from '../storage/history';
import type { Bookmark } from '../storage/bookmarks';
import type { Db } from '../storage/db';
import { HiddenNeedle, redactHidden } from './hiddenValues';
import { Memory, MemoryStore } from './memory';
import { PersonalKind } from './personalData';
import { decide, policyName, SitePolicy, siteKey } from './sitePolicy';
import { enterGate, pressGate, requestApprovalTool, secretFieldGate, type OutwardApproval } from './approvalTool';
import { CARD_NUMBER_TEXT, containsCardNumber, type ApprovalGrants } from './outwardApproval';
import { isLoggedCall, toolSpec, withScheme, type Gate, type ToolSpec } from './toolTable';
import { SCHEDULING_TOOLS, SchedulingTool } from './scheduling';
import { capitalizeFirst, targetWords } from './stepTarget';
import type { ScopeKind } from '../content/siteRules';
import type { SiteRulesAccess, SiteRulesApproval } from './siteRulesTool';
import { SITE_RULE_TOOL_NAMES } from './siteRuleTools';
import type { CookieAccess, PageStylesAccess } from './pageCustomTool';
import { PAGE_CUSTOM_TOOL_NAMES } from './pageCustomTools';
import type { ScriptAccess } from './scriptTool';
import { appsTool, type AppsAccess } from './appTool';
import { OutboundGuard } from './outbound';
import { describeToolCall } from './tools/describe';
import { openSettingsTool, SCHEDULING_LOG_KEYS, schedulingTool, readCalendarLog, readCalendarTool, locationTool } from './tools/device';
import { downloadFileTool, saveFileTool } from './tools/files';
import { outboundGate, hiddenForType, hiddenGate, personalGate } from './tools/gates';
import { searchHistoryTool } from './tools/history';
import { memoryTool } from './tools/memory';
import { siteRulesStep, scriptStep, pageCustomStep, pageTool } from './tools/page';
import { offerCallLog, offerCallTool, draftSmsLog, draftSmsTool, draftWhatsAppLog, draftWhatsAppTool } from './tools/phone';
import { hiddenNeedlesFor, isViewSource, AgentTabClosedError, tabClosed } from './tools/shared';
import { readTab, tabsTool } from './tools/tabs';

export { describeToolCall } from './tools/describe';

export type ToolContext = {
  browser: Browser;
  /**
   * The task's Stop (task/taskRunner.ts): every wait a tool makes (a page load, a pause, a page command, a request)
   * ends when it aborts, so Stop returns within about a second. Absent in tests of single tools.
   */
  signal?: AbortSignal;
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
  /**
   * Approvals for posting and paying in this task (request_approval, agent/outwardApproval.ts): each is one press of
   * one button. Absent: request_approval answers that the user presses the button themselves.
   */
  approvals?: ApprovalGrants;
  /** Settings › Assistant › "Let the assistant complete payments", read at each use (off when absent). */
  paymentsAllowed?: () => boolean;
  /**
   * The publish or pay dialog (what Qutai read on the page, the site, the button), every time: never "don't ask
   * again", whatever the site's setting. True only on Approve.
   */
  confirmOutward?: (approval: OutwardApproval) => Promise<boolean>;
  /**
   * The address book for find_contact and contact handles (agent/contactTool.ts, docs/contacts.md); absent where
   * contacts can't be used.
   */
  contacts?: ContactsAccess;
  /** User styles (restyle_page; agent/pageCustomTool.ts): the approval, the trial and the kept styles. */
  pageStyles?: PageStylesAccess;
  /** The tab's native cookie store (page_cookies): the list without values, deleting after the user's approval. */
  cookies?: CookieAccess;
  /** Android's "Block third-party cookies" setting, for the cookie list's note. */
  thirdPartyCookiesBlocked?: () => boolean;
  /** run_script (agent/scriptTool.ts): the setting, the sandbox, the approval and the script card. */
  scripts?: ScriptAccess;
  /** The user's own apps (apps tool, agent/appTool.ts, docs/mini-apps.md); absent where apps can't be used. */
  apps?: AppsAccess;
  /**
   * What an address the assistant writes may carry to another site (agent/outbound.ts, UNTR-22): set by runAgent for
   * each task. Absent: no check (tests of other tools).
   */
  outbound?: OutboundGuard;
  /**
   * The user's own messages in this conversation, without the notes the app adds (set by runAgent): a memory that
   * isn't in them is asked about before it is saved (agent/memoryOrigin.ts, UNTR-23).
   */
  userTexts?: () => string[];
};

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

/** The page a call acts on (its site decides the permission and is written in the action history), or null. */
function actionTarget(spec: ToolSpec, input: Record<string, unknown>, ctx: ToolContext): { url: string; tab?: Tab } | null {
  if (spec.target === 'none') return null;
  if (spec.target === 'address') return { url: withScheme(input.url) };
  // A PDF the user attached comes from no site.
  if (spec.target === 'pdf' && input.attachment_id !== undefined && input.attachment_id !== '') return null;
  const tab = spec.target === 'readTab' ? ctx.browser.getTab(String(input.tab_id ?? '')) : ctx.browser.getTab(ctx.agentTab.id);
  return tab ? { url: tab.url, tab } : null;
}

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
  const spec = toolSpec(name);
  if (!spec?.background) return spec?.confirmsItself ? 'confirm' : 'onScreen';
  if (name === 'bookmarks' && bookmarkNeedsUser(input, ctx.agentTab)) return 'confirm';
  if (name === 'settings' && input.action !== 'get') return 'onScreen';
  const target = actionTarget(spec, input, ctx);
  const host = target ? siteKey(target.url) : null;
  const level = host && ctx.sites ? ctx.sites.levelFor(host) : 'default';
  const decision = decide(policyName(name, input), host, level, ctx.confirm ? (ctx.confirmByDefault ?? true) : false);
  if (decision.kind === 'confirm' && ctx.confirm) return 'confirm';
  // The tab the call works in needs a live WebView: a sleeping tab's (or a page opened from the new tab page) would
  // have to be created. Page tools on the new tab page only answer that no page is loaded. A closed agent's tab: the
  // call itself answers that (tabClosed).
  const tab =
    name === 'read_tab'
      ? ctx.browser.getTab(String(input.tab_id ?? ''))
      : spec.page || name === 'navigate' || name === 'go_back'
        ? ctx.browser.getTab(ctx.agentTab.id)
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
  let result: ToolOutput;
  try {
    result = await executeUnredacted(name, input, ctx);
  } catch (e) {
    if (!(e instanceof AgentTabClosedError)) throw e;
    result = tabClosed(ctx);
  }
  let needles: HiddenNeedle[];
  try {
    needles = await hiddenNeedlesFor(ctx);
  } catch {
    // Without the list Qutai can't tell whether the result holds a hidden value: it is withheld, not passed on unchecked.
    return {
      content:
        "Qutai couldn't read the user's saved memories to check this result for hidden values, so the result is " +
        'withheld. The action itself may have run: read the page again before going on.',
      isError: true,
      notice: result.notice,
    };
  }
  if (!needles.length) return result;
  return { ...result, content: redactHidden(result.content, needles) };
}

/** click_at's point as fractions of the visible area, as runTool computes it; null when it can't run. */
function clickAtPoint(name: string, input: Record<string, unknown>, tab: Tab): { fx: number; fy: number } | null {
  const size = tab.modelScreenshotSize;
  if (name !== 'click_at' || !size) return null;
  const x = Number(input.x);
  const y = Number(input.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { fx: x / size.width, fy: y / size.height };
}

/**
 * Every call passes one ordered pipeline (TOOL-30): the tool's row in agent/toolTable.ts says which checks apply, and
 * they run in GATE_ORDER: site permission, outbound address, secret field, personal data, press, confirmation. A tool
 * without a row is refused.
 */
async function executeUnredacted(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const spec = toolSpec(name);
  if (!spec || spec.loop) return { content: `Unknown tool: ${name}`, isError: true };
  const gate = (g: Gate) => spec.gates.includes(g);
  // Checked before the site permission, which would otherwise ask about a made-up host.
  if ((name === 'navigate' || name === 'open_tab') && isViewSource(input.url)) {
    return {
      content:
        'view-source: URLs cannot be opened in this browser. Call read_source to read the HTML source of the ' +
        'current page instead (navigate to the page itself first if needed).',
      isError: true,
    };
  }
  const fromTab = ctx.browser.getTab(ctx.agentTab.id);
  // The user closed the assistant's tab: nothing acts on another tab with the closed page's element numbers.
  if (spec.tab === 'agent' && !fromTab) return tabClosed(ctx);
  const target = actionTarget(spec, input, ctx);
  const host = target ? siteKey(target.url) : null;
  const level = host && ctx.sites ? ctx.sites.levelFor(host) : 'default';
  const decision = decide(policyName(name, input), host, level, ctx.confirm ? (ctx.confirmByDefault ?? true) : false);

  const record = (result: ToolOutput): ToolOutput => {
    const incognito = !!(ctx.privacy?.touchedIncognito || target?.tab?.incognito || fromTab?.incognito);
    if (ctx.log && isLoggedCall(spec, input) && !incognito) {
      ctx.log({
        at: Date.now(),
        host,
        url: target && host ? target.url : null,
        tool: name,
        // Typed text can be personal, so the history only says where something was typed.
        description:
          name === 'type'
            ? capitalizeFirst(t('action.typeRedacted', { target: targetWords(name, input) }))
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

  // What an earlier check already asked the user, so the confirmation doesn't ask again.
  let approvedAddress = false;
  let personalAsked = false;
  let approvedPress = false;

  // 1. Site permission. Refused and declined actions are recorded too, so the history shows what was stopped.
  if (decision.kind === 'refuse') {
    const shown = t(level === 'blocked' ? 'step.siteBlocked' : 'step.siteReadOnly', { host: host ?? '' });
    return record({ content: decision.reason, isError: true, notice: settingNotice(shown) });
  }

  // 2. An address the model wrote that carries the user's details to another site is the user's decision (UNTR-22).
  const address = gate('outbound') ? (spec.address?.(input) ?? null) : null;
  if (address) {
    const out = await outboundGate(address, ctx);
    if (typeof out === 'object') return record(out);
    approvedAddress = out === 'approved';
  }

  // type: a hidden memory is looked up here and its value only handed to the page-typing path (runTool).
  const hidden = name === 'type' ? await hiddenForType(input, ctx) : null;
  if (hidden && 'error' in hidden) return record({ content: hidden.error, isError: true });
  if (name === 'type' && !hidden && typeof input.text !== 'string')
    return record({ content: 'Give the text to type (or memory for a hidden saved value).', isError: true });
  const page = target?.tab && !target.tab.isNewTab ? target.tab : null;

  // 3. Secret fields: Qutai never types into a password, one-time code, card number or security code field (the page
  // script recognises the field: browser/pageScript.ts secretKind), nor a payment card number anywhere.
  if (gate('secret')) {
    if (page) {
      const refused = await secretFieldGate(page, input.ref);
      if (refused) return record(refused);
    }
    if (!hidden && typeof input.text === 'string' && containsCardNumber(input.text))
      return record({ content: CARD_NUMBER_TEXT, isError: true, notice: settingNotice(t('step.cardNumber')) });
  }

  // 4. Remembered personal details need the site's permission, checked here in the app, not left to the prompt.
  if (gate('personal')) {
    if (hidden && target) {
      const out = await hiddenGate(hidden.memory, input, target.url, host, ctx, target.tab);
      if (out.kind === 'refuse') return record({ content: out.reason, isError: true, notice: out.notice });
      personalAsked = true;
    } else if (host) {
      const out = await personalGate(name, input, host, ctx, target?.tab);
      if (out.kind === 'refuse') return record({ content: out.reason, isError: true, notice: out.notice });
      personalAsked = out.kind === 'asked';
    }
  }

  // 5. Presses: a press or Enter the user approved in the publish, pay or change dialog is checked and used up here;
  // a final payment, delete or account press, or one that sends the assistant's text, without one is refused
  // (agent/approvalTool.ts).
  if (gate('press') && page) {
    const out =
      name === 'type'
        ? input.submit === true && !hidden
          ? await enterGate(input, ctx, page)
          : null
        : await pressGate(name as 'click' | 'click_at', input, ctx, page, clickAtPoint(name, input, page));
    if (out?.kind === 'refuse') return record(out.output);
    approvedPress = out?.kind === 'approved';
  }

  // An incognito tab makes the conversation incognito before the question, so it offers nothing to remember.
  if ((target?.tab?.incognito || fromTab?.incognito) && ctx.privacy) ctx.privacy.touchedIncognito = true;

  // 6. "Ask before every action" and the site's Ask level. The personal-information question already named this
  // entry, an approved press was just asked in its dialog, an approved address in its own; tools that confirm on
  // their own ask with their details.
  if (gate('confirm') && decision.kind === 'confirm' && ctx.confirm && !personalAsked && !approvedPress && !approvedAddress) {
    const allowed = await ctx.confirm({ lines: [{ icon: toolIcon(name, input), text: describeToolCall(name, input) }] }, host);
    if (!allowed)
      return record({ content: 'The user declined this action. Ask them how to proceed.', isError: true, notice: declinedNotice() });
  }
  return record(await runTool(name, input, ctx, { hidden: hidden?.memory, addressApproved: approvedAddress }));
}

/** A tool that runs without the assistant's tab; `addressApproved`: the user approved its address (outbound gate). */
type OwnTool = (name: string, input: Record<string, unknown>, ctx: ToolContext, addressApproved: boolean) => Promise<ToolOutput> | ToolOutput;
/** A tool that works in the assistant's tab once it is awake and shows a page. */
type InTabTool = (name: string, input: Record<string, unknown>, ctx: ToolContext, tab: Tab) => Promise<ToolOutput>;

/**
 * A dispatch table in checking order: when a name comes twice the first entry wins (run_script is also one of the
 * page-customisation tools by name, and has its own handling first).
 */
function table<T>(entries: [string, T][]): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const [name, run] of entries) if (!map.has(name)) map.set(name, run);
  return map;
}

/**
 * Tools that don't need the assistant's tab. The scheduling tools, location, calendar and downloads confirm on their
 * own every time, with the details of what will be added, read or downloaded.
 */
const OWN_TOOLS = table<OwnTool>([
  ...[...SCHEDULING_TOOLS].map((n): [string, OwnTool] => [n, (name, input, ctx) => schedulingTool(name as SchedulingTool, input, ctx)]),
  ['get_location', (_name, input, ctx) => locationTool(input, ctx)],
  ['read_calendar', (_name, input, ctx) => readCalendarTool(input, ctx)],
  ['download_file', (_name, input, ctx, addressApproved) => downloadFileTool(input, ctx, addressApproved)],
  ['remember', (_name, input, ctx) => memoryTool('remember', input, ctx)],
  ['forget', (_name, input, ctx) => memoryTool('forget', input, ctx)],
  ['read_tab', (_name, input, ctx) => readTab(input, ctx)],
  ['search_history', (_name, input, ctx) => searchHistoryTool(input, ctx)],
  ['bookmarks', (_name, input, ctx) => bookmarksTool(input, ctx)],
  ['list_saved_tasks', (_name, _input, ctx) => listSavedTasksTool(ctx.savedTasks)],
  ['get_saved_task', (_name, input, ctx) => getSavedTaskTool(input, ctx.savedTasks)],
  ['settings', (_name, input, ctx) => settingsTool(input, ctx)],
  ['draft_email', (_name, input, ctx) => draftEmailTool(input, ctx)],
  ['share', (_name, input, ctx) => shareTool(input, ctx)],
  ['open_settings', (_name, input, ctx) => openSettingsTool(input, ctx)],
  ['find_contact', (_name, input, ctx) => findContactTool(input, ctx)],
  ['offer_call', (_name, input, ctx) => offerCallTool(input, ctx)],
  ['draft_sms', (_name, input, ctx) => draftSmsTool(input, ctx)],
  ['draft_whatsapp', (_name, input, ctx) => draftWhatsAppTool(input, ctx)],
  ['save_file', (_name, input, ctx) => saveFileTool(input, ctx)],
  ['view_attachment', (_name, input, ctx) => viewAttachmentTool(input, ctx)],
  ['edit_image', (_name, input, ctx) => editImageTool(input, ctx)],
  ['read_pdf', (_name, input, ctx) => readPdfTool(input, ctx)],
  ['apps', (_name, input, ctx) => appsTool(input, ctx)],
]);

/**
 * Tools of the assistant's tab with their own handling (the rest are the page tools, tools/page.ts). upload_image
 * confirms on its own with the image, every time; request_approval asks in its own dialog with what it reads on the
 * page.
 */
const IN_TAB_TOOLS = table<InTabTool>([
  ...[...SITE_RULE_TOOL_NAMES].map((n): [string, InTabTool] => [n, siteRulesStep]),
  ['run_script', scriptStep],
  ...[...PAGE_CUSTOM_TOOL_NAMES].map((n): [string, InTabTool] => [n, pageCustomStep]),
  ['upload_image', (_name, input, ctx, tab) => uploadImageTool(input, ctx, tab)],
  ['upload_file', (_name, input, ctx, tab) => uploadFileTool(input, ctx, tab)],
  ['request_approval', (_name, input, ctx, tab) => requestApprovalTool(input, ctx, tab)],
]);

/**
 * Runs a call that passed its checks. `hidden`: the hidden memory type enters instead of `text` (already checked and
 * confirmed by the caller); `addressApproved`: the user approved the model's address in the outbound dialog.
 */
async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
  { hidden, addressApproved = false }: { hidden?: Memory; addressApproved?: boolean } = {},
): Promise<ToolOutput> {
  const { browser } = ctx;

  const own = OWN_TOOLS.get(name);
  if (own) return own(name, input, ctx, addressApproved);

  // The tab tools work without the assistant's tab (the user may have closed it); everything else needs it.
  const agentTab = browser.getTab(ctx.agentTab.id);
  if (agentTab?.incognito && ctx.privacy) ctx.privacy.touchedIncognito = true;
  if (agentTab?.asleep) {
    const loaded = agentTab.waitForNextLoad(undefined, ctx.signal);
    agentTab.wake();
    await loaded;
  }
  const tabTool = await tabsTool(name, input, ctx, agentTab);
  if (tabTool) return tabTool;
  if (!agentTab) return tabClosed(ctx);
  const tab = agentTab;

  // Reader mode lies over the page: read_page and read_source still read the page itself, while
  // anything that looks at or acts on it shows the page again, so the user sees what happens.
  const isPageTool = !!toolSpec(name)?.page;
  if (tab.reader && isPageTool && name !== 'read_page' && name !== 'read_source') {
    await tab.leaveReader();
  }

  if (tab.isNewTab && isPageTool) {
    return {
      content: 'This tab shows the new tab page; no web page is loaded. Use navigate to open one.',
      isError: name !== 'read_page',
    };
  }
  const inTab = IN_TAB_TOOLS.get(name);
  if (inTab) return inTab(name, input, ctx, tab);

  return pageTool(name, input, ctx, tab, hidden);
}
