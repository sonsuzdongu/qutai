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
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from './src/storage/settings';

let itemCounter = 0;
const newItem = (kind: ChatItem['kind'], text: string): ChatItem => ({ id: String(++itemCounter), kind, text });

function askConfirmation(description: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'ALPAI bu işlemi yapmak istiyor',
      description,
      [
        { text: 'Reddet', style: 'cancel', onPress: () => resolve(false) },
        { text: 'İzin ver', onPress: () => resolve(true) },
      ],
      // Android: back button or a tap outside counts as declining.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export default function App() {
  const [browserInstance] = useState(() => new Browser());
  const browser = useBrowser(browserInstance);
  const tab = browser.active;
  useHardwareBack(browser);

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
      addItem(newItem('error', `Önce ayarlardan ${getProvider(provider).label} API anahtarınızı girin.`));
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
      if (abort.signal.aborted) addItem(newItem('info', '⏹ Durduruldu'));
    } catch (e) {
      if (abort.signal.aborted) addItem(newItem('info', '⏹ Durduruldu'));
      else addItem(newItem('error', e instanceof Error ? e.message : String(e)));
    } finally {
      abortRef.current = null;
      setRunning(false);
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
      toast.show(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const menuItems: MenuItem[] = [
    { icon: '↻', label: 'Yenile', onPress: () => tab.webview?.reload() },
    {
      icon: '⤴',
      label: 'Linki paylaş',
      section: true,
      onPress: () => runAction(() => shareLink(tab)),
    },
    {
      icon: '⧉',
      label: 'Linki kopyala',
      onPress: () =>
        runAction(async () => {
          await copyLink(tab);
          return 'Link kopyalandı';
        }),
    },
    {
      icon: '📄',
      label: 'PDF olarak kaydet',
      section: true,
      onPress: () =>
        runAction(async () => {
          toast.show('PDF hazırlanıyor…');
          const pdf = await savePagePdf(tab);
          if (pdf.imagesMissing > 0) return `${pdf.imagesMissing} görsel PDF'e eklenemedi`;
        }),
    },
    {
      icon: '📸',
      label: 'Ekran görüntüsünü kaydet',
      onPress: () =>
        runAction(async () => {
          await saveScreenshot(tab);
          return "Ekran görüntüsü Fotoğraflar'a kaydedildi";
        }),
    },
    speaking
      ? { icon: '⏹', label: 'Okumayı durdur', onPress: () => runAction(stopSpeaking) }
      : {
          icon: '🔊',
          label: 'Sayfayı sesli oku',
          onPress: () =>
            runAction(async () => {
              await speakPage(tab);
            }),
        },
    { icon: '＋', label: 'Yeni sekme', section: true, onPress: () => browser.openTab() },
    { icon: '🕶', label: 'Yeni gizli sekme', onPress: () => browser.openTab(undefined, { incognito: true }) },
  ];

  const onSaveSettings = async (next: Settings) => {
    setSettings(next);
    setSettingsVisible(false);
    try {
      await saveSettings(next);
    } catch (e) {
      Alert.alert('Ayarlar kaydedilemedi', e instanceof Error ? e.message : String(e));
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
                return 'Kopyalandı';
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
