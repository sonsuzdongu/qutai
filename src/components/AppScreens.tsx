import { copyText } from '../device/link';
import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import { toUrl } from '../browser/url';
import { scannedTarget } from '../device/qr';
import type { DownloadItem, DownloadStore } from '../storage/downloads';
import type { ClearOptions } from '../storage/clearData';
import type { SavedTask } from '../storage/savedTasks';
import type { Settings, SettingsPatch } from '../storage/settings';
import type { SitePermissionStore } from '../storage/sitePermissions';
import { CookiesScreen } from './CookiesScreen';
import { DownloadsScreen } from './DownloadsScreen';
import { LibraryScreen, type LibraryTab } from './LibraryScreen';
import { MyAppsScreen } from './MyApps';
import { OfflinePagesScreen } from './OfflinePagesScreen';
import { QrScanner } from './QrScanner';
import { SentLogScreen } from './SentLogScreen';
import { SettingsModal, type SettingsPage } from './SettingsModal';
import { SitePermissionsScreen } from './SitePermissionsScreen';
import { TabSwitcher } from './TabSwitcher';
import { TasksScreen, type TaskDraft } from './TasksScreen';

/**
 * The full screen open over the browser, one at a time (design record UI-31). Opening one replaces the one before;
 * each still slides in and out on its own and closes with the back gesture as before.
 */
export type OpenScreen =
  | { kind: 'settings' }
  | { kind: 'sent'; key: string }
  | { kind: 'tabs' }
  | { kind: 'library'; tab: LibraryTab }
  | { kind: 'myApps' }
  | { kind: 'sites' }
  | { kind: 'cookies'; tab: Tab }
  | { kind: 'downloads' }
  | { kind: 'offline' }
  | { kind: 'scanner' }
  | { kind: 'tasks'; draft: TaskDraft | null };

export type ScreenKind = OpenScreen['kind'];

/** The open screen of that kind, or null. */
export function screenOf<K extends ScreenKind>(screen: OpenScreen | null, kind: K): Extract<OpenScreen, { kind: K }> | null {
  return screen?.kind === kind ? (screen as Extract<OpenScreen, { kind: K }>) : null;
}

export function AppScreens({
  screen,
  close,
  darkMode,
  browser,
  tab,
  settings,
  settingsPage,
  onSettingsClosed,
  changeSettings,
  clearData,
  runSavedTask,
  viaQutai,
  onCompareTabs,
  onAskForApp,
  onImportApp,
  notify,
  downloads,
  sitePermissions,
  onAskDownload,
  onShowAssistantIntro,
}: {
  screen: OpenScreen | null;
  /** Closes that screen if it is still the one open. */
  close: (kind: ScreenKind) => void;
  darkMode: boolean;
  browser: Browser;
  /** The tab on screen. */
  tab: Tab;
  settings: Settings;
  settingsPage: SettingsPage;
  onSettingsClosed: () => void;
  changeSettings: (patch: SettingsPatch) => Promise<void>;
  clearData: (options: ClearOptions) => Promise<void>;
  runSavedTask: (task: SavedTask) => Promise<void> | void;
  /** The sent log's conversation goes through Qutai Credits. */
  viaQutai: boolean;
  onCompareTabs: (picked: Tab[]) => void;
  onAskForApp: () => void;
  onImportApp: () => void;
  notify: (message: string) => void;
  downloads: DownloadStore;
  sitePermissions: SitePermissionStore;
  onAskDownload: (entry: DownloadItem) => void;
  onShowAssistantIntro: () => void;
}) {
  const library = screenOf(screen, 'library');
  const sent = screenOf(screen, 'sent');
  const cookies = screenOf(screen, 'cookies');
  const tasks = screenOf(screen, 'tasks');
  return (
    <>
      <LibraryScreen
        visible={!!library}
        initialTab={library?.tab ?? 'bookmarks'}
        onOpen={(url) => {
          close('library');
          tab.loadUrl(url);
        }}
        onClose={() => close('library')}
      />
      <TabSwitcher
        darkMode={darkMode}
        visible={screen?.kind === 'tabs'}
        browser={browser}
        onClose={() => close('tabs')}
        onCompare={(picked) => {
          close('tabs');
          onCompareTabs(picked);
        }}
      />
      <CookiesScreen tab={cookies?.tab ?? null} onClose={() => close('cookies')} />
      <MyAppsScreen
        visible={screen?.kind === 'myApps'}
        dark={darkMode}
        onClose={() => close('myApps')}
        onAskForApp={onAskForApp}
        onImport={() => {
          close('myApps');
          onImportApp();
        }}
        onNotice={notify}
      />
      <SentLogScreen
        visible={!!sent}
        conversation={sent?.key}
        customInstructions={settings.customInstructions}
        showCost={settings.showCost}
        viaQutai={viaQutai}
        onClose={() => close('sent')}
      />
      <SettingsModal
        onClearData={clearData}
        visible={screen?.kind === 'settings'}
        initialPage={settingsPage}
        settings={settings}
        onChange={changeSettings}
        onClose={() => {
          close('settings');
          onSettingsClosed();
        }}
        onRunTask={runSavedTask}
        incognitoActive={browser.active.incognito}
        onShowAssistantIntro={() => {
          close('settings');
          onShowAssistantIntro();
        }}
      />
      <DownloadsScreen
        visible={screen?.kind === 'downloads'}
        store={downloads}
        copyText={copyText}
        onAsk={onAskDownload}
        onClose={() => close('downloads')}
      />
      <SitePermissionsScreen
        visible={screen?.kind === 'sites'}
        store={sitePermissions}
        blockingEnabled={settings.blockAds}
        onClose={() => close('sites')}
      />
      <OfflinePagesScreen
        visible={screen?.kind === 'offline'}
        onOpenLive={(url) => {
          close('offline');
          browser.openTab(url, { incognito: tab.incognito });
        }}
        onClose={() => close('offline')}
      />
      <QrScanner
        visible={screen?.kind === 'scanner'}
        onScan={(data) => {
          close('scanner');
          const target = scannedTarget(data);
          if (target.kind === 'url') browser.openTab(target.value, { incognito: tab.incognito });
          else if (target.value) tab.loadUrl(toUrl(target.value, settings.searchEngine));
        }}
        onClose={() => close('scanner')}
      />
      <TasksScreen visible={!!tasks} draft={tasks?.draft} onClose={() => close('tasks')} onRun={runSavedTask} />
    </>
  );
}
