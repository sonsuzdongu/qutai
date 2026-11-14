import { ReactNode, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProvider } from '../ai/providers';
import { SEARCH_ENGINE_ORDER, SEARCH_ENGINES } from '../browser/search';
import { authenticate, canAuthenticate } from '../device/biometric';
import { appVersion } from '../device/appVersion';
import { BackupTooLargeError, pickBackupFile, PickerUnavailableError } from '../device/backupFile';
import { rateApp } from '../device/rateApp';
import { voiceModeSummary, VoiceModeSummary } from '../device/voiceInput';
import { incognitoIsolated } from '../device/webviewProfile';
import { getLanguage, t } from '../i18n';
import type { LegalKind } from '../legal/documents';
import type { Settings } from '../storage/settings';
import type { SitePermissionStore } from '../storage/sitePermissions';
import { Icon, IconName } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { ActionLogScreen } from './ActionLogScreen';
import { SentLogScreen } from './SentLogScreen';
import { BackupScreen } from './BackupScreen';
import { AiChoice, AiProviderFields, cleanAiChoice } from './AiProviderFields';
import { ClearDataScreen, ClearOptions } from './ClearDataScreen';
import { LegalScreen } from './LegalScreen';
import { MemoryScreen } from './MemoryScreen';
import { SitePermissionsScreen } from './SitePermissionsScreen';
import { FilterListsScreen } from './FilterListsScreen';
import { dialog, DialogHost } from './Dialog';

type Props = {
  visible: boolean;
  settings: Settings;
  /** Called for every change; switches and choices apply (and are saved) immediately. */
  onChange: (settings: Settings) => void;
  onClose: () => void;
  sitePermissions: SitePermissionStore;
  onClearData: (options: ClearOptions) => Promise<void>;
};

type Page = 'main' | 'assistant' | 'privacy' | 'appearance' | 'search' | 'backup' | 'about';

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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => back.run()}>
      {/* Mounted only while visible, so it always opens on the main page with fresh fields. */}
      {visible && <SettingsPages {...rest} onClose={onClose} back={back} />}
      <DialogHost />
    </Modal>
  );
}

const pickAi = (s: Settings): AiChoice => ({ provider: s.provider, apiKeys: s.apiKeys, models: s.models });
const sameAi = (a: AiChoice, b: AiChoice) => JSON.stringify(cleanAiChoice(a)) === JSON.stringify(cleanAiChoice(b));

function SettingsPages({
  settings,
  onChange,
  onClose,
  sitePermissions,
  onClearData,
  back,
}: Omit<Props, 'visible'> & { back: BackRoute }) {
  const styles = useStyles();
  const palette = usePalette();
  const [page, setPage] = useState<Page>('main');
  // The API key, provider and model are typed, so they wait for Save; everything else applies at once.
  const [ai, setAi] = useState<AiChoice>(() => pickAi(settings));
  const aiDirty = !sameAi(ai, pickAi(settings));
  const [memoryVisible, setMemoryVisible] = useState(false);
  const [sitesVisible, setSitesVisible] = useState(false);
  const [listsVisible, setListsVisible] = useState(false);
  const [actionLogVisible, setActionLogVisible] = useState(false);
  const [sentLogVisible, setSentLogVisible] = useState(false);
  const [clearDataVisible, setClearDataVisible] = useState(false);
  const [legal, setLegal] = useState<LegalKind | null>(null);
  const [backupJob, setBackupJob] = useState<'export' | Uint8Array | null>(null);

  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const saveAi = () => onChange({ ...settings, ...cleanAiChoice(ai) });

  const goBack = () => {
    if (page === 'main') return onClose();
    if (page !== 'assistant' || !aiDirty) return setPage('main');
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
  const modelName = provider.models.find((m) => m.id === settings.models[settings.provider])?.name;
  const titles: Record<Page, string> = {
    main: t('settings.title'),
    assistant: t('settings.assistant'),
    privacy: t('settings.privacySection'),
    appearance: t('settings.appearance'),
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
          <Pressable onPress={goBack} hitSlop={8} style={styles.headerSide} accessibilityLabel={t('address.back')}>
            <Icon name="back" size={22} color={palette.text} />
          </Pressable>
        )}
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {titles[page]}
        </Text>
        {page === 'main' ? (
          <Pressable onPress={onClose} hitSlop={8} style={[styles.headerSide, styles.headerRight]}>
            <Text style={styles.save}>{t('common.done')}</Text>
          </Pressable>
        ) : page === 'assistant' && aiDirty ? (
          <Pressable onPress={saveAi} hitSlop={8} style={[styles.headerSide, styles.headerRight]}>
            <Text style={styles.save}>{t('common.save')}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSide} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {page === 'main' && (
          <View style={styles.card}>
            <SectionRow
              icon="assistant"
              title={t('settings.assistant')}
              summary={
                settings.apiKeys[settings.provider]
                  ? `${provider.label} · ${modelName ?? settings.models[settings.provider]}`
                  : t('settings.noKeySummary')
              }
              onPress={() => setPage('assistant')}
            />
            <SectionRow
              icon="shield"
              title={t('settings.privacySection')}
              summary={t('settings.privacySummary')}
              onPress={() => setPage('privacy')}
            />
            <SectionRow
              icon="textSize"
              title={t('settings.appearance')}
              summary={`${t(`settings.theme.${settings.theme}`)} · ${t(`settings.addressBar.${settings.addressBarPosition}`)}`}
              onPress={() => setPage('appearance')}
            />
            <SectionRow
              icon="find"
              title={t('settings.search')}
              summary={SEARCH_ENGINES[settings.searchEngine].name}
              onPress={() => setPage('search')}
            />
            <SectionRow
              icon="secure"
              title={t('backup.section')}
              summary={t('backup.sectionSummary')}
              onPress={() => setPage('backup')}
            />
            <SectionRow
              icon="moreHorizontal"
              title={t('settings.about')}
              summary={t('settings.aboutSummary')}
              onPress={() => setPage('about')}
              last
            />
          </View>
        )}

        {page === 'assistant' && (
          <>
            <AiProviderFields value={ai} onChange={setAi} />
            {aiDirty && (
              <Pressable onPress={saveAi} style={styles.saveButton} accessibilityRole="button">
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </Pressable>
            )}
            <SwitchRow
              title={t('settings.confirmActions')}
              hint={t('settings.confirmActionsHint')}
              value={settings.confirmActions}
              onChange={(confirmActions) => set({ confirmActions })}
            />
            <SwitchRow
              title={t('settings.webSearch')}
              hint={t('settings.webSearchHint', { provider: provider.label })}
              value={settings.webSearch}
              onChange={(webSearch) => set({ webSearch })}
            />
            <SwitchRow
              title={t('settings.memoryEnabled')}
              hint={t('settings.memoryHint')}
              value={settings.memoryEnabled}
              onChange={(memoryEnabled) => set({ memoryEnabled })}
            />
            <Text style={[styles.label, styles.sectionLabel]}>{t('settings.voiceSection')}</Text>
            <SwitchRow
              title={t('settings.voiceAutoSend')}
              hint={t('settings.voiceAutoSendHint')}
              value={settings.voiceAutoSend}
              onChange={(voiceAutoSend) => set({ voiceAutoSend })}
            />
            <SwitchRow
              title={t('settings.voiceOnline')}
              hint={t('settings.voiceOnlineHint', { service: speechService() })}
              value={settings.voiceOnline === 'allowed'}
              onChange={(on) => set({ voiceOnline: on ? 'allowed' : 'declined' })}
            />
            <VoiceModeLine online={settings.voiceOnline} />
            <LinkRow label={t('settings.manageMemory')} onPress={() => setMemoryVisible(true)} />
            <LinkRow label={t('settings.sitePermissions')} onPress={() => setSitesVisible(true)} />
            <LinkRow label={t('settings.actionLog')} onPress={() => setActionLogVisible(true)} />
            <LinkRow label={t('settings.sentLog')} onPress={() => setSentLogVisible(true)} />
          </>
        )}

        {page === 'privacy' && (
          <>
            <SwitchRow
              title={t('settings.blockAds')}
              hint={t('settings.blockAdsHint')}
              value={settings.blockAds}
              onChange={(blockAds) => set({ blockAds })}
            />
            <LinkRow label={t('settings.filterLists')} onPress={() => setListsVisible(true)} />
            <SwitchRow
              title={t('settings.thirdPartyCookies')}
              hint={t('settings.thirdPartyCookiesHint')}
              value={settings.blockThirdPartyCookies}
              onChange={(blockThirdPartyCookies) => set({ blockThirdPartyCookies })}
            />
            <SwitchRow
              title={t('settings.hideCookieBanners')}
              hint={t('settings.hideCookieBannersHint')}
              value={settings.hideCookieBanners}
              onChange={(hideCookieBanners) => set({ hideCookieBanners })}
            />
            <SwitchRow
              title={t('settings.httpsOnly')}
              hint={t('settings.httpsOnlyHint')}
              value={settings.httpsOnly}
              onChange={(httpsOnly) => set({ httpsOnly })}
            />
            <LinkRow label={t('settings.clearData')} onPress={() => setClearDataVisible(true)} />
            <Text style={[styles.label, styles.sectionLabel]}>{t('settings.security')}</Text>
            <SwitchRow
              title={t('settings.appLock')}
              hint={t('settings.appLockHint')}
              value={settings.appLock}
              onChange={(on) => setLock('appLock', on)}
            />
            <SwitchRow
              title={t('settings.incognitoLock')}
              hint={
                incognitoIsolated()
                  ? t('settings.incognitoLockHint')
                  : `${t('settings.incognitoLockHint')} ${t('settings.incognitoSharedHint')}`
              }
              value={settings.incognitoLock}
              onChange={(on) => setLock('incognitoLock', on)}
            />
          </>
        )}

        {page === 'appearance' && (
          <>
            <Segment
              options={(['system', 'light', 'dark'] as const).map((theme) => ({
                value: theme,
                label: t(`settings.theme.${theme}`),
              }))}
              value={settings.theme}
              onChange={(theme) => set({ theme })}
            />
            <SwitchRow
              title={t('settings.darkSites')}
              hint={t('settings.darkSitesHint')}
              value={settings.darkSites}
              onChange={(darkSites) => set({ darkSites })}
            />
            <Text style={styles.label}>{t('settings.addressBarPosition')}</Text>
            <Segment
              options={(['top', 'bottom'] as const).map((position) => ({
                value: position,
                label: t(`settings.addressBar.${position}`),
              }))}
              value={settings.addressBarPosition}
              onChange={(addressBarPosition) => set({ addressBarPosition })}
            />
            <SwitchRow
              title={t('settings.showAssistantButton')}
              hint={t('settings.showAssistantButtonHint')}
              value={settings.showAssistantButton}
              onChange={(showAssistantButton) => set({ showAssistantButton })}
            />
            <SwitchRow
              title={t('settings.animateLogo')}
              hint={t('settings.animateLogoHint')}
              value={settings.animateLogo}
              onChange={(animateLogo) => set({ animateLogo })}
            />
            <SwitchRow
              title={t('settings.forceZoom')}
              hint={t('settings.forceZoomHint')}
              value={settings.forceZoom}
              onChange={(forceZoom) => set({ forceZoom })}
            />
            <SwitchRow
              title={t('settings.haptics')}
              hint={t('settings.hapticsHint')}
              value={settings.haptics}
              onChange={(haptics) => set({ haptics })}
            />
          </>
        )}

        {page === 'search' && (
          <>
            {SEARCH_ENGINE_ORDER.map((id) => (
              <Pressable
                key={id}
                style={styles.option}
                onPress={() => set({ searchEngine: id })}
                accessibilityRole="radio"
                accessibilityState={{ checked: settings.searchEngine === id }}
              >
                <Radio selected={settings.searchEngine === id} />
                <Text style={styles.optionText}>{SEARCH_ENGINES[id].name}</Text>
              </Pressable>
            ))}
            <SwitchRow
              title={t('settings.searchSuggestions')}
              hint={t('settings.searchSuggestionsHint')}
              value={settings.searchSuggestions}
              onChange={(searchSuggestions) => set({ searchSuggestions })}
            />
          </>
        )}

        {page === 'backup' && (
          <>
            <Text style={styles.hint}>{t('backup.intro')}</Text>
            <LinkRow label={t('backup.exportTitle')} onPress={() => setBackupJob('export')} />
            <LinkRow label={t('backup.importTitle')} onPress={importBackup} />
          </>
        )}

        {page === 'about' && (
          <>
            <LinkRow
              label={t('settings.rate')}
              onPress={() =>
                rateApp()
                  .then((ok) => ok || dialog.alert(t('settings.rateUnavailable')))
                  .catch(() => dialog.alert(t('settings.rateUnavailable')))
              }
            />
            <LinkRow label={t('settings.privacyPolicy')} onPress={() => setLegal('privacy')} />
            <LinkRow label={t('settings.terms')} onPress={() => setLegal('terms')} />
            <Text style={styles.version} selectable>
              {t('settings.version', appVersion())}
            </Text>
          </>
        )}
      </ScrollView>
      <LegalScreen kind={legal} onClose={() => setLegal(null)} />
      <MemoryScreen visible={memoryVisible} onClose={() => setMemoryVisible(false)} />
      <SitePermissionsScreen
        visible={sitesVisible}
        store={sitePermissions}
        blockingEnabled={settings.blockAds}
        onClose={() => setSitesVisible(false)}
      />
      <FilterListsScreen
        visible={listsVisible}
        blockingEnabled={settings.blockAds}
        allowed={settings.blockAds && settings.legalAcceptedVersion > 0}
        onClose={() => setListsVisible(false)}
      />
      <ActionLogScreen visible={actionLogVisible} onClose={() => setActionLogVisible(false)} />
      <SentLogScreen visible={sentLogVisible} onClose={() => setSentLogVisible(false)} />
      <BackupScreen job={backupJob} appLock={settings.appLock} onClose={() => setBackupJob(null)} />
      <ClearDataScreen visible={clearDataVisible} onClear={onClearData} onClose={() => setClearDataVisible(false)} />
    </SafeAreaView>
  );
}

const speechService = () => t(Platform.OS === 'ios' ? 'voice.serviceApple' : 'voice.serviceGoogle');

/** How voice input runs on this phone for the app's language right now (on the device, or online). */
function VoiceModeLine({ online }: { online: Settings['voiceOnline'] }) {
  const styles = useStyles();
  const [mode, setMode] = useState<VoiceModeSummary | null>(null);
  useEffect(() => {
    let alive = true;
    voiceModeSummary(getLanguage(), online)
      .then((next) => alive && setMode(next))
      .catch(() => alive && setMode('unavailable'));
    return () => {
      alive = false;
    };
  }, [online]);
  return (
    <Text style={[styles.hint, styles.voiceMode]}>
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

function SwitchRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <ThemedSwitch value={value} onValueChange={onChange} accessibilityLabel={title} />
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={styles.option} accessibilityRole="button">
      <Text style={[styles.optionText, styles.link]}>{label} ›</Text>
    </Pressable>
  );
}

function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}): ReactNode {
  const styles = useStyles();
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segmentButton, value === o.value && styles.segmentSelected]}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === o.value }}
        >
          <Text style={[styles.segmentText, value === o.value && styles.segmentTextSelected]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
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
  content: { padding: 16, gap: 8 },
  card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden' },
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
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  sectionLabel: { fontSize: 13, color: c.textSecondary, textTransform: 'uppercase', marginTop: 24 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  voiceMode: { marginTop: 8 },
  link: { color: c.tintText, fontWeight: '600' },
  segment: { flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 10, padding: 3 },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentSelected: { backgroundColor: c.surface },
  segmentText: { fontSize: 14, color: c.textSecondary },
  segmentTextSelected: { color: c.text, fontWeight: '700' },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  optionText: { color: c.text, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  saveButton: {
    height: 46,
    borderRadius: 23,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonText: { color: c.onTint, fontSize: 16, fontWeight: '700' },
  version: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 28 },
}));
