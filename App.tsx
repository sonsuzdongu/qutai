import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { runAgent } from './src/agent/runAgent';
import { getProvider, modelLabel } from './src/ai/providers';
import type { Turn } from './src/ai/types';
import { Browser, ClosedTab, useBrowser } from './src/browser/Browser';
import { useHardwareBack } from './src/browser/useHardwareBack';
import { AddressBar } from './src/components/AddressBar';
import { BrowserView } from './src/components/BrowserView';
import { AssistantPanel, ChatItem } from './src/components/AssistantPanel';
import { LibraryScreen, LibraryTab } from './src/components/LibraryScreen';
import { MenuItem, PageMenu } from './src/components/PageMenu';
import { SettingsModal } from './src/components/SettingsModal';
import { TabSwitcher } from './src/components/TabSwitcher';
import { Toast, useToast } from './src/components/Toast';
import { copyLink, copyText, shareLink, shareText } from './src/device/link';
import { savePagePdf } from './src/device/pdf';
import { saveScreenshot } from './src/device/screenshot';
import { speak, speakPage, stopSpeaking, useIsSpeaking } from './src/device/speech';
import { useIncognitoProtection } from './src/device/useIncognitoProtection';
import { t, useLanguage } from './src/i18n';
import { addBookmark, isBookmarked, removeBookmark } from './src/storage/bookmarks';
import { getDb } from './src/storage/db';
import { clearChat, loadChat, SavedChat, saveChat } from './src/storage/chat';
import { loadRecentlyClosed, loadSession, Session } from './src/storage/session';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from './src/storage/settings';
import { usePersistSession } from './src/storage/usePersistSession';
import { useRecordHistory } from './src/storage/useRecordHistory';

const KEEP_AWAKE_TAG = 'alpai-agent';

let itemCounter = 0;
const newItem = (kind: ChatItem['kind'], text: string): ChatItem => ({ id: String(++itemCounter), kind, text });

/** Restored messages keep their ids, so new ones must continue after the highest. */
function continueItemIds(items: ChatItem[]) {
  itemCounter = Math.max(itemCounter, ...items.map((item) => Number(item.id) || 0));
}

function askConfirmation(description: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      t('confirm.title'),
      description,
      [
        { text: t('confirm.deny'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('confirm.allow'), onPress: () => resolve(true) },
      ],
      // Android: back button or a tap outside counts as declining.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export default function App() {
  // Re-renders the whole tree in the new language when the device language changes.
  useLanguage();
  const [restored, setRestored] = useState<{
    session: Session | null;
    recentlyClosed: ClosedTab[];
    chat: SavedChat | null;
  } | null>(null);

  useEffect(() => {
    getDb()
      .then((db) => Promise.all([loadSession(db), loadRecentlyClosed(db), loadChat(db)]))
      .catch((): [null, ClosedTab[], null] => [null, [], null])
      .then(([session, recentlyClosed, chat]) => setRestored({ session, recentlyClosed, chat }));
  }, []);

  // Reading the saved session takes a few milliseconds; tabs are created only after it.
  if (!restored) return <View style={styles.container} />;
  return (
    <BrowserApp
      initialSession={restored.session}
      recentlyClosed={restored.recentlyClosed}
      initialChat={restored.chat}
    />
  );
}

function BrowserApp({
  initialSession,
  recentlyClosed,
  initialChat,
}: {
  initialSession: Session | null;
  recentlyClosed: ClosedTab[];
  initialChat: SavedChat | null;
}) {
  const [browserInstance] = useState(() => new Browser(initialSession, recentlyClosed));
  const browser = useBrowser(browserInstance);
  const tab = browser.active;
  useHardwareBack(browser);
  usePersistSession(browser);
  useRecordHistory(browser);

  const turnsRef = useRef<Turn[]>(initialChat?.turns ?? []);
  // A conversation that touched an incognito tab is never written to disk.
  const privacyRef = useRef({ touchedIncognito: false });
  const abortRef = useRef<AbortController | null>(null);

  const [items, setItems] = useState<ChatItem[]>(() => {
    const restoredItems = initialChat?.items ?? [];
    continueItemIds(restoredItems);
    return restoredItems;
  });
  const [running, setRunning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tabsVisible, setTabsVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [library, setLibrary] = useState<LibraryTab | null>(null);
  const toast = useToast();
  const speaking = useIsSpeaking();
  useIncognitoProtection(tab.incognito || (tabsVisible && browser.tabsOf(true).length > 0));

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  const addItem = (item: ChatItem) => setItems((prev) => [...prev, item]);

  const send = async (text: string) => {
    // Marked before anything is shown, so a message typed in an incognito tab is never saved.
    if (browser.active.incognito) privacyRef.current.touchedIncognito = true;
    addItem(newItem('user', text));

    const provider = settings.provider;
    const apiKey = settings.apiKeys[provider];
    if (!apiKey) {
      addItem(newItem('error', t('chat.missingKey', { provider: getProvider(provider).label })));
      setSettingsVisible(true);
      return;
    }

    // The agent starts in the tab the user is looking at when they send the task.
    const current = browser.active;
    const agentTab = { id: current.id };
    const where = current.isNewTab
      ? 'new tab page, no web page loaded'
      : `${current.title || '(no title)'} — ${current.url}`;
    const pageInfo = `\n\n[Current tab ${current.id}: ${where}. Open tabs: ${browser.tabs.length}]`;
    turnsRef.current.push({ role: 'user', text: text + pageInfo });

    const abort = new AbortController();
    abortRef.current = abort;
    setRunning(true);
    // If the screen turned off mid-task, the OS would freeze the app and the task would stall.
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    try {
      await runAgent({
        provider,
        apiKey,
        model: settings.models[provider],
        turns: turnsRef.current,
        browser,
        agentTab,
        privacy: privacyRef.current,
        confirm: settings.confirmActions ? askConfirmation : undefined,
        signal: abort.signal,
        onEvent: (event) => {
          const kind = event.type === 'text' ? 'assistant' : event.type;
          addItem(newItem(kind, event.text));
        },
      });
      if (abort.signal.aborted) addItem(newItem('info', t('chat.stopped')));
    } catch (e) {
      if (abort.signal.aborted) addItem(newItem('info', t('chat.stopped')));
      else addItem(newItem('error', e instanceof Error ? e.message : String(e)));
    } finally {
      abortRef.current = null;
      setRunning(false);
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    }
  };

  // Saves the conversation whenever it settles; private (incognito) conversations are removed instead.
  useEffect(() => {
    if (running) return;
    const timer = setTimeout(() => {
      getDb()
        .then((db) =>
          privacyRef.current.touchedIncognito ? clearChat(db) : saveChat(db, { items, turns: turnsRef.current }),
        )
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [items, running]);

  const stop = () => abortRef.current?.abort();

  const newChat = () => {
    turnsRef.current = [];
    privacyRef.current = { touchedIncognito: false };
    setItems([]);
  };

  /** Runs a menu action and reports the outcome in a toast instead of failing silently. */
  const runAction = async (action: () => Promise<string | void>) => {
    try {
      const message = await action();
      if (message) toast.show(message);
    } catch (e) {
      toast.show(t('common.error', { message: e instanceof Error ? e.message : String(e) }));
    }
  };

  // Page actions make no sense on the app's own new tab page.
  const onNewTab = tab.isNewTab;
  const menuItems: MenuItem[] = [
    { icon: '↻', label: t('menu.reload'), disabled: onNewTab, onPress: () => tab.webview?.reload() },
    {
      icon: bookmarked ? '★' : '☆',
      label: t(bookmarked ? 'menu.removeBookmark' : 'menu.addBookmark'),
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
    {
      icon: '⤴',
      label: t('menu.shareLink'),
      disabled: onNewTab,
      section: true,
      onPress: () => runAction(() => shareLink(tab)),
    },
    {
      icon: '⧉',
      label: t('menu.copyLink'),
      disabled: onNewTab,
      onPress: () =>
        runAction(async () => {
          await copyLink(tab);
          return t('menu.linkCopied');
        }),
    },
    {
      icon: '📄',
      label: t('menu.savePdf'),
      disabled: onNewTab,
      section: true,
      onPress: () =>
        runAction(async () => {
          toast.show(t('menu.pdfPreparing'));
          const pdf = await savePagePdf(tab);
          if (pdf.imagesMissing > 0) return t('menu.pdfImagesMissing', { count: pdf.imagesMissing });
        }),
    },
    {
      icon: '📸',
      label: t('menu.saveScreenshot'),
      disabled: onNewTab,
      onPress: () =>
        runAction(async () => {
          await saveScreenshot(tab);
          return t('menu.screenshotSaved');
        }),
    },
    speaking
      ? { icon: '⏹', label: t('menu.stopReading'), onPress: () => runAction(stopSpeaking) }
      : {
          icon: '🔊',
          label: t('menu.readAloud'),
          disabled: onNewTab,
          onPress: () =>
            runAction(async () => {
              await speakPage(tab);
            }),
        },
    { icon: '🔖', label: t('menu.bookmarks'), section: true, onPress: () => setLibrary('bookmarks') },
    { icon: '🕘', label: t('menu.history'), onPress: () => setLibrary('history') },
    { icon: '＋', label: t('menu.newTab'), section: true, onPress: () => browser.openTab() },
    { icon: '🕶', label: t('menu.newIncognitoTab'), onPress: () => browser.openTab(undefined, { incognito: true }) },
  ];

  const onSaveSettings = async (next: Settings) => {
    setSettings(next);
    setSettingsVisible(false);
    try {
      await saveSettings(next);
    } catch (e) {
      Alert.alert(t('settings.saveFailed'), e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SafeAreaProvider>
      <View style={[styles.container, tab.incognito && styles.incognito]}>
        <StatusBar style={tab.incognito || tabsVisible ? 'light' : 'dark'} />
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
          <AddressBar
            url={onNewTab ? '' : tab.url}
            loading={tab.loading}
            canGoBack={tab.canGoBack || tab.openedFromNewTab}
            tabCount={browser.tabs.length}
            assistantOpen={panelOpen}
            assistantRunning={running}
            onSubmit={(url) => tab.loadUrl(url)}
            onBack={() => (tab.canGoBack ? tab.webview?.goBack() : tab.showNewTab())}
            onOpenMenu={() => {
              // The menu shows "add" or "remove" depending on whether this page is already saved.
              getDb()
                .then((db) => isBookmarked(db, tab.url))
                .then(setBookmarked)
                .catch(() => setBookmarked(false))
                .finally(() => setMenuVisible(true));
            }}
            incognito={tab.incognito}
            onOpenTabs={async () => {
              // Thumbnails can only be taken while a tab is on screen.
              await tab.captureThumbnail();
              setTabsVisible(true);
            }}
            onToggleAssistant={() => setPanelOpen((v) => !v)}
          />
          {/* Expo apps on Android are edge-to-edge, so the window no longer resizes for the keyboard. */}
          <KeyboardAvoidingView style={styles.flex} behavior="padding">
            <BrowserView
              browser={browser}
              newTabActions={{
                onAsk: (text) => {
                  setPanelOpen(true);
                  send(text);
                },
                onOpenLibrary: setLibrary,
              }}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>

        <AssistantPanel
          open={panelOpen}
          modelInfo={`${getProvider(settings.provider).label} · ${modelLabel(settings.provider, settings.models[settings.provider])}`}
          items={items}
          running={running}
          onClose={closePanel}
          onSend={send}
          onStop={stop}
          onNewChat={newChat}
          onOpenSettings={() => setSettingsVisible(true)}
          onMessageAction={(action, text) =>
            runAction(async () => {
              if (action === 'copy') {
                await copyText(text);
                return t('common.copied');
              }
              if (action === 'share') return shareText(text);
              if (speaking) return stopSpeaking();
              await speak(text);
            })
          }
        />
        <PageMenu
          visible={menuVisible}
          items={menuItems}
          incognito={tab.incognito}
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
        <TabSwitcher visible={tabsVisible} browser={browser} onClose={() => setTabsVisible(false)} />
        <SettingsModal
          visible={settingsVisible}
          settings={settings}
          onSave={onSaveSettings}
          onClose={() => setSettingsVisible(false)}
        />
        <Toast key={toast.key} message={toast.message} onHidden={toast.hide} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f4ef' },
  incognito: { backgroundColor: '#24232b' },
  flex: { flex: 1 },
});
