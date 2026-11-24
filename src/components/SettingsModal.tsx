import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { BuyCreditsHost } from './BuyCredits';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ALWAYS_ALLOW_KINDS, AlwaysAllowKind, withKind } from '../agent/alwaysAllow';
import { cleanCustomInstructions, MAX_CUSTOM_INSTRUCTIONS } from '../agent/systemPrompt';
import { PRICES_AS_OF } from '../ai/prices';
import { getProvider, isConfigured, modelLabel, requestTarget } from '../ai/providers';
import { SEARCH_ENGINE_ORDER, SEARCH_ENGINES } from '../browser/search';
import { useAccountState } from '../account';
import { analyticsOffered, setAnalyticsConsent, useAnalyticsConsent } from '../analytics';
import { accountsEnabled, creditsEnabled } from '../config/features';
import { authenticate, canAuthenticate } from '../device/biometric';
import { appVersion } from '../device/appVersion';
import { BackupTooLargeError, pickBackupFile, PickerUnavailableError } from '../device/backupFile';
import { rateApp } from '../device/rateApp';
import { backgroundTasksSupported } from '../device/backgroundTask';
import { ensureNotificationPermission } from '../device/notifications';
import { chooseSharedContacts, contactsState, requestContacts, type ContactsState } from '../device/contacts';
import { openDefaultBrowserSettings } from '../device/defaultBrowser';
import { offerSettings, openSettingsOrExplain } from '../device/settings';
import { voiceModeSummary, VoiceModeSummary } from '../device/voiceInput';
import { AUTO_LANGUAGE, languageName } from '../device/voiceLanguage';
import { VoiceLanguageSheet } from './VoiceLanguageSheet';
import { incognitoIsolated } from '../device/webviewProfile';
import { useLocales } from 'expo-localization';
import { getLanguage, LANGUAGE_INFO, LANGUAGES, t, type Language } from '../i18n';
import { chooseLanguage, chosenLanguage, languageChoiceMode } from '../i18n/appLanguage';
import type { LegalKind } from '../legal/documents';
import type { Settings, SettingsPatch } from '../storage/settings';
import { Icon, IconName } from '../ui/Icon';
import { Button } from '../ui/Button';
import { GroupItem, GroupLink, GroupSwitch, LinkRow, Segment, SettingsSection } from '../ui/SettingsRows';
import { makeStyles, readableColumn, usePalette, radii, common } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { AccountScreen } from './AccountScreen';
import { CreditsScreen } from './CreditsScreen';
import { ActionLogScreen } from './ActionLogScreen';
import { pricesDate } from './AnswerCost';
import { SentLogScreen } from './SentLogScreen';
import { ScriptSitesSection } from './ScriptSitesSection';
import { BackupScreen, type ServerRestoreJob } from './BackupScreen';
import { ServerBackupSection } from './ServerBackupSection';
import { serverBackupEnabled } from '../backup/server';
import { CalendarChoiceScreen } from './CalendarChoiceScreen';
import { AiChoice, aiChoiceProblem, AiProviderFields, cleanAiChoice } from './AiProviderFields';
import { ensureAiConsent } from './AiConsent';
import { backStep, pickAi as pickAiFields, type SettingsPage } from './settingsNavigation';
import { ClearDataScreen, ClearOptions } from './ClearDataScreen';
import { LegalScreen } from './LegalScreen';
import { LicencesScreen } from './LicencesScreen';
import { MemoryScreen } from './MemoryScreen';
import { TasksScreen } from './TasksScreen';
import type { SavedTask } from '../storage/savedTasks';
import { FilterListsScreen } from './FilterListsScreen';
import { siteRules } from '../storage/siteRules';
import { dialog, DialogHost } from './Dialog';
import { KeyboardAwareScrollView } from './KeyboardAware';

/** What Settings says beside a "Don't ask again" switch: where the data goes, or what is still asked. */
const ALWAYS_ALLOW_NOTES: Partial<Record<AlwaysAllowKind, Parameters<typeof t>[0]>> = {
  calendarRead: 'settings.alwaysAllowNote.calendarRead',
  location: 'settings.alwaysAllowNote.location',
  download: 'settings.alwaysAllowNote.download',
};

type Props = {
  visible: boolean;
  settings: Settings;
  /** Called for every change; switches and choices apply (and are saved) immediately. */
  /** A change as a patch, applied to the settings as they are when it lands (DATA-28). */
  onChange: (patch: SettingsPatch) => void;
  onClose: () => void;
  onClearData: (options: ClearOptions) => Promise<void>;
  /** Run on a saved task: Settings closes and the app runs it. */
  onRunTask: (task: SavedTask) => void;
  /** The tab on screen is incognito: the memory questions are not offered from there. */
  incognitoActive: boolean;
  /** "Show the Qutai button tour": Settings closes and the first-run introduction shows again. */
  onShowAssistantIntro: () => void;
  /** The page Settings opens on (the main page unless the app sends the user somewhere: sign in, choose a provider). */
  initialPage?: SettingsPage;
};

export type { SettingsPage };
type Page = SettingsPage;

/** Where the Android back button goes; the open page sets it (the modal receives the button). */
class BackRoute {
  private handler: () => void = () => {};
  set(handler: () => void) {
    this.handler = handler;
  }
  run() {
    this.handler();
  }
}

export function SettingsModal({ visible, onClose, ...rest }: Props) {
  const [back] = useState(() => new BackRoute());
  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => back.run()}>
      {/* Mounted only while visible, so it always opens on the main page with fresh fields. */}
      {visible && <SettingsPages {...rest} onClose={onClose} back={back} />}
      {/* Buy credits (Account › Qutai Credits): iOS can only present it from inside this modal. */}
      {visible && <BuyCreditsHost />}
      <DialogHost />
    </AppModal>
  );
}

const pickAi = (s: Settings): AiChoice => pickAiFields(s);
// An address that isn't valid counts as typed (cleaning would drop it), so it still asks to be saved or discarded.
const aiKey = (c: AiChoice) => JSON.stringify({ ...cleanAiChoice(c), typed: aiChoiceProblem(c) ? c.customBaseUrl : '' });
const sameAi = (a: AiChoice, b: AiChoice) => aiKey(a) === aiKey(b);

function SettingsPages({
  settings,
  onChange,
  onClose,
  onClearData,
  onRunTask,
  incognitoActive,
  onShowAssistantIntro,
  initialPage = 'main',
  back,
}: Omit<Props, 'visible'> & { back: BackRoute }) {
  const styles = useStyles();
  const palette = usePalette();
  // Each page opens at its top; going back returns to where the previous page was scrolled (Assistant's own pages
  // are opened from its end).
  const [view, setView] = useState<{ page: Page; offset: number }>({ page: initialPage, offset: 0 });
  const page = view.page;
  // How far each page was scrolled; written while scrolling, read when going back (no redraw needed).
  const [offsets] = useState(() => new Map<Page, number>());
  const setPage = (next: Page) => setView({ page: next, offset: 0 });
  // The API key, provider and model are typed, so they wait for Save; everything else applies at once.
  const [ai, setAi] = useState<AiChoice>(() => pickAi(settings));
  const aiDirty = !sameAi(ai, pickAi(settings));
  const [memoryVisible, setMemoryVisible] = useState(false);
  const [tasksVisible, setTasksVisible] = useState(false);
  const [listsVisible, setListsVisible] = useState(false);
  useSyncExternalStore(siteRules.subscribe, siteRules.getVersion);
  const [actionLogVisible, setActionLogVisible] = useState(false);
  const [sentLogVisible, setSentLogVisible] = useState(false);
  const [clearDataVisible, setClearDataVisible] = useState(false);
  const [legal, setLegal] = useState<LegalKind | null>(null);
  const [licencesVisible, setLicencesVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [backupJob, setBackupJob] = useState<'export' | Uint8Array | ServerRestoreJob | null>(null);
  const account = useAccountState();

  // Patches only: a change made while this screen waited (Face ID, a permission, the assistant) is kept.
  const set = (patch: Partial<Settings>) => onChange(patch);
  const saveAi = async () => {
    const problem = aiChoiceProblem(ai);
    if (problem) return dialog.alert(t('settings.saveFailed'), problem);
    const clean = cleanAiChoice(ai);
    // An own-key provider (or custom endpoint host) not accepted on this phone: its consent screen first; Cancel
    // saves nothing and stays here (AI-32).
    if (clean.provider !== 'qutai' && isConfigured(clean, clean.provider)) {
      const endpoint = getProvider(clean.provider).needsEndpoint ? clean.customBaseUrl : undefined;
      if (!(await ensureAiConsent({ provider: clean.provider, endpoint }))) return;
    }
    onChange(clean);
  };
  const configured = isConfigured(settings, settings.provider);

  const goBack = () => {
    const step = backStep(page, aiDirty);
    if (step.kind === 'close') return onClose();
    if (step.kind === 'page') return setView({ page: step.page, offset: offsets.get(step.page) ?? 0 });
    dialog.alert(t('settings.unsavedTitle'), t('settings.unsavedBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.discard'),
        style: 'destructive',
        onPress: () => {
          setAi(pickAi(settings));
          setPage('main');
        },
      },
    ]);
  };
  back.set(goBack);

  /** Turning a lock on needs a phone with a screen lock, and the user proving it's them once. */
  const setLock = async (key: 'appLock' | 'incognitoLock', on: boolean) => {
    if (!on) return set({ [key]: false });
    if (!(await canAuthenticate())) return dialog.alert(t('settings.lockUnavailable'));
    if (await authenticate(t('lock.confirmPrompt'))) set({ [key]: true });
  };

  /**
   * "Keep working in the background" (Android): the notification is the point, so turning it on asks for the
   * notification permission; when the system no longer asks, the setting stays on and Settings is offered.
   */
  const setBackgroundTasks = async (on: boolean) => {
    if (!on) return set({ backgroundTasks: false });
    if (!backgroundTasksSupported()) return dialog.alert(t('settings.backgroundTasksNeedsBuild'));
    set({ backgroundTasks: true });
    const permission = await ensureNotificationPermission().catch(() => 'denied' as const);
    if (permission === 'blocked') offerSettings(t('settings.backgroundTasksNoNotifications'));
    else if (permission === 'denied') dialog.alert(t('settings.backgroundTasksNoNotifications'));
  };

  const importBackup = async () => {
    try {
      const file = await pickBackupFile();
      if (file) setBackupJob(file);
    } catch (e) {
      dialog.alert(
        t('backup.importFailed'),
        e instanceof PickerUnavailableError
          ? t('library.importNeedsBuild')
          : e instanceof BackupTooLargeError
            ? t('backup.error.tooLarge')
            : t('backup.error.unreadableFile'),
      );
    }
  };

  const provider = getProvider(settings.provider);
  const modelName = modelLabel(settings.provider, settings.models[settings.provider]);
  const titles: Record<Page, string> = {
    main: t('settings.title'),
    account: t('account.title'),
    credits: t('credits.provider'),
    assistant: t('settings.assistant'),
    assistantPermissions: t('settings.permissions'),
    assistantVoice: t('settings.voiceSection'),
    assistantTasks: t('settings.tasksSection'),
    privacy: t('settings.privacySection'),
    appearance: t('settings.appearance'),
    language: t('settings.language'),
    search: t('settings.search'),
    backup: t('backup.section'),
    about: t('settings.about'),
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {page === 'main' ? (
          <View style={styles.headerSide} />
        ) : (
          <Pressable onPress={goBack} hitSlop={8} style={styles.headerSide} accessibilityRole="button" accessibilityLabel={t('address.back')}>
            <Icon name="back" size={22} color={palette.text} />
          </Pressable>
        )}
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {titles[page]}
        </Text>
        {page === 'main' ? (
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={[styles.headerSide, styles.headerRight]}>
            <Text style={styles.save}>{t('common.done')}</Text>
          </Pressable>
        ) : page === 'assistant' && aiDirty ? (
          <Pressable accessibilityRole="button" onPress={saveAi} hitSlop={8} style={[styles.headerSide, styles.headerRight]}>
            <Text style={styles.save}>{t('common.save')}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSide} />
        )}
      </View>

      {/* Keyed by page: a page opens at its top (or, going back, where it was), not where the previous one was. */}
      <KeyboardAwareScrollView
        key={page}
        contentContainerStyle={styles.content}
        contentOffset={{ x: 0, y: view.offset }}
        scrollEventThrottle={64}
        onScroll={(e) => {
          offsets.set(page, e.nativeEvent.contentOffset.y);
        }}
      >
        {page === 'main' && accountsEnabled && (
          <View style={styles.card}>
            <SectionRow
              icon="person"
              title={t('account.title')}
              summary={
                account.status === 'loading'
                  ? ''
                  : account.status === 'signedIn'
                    ? t('account.summarySignedIn')
                    : t('account.summarySignedOut')
              }
              onPress={() => setPage('account')}
              last
            />
          </View>
        )}
        {page === 'main' && (
          <>
            <View style={styles.card}>
              <SectionRow
                icon="assistant"
                title={t('settings.assistant')}
                summary={
                  configured
                    ? // Qutai Credits: nothing to name behind it (CRED-39).
                      settings.provider === 'qutai'
                      ? provider.label
                      : `${provider.label} · ${modelName}`
                    : t('settings.noKeySummary')
                }
                onPress={() => setPage('assistant')}
              />
              <SectionRow
                icon="shield"
                title={t('settings.privacySection')}
                summary={t('settings.privacySummary')}
                onPress={() => setPage('privacy')}
                last
              />
            </View>
            <View style={styles.card}>
              <SectionRow
                icon="textSize"
                title={t('settings.appearance')}
                summary={`${t(`settings.theme.${settings.theme}`)} · ${t(`settings.addressBar.${settings.addressBarPosition}`)}`}
                onPress={() => setPage('appearance')}
              />
              <SectionRow
                icon="globe"
                title={t('settings.language')}
                summary={languageSummary()}
                onPress={() => setPage('language')}
              />
              <SectionRow
                icon="find"
                title={t('settings.search')}
                summary={SEARCH_ENGINES[settings.searchEngine].name}
                onPress={() => setPage('search')}
                last
              />
            </View>
            <View style={styles.card}>
              <SectionRow
                icon="secure"
                title={t('backup.section')}
                summary={t('backup.sectionSummary')}
                onPress={() => setPage('backup')}
              />
              <SectionRow
                icon="info"
                title={t('settings.about')}
                summary={t('settings.aboutSummary')}
                onPress={() => setPage('about')}
                last
              />
            </View>
          </>
        )}

        {page === 'assistant' && (
          <>
            <AiProviderFields value={ai} onChange={setAi} onSignIn={accountsEnabled ? () => setPage('account') : undefined} />
            {aiDirty && (
              <Button size="large" label={t('common.save')} onPress={saveAi} style={styles.saveButton} />
            )}
            <SettingsSection title={t('settings.answersSection')}>
              {provider.webSearch ? (
                <GroupSwitch
                  title={t('settings.webSearch')}
                  hint={
                    settings.provider === 'qutai'
                      ? t('credits.webSearchHint')
                      : t('settings.webSearchHint', { provider: provider.label })
                  }
                  value={settings.webSearch}
                  onChange={(webSearch) => set({ webSearch })}
                />
              ) : (
                <GroupItem>
                  <Text style={styles.itemLabel}>{t('settings.webSearch')}</Text>
                  <Text style={styles.hint}>{t('settings.webSearchUnavailable', { provider: provider.label })}</Text>
                </GroupItem>
              )}
              {settings.provider === 'gemini' && (
                <GroupSwitch
                  title={t('settings.geminiStreaming')}
                  hint={t('settings.geminiStreamingHint')}
                  value={settings.geminiStreaming}
                  onChange={(geminiStreaming) => set({ geminiStreaming })}
                />
              )}
              <GroupSwitch
                title={t('settings.showCost')}
                hint={t('settings.showCostHint', { date: pricesDate(PRICES_AS_OF) })}
                value={settings.showCost}
                onChange={(showCost) => set({ showCost })}
              />
              <GroupSwitch
                title={t('settings.showActionMarker')}
                hint={t('settings.showActionMarkerHint')}
                value={settings.showActionMarker}
                onChange={(showActionMarker) => set({ showActionMarker })}
              />
            </SettingsSection>
            <SettingsSection title={t('settings.memorySection')}>
              <GroupSwitch
                title={t('settings.memoryEnabled')}
                hint={t('settings.memoryHint')}
                value={settings.memoryEnabled}
                onChange={(memoryEnabled) => set({ memoryEnabled })}
              />
              <GroupLink title={t('settings.manageMemory')} onPress={() => setMemoryVisible(true)} />
              <GroupItem>
                <CustomInstructionsField
                  value={settings.customInstructions}
                  onSave={(customInstructions) => set({ customInstructions })}
                />
              </GroupItem>
            </SettingsSection>
            <SettingsSection>
              <GroupLink
                icon="shield"
                title={t('settings.permissions')}
                summary={t('settings.permissionsSummary')}
                onPress={() => setPage('assistantPermissions')}
              />
              <GroupLink
                icon="microphone"
                title={t('settings.voiceSection')}
                summary={voiceLanguageLabel(settings.voiceLanguage)}
                onPress={() => setPage('assistantVoice')}
              />
              <GroupLink
                icon="tasks"
                title={t('settings.tasksSection')}
                summary={t('settings.tasksSummary')}
                onPress={() => setPage('assistantTasks')}
              />
            </SettingsSection>
          </>
        )}

        {page === 'assistantPermissions' && (
          <>
            <SettingsSection title={t('settings.mayDoSection')} style={styles.first}>
              <GroupSwitch
                title={t('settings.confirmActions')}
                hint={t('settings.confirmActionsHint')}
                value={settings.confirmActions}
                onChange={(confirmActions) => set({ confirmActions })}
              />
              <GroupSwitch
                title={t('settings.payments')}
                hint={t('settings.paymentsHint')}
                value={settings.assistantPayments}
                onChange={(on) => {
                  if (!on) {
                    set({ assistantPayments: false });
                    return;
                  }
                  // Turning it on is asked once more, with what it means; turning it off never is.
                  void dialog
                    .show({
                      title: t('settings.paymentsConfirmTitle'),
                      message: t('settings.paymentsConfirmBody'),
                      buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('settings.paymentsConfirmOn'), primary: true }],
                    })
                    .then((result) => {
                      if (result.button === 1) set({ assistantPayments: true });
                    });
                }}
              />
              <GroupSwitch
                title={t('settings.scripts')}
                hint={t('settings.scriptsHint')}
                value={settings.assistantScripts}
                onChange={(on) => {
                  if (!on) {
                    set({ assistantScripts: false });
                    return;
                  }
                  // The riskiest thing the assistant can do: turning it on is asked once more, in plain words.
                  void dialog
                    .show({
                      title: t('settings.scriptsConfirmTitle'),
                      message: t('settings.scriptsConfirmBody'),
                      buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('settings.scriptsConfirmOn'), primary: true }],
                    })
                    .then((result) => {
                      if (result.button === 1) set({ assistantScripts: true });
                    });
                }}
              />
            </SettingsSection>
            {settings.assistantScripts && (
              <ScriptSitesSection value={settings.scriptSites} onChange={(scriptSites) => set({ scriptSites })} />
            )}
            <SettingsSection title={t('settings.alwaysAllowTitle')} footer={t('settings.alwaysAllowHint')}>
              {ALWAYS_ALLOW_KINDS.map((kind) => (
                <GroupSwitch
                  key={kind}
                  title={t(`settings.alwaysAllow.${kind}`)}
                  hint={ALWAYS_ALLOW_NOTES[kind] ? t(ALWAYS_ALLOW_NOTES[kind]) : undefined}
                  value={settings.alwaysAllow.includes(kind)}
                  onChange={(on) => set({ alwaysAllow: withKind(settings.alwaysAllow, kind, on) })}
                />
              ))}
            </SettingsSection>
            <SettingsSection title={t('settings.phoneDataSection')}>
              <ContactsRow />
              <GroupLink title={t('settings.calendarChoice')} onPress={() => setCalendarVisible(true)} />
            </SettingsSection>
          </>
        )}

        {page === 'assistantVoice' && (
          <>
            <SettingsSection style={styles.first} footer={<VoiceModeLine online={settings.voiceOnline} language={settings.voiceLanguage} />}>
              <VoiceLanguageRow value={settings.voiceLanguage} onChange={(voiceLanguage) => set({ voiceLanguage })} />
              <GroupSwitch
                title={t('settings.voiceAutoSend')}
                hint={t('settings.voiceAutoSendHint')}
                value={settings.voiceAutoSend}
                onChange={(voiceAutoSend) => set({ voiceAutoSend })}
              />
              <GroupSwitch
                title={t('settings.voiceOnline')}
                hint={t('settings.voiceOnlineHint', { service: speechService() })}
                value={settings.voiceOnline === 'allowed'}
                onChange={(on) => set({ voiceOnline: on ? 'allowed' : 'declined' })}
              />
              {settings.showAssistantButton && (
                <GroupSwitch
                  title={t('settings.voiceHoldToTalk')}
                  hint={t('settings.voiceHoldToTalkHint')}
                  value={settings.voiceHoldToTalk}
                  onChange={(voiceHoldToTalk) => set({ voiceHoldToTalk })}
                />
              )}
            </SettingsSection>
          </>
        )}

        {page === 'assistantTasks' && (
          <>
            <SettingsSection title={t('settings.tasksTitle')} style={styles.first}>
              {/* Also without "Keep working in the background": a task can end after the user left (the answer
                  arrives), or wait for a confirmation. */}
              <GroupSwitch
                title={t('settings.notifyTaskDone')}
                hint={t('settings.notifyTaskDoneHint')}
                value={settings.notifyTaskDone}
                onChange={(notifyTaskDone) => set({ notifyTaskDone })}
              />
              {Platform.OS === 'android' && (
                <GroupSwitch
                  title={t('settings.backgroundTasks')}
                  hint={t('settings.backgroundTasksHint')}
                  value={settings.backgroundTasks}
                  onChange={setBackgroundTasks}
                />
              )}
              <GroupLink title={t('settings.savedTasks')} onPress={() => setTasksVisible(true)} />
            </SettingsSection>
            <SettingsSection title={t('settings.historySection')}>
              <GroupLink title={t('settings.actionLog')} onPress={() => setActionLogVisible(true)} />
              <GroupLink title={t('settings.sentLog')} onPress={() => setSentLogVisible(true)} />
            </SettingsSection>
          </>
        )}

        {page === 'privacy' && (
          <>
            <SettingsSection title={t('settings.blockingSection')} style={styles.first}>
              <GroupSwitch
                title={t('settings.blockAds')}
                hint={t('settings.blockAdsHint')}
                value={settings.blockAds}
                onChange={(blockAds) => set({ blockAds })}
              />
              <GroupLink
                title={t('settings.filterLists')}
                summary={siteRules.rules.length ? t('settings.filterListsRules', { count: siteRules.rules.length }) : undefined}
                onPress={() => setListsVisible(true)}
              />
              {/* Android only (BLK-32): WebKit always blocks them, so on iOS the switch would do nothing. */}
              {Platform.OS === 'android' && (
                <GroupSwitch
                  title={t('settings.thirdPartyCookies')}
                  hint={t('settings.thirdPartyCookiesHint')}
                  value={settings.blockThirdPartyCookies}
                  onChange={(blockThirdPartyCookies) => set({ blockThirdPartyCookies })}
                />
              )}
              <GroupSwitch
                title={t('settings.hideCookieBanners')}
                hint={t('settings.hideCookieBannersHint')}
                value={settings.hideCookieBanners}
                onChange={(hideCookieBanners) => set({ hideCookieBanners })}
              />
              <GroupSwitch
                title={t('settings.blockVideoAds')}
                hint={t('settings.blockVideoAdsHint')}
                value={settings.blockVideoAds}
                onChange={(blockVideoAds) => set({ blockVideoAds })}
              />
            </SettingsSection>
            <SettingsSection title={t('settings.dataSection')}>
              <GroupSwitch
                title={t('settings.httpsOnly')}
                hint={t('settings.httpsOnlyHint')}
                value={settings.httpsOnly}
                onChange={(httpsOnly) => set({ httpsOnly })}
              />
              <AnalyticsSwitch />
              <GroupLink title={t('settings.clearData')} onPress={() => setClearDataVisible(true)} />
            </SettingsSection>
            <SettingsSection title={t('settings.security')}>
              <GroupSwitch
                title={t('settings.appLock')}
                hint={t('settings.appLockHint')}
                value={settings.appLock}
                onChange={(on) => setLock('appLock', on)}
              />
              <GroupSwitch
                title={t('settings.incognitoLock')}
                hint={
                  incognitoIsolated()
                    ? t('settings.incognitoLockHint')
                    : `${t('settings.incognitoLockHint')} ${t('settings.incognitoSharedHint')}`
                }
                value={settings.incognitoLock}
                onChange={(on) => setLock('incognitoLock', on)}
              />
            </SettingsSection>
          </>
        )}

        {page === 'appearance' && (
          <>
            <SettingsSection title={t('settings.themeSection')} style={styles.first}>
              <GroupItem>
                <Segment
                  accessibilityLabel={t('settings.themeSection')}
                  options={(['system', 'light', 'dark'] as const).map((theme) => ({
                    value: theme,
                    label: t(`settings.theme.${theme}`),
                  }))}
                  value={settings.theme}
                  onChange={(theme) => set({ theme })}
                />
              </GroupItem>
            </SettingsSection>
            <SettingsSection title={t('settings.addressBarPosition')}>
              <GroupItem>
                <Segment
                  accessibilityLabel={t('settings.addressBarPosition')}
                  options={(['top', 'bottom'] as const).map((position) => ({
                    value: position,
                    label: t(`settings.addressBar.${position}`),
                  }))}
                  value={settings.addressBarPosition}
                  onChange={(addressBarPosition) => set({ addressBarPosition })}
                />
              </GroupItem>
              <GroupSwitch
                title={t('settings.keepAddressBarVisible')}
                hint={t('settings.keepAddressBarVisibleHint')}
                value={settings.keepAddressBarVisible}
                onChange={(keepAddressBarVisible) => set({ keepAddressBarVisible })}
              />
              <GroupSwitch
                title={t('settings.showAssistantButton')}
                hint={t('settings.showAssistantButtonHint')}
                value={settings.showAssistantButton}
                onChange={(showAssistantButton) => set({ showAssistantButton })}
              />
            </SettingsSection>
            <SettingsSection title={t('settings.touchSection')}>
              <GroupSwitch
                title={t('settings.forceZoom')}
                hint={t('settings.forceZoomHint')}
                value={settings.forceZoom}
                onChange={(forceZoom) => set({ forceZoom })}
              />
              <GroupSwitch
                title={t('settings.haptics')}
                hint={t('settings.hapticsHint')}
                value={settings.haptics}
                onChange={(haptics) => set({ haptics })}
              />
            </SettingsSection>
            <SettingsSection title={t('settings.mediaSection')}>
              <GroupSwitch
                title={t('settings.backgroundPlayback')}
                hint={t(Platform.OS === 'android' ? 'settings.backgroundPlaybackHintAndroid' : 'settings.backgroundPlaybackHint')}
                value={settings.backgroundPlayback}
                onChange={(backgroundPlayback) => set({ backgroundPlayback })}
              />
              {/* Vendor battery managers may stop even a foreground service; Qutai never asks to be exempted itself
                  (no REQUEST_IGNORE_BATTERY_OPTIMIZATIONS), the user decides in the system's own settings. */}
              {Platform.OS === 'android' && settings.backgroundPlayback && (
                <GroupLink
                  title={t('settings.backgroundPlaybackBatteryButton')}
                  summary={t('settings.backgroundPlaybackBattery')}
                  onPress={openSettingsOrExplain}
                />
              )}
              {Platform.OS === 'android' && (
                <GroupSwitch
                  title={t('settings.pictureInPicture')}
                  hint={t('settings.pictureInPictureHint')}
                  value={settings.pictureInPicture}
                  onChange={(pictureInPicture) => set({ pictureInPicture })}
                />
              )}
            </SettingsSection>
          </>
        )}

        {page === 'language' && <LanguagePage />}

        {page === 'search' && (
          <>
            <SettingsSection title={t('settings.searchEngineSection')} style={styles.first}>
              {SEARCH_ENGINE_ORDER.map((id) => (
                <RadioRow
                  key={id}
                  label={SEARCH_ENGINES[id].name}
                  selected={settings.searchEngine === id}
                  onPress={() => set({ searchEngine: id })}
                />
              ))}
            </SettingsSection>
            <SettingsSection>
              <GroupSwitch
                title={t('settings.searchSuggestions')}
                hint={t('settings.searchSuggestionsHint')}
                value={settings.searchSuggestions}
                onChange={(searchSuggestions) => set({ searchSuggestions })}
              />
            </SettingsSection>
          </>
        )}

        {page === 'account' && accountsEnabled && <AccountScreen onOpenCredits={() => setPage('credits')} usesCredits={settings.provider === 'qutai'} />}
        {page === 'credits' && creditsEnabled && account.status === 'signedIn' && <CreditsScreen />}

        {page === 'backup' && (
          <>
            {/* Pro mode: the account can hold backups too, so "no account to sync" would be wrong there. */}
            <Text style={styles.hint}>{t(serverBackupEnabled ? 'backup.introPro' : 'backup.intro')}</Text>
            <SettingsSection title={t('backup.fileSection')}>
              <GroupLink icon="upload" title={t('backup.exportTitle')} onPress={() => setBackupJob('export')} />
              <GroupLink icon="download" title={t('backup.importTitle')} onPress={importBackup} />
            </SettingsSection>
            {serverBackupEnabled && <ServerBackupSection onRestore={setBackupJob} />}
          </>
        )}

        {page === 'about' && (
          <>
            <SettingsSection
              style={styles.first}
              footer={Platform.OS !== 'ios' ? t('settings.defaultBrowserHintAndroid') : undefined}
            >
              <GroupLink
                icon="rate"
                title={t('settings.rate')}
                chevron={false}
                onPress={() =>
                  rateApp()
                    .then((ok) => ok || dialog.alert(t('settings.rateUnavailable')))
                    .catch(() => dialog.alert(t('settings.rateUnavailable')))
                }
              />
              {/* The Qutai button tour, here since UI-61 (was at the end of Settings › Assistant), before Default browser (UI-66), whose hint is the section's footer. */}
              {settings.showAssistantButton && (
                <GroupLink icon="info" title={t('settings.assistantIntro')} chevron={false} onPress={onShowAssistantIntro} />
              )}
              {/* The only place in the app for it since setup's step went (INTRO-30); the phone's own screen decides.
                  Not on iOS (INTRO-32): without Apple's com.apple.developer.web-browser entitlement Qutai isn't in the
                  phone's Default Browser App list, so the row would lead nowhere. Here since UI-58 (was under Search). */}
              {Platform.OS !== 'ios' && (
                <GroupLink
                  icon="globe"
                  title={t('settings.defaultBrowserTitle')}
                  onPress={() => openDefaultBrowserSettings().catch(() => {})}
                />
              )}
            </SettingsSection>
            <SettingsSection>
              <GroupLink title={t('settings.privacyPolicy')} onPress={() => setLegal('privacy')} />
              <GroupLink title={t('settings.terms')} onPress={() => setLegal('terms')} />
              <GroupLink title={t('settings.licences')} onPress={() => setLicencesVisible(true)} />
            </SettingsSection>
            <Text style={styles.version} selectable>
              {t('settings.version', appVersion())}
            </Text>
          </>
        )}
      </KeyboardAwareScrollView>
      <LegalScreen kind={legal} onClose={() => setLegal(null)} />
      <LicencesScreen visible={licencesVisible} onClose={() => setLicencesVisible(false)} />
      <CalendarChoiceScreen visible={calendarVisible} onClose={() => setCalendarVisible(false)} />
      <MemoryScreen
        visible={memoryVisible}
        onClose={() => setMemoryVisible(false)}
        appLock={settings.appLock}
        ai={configured ? requestTarget(settings, settings.provider) : null}
        questions={
          settings.memoryEnabled
            ? {
                incognito: incognitoActive,
                onInstructions: (update) =>
                  set({ customInstructions: cleanCustomInstructions(update(settings.customInstructions)) }),
                voice: settings,
                onVoice: (change) => set(change),
              }
            : undefined
        }
      />
      <TasksScreen
        visible={tasksVisible}
        onClose={() => setTasksVisible(false)}
        onRun={(task) => {
          setTasksVisible(false);
          onClose();
          onRunTask(task);
        }}
      />
      <FilterListsScreen
        visible={listsVisible}
        blockingEnabled={settings.blockAds}
        allowed={settings.blockAds && settings.legalAcceptedVersion > 0}
        onClose={() => setListsVisible(false)}
      />
      <ActionLogScreen visible={actionLogVisible} onClose={() => setActionLogVisible(false)} />
      <SentLogScreen
        visible={sentLogVisible}
        customInstructions={settings.customInstructions}
        showCost={settings.showCost}
        viaQutai={settings.provider === 'qutai'}
        onClose={() => setSentLogVisible(false)}
      />
      <BackupScreen job={backupJob} appLock={settings.appLock} onClose={() => setBackupJob(null)} />
      <ClearDataScreen visible={clearDataVisible} onClear={onClearData} onClose={() => setClearDataVisible(false)} />
    </SafeAreaView>
  );
}

/** "Deutsch", or "System default (English)" when Qutai follows the system. */
function languageSummary(): string {
  const name = LANGUAGE_INFO[getLanguage()].name;
  const mode = languageChoiceMode();
  if (mode !== 'none' && chosenLanguage()) return name;
  return t('settings.languageSummarySystem', { language: name });
}

/**
 * Settings › Language: "System default" and the ten languages, each written in itself. Android: picking one switches
 * the whole interface at once (src/i18n/appLanguage.ts says where the choice lives). iOS too (LANG-24): the choice is
 * the same per-app value iOS Settings › Qutai › Language keeps; iOS's own texts follow from the next launch.
 */
function LanguagePage() {
  const styles = useStyles();
  // Re-reads the choice when the system's per-app language changes (Android's own language screen).
  useLocales();
  const mode = languageChoiceMode();
  // Read from the platform on each render (a synchronous native call), so a change made elsewhere shows.
  const [, rerender] = useState(0);
  const chosen = chosenLanguage();
  if (mode === 'none') return <Text style={styles.hint}>{t('settings.languageNeedsBuild')}</Text>;
  const pick = (language: Language | null) => {
    if (language === chosen) return;
    if (chooseLanguage(language)) rerender((n) => n + 1);
  };
  const option = (key: string, label: string, language: Language | null) => (
    <RadioRow key={key} label={label} selected={chosen === language} onPress={() => pick(language)} />
  );
  return (
    <SettingsSection
      style={styles.first}
      footer={t(
        mode === 'settings' ? 'settings.languageHintIos' : mode === 'system' ? 'settings.languageHintAndroid' : 'settings.languageHintOld',
      )}
    >
      {option('system', t('settings.languageSystem'), null)}
      {LANGUAGES.map((language) => option(language, LANGUAGE_INFO[language].name, language))}
    </SettingsSection>
  );
}

const speechService = () => t(Platform.OS === 'ios' ? 'voice.serviceApple' : 'voice.serviceGoogle');

/** "Automatic" or the fixed listening language's name. */
function voiceLanguageLabel(value: string): string {
  return value === AUTO_LANGUAGE ? t('settings.voiceLanguageAuto') : languageName(value);
}

/**
 * Settings › Assistant › Voice input › Listening language: Automatic (follows each conversation) or a fixed language,
 * chosen in the same sheet as the panel's (Turkish, English, More languages…).
 */
function VoiceLanguageRow({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const auto = value === AUTO_LANGUAGE;
  return (
    <>
      <GroupLink
        title={t('settings.voiceLanguage')}
        value={voiceLanguageLabel(value)}
        summary={t('settings.voiceLanguageHint')}
        onPress={() => setOpen(true)}
      />
      <VoiceLanguageSheet
        visible={open}
        value={auto ? null : value}
        autoLabel={t('settings.voiceLanguageAuto')}
        onPick={(next) => onChange(next ?? AUTO_LANGUAGE)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** How voice input runs on this phone for the chosen (or the app's) language right now (on the device, or online). */
function VoiceModeLine({ online, language }: { online: Settings['voiceOnline']; language: string }) {
  const styles = useStyles();
  const [mode, setMode] = useState<VoiceModeSummary | null>(null);
  useEffect(() => {
    let alive = true;
    voiceModeSummary(language === AUTO_LANGUAGE ? getLanguage() : language, online)
      .then((next) => alive && setMode(next))
      .catch(() => alive && setMode('unavailable'));
    return () => {
      alive = false;
    };
  }, [online, language]);
  return (
    <Text style={[styles.hint, styles.footerNote]}>
      {t(`settings.voiceMode.${mode ?? 'checking'}`, { service: speechService() })}
    </Text>
  );
}

function SectionRow({
  icon,
  title,
  summary,
  onPress,
  last,
}: {
  icon: IconName;
  title: string;
  summary: string;
  onPress: () => void;
  last?: boolean;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sectionRow, !last && styles.sectionRowLine, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityHint={summary}
    >
      <View style={styles.sectionIcon}>
        <Icon name={icon} size={20} color={palette.tintText} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.hint} numberOfLines={1}>
          {summary}
        </Text>
      </View>
      <Icon name="chevronRight" size={20} color={palette.textSecondary} />
    </Pressable>
  );
}


/** A choice among several, inside a SettingsSection card (search engine, language). */
function RadioRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.radioRow, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <Radio selected={selected} />
      <Text style={[styles.optionText, styles.flex]}>{label}</Text>
    </Pressable>
  );
}

// No "Answer briefly" example: short answers are the assistant's own rule (INTRO-34).
const INSTRUCTION_EXAMPLES = ['settings.customExample2'] as const;

/**
 * Settings › Assistant › Custom instructions: saved when the field loses focus (and when the page closes), so
 * typing doesn't rewrite secure storage on every key. Examples are added as their own line with a tap.
 */
function CustomInstructionsField({ value, onSave }: { value: string; onSave: (text: string) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const [text, setText] = useState(value);
  const latest = useRef({ text, value, onSave });
  useEffect(() => {
    latest.current = { text, value, onSave };
  });
  const save = (next = text) => {
    const clean = cleanCustomInstructions(next);
    if (clean !== value) onSave(clean);
  };
  useEffect(
    () => () => {
      const { text: last, value: saved, onSave: store } = latest.current;
      const clean = cleanCustomInstructions(last);
      if (clean !== saved) store(clean);
    },
    [],
  );
  const addExample = (example: string) => {
    if (text.includes(example)) return;
    const next = (text.trim() ? `${text.trim()}\n${example}` : example).slice(0, MAX_CUSTOM_INSTRUCTIONS);
    setText(next);
    save(next);
  };
  return (
    <>
      <Text style={styles.itemLabel}>{t('settings.customInstructions')}</Text>
      <Text style={styles.hint}>{t('settings.customInstructionsHint')}</Text>
      <TextInput
        style={styles.customInput}
        value={text}
        onChangeText={setText}
        onEndEditing={() => save()}
        placeholder={t('settings.customInstructionsPlaceholder')}
        placeholderTextColor={palette.textSecondary}
        maxLength={MAX_CUSTOM_INSTRUCTIONS}
        multiline
        textAlignVertical="top"
        accessibilityLabel={t('settings.customInstructions')}
      />
      <View style={styles.customFooter}>
        <View style={styles.customExamples}>
          {INSTRUCTION_EXAMPLES.map((key) => (
            <Pressable
              key={key}
              onPress={() => addExample(t(key))}
              style={({ pressed }) => [styles.customExample, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityHint={t('settings.customExampleHint')}
            >
              <Text style={styles.customExampleText}>{t(key)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{`${text.length}/${MAX_CUSTOM_INSTRUCTIONS}`}</Text>
      </View>
    </>
  );
}

/**
 * Settings › Assistant › Contacts (docs/contacts.md): what the system allows, read again when Qutai comes back from the
 * phone's settings, with the one thing that helps: Allow (the system prompt, while it still asks), Choose contacts (iOS
 * limited access) or the phone's settings (refused for good, or to take it back).
 */
function ContactsRow() {
  const styles = useStyles();
  const [state, setState] = useState<ContactsState | null>(null);
  useEffect(() => {
    let live = true;
    const read = () => {
      contactsState()
        .then((next) => live && setState(next))
        .catch(() => {});
    };
    read();
    const sub = AppState.addEventListener('change', (next) => next === 'active' && read());
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  if (!state) return null;
  return (
    <GroupItem>
      <Text style={styles.itemLabel}>{t('settings.contactsTitle')}</Text>
      <Text style={styles.hint}>{t('settings.contactsHint')}</Text>
      <Text style={[styles.hint, styles.contactsState]}>{t(`settings.contactsState.${state}`)}</Text>
      {state === 'undetermined' || state === 'denied' ? (
        <LinkRow label={t('settings.contactsAllow')} onPress={() => void requestContacts().then(setState)} />
      ) : null}
      {state === 'limited' ? (
        <LinkRow label={t('settings.contactsChoose')} onPress={() => void chooseSharedContacts().then(() => contactsState().then(setState))} />
      ) : null}
      {state === 'granted' || state === 'limited' || state === 'blocked' ? (
        <LinkRow label={t('settings.openSystem')} onPress={openSettingsOrExplain} />
      ) : null}
    </GroupItem>
  );
}



const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  headerSide: { minWidth: 64 },
  headerRight: { alignItems: 'flex-end' },
  title: { color: c.text, fontSize: 17, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  save: { fontSize: 16, color: c.tintText, fontWeight: '600' },
  content: { ...readableColumn, padding: 16, gap: 8 },
  card: { ...common(c).card, overflow: 'hidden' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  sectionRowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.sunken,
  },
  sectionTitle: { color: c.text, fontSize: 16, fontWeight: '600' },
  pressed: { backgroundColor: c.pressed },
  itemLabel: common(c).label,
  hint: common(c).hint,
  contactsState: { color: c.text, marginTop: 4 },
  footerNote: { marginHorizontal: 4 },
  /** The first section of a page sits closer to the header. */
  first: { marginTop: 4 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingHorizontal: 14, paddingVertical: 10 },
  customInput: {
    color: c.text,
    minHeight: 96,
    maxHeight: 180,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: c.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
    marginTop: 6,
  },
  customFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  customExamples: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  customExample: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.sunken,
  },
  customExampleText: { fontSize: 13, color: c.text },
  link: { color: c.tintText, fontWeight: '600' },
  optionText: { color: c.text, fontSize: 15 },
  saveButton: { marginTop: 4 },
  version: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 28 },
}));

/**
 * Settings › Privacy and security › "Share anonymous usage data" (pro builds, SRV-31): shown while the server collects,
 * or while this phone has said yes (so it can always be turned off). Off deletes this phone's anonymous id.
 */
function AnalyticsSwitch() {
  const consent = useAnalyticsConsent();
  const [offered, setOffered] = useState(false);
  useEffect(() => {
    let live = true;
    void analyticsOffered().then((on) => live && setOffered(on));
    return () => {
      live = false;
    };
  }, []);
  if (consent === null || (!offered && consent !== 'allowed')) return null;
  return (
    <GroupSwitch
      title={t('settings.analytics')}
      hint={t('settings.analyticsHint')}
      value={consent === 'allowed'}
      onChange={(on) => void setAnalyticsConsent(on)}
    />
  );
}
