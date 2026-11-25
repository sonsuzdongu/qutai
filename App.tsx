import { siteRules } from './src/storage/siteRules';
import { TaskRunner } from './src/task/taskRunner';
import { ChatSaver, saveOnLeaving } from './src/storage/chatSaver';
import { SettingsWriter } from './src/storage/settingsWriter';
import { sendTask, type SendOptions, type TaskHost } from './src/task/sendTask';
import type { SettingsPatch } from './src/storage/settings';
import { setTaskDialogSites } from './src/task/dialogs';
import { pageStyleState } from './src/browser/pageStyleState';
import { keepScript } from './src/components/pageScripts';
import { ScriptSandboxHost } from './src/components/ScriptSandbox';
import { AppRunnerHost } from './src/components/AppRunner';
import { AppImportHost } from './src/components/AppImport';
import { appImporter } from './src/apps/importState';
import { pickAndImportApp } from './src/components/appActions';
import { appStore, appsChanged } from './src/apps/appStore';
import { appRunner } from './src/apps/runnerState';
import { keptScripts } from './src/browser/keptScripts';
import { loadScriptKey, scriptKey } from './src/device/scriptKey';
import { keepStyle, stylesApply, undoOffer } from './src/components/pageCustomisation';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  Appearance,
  AppState,
  Linking,
  PixelRatio,
  Platform,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { runAgent } from './src/agent/runAgent';
import { actionErrorText } from './src/agent/stepLine';
import { Conversation } from './src/chat/Conversation';
import { listShareables, type ShareApp, type ShareOffer } from './src/chat/shareable';
import { clearOutgoing, OutgoingError, prepareOutgoing } from './src/device/outgoing';
import { shareToApp } from './src/device/share';
import { AttachmentInfo, isIncognitoAttachment, MAX_ATTACHMENTS } from './src/chat/attachments';
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
import { describeFilters } from './src/chat/filterSummary';
import { PdfReaderHost } from './src/components/PdfReaderHost';
import { creditsStore, creditsReady, refreshCredits, useCreditsState } from './src/credits';
import { creditsLabel } from './src/components/AnswerCost';
import { defaultTier, usesTiers } from './src/credits/tiers';
import { dismissLowBalance, LOW_BALANCE_START, lowBalanceThreshold, nextLowBalance } from './src/credits/lowBalance';
import { accountSession, useAccountState } from './src/account';
import { lostQutaiAccount } from './src/credits/gate';
import type { ProviderId } from './src/ai/types';
import { reportPendingPurchases } from './src/purchases';
import { BuyCreditsHost, openBuyCredits } from './src/components/BuyCredits';
import { askCreditsDisclosure } from './src/components/CreditsDisclosure';
import { ensureAiConsent } from './src/components/AiConsent';
import { getProvider, isConfigured } from './src/ai/providers';
import { Browser, ClosedTab, useBrowser } from './src/browser/Browser';
import { ContextTarget, looksLikePdfLink } from './src/browser/contextMenu';
import { quoteSelection } from './src/browser/selection';
import { noteOpenedFromApp } from './src/browser/externalGuard';
import type { Tab } from './src/browser/Tab';
import { useHardwareBack } from './src/browser/useHardwareBack';
import { AddressBar, type ProgressLineState } from './src/components/AddressBar';
import { NavigationStatus } from './src/components/NavigationStatus';
import { connectivity } from './src/device/connectivity';
import { tabsToReloadOnReconnect } from './src/browser/offlineReload';
import { hostOf, slowness } from './src/browser/pendingNavigation';
import { BrowserView } from './src/components/BrowserView';
import { ContextAction, ContextMenuSheet } from './src/components/ContextMenuSheet';
import { chatLinkPlan } from './src/browser/chatLinks';
import {
  AssistantPanel,
  QuickAction,
  type AssistantPanelProps,
  type ChatItem,
  type ChatItemAction,
  type VoiceProps,
} from './src/components/AssistantPanel';
import { useStableHandlers } from './src/utils/useStableHandlers';

/** The chat panel's functions (every on… prop), kept stable for the memoised panel. */
type PanelHandlers = {
  [K in keyof AssistantPanelProps as K extends `on${string}` ? K : never]-?: NonNullable<AssistantPanelProps[K]>;
};
type VoiceHandlers = Pick<VoiceProps, 'onOnlineChange' | 'notify' | 'languages' | 'onPick' | 'onStarted'>;
import { FindBar } from './src/components/FindBar';
import { KeyboardAvoidingContainer } from './src/components/KeyboardAware';
import { LibraryScreen, LibraryTab } from './src/components/LibraryScreen';
import { IconItem, MenuItem, PageMenu } from './src/components/PageMenu';
import type { SettingsPage } from './src/components/SettingsModal';
import { ServerRestoreOffer } from './src/components/ServerRestoreOffer';
import { useServerBackupLifecycle } from './src/backup/server/useServerBackupLifecycle';
import {
  AssistantIntro,
  assistantIntroSeen,
  measureAssistantButton,
  setAssistantIntroSeen,
} from './src/components/AssistantIntro';
import { CalendarChoiceHost } from './src/components/CalendarChoiceScreen';
import { SelectionAction, SelectionBar } from './src/components/SelectionBar';
import { PageZoomSheet, TextSizeSheet } from './src/components/TextSizeSheet';
import { ReaderSettingsSheet } from './src/components/ReaderSettingsSheet';
import { conversationModelInfo, ModelSheet } from './src/components/ModelSheet';
import { sleep } from './src/utils/sleep';
import { emptyTask } from './src/components/TasksScreen';
import { AppScreens, screenOf, type OpenScreen, type ScreenKind } from './src/components/AppScreens';
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
import { BarLayout } from './src/components/BarLayout';
import { useKeyboardVisible } from './src/utils/useKeyboardVisible';
import { copyLink, copyText, shareLink, shareText } from './src/device/link';
import { printPage, savePagePdf, savePdfFromScreenshots } from './src/device/pdf';
import { saveImage } from './src/device/saveImage';
import { CaptureCancelled } from './src/device/fullPage';
import { offerSettings, PermissionDeniedError } from './src/device/settings';
import { saveFullPageScreenshot } from './src/device/screenshot';
import { setSpeechNotice, speak, stopSpeaking, useIsSpeaking } from './src/device/speech';
import { speechText } from './src/chat/speechText';
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
import { getDb, withDb } from './src/storage/db';
import { setStorageNotice } from './src/storage/failures';
import { deviceMemoryStore } from './src/storage/memory';
import { ActionEntry, addAction, pruneActions } from './src/storage/actionLog';
import { deleteHistorySince, mostVisitedSites, searchHistory } from './src/storage/history';
import { placeCall } from './src/device/phone';
import { SEARCH_ENGINES, searchResultsOf } from './src/browser/search';
import { openSmsComposer } from './src/device/sms';
import { openWhatsApp } from './src/device/whatsapp';
import {
  NotificationOrigin,
  incognitoOriginTab,
  initNotifications,
  notificationOrigin,
  cancelTaskNotice,
  postTaskNotice,
} from './src/device/notifications';
import { PAUSED_NOTICE_DELAY_S, taskNoticeFor, type TaskNoticeEvent } from './src/agent/taskNotice';
import { renderReportPdf } from './src/device/reportPdf';
import { authenticate } from './src/device/biometric';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { IntroVariant, LaunchIntro } from './src/components/LaunchIntro';
import { LockScreen } from './src/components/LockScreen';
import { Onboarding } from './src/components/Onboarding';
import { useAccountLinks } from './src/components/AccountLinks';
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
import { deleteOfflineFile, savePageOffline } from './src/device/offline';
import { addOfflinePage, listOfflinePages, removeOfflinePage } from './src/storage/offlinePages';
import { QrCodeSheet } from './src/components/QrCodeSheet';
import { captureRef } from 'react-native-view-shot';
import { clearInsecureExceptions, upgradeToHttps } from './src/browser/httpsOnly';
import { usesCertificateException } from './src/browser/certificateExceptions';
import { ClearOptions, rangeStart } from './src/storage/clearData';
import { deleteActionsSince } from './src/storage/actionLog';
import { deleteSentSince, moveSentConversation, pruneSent } from './src/storage/sentLog';
import { bump, setHapticsEnabled, signal, tick } from './src/device/haptics';
import { FileExpiredError, saveComposedFileToFolder, shareComposedFile } from './src/device/composedFile';
import { DownloadItem, DownloadStore } from './src/storage/downloads';
import { AndroidDownloads, nativeDownloads } from './src/storage/androidDownloads';
import { IosDownloads } from './src/storage/iosDownloads';
import { DownloadRequests } from './src/browser/downloadRequests';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SitePermissionStore } from './src/storage/sitePermissions';
import { siteKey } from './src/agent/sitePolicy';
import { pageSuggestions } from './src/agent/pageSuggestions';
import { SitePermissionSheet } from './src/components/SitePermissionSheet';
import { configurePageLocation } from './src/browser/geolocation';
import { configurePageMedia } from './src/browser/mediaCapture';
import { pauseAllPages } from './src/browser/playback';
import { configureBackgroundMedia, setPictureInPictureAllowed } from './src/device/backgroundMedia';
import {
  backgroundRunNotifies,
  beginBackgroundTask,
  configureBackgroundTasks,
  endBackgroundTask,
  isWaitingForApproval,
  onApprovalWaitingInBackground,
  onBackgroundOpenRequested,
  onBackgroundStopRequested,
  useWaitingForUser,
} from './src/device/backgroundTask';
import { setMarkerEnvironment, clearMark } from './src/agent/actionMarker';
import { ActionMarkerLayer } from './src/components/ActionMarkerLayer';
import { AnswerCard, QuestionCard, StepStrip } from './src/components/StepStrip';
import { questionFitsBubble } from './src/chat/questionBubble';
import { setCardImageBlocking } from './src/chat/cardImages';
import { WorkingGlow } from './src/components/WorkingGlow';
import { useScreenReader } from './src/components/useHoldGesture';
import { currentStripLine, plainAnswer } from './src/chat/stripLine';
import { idleView, stripVisible, workingStep, type WorkingEvent, type WorkingView } from './src/chat/workingView';
import { deleteOrphanChats, loadChat, savedAttachmentIds, storeChat } from './src/storage/chat';
import { loadRecentlyClosed, loadSession, Session } from './src/storage/session';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings, ThemeSetting } from './src/storage/settings';
import { holdSplash } from './src/ui/launch';
import { darkPalette, lightPalette } from './src/ui/theme';
import { usePersistSession } from './src/storage/usePersistSession';
import { useRecordHistory } from './src/storage/useRecordHistory';
import { TabStrip } from './src/components/TabStrip';
import { stripDevice } from './src/device/macDevice';
import { showTabStrip } from './src/ui/tabStrip';
import { useKeyShortcuts } from './src/device/keyShortcuts';
import { shortcutTab, type ShortcutEvent } from './src/ui/keyShortcuts';
import { DEFAULT_ZOOM_LEVEL, zoomReplacesTextSize } from './src/browser/pageZoom';
import { siteZoom, useSiteZoomLevel } from './src/browser/siteZoom';
import {
  VOICE_KEY_IDLE,
  VOICE_MIN_HOLD_MS,
  voiceKeyStep,
  type VoiceKeyEvent,
  type VoiceKeyState,
} from './src/ui/voiceKey';
import { clearSiteIcons } from './src/storage/siteIcons';
import { setIncognitoProbe } from './src/analytics';
import { askAnalyticsConsentOnce } from './src/analytics/consentPrompt';
import { maybeAskForReview } from './src/device/reviewPrompt';

// The native splash stays until the first real frame is ready (src/ui/launch.ts).
holdSplash();
// The launch intro plays once per process: not again when Android recreates the activity with the app running.
let introPlayed = false;

/** The theme setting overrides the system appearance for the whole app, web pages included. */
function applyTheme(theme: ThemeSetting) {
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
}

/** A Mac: the page menu's Text size is Zoom (UI-84). */
const MAC_ZOOM_MENU = zoomReplacesTextSize(stripDevice);
const memoryStore = deviceMemoryStore(getDb);
const sitePermissions = new SitePermissionStore(getDb);
// "Always allow" in a task's dialogs (src/task/dialogs.ts) is saved here.
setTaskDialogSites(sitePermissions);
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
  void withDb('actionLog.add', (db) => addAction(db, entry));
}

// Conversations saved by earlier versions belong to the tab that is active on the first start.
let legacyChatPending = true;

/** Reads a conversation's saved messages from disk, once (the key is read when the database is ready). */
function readConversation(chat: Conversation, adoptLegacy = false) {
  if (chat.loaded || chat.loading) return;
  chat.loading = true;
  // Unreadable: the conversation starts empty and the user is told (an unreadable saved value is kept aside, db.ts).
  void withDb('chat.load', (db) => loadChat(db, chat.key, { adoptLegacy }), 'user').then((saved) => chat.restore(saved ?? null));
}

export default function App() {
  // Re-renders the whole tree in the new language when the device language changes.
  const language = useLanguage();
  // Pro mode: sign-in links from the mail (qutai://sign-in/email?token=…), in setup as well as in the browser.
  useAccountLinks();
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
        : introPlayed || reduceMotion
          ? 'still'
          : 'animate';
      introPlayed = true;
      setBoot({ settings: s, intro });
    });
    void withDb('session.load', (db) => Promise.all([loadSession(db), loadRecentlyClosed(db)]), 'user')
      .then((loaded): [Awaited<ReturnType<typeof loadSession>>, ClosedTab[]] => loaded ?? [null, []])
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
        {/* Buying Qutai Credits (pro mode only): from setup, Settings and the "not enough credits" message. */}
        <BuyCreditsHost />
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
  // Whether the phone is online: a navigation started offline says so at once, and tabs that failed because the phone
  // was offline reload once when the connection returns.
  const online = useSyncExternalStore(connectivity.subscribe, () => connectivity.online);
  useEffect(() => {
    void connectivity.start();
    return connectivity.onReconnect(() => {
      for (const failed of tabsToReloadOnReconnect(browserInstance.tabs)) {
        failed.offlineErrorUrl = null;
        failed.reload();
      }
    });
  }, [browserInstance]);
  usePersistSession(browser);
  useRecordHistory(browser);

  // A tab group shares one conversation, an ungrouped tab has its own; only one task runs at a time.
  const conversation = browser.conversationOf(tab);
  const runningChat = browser.conversations.find((x) => x.running);
  const running = runningChat !== undefined;
  const runningTab = runningChat && browser.tabs.find((x) => browser.conversationOf(x) === runningChat);
  const [panelOpen, setPanelOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  // Working mode (docs/working-mode.md): while a task runs the panel drops into the step strip; the user's own opening
  // or closing of the panel wins until the task ends; a dialog opens it; the end opens it or shows the answer card.
  const [work, setWork] = useState<WorkingView>(idleView);
  const workRef = useRef(work);
  const [answerCard, setAnswerCard] = useState('');
  // The options (cards) of that answer, shown in the answer card under its text.
  const [answerOptions, setAnswerOptions] = useState<ChatItem | null>(null);
  // A short question the task ended with, asked in a bubble over the page (WORK-17), and its conversation.
  const [pageQuestion, setPageQuestion] = useState<{ chat: Conversation; item: ChatItem } | null>(null);
  const applyWork = useCallback((event: WorkingEvent) => {
    const next = workingStep(workRef.current, event);
    workRef.current = next;
    setWork(next);
    if (next.panel !== panelOpenRef.current) {
      panelOpenRef.current = next.panel;
      setPanelOpen(next.panel);
    }
  }, []);
  const screenReader = useScreenReader();
  const insets = useSafeAreaInsets();
  const screenReaderRef = useRef(screenReader);
  screenReaderRef.current = screenReader;
  // Text selected on a page; like find in page, it only counts for the page it came from.
  const [selection, setSelection] = useState<{ tabId: string; url: string; text: string } | null>(null);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  // Read when a task ends, which can be long after the render that started it.
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;
  // The panel opened or closed by the user (the Qutai button, the strip, the backdrop…): their choice for this task.
  useEffect(() => {
    if (panelOpen !== workRef.current.panel) applyWork({ type: panelOpen ? 'userOpen' : 'userClose' });
  }, [panelOpen, applyWork]);
  // The action marker shows only on the page on screen with nothing over it, and only with its setting on.
  // Set each render further down, where the screens over the page are known.
  const coveredRef = useRef(false);
  useEffect(() => {
    setMarkerEnvironment({
      enabled: () => settingsRef.current.showActionMarker,
      visible: (target) => browserInstance.activeId === target.id && !coveredRef.current,
    });
    return () => setMarkerEnvironment(null);
  }, [browserInstance]);
  // A dialog waits for the user's answer: the strip expands into the panel, and drops back once answered.
  const waitingForUser = useWaitingForUser();
  useEffect(() => {
    applyWork({ type: 'asking', on: waitingForUser });
  }, [waitingForUser, applyWork]);
  /** A task ended in a conversation the user has not seen since: the Qutai button shows a dot until they do. */
  const unseenChat = browser.conversations.find((x) => x.unseen);
  // Showing a conversation is seeing it.
  useEffect(() => {
    if (panelOpen && conversation.unseen) conversation.setUnseen(null);
  }, [panelOpen, conversation, conversation.unseen]);

  const [settings, setSettings] = useState<Settings>(initialSettings);
  // Option cards' pictures follow "Block ads and trackers" (src/chat/cardImages.ts).
  useEffect(() => setCardImageBlocking(settings.blockAds), [settings.blockAds]);
  // The latest settings for code that runs later than a render (the assistant's settings tool).
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Kept scripts (docs/page-customisation.md › Kept scripts): what decides whether they run, read at each page load.
  useEffect(() => {
    void loadScriptKey();
    keptScripts.configure({
      enabled: () => settingsRef.current.assistantScripts,
      levelFor: (site) => sitePermissions.levelFor(site),
      siteSetting: (site) => settingsRef.current.scriptSites.find((s) => s.host === site)?.setting ?? 'default',
      scripts: () => siteRules.scripts,
      key: scriptKey,
      recordRun: (id, run) => void siteRules.updateScript(id, { lastRun: run }).catch(() => {}),
    });
    return () => keptScripts.configure(null);
  }, []);
  useSyncExternalStore(keptScripts.subscribe, keptScripts.getVersion);
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
  // The user's own site rules: hiding rules go to the tabs, blocked domains to the network blocker.
  useSyncExternalStore(siteRules.subscribe, siteRules.getVersion);
  useEffect(() => {
    void siteRules.load();
  }, []);
  useEffect(() => {
    contentBlocking.setUserDomains(siteRules.domains).catch(() => {});
  }, [siteRules.domains]);
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
  /** The full screen open over the browser, one at a time (src/components/AppScreens.tsx, UI-31). */
  const [screen, setScreen] = useState<OpenScreen | null>(null);
  const openScreen = useCallback((next: OpenScreen) => setScreen(next), []);
  /** Closes that screen if it is still the one open: a late close never shuts a screen opened since. */
  const closeScreen = useCallback((kind: ScreenKind) => setScreen((open) => (open?.kind === kind ? null : open)), []);
  const settingsVisible = screen?.kind === 'settings';
  const tabsVisible = screen?.kind === 'tabs';
  const tasksScreen = screenOf(screen, 'tasks');
  /** The page Settings opens on next (reset to the main page when it closes). */
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('main');
  const settingsVisibleRef = useRef(false);
  settingsVisibleRef.current = settingsVisible;
  const openSettings = (page: SettingsPage = 'main') => {
    setSettingsPage(page);
    openScreen({ kind: 'settings' });
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
    if (action === 'buyCredits') openBuyCredits();
    else promptQutaiSignIn();
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
  // Qutai Credits (pro mode): the balance shown under the panel's title while it is the provider in use; the server's
  // configuration and the balance are read once at start (nothing at all without pro mode).
  const creditsState = useCreditsState();
  useEffect(() => {
    refreshCredits();
  }, []);
  // The low-credit hint (Qutai Credits only): once when the balance drops below a few steps' worth on the panel
  // server's default tier (the one every request uses, CRED-39), again only after it has risen above that
  // (credits/lowBalance.ts).
  const panelChoice = conversation.model && isConfigured(settings, conversation.model.provider) ? conversation.model : null;
  const panelOnCredits = (panelChoice?.provider ?? settings.provider) === 'qutai';
  const panelTier = panelOnCredits && usesTiers(creditsState.config) ? defaultTier(creditsState.config) : null;
  const lowThreshold = lowBalanceThreshold(creditsState.config, panelTier);
  const [lowBalance, setLowBalance] = useState(LOW_BALANCE_START);
  useEffect(() => {
    setLowBalance((state) => nextLowBalance(state, creditsState.balance, lowThreshold));
  }, [creditsState.balance, lowThreshold]);
  // A purchase the server hadn't credited yet (app closed, connection lost) is reported again at start and after
  // signing in; and losing the account while Qutai Credits is in use is said once, with the ways on.
  const accountState = useAccountState();
  const accountStatusRef = useRef(accountState.status);
  useEffect(() => {
    const previous = accountStatusRef.current;
    accountStatusRef.current = accountState.status;
    if (accountState.status === 'signedIn') void reportPendingPurchases();
    const providers = [settingsRef.current.provider, browser.conversationOf(browser.active).model?.provider].filter(
      (p): p is ProviderId => !!p,
    );
    // In Settings the account page itself says so (and shows the sign-in buttons).
    if (lostQutaiAccount(previous, accountState.status, providers) && !settingsVisibleRef.current) promptQutaiSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountState.status]);
  // Server backup's daily run: on opening, foreground, sign-in and unlock only (docs/server-backup.md).
  useServerBackupLifecycle({ incognito: tab.incognito, locked: lock !== null, signedIn: accountState.status === 'signedIn' });
  /** The conversation whose model is being chosen (the sheet under the panel's title). */
  const [modelSheetFor, setModelSheetFor] = useState<Conversation | null>(null);
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
  const [textSizeVisible, setTextSizeVisible] = useState(false);
  const [readerSettingsVisible, setReaderSettingsVisible] = useState(false);
  const [permissionHost, setPermissionHost] = useState<string | null>(null);
  /** The list of every site with its own permission (page menu, or "All sites" in a site's sheet). */
  // The Cookies view of a tab (from the page menu, the site's sheet or the assistant's card).
  // "Styles off for this page" and the tried style are per tab, in memory (pageStyleState).
  useSyncExternalStore(pageStyleState.subscribe, pageStyleState.getVersion);
  // The permission sheet stays open while the location setting changes, so it must see the update.
  useSyncExternalStore(sitePermissions.subscribe, getSitePermissionsVersion);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [context, setContext] = useState<{ tab: Tab; target: ContextTarget } | null>(null);
  /** A long-pressed link in the assistant's chat. */
  const [chatLink, setChatLink] = useState<ContextTarget | null>(null);
  // Find in page belongs to one page: it closes by itself when the tab or the URL changes, or when
  // reader mode is turned on or off (it searches the text on screen).
  const [findFor, setFindFor] = useState<{ tabId: string; url: string; reader: boolean } | null>(null);
  const toast = useToast();
  // "No Turkish voice is installed…" when something is read aloud in a language the phone has no voice for.
  const showToast = toast.show;
  useEffect(() => setSpeechNotice(showToast), [showToast]);
  // Storage failures that may have lost something the user did or saved are told once (storage/failures.ts).
  useEffect(() => {
    setStorageNotice(showToast);
    return () => setStorageNotice(null);
  }, [showToast]);
  // Downloads: notices from the request flow (a finished download shows in the download pill, with Open), the
  // notifications' "open Downloads" and "open this file" (Android: a finished file no app opened directly; Qutai
  // says why), and incognito entries leave the list with the session.
  useEffect(() => {
    downloadRequests.notify = toast.show;
    const openFile = (id: string) => {
      const item = downloads.get(id);
      if (item) void openDownload(downloads, item, toast.show);
      else openScreen({ kind: 'downloads' });
    };
    const offOpen = nativeDownloads?.addListener('onOpenRequested', () => openScreen({ kind: 'downloads' }));
    const offOpenFile = nativeDownloads?.addListener('onOpenFileRequested', ({ id }) => openFile(id));
    if (nativeDownloads?.consumeOpenRequest()) openScreen({ kind: 'downloads' });
    const fileRequest = nativeDownloads?.consumeOpenFileRequest?.();
    // At a cold start the list is read first.
    if (fileRequest) downloads.load().then(() => openFile(fileRequest), () => {});
    const offIncognito = browserInstance.onIncognitoEnd(() => {
      downloads.forgetIncognito();
      siteZoom.clearIncognito();
    });
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
    void withDb('logs.prune', async (db) => {
      await pruneActions(db);
      await pruneSent(db);
    });
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
  // Each conversation has its own timer and is written one write at a time (src/storage/chatSaver.ts, TABS-29).
  const [chatSaver] = useState(() => new ChatSaver((chat) => withDb('chat.save', (db) => storeChat(db, chat), 'user')));
  const persistDraftSoon = (chat: Conversation) => chatSaver.soon(chat);
  const persistConversation = (chat: Conversation) => {
    void chatSaver.now(chat);
  };
  // Switching to another conversation writes the typing left in this one at once.
  useEffect(
    () => () => {
      void chatSaver.flush(conversation);
    },
    [conversation, chatSaver],
  );

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
        // A link opened from another app: its first load's redirects to Google Play or another app count as the
        // user's tap (DL-18).
        noteOpenedFromApp(browser.openTab(entry.url));
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
        openScreen({ kind: 'scanner' });
        return;
      case 'task':
        openRemindedTask(entry.id);
        return;
      case 'notification':
        // A task's notification opens its conversation, when its tab is still there.
        if (returnToNotificationTab(entry.from) && entry.assistant) setPanelOpen(true);
        return;
      case 'appFile':
        // An app file opened from outside: the import screen, over a normal tab (never from incognito), nothing else.
        toNormalTab();
        setPanelOpen(false);
        closeScreen('myApps');
        appImporter.open({ uri: entry.uri });
        return;
    }
  };
  /**
   * A tap on a notification the assistant scheduled: the tab it was asked from; if that tab is closed, the first tab of
   * its group; else the first normal tab (a new one if there is none). Says so in a toast when it isn't the same tab.
   * An incognito tab is found only while this incognito session lasts; it is never reopened.
   */
  const returnToNotificationTab = (from: NotificationOrigin): boolean => {
    const firstNormal = () => {
      const normal = browser.tabsOf(false);
      if (normal.length) browser.switchTab(normal[0].id);
      else browser.openTab();
    };
    if ('incognito' in from) {
      const id = incognitoOriginTab(from.incognito);
      if (id && browser.getTab(id)) {
        browser.switchTab(id);
        return true;
      }
      firstNormal();
      toast.show(t('notifications.incognitoGone'));
      return false;
    }
    const tab = browser.tabs.find((x) => !x.incognito && x.uid === from.tab);
    if (tab) {
      browser.switchTab(tab.id);
      return true;
    }
    const inGroup = from.group ? browser.tabs.find((x) => !x.incognito && x.groupId === from.group) : undefined;
    if (inGroup) {
      browser.switchTab(inGroup.id);
      toast.show(t('notifications.tabGoneGroup'));
      // The group's conversation is the one the task ran in.
      return true;
    }
    firstNormal();
    toast.show(t('notifications.tabGone'));
    return false;
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
        void withDb(
          'chat.move',
          async (db) => {
            await storeChat(db, chat, fromKey);
            await moveSentConversation(db, fromKey, chat.key);
          },
          'user',
        );
      }),
    [browserInstance],
  );
  // The task lifecycle (src/task/sendTask.ts): one run slot for the app's life; this screen hands each send over with
  // what is React (its state setters, its toasts) and reads nothing from the render the send came from.
  const [taskRunner] = useState(() => new TaskRunner());
  // Leaving the foreground (the system may end Qutai there without warning): typing waiting on a timer and the
  // running task's conversation are written now, like the open tabs (usePersistSession).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void saveOnLeaving(chatSaver, taskRunner.tasks);
    });
    return () => sub.remove();
  }, [chatSaver, taskRunner]);
  const taskHost = (): TaskHost => ({
    browser: browserInstance,
    runner: taskRunner,
    runAgent,
    settings: () => settingsRef.current,
    changeSettings,
    sitePermissions,
    memory: memoryStore,
    downloads: downloadRequests,
    history: historySearch,
    log: logAction,
    bookmarksRemoved: offerBookmarkUndo,
    savedTaskUsed: refreshRecentTasks,
    showSettings: (page) => openSettings(page),
    save: persistConversation,
    aiConsent: { ensure: ensureAiConsent },
    credits: {
      ready: creditsReady,
      signedIn: () => accountSession()?.getState().status === 'signedIn',
      askDisclosure: askCreditsDisclosure,
      promptSignIn: promptQutaiSignIn,
      config: () => creditsStore.config(),
      refresh: refreshCredits,
    },
    preparedSent: (chat) => setPrepared((p) => (p?.chat === chat ? null : p)),
    busy: () => toast.show(t('chat.busyElsewhere')),
    ui: {
      start: (panelClosed) => {
        // Every start but a voice one comes from the panel (or opens it): it drops into the step strip; a screen
        // reader keeps the panel the user is in.
        setAnswerCard('');
        setAnswerOptions(null);
        setPageQuestion(null);
        applyWork({ type: 'start', panelOpen: !panelClosed, collapse: !screenReaderRef.current });
      },
      end: (view) => {
        setAnswerCard(view.answerText);
        setAnswerOptions(view.cards);
        // The question it ends with, when it fits a bubble over the page (chat/questionBubble.ts).
        const asked = view.question;
        const questionFits = !!asked && questionFitsBubble(asked.text, asked.options ?? [], PixelRatio.getFontScale());
        setPageQuestion(asked && questionFits ? { chat: view.chat, item: asked } : null);
        applyWork({
          type: 'end',
          outcome: view.outcome,
          hasAnswer: !!view.answerText || !!view.cards,
          questionFits,
          sameConversation:
            AppState.currentState === 'active' && browserInstance.conversationOf(browserInstance.active) === view.chat,
        });
      },
    },
    background: { begin: beginBackgroundTask, end: endBackgroundTask, notifies: backgroundRunNotifies },
    notices: {
      notifyWhenDone: () => notifyTaskDoneRef.current,
      takeBackPaused: takeBackPausedNotice,
      notice: (chat, event, backgroundRunNotified) => void noticeTask(chat, event, backgroundRunNotified),
      ended: taskEnded,
      taskTab: (id) => {
        lastTaskTab.current = id;
      },
    },
    clearMark,
  });
  /** Sends a message: the whole task runs in src/task/sendTask.ts. */
  const send = (text: string, options: SendOptions = {}) => sendTask(taskHost(), text, options);

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
      closeScreen('downloads');
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
      const size = `${made.info.width}×${made.info.height}`;
      const filters = describeFilters(made.info.filters);
      toast.show(
        filters
          ? t('resize.addedWith', { size, bytes: formatSize(made.info.size), filters })
          : t('resize.added', { size, bytes: formatSize(made.info.size) }),
      );
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
  /** "Task finished" notification (agent/taskNotice.ts decides; nothing without the permission, never asked here). */
  const noticeTask = (
    chat: Conversation,
    event: TaskNoticeEvent,
    backgroundRunNotified: boolean,
    delaySeconds = 0,
  ): Promise<string | null> | null => {
    const kind = taskNoticeFor({
      event,
      foreground: AppState.currentState === 'active',
      incognito: chat.incognito || chat.privacy.touchedIncognito,
      backgroundRunNotifies: backgroundRunNotified,
      notifyWhenDone: notifyTaskDoneRef.current,
    });
    const tab = browserInstance.tabs.find((x) => browserInstance.conversationOf(x) === chat);
    if (!kind || !tab || tab.incognito) return null;
    return postTaskNotice(t(`taskDone.${kind}`), notificationOrigin(tab), delaySeconds);
  };
  const noticeTaskRef = useRef(noticeTask);
  noticeTaskRef.current = noticeTask;
  // A confirmation waits while the user is away (not with "Keep working in the background", which says so itself).
  useEffect(
    () =>
      onApprovalWaitingInBackground(() => {
        const chat = runningRef.current.chat;
        if (chat) void noticeTaskRef.current(chat, 'needsApproval', false);
      }),
    [],
  );

  // A task that cannot go on while Qutai is away (iPhone; Android without "Keep working in the background") pauses
  // when the user leaves. A notice scheduled with the system says it waits for them (iOS suspends Qutai within
  // seconds, so a timer in JavaScript would not fire); coming back before it shows, or the task ending, takes it back.
  // Not when a confirmation is open (that has its own notice) or the background run speaks for the task.
  const pausedNotice = useRef<Promise<string | null> | null>(null);
  const takeBackPausedNotice = useCallback(() => {
    const pending = pausedNotice.current;
    pausedNotice.current = null;
    void pending?.then((id) => {
      if (id) void cancelTaskNotice(id);
    });
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') return takeBackPausedNotice();
      if (state !== 'background' || pausedNotice.current) return;
      const chat = runningRef.current.chat;
      if (!chat || isWaitingForApproval()) return;
      pausedNotice.current = noticeTaskRef.current(chat, 'paused', backgroundRunNotifies(), PAUSED_NOTICE_DELAY_S);
    });
    return () => sub.remove();
  }, [takeBackPausedNotice]);

  const taskEnded = (chat: Conversation, kind: 'done' | 'failed' | 'needsAnswer') => {
    const onScreen = AppState.currentState === 'active';
    const felt = () => signal(kind === 'done' ? 'done' : kind === 'failed' ? 'failure' : 'attention');
    if (
      onScreen &&
      (panelOpenRef.current || workRef.current.answer) &&
      browserInstance.conversationOf(browserInstance.active) === chat
    ) {
      felt();
      return;
    }
    chat.setUnseen(kind);
    if (!onScreen) return;
    felt();
    toast.show(t(kind === 'done' ? 'taskDone.done' : kind === 'failed' ? 'taskDone.failed' : 'taskDone.needsAnswer'), {
      label: t('chat.showTab'),
      onPress: () => showConversation(chat),
    });
  };

  // Saved tasks: the screen (from the panel or Settings), and the three run last as chips in the empty panel.
  const [recentTasks, setRecentTasks] = useState<SavedTask[]>([]);
  const refreshRecentTasks = useCallback(() => {
    void withDb('savedTasks.recent', recentSavedTasks).then((list) => list && setRecentTasks(list));
  }, []);
  useEffect(() => {
    if (panelOpen && !tasksScreen) refreshRecentTasks();
  }, [panelOpen, tasksScreen, refreshRecentTasks]);

  /**
   * Runs a saved task: the user's own text and their tap, so it is sent. With a page to open first, it opens in a new
   * tab and the task starts once the page has loaded (or after 15 s); otherwise it goes in the current conversation.
   */
  const runSavedTask = async (task: SavedTask) => {
    closeScreen('tasks');
    if (running) return toast.show(t('chat.busyElsewhere'));
    void withDb('savedTasks.used', (db) => markSavedTaskUsed(db, task.id)).then(refreshRecentTasks);
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
      // Reminders not set again would silently not ring: the user is told.
      void withDb('savedTasks.reminders', async (db) => syncTaskReminders(await listSavedTasks(db)), 'user');
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
    void withDb('savedTasks.used', (db) => markSavedTaskUsed(db, task.id)).then(refreshRecentTasks);
    send(text, { noPage: task.target === 'none' });
  };

  const newChat = () => {
    const chat = conversation;
    chat.clear();
    // Its attached files go once the cleared conversation is saved.
    void withDb('chat.clear', (db) => storeChat(db, chat)).then(pruneAttachmentFiles);
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
      toast.show(actionErrorText(e));
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
  // A blank new tab coming to the front (⋮ › New tab, the tab switcher's or the strip's +, ⌘T, closing the last tab)
  // opens with the cursor in the address bar, ready to type (UI-83). Not at launch, and not behind the incognito lock.
  const lastActiveId = useRef(tab.id);
  useEffect(() => {
    if (lastActiveId.current === tab.id) return;
    lastActiveId.current = tab.id;
    if (!tab.isNewTab) return;
    if (tab.incognito && settings.incognitoLock && !incognitoUnlocked) return;
    setAddressEdit({ id: Date.now(), text: '' });
  }, [tab.id, tab.isNewTab, tab.incognito, settings.incognitoLock, incognitoUnlocked]);
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
  // The site ⌘+ / ⌘− / ⌘0 and a Mac's menu Zoom act on (UI-84): none on the new tab page or in reader mode.
  const zoomSite = onNewTab || tab.reader ? null : currentSite;
  const zoomLevel = useSiteZoomLevel(zoomSite, tab.incognito);
  const iconRow: IconItem[] = [
    {
      icon: 'forward',
      label: t('menu.forward'),
      disabled: !tab.canGoForward,
      onPress: () => tab.historyForward(),
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
    // Stop while a navigation waits for the site or loads, reload otherwise (like Chrome).
    tab.busy
      ? { icon: 'close', label: t('menu.stop'), onPress: () => tab.stop() }
      : { icon: 'reload', label: t('menu.reload'), disabled: onNewTab, onPress: () => tab.reload() },
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
    // No "Copy link" here: the share sheet has it (UI-51).
    {
      icon: 'find',
      label: t('menu.find'),
      disabled: onNewTab,
      onPress: () => setFindFor({ tabId: tab.id, url: tab.url, reader: !!tab.reader }),
    },
    // A broken style must never trap the user: whenever a user style applies here (kept or tried), it can be
    // switched off for this tab, and on again (docs/page-customisation.md).
    // The same for kept scripts; switching them off (or on) reloads the page, so nothing a script did stays.
    ...(!onNewTab && (keptScripts.off(tab.id) || keptScripts.applyTo(tab).length > 0)
      ? [
          {
            icon: 'script' as const,
            label: t(keptScripts.off(tab.id) ? 'menu.scriptsOn' : 'menu.scriptsOff'),
            onPress: () => {
              const off = !keptScripts.off(tab.id);
              keptScripts.setOff(tab.id, off);
              tab.reload();
              toast.show(t(off ? 'menu.scriptsOffDone' : 'menu.scriptsOnDone'));
            },
          },
        ]
      : []),
    ...(!onNewTab && (pageStyleState.off(tab.id) || stylesApply(tab))
      ? [
          {
            icon: 'palette' as const,
            label: t(pageStyleState.off(tab.id) ? 'menu.stylesOn' : 'menu.stylesOff'),
            onPress: () => {
              const off = !pageStyleState.off(tab.id);
              pageStyleState.setOff(tab.id, off);
              toast.show(t(off ? 'menu.stylesOffDone' : 'menu.stylesOnDone'));
            },
          },
        ]
      : []),
    {
      icon: 'desktop',
      label: t('menu.desktopSite'),
      checked: tab.desktop,
      disabled: onNewTab,
      onPress: () => tab.toggleDesktop(),
    },
    {
      // The cookies that apply to this page, from the tab's own store (values hidden until revealed).
      icon: 'cookies',
      label: t('menu.cookies'),
      disabled: onNewTab || !currentSite,
      onPress: () => openScreen({ kind: 'cookies', tab: tab }),
    },
    // Ad blocking for this site straight from the menu (BLK-33): a site that won't open with it gets a way out in
    // one tap; the page reloads so the change applies.
    ...(settings.blockAds && currentSite && !onNewTab
      ? [
          {
            icon: 'shield' as const,
            label: t('menu.blockAdsHere'),
            checked: sitePermissions.blockingFor(currentSite),
            onPress: () => {
              sitePermissions
                .setBlocking(currentSite, !sitePermissions.blockingFor(currentSite))
                .then(() => tab.reload())
                .catch(() => {});
            },
          },
        ]
      : []),
    // "Read page aloud" is no longer offered here (UI-51); while something is being read, it can still be stopped.
    ...(speaking ? [{ icon: 'stopReading' as const, label: t('menu.stopReading'), onPress: () => runAction(stopSpeaking) }] : []),
    // Less frequent things live one level down, so the menu fits without scrolling.
    {
      icon: 'library',
      label: t('menu.library'),
      section: true,
      onPress: () => {},
      submenu: [
        { icon: 'bookmarks', label: t('menu.bookmarks'), onPress: () => openScreen({ kind: 'library', tab: 'bookmarks' }) },
        { icon: 'history', label: t('menu.history'), onPress: () => openScreen({ kind: 'library', tab: 'history' }) },
        { icon: 'savedPages', label: t('menu.offlinePages'), onPress: () => openScreen({ kind: 'offline' }) },
        { icon: 'downloads', label: t('menu.downloads'), onPress: () => openScreen({ kind: 'downloads' }) },
        { icon: 'apps', label: t('menu.myApps'), onPress: () => openScreen({ kind: 'myApps' }) },
      ],
    },
    {
      icon: 'moreHorizontal',
      label: t('menu.more'),
      onPress: () => {},
      submenu: [
        {
          icon: 'reader',
          label: t(tab.reader || tab.readerAvailable || onNewTab ? 'menu.reader' : 'menu.readerNone'),
          checked: !!tab.reader,
          // Under More (UI-51); offered only when the page looks like an article; the full check runs when it opens.
          disabled: onNewTab || (!tab.reader && !tab.readerAvailable),
          onPress: toggleReader,
        },
        // Android: a launcher shortcut for this page, under More (UI-51) (iOS gives apps no way to add one; Safari's is its own).
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
          icon: 'qrCode',
          label: t('menu.qrCode'),
          disabled: onNewTab,
          onPress: () => setQrUrl(tab.url),
        },
        {
          icon: 'scanQr',
          label: t('menu.scanQr'),
          onPress: () => openScreen({ kind: 'scanner' }),
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
          // Only the full-page screenshot here; the visible part alone is left to the phone's own screenshot (UI-51).
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
        // A Mac: "Zoom" for this site (UI-84) in place of the text size; nothing to zoom without a site.
        ...(MAC_ZOOM_MENU
          ? zoomSite
            ? [{ icon: 'textSize' as const, section: true, label: t('menu.zoom'), onPress: () => setTextSizeVisible(true) }]
            : []
          : [
              {
                icon: 'textSize' as const,
                section: true,
                label: t('menu.textSize'),
                onPress: () => setTextSizeVisible(true),
              },
            ]),
        {
          // This site's sheet (with a link to every site); without a site (new tab, Qutai's own pages), the list.
          icon: 'shield',
          label: currentSite
            ? t('menu.sitePermission', { level: t(`site.level.${sitePermissions.levelFor(currentSite)}`) })
            : t('site.listTitle'),
          onPress: () => (currentSite ? setPermissionHost(currentSite) : openScreen({ kind: 'sites' })),
        },
      ],
    },
    // Qutai's own settings, last in the menu (UI-51).
    { icon: 'settings', label: t('settings.title'), section: true, onPress: () => openSettings() },
  ];

  /**
   * Opens a link from the assistant's chat in the tab group of the conversation's tab (forming one when that tab has
   * none), like the tabs the assistant opens during a task; incognito stays incognito (src/browser/chatLinks.ts).
   */
  const openChatLink = (
    url: string,
    opts: { sourceIncognito?: boolean; openTabs?: readonly Tab[]; background?: boolean } = {},
  ) => {
    const owner = browser.active;
    const plan = chatLinkPlan({ url, owner, conversationIncognito: browser.conversationOf(owner).incognito, ...opts });
    if (plan.kind === 'switch') return browser.switchTab(plan.tabId);
    browser.openTab(plan.url, {
      incognito: plan.incognito,
      activate: plan.activate,
      ...(plan.openerId ? { openerId: plan.openerId } : {}),
      group: plan.group,
    });
    if (!plan.activate) toast.show(t('contextMenu.openedInBackground'));
  };

  /** The long-press menu of a link in the chat: the same group rule as a tap. */
  const chatLinkActions = (href: string): ContextAction[] => {
    const incognito = browser.active.incognito || browser.conversationOf(browser.active).incognito;
    return [
      {
        icon: incognito ? 'incognito' : 'newTab',
        label: t(incognito ? 'contextMenu.openInNewIncognito' : 'contextMenu.openInNewTab'),
        onPress: () => openChatLink(href, { background: true }),
      },
      ...(incognito
        ? []
        : [
            {
              icon: 'incognito' as const,
              label: t('contextMenu.openInIncognito'),
              onPress: () => openChatLink(href, { sourceIncognito: true }),
            },
          ]),
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
    ];
  };

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
    // No "Translate" chip (UI-65): the user asks for a translation in their own words.
    onNewTab || siteLevel === 'blocked' ? [] : (['summarize', 'keyPoints', 'review'] as const);
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
      // Site icons on the new tab page (UI-72); clearing history removes those of sites with no visit left.
      clearSiteIcons();
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
        void withDb('bookmarks.undo', (db) => restoreBookmarks(db, removed), 'user').then(notifyBookmarksChanged);
      },
    });
  };

  /**
   * Settings apply as they are changed (the screen stays open). Every change is a patch on the settings as they are
   * now (settingsRef), never on a copy from an earlier render, so a change made meanwhile (the assistant's settings
   * tool, a switch flipped while a dialog awaited Face ID) is kept (DATA-28). Writes go one after another, each with
   * the latest settings, so an older write never lands last.
   */
  const [settingsWriter] = useState(
    () =>
      new SettingsWriter(
        () => settingsRef.current,
        (next) => {
          settingsRef.current = next;
          setSettings(next);
        },
        saveSettings,
        (e) => dialog.alert(t('settings.saveFailed'), e instanceof Error ? e.message : String(e)),
      ),
  );
  const changeSettings = (patch: SettingsPatch): Promise<void> => settingsWriter.change(patch);

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
    onOnlineChange: (voiceOnline) => changeSettings({ voiceOnline }),
    onStarted: (lang) => {
      const active = browserInstance.active;
      const chat = browserInstance.conversationOf(active);
      rememberVoiceLanguage(lang, active.incognito || chat.incognito || chat.privacy.touchedIncognito);
    },
  });

  /** The language voice input last listened in: a fallback for conversations that say nothing yet. Not incognito. */
  const rememberVoiceLanguage = (lang: string, incognito: boolean) => {
    if (incognito || settingsRef.current.voiceLastLanguage === lang) return;
    void changeSettings({ voiceLastLanguage: lang });
  };

  // The active tab's navigation: the progress line, the address (Chrome's rule while a page-started one waits) and the
  // status line ("opening…", "isn't answering yet", "very slow", offline). docs/design/14-tabs-and-conversations.md.
  const pendingNav = tab.nav.pending;
  const lastNavEnd = tab.nav.lastEnd;
  const progressLine: ProgressLineState = pendingNav
    ? {
        key: `${tab.id}:${pendingNav.id}`,
        active: true,
        startedAt: pendingNav.startedAt,
        responded: pendingNav.responded,
        progress: pendingNav.progress,
        endedAs: null,
        host: hostOf(pendingNav.url),
      }
    : {
        key: `${tab.id}:${lastNavEnd?.id ?? 0}`,
        active: false,
        startedAt: 0,
        responded: true,
        progress: 1,
        endedAs: lastNavEnd?.reason ?? null,
        host: null,
      };
  const address = tab.address;
  const navStatus =
    pendingNav && !pendingNav.responded && !onNewTab ? (
      <NavigationStatus
        navKey={`${tab.id}:${pendingNav.id}`}
        opening={pendingNav.origin === 'page' ? address.opening : hostOf(pendingNav.url)}
        slowness={slowness(pendingNav, Date.now(), online)}
        offline={!online}
        dark={tab.incognito || darkMode}
        onStop={() => tab.stop()}
        onRetry={() => tab.retryNavigation()}
      />
    ) : null;

  // The address bar (or the find bar in its place), at the top or the bottom of the screen.
  const topBar = findOpen ? (
    <FindBar tab={tab} darkMode={darkMode} onClose={() => setFindFor(null)} />
  ) : (
    <AddressBar
      url={onNewTab ? '' : address.url}
      editRequest={addressEdit}
      onEditRequestApplied={clearAddressEdit}
      searchEngine={settings.searchEngine}
      searchSuggestions={settings.searchSuggestions}
      onAsk={(text) => {
        setPanelOpen(true);
        send(text);
      }}
      progress={progressLine}
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
      onBack={() => (tab.canGoBack ? tab.historyBack() : tab.showNewTab())}
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
        openScreen({ kind: 'tabs' });
      }}
      onToggleAssistant={() => setPanelOpen((v) => !v)}
    />
  );
  // Qutai Credits: the balance under the panel's title, always in full (the model's name gives way to it).
  const panelBalance =
    (conversation.model && isConfigured(settings, conversation.model.provider)
      ? conversation.model.provider
      : settings.provider) === 'qutai' && creditsState.balance !== null
      ? creditsLabel(creditsState.balance)
      : null;
  const barAtBottom = settings.addressBarPosition === 'bottom';
  // The bottom address bar's height, so a toast stays above it (UI-48).
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  // The desktop-style tab strip above the address bar (top or bottom) on a Mac or an iPad in a wide window; never on a
  // phone (UI-74).
  const windowSize = useWindowDimensions();
  const stripShown = showTabStrip(windowSize, stripDevice, settings.tabStrip);
  const [stripHeight, setStripHeight] = useState(0);
  const closeStripTab = (closing: typeof tab) => {
    bump();
    // Only normal web pages are remembered, so only those can be undone (as in the tab switcher).
    if (browser.closeTab(closing.id)) {
      toast.show(t('tabs.closed'), { label: t('tabs.undo'), onPress: () => browser.reopenClosed(0) });
    }
  };
  // Keyboard shortcuts on a Mac or an iPad with a hardware keyboard (UI-76): not while the app lock or a full screen
  // (Settings, the tab switcher, the Library…) is in front; with the assistant panel open they act on the page behind.
  const openTabFromKeyboard = (incognito: boolean) => {
    browser.openTab(undefined, { incognito });
    setPanelOpen(false);
    setFindFor(null);
    // Not behind the incognito lock: the keyboard would come up over the lock screen.
    if (!incognito || !settings.incognitoLock || incognitoUnlocked) setAddressEdit({ id: Date.now(), text: '' });
  };
  // ⌥Space, the keyboard's Qutai button (UI-81): only where holding the button would listen (the button shown,
  // "Hold to talk" on, the panel closed, no lock or full screen); voice consent, the microphone permission, incognito
  // and a running task are handled by the push-to-talk itself, as for the button.
  const voiceKey = useRef<VoiceKeyState>(VOICE_KEY_IDLE);
  const voicePress = useRef(0);
  const onVoiceKey = (event: VoiceKeyEvent, press = voicePress.current) => {
    const canStart = !lock && !screen && !panelOpen && settings.showAssistantButton && settings.voiceHoldToTalk;
    if (event === 'down') {
      if (voiceKey.current.kind !== 'idle') return;
      if (!canStart) return;
      press = ++voicePress.current;
    }
    // The hold time passed but something came in front meanwhile: this press does nothing.
    if (event === 'timer' && !canStart && voiceKey.current.kind === 'armed') {
      voiceKey.current = VOICE_KEY_IDLE;
      return;
    }
    const step = voiceKeyStep(voiceKey.current, event, press);
    voiceKey.current = step.state;
    switch (step.action) {
      case 'arm':
        // Only a real hold reaches the microphone: quick presses never start (or stop) the audio.
        setTimeout(() => onVoiceKeyRef.current('timer', press), VOICE_MIN_HOLD_MS);
        return;
      case 'start': {
        const measured = measureAssistantButton((anchor) => {
          // Let go while the button was being found: nothing starts.
          if (voiceKey.current !== step.state) return;
          ptt.handlers.pressIn();
          ptt.handlers.start(anchor);
        });
        // The button isn't on screen: no session, so the release does nothing either.
        if (!measured) voiceKey.current = VOICE_KEY_IDLE;
        return;
      }
      case 'release':
        return ptt.handlers.release();
      case 'cancel':
        return ptt.handlers.cancel();
    }
  };
  // The timer calls the latest version (it sees the current settings and screens).
  const onVoiceKeyRef = useRef(onVoiceKey);
  useEffect(() => {
    onVoiceKeyRef.current = onVoiceKey;
  });
  // Qutai leaving the front ends a held ⌥Space like losing the window.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') onVoiceKeyRef.current('blur');
    });
    return () => sub.remove();
  }, []);
  useKeyShortcuts((id: ShortcutEvent) => {
    if (id === 'voiceDown') return onVoiceKey('down');
    if (id === 'voiceUp') return onVoiceKey('up');
    if (id === 'voiceCancel') return onVoiceKey('blur');
    if (lock || screen) return;
    switch (id) {
      case 'newTab':
        return openTabFromKeyboard(tab.incognito);
      case 'newIncognitoTab':
        return openTabFromKeyboard(true);
      case 'closeTab':
        return closeStripTab(tab);
      case 'reopenTab':
        return void browser.reopenClosed(0);
      case 'reload':
        if (!onNewTab) tab.reload();
        return;
      case 'focusAddress':
        setFindFor(null);
        return setAddressEdit({ id: Date.now(), text: onNewTab ? '' : tab.address.url });
      case 'find':
        if (!onNewTab) setFindFor({ tabId: tab.id, url: tab.url, reader: !!tab.reader });
        return;
      case 'back':
        if (tab.canGoBack) tab.historyBack();
        else if (tab.openedFromNewTab) tab.showNewTab();
        return;
      case 'forward':
        if (tab.canGoForward) tab.historyForward();
        return;
      case 'zoomIn':
      case 'zoomOut':
      case 'actualSize': {
        // The page zoom for the tab's site (UI-84), remembered per site like Safari; shown in a toast as Safari shows it.
        const site = zoomSite;
        if (!site) return;
        const level =
          id === 'actualSize'
            ? (siteZoom.set(site, tab.incognito, DEFAULT_ZOOM_LEVEL), DEFAULT_ZOOM_LEVEL)
            : siteZoom.step(site, tab.incognito, id === 'zoomIn' ? 'in' : 'out');
        return showToast(t('shortcuts.zoomLevel', { percent: level }));
      }
      default: {
        const target = shortcutTab(
          id,
          browser.tabsOf(tab.incognito).map((x) => x.id),
          browser.activeId,
        );
        if (target) browser.switchTab(target);
      }
    }
  });
  coveredRef.current = panelOpen || settingsVisible || tabsVisible || screen?.kind === 'library' || tasksScreen !== null;
  // The step strip's line: the running conversation's latest step line, in the user's language.
  const stripSource = runningChat ? currentStripLine(runningChat.items.slice(-12)) : 'thinking';
  const stripLine =
    stripSource === 'thinking'
      ? t('background.thinking')
      : stripSource === 'answering'
        ? t('working.answering')
        : stripSource.text;
  // Above the home indicator and, when it is at the bottom, the address bar.
  const stripBottom = insets.bottom + (barAtBottom ? 60 + (stripShown ? stripHeight : 0) : 0) + 12;

  // The chat panel's functions keep their identity from one render to the next, so the memoised panel redraws only
  // when something it shows changes, not each time the app redraws for the page (UI-29).
  const panelHandlers = useStableHandlers<PanelHandlers>({
    onRunTask: (task) => runSavedTask(task),
    onOpenTasks: () => openScreen({ kind: 'tasks', draft: null }),
    onSaveAsTask: (prompt) =>
      openScreen({
        kind: 'tasks',
        draft: {
          ...emptyTask(),
          prompt,
          target: tab.isNewTab ? 'none' : 'page',
          incognito: conversation.incognito || conversation.privacy.touchedIncognito,
        },
      }),
    onRunPrepared: runPrepared,
    onAttach: () => setAttachSheet(true),
    onRemovePending: removePending,
    onOpenAttachment: setPreviewAttachment,
    onShare: (offer) => runShare(offer, conversation),
    onImage: (action, info) =>
      runAction(async () => {
        if (action === 'share') return void (await shareAttachment(info));
        if (info.kind === 'pdf') {
          if (await saveAttachmentToFolder(info)) return t('chat.fileSaved', { name: info.name });
          return;
        }
        await saveAttachmentToPhotos(info);
        return t('contextMenu.imageSaved');
      }),
    onDraftChange: (text) => {
      conversation.setDraft(text);
      persistDraftSoon(conversation);
    },
    onResearchChange: (on) => conversation.setResearch(on),
    onModelPress: () => setModelSheetFor(conversation),
    onShowRunningTab: () => runningTab && browser.switchTab(runningTab.id),
    onShowFinished: () => unseenChat && showConversation(unseenChat),
    onClose: closePanel,
    onSend: send,
    onStop: () => conversation.stop(),
    onChoose: (itemId, option) => {
      tick();
      conversation.choose(itemId, option);
      send(option);
    },
    onNewChat: newChat,
    onOpenSettings: () => openScreen({ kind: 'settings' }),
    onItemAction: onItemAction,
    onShowSent: () => openScreen({ kind: 'sent', key: conversation.key }),
    onOpenSource: (source) => {
      // A page that is still open is shown in its tab; otherwise it opens in the conversation's group.
      openChatLink(source.url, { sourceIncognito: source.incognito, openTabs: browser.tabs });
      closePanel();
    },
    onOpenLink: (url) => {
      openChatLink(url);
      closePanel();
    },
    onLinkMenu: (url, text) => setChatLink({ href: url, linkText: text, src: '', alt: '' }),
    onCall: (number) => {
      bump();
      placeCall(number, () => toast.show(t('common.copied')));
    },
    onCard: (item, action) => {
      bump();
      if (action === 'keepScript') {
        const script = item.script;
        if (!script) return;
        return void keepScript(script).then((kept) => {
          if (kept) conversation.update(item.id, { script: { ...script, state: 'kept' } });
        });
      }
      if (action === 'openApp' || action === 'undoApp') {
        const app = item.app;
        if (!app) return;
        if (action === 'openApp') return appRunner.open(app.appId);
        return void appStore
          .load(app.appId)
          .then(async (current) => {
            if (!current) return toast.show(t('apps.missing'));
            if (current.version !== app.version) return toast.show(t('apps.undoStale'));
            const version = await appStore.undo(app.appId);
            if (version === null) return toast.show(t('apps.undoNone'));
            appsChanged.emit();
            conversation.update(item.id, { app: { appId: app.appId, name: app.name, change: 'undone', version } });
            toast.show(t('apps.cardUndone', { name: app.name, version }));
          })
          .catch(() => {});
      }
      if (action === 'showCookies') {
        const target = item.cookiesOffer ? browser.getTab(item.cookiesOffer.tabId) : undefined;
        if (!target || target.isNewTab) return toast.show(t('cookies.tabGone'));
        return openScreen({ kind: 'cookies', tab: target });
      }
      const offer = item.style;
      if (!offer || offer.state !== 'applied') return;
      if (action === 'undoStyle') {
        undoOffer(offer, browser);
        return conversation.update(item.id, { style: { ...offer, state: 'undone' } });
      }
      void keepStyle(offer, browser).then((kept) => {
        if (kept) conversation.update(item.id, { style: { ...offer, state: 'kept' } });
      });
    },
    onSms: (offer) => {
      bump();
      openSmsComposer(offer, () => toast.show(t('common.copied')));
    },
    onWhatsApp: (offer) => {
      bump();
      openWhatsApp(offer, () => toast.show(t('common.copied')));
    },
    onFile: (action, file) =>
      runAction(async () => {
        try {
          if (action === 'share') return void (await shareComposedFile(file.id));
          if (await saveComposedFileToFolder(file.id)) return t('chat.fileSaved', { name: file.name });
        } catch (e) {
          if (e instanceof FileExpiredError) return t('chat.fileExpired');
          throw e;
        }
      }),
    onMessageAction: (action, text) =>
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
        // The words without the Markdown marks; the voice follows the answer's language, not the app's.
        await speak(speechText(text));
      }),
  });
  const voiceIncognito = tab.incognito || conversation.incognito || conversation.privacy.touchedIncognito;
  const voiceHandlers = useStableHandlers<VoiceHandlers>({
    onOnlineChange: (voiceOnline) => changeSettings({ voiceOnline }),
    notify: toast.show,
    languages: () => listeningOrder(conversation, settingsRef.current),
    onPick: (language) => {
      conversation.setVoiceLanguage(language);
      persistConversation(conversation);
    },
    onStarted: (lang) => rememberVoiceLanguage(lang, voiceIncognito),
  });
  const voiceAutoLabel =
    settings.voiceLanguage === AUTO_LANGUAGE
      ? t('voice.auto')
      : t('voice.defaultLanguage', { language: languageName(settings.voiceLanguage) });
  const voiceAutoHint =
    settings.voiceLanguage === AUTO_LANGUAGE
      ? t('voice.autoNow', { language: languageName(automaticLanguage(conversation, settings)) })
      : undefined;
  const panelVoice = useMemo<VoiceProps>(
    () => ({
      ...voiceHandlers,
      incognito: voiceIncognito,
      online: settings.voiceOnline,
      autoSend: settings.voiceAutoSend,
      picked: conversation.voiceLanguage,
      autoLabel: voiceAutoLabel,
      autoHint: voiceAutoHint,
    }),
    [voiceHandlers, voiceIncognito, settings.voiceOnline, settings.voiceAutoSend, conversation.voiceLanguage, voiceAutoLabel, voiceAutoHint],
  );
  const lowCreditsHandlers = useStableHandlers({
    onBuy: () => {
      setLowBalance(dismissLowBalance);
      openBuyCredits();
    },
    onDismiss: () => setLowBalance(dismissLowBalance),
  });
  const showLowCredits = lowBalance.visible && panelOnCredits;
  const panelLowCredits = useMemo(() => (showLowCredits ? lowCreditsHandlers : null), [showLowCredits, lowCreditsHandlers]);

  // The page and its selection bar, under (or above) the address bar (BarLayout; the bar always stays, UI-36).
  const pageContent = (
    <>
            <ErrorBoundary>
              <BrowserView
                browser={browser}
                newTabActions={{
                  darkMode,
                  blockAds: settings.blockAds,
                  blockingOffSites: sitePermissions.blockingOffSites(),
                  contentRuleLists: contentBlocking.ruleLists,
                  siteRules: siteRules.page,
                  userBlockedHosts: siteRules.domains,
                  userStyles: siteRules.pageStyles,
                  // Kept scripts: the page says when it is ready; browser/keptScripts.ts decides what runs.
                  keptScripts: settings.assistantScripts && siteRules.scripts.some((s) => s.enabled),
                  httpsOnly: settings.httpsOnly,
                  blockThirdPartyCookies: settings.blockThirdPartyCookies,
                  devTools: settings.devTools,
                  hideCookieBanners: settings.hideCookieBanners,
                  blockVideoAds: settings.blockVideoAds,
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
                  autoplaySound: settings.autoplaySound,
                  onNotice: toast.show,
                  onOpenedInBackground: (opened) =>
                    toast.show(t('nav.openedBehind'), {
                      label: t('nav.showTab'),
                      onPress: () => {
                        if (browserInstance.getTab(opened.id)) browserInstance.switchTab(opened.id);
                      },
                    }),
                  searchEngine: settings.searchEngine,
                  onAsk: (text) => {
                    setPanelOpen(true);
                    if (text) send(text);
                    else setFocusRequest((n) => n + 1);
                  },
                  onAskForApp: () => askAbout(t('apps.emptyPrompt')),
                  onOpenLibrary: (which: LibraryTab) => openScreen({ kind: 'library', tab: which }),
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
                bottomOffset={barAtBottom ? 52 + (stripShown ? stripHeight : 0) : 0}
              />
            ) : null}
    </>
  );
  // The slow-site line floats over the page next to the bar instead of taking room, so the page never moves (UI-68).
  const barArea = topBar;
  const tabStrip = stripShown ? (
    <TabStrip
      browser={browser}
      width={windowSize.width - insets.left - insets.right}
      darkMode={darkMode}
      onCloseTab={closeStripTab}
      onNewTab={(incognito) => browser.openTab(undefined, { incognito })}
      onHeight={setStripHeight}
    />
  ) : null;
  const barStatus = findOpen ? null : navStatus;

  // Product analytics (pro builds, SRV-31): never from an incognito tab; the one-time consent question once nothing else
  // is in front (setup, the lock, Settings, a running task) and the current tab isn't incognito.
  useEffect(() => setIncognitoProbe(() => browserInstance.active.incognito), [browserInstance]);
  const consentReady = !lock && !settingsVisible && !introPending && !running && !tab.incognito;
  useEffect(() => {
    if (consentReady) void askAnalyticsConsentOnce(() => browserInstance.active.incognito);
  }, [consentReady, browserInstance]);
  // Pro mode: the system's rating sheet on the 3rd and the 30th day of use (UI-41), at the same calm moments, a little
  // after the app comes to the front so it never lands on top of the first screen.
  useEffect(() => {
    if (!consentReady) return;
    let timer = setTimeout(() => void maybeAskForReview(), 2500);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      clearTimeout(timer);
      timer = setTimeout(() => void maybeAskForReview(), 2500);
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [consentReady]);

  return (
    <>
      <View style={[styles.container, (tab.incognito || darkMode) && styles.incognito]}>
        {/* The tab switcher sets its own while it is open (TabSwitcher.tsx). */}
        <StatusBar style={tab.incognito || darkMode ? 'light' : 'dark'} />
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
          {/* Expo apps on Android are edge-to-edge, so the window no longer resizes for the keyboard: the page, and the address bar when it is at the bottom, stay above it. */}
          {barAtBottom ? (
            <KeyboardAvoidingContainer style={styles.flex}>
              <BarLayout
                position="bottom"
                bar={
                  // Both at the bottom: the strip right above the bar, in the bar's own box so the toast, the slow-site
                  // line and the address suggestions keep clear of both (UI-74).
                  tabStrip ? (
                    <>
                      {tabStrip}
                      {barArea}
                    </>
                  ) : (
                    barArea
                  )
                }
                status={barStatus}
                onBarHeight={setBottomBarHeight}
              >
                <View style={styles.flex}>{pageContent}</View>
              </BarLayout>
            </KeyboardAvoidingContainer>
          ) : (
            <>
              {tabStrip}
              <BarLayout position="top" bar={barArea} status={barStatus}>
                <KeyboardAvoidingContainer style={styles.flex}>{pageContent}</KeyboardAvoidingContainer>
              </BarLayout>
            </>
          )}
        </SafeAreaView>
        {/* Where the assistant acts: over the page, under the panel (docs/working-mode.md). */}
        <ActionMarkerLayer />

        <ErrorBoundary full>
          <AssistantPanel
            dark={darkMode}
            hasPage={!tab.isNewTab}
            suggestions={suggestions}
            open={panelOpen}
            recentTasks={recentTasks}
            preparedTask={
              prepared && prepared.chat === conversation && conversation.draft.trim() ? prepared.task.name : null
            }
            pending={conversation.pending}
            quickActions={quickActions}
            conversation={conversation}
            focusRequest={focusRequest}
            research={conversation.research}
            modelInfo={conversationModelInfo(settings, conversation.model, panelBalance !== null)}
            modelName={panelBalance === null ? conversationModelInfo(settings, conversation.model, true, true) : undefined}
            balance={panelBalance}
            modelChosen={!!conversation.model && isConfigured(settings, conversation.model.provider)}
            running={conversation.running}
            busyElsewhere={running && !conversation.running}
            collapseToStrip={work.phase !== 'idle'}
            finishedElsewhere={unseenChat && unseenChat !== conversation ? unseenChat.unseen : null}
            showCost={settings.showCost}
            voice={panelVoice}
            lowCredits={panelLowCredits}
            {...panelHandlers}
          />
        </ErrorBoundary>
        {/* Over the page and the panel, under the strip; takes no touches. */}
        <WorkingGlow visible={running} />
        {stripVisible(work) && runningChat ? (
          <StepStrip
            line={stripLine}
            elsewhere={!!browser.agentTabId && browser.agentTabId !== browser.activeId}
            bottom={stripBottom}
            onOpen={() => {
              tick();
              // The panel shows the running conversation's steps.
              if (runningTab && browser.conversationOf(browser.active) !== runningChat) browser.switchTab(runningTab.id);
              setPanelOpen(true);
            }}
            onStop={() => {
              signal('stopped');
              runningChat.stop();
            }}
            onShowTab={() => {
              tick();
              if (browser.agentTabId) browser.switchTab(browser.agentTabId);
            }}
          />
        ) : null}
        {work.question && pageQuestion && !panelOpen && !running ? (
          <QuestionCard
            question={plainAnswer(pageQuestion.item.text)}
            options={pageQuestion.item.options ?? []}
            bottom={stripBottom}
            onChoose={(option) => {
              tick();
              const { chat, item } = pageQuestion;
              applyWork({ type: 'dismissQuestion' });
              setPageQuestion(null);
              chat.choose(item.id, option);
              void send(option, { closed: true });
            }}
            onOpen={() => {
              applyWork({ type: 'dismissQuestion' });
              setPanelOpen(true);
            }}
            onClose={() => applyWork({ type: 'dismissQuestion' })}
          />
        ) : null}
        {work.answer && (answerCard || answerOptions) && !panelOpen ? (
          <AnswerCard
            text={answerCard}
            options={answerOptions}
            onOpenOption={(card) => {
              applyWork({ type: 'dismissAnswer' });
              openChatLink(card.url);
            }}
            onOptionMenu={(card) => {
              bump();
              setChatLink({ href: card.url, linkText: card.title, src: '', alt: '' });
            }}
            bottom={stripBottom}
            onOpen={() => {
              applyWork({ type: 'dismissAnswer' });
              setPanelOpen(true);
            }}
            onClose={() => applyWork({ type: 'dismissAnswer' })}
          />
        ) : null}
        <PageMenu
          visible={menuVisible}
          iconRow={iconRow}
          items={menuItems}
          incognito={tab.incognito}
          darkMode={darkMode}
          anchor={barAtBottom ? 'bottom' : 'top'}
          stripOffset={stripShown ? stripHeight : 0}
          onClose={() => setMenuVisible(false)}
        />
        <AppScreens
          screen={screen}
          close={closeScreen}
          darkMode={darkMode}
          browser={browser}
          tab={tab}
          settings={settings}
          settingsPage={settingsPage}
          onSettingsClosed={() => setSettingsPage('main')}
          changeSettings={changeSettings}
          clearData={clearData}
          runSavedTask={runSavedTask}
          viaQutai={(conversation.model?.provider ?? settings.provider) === 'qutai'}
          onCompareTabs={(picked) => {
            setPanelOpen(true);
            const list = picked.map((x) => `- tab ${x.id}: ${x.title || x.url} (${x.url})`).join('\n');
            send(t('tabs.comparePrompt', { tabs: list }));
          }}
          onAskForApp={() => askAbout(t('apps.emptyPrompt'))}
          onImportApp={() => {
            // Never from an incognito context; My apps closes first (iOS shows one sheet at a time).
            toNormalTab();
            setTimeout(() => void pickAndImportApp(), 450);
          }}
          notify={toast.show}
          downloads={downloads}
          sitePermissions={sitePermissions}
          onAskDownload={askAboutDownload}
          onShowAssistantIntro={() => {
            setAssistantIntroSeen(false).catch(() => {});
            setIntroPending(true);
            // The tour waits while Settings or the assistant panel is in front, so both close for it to show (UI-61).
            closeScreen('settings');
            setPanelOpen(false);
          }}
        />
        <ScriptSandboxHost />
        <AppRunnerHost
          onEdit={(app) => askAbout(t('apps.editPrompt', { name: app.name, id: app.id }))}
          // Not sent at once: the report goes into the message box, so the user sees exactly what the AI would get and
          // sends it (or edits it) themselves (decided 19 Nov 2026, APPS-23).
          onFix={(app, errors) => askAbout(t('apps.fixPrompt', { name: app.name, id: app.id, version: app.version, errors }))}
          onNotice={toast.show}
        />
        <AppImportHost onNotice={toast.show} />
        <ServerRestoreOffer ready={!lock && !settingsVisible && !introPending && !running} appLock={settings.appLock} />
        <ContextMenuSheet
          target={context?.target ?? null}
          actions={context ? contextActions(context.tab, context.target) : []}
          onClose={() => setContext(null)}
        />
        <ContextMenuSheet
          target={chatLink}
          actions={chatLink ? chatLinkActions(chatLink.href) : []}
          onClose={() => setChatLink(null)}
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
          posting={!!permissionHost && sitePermissions.postingFor(permissionHost)}
          onForgetPosting={() => permissionHost && sitePermissions.setPosting(permissionHost, false).catch(() => {})}
          scripts={!!permissionHost && sitePermissions.scriptsFor(permissionHost)}
          onForgetScripts={() => permissionHost && sitePermissions.setScripts(permissionHost, false).catch(() => {})}
          // The page on screen is capturing on this site: offer to stop it right here.
          capturing={!!permissionHost && siteKey(tab.url) === permissionHost && tab.media.capturing}
          onStopCapture={() => tab.media.stop()}
          blocking={permissionHost ? sitePermissions.blockingFor(permissionHost) : true}
          onSetBlocking={(on) => permissionHost && sitePermissions.setBlocking(permissionHost, on).catch(() => {})}
          blockingEnabled={settings.blockAds}
          ownRules={permissionHost ? siteRules.forSite(permissionHost).length : 0}
          // The count belongs to the page on screen (Android); WebKit doesn't report one (iOS).
          blockedCount={
            !!permissionHost && siteKey(tab.url) === permissionHost && contentBlocking.active
              ? Platform.OS === 'ios'
                ? 'unavailable'
                : tab.blockedCount
              : undefined
          }
          onReload={!!permissionHost && siteKey(tab.url) === permissionHost ? () => tab.reload() : undefined}
          onShowCookies={
            !!permissionHost && siteKey(tab.url) === permissionHost && !tab.isNewTab
              ? () => {
                  setPermissionHost(null);
                  openScreen({ kind: 'cookies', tab: tab });
                }
              : undefined
          }
          onShowAll={() => {
            setPermissionHost(null);
            openScreen({ kind: 'sites' });
          }}
          onClose={() => setPermissionHost(null)}
        />
        {MAC_ZOOM_MENU ? (
          <PageZoomSheet
            visible={textSizeVisible && !!zoomSite}
            level={zoomLevel}
            onChange={(level) => siteZoom.set(zoomSite, tab.incognito, level)}
            onClose={() => setTextSizeVisible(false)}
          />
        ) : (
          <TextSizeSheet
            visible={textSizeVisible}
            zoom={settings.textZoom}
            onChange={(textZoom) => changeSettings({ textZoom })}
            onClose={() => setTextSizeVisible(false)}
          />
        )}
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
            openScreen({ kind: 'settings' });
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
          onChange={(value) => changeSettings(value)}
          onClose={() => setReaderSettingsVisible(false)}
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
        <DownloadIndicator
          store={downloads}
          // Above the address bar at the bottom while it shows, measured rather than guessed (UI-48).
          bottomOffset={(barAtBottom ? bottomBarHeight : 0) + 16}
          onOpen={() => openScreen({ kind: 'downloads' })}
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
        <ActionSheet
          // Hidden while the app lock shows (it reappears after unlocking).
          title={incoming && !appLocked ? t('incoming.title', { text: incoming.text.replace(/\s+/g, ' ').slice(0, 120) }) : null}
          actions={incoming ? incomingActions(incoming) : []}
          dark={darkMode}
          onClose={() => setIncoming(null)}
        />
        <LockScreen locked={lock} onUnlock={unlock} onLeave={leaveIncognito} />
        <CaptureOverlay bottomInset={barAtBottom ? bottomBarHeight : 0} dark={tab.incognito} />
        <PdfReaderHost />
        <PushToTalkBubble
          bubble={ptt.bubble}
          barAtBottom={barAtBottom}
          dark={tab.incognito}
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
        <Toast
          key={toast.key}
          message={toast.message}
          action={toast.action}
          onHidden={toast.hide}
          // Above the address bar at the bottom while it shows (it slides away while a page scrolls, UI-36).
          bottomInset={barAtBottom && !tabsVisible ? bottomBarHeight : 0}
          dark={tab.incognito}
        />
        <DialogHost root />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f4ef' },
  incognito: { backgroundColor: '#24232b' },
  flex: { flex: 1 },
});
