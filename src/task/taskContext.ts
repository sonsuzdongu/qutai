import { AccessibilityInfo, AppState, Platform } from 'react-native';
import { afterAnswer, isAlwaysAllowed, type AlwaysAllowKind } from '../agent/alwaysAllow';
import type { ToolContext } from '../agent/executeTool';
import type { AgentOptions } from '../agent/runAgent';
import type { MemoryStore } from '../agent/memory';
import { siteKey } from '../agent/sitePolicy';
import { appStore, appsChanged } from '../apps/appStore';
import { appRunner } from '../apps/runnerState';
import type { Browser } from '../browser/Browser';
import type { DownloadRequests } from '../browser/downloadRequests';
import type { Tab } from '../browser/Tab';
import type { AttachmentInfo } from '../chat/attachments';
import {
  appItem,
  callItem,
  cookiesItem,
  fileItem,
  scriptItem,
  shareItem,
  smsItem,
  styleItem,
  whatsAppItem,
  type Conversation,
} from '../chat/Conversation';
import type { ChatItem } from '../components/AssistantPanel';
import { applyTrial, askCookieDelete, askStyle, undoTrial } from '../components/pageCustomisation';
import { askScript, liveOffer } from '../components/pageScripts';
import { scriptSandbox } from '../components/ScriptSandbox';
import { isOffSite } from '../content/siteRules';
import { whileAskingUser } from '../device/backgroundTask';
import { contactsAccessFor } from '../device/contactsAccess';
import { deleteTabCookies, readTabCookies } from '../device/cookieStore';
import { deleteAttachment, storeMadePdf } from '../device/attachments';
import { composeEmail } from '../device/email';
import type { CallOffer } from '../device/phone';
import type { SmsOffer } from '../device/sms';
import type { WhatsAppOffer } from '../device/whatsapp';
import { getLanguage, t } from '../i18n';
import { formatDate } from '../i18n/format';
import type { ActionEntry } from '../storage/actionLog';
import type { Bookmark } from '../storage/bookmarks';
import { getDb, withDb } from '../storage/db';
import { fillTaskPrompt, listSavedTasks, markSavedTaskUsed } from '../storage/savedTasks';
import type { Settings } from '../storage/settings';
import { siteRules } from '../storage/siteRules';
import type { SitePermissionStore } from '../storage/sitePermissions';
import {
  askConfirmation,
  askHiddenValue,
  askImageConfirmation,
  askOutward,
  askPersonalData,
  askSiteRules,
} from './dialogs';

/** A change to the settings, applied to the settings as they are when it lands (never to a copy from earlier). */
export type SettingsPatch = Partial<Settings> | ((current: Settings) => Partial<Settings>);

/** What the tools of every task use from the app: the live settings, the stores, and a few screen actions. */
export type ToolServices = {
  browser: Browser;
  /** The settings as they are now. */
  settings: () => Settings;
  changeSettings: (patch: SettingsPatch) => Promise<void>;
  sitePermissions: SitePermissionStore;
  memory: MemoryStore;
  downloads: DownloadRequests;
  history: NonNullable<ToolContext['history']>;
  log: (entry: ActionEntry) => void;
  /** Bookmarks the assistant removed: the screen offers Undo. */
  bookmarksRemoved: (removed: Bookmark[]) => void;
  /** A saved task was run by name: the recent-task chips follow. */
  savedTaskUsed: () => void;
  showSettings: () => void;
};

/** The task a context is built for. */
export type TaskScope = {
  chat: Conversation;
  signal: AbortSignal;
  /** The conversation is incognito or touched an incognito tab (read at each use: it can become so mid-task). */
  incognito: () => boolean;
};

/** Adds a card to the conversation and says it to a screen reader. */
function offerCard(chat: Conversation, announce: string, item: ChatItem) {
  AccessibilityInfo.announceForAccessibility(announce);
  chat.add(item);
}

/** "Don't ask again" ticked on an allowed confirmation: saved as a patch on the live settings. */
export function rememberDontAskAgain(services: Pick<ToolServices, 'changeSettings'>, kind: AlwaysAllowKind) {
  void services.changeSettings((current) => ({
    alwaysAllow: afterAnswer(current.alwaysAllow, kind, { allowed: true, dontAskAgain: true }),
  }));
}

/** Whether hiding and blocking apply on a site now: "Block ads and trackers" on and the site not turned off. */
function blockingActive(services: ToolServices, site: string): boolean {
  return services.settings().blockAds && !isOffSite(site, services.sitePermissions.blockingOffSites());
}

export function callAnnouncement(offer: CallOffer): string {
  return offer.name
    ? t('chat.callLabel', { name: offer.name, number: offer.number })
    : t('chat.callNumberLabel', { number: offer.number });
}

export function smsAnnouncement(offer: SmsOffer): string {
  return offer.name
    ? t('chat.smsLabel', { name: offer.name, number: offer.number })
    : t('chat.smsNumberLabel', { number: offer.number });
}

export function whatsAppAnnouncement(offer: WhatsAppOffer): string {
  return offer.number
    ? t('chat.whatsAppLabel', { who: offer.name ? `${offer.name}, ${offer.number}` : offer.number })
    : t('chat.whatsAppNoNumberLabel');
}

/** A style the assistant tried on the page: applied now, with its card (Keep… and Undo). */
async function applyStyleTrial(chat: Conversation, target: Tab, css: string, description: string) {
  applyTrial(target, css, description);
  const offer = {
    description,
    site: siteKey(target.url) ?? '',
    url: target.url.replace(/#.*$/, ''),
    css,
    tabId: target.id,
    incognito: target.incognito,
    state: 'applied' as const,
  };
  offerCard(chat, t('styles.cardApplied'), styleItem(offer));
}

/** An image the assistant made: its card; the oldest edited images over the limit lose their files. */
function offerEditedImage(chat: Conversation, info: AttachmentInfo) {
  AccessibilityInfo.announceForAccessibility(t('chat.imageMade', { name: info.name }));
  chat.addEditedImage(info).forEach((id) => deleteAttachment(id));
}

/** The user's own apps: changes tell the My Apps screen; previews only with Qutai on screen. */
function appsAccess(chat: Conversation, scope: TaskScope): NonNullable<ToolContext['apps']> {
  return {
    list: () => appStore.list(),
    load: (id) => appStore.load(id),
    create: async (app) => {
      const pkg = await appStore.create(app);
      appsChanged.emit();
      return pkg;
    },
    change: async (id, change, note) => {
      const pkg = await appStore.change(id, change, 'assistant', note);
      appsChanged.emit();
      return pkg;
    },
    undo: async (id) => {
      const version = await appStore.undo(id);
      appsChanged.emit();
      return version;
    },
    preview: (id) =>
      AppState.currentState === 'active' ? whileAskingUser(() => appRunner.preview(id)) : Promise.resolve('unavailable' as const),
    offer: (offer) => chat.add(appItem(offer)),
    incognito: scope.incognito,
    uiLanguage: getLanguage,
    budget: { writes: 0 },
  };
}

/**
 * The tools' side of a task (everything in ToolContext but the model and the loop's own fields): every dialog is
 * dismissed when the task stops, every setting is read when it is used, and every card lands in the task's
 * conversation.
 */
export function taskToolContext(
  services: ToolServices,
  scope: TaskScope,
): Omit<ToolContext, 'agentTab' | 'askedFrom' | 'privacy' | 'memory'> & Pick<AgentOptions, 'alwaysAllowed'> {
  const { chat, signal } = scope;
  const settings = services.settings;
  return {
    browser: services.browser,
    signal,
    confirm: (description, host, kind) =>
      askConfirmation(description, host, signal, scope.incognito(), kind, (allowedKind) =>
        rememberDontAskAgain(services, allowedKind),
      ),
    alwaysAllowed: (kind) => isAlwaysAllowed(settings().alwaysAllow, kind),
    confirmPersonal: (host, kinds, incognito) => askPersonalData(host, kinds, incognito, signal),
    confirmHidden: (host, what, field, incognito) => askHiddenValue(host, what, field, incognito, signal),
    confirmImage: (options) => whileAskingUser(() => askImageConfirmation(options, signal)),
    confirmOutward: (approval) => whileAskingUser(() => askOutward(approval, signal)),
    // Read at each use: the user may turn it off during a task.
    paymentsAllowed: () => settings().assistantPayments,
    siteRules: {
      list: () => siteRules.rules,
      add: (site, lines, url) => siteRules.add(site, lines, 'assistant', url),
      remove: (ids) => siteRules.remove(ids),
      activeOn: (site) => blockingActive(services, site),
    },
    confirmSiteRules: (approval) =>
      whileAskingUser(() => askSiteRules(approval, blockingActive(services, approval.site), signal)),
    // User styles and the cookie list (docs/page-customisation.md): every apply and every delete is asked.
    pageStyles: {
      approve: (approval) => whileAskingUser(() => askStyle(approval, signal)),
      applyTrial: (target, css, description) => applyStyleTrial(chat, target, css, description),
      undoTrial: async (target) => undoTrial(target),
      kept: () => siteRules.styles,
    },
    cookies: {
      read: (target) => readTabCookies(target),
      remove: (target, keys) => deleteTabCookies(target, keys),
      confirmDelete: (approval) => whileAskingUser(() => askCookieDelete(approval, signal)),
      offer: (target, site, count) => chat.add(cookiesItem({ site, count, tabId: target.id })),
    },
    thirdPartyCookiesBlocked: () => Platform.OS === 'android' && settings().blockThirdPartyCookies,
    // Scripts (docs/page-customisation.md › Scripts): every run is asked, with the code.
    scripts: {
      enabled: () => settings().assistantScripts,
      siteSetting: (site) => settings().scriptSites.find((s) => s.host === site)?.setting ?? 'default',
      syntax: (code) => scriptSandbox.check(code),
      approve: (approval) => whileAskingUser(() => askScript(approval, signal)),
      runCopy: (snapshot, code, pageUrl) => scriptSandbox.run(snapshot, code, pageUrl),
      offer: (offer) => chat.add(scriptItem(liveOffer(offer))),
    },
    // The user's own apps (docs/mini-apps.md): never from an incognito conversation; previews open the runner.
    apps: appsAccess(chat, scope),
    imageUsed: (id) => chat.markImageUsed(id),
    confirmByDefault: settings().confirmActions,
    sites: services.sitePermissions,
    log: services.log,
    history: services.history,
    bookmarks: { db: getDb, removed: services.bookmarksRemoved },
    // Read only: the assistant runs a task the user names; saving, editing and reminders stay with the user.
    savedTasks: {
      list: () => getDb().then(listSavedTasks),
      fill: (prompt) => fillTaskPrompt(prompt, () => formatDate(new Date())),
      markUsed: (id) => {
        void withDb('savedTasks.used', (db) => markSavedTaskUsed(db, id)).then(services.savedTaskUsed);
      },
    },
    // The same path as the Settings screen; the tool only passes allowlisted fields (agent/settingsTool.ts).
    appSettings: {
      get: settings,
      change: (patch) => services.changeSettings(patch),
    },
    composeEmail,
    // Contacts: never in incognito conversations (the tool refuses there too).
    ...(chat.incognito ? {} : { contacts: contactsAccessFor(chat, signal) }),
    offerCall: (offer) => offerCard(chat, callAnnouncement(offer), callItem(offer)),
    offerSms: (offer) => offerCard(chat, smsAnnouncement(offer), smsItem(offer)),
    offerWhatsApp: (offer) => offerCard(chat, whatsAppAnnouncement(offer), whatsAppItem(offer)),
    startDownload: (tab, url, name, type) => services.downloads.fromAssistant(tab, url, name, type),
    offerFile: (file) => offerCard(chat, file.name, fileItem(file)),
    composedFiles: () => chat.composedFiles,
    offerShare: (offer) =>
      offerCard(chat, offer.files.length ? offer.files.map((f) => f.name).join(', ') : t('chat.shareTo'), shareItem(offer)),
    offerPdf: (pdf) => {
      const info = storeMadePdf(pdf.file, pdf.fileName, 'page', scope.incognito());
      AccessibilityInfo.announceForAccessibility(t('chat.pdfMade', { name: info.name }));
      chat.addMadePdf(info, false);
      return info;
    },
    showAppSettings: services.showSettings,
    attachments: () => chat.attachments,
    offerImage: (info) => offerEditedImage(chat, info),
  };
}
