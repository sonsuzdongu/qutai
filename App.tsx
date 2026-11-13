import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { runAgent } from './src/agent/runAgent';
import { getProvider, modelLabel } from './src/ai/providers';
import type { Turn } from './src/ai/types';
import { Browser, useBrowser } from './src/browser/Browser';
import { useHardwareBack } from './src/browser/useHardwareBack';
import { AddressBar } from './src/components/AddressBar';
import { BrowserView } from './src/components/BrowserView';
import { AssistantPanel, ChatItem } from './src/components/AssistantPanel';
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
import { getDb } from './src/storage/db';
import { loadSession, Session } from './src/storage/session';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from './src/storage/settings';
import { usePersistSession } from './src/storage/usePersistSession';

const KEEP_AWAKE_TAG = 'alpai-agent';

let itemCounter = 0;
const newItem = (kind: ChatItem['kind'], text: string): ChatItem => ({ id: String(++itemCounter), kind, text });

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
  const [restored, setRestored] = useState<{ session: Session | null } | null>(null);

  useEffect(() => {
    getDb()
      .then(loadSession)
      .catch(() => null)
      .then((session) => setRestored({ session }));
  }, []);

  // Reading the saved session takes a few milliseconds; tabs are created only after it.
  if (!restored) return <View style={styles.container} />;
  return <BrowserApp initialSession={restored.session} />;
}

function BrowserApp({ initialSession }: { initialSession: Session | null }) {
  const [browserInstance] = useState(() => new Browser(initialSession));
  const browser = useBrowser(browserInstance);
  const tab = browser.active;
  useHardwareBack(browser);
  usePersistSession(browser);

  const turnsRef = useRef<Turn[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const [items, setItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tabsVisible, setTabsVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
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
    const pageInfo = `\n\n[Current tab ${current.id}: ${current.title || '(no title)'} — ${current.url}. Open tabs: ${browser.tabs.length}]`;
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

  const stop = () => abortRef.current?.abort();

  const newChat = () => {
    turnsRef.current = [];
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

  const menuItems: MenuItem[] = [
    { icon: '↻', label: t('menu.reload'), onPress: () => tab.webview?.reload() },
    {
      icon: '⤴',
      label: t('menu.shareLink'),
      section: true,
      onPress: () => runAction(() => shareLink(tab)),
    },
    {
      icon: '⧉',
      label: t('menu.copyLink'),
      onPress: () =>
        runAction(async () => {
          await copyLink(tab);
          return t('menu.linkCopied');
        }),
    },
    {
      icon: '📄',
      label: t('menu.savePdf'),
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
          onPress: () =>
            runAction(async () => {
              await speakPage(tab);
            }),
        },
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
            url={tab.url}
            loading={tab.loading}
            canGoBack={tab.canGoBack}
            tabCount={browser.tabs.length}
            assistantOpen={panelOpen}
            assistantRunning={running}
            onSubmit={(url) => tab.loadUrl(url)}
            onBack={() => tab.webview?.goBack()}
            onOpenMenu={() => setMenuVisible(true)}
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
            <BrowserView browser={browser} />
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
