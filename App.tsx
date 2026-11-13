import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { runAgent } from './src/agent/runAgent';
import { newItem, sourcesItem } from './src/chat/Conversation';
import { getProvider, modelLabel } from './src/ai/providers';
import { Browser, ClosedTab, useBrowser } from './src/browser/Browser';
import type { ContextTarget } from './src/browser/contextMenu';
import { quoteSelection } from './src/browser/selection';
import type { Tab } from './src/browser/Tab';
import { useHardwareBack } from './src/browser/useHardwareBack';
import { AddressBar } from './src/components/AddressBar';
import { BrowserView } from './src/components/BrowserView';
import { ContextAction, ContextMenuSheet } from './src/components/ContextMenuSheet';
import { AssistantPanel, QuickAction } from './src/components/AssistantPanel';
import { FindBar } from './src/components/FindBar';
import { LibraryScreen, LibraryTab } from './src/components/LibraryScreen';
import { IconItem, MenuItem, PageMenu } from './src/components/PageMenu';
import { SettingsModal } from './src/components/SettingsModal';
import { SelectionAction, SelectionBar } from './src/components/SelectionBar';
import { TabSwitcher } from './src/components/TabSwitcher';
import { TextSizeSheet } from './src/components/TextSizeSheet';
import { Toast, useToast } from './src/components/Toast';
import { copyLink, copyText, shareLink, shareText } from './src/device/link';
import { printPage, savePagePdf } from './src/device/pdf';
import { saveImage } from './src/device/saveImage';
import { saveScreenshot } from './src/device/screenshot';
import { speak, speakPage, stopSpeaking, useIsSpeaking } from './src/device/speech';
import { useIncognitoProtection } from './src/device/useIncognitoProtection';
import { t, useLanguage } from './src/i18n';
import { addBookmark, isBookmarked, removeBookmark } from './src/storage/bookmarks';
import { getDb } from './src/storage/db';
import { deviceMemoryStore } from './src/storage/memory';
import { ActionEntry, addAction, pruneActions } from './src/storage/actionLog';
import { searchHistory } from './src/storage/history';
import { composeEmail } from './src/device/email';
import { SitePermissionStore } from './src/storage/sitePermissions';
import { siteKey } from './src/agent/sitePolicy';
import { SitePermissionSheet } from './src/components/SitePermissionSheet';
import { clearChat, deleteOrphanChats, loadChat, saveChat } from './src/storage/chat';
import { loadRecentlyClosed, loadSession, Session } from './src/storage/session';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from './src/storage/settings';
import { usePersistSession } from './src/storage/usePersistSession';
import { useRecordHistory } from './src/storage/useRecordHistory';

const KEEP_AWAKE_TAG = 'kutai-agent';
const memoryStore = deviceMemoryStore(getDb);
const sitePermissions = new SitePermissionStore(getDb);

const historySearch = {
  search: async (query: string, from: number, to: number) => searchHistory(await getDb(), { query, from, to }),
};

/** Records an agent action for the activity screen. */
function logAction(entry: ActionEntry) {
  getDb()
    .then((db) => addAction(db, entry))
    .catch(() => {});
}

// Conversations saved by earlier versions belong to the tab that is active on the first start.
let legacyChatPending = true;

function askConfirmation(description: string, host: string | null): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      t('confirm.title'),
      host ? `${description}\n\n${host}` : description,
      [
        { text: t('confirm.deny'), style: 'cancel', onPress: () => resolve(false) },
        ...(host
          ? [
              {
                text: t('confirm.always', { host }),
                onPress: () => {
                  sitePermissions.set(host, 'allow').catch(() => {});
                  resolve(true);
                },
              },
            ]
          : []),
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
  const [restored, setRestored] = useState<{ session: Session | null; recentlyClosed: ClosedTab[] } | null>(null);

  useEffect(() => {
    getDb()
      .then((db) => Promise.all([loadSession(db), loadRecentlyClosed(db)]))
      .catch((): [null, ClosedTab[]] => [null, []])
      .then(([session, recentlyClosed]) => setRestored({ session, recentlyClosed }));
  }, []);

  // Reading the saved session takes a few milliseconds; tabs are created only after it.
  if (!restored) return <View style={styles.container} />;
  return <BrowserApp initialSession={restored.session} recentlyClosed={restored.recentlyClosed} />;
}

function BrowserApp({
  initialSession,
  recentlyClosed,
}: {
  initialSession: Session | null;
  recentlyClosed: ClosedTab[];
}) {
  const [browserInstance] = useState(() => new Browser(initialSession, recentlyClosed));
  const browser = useBrowser(browserInstance);
  const tab = browser.active;
  useHardwareBack(browser);
  usePersistSession(browser);
  useRecordHistory(browser);

  // Each tab has its own conversation; only one task runs at a time across all tabs.
  const conversation = tab.conversation;
  const runningTab = browser.tabs.find((x) => x.conversation.running);
  const running = runningTab !== undefined;
  const [panelOpen, setPanelOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  // Text selected on a page; like find in page, it only counts for the page it came from.
  const [selection, setSelection] = useState<{ tabId: string; url: string; text: string } | null>(null);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tabsVisible, setTabsVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [library, setLibrary] = useState<LibraryTab | null>(null);
  const [textSizeVisible, setTextSizeVisible] = useState(false);
  const [permissionHost, setPermissionHost] = useState<string | null>(null);
  const [context, setContext] = useState<{ tab: Tab; target: ContextTarget } | null>(null);
  // Find in page belongs to one page: it closes by itself when the tab or the URL changes.
  const [findFor, setFindFor] = useState<{ tabId: string; url: string } | null>(null);
  const toast = useToast();
  const speaking = useIsSpeaking();
  useIncognitoProtection(tab.incognito || (tabsVisible && browser.tabsOf(true).length > 0));

  // On low memory, everything but the tab on screen (and the agent's tab) gives up its WebView.
  useEffect(() => {
    const sub = AppState.addEventListener('memoryWarning', () => browserInstance.sleepInactive(0));
    return () => sub.remove();
  }, [browserInstance]);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  // A tab's saved conversation is read from disk the first time the tab is shown.
  useEffect(() => {
    const target = browser.active;
    if (target.conversation.loaded) return;
    const adoptLegacy = legacyChatPending;
    legacyChatPending = false;
    getDb()
      .then((db) => loadChat(db, target.uid, { adoptLegacy }))
      .catch(() => null)
      .then((saved) => target.conversation.restore(saved));
  }, [browser, tab]);

  // Once at start: load site permissions and trim the activity history.
  useEffect(() => {
    sitePermissions.load();
    getDb()
      .then((db) => pruneActions(db))
      .catch(() => {});
  }, []);

  // Once at start: forget conversations of tabs that are gone (also those that fell out of recently closed).
  useEffect(() => {
    getDb()
      .then((db) =>
        deleteOrphanChats(db, [
          ...browserInstance.tabs.map((x) => x.uid),
          ...browserInstance.recentlyClosed.flatMap((c) => (c.uid ? [c.uid] : [])),
        ]),
      )
      .catch(() => {});
  }, [browserInstance]);

  /** Writes a tab's conversation; incognito ones never touch the disk and private ones are removed. */
  const persistConversation = (owner: Tab) => {
    if (owner.incognito) return;
    const chat = owner.conversation;
    getDb()
      .then((db) =>
        chat.privacy.touchedIncognito ? clearChat(db, owner.uid) : saveChat(db, owner.uid, chat.toSaved()),
      )
      .catch(() => {});
  };

  const send = async (text: string) => {
    if (running) return;
    // The conversation belongs to the tab the user is looking at when they send the task,
    // and stays there even if the agent moves to other tabs.
    const current = browser.active;
    const chat = current.conversation;
    // Marked before anything is shown, so a message typed in an incognito tab is never saved.
    if (current.incognito) chat.privacy.touchedIncognito = true;
    chat.add(newItem('user', text));

    const provider = settings.provider;
    const apiKey = settings.apiKeys[provider];
    if (!apiKey) {
      chat.add(newItem('error', t('chat.missingKey', { provider: getProvider(provider).label })));
      persistConversation(current);
      setSettingsVisible(true);
      return;
    }

    const agentTab = { id: current.id };
    const where = current.isNewTab
      ? 'new tab page, no web page loaded'
      : `${current.title || '(no title)'} — ${current.url}`;
    const pageInfo = `\n\n[Current tab ${current.id}: ${where}. Open tabs: ${browser.tabs.length}]`;
    chat.turns.push({ role: 'user', text: text + pageInfo });

    const signal = chat.start();
    browser.setAgentTab(agentTab);
    // If the screen turned off mid-task, the OS would freeze the app and the task would stall.
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    try {
      await runAgent({
        provider,
        apiKey,
        model: settings.models[provider],
        turns: chat.turns,
        browser,
        agentTab,
        privacy: chat.privacy,
        memory: settings.memoryEnabled ? memoryStore : undefined,
        webSearch: settings.webSearch,
        stream: true,
        confirm: askConfirmation,
        confirmByDefault: settings.confirmActions,
        sites: sitePermissions,
        log: logAction,
        history: historySearch,
        composeEmail,
        signal,
        onEvent: (event) => {
          if (event.type === 'text_delta') return chat.appendStreaming(event.text);
          if (event.type === 'text') return chat.finishStreaming(event.text);
          if (event.type === 'sources') return chat.add(sourcesItem(event.sources));
          if (event.type === 'choices') return chat.add(newItem('choices', event.text, event.options));
          chat.add(newItem(event.type, event.text));
        },
      });
      if (signal.aborted) chat.add(newItem('info', t('chat.stopped')));
    } catch (e) {
      if (signal.aborted) chat.add(newItem('info', t('chat.stopped')));
      else chat.add(newItem('error', e instanceof Error ? e.message : String(e)));
    } finally {
      chat.finishStreaming();
      chat.finish();
      browser.setAgentTab(null);
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      persistConversation(current);
    }
  };

  const newChat = () => {
    conversation.clear();
    persistConversation(tab);
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
  const findOpen = findFor?.tabId === tab.id && findFor.url === tab.url;
  const currentSite = siteKey(tab.url);
  const iconRow: IconItem[] = [
    {
      icon: '→',
      label: t('menu.forward'),
      disabled: !tab.canGoForward,
      onPress: () => tab.webview?.goForward(),
    },
    {
      icon: bookmarked ? '★' : '☆',
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
      ? { icon: '✕', label: t('menu.stop'), onPress: () => tab.webview?.stopLoading() }
      : { icon: '↻', label: t('menu.reload'), disabled: onNewTab, onPress: () => tab.webview?.reload() },
  ];

  const menuItems: MenuItem[] = [
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
      icon: '🔍',
      label: t('menu.find'),
      section: true,
      disabled: onNewTab,
      onPress: () => setFindFor({ tabId: tab.id, url: tab.url }),
    },
    {
      icon: '🛡',
      label: t('menu.sitePermission', {
        level: t(`site.level.${currentSite ? sitePermissions.levelFor(currentSite) : 'default'}`),
      }),
      section: true,
      disabled: !currentSite,
      onPress: () => setPermissionHost(currentSite),
    },
    {
      icon: 'Aa',
      label: t('menu.textSize'),
      onPress: () => setTextSizeVisible(true),
    },
    {
      icon: '🖥',
      label: t('menu.desktopSite'),
      checked: tab.desktop,
      disabled: onNewTab,
      onPress: () => tab.toggleDesktop(),
    },
    {
      icon: '📄',
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
      icon: '🖨',
      label: t('menu.print'),
      disabled: onNewTab,
      onPress: () => runAction(() => printPage(tab)),
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
          icon: '🕶',
          label: t('contextMenu.openInNewIncognito'),
          onPress: () => browser.openTab(href, { incognito: true, openerId: source.id }),
        });
      } else {
        actions.push(
          { icon: '＋', label: t('contextMenu.openInNewTab'), onPress: () => openBehind(href) },
          {
            icon: '🕶',
            label: t('contextMenu.openInIncognito'),
            onPress: () => browser.openTab(href, { incognito: true }),
          },
        );
      }
      actions.push(
        {
          icon: '⧉',
          label: t('menu.copyLink'),
          onPress: () =>
            runAction(async () => {
              await copyText(href);
              return t('menu.linkCopied');
            }),
        },
        { icon: '⤴', label: t('menu.shareLink'), onPress: () => runAction(() => shareText(href)) },
        {
          icon: '✦',
          label: t('contextMenu.ask'),
          onPress: () => {
            setPanelOpen(true);
            send(t('contextMenu.askPrompt', { url: href }));
          },
        },
      );
    }
    if (target.src) {
      const src = target.src;
      actions.push({
        icon: '⬇︎',
        label: t('contextMenu.saveImage'),
        onPress: () =>
          runAction(async () => {
            await saveImage(source, src);
            return t('contextMenu.imageSaved');
          }),
      });
      if (!src.startsWith('data:')) {
        actions.push(
          { icon: '🖼', label: t('contextMenu.openImage'), onPress: () => openBehind(src) },
          {
            icon: '⧉',
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

  // One-tap tasks in the panel; page tasks need a web page, comparing needs several tabs.
  const quickActions: QuickAction[] = [
    ...(onNewTab
      ? []
      : (['summarize', 'keyPoints', 'translate', 'review'] as const).map((id) => ({
          label: t(`quick.${id}`),
          prompt: t(`quick.${id}Prompt`),
        }))),
    ...(browser.tabsOf(tab.incognito).filter((x) => !x.isNewTab).length > 1
      ? [{ label: t('quick.compare'), prompt: t('quick.comparePrompt') }]
      : []),
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
          {findOpen ? (
            <FindBar tab={tab} onClose={() => setFindFor(null)} />
          ) : (
            <AddressBar
              url={onNewTab ? '' : tab.url}
              searchEngine={settings.searchEngine}
              searchSuggestions={settings.searchSuggestions}
              onAsk={(text) => {
                setPanelOpen(true);
                send(text);
              }}
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
          )}
          {/* Expo apps on Android are edge-to-edge, so the window no longer resizes for the keyboard. */}
          <KeyboardAvoidingView style={styles.flex} behavior="padding">
            <BrowserView
              browser={browser}
              newTabActions={{
                onContextMenu: (source, target) => setContext({ tab: source, target }),
                onSelection: (source, text) =>
                  setSelection((prev) =>
                    text ? { tabId: source.id, url: source.url, text } : prev?.tabId === source.id ? null : prev,
                  ),
                textZoom: settings.textZoom,
                onNotice: toast.show,
                searchEngine: settings.searchEngine,
                onAsk: (text) => {
                  setPanelOpen(true);
                  send(text);
                },
                onOpenLibrary: setLibrary,
              }}
            />
            {selectedText ? <SelectionBar actions={selectionActions(selectedText)} dark={tab.incognito} /> : null}
          </KeyboardAvoidingView>
        </SafeAreaView>

        <AssistantPanel
          open={panelOpen}
          quickActions={quickActions}
          draft={conversation.draft}
          onDraftChange={(text) => conversation.setDraft(text)}
          focusRequest={focusRequest}
          modelInfo={`${getProvider(settings.provider).label} · ${modelLabel(settings.provider, settings.models[settings.provider])}`}
          items={conversation.items}
          running={conversation.running}
          busyElsewhere={running && !conversation.running}
          onShowRunningTab={() => runningTab && browser.switchTab(runningTab.id)}
          onClose={closePanel}
          onSend={send}
          onStop={() => conversation.stop()}
          onChoose={(itemId, option) => {
            conversation.choose(itemId, option);
            send(option);
          }}
          onNewChat={newChat}
          onOpenSettings={() => setSettingsVisible(true)}
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
          iconRow={iconRow}
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
        <TabSwitcher
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
        <SettingsModal
          sitePermissions={sitePermissions}
          visible={settingsVisible}
          settings={settings}
          onSave={onSaveSettings}
          onClose={() => setSettingsVisible(false)}
        />
        <ContextMenuSheet
          target={context?.target ?? null}
          actions={context ? contextActions(context.tab, context.target) : []}
          onClose={() => setContext(null)}
        />
        <SitePermissionSheet
          host={permissionHost}
          level={permissionHost ? sitePermissions.levelFor(permissionHost) : 'default'}
          onSelect={(level) => permissionHost && sitePermissions.set(permissionHost, level).catch(() => {})}
          onClose={() => setPermissionHost(null)}
        />
        <TextSizeSheet
          visible={textSizeVisible}
          zoom={settings.textZoom}
          onChange={(textZoom) => onSaveSettings({ ...settings, textZoom })}
          onClose={() => setTextSizeVisible(false)}
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
