import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  Appearance,
  AppState,
  Linking,
  Platform,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { PersonalKind } from './src/agent/personalData';
import { runAgent } from './src/agent/runAgent';
import { askSitePermission, SitePromptAnswer } from './src/browser/sitePrompt';
import { personalKindsLabel } from './src/components/memoryCategories';
import { Conversation, callItem, fileItem, newItem, shareItem, smsItem, sourcesItem, userItem, whatsAppItem } from './src/chat/Conversation';
import { listShareables, type ShareApp, type ShareOffer } from './src/chat/shareable';
import { clearOutgoing, OutgoingError, prepareOutgoing } from './src/device/outgoing';
import { shareToApp } from './src/device/share';
import { AttachmentInfo, describeAttachments, isIncognitoAttachment, MAX_ATTACHMENTS } from './src/chat/attachments';
import { parseEditRequest } from './src/chat/imageEdit';
import { editImage } from './src/device/imageEdit';
import {
  AttachmentError,
  deleteAttachment,
  forgetIncognitoAttachments,
  importFile,
  MAX_PDF_BYTES,
  pickImages,
  pickPdf,
  pruneAttachments,
  saveAttachmentToFolder,
  saveAttachmentToPhotos,
  shareAttachment,
  storeMadePdf,
  takePhoto,
} from './src/device/attachments';
import { AttachmentPreview } from './src/components/AttachmentViews';
import { PdfReaderHost } from './src/components/PdfReaderHost';
import { geminiStreamingAvailable } from './src/ai/gemini';
import { creditsStore, creditsReady, refreshCredits, useCreditsState } from './src/credits';
import { creditsLabel } from './src/components/AnswerCost';
import { nothingSent, RelayError } from './src/credits/errors';
import { offeredModels } from './src/credits/rules';
import type { PublicConfig } from './src/credits/types';
import { accountSession, useAccountState } from './src/account';
import { lostQutaiAccount } from './src/credits/gate';
import type { ProviderId } from './src/ai/types';
import { askCreditsDisclosure } from './src/components/CreditsDisclosure';
import type { AnswerCost } from './src/ai/cost';
import { getProvider, isConfigured, modelLabel, requestTarget } from './src/ai/providers';
import { loadCatalog } from './src/ai/openrouterModels';
import { Browser, ClosedTab, useBrowser } from './src/browser/Browser';
import { ContextTarget, looksLikePdfLink } from './src/browser/contextMenu';
import { quoteSelection } from './src/browser/selection';
import type { Tab } from './src/browser/Tab';
import { useHardwareBack } from './src/browser/useHardwareBack';
import { AddressBar } from './src/components/AddressBar';
import { BrowserView } from './src/components/BrowserView';
import { ContextAction, ContextMenuSheet } from './src/components/ContextMenuSheet';
import { AssistantPanel, QuickAction, type ChatItemAction } from './src/components/AssistantPanel';
import { FindBar } from './src/components/FindBar';
import { KeyboardAvoidingContainer } from './src/components/KeyboardAware';
import { LibraryScreen, LibraryTab } from './src/components/LibraryScreen';
import { IconItem, MenuItem, PageMenu } from './src/components/PageMenu';
import { SettingsModal, type SettingsPage } from './src/components/SettingsModal';
import { AssistantIntro, assistantIntroSeen, setAssistantIntroSeen } from './src/components/AssistantIntro';
import { CalendarChoiceHost } from './src/components/CalendarChoiceScreen';
import { SelectionAction, SelectionBar } from './src/components/SelectionBar';
import { TabSwitcher } from './src/components/TabSwitcher';
import { TextSizeSheet } from './src/components/TextSizeSheet';
import { ReaderSettingsSheet } from './src/components/ReaderSettingsSheet';
import { conversationModelInfo, ModelSheet } from './src/components/ModelSheet';
import { sleep } from './src/utils/sleep';
import { emptyTask, TaskDraft, TasksScreen } from './src/components/TasksScreen';
import {
  fillTaskPrompt,
  getSavedTask,
  listSavedTasks,
  markSavedTaskUsed,
  recentSavedTasks,
  SavedTask,
} from './src/storage/savedTasks';
import { syncTaskReminders } from './src/device/taskSchedule';
import { formatDate, formatSize } from './src/i18n/format';
import { Toast, useToast } from './src/components/Toast';
import { DownloadIndicator } from './src/components/DownloadIndicator';
import { openDownload } from './src/components/openDownload';
import { CaptureOverlay } from './src/components/CaptureOverlay';
import { dialog, DialogHost } from './src/components/Dialog';
import { copyLink, copyText, shareLink, shareText } from './src/device/link';
import { printPage, savePagePdf, savePdfFromScreenshots } from './src/device/pdf';
import { saveImage } from './src/device/saveImage';
import { CaptureCancelled } from './src/device/fullPage';
import { offerSettings, PermissionDeniedError } from './src/device/settings';
import { saveFullPageScreenshot, saveScreenshot } from './src/device/screenshot';
import { speak, speakPage, stopSpeaking, useIsSpeaking } from './src/device/speech';
import { stopVoiceInput } from './src/device/voiceInput';
import { PushToTalkBubble, usePushToTalk } from './src/components/PushToTalk';
import { AUTO_LANGUAGE, automaticLanguage, languageName, listeningOrder } from './src/device/voiceLanguage';
import { useIncognitoProtection } from './src/device/useIncognitoProtection';
import { deleteLeftoverIncognitoProfiles } from './src/device/webviewProfile';
import { t, useLanguage } from './src/i18n';
import {
  addBookmark,
  Bookmark,
  isBookmarked,
  notifyBookmarksChanged,
  onBookmarksChanged,
  removeBookmark,
  restoreBookmarks,
} from './src/storage/bookmarks';
import { getDb } from './src/storage/db';
import { deviceMemoryStore } from './src/storage/memory';
import { ActionEntry, addAction, pruneActions } from './src/storage/actionLog';
import { deleteHistorySince, mostVisitedSites, searchHistory } from './src/storage/history';
import { composeEmail } from './src/device/email';
import { placeCall } from './src/device/phone';
import { SEARCH_ENGINES, searchResultsOf } from './src/browser/search';
import { openSmsComposer } from './src/device/sms';
import { openWhatsApp } from './src/device/whatsapp';
import { NotificationOrigin, incognitoOriginTab, initNotifications } from './src/device/notifications';
import { nowContext } from './src/agent/scheduling';
import { interfaceLanguageNote } from './src/agent/uiLabels';
import { renderReportPdf } from './src/device/reportPdf';
import { authenticate } from './src/device/biometric';
import { scannedTarget } from './src/device/qr';
import { toUrl } from './src/browser/url';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { IntroVariant, LaunchIntro } from './src/components/LaunchIntro';
import { LockScreen } from './src/components/LockScreen';
import { Onboarding } from './src/components/Onboarding';
import { contentBlocking } from './src/content/blocking';
import {
  canPinSiteShortcut,
  Entry,
  pinSiteShortcut,
  setLaunchAppearance,
  useEntryPoints,
} from './src/device/entryPoints';
import { ActionSheet, SheetAction } from './src/components/ActionSheet';
import { LEGAL_VERSION } from './src/legal/documents';
import { LogoMotion } from './src/ui/QutaiMark';
import { OfflinePagesScreen } from './src/components/OfflinePagesScreen';
import { deleteOfflineFile, savePageOffline } from './src/device/offline';
import { addOfflinePage, listOfflinePages, removeOfflinePage } from './src/storage/offlinePages';
import { QrCodeSheet } from './src/components/QrCodeSheet';
import { QrScanner } from './src/components/QrScanner';
import { captureRef } from 'react-native-view-shot';
import { clearInsecureExceptions, upgradeToHttps } from './src/browser/httpsOnly';
import { usesCertificateException } from './src/browser/certificateExceptions';
import { ClearOptions, rangeStart } from './src/storage/clearData';
import { deleteActionsSince } from './src/storage/actionLog';
import { deleteSentSince, moveSentConversation, pruneSent } from './src/storage/sentLog';
import { SentLogScreen } from './src/components/SentLogScreen';
import { bump, setHapticsEnabled, success, tick } from './src/device/haptics';
import { FileExpiredError, saveComposedFileToFolder, shareComposedFile } from './src/device/composedFile';
import { DownloadItem, DownloadStore } from './src/storage/downloads';
import { AndroidDownloads, nativeDownloads } from './src/storage/androidDownloads';
import { IosDownloads } from './src/storage/iosDownloads';
import { DownloadRequests } from './src/browser/downloadRequests';
import { File } from 'expo-file-system';
import { DownloadsScreen } from './src/components/DownloadsScreen';
import * as Sharing from 'expo-sharing';
import { SitePermissionStore } from './src/storage/sitePermissions';
import { siteKey } from './src/agent/sitePolicy';
import { pageSuggestions } from './src/agent/pageSuggestions';
import { SitePermissionSheet } from './src/components/SitePermissionSheet';
import { SitePermissionsScreen } from './src/components/SitePermissionsScreen';
import { configurePageLocation } from './src/browser/geolocation';
import { configurePageMedia } from './src/browser/mediaCapture';
import { pauseAllPages } from './src/browser/playback';
import { configureBackgroundMedia, setPictureInPictureAllowed } from './src/device/backgroundMedia';
import {
  beginBackgroundTask,
  configureBackgroundTasks,
  endBackgroundTask,
  onBackgroundOpenRequested,
  onBackgroundStopRequested,
  TaskOutcome,
} from './src/device/backgroundTask';
import { deleteOrphanChats, loadChat, savedAttachmentIds, storeChat } from './src/storage/chat';
import { loadRecentlyClosed, loadSession, Session } from './src/storage/session';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings, ThemeSetting } from './src/storage/settings';
import type { IconLines } from './src/ui/Icon';
import { holdSplash } from './src/ui/launch';
import { darkPalette, lightPalette } from './src/ui/theme';
import { usePersistSession } from './src/storage/usePersistSession';
import { useRecordHistory } from './src/storage/useRecordHistory';

// The native splash stays until the first real frame is ready (src/ui/launch.ts).
holdSplash();
// The launch intro plays once per process: not again when Android recreates the activity with the app running.
let introPlayed = false;

/** The theme setting overrides the system appearance for the whole app, web pages included. */
function applyTheme(theme: ThemeSetting) {
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
}

const memoryStore = deviceMemoryStore(getDb);
const sitePermissions = new SitePermissionStore(getDb);
// Web pages' location requests check (and "Always allow" saves) the per-site location setting.
configurePageLocation(sitePermissions);
// Their camera and microphone requests check (and "Always allow" saves) the per-site camera and microphone settings.
configurePageMedia(sitePermissions);
const getSitePermissionsVersion = () => sitePermissions.version;
// Downloads: Qutai's own on both platforms (Android: modules/qutai-downloads; iOS: in the app), one list and screen.
const downloads = new DownloadStore(Platform.OS === 'android' ? new AndroidDownloads() : new IosDownloads(getDb));
const downloadRequests = new DownloadRequests(downloads);

const historySearch = {
  search: async (query: string, from: number, to: number) => searchHistory(await getDb(), { query, from, to }),
  sites: async (query: string, from: number, to: number) => mostVisitedSites(await getDb(), { query, from, to }),
};

/** Records an agent action for the activity screen. */
function logAction(entry: ActionEntry) {
  getDb()
    .then((db) => addAction(db, entry))
    .catch(() => {});
}

// Conversations saved by earlier versions belong to the tab that is active on the first start.
let legacyChatPending = true;

/** Reads a conversation's saved messages from disk, once (the key is read when the database is ready). */
function readConversation(chat: Conversation, adoptLegacy = false) {
  if (chat.loaded || chat.loading) return;
  chat.loading = true;
  getDb()
    .then((db) => loadChat(db, chat.key, { adoptLegacy }))
    .catch(() => null)
    .then((saved) => chat.restore(saved));
}

/** The agent's "may I?" before an action. Stopping the task (signal) dismisses it as declined. */
async function askConfirmation(
  description: string | IconLines,
  host: string | null,
  signal: AbortSignal,
): Promise<boolean> {
  const text = typeof description === 'string' ? description : null;
  const result = await dialog.show({
    title: t('confirm.title'),
    ...(typeof description === 'string' ? {} : { lines: description }),
    message: text && host ? `${text}\n\n${host}` : (text ?? host ?? undefined),
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: t('confirm.allow') }],
    checkbox: host ? { label: t('confirm.always', { host }) } : undefined,
    signal,
  });
  const allowed = result.button === 1;
  if (allowed && host && result.checked) sitePermissions.set(host, 'allow').catch(() => {});
  return allowed;
}

/**
 * The assistant giving a picture to a page (upload_image), or saving it to Photos instead: the picture and what
 * happens, every time, with no "always allow" (an image can be personal, whatever the site's setting). Stopping the
 * task dismisses it as declined.
 */
async function askImageConfirmation(
  options: { title: string; message: string; image?: { uri: string; aspectRatio: number }; confirmText: string },
  signal: AbortSignal,
): Promise<boolean> {
  const result = await dialog.show({
    title: options.title,
    message: options.message,
    ...(options.image ? { image: { ...options.image, label: options.title } } : {}),
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: options.confirmText, primary: true }],
    signal,
  });
  return result.button === 1;
}

/**
 * Before the assistant first enters remembered personal details on a site in a task: which kinds, on which site.
 * "Allow once" (emphasised) covers the site until the task ends; "Always allow on this site" is saved (not offered in
 * incognito). Stopping the task dismisses it as declined.
 */
async function askPersonalData(
  host: string,
  kinds: PersonalKind[],
  incognito: boolean,
  signal: AbortSignal,
): Promise<SitePromptAnswer> {
  const answer = await askSitePermission({
    title: t('personal.title', { host }),
    message: t('personal.body', { what: personalKindsLabel(kinds) }),
    incognito,
    signal,
  });
  if (answer === 'always') sitePermissions.setPersonal(host, 'allow').catch(() => {});
  return answer;
}

/**
 * Before Qutai types a hidden memory (`what`: what it is, never the value) into a field on a site: the first time for
 * each hidden value and site in a task, whatever the site's personal-information setting (blocked sites never get
 * here). No "always": the dialog says the rule. Stopping the task dismisses it as declined.
 */
async function askHiddenValue(
  host: string,
  what: string,
  field: string,
  incognito: boolean,
  signal: AbortSignal,
): Promise<boolean> {
  const lines = [
    ...(field ? [t('hidden.field', { field })] : []),
    t('hidden.body'),
    ...(incognito ? [t('hidden.incognito')] : []),
  ];
  const result = await dialog.show({
    title: t('hidden.title', { what, host }),
    message: lines.join('\n\n'),
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: t('hidden.enter'), primary: true }],
    signal,
  });
  return result.button === 1;
}

export default function App() {
  // Re-renders the whole tree in the new language when the device language changes.
  const language = useLanguage();
  // Android: the download notifications follow the app's language.
  useEffect(() => nativeDownloads?.setLanguage(language), [language]);
  // The screen stays on while the app is open: reading pages and watching a task run shouldn't
  // be interrupted by the screen dimming or locking (and a locked phone would freeze a task).
  useKeepAwake();
  /** Settings are read first (a few milliseconds): they decide the theme, the intro and the app lock. */
  const [boot, setBoot] = useState<{ settings: Settings; intro: IntroVariant } | null>(null);
  const [restored, setRestored] = useState<{
    session: Session | null;
    recentlyClosed: ClosedTab[];
    settings: Settings;
  } | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    // Settings come first too, so a locked app never shows its tabs before the lock screen.
    const settings = loadSettings().catch(() => DEFAULT_SETTINGS);
    Promise.all([settings, AccessibilityInfo.isReduceMotionEnabled().catch(() => false)]).then(([s, reduceMotion]) => {
      applyTheme(s.theme);
      const intro: IntroVariant = s.appLock
        ? 'plain'
        : introPlayed || reduceMotion || !s.animateLogo
          ? 'still'
          : 'animate';
      introPlayed = true;
      setBoot({ settings: s, intro });
    });
    getDb()
      .then((db) => Promise.all([loadSession(db), loadRecentlyClosed(db)]))
      .catch((): [null, ClosedTab[]] => [null, []])
      .then(async ([session, recentlyClosed]) => setRestored({ session, recentlyClosed, settings: await settings }));
  }, []);

  // The app's appearance: the system's until the settings are read, then the theme setting's (applyTheme updates
  // it at once, before the first frame with the intro). Behind every view (and, on iOS, the window at the next
  // launch): the screen background of that appearance.
  const dark = useColorScheme() === 'dark';
  useEffect(() => {
    SystemUI.setBackgroundColorAsync((dark ? darkPalette : lightPalette).bg).catch(() => {});
  }, [dark]);
  const onIntroDone = useCallback(() => setIntroDone(true), []);
  const onUnlocked = useCallback(() => setUnlocked(true), []);

  // Before the settings are read: the splash's colour, under the native splash.
  if (!boot) return <View style={[styles.flex, { backgroundColor: (dark ? darkPalette : lightPalette).bg }]} />;
  // First run, or the privacy policy / terms changed since the user accepted them.
  const onboarding = restored && (!restored.settings.onboarded || restored.settings.legalAcceptedVersion < LEGAL_VERSION);
  let content: ReactNode = null;
  if (restored && onboarding) {
    content = (
      <Onboarding
        settings={restored.settings}
        legalOnly={restored.settings.onboarded}
        onDone={(next) => {
          saveSettings(next).catch(() => {});
          setRestored({ ...restored, settings: next });
        }}
      />
    );
  } else if (restored) {
    content = (
      <ErrorBoundary full>
        <BrowserApp
          initialSession={restored.session}
          recentlyClosed={restored.recentlyClosed}
          initialSettings={restored.settings}
          onUnlocked={onUnlocked}
        />
      </ErrorBoundary>
    );
  }
  // The safe-area provider is here, above setup as well as the browser: dialogs (DialogView), sheets and toasts read
  // the insets from it, and without one they throw. Setup's first dialog (the Qutai Credits disclosure) crashed the
  // app when the provider was only inside the browser.
  return (
    <SafeAreaProvider>
      <View style={[styles.flex, { backgroundColor: (dark ? darkPalette : lightPalette).bg }]}>
        {content}
        {!introDone && (
          <LaunchIntro
            variant={boot.intro}
            dark={dark}
            ready={restored !== null}
            // The app lock: the cover stays (under the lock screen) until the user unlocks; onboarding has no lock.
            hold={boot.intro === 'plain' && !onboarding && !unlocked}
            onDone={onIntroDone}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

function BrowserApp({
  initialSession,
  recentlyClosed,
  initialSettings,
  onUnlocked,
}: {
  initialSession: Session | null;
  recentlyClosed: ClosedTab[];
  initialSettings: Settings;
  /** The app lock is open (right away when it is off). */
  onUnlocked: () => void;
}) {
  const [browserInstance] = useState(() => new Browser(initialSession, recentlyClosed));
  // Android: incognito profiles left from an earlier run (the app was killed with incognito tabs open; they are
  // never restored) are deleted before any incognito tab opens again.
  useEffect(() => deleteLeftoverIncognitoProfiles(), []);
  const browser = useBrowser(browserInstance);
  const tab = browser.active;
  useHardwareBack(browser);
  usePersistSession(browser);
  useRecordHistory(browser);

  // A tab group shares one conversation, an ungrouped tab has its own; only one task runs at a time.
  const conversation = browser.conversationOf(tab);
  const runningChat = browser.conversations.find((x) => x.running);
  const running = runningChat !== undefined;
  const runningTab = runningChat && browser.tabs.find((x) => browser.conversationOf(x) === runningChat);
  const [panelOpen, setPanelOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  // Text selected on a page; like find in page, it only counts for the page it came from.
  const [selection, setSelection] = useState<{ tabId: string; url: string; text: string } | null>(null);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  // Read when a task ends, which can be long after the render that started it.
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;
  /** A task ended in a conversation the user has not seen since: the Qutai button shows a dot until they do. */
  const unseenChat = browser.conversations.find((x) => x.unseen);
  // Showing a conversation is seeing it.
  useEffect(() => {
    if (panelOpen && conversation.unseen) conversation.setUnseen(null);
  }, [panelOpen, conversation, conversation.unseen]);

  const [settings, setSettings] = useState<Settings>(initialSettings);
  // The latest settings for code that runs later than a render (the assistant's settings tool).
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Read when a task ends, which can be long after the render that started it.
  const notifyTaskDoneRef = useRef(settings.notifyTaskDone);
  notifyTaskDoneRef.current = settings.notifyTaskDone;
  const [pinShortcuts] = useState(canPinSiteShortcut);

  // Network ad and tracker blocking: the master switch, and list downloads only once the terms are accepted (the
  // browser shows only after that) and while blocking is on: at start and when the app comes back, rate-limited.
  useSyncExternalStore(contentBlocking.subscribe, contentBlocking.getVersion);
  useEffect(() => {
    contentBlocking.setMaster(settings.blockAds).catch(() => {});
  }, [settings.blockAds]);
  const blockingAllowed = settings.blockAds && settings.legalAcceptedVersion > 0;
  useEffect(() => {
    if (!blockingAllowed) return;
    contentBlocking.autoUpdate(true).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') contentBlocking.autoUpdate(true).catch(() => {});
    });
    return () => sub.remove();
  }, [blockingAllowed]);

  // App lock: on start and whenever the app went to the background. Incognito lock: incognito tabs
  // stay hidden after leaving the app until the user unlocks them again.
  const [appLocked, setAppLocked] = useState(initialSettings.appLock);
  const [incognitoUnlocked, setIncognitoUnlocked] = useState(false);
  useEffect(() => {
    if (!appLocked) onUnlocked();
  }, [appLocked, onUnlocked]);
  const lock: 'app' | 'incognito' | null = appLocked
    ? 'app'
    : settings.incognitoLock && tab.incognito && !incognitoUnlocked
      ? 'incognito'
      : null;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return;
      setIncognitoUnlocked(false);
      if (settings.appLock) setAppLocked(true);
    });
    return () => sub.remove();
  }, [settings.appLock]);
  const unlock = async () => {
    if (!(await authenticate(t(lock === 'incognito' ? 'lock.incognitoPrompt' : 'lock.appPrompt')))) return;
    setAppLocked(false);
    setIncognitoUnlocked(true);
  };
  const leaveIncognito = () => {
    const normal = browser.tabsOf(false);
    if (normal.length) browser.switchTab(normal[normal.length - 1].id);
    else browser.openTab();
  };
  const [settingsVisible, setSettingsVisible] = useState(false);
  /** The page Settings opens on next (reset to the main page when it closes). */
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('main');
  const settingsVisibleRef = useRef(false);
  settingsVisibleRef.current = settingsVisible;
  const openSettings = (page: SettingsPage = 'main') => {
    setSettingsPage(page);
    setSettingsVisible(true);
  };
  /**
   * Qutai Credits is the provider but there is no account (signed out, deleted, session ended, a restored backup):
   * sign in, or choose another provider. Nothing is lost: a message being sent is back in the input.
   */
  const promptQutaiSignIn = () => {
    void dialog
      .show({
        title: t('credits.signInPromptTitle'),
        message: t('credits.signInPromptBody'),
        buttons: [
          { text: t('credits.notNow'), style: 'cancel' },
          { text: t('credits.useOwnKey') },
          { text: t('credits.signIn'), primary: true },
        ],
      })
      .then((r) => {
        if (r.button === 1) openSettings('assistant');
        if (r.button === 2) openSettings('account');
      });
  };
  const onItemAction = (action: ChatItemAction) => {
    if (action === 'signIn') promptQutaiSignIn();
  };
  // The first-run introduction to the Qutai button (once; Settings › Assistant shows it again).
  const [introPending, setIntroPending] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    assistantIntroSeen().then((seen) => {
      // A moment after the browser appears, so the address bar is laid out.
      if (!seen) timer = setTimeout(() => setIntroPending(true), 700);
    });
    return () => clearTimeout(timer);
  }, []);
  const dismissIntro = useCallback(() => {
    setIntroPending(false);
    setAssistantIntroSeen(true).catch(() => {});
  }, []);
  /** "What was sent to the AI" opened from the assistant panel, for this conversation key. */
  const [sentFor, setSentFor] = useState<string | null>(null);
  // Qutai Credits (pro mode): the balance shown under the panel's title while it is the provider in use; the server's
  // configuration and the balance are read once at start (nothing at all without pro mode).
  const creditsState = useCreditsState();
  useEffect(() => {
    refreshCredits();
  }, []);
  // Losing the account while Qutai Credits is in use is said once, with the ways on.
  const accountState = useAccountState();
  const accountStatusRef = useRef(accountState.status);
  useEffect(() => {
    const previous = accountStatusRef.current;
    accountStatusRef.current = accountState.status;
    const providers = [settingsRef.current.provider, browser.conversationOf(browser.active).model?.provider].filter(
      (p): p is ProviderId => !!p,
    );
    // In Settings the account page itself says so (and shows the sign-in buttons).
    if (lostQutaiAccount(previous, accountState.status, providers) && !settingsVisibleRef.current) promptQutaiSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountState.status]);
  /** The conversation whose model is being chosen (the sheet under the panel's title). */
  const [modelSheetFor, setModelSheetFor] = useState<Conversation | null>(null);
  const [tabsVisible, setTabsVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  // The assistant's bookmarks tool changed something: the page menu's bookmark button follows at once.
  const tabUrl = tab.url;
  useEffect(
    () =>
      onBookmarksChanged(() => {
        getDb()
          .then((db) => isBookmarked(db, tabUrl))
          .then(setBookmarked)
          .catch(() => {});
      }),
    [tabUrl],
  );
  const [library, setLibrary] = useState<LibraryTab | null>(null);
  const [textSizeVisible, setTextSizeVisible] = useState(false);
  const [readerSettingsVisible, setReaderSettingsVisible] = useState(false);
  const [permissionHost, setPermissionHost] = useState<string | null>(null);
  /** The list of every site with its own permission (page menu, or "All sites" in a site's sheet). */
  const [sitesListVisible, setSitesListVisible] = useState(false);
  // The permission sheet stays open while the location setting changes, so it must see the update.
  useSyncExternalStore(sitePermissions.subscribe, getSitePermissionsVersion);
  const [downloadsVisible, setDownloadsVisible] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [offlineVisible, setOfflineVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [context, setContext] = useState<{ tab: Tab; target: ContextTarget } | null>(null);
  // Find in page belongs to one page: it closes by itself when the tab or the URL changes, or when
  // reader mode is turned on or off (it searches the text on screen).
  const [findFor, setFindFor] = useState<{ tabId: string; url: string; reader: boolean } | null>(null);
  const toast = useToast();
  // Downloads: notices from the request flow (a finished download shows in the download pill, with Open), the
  // notifications' "open Downloads" and "open this file" (Android: a finished file no app opened directly; Qutai
  // says why), and incognito entries leave the list with the session.
  useEffect(() => {
    downloadRequests.notify = toast.show;
    const openFile = (id: string) => {
      const item = downloads.get(id);
      if (item) void openDownload(downloads, item, toast.show);
      else setDownloadsVisible(true);
    };
    const offOpen = nativeDownloads?.addListener('onOpenRequested', () => setDownloadsVisible(true));
    const offOpenFile = nativeDownloads?.addListener('onOpenFileRequested', ({ id }) => openFile(id));
    if (nativeDownloads?.consumeOpenRequest()) setDownloadsVisible(true);
    const fileRequest = nativeDownloads?.consumeOpenFileRequest?.();
    // At a cold start the list is read first.
    if (fileRequest) downloads.load().then(() => openFile(fileRequest), () => {});
    const offIncognito = browserInstance.onIncognitoEnd(() => downloads.forgetIncognito());
    return () => {
      offOpen?.remove();
      offOpenFile?.remove();
      offIncognito();
    };
  }, [toast.show]);
  const speaking = useIsSpeaking();
  // Switching tabs (another conversation on screen) turns the microphone off; the words stay in the old draft.
  useEffect(() => stopVoiceInput(), [conversation]);
  useIncognitoProtection(tab.incognito || (tabsVisible && browser.tabsOf(true).length > 0));

  // On low memory, everything but the tab on screen (and the agent's tab) gives up its WebView.
  useEffect(() => {
    const sub = AppState.addEventListener('memoryWarning', () => browserInstance.sleepInactive(0));
    return () => sub.remove();
  }, [browserInstance]);

  // Lets reminders scheduled by the assistant show while Qutai is open; asks for no permission.
  useEffect(() => initNotifications(), []);

  // Media in pages: "Keep playing in the background" (Android: the playback service; iOS: WebKit plays on by
  // itself, so with the setting off pages are paused when the app leaves the foreground). The labels follow the
  // app's language.
  const playbackChannel = t('playback.channel');
  useEffect(() => {
    configureBackgroundMedia(settings.backgroundPlayback);
    if (Platform.OS !== 'ios' || settings.backgroundPlayback) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') pauseAllPages();
    });
    return () => sub.remove();
  }, [settings.backgroundPlayback, playbackChannel]);
  // Android picture-in-picture for a playing full-screen video: never for incognito tabs, and not while the app
  // lock is on (the lock must cover the app whenever it comes back; a PiP window would show the page around it).
  const pipAllowed = settings.pictureInPicture && !settings.appLock && !tab.incognito;
  useEffect(() => setPictureInPictureAllowed(pipAllowed), [pipAllowed]);

  // "Keep working in the background" (Android): the notification's labels follow the app's language; its Stop
  // button stops the running task, and tapping it (or Open) shows that task's conversation.
  const backgroundChannel = t('background.channel');
  useEffect(() => configureBackgroundTasks(), [backgroundChannel]);
  const runningRef = useRef({ chat: runningChat, tab: runningTab });
  runningRef.current = { chat: runningChat, tab: runningTab };
  /** The tab whose conversation the last task belongs to (its result notification opens it). */
  const lastTaskTab = useRef<string | null>(null);
  /** Shows a conversation: its tab (the first of its group) and the panel. */
  const showConversation = useCallback(
    (chat: Conversation) => {
      const target = browserInstance.tabs.find((x) => browserInstance.conversationOf(x) === chat);
      if (target) browserInstance.switchTab(target.id);
      setPanelOpen(true);
    },
    [browserInstance],
  );
  useEffect(() => {
    const stop = onBackgroundStopRequested(() => runningRef.current.chat?.stop());
    const open = onBackgroundOpenRequested(() => {
      const target = runningRef.current.tab?.id ?? lastTaskTab.current;
      if (target && browserInstance.getTab(target)) browserInstance.switchTab(target);
      setPanelOpen(true);
    });
    return () => {
      stop?.remove();
      open?.remove();
    };
  }, [browserInstance]);

  // The theme setting overrides the system appearance; Android 12+ also keeps it for the next launch's splash.
  useEffect(() => {
    applyTheme(settings.theme);
    setLaunchAppearance(settings.theme);
  }, [settings.theme]);
  const darkMode = useColorScheme() === 'dark';
  useEffect(() => setHapticsEnabled(settings.haptics), [settings.haptics]);

  // A tab's (or its group's) saved conversation is read from disk the first time it is shown, or when
  // a group must decide which conversation it keeps.
  useEffect(() => {
    if (conversation.loaded) return;
    const adoptLegacy = legacyChatPending;
    legacyChatPending = false;
    readConversation(conversation, adoptLegacy);
  }, [conversation]);
  useEffect(() => browserInstance.onChatLoadNeeded((chat) => readConversation(chat)), [browserInstance]);

  // Once at start: load site permissions and trim the activity history and the log of what was sent to the AI.
  useEffect(() => {
    sitePermissions.load();
    downloads.load();
    getDb()
      .then(async (db) => {
        await pruneActions(db);
        await pruneSent(db);
      })
      .catch(() => {});
  }, []);

  // Once at start: forget conversations of tabs that are gone (also those that fell out of recently closed), then the
  // attached files nothing refers to any more; incognito attachments never outlive the app run.
  useEffect(() => {
    try {
      forgetIncognitoAttachments();
    } catch {
      // Nothing to remove.
    }
    try {
      // Copies handed to other apps in an earlier run are not needed any more.
      clearOutgoing();
    } catch {
      // Nothing to remove.
    }
    getDb()
      .then(async (db) => {
        await deleteOrphanChats(db, [
          ...browserInstance.conversations.map((x) => x.key),
          ...browserInstance.recentlyClosed.flatMap((c) => (c.uid ? [c.uid] : [])),
        ]);
        await pruneAttachmentFiles();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserInstance]);

  /** Deletes attached files that no saved or open conversation (or message being written) refers to. */
  const pruneAttachmentFiles = async () => {
    const db = await getDb();
    const keep = new Set([
      ...(await savedAttachmentIds(db)),
      ...browserInstance.conversations.flatMap((x) => x.attachmentIds()),
    ]);
    pruneAttachments(keep);
  };

  // The chat input is saved shortly after typing stops, so closing the app doesn't lose it.
  const [draftSaver] = useState(() => ({ timer: null as ReturnType<typeof setTimeout> | null }));
  const persistDraftSoon = (chat: Conversation) => {
    if (draftSaver.timer) clearTimeout(draftSaver.timer);
    draftSaver.timer = setTimeout(() => persistConversation(chat), 800);
  };

  const persistConversation = (chat: Conversation) => {
    getDb()
      .then((db) => storeChat(db, chat))
      .catch(() => {});
  };

  // Ways in from outside the app (links handed to Qutai as the default browser, text shared to it): untrusted, so
  // handled only after the app lock, never in an incognito tab, and never sent or searched without the user's
  // choice (src/device/entryPoints.ts).
  const [incoming, setIncoming] = useState<{ text: string; url: string | null } | null>(null);
  /** Leaves incognito for the last normal tab (or a new one), so outside content never lands in incognito. */
  const toNormalTab = () => {
    if (!browser.active.incognito) return;
    const normal = browser.tabsOf(false);
    if (normal.length) browser.switchTab(normal[normal.length - 1].id);
    else browser.openTab();
  };
  /** Puts text in the assistant's input of a normal tab, unsent, after anything the user was already typing. */
  const askAbout = (text: string) => {
    toNormalTab();
    if (text) {
      const chat = browser.conversationOf(browser.active);
      chat.setDraft(chat.draft.trim() ? `${chat.draft.trimEnd()}\n\n${text}` : text);
      persistDraftSoon(chat);
    }
    setPanelOpen(true);
    setFocusRequest((n) => n + 1);
  };
  /** Opens the address field of the tab on screen with `text` in it (not submitted). */
  const [addressEdit, setAddressEdit] = useState<{ id: number; text: string } | null>(null);
  const clearAddressEdit = useCallback(() => setAddressEdit(null), []);
  const handleEntry = (entry: Entry) => {
    switch (entry.kind) {
      case 'open':
        browser.openTab(entry.url);
        return;
      case 'shared':
        // The chooser is not shown over an incognito tab (or its lock screen).
        toNormalTab();
        setIncoming({ text: entry.text, url: entry.url });
        return;
      case 'newTab': {
        browser.openTab(undefined, { incognito: entry.incognito });
        setPanelOpen(false);
        // Not behind the incognito lock: the keyboard would come up over the lock screen.
        if (!entry.incognito || !settings.incognitoLock || incognitoUnlocked) {
          setAddressEdit({ id: Date.now(), text: entry.query });
        }
        return;
      }
      case 'ask':
        askAbout(entry.text);
        return;
      case 'scan':
        toNormalTab();
        setPanelOpen(false);
        setScannerVisible(true);
        return;
      case 'task':
        openRemindedTask(entry.id);
        return;
      case 'notification':
        returnToNotificationTab(entry.from);
        return;
    }
  };
  /**
   * A tap on a notification the assistant scheduled: the tab it was asked from; if that tab is closed, the first tab of
   * its group; else the first normal tab (a new one if there is none). Says so in a toast when it isn't the same tab.
   * An incognito tab is found only while this incognito session lasts; it is never reopened.
   */
  const returnToNotificationTab = (from: NotificationOrigin) => {
    const firstNormal = () => {
      const normal = browser.tabsOf(false);
      if (normal.length) browser.switchTab(normal[0].id);
      else browser.openTab();
    };
    if ('incognito' in from) {
      const id = incognitoOriginTab(from.incognito);
      if (id && browser.getTab(id)) return browser.switchTab(id);
      firstNormal();
      return toast.show(t('notifications.incognitoGone'));
    }
    const tab = browser.tabs.find((x) => !x.incognito && x.uid === from.tab);
    if (tab) return browser.switchTab(tab.id);
    const inGroup = from.group ? browser.tabs.find((x) => !x.incognito && x.groupId === from.group) : undefined;
    if (inGroup) {
      browser.switchTab(inGroup.id);
      return toast.show(t('notifications.tabGoneGroup'));
    }
    firstNormal();
    toast.show(t('notifications.tabGone'));
  };
  useEntryPoints(!appLocked, handleEntry);
  const incomingActions = (item: { text: string; url: string | null }): SheetAction[] => [
    ...(item.url ? [{ label: t('incoming.open'), onPress: () => browser.openTab(item.url!) }] : []),
    {
      label: t('incoming.search', { engine: SEARCH_ENGINES[settings.searchEngine].name }),
      onPress: () => browser.openTab(SEARCH_ENGINES[settings.searchEngine].searchUrl(item.text.slice(0, 500))),
    },
    { label: t('incoming.ask'), onPress: () => askAbout(item.text) },
    // Opens the page with the assistant ready; its "Summarize" button still waits for the user's tap.
    ...(item.url
      ? [
          {
            label: t('incoming.summarize'),
            onPress: () => {
              browser.openTab(item.url!);
              setPanelOpen(true);
            },
          },
        ]
      : []),
  ];

  // A conversation that moved (to the group a tab founded, to a tab when its group dissolves or its last
  // tab closes) takes its saved copy along.
  useEffect(
    () =>
      browserInstance.onChatMoved((chat, fromKey) => {
        getDb()
          .then(async (db) => {
            await storeChat(db, chat, fromKey);
            await moveSentConversation(db, fromKey, chat.key);
          })
          .catch(() => {});
      }),
    [browserInstance],
  );
  /**
   * `tab`: the tab the task is for (a saved task's page, opened just before); otherwise the tab on screen.
   * `noPage`: a saved task meant for no particular page, so the model is told not to start from the one on screen.
   * `voice`: a voice message from holding the Qutai button, sent with the panel closed: it leaves the files attached to
   * the message being written, and a saved task waiting in the input, where they are.
   */
  const send = async (text: string, options: { tab?: Tab; noPage?: boolean; voice?: boolean } = {}) => {
    if (running) return;
    // The conversation belongs to the tab the user is looking at when they send the task,
    // and stays there even if the agent moves to other tabs.
    // A grouped tab's conversation is the group's, so the task keeps one context whichever of its tabs is shown.
    const current = options.tab && browser.getTab(options.tab.id) ? options.tab : browser.active;
    const chat = browser.conversationOf(current);
    // Marked before anything is shown, so a message typed in an incognito tab is never saved.
    if (current.incognito) chat.privacy.touchedIncognito = true;
    // Images go only to a model that takes them: said before anything is sent, with the message kept in the input.
    if (!options.voice && chat.pending.some((a) => a.kind === 'image')) {
      const blocked = await imagesBlockedFor(chat);
      if (blocked) {
        chat.setDraft(text);
        chat.add(newItem('error', t('attach.noImageInput', { model: blocked })));
        return;
      }
    }
    // Qutai Credits: signed in, and the disclosure answered before the first use (asked here if it never was). Checked
    // before the message is taken, so a refusal leaves it in the input with its files (nothing is lost).
    const intended = chat.model && isConfigured(settings, chat.model.provider) ? chat.model.provider : settings.provider;
    if (intended === 'qutai' && !creditsReady()) {
      const signedIn = accountSession()?.getState().status === 'signedIn';
      if (signedIn && (await askCreditsDisclosure())) {
        // Accepted: carry on with this message.
      } else {
        chat.setDraft(chat.draft.trim() && chat.draft.trim() !== text.trim() ? `${chat.draft.trimEnd()}\n\n${text}` : text);
        chat.add({
          ...newItem('error', t(signedIn ? 'credits.error.notAccepted' : 'credits.error.notSignedInKept')),
          ...(signedIn ? {} : { action: 'signIn' as const }),
        });
        persistConversation(chat);
        if (!signedIn) promptQutaiSignIn();
        return;
      }
    }
    if (prepared?.chat === chat && !options.voice) setPrepared(null);
    const attachments = options.voice ? [] : chat.takePending();
    const sent = userItem(text, attachments);
    chat.add(sent);

    // The conversation's own model choice, if its provider is still set up; otherwise the default in Settings.
    // Read once here: a running task keeps the model it started with.
    const choice = chat.model;
    const useChoice = !!choice && isConfigured(settings, choice.provider);
    if (choice && !useChoice) {
      chat.add(newItem('info', t('chat.modelChoiceUnavailable', { provider: getProvider(choice.provider).label })));
      chat.setModel(null);
    }
    const provider = useChoice ? choice.provider : settings.provider;
    if (!isConfigured(settings, provider)) {
      chat.add(
        newItem(
          'error',
          getProvider(provider).needsEndpoint
            ? t('chat.missingEndpoint')
            : t('chat.missingKey', { provider: getProvider(provider).label }),
        ),
      );
      persistConversation(chat);
      setSettingsVisible(true);
      return;
    }

    const agentTab = { id: current.id };
    const where = current.isNewTab
      ? 'new tab page, no web page loaded'
      : `${current.title || '(no title)'} — ${current.url}`;
    const pageNote = options.noPage && !current.isNewTab ? " This task isn't about this page; don't read it unless needed." : '';
    const pageInfo = `\n\n[Current tab ${current.id}: ${where}.${pageNote} Open tabs: ${browser.tabs.length}. ${nowContext()}. ${interfaceLanguageNote()}]`;
    const message = text || (attachments.length ? 'See the attached files.' : '');
    const attached = attachments.length ? `\n\n${describeAttachments(attachments)}` : '';
    const madeNote = chat.takeMadeNote();
    const made = madeNote ? `\n\n${madeNote}` : '';
    chat.turns.push({
      role: 'user',
      text: message + attached + made + pageInfo,
      ...(attachments.length ? { attachments } : {}),
    });

    // Research applies to this one message.
    const research = chat.research;
    if (research) chat.setResearch(false);
    const signal = chat.start();
    browser.setAgentTab(agentTab);
    // May go on in the background (Android, opt-in) unless the conversation is incognito; the notification's title
    // is the user's own message.
    const incognitoTask = () => chat.incognito || chat.privacy.touchedIncognito;
    const mayContinue = settings.backgroundTasks && !incognitoTask();
    beginBackgroundTask(mayContinue ? text : null);
    if (mayContinue) lastTaskTab.current = current.id;
    let outcome: TaskOutcome = { kind: 'done' };
    let lastText = '';
    // The tokens and approximate cost of the task's requests, shown under its last answer.
    let answerCost = null as AnswerCost | null;
    // Catalogue providers: what the cached catalogue says about the model (images, output limit).
    if (getProvider(provider).catalog) await loadCatalog();
    const target = requestTarget(settings, provider, useChoice ? choice.model : undefined);
    // Qutai Credits: the server's configuration (limits, and which provider's format the model takes).
    let credits: PublicConfig | null = null;
    // The message as typed, to hand back to the input if Qutai Credits refuses it before anything was sent.
    const userTurn = chat.turns[chat.turns.length - 1];
    try {
      if (provider === 'qutai') {
        credits = await creditsStore.config();
        // The model saved earlier is no longer offered: the server's first one (the relay refuses others).
        const offered = offeredModels(credits);
        if (!offered.some((m) => m.model === target.model) && offered[0]) target.model = offered[0].model;
      }
      const underlying = credits?.models.find((m) => m.model === target.model)?.provider ?? provider;
      await runAgent({
        provider,
        apiKey: target.apiKey,
        model: target.model,
        endpoint: target.endpoint,
        extraHeaders: target.extraHeaders,
        imageInput: target.images,
        maxOutputTokens: target.maxOutputTokens,
        turns: chat.turns,
        browser,
        agentTab,
        askedFrom: { id: current.id },
        privacy: chat.privacy,
        memory: settings.memoryEnabled ? memoryStore : undefined,
        customInstructions: settings.customInstructions,
        // Research without web search would be guesswork, so it always searches.
        // Only where the provider has its own web search; elsewhere the assistant searches in the browser.
        webSearch: getProvider(provider).webSearch && (settings.webSearch || research),
        research,
        // Gemini streams only with its experimental setting, and not after the API rejected a streamed reply.
        stream: underlying !== 'gemini' || (settings.geminiStreaming && geminiStreamingAvailable()),
        ...(credits
          ? {
              serverLimits: {
                maxSteps: credits.limits.maxSteps,
                maxResearchSteps: credits.limits.maxResearchSteps,
                maxMemoryChars: credits.limits.maxMemoryChars,
                maxImages: credits.limits.maxImages,
              },
            }
          : {}),
        confirm: (description, host) => askConfirmation(description, host, signal),
        confirmPersonal: (host, kinds, incognito) => askPersonalData(host, kinds, incognito, signal),
        confirmHidden: (host, what, field, incognito) => askHiddenValue(host, what, field, incognito, signal),
        confirmImage: (options) => askImageConfirmation(options, signal),
        imageUsed: (id) => chat.markImageUsed(id),
        confirmByDefault: settings.confirmActions,
        sites: sitePermissions,
        log: logAction,
        history: historySearch,
        bookmarks: { db: getDb, removed: offerBookmarkUndo },
        // The same path as the Settings screen; the tool only passes allowlisted fields (agent/settingsTool.ts).
        appSettings: {
          get: () => settingsRef.current,
          change: (patch) => {
            const next = { ...settingsRef.current, ...patch };
            settingsRef.current = next;
            return onChangeSettings(next);
          },
        },
        composeEmail,
        offerCall: (offer) => {
          AccessibilityInfo.announceForAccessibility(
            offer.name
              ? t('chat.callLabel', { name: offer.name, number: offer.number })
              : t('chat.callNumberLabel', { number: offer.number }),
          );
          chat.add(callItem(offer));
        },
        offerSms: (offer) => {
          AccessibilityInfo.announceForAccessibility(
            offer.name
              ? t('chat.smsLabel', { name: offer.name, number: offer.number })
              : t('chat.smsNumberLabel', { number: offer.number }),
          );
          chat.add(smsItem(offer));
        },
        offerWhatsApp: (offer) => {
          AccessibilityInfo.announceForAccessibility(
            offer.number
              ? t('chat.whatsAppLabel', { who: offer.name ? `${offer.name}, ${offer.number}` : offer.number })
              : t('chat.whatsAppNoNumberLabel'),
          );
          chat.add(whatsAppItem(offer));
        },
        startDownload: (tab, url, name, type) => downloadRequests.fromAssistant(tab, url, name, type),
        offerFile: (file) => {
          AccessibilityInfo.announceForAccessibility(file.name);
          chat.add(fileItem(file));
        },
        composedFiles: () => chat.composedFiles,
        offerShare: (offer) => {
          AccessibilityInfo.announceForAccessibility(
            offer.files.length ? offer.files.map((f) => f.name).join(', ') : t('chat.shareTo'),
          );
          chat.add(shareItem(offer));
        },
        offerPdf: (pdf) => {
          const info = storeMadePdf(pdf.file, pdf.fileName, 'page', incognitoTask());
          AccessibilityInfo.announceForAccessibility(t('chat.pdfMade', { name: info.name }));
          chat.addMadePdf(info, false);
          return info;
        },
        showAppSettings: () => setSettingsVisible(true),
        attachments: () => chat.attachments,
        offerImage: (info) => {
          AccessibilityInfo.announceForAccessibility(t('chat.imageMade', { name: info.name }));
          // The oldest edited images over the limit lose their files.
          chat.addEditedImage(info).forEach((id) => deleteAttachment(id));
        },
        signal,
        audit: {
          conversation: () => chat.key,
          incognito: () => chat.incognito || chat.privacy.touchedIncognito,
        },
        onCost: (cost) => {
          answerCost = cost;
        },
        onEvent: (event) => {
          // How the task ends, for the notification when it ends in the background: its last reply, a final
          // error, or a question for the user.
          if (event.type === 'text') lastText = event.text || lastText;
          if (event.type === 'error') outcome = { kind: 'failed', text: event.text };
          else if (event.type === 'choices') outcome = { kind: 'needsAnswer' };
          else if (event.type === 'text' || event.type === 'action') outcome = { kind: 'done' };
          if (event.type === 'text_delta') return chat.appendStreaming(event.text);
          if (event.type === 'text') return chat.finishStreaming(event.text);
          if (event.type === 'sources') return chat.add(sourcesItem(event.sources, event.searchWidget));
          if (event.type === 'choices') {
            AccessibilityInfo.announceForAccessibility(event.text);
            return chat.add(newItem('choices', event.text, event.options));
          }
          const item = newItem(event.type, event.text);
          chat.add('icon' in event && event.icon ? { ...item, icon: event.icon } : item);
        },
      });
      if (signal.aborted) chat.add({ ...newItem('info', t('chat.stopped')), icon: 'stop' });
      else AccessibilityInfo.announceForAccessibility(t('a11y.taskDone'));
    } catch (e) {
      // Qutai Credits refused the first request (no credits, maintenance, signed out…): nothing reached the AI and
      // nothing was charged, so the message goes back into the input instead of staying unanswered.
      const kept =
        !signal.aborted &&
        provider === 'qutai' &&
        nothingSent(e) &&
        chat.withdraw(sent.id, userTurn, text, attachments);
      if (signal.aborted) chat.add({ ...newItem('info', t('chat.stopped')), icon: 'stop' });
      else {
        // Qutai Credits: the way on under the error (buy credits; sign in again or choose another provider).
        const action: ChatItemAction | undefined =
          provider === 'qutai' && e instanceof RelayError
            ? e.kind === 'not_signed_in'
              ? 'signIn'
              : undefined
            : undefined;
        chat.add({ ...newItem('error', e instanceof Error ? e.message : String(e)), ...(action ? { action } : {}) });
      }
      if (kept) chat.add(newItem('info', t('credits.messageKept')));
      outcome = { kind: 'failed', text: e instanceof Error ? e.message : String(e) };
      // What the server says now (a stream cut short was still charged; a refusal may mean the balance moved).
      if (provider === 'qutai' && e instanceof RelayError) refreshCredits();
    } finally {
      if (signal.aborted) outcome = { kind: 'stopped' };
      else if (outcome.kind === 'done') outcome = { kind: 'done', text: lastText };
      // Nothing from a conversation that touched an incognito tab goes in a notification, and with "Notify me when a
      // task finishes" off only a question for the user does.
      const quiet = !notifyTaskDoneRef.current && outcome.kind !== 'needsAnswer';
      endBackgroundTask(incognitoTask() || quiet ? { kind: 'stopped' } : outcome);
      chat.finishStreaming();
      if (answerCost) chat.addCost(answerCost, sent.id);
      // The ledger's latest entries (a stopped request is settled on the server a little later).
      if (provider === 'qutai') refreshCredits();
      chat.finish();
      browser.setAgentTab(null);
      if (outcome.kind !== 'stopped') taskEnded(chat, outcome.kind);
      // Saved under the conversation's key now, which may have changed meanwhile (e.g. the tab founded a group).
      persistConversation(chat);
    }
  };

  /**
   * The model a message from this conversation would go to, by name, when it can't take images; null when it can
   * (or when the provider isn't set up, which send reports on its own).
   */
  const imagesBlockedFor = async (chat: Conversation): Promise<string | null> => {
    const choice = chat.model && isConfigured(settings, chat.model.provider) ? chat.model : null;
    const provider = choice?.provider ?? settings.provider;
    if (!isConfigured(settings, provider)) return null;
    if (getProvider(provider).catalog) await loadCatalog();
    const target = requestTarget(settings, provider, choice?.model);
    return target.images ? null : modelLabel(provider, target.model);
  };

  // Attachments: the attach sheet, the full-screen preview.
  const [attachSheet, setAttachSheet] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentInfo | null>(null);
  const attachmentIncognito = (chat: Conversation) => chat.incognito || chat.privacy.touchedIncognito;

  const attach = async (how: 'photos' | 'camera' | 'file') => {
    const chat = conversation;
    const room = MAX_ATTACHMENTS - chat.pending.length;
    if (room <= 0) return toast.show(t('attach.full', { max: MAX_ATTACHMENTS }));
    try {
      const incognito = attachmentIncognito(chat);
      const added =
        how === 'photos'
          ? await pickImages(room, incognito)
          : [await (how === 'camera' ? takePhoto(incognito) : pickPdf(incognito))].filter((a) => a !== null);
      // Anything over the limit (several picked while another was added) goes again.
      chat.addPending(added).forEach((a) => deleteAttachment(a.id));
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        if (!e.canAskAgain) offerSettings(t('attach.cameraDenied'));
        else toast.show(t('attach.cameraDenied'));
        return;
      }
      toast.show(e instanceof AttachmentError ? e.message : t('attach.failed'));
    }
  };

  /** "Ask Qutai" on a downloaded PDF (iOS Downloads): attached to the conversation on screen, ready to ask about. */
  const askAboutDownload = (entry: DownloadItem) => {
    const chat = conversation;
    if (chat.pending.length >= MAX_ATTACHMENTS) return toast.show(t('attach.full', { max: MAX_ATTACHMENTS }));
    if (!entry.uri) return toast.show(t('attach.gone'));
    try {
      const file = new File(entry.uri);
      if (!file.exists) return toast.show(t('attach.gone'));
      if (file.size > MAX_PDF_BYTES) return toast.show(t('attach.pdfTooLarge', { max: '30 MB' }));
      const info = importFile(file, entry.name, 'application/pdf', file.size, attachmentIncognito(chat) || !!entry.incognito);
      chat.addPending([info]);
      if (!chat.draft.trim()) chat.setDraft(t('downloads.askDraft'));
      setDownloadsVisible(false);
      setPanelOpen(true);
      setFocusRequest((n) => n + 1);
    } catch {
      toast.show(t('attach.failed'));
    }
  };

  /**
   * "Resize or crop" in the full-screen preview: the copy is made on the phone and attached to the message being
   * written (where the user can send it, or ask the assistant to upload it), then shown in the preview.
   */
  const resizeAttachment = async (info: AttachmentInfo, input: Record<string, unknown>) => {
    const chat = conversation;
    if (chat.pending.length >= MAX_ATTACHMENTS) return toast.show(t('attach.full', { max: MAX_ATTACHMENTS }));
    const req = parseEditRequest(input);
    if (typeof req === 'string') return toast.show(t('resize.failed'));
    try {
      const made = await editImage(info, req, attachmentIncognito(chat) || isIncognitoAttachment(info.id));
      chat.addPending([made.info]).forEach((a) => deleteAttachment(a.id));
      setPreviewAttachment(made.info);
      toast.show(t('resize.added', { size: `${made.info.width}×${made.info.height}`, bytes: formatSize(made.info.size) }));
    } catch {
      toast.show(t('resize.failed'));
    }
  };

  const removePending = (id: string) => {
    conversation.removePending(id);
    deleteAttachment(id);
  };

  /**
   * A task ended (not stopped by the user). Looking at its conversation, the user sees it and feels it; otherwise the
   * conversation is marked unseen (a dot on the Qutai button), and with Qutai on screen a toast says so with Show.
   * Away from Qutai, Android's background run has already posted its notification; a task that paused because Qutai
   * left the screen cannot end there, and nothing is ever announced for one that did not end.
   */
  const taskEnded = (chat: Conversation, kind: 'done' | 'failed' | 'needsAnswer') => {
    const onScreen = AppState.currentState === 'active';
    if (onScreen && panelOpenRef.current && browserInstance.conversationOf(browserInstance.active) === chat) {
      if (kind === 'done') success();
      return;
    }
    chat.setUnseen(kind);
    if (!onScreen) return;
    bump();
    toast.show(t(kind === 'done' ? 'taskDone.done' : kind === 'failed' ? 'taskDone.failed' : 'taskDone.needsAnswer'), {
      label: t('chat.showTab'),
      onPress: () => showConversation(chat),
    });
  };

  // Saved tasks: the screen (from the panel or Settings), and the three run last as chips in the empty panel.
  const [tasksScreen, setTasksScreen] = useState<{ draft: TaskDraft | null } | null>(null);
  const [recentTasks, setRecentTasks] = useState<SavedTask[]>([]);
  const refreshRecentTasks = useCallback(() => {
    getDb()
      .then((db) => recentSavedTasks(db))
      .then(setRecentTasks)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (panelOpen && !tasksScreen) refreshRecentTasks();
  }, [panelOpen, tasksScreen, refreshRecentTasks]);

  /**
   * Runs a saved task: the user's own text and their tap, so it is sent. With a page to open first, it opens in a new
   * tab and the task starts once the page has loaded (or after 15 s); otherwise it goes in the current conversation.
   */
  const runSavedTask = async (task: SavedTask) => {
    setTasksScreen(null);
    if (running) return toast.show(t('chat.busyElsewhere'));
    getDb()
      .then((db) => markSavedTaskUsed(db, task.id))
      .then(refreshRecentTasks)
      .catch(() => {});
    const prompt = fillTaskPrompt(task.prompt, () => formatDate(new Date()));
    let target: Tab = browser.active;
    if (task.target === 'url' && task.url) {
      target = browser.openTab(upgradeToHttps(task.url, settings.httpsOnly));
      setPanelOpen(true);
      await target.waitForNextLoad();
    }
    const chat = browser.conversationOf(target);
    chat.whenLoaded(() => {
      if (task.research) chat.setResearch(true);
      setPanelOpen(true);
      send(prompt, { tab: target, noPage: task.target === 'none' });
    });
  };

  // Saved task reminders follow the database: scheduled again at start and on every return to the foreground (which
  // also moves Android's next alarm after a time zone change, and fills iOS's limited queue again).
  useEffect(() => {
    const sync = () =>
      getDb()
        .then(listSavedTasks)
        .then(syncTaskReminders)
        .catch(() => {});
    sync();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && sync());
    return () => sub.remove();
  }, []);

  /** A task opened from its reminder, ready in the panel with "Run now" until it is sent. */
  const [prepared, setPrepared] = useState<{ chat: Conversation; task: SavedTask } | null>(null);

  /**
   * The user tapped a task's reminder (after the app lock; never into an incognito tab). The tap is their own action
   * on their own saved task, so it runs at once if they chose that for the task; otherwise its page opens and the
   * prompt waits in the input with "Run now". Nothing runs without the tap.
   */
  const openRemindedTask = async (id: string) => {
    const task = await getDb()
      .then((db) => getSavedTask(db, id))
      .catch(() => null);
    if (!task) return toast.show(t('tasks.gone'));
    toNormalTab();
    if (task.autoRun && !runningRef.current.chat) return runSavedTask(task);
    if (task.target === 'url' && task.url) browser.openTab(upgradeToHttps(task.url, settings.httpsOnly));
    const chat = browser.conversationOf(browser.active);
    chat.whenLoaded(() => {
      chat.setDraft(fillTaskPrompt(task.prompt, () => formatDate(new Date())));
      chat.setResearch(task.research);
      persistDraftSoon(chat);
      setPrepared({ chat, task });
      setPanelOpen(true);
    });
  };

  const runPrepared = () => {
    if (!prepared) return;
    const { chat, task } = prepared;
    const text = chat.draft.trim();
    setPrepared(null);
    if (!text) return;
    chat.setDraft('');
    persistDraftSoon(chat);
    getDb()
      .then((db) => markSavedTaskUsed(db, task.id))
      .then(refreshRecentTasks)
      .catch(() => {});
    send(text, { noPage: task.target === 'none' });
  };

  const newChat = () => {
    const chat = conversation;
    chat.clear();
    // Its attached files go once the cleared conversation is saved.
    getDb()
      .then((db) => storeChat(db, chat))
      .then(pruneAttachmentFiles)
      .catch(() => {});
  };

  /** Runs a menu action and reports the outcome in a toast instead of failing silently. */
  const runAction = async (action: () => Promise<string | void>) => {
    try {
      const message = await action();
      if (message) toast.show(message);
    } catch (e) {
      if (e instanceof CaptureCancelled) return toast.show(e.message);
      // The system won't ask for the permission again, so the way out is its settings page.
      if (e instanceof PermissionDeniedError && !e.canAskAgain) return offerSettings(e.message);
      toast.show(t('common.error', { message: e instanceof Error ? e.message : String(e) }));
    }
  };

  /**
   * The button of a share card: the files are looked up again in the conversation (so a card only sends what the
   * conversation still holds), prepared, and handed to WhatsApp or the share sheet, where the user picks the chat or
   * app and sends.
   */
  const runShare = (offer: ShareOffer, chat: Conversation) =>
    runAction(async () => {
      if (offer.app === 'email') return;
      const all = listShareables(chat.attachments, chat.composedFiles);
      const items = [];
      for (const f of offer.files) {
        const found = all.find((s) => s.id === f.id);
        if (!found) return t('chat.shareGone', { name: f.name });
        items.push(found);
      }
      const incognito = chat.incognito || chat.privacy.touchedIncognito;
      let prepared: Awaited<ReturnType<typeof prepareOutgoing>> | null = null;
      try {
        if (items.length) prepared = await prepareOutgoing(items, { incognito, original: offer.original });
      } catch (e) {
        if (e instanceof OutgoingError)
          return e.code === 'gone'
            ? t('chat.shareGone', { name: e.fileName })
            : e.code === 'tooLarge'
              ? t('chat.shareTooLarge')
              : t('chat.shareFailed', { name: e.fileName });
        throw e;
      }
      try {
        const app: ShareApp = offer.app === 'whatsapp' ? 'whatsapp' : 'any';
        const result = await shareToApp({ files: prepared?.files ?? [], text: offer.text, app });
        if (app === 'whatsapp' && Platform.OS === 'android' && result.via === 'chooser') return t('chat.shareNoWhatsApp');
        if (result.textCopied) return t('chat.shareTextCopied');
      } finally {
        // iOS: the share sheet has finished with the files when it reports back. Android apps read them later; the
        // copies go at the next hand-out, at the next start, or when the incognito session ends.
        if (Platform.OS === 'ios') prepared?.dispose();
      }
    });

  // Page actions make no sense on the app's own new tab page.
  const onNewTab = tab.isNewTab;
  const findOpen = findFor?.tabId === tab.id && findFor.url === tab.url && findFor.reader === !!tab.reader;

  /** Turns reader mode on (when the page has an article to show) or off. */
  const toggleReader = () => {
    if (tab.reader) return tab.closeReader();
    const target = tab;
    runAction(async () => {
      if (!(await target.openReader())) return t('reader.noArticle');
      AccessibilityInfo.announceForAccessibility(t('reader.opened'));
    });
  };
  const currentSite = siteKey(tab.url);
  const iconRow: IconItem[] = [
    {
      icon: 'forward',
      label: t('menu.forward'),
      disabled: !tab.canGoForward,
      onPress: () => tab.webview?.goForward(),
    },
    {
      icon: bookmarked ? 'bookmarked' : 'bookmark',
      label: t(bookmarked ? 'menu.removeBookmark' : 'menu.addBookmark'),
      active: bookmarked,
      disabled: !/^https?:\/\//i.test(tab.url),
      onPress: () =>
        runAction(async () => {
          const db = await getDb();
          if (bookmarked) {
            await removeBookmark(db, tab.url);
            return t('menu.bookmarkRemoved');
          }
          await addBookmark(db, tab.url, tab.title);
          return t('menu.bookmarkAdded');
        }),
    },
    tab.loading
      ? { icon: 'close', label: t('menu.stop'), onPress: () => tab.webview?.stopLoading() }
      : { icon: 'reload', label: t('menu.reload'), disabled: onNewTab, onPress: () => tab.webview?.reload() },
  ];

  const menuItems: MenuItem[] = [
    // Without the Qutai button in the address bar, the assistant opens from here.
    ...(settings.showAssistantButton
      ? []
      : [{ icon: 'assistant' as const, label: t('menu.askQutai'), onPress: () => setPanelOpen(true) }]),
    { icon: 'newTab', label: t('menu.newTab'), onPress: () => browser.openTab() },
    {
      icon: 'incognito',
      label: t('menu.newIncognitoTab'),
      onPress: () => browser.openTab(undefined, { incognito: true }),
    },
    {
      icon: 'share',
      section: true,
      label: t('menu.shareLink'),
      disabled: onNewTab,
      onPress: () => runAction(() => shareLink(tab)),
    },
    {
      icon: 'copy',
      label: t('menu.copyLink'),
      disabled: onNewTab,
      onPress: () =>
        runAction(async () => {
          await copyLink(tab);
          return t('menu.linkCopied');
        }),
    },
    // Android: a launcher shortcut for this page (iOS gives apps no way to add one; Safari's is its own).
    ...(pinShortcuts && !tab.incognito
      ? [
          {
            icon: 'addToHome' as const,
            label: t('menu.addToHomeScreen'),
            disabled: !/^https?:\/\//i.test(tab.url) || onNewTab,
            onPress: () => {
              if (!pinSiteShortcut(tab.url, tab.title)) toast.show(t('menu.addToHomeScreenFailed'));
            },
          },
        ]
      : []),
    {
      icon: 'find',
      label: t('menu.find'),
      disabled: onNewTab,
      onPress: () => setFindFor({ tabId: tab.id, url: tab.url, reader: !!tab.reader }),
    },
    {
      icon: 'reader',
      label: t(tab.reader || tab.readerAvailable || onNewTab ? 'menu.reader' : 'menu.readerNone'),
      checked: !!tab.reader,
      // Offered only when the page looks like an article; the full check runs when it opens.
      disabled: onNewTab || (!tab.reader && !tab.readerAvailable),
      onPress: toggleReader,
    },
    {
      icon: 'desktop',
      label: t('menu.desktopSite'),
      checked: tab.desktop,
      disabled: onNewTab,
      onPress: () => tab.toggleDesktop(),
    },
    speaking
      ? { icon: 'stopReading', label: t('menu.stopReading'), onPress: () => runAction(stopSpeaking) }
      : {
          icon: 'readAloud',
          label: t('menu.readAloud'),
          disabled: onNewTab,
          onPress: () =>
            runAction(async () => {
              await speakPage(tab);
            }),
        },
    // Less frequent things live one level down, so the menu fits without scrolling.
    {
      icon: 'library',
      label: t('menu.library'),
      section: true,
      onPress: () => {},
      submenu: [
        { icon: 'bookmarks', label: t('menu.bookmarks'), onPress: () => setLibrary('bookmarks') },
        { icon: 'history', label: t('menu.history'), onPress: () => setLibrary('history') },
        { icon: 'savedPages', label: t('menu.offlinePages'), onPress: () => setOfflineVisible(true) },
        { icon: 'downloads', label: t('menu.downloads'), onPress: () => setDownloadsVisible(true) },
      ],
    },
    {
      icon: 'moreHorizontal',
      label: t('menu.more'),
      onPress: () => {},
      submenu: [
        {
          icon: 'qrCode',
          label: t('menu.qrCode'),
          disabled: onNewTab,
          onPress: () => setQrUrl(tab.url),
        },
        {
          icon: 'scanQr',
          label: t('menu.scanQr'),
          onPress: () => setScannerVisible(true),
        },
        {
          icon: 'pdf',
          label: t('menu.savePdf'),
          disabled: onNewTab,
          onPress: () =>
            runAction(async () => {
              toast.show(t('menu.pdfPreparing'));
              const pdf = await savePagePdf(tab);
              if (pdf.imagesMissing > 0) return t('menu.pdfImagesMissing', { count: pdf.imagesMissing });
            }),
        },
        {
          icon: 'pdf',
          label: t('menu.pdfFromScreenshots'),
          disabled: onNewTab,
          onPress: () =>
            runAction(async () => {
              const pdf = await savePdfFromScreenshots(tab);
              if (pdf.truncated) return t('menu.captureTruncated', { count: pdf.screens });
            }),
        },
        {
          icon: 'saveOffline',
          label: t('menu.saveOffline'),
          disabled: onNewTab,
          onPress: () =>
            runAction(async () => {
              // Saving writes the page to disk, which incognito tabs never do.
              if (tab.incognito) return t('offline.incognito');
              toast.show(t('menu.pdfPreparing'));
              const page = await savePageOffline(tab);
              await addOfflinePage(await getDb(), page);
              return t('offline.saved');
            }),
        },
        {
          icon: 'print',
          label: t('menu.print'),
          disabled: onNewTab,
          onPress: () => runAction(() => printPage(tab)),
        },
        {
          icon: 'screenshot',
          label: t('menu.saveScreenshot'),
          disabled: onNewTab,
          onPress: () =>
            runAction(async () => {
              await saveScreenshot(tab);
              return t('menu.screenshotSaved');
            }),
        },
        {
          icon: 'screenshot',
          label: t('menu.saveFullScreenshot'),
          disabled: onNewTab,
          onPress: () =>
            runAction(async () => {
              const shot = await saveFullPageScreenshot(tab);
              const saved =
                shot.images > 1 ? t('menu.fullScreenshotParts', { count: shot.images }) : t('menu.fullScreenshotSaved');
              return shot.truncated ? `${saved} ${t('menu.captureTruncated', { count: shot.screens })}` : saved;
            }),
        },
        {
          icon: 'textSize',
          section: true,
          label: t('menu.textSize'),
          onPress: () => setTextSizeVisible(true),
        },
        {
          // This site's sheet (with a link to every site); without a site (new tab, Qutai's own pages), the list.
          icon: 'shield',
          label: currentSite
            ? t('menu.sitePermission', { level: t(`site.level.${sitePermissions.levelFor(currentSite)}`) })
            : t('site.listTitle'),
          onPress: () => (currentSite ? setPermissionHost(currentSite) : setSitesListVisible(true)),
        },
      ],
    },
  ];

  /** Actions for a long-pressed link and/or image. Links from incognito tabs stay incognito. */
  const contextActions = (source: Tab, target: ContextTarget): ContextAction[] => {
    const actions: ContextAction[] = [];
    const openBehind = (url: string) => {
      browser.openTab(url, { activate: false, incognito: source.incognito, openerId: source.id });
      toast.show(t('contextMenu.openedInBackground'));
    };
    if (target.href) {
      const href = target.href;
      if (source.incognito) {
        actions.push({
          icon: 'incognito',
          label: t('contextMenu.openInNewIncognito'),
          onPress: () => browser.openTab(href, { incognito: true, openerId: source.id }),
        });
      } else {
        actions.push(
          { icon: 'newTab', label: t('contextMenu.openInNewTab'), onPress: () => openBehind(href) },
          {
            icon: 'incognito',
            label: t('contextMenu.openInIncognito'),
            onPress: () => browser.openTab(href, { incognito: true }),
          },
        );
      }
      actions.push(
        {
          icon: 'copy',
          label: t('menu.copyLink'),
          onPress: () =>
            runAction(async () => {
              await copyText(href);
              return t('menu.linkCopied');
            }),
        },
        { icon: 'share', label: t('menu.shareLink'), onPress: () => runAction(() => shareText(href)) },
        ...(/^(https?|blob|data):/i.test(href)
          ? [
              {
                icon: 'download' as const,
                label: t('contextMenu.downloadLink'),
                onPress: () => runAction(() => downloadRequests.fromUser(source, href)),
              },
            ]
          : []),
        {
          icon: 'assistant',
          label: t('contextMenu.ask'),
          onPress: () => {
            setPanelOpen(true);
            send(t('contextMenu.askPrompt', { url: href }));
          },
        },
      );
      // A PDF link: read it in the chat instead of downloading it (Android's WebView can't show PDFs).
      if (looksLikePdfLink(href, target.linkText)) {
        actions.push({
          icon: 'pdf',
          label: t('contextMenu.readPdf'),
          onPress: () => {
            setPanelOpen(true);
            send(t('contextMenu.readPdfPrompt', { url: href }));
          },
        });
      }
    }
    if (target.src) {
      const src = target.src;
      actions.push({
        icon: 'download',
        label: t('contextMenu.saveImage'),
        // Android: into the Downloads folder and list, like a browser's "Download image" (the gallery shows it there);
        // iOS: to Photos.
        onPress: () =>
          runAction(async () => {
            if (Platform.OS === 'android') return downloadRequests.fromUser(source, src);
            await saveImage(source, src);
            return t('contextMenu.imageSaved');
          }),
      });
      if (!src.startsWith('data:')) {
        actions.push(
          { icon: 'image', label: t('contextMenu.openImage'), onPress: () => openBehind(src) },
          {
            icon: 'copy',
            label: t('contextMenu.copyImageLink'),
            onPress: () =>
              runAction(async () => {
                await copyText(src);
                return t('common.copied');
              }),
          },
        );
      }
    }
    return actions;
  };

  const selectedText =
    selection && selection.tabId === tab.id && selection.url === tab.url && !panelOpen && !running && !findOpen
      ? selection.text
      : '';

  /** Actions for text selected on the page; "Ask" quotes it in the chat input for the user's own question. */
  const selectionActions = (text: string): SelectionAction[] => {
    const quote = quoteSelection(text);
    const ask = (prompt: string) => {
      setPanelOpen(true);
      send(prompt);
    };
    return [
      {
        label: t('selection.ask'),
        icon: 'assistant',
        onPress: () => {
          conversation.setDraft(`${quote}\n\n`);
          setPanelOpen(true);
          setFocusRequest((n) => n + 1);
        },
      },
      { label: t('selection.explain'), onPress: () => ask(t('selection.explainPrompt', { text: quote })) },
      { label: t('selection.translate'), onPress: () => ask(t('selection.translatePrompt', { text: quote })) },
      { label: t('selection.share'), onPress: () => runAction(() => shareText(text)) },
    ];
  };

  // Suggestions in the empty panel for the page on screen, picked here on the phone from what the tab already knows
  // (agent/pageSuggestions.ts); nothing is sent or logged until the user taps one.
  const siteLevel = currentSite ? sitePermissions.levelFor(currentSite) : 'default';
  const sameModeTabs = browser.tabsOf(tab.incognito).filter((x) => x !== tab && !x.isNewTab);
  const suggestions =
    conversation.items.length > 0
      ? []
      : pageSuggestions({
          url: onNewTab ? null : tab.url,
          loadError: !!tab.loadError,
          signals: tab.pageSignals,
          readerAvailable: tab.readerAvailable,
          selectedText: selection && selection.tabId === tab.id && selection.url === tab.url ? selection.text : '',
          otherProductTabs: sameModeTabs.filter((x) => x.pageSignals?.kinds.includes('product')).length,
          otherTabs: tab.groupId
            ? sameModeTabs.filter((x) => x.groupId === tab.groupId).length
            : sameModeTabs.length,
          inGroup: !!tab.groupId,
          incognito: tab.incognito || conversation.incognito || conversation.privacy.touchedIncognito,
          siteLevel,
        });

  // One-tap tasks in the panel; page tasks need a web page Qutai may read, comparing needs several tabs. On a search
  // engine's results page, summarising the results comes first (the page itself is left as it is). "Is this product
  // good?" is for pages that aren't clearly something else; a chip the empty panel already suggests is left out.
  const results = onNewTab ? null : searchResultsOf(tab.url);
  const signals = tab.pageSignals;
  const otherKind =
    !!results ||
    !!signals?.pdf ||
    !!signals?.article ||
    tab.readerAvailable ||
    !!signals?.kinds.some((kind) => kind !== 'product');
  const pageChips =
    onNewTab || siteLevel === 'blocked' ? [] : (['summarize', 'keyPoints', 'translate', 'review'] as const);
  const quickActions: QuickAction[] = [
    ...(results && siteLevel !== 'blocked'
      ? [
          {
            id: 'summarizeResults',
            icon: 'summarize' as const,
            label: t('quick.summarizeResults'),
            prompt: t('quick.summarizeResultsPrompt', {
              query: results.query.slice(0, 200),
              engine: SEARCH_ENGINES[results.engine].name,
            }),
          },
        ]
      : []),
    ...pageChips
      .filter((id) => id !== 'review' || !otherKind || signals?.kinds.includes('product'))
      .map((id) => ({
        id,
        icon: id,
        label: t(`quick.${id}`),
        prompt: t(`quick.${id}Prompt`),
      })),
    ...(sameModeTabs.length + (onNewTab ? 0 : 1) > 1
      ? [{ id: 'compare', icon: 'compare' as const, label: t('quick.compare'), prompt: t('quick.comparePrompt') }]
      : []),
  ].filter((action) => !suggestions.some((s) => s.id === action.id));

  /** Settings > Clear browsing data. History, activity and the AI request log follow the time range; the rest is cleared entirely. */
  const clearData = async (options: ClearOptions) => {
    const from = rangeStart(options.range);
    const db = await getDb();
    if (options.history) await deleteHistorySince(db, from);
    if (options.activity) await deleteActionsSince(db, from);
    if (options.aiRequests) await deleteSentSince(db, from);
    if (options.recentlyClosed) browser.clearRecentlyClosed();
    if (options.chats) {
      browser.conversations.forEach((x) => {
        if (!x.running) x.clear();
      });
      await deleteOrphanChats(
        db,
        browser.conversations.filter((x) => x.running).map((x) => x.key),
      );
      await pruneAttachmentFiles();
    }
    // iOS: Qutai's own files and the list; Android: the list (running downloads stop), the files stay in Downloads.
    if (options.downloads) await downloads.clearAll();
    if (options.offlinePages) {
      for (const page of await listOfflinePages(db)) {
        deleteOfflineFile(page);
        await removeOfflinePage(db, page.id);
      }
    }
    if (options.cache) {
      // The data store is shared by all normal tabs, so one WebView clears it for every site. Not an incognito
      // tab's: on Android it has its own profile (deleted with the incognito session), so it would clear only that.
      browser.tabs.find((x) => x.webview && !x.incognito)?.webview?.clearCache?.(true);
      clearInsecureExceptions();
      browser.clearCertificateExceptions();
    }
    toast.show(t('clearData.done'));
  };

  /** The assistant removed bookmarks: a toast with "Undo" puts them back where they were. */
  const offerBookmarkUndo = (removed: Bookmark[]) => {
    const message =
      removed.length === 1 ? t('menu.bookmarkRemoved') : t('bookmarksTool.removedMany', { count: removed.length });
    toast.show(message, {
      label: t('common.undo'),
      onPress: () => {
        getDb()
          .then((db) => restoreBookmarks(db, removed))
          .then(notifyBookmarksChanged)
          .catch(() => {});
      },
    });
  };

  // Settings apply as they are changed; the screen stays open.
  const onChangeSettings = async (next: Settings) => {
    setSettings(next);
    try {
      await saveSettings(next);
    } catch (e) {
      dialog.alert(t('settings.saveFailed'), e instanceof Error ? e.message : String(e));
    }
  };

  // Holding the Qutai button: a voice message to the conversation on screen, with the panel closed.
  const sendRef = useRef(send);
  sendRef.current = send;
  const ptt = usePushToTalk({
    busy: () => browserInstance.conversations.some((x) => x.running),
    send: (text) => void sendRef.current(text, { voice: true }),
    languages: () => listeningOrder(browserInstance.conversationOf(browserInstance.active), settingsRef.current),
    incognito: () => {
      const active = browserInstance.active;
      const chat = browserInstance.conversationOf(active);
      return active.incognito || chat.incognito || chat.privacy.touchedIncognito;
    },
    online: settings.voiceOnline,
    onOnlineChange: (voiceOnline) => onChangeSettings({ ...settingsRef.current, voiceOnline }),
    onStarted: (lang) => {
      const active = browserInstance.active;
      const chat = browserInstance.conversationOf(active);
      rememberVoiceLanguage(lang, active.incognito || chat.incognito || chat.privacy.touchedIncognito);
    },
    openPanel: () => setPanelOpen(true),
    toast: toast.show,
  });

  /** The language voice input last listened in: a fallback for conversations that say nothing yet. Not incognito. */
  const rememberVoiceLanguage = (lang: string, incognito: boolean) => {
    if (incognito || settingsRef.current.voiceLastLanguage === lang) return;
    const next = { ...settingsRef.current, voiceLastLanguage: lang };
    settingsRef.current = next;
    onChangeSettings(next);
  };

  // The address bar (or the find bar in its place), at the top or the bottom of the screen.
  const topBar = findOpen ? (
    <FindBar tab={tab} darkMode={darkMode} onClose={() => setFindFor(null)} />
  ) : (
    <AddressBar
      url={onNewTab ? '' : tab.url}
      editRequest={addressEdit}
      onEditRequestApplied={clearAddressEdit}
      searchEngine={settings.searchEngine}
      searchSuggestions={settings.searchSuggestions}
      onAsk={(text) => {
        setPanelOpen(true);
        send(text);
      }}
      loading={tab.loading}
      usingLocation={!onNewTab && tab.geolocation.inUse}
      notSecure={
        !onNewTab &&
        (tab.loadError?.kind === 'cert' ||
          tab.loadError?.kind === 'ssl' ||
          usesCertificateException(tab.url, tab.incognito))
      }
      usingCamera={!onNewTab && tab.media.camera}
      usingMicrophone={!onNewTab && tab.media.microphone}
      onSitePermissionsPress={() => setPermissionHost(siteKey(tab.url))}
      canGoBack={tab.canGoBack || tab.openedFromNewTab}
      tabCount={browser.tabs.length}
      assistantOpen={panelOpen}
      assistantRunning={running}
      assistantUnseen={!panelOpen && unseenChat !== undefined}
      showAssistant={settings.showAssistantButton}
      assistantHold={settings.voiceHoldToTalk ? ptt.handlers : undefined}
      assistantHoldActive={ptt.bubble.phase !== 'idle'}
      onSubmit={(url) => tab.loadUrl(upgradeToHttps(url, settings.httpsOnly))}
      onBack={() => (tab.canGoBack ? tab.webview?.goBack() : tab.showNewTab())}
      readerState={onNewTab ? 'none' : tab.reader ? 'on' : tab.readerAvailable ? 'available' : 'none'}
      onToggleReader={toggleReader}
      onOpenMenu={() => {
        // The menu shows "add" or "remove" depending on whether this page is already saved, and
        // offers reader mode by a fresh look at the page (pages that filled in their content late).
        const bookmark = getDb()
          .then((db) => isBookmarked(db, tab.url))
          .then(setBookmarked)
          .catch(() => setBookmarked(false));
        const article = tab.reader || onNewTab ? null : Promise.race([tab.probeReader(), sleep(700)]);
        Promise.all([bookmark, article]).finally(() => setMenuVisible(true));
      }}
      incognito={tab.incognito}
      darkMode={darkMode}
      position={settings.addressBarPosition}
      onSwipe={(direction) => {
        const same = browser.tabsOf(tab.incognito);
        const next = same[same.indexOf(tab) + direction];
        if (!next) return;
        tick();
        browser.switchTab(next.id);
      }}
      onOpenTabs={async () => {
        // Thumbnails can only be taken while a tab is on screen.
        await tab.captureThumbnail();
        setTabsVisible(true);
      }}
      onToggleAssistant={() => setPanelOpen((v) => !v)}
    />
  );
  const barAtBottom = settings.addressBarPosition === 'bottom';

  return (
    <LogoMotion.Provider value={settings.animateLogo}>
      <View style={[styles.container, (tab.incognito || darkMode) && styles.incognito]}>
        <StatusBar style={tab.incognito || tabsVisible || darkMode ? 'light' : 'dark'} />
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
          {/* Expo apps on Android are edge-to-edge, so the window no longer resizes for the keyboard: the page, and the address bar when it is at the bottom, stay above it. */}
          {barAtBottom ? null : topBar}
          <KeyboardAvoidingContainer style={styles.flex}>
            <ErrorBoundary>
              <BrowserView
                browser={browser}
                newTabActions={{
                  darkMode,
                  darkSites: settings.darkSites,
                  blockAds: settings.blockAds,
                  blockingOffSites: sitePermissions.blockingOffSites(),
                  contentRuleLists: contentBlocking.ruleLists,
                  httpsOnly: settings.httpsOnly,
                  blockThirdPartyCookies: settings.blockThirdPartyCookies,
                  hideCookieBanners: settings.hideCookieBanners,
                  onContextMenu: (source, target) => {
                    bump();
                    setContext({ tab: source, target });
                  },
                  // The download indicator and the Downloads screen show it meanwhile.
                  onDownload: (source, download) => runAction(() => downloadRequests.fromPage(source, download)),
                  onSelection: (source, text) =>
                    setSelection((prev) =>
                      text ? { tabId: source.id, url: source.url, text } : prev?.tabId === source.id ? null : prev,
                    ),
                  textZoom: settings.textZoom,
                  forceZoom: settings.forceZoom,
                  backgroundPlayback: settings.backgroundPlayback,
                  onNotice: toast.show,
                  searchEngine: settings.searchEngine,
                  onAsk: (text) => {
                    setPanelOpen(true);
                    if (text) send(text);
                    else setFocusRequest((n) => n + 1);
                  },
                  onOpenLibrary: setLibrary,
                  reader: {
                    theme: settings.readerTheme,
                    font: settings.readerFont,
                    easyReading: settings.readerEasyReading,
                  },
                  onOpenReaderSettings: () => setReaderSettingsVisible(true),
                }}
              />
            </ErrorBoundary>
            {selectedText ? (
              <SelectionBar
                actions={selectionActions(selectedText)}
                dark={tab.incognito || darkMode}
                bottomOffset={barAtBottom ? 52 : 0}
              />
            ) : null}
            {barAtBottom ? topBar : null}
          </KeyboardAvoidingContainer>
        </SafeAreaView>

        <ErrorBoundary full>
          <AssistantPanel
            dark={darkMode}
            hasPage={!tab.isNewTab}
            suggestions={suggestions}
            open={panelOpen}
            recentTasks={recentTasks}
            onRunTask={(task) => runSavedTask(task)}
            onOpenTasks={() => setTasksScreen({ draft: null })}
            onSaveAsTask={(prompt) =>
              setTasksScreen({
                draft: {
                  ...emptyTask(),
                  prompt,
                  target: tab.isNewTab ? 'none' : 'page',
                  incognito: conversation.incognito || conversation.privacy.touchedIncognito,
                },
              })
            }
            preparedTask={
              prepared && prepared.chat === conversation && conversation.draft.trim() ? prepared.task.name : null
            }
            onRunPrepared={runPrepared}
            pending={conversation.pending}
            onAttach={() => setAttachSheet(true)}
            onRemovePending={removePending}
            onOpenAttachment={setPreviewAttachment}
            onShare={(offer) => runShare(offer, conversation)}
            onImage={(action, info) =>
              runAction(async () => {
                if (action === 'share') return void (await shareAttachment(info));
                if (info.kind === 'pdf') {
                  if (await saveAttachmentToFolder(info)) return t('chat.fileSaved', { name: info.name });
                  return;
                }
                await saveAttachmentToPhotos(info);
                return t('contextMenu.imageSaved');
              })
            }
            voice={{
              incognito: tab.incognito || conversation.incognito || conversation.privacy.touchedIncognito,
              online: settings.voiceOnline,
              onOnlineChange: (voiceOnline) => onChangeSettings({ ...settings, voiceOnline }),
              autoSend: settings.voiceAutoSend,
              notify: toast.show,
              languages: () => listeningOrder(conversation, settingsRef.current),
              picked: conversation.voiceLanguage,
              onPick: (language) => {
                conversation.setVoiceLanguage(language);
                persistConversation(conversation);
              },
              autoLabel:
                settings.voiceLanguage === AUTO_LANGUAGE
                  ? t('voice.auto')
                  : t('voice.defaultLanguage', { language: languageName(settings.voiceLanguage) }),
              autoHint:
                settings.voiceLanguage === AUTO_LANGUAGE
                  ? t('voice.autoNow', { language: languageName(automaticLanguage(conversation, settings)) })
                  : undefined,
              onStarted: (lang) =>
                rememberVoiceLanguage(
                  lang,
                  tab.incognito || conversation.incognito || conversation.privacy.touchedIncognito,
                ),
            }}
            quickActions={quickActions}
            draft={conversation.draft}
            onDraftChange={(text) => {
              conversation.setDraft(text);
              persistDraftSoon(conversation);
            }}
            focusRequest={focusRequest}
            research={conversation.research}
            onResearchChange={(on) => conversation.setResearch(on)}
            modelInfo={
              conversationModelInfo(settings, conversation.model) +
              ((conversation.model && isConfigured(settings, conversation.model.provider) ? conversation.model.provider : settings.provider) ===
                'qutai' && creditsState.balance !== null
                ? ` · ${creditsLabel(creditsState.balance)}`
                : '')
            }
            modelChosen={!!conversation.model && isConfigured(settings, conversation.model.provider)}
            onModelPress={() => setModelSheetFor(conversation)}
            items={conversation.items}
            running={conversation.running}
            busyElsewhere={running && !conversation.running}
            onShowRunningTab={() => runningTab && browser.switchTab(runningTab.id)}
            finishedElsewhere={unseenChat && unseenChat !== conversation ? unseenChat.unseen : null}
            onShowFinished={() => unseenChat && showConversation(unseenChat)}
            onClose={closePanel}
            onSend={send}
            onStop={() => conversation.stop()}
            onChoose={(itemId, option) => {
              tick();
              conversation.choose(itemId, option);
              send(option);
            }}
            onNewChat={newChat}
            onOpenSettings={() => setSettingsVisible(true)}
            onItemAction={onItemAction}
            onShowSent={() => setSentFor(conversation.key)}
            showCost={settings.showCost}
            onOpenSource={(source) => {
              // A page that is still open is shown in its tab; otherwise it opens again in the same mode.
              const open = browser.tabs.find((x) => x.incognito === source.incognito && x.url === source.url);
              if (open) browser.switchTab(open.id);
              else browser.openTab(source.url, { incognito: source.incognito });
              closePanel();
            }}
            onOpenLink={(url) => {
              browser.openTab(url, { incognito: browser.active.incognito });
              closePanel();
            }}
            onCall={(number) => {
              bump();
              placeCall(number, () => toast.show(t('common.copied')));
            }}
            onSms={(offer) => {
              bump();
              openSmsComposer(offer, () => toast.show(t('common.copied')));
            }}
            onWhatsApp={(offer) => {
              bump();
              openWhatsApp(offer, () => toast.show(t('common.copied')));
            }}
            onFile={(action, file) =>
              runAction(async () => {
                try {
                  if (action === 'share') return void (await shareComposedFile(file.id));
                  if (await saveComposedFileToFolder(file.id)) return t('chat.fileSaved', { name: file.name });
                } catch (e) {
                  if (e instanceof FileExpiredError) return t('chat.fileExpired');
                  throw e;
                }
              })
            }
            onMessageAction={(action, text) =>
              runAction(async () => {
                if (action === 'copy') {
                  await copyText(text);
                  return t('common.copied');
                }
                if (action === 'share') return shareText(text);
                if (action === 'pdf') {
                  // Kept with the conversation (so it can be attached or shared later), then the share sheet.
                  const chat = conversation;
                  const pdf = await renderReportPdf(text);
                  const info = storeMadePdf(pdf.file, pdf.fileName, 'report', chat.incognito || chat.privacy.touchedIncognito);
                  chat.addMadePdf(info, true);
                  return void (await shareAttachment(info));
                }
                if (action === 'stopSpeaking') return stopSpeaking();
                await speak(text);
              })
            }
          />
        </ErrorBoundary>
        <PageMenu
          visible={menuVisible}
          iconRow={iconRow}
          items={menuItems}
          incognito={tab.incognito}
          darkMode={darkMode}
          onClose={() => setMenuVisible(false)}
        />
        <LibraryScreen
          visible={library !== null}
          initialTab={library ?? 'bookmarks'}
          onOpen={(url) => {
            setLibrary(null);
            tab.loadUrl(url);
          }}
          onClose={() => setLibrary(null)}
        />
        <TabSwitcher
          darkMode={darkMode}
          visible={tabsVisible}
          browser={browser}
          onClose={() => setTabsVisible(false)}
          onCompare={(picked) => {
            setTabsVisible(false);
            setPanelOpen(true);
            const list = picked.map((x) => `- tab ${x.id}: ${x.title || x.url} (${x.url})`).join('\n');
            send(t('tabs.comparePrompt', { tabs: list }));
          }}
        />
        <SentLogScreen
          visible={sentFor !== null}
          conversation={sentFor ?? undefined}
          customInstructions={settings.customInstructions}
          showCost={settings.showCost}
          viaQutai={(conversation.model?.provider ?? settings.provider) === 'qutai'}
          onClose={() => setSentFor(null)}
        />
        <SettingsModal
          onClearData={clearData}
          visible={settingsVisible}
          initialPage={settingsPage}
          settings={settings}
          onChange={onChangeSettings}
          onClose={() => {
            setSettingsVisible(false);
            setSettingsPage('main');
          }}
          onRunTask={runSavedTask}
          incognitoActive={browser.active.incognito}
          onShowAssistantIntro={() => {
            setSettingsVisible(false);
            setAssistantIntroSeen(false).catch(() => {});
            setIntroPending(true);
          }}
        />
        <ContextMenuSheet
          target={context?.target ?? null}
          actions={context ? contextActions(context.tab, context.target) : []}
          onClose={() => setContext(null)}
        />
        <DownloadsScreen
          visible={downloadsVisible}
          store={downloads}
          copyText={copyText}
          onAsk={askAboutDownload}
          onClose={() => setDownloadsVisible(false)}
        />
        <SitePermissionSheet
          host={permissionHost}
          level={permissionHost ? sitePermissions.levelFor(permissionHost) : 'default'}
          onSelect={(level) => permissionHost && sitePermissions.set(permissionHost, level).catch(() => {})}
          location={permissionHost ? sitePermissions.locationFor(permissionHost) : 'ask'}
          onSelectLocation={(setting) =>
            permissionHost && sitePermissions.setLocation(permissionHost, setting).catch(() => {})
          }
          camera={permissionHost ? sitePermissions.mediaFor(permissionHost, 'camera') : 'ask'}
          microphone={permissionHost ? sitePermissions.mediaFor(permissionHost, 'microphone') : 'ask'}
          onSelectMedia={(kind, setting) =>
            permissionHost && sitePermissions.setMedia(permissionHost, kind, setting).catch(() => {})
          }
          personal={permissionHost ? sitePermissions.personalFor(permissionHost) : 'ask'}
          onSelectPersonal={(setting) =>
            permissionHost && sitePermissions.setPersonal(permissionHost, setting).catch(() => {})
          }
          // The page on screen is capturing on this site: offer to stop it right here.
          capturing={!!permissionHost && siteKey(tab.url) === permissionHost && tab.media.capturing}
          onStopCapture={() => tab.media.stop()}
          blocking={permissionHost ? sitePermissions.blockingFor(permissionHost) : true}
          onSetBlocking={(on) => permissionHost && sitePermissions.setBlocking(permissionHost, on).catch(() => {})}
          blockingEnabled={settings.blockAds}
          // The count belongs to the page on screen (Android); WebKit doesn't report one (iOS).
          blockedCount={
            !!permissionHost && siteKey(tab.url) === permissionHost && contentBlocking.active
              ? Platform.OS === 'ios'
                ? 'unavailable'
                : tab.blockedCount
              : undefined
          }
          onReload={!!permissionHost && siteKey(tab.url) === permissionHost ? () => tab.webview?.reload() : undefined}
          onShowAll={() => {
            setPermissionHost(null);
            setSitesListVisible(true);
          }}
          onClose={() => setPermissionHost(null)}
        />
        <SitePermissionsScreen
          visible={sitesListVisible}
          store={sitePermissions}
          blockingEnabled={settings.blockAds}
          onClose={() => setSitesListVisible(false)}
        />
        <TextSizeSheet
          visible={textSizeVisible}
          zoom={settings.textZoom}
          onChange={(textZoom) => onChangeSettings({ ...settings, textZoom })}
          onClose={() => setTextSizeVisible(false)}
        />
        <ModelSheet
          visible={!!modelSheetFor}
          settings={settings}
          current={modelSheetFor?.model ?? null}
          onChoose={(choice) => {
            if (!modelSheetFor || modelSheetFor.running) return;
            modelSheetFor.setModel(choice);
            // Kept with the conversation (never for an incognito one: storeChat writes nothing for those).
            persistConversation(modelSheetFor);
          }}
          onOpenSettings={() => {
            setPanelOpen(false);
            setSettingsVisible(true);
          }}
          onClose={() => setModelSheetFor(null)}
        />
        <ReaderSettingsSheet
          visible={readerSettingsVisible}
          value={{
            readerTheme: settings.readerTheme,
            readerFont: settings.readerFont,
            readerEasyReading: settings.readerEasyReading,
            textZoom: settings.textZoom,
          }}
          onChange={(value) => onChangeSettings({ ...settings, ...value })}
          onClose={() => setReaderSettingsVisible(false)}
        />
        <OfflinePagesScreen
          visible={offlineVisible}
          onOpenLive={(url) => {
            setOfflineVisible(false);
            browser.openTab(url, { incognito: tab.incognito });
          }}
          onClose={() => setOfflineVisible(false)}
        />
        <QrCodeSheet
          url={qrUrl}
          onShareLink={(url) => runAction(() => shareText(url))}
          onShareImage={(view) =>
            runAction(async () => {
              const uri = await captureRef(view, { format: 'png', result: 'tmpfile' });
              await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
            })
          }
          onClose={() => setQrUrl(null)}
        />
        <QrScanner
          visible={scannerVisible}
          onScan={(data) => {
            setScannerVisible(false);
            const target = scannedTarget(data);
            if (target.kind === 'url') browser.openTab(target.value, { incognito: tab.incognito });
            else if (target.value) tab.loadUrl(toUrl(target.value, settings.searchEngine));
          }}
          onClose={() => setScannerVisible(false)}
        />
        <DownloadIndicator
          store={downloads}
          bottomOffset={barAtBottom ? 64 : 16}
          onOpen={() => setDownloadsVisible(true)}
          onOpenFile={(item) => void openDownload(downloads, item, toast.show)}
        />
        <ActionSheet
          title={
            attachSheet
              ? t('attach.sheetNote', { provider: getProvider(conversation.model?.provider ?? settings.provider).label })
              : null
          }
          actions={[
            { label: t('attach.photos'), onPress: () => attach('photos') },
            { label: t('attach.camera'), onPress: () => attach('camera') },
            { label: t('attach.file'), onPress: () => attach('file') },
          ]}
          dark={darkMode}
          onClose={() => setAttachSheet(false)}
        />
        <AttachmentPreview
          info={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          onShare={(info) => runAction(() => shareAttachment(info))}
          onSave={(info) =>
            runAction(async () => {
              await saveAttachmentToPhotos(info);
              return t('contextMenu.imageSaved');
            })
          }
          onResize={resizeAttachment}
        />
        <TasksScreen
          visible={tasksScreen !== null}
          draft={tasksScreen?.draft}
          onClose={() => setTasksScreen(null)}
          onRun={runSavedTask}
        />
        <ActionSheet
          // Hidden while the app lock shows (it reappears after unlocking).
          title={incoming && !appLocked ? t('incoming.title', { text: incoming.text.replace(/\s+/g, ' ').slice(0, 120) }) : null}
          actions={incoming ? incomingActions(incoming) : []}
          dark={darkMode}
          onClose={() => setIncoming(null)}
        />
        <LockScreen locked={lock} onUnlock={unlock} onLeave={leaveIncognito} />
        <CaptureOverlay />
        <PdfReaderHost />
        <PushToTalkBubble
          bubble={ptt.bubble}
          barAtBottom={barAtBottom}
          onOpenPanel={() => setPanelOpen(true)}
          onSend={ptt.handlers.release}
          onCancel={ptt.handlers.cancel}
          onDismiss={ptt.dismiss}
        />
        <CalendarChoiceHost />
        <AssistantIntro
          // Waits while something else is in front: the panel, Settings, the tab switcher, the app lock.
          visible={introPending && settings.showAssistantButton && !panelOpen && !settingsVisible && !tabsVisible && !lock}
          holdToTalk={settings.voiceHoldToTalk}
          barAtBottom={barAtBottom}
          onOpenAssistant={() => setPanelOpen(true)}
          onDismiss={dismissIntro}
        />
        <Toast key={toast.key} message={toast.message} action={toast.action} onHidden={toast.hide} />
        <DialogHost root />
      </View>
    </LogoMotion.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f4ef' },
  incognito: { backgroundColor: '#24232b' },
  flex: { flex: 1 },
});
