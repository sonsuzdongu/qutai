import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProvider } from '../ai/providers';
import { SEARCH_ENGINE_ORDER, SEARCH_ENGINES } from '../browser/search';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import type { SitePermissionStore } from '../storage/sitePermissions';
import { ActionLogScreen } from './ActionLogScreen';
import { AiProviderFields, cleanAiChoice } from './AiProviderFields';
import { ClearDataScreen, ClearOptions } from './ClearDataScreen';
import { LegalScreen } from './LegalScreen';
import { rateApp } from '../device/rateApp';
import type { LegalKind } from '../legal/documents';
import { authenticate, canAuthenticate } from '../device/biometric';
import { MemoryScreen } from './MemoryScreen';
import { SitePermissionsScreen } from './SitePermissionsScreen';
import type { Settings } from '../storage/settings';

type Props = {
  visible: boolean;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
  sitePermissions: SitePermissionStore;
  onClearData: (options: ClearOptions) => Promise<void>;
};

export function SettingsModal({ visible, settings, onSave, onClose, sitePermissions, onClearData }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Mounted only while visible, so the draft always starts from the saved settings. */}
      {visible && (
        <SettingsForm
          settings={settings}
          onSave={onSave}
          onClose={onClose}
          sitePermissions={sitePermissions}
          onClearData={onClearData}
        />
      )}
    </Modal>
  );
}

function SettingsForm({ settings, onSave, onClose, sitePermissions, onClearData }: Omit<Props, 'visible'>) {
  const styles = useStyles();
  const [draft, setDraft] = useState(settings);
  const [memoryVisible, setMemoryVisible] = useState(false);
  const [sitesVisible, setSitesVisible] = useState(false);
  const [actionLogVisible, setActionLogVisible] = useState(false);
  const [clearDataVisible, setClearDataVisible] = useState(false);
  const [legal, setLegal] = useState<LegalKind | null>(null);

  /** Turning a lock on needs a phone with a screen lock, and the user proving it's them once. */
  const setLock = async (key: 'appLock' | 'incognitoLock', on: boolean) => {
    if (!on) return setDraft((d) => ({ ...d, [key]: false }));
    if (!(await canAuthenticate())) return Alert.alert(t('settings.lockUnavailable'));
    if (await authenticate(t('lock.confirmPrompt'))) setDraft((d) => ({ ...d, [key]: true }));
  };

  const save = () => onSave(cleanAiChoice(draft));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={styles.cancel}>{t('common.cancel')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <Pressable onPress={save} hitSlop={8}>
          <Text style={styles.save}>{t('common.save')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AiProviderFields
          value={draft}
          onChange={(ai) => setDraft((d) => ({ ...d, provider: ai.provider, apiKeys: ai.apiKeys, models: ai.models }))}
        />

        <Text style={[styles.label, styles.sectionLabel]}>{t('settings.search')}</Text>
        {SEARCH_ENGINE_ORDER.map((id) => (
          <Pressable key={id} style={styles.option} onPress={() => setDraft({ ...draft, searchEngine: id })}>
            <Text style={styles.radio}>{draft.searchEngine === id ? '◉' : '○'}</Text>
            <Text style={styles.optionText}>{SEARCH_ENGINES[id].name}</Text>
          </Pressable>
        ))}
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.searchSuggestions')}</Text>
            <Text style={styles.hint}>{t('settings.searchSuggestionsHint')}</Text>
          </View>
          <ThemedSwitch
            value={draft.searchSuggestions}
            onValueChange={(searchSuggestions) => setDraft({ ...draft, searchSuggestions })}
          />
        </View>

        <Text style={[styles.label, styles.sectionLabel]}>{t('settings.appearance')}</Text>
        <View style={styles.segment}>
          {(['system', 'light', 'dark'] as const).map((theme) => (
            <Pressable
              key={theme}
              onPress={() => setDraft({ ...draft, theme })}
              style={[styles.segmentButton, draft.theme === theme && styles.segmentSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.theme === theme }}
            >
              <Text style={[styles.segmentText, draft.theme === theme && styles.segmentTextSelected]}>
                {t(`settings.theme.${theme}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.darkSites')}</Text>
            <Text style={styles.hint}>{t('settings.darkSitesHint')}</Text>
          </View>
          <ThemedSwitch value={draft.darkSites} onValueChange={(darkSites) => setDraft({ ...draft, darkSites })} />
        </View>
        <Text style={styles.label}>{t('settings.addressBarPosition')}</Text>
        <View style={styles.segment}>
          {(['top', 'bottom'] as const).map((position) => (
            <Pressable
              key={position}
              onPress={() => setDraft({ ...draft, addressBarPosition: position })}
              style={[styles.segmentButton, draft.addressBarPosition === position && styles.segmentSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.addressBarPosition === position }}
            >
              <Text style={[styles.segmentText, draft.addressBarPosition === position && styles.segmentTextSelected]}>
                {t(`settings.addressBar.${position}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.haptics')}</Text>
            <Text style={styles.hint}>{t('settings.hapticsHint')}</Text>
          </View>
          <ThemedSwitch value={draft.haptics} onValueChange={(haptics) => setDraft({ ...draft, haptics })} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.forceZoom')}</Text>
            <Text style={styles.hint}>{t('settings.forceZoomHint')}</Text>
          </View>
          <ThemedSwitch value={draft.forceZoom} onValueChange={(forceZoom) => setDraft({ ...draft, forceZoom })} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.showAssistantButton')}</Text>
            <Text style={styles.hint}>{t('settings.showAssistantButtonHint')}</Text>
          </View>
          <ThemedSwitch
            value={draft.showAssistantButton}
            onValueChange={(showAssistantButton) => setDraft({ ...draft, showAssistantButton })}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.animateLogo')}</Text>
            <Text style={styles.hint}>{t('settings.animateLogoHint')}</Text>
          </View>
          <ThemedSwitch
            value={draft.animateLogo}
            onValueChange={(animateLogo) => setDraft({ ...draft, animateLogo })}
          />
        </View>

        <Text style={[styles.label, styles.sectionLabel]}>{t('settings.content')}</Text>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.blockAds')}</Text>
            <Text style={styles.hint}>{t('settings.blockAdsHint')}</Text>
          </View>
          <ThemedSwitch value={draft.blockAds} onValueChange={(blockAds) => setDraft({ ...draft, blockAds })} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.hideCookieBanners')}</Text>
            <Text style={styles.hint}>{t('settings.hideCookieBannersHint')}</Text>
          </View>
          <ThemedSwitch
            value={draft.hideCookieBanners}
            onValueChange={(hideCookieBanners) => setDraft({ ...draft, hideCookieBanners })}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.httpsOnly')}</Text>
            <Text style={styles.hint}>{t('settings.httpsOnlyHint')}</Text>
          </View>
          <ThemedSwitch value={draft.httpsOnly} onValueChange={(httpsOnly) => setDraft({ ...draft, httpsOnly })} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.thirdPartyCookies')}</Text>
            <Text style={styles.hint}>{t('settings.thirdPartyCookiesHint')}</Text>
          </View>
          <ThemedSwitch
            value={draft.blockThirdPartyCookies}
            onValueChange={(blockThirdPartyCookies) => setDraft({ ...draft, blockThirdPartyCookies })}
          />
        </View>
        <Pressable onPress={() => setClearDataVisible(true)} style={styles.option} accessibilityRole="button">
          <Text style={[styles.optionText, styles.link]}>{t('settings.clearData')} ›</Text>
        </Pressable>

        <Text style={[styles.label, styles.sectionLabel]}>{t('settings.security')}</Text>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.appLock')}</Text>
            <Text style={styles.hint}>{t('settings.appLockHint')}</Text>
          </View>
          <ThemedSwitch value={draft.appLock} onValueChange={(on) => setLock('appLock', on)} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.incognitoLock')}</Text>
            <Text style={styles.hint}>{t('settings.incognitoLockHint')}</Text>
          </View>
          <ThemedSwitch value={draft.incognitoLock} onValueChange={(on) => setLock('incognitoLock', on)} />
        </View>

        <Text style={[styles.label, styles.sectionLabel]}>{t('settings.assistant')}</Text>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.confirmActions')}</Text>
            <Text style={styles.hint}>{t('settings.confirmActionsHint')}</Text>
          </View>
          <ThemedSwitch
            value={draft.confirmActions}
            onValueChange={(confirmActions) => setDraft({ ...draft, confirmActions })}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.webSearch')}</Text>
            <Text style={styles.hint}>
              {t('settings.webSearchHint', { provider: getProvider(draft.provider).label })}
            </Text>
          </View>
          <ThemedSwitch value={draft.webSearch} onValueChange={(webSearch) => setDraft({ ...draft, webSearch })} />
        </View>

        <Pressable onPress={() => setSitesVisible(true)} style={styles.option} accessibilityRole="button">
          <Text style={[styles.optionText, styles.link]}>{t('settings.sitePermissions')} ›</Text>
        </Pressable>
        <Pressable onPress={() => setActionLogVisible(true)} style={styles.option} accessibilityRole="button">
          <Text style={[styles.optionText, styles.link]}>{t('settings.actionLog')} ›</Text>
        </Pressable>

        <Text style={[styles.label, styles.sectionLabel]}>{t('settings.memory')}</Text>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.memoryEnabled')}</Text>
            <Text style={styles.hint}>{t('settings.memoryHint')}</Text>
          </View>
          <ThemedSwitch
            value={draft.memoryEnabled}
            onValueChange={(memoryEnabled) => setDraft({ ...draft, memoryEnabled })}
          />
        </View>
        <Pressable onPress={() => setMemoryVisible(true)} style={styles.option} accessibilityRole="button">
          <Text style={[styles.optionText, styles.link]}>{t('settings.manageMemory')} ›</Text>
        </Pressable>

        <Text style={[styles.label, styles.sectionLabel]}>{t('settings.about')}</Text>
        <Pressable
          onPress={() =>
            rateApp()
              .then((ok) => ok || Alert.alert(t('settings.rateUnavailable')))
              .catch(() => Alert.alert(t('settings.rateUnavailable')))
          }
          style={styles.option}
          accessibilityRole="button"
        >
          <Text style={[styles.optionText, styles.link]}>{t('settings.rate')} ›</Text>
        </Pressable>
        <Pressable onPress={() => setLegal('privacy')} style={styles.option} accessibilityRole="button">
          <Text style={[styles.optionText, styles.link]}>{t('settings.privacyPolicy')} ›</Text>
        </Pressable>
        <Pressable onPress={() => setLegal('terms')} style={styles.option} accessibilityRole="button">
          <Text style={[styles.optionText, styles.link]}>{t('settings.terms')} ›</Text>
        </Pressable>
      </ScrollView>
      <LegalScreen kind={legal} onClose={() => setLegal(null)} />
      <MemoryScreen visible={memoryVisible} onClose={() => setMemoryVisible(false)} />
      <SitePermissionsScreen visible={sitesVisible} store={sitePermissions} onClose={() => setSitesVisible(false)} />
      <ActionLogScreen visible={actionLogVisible} onClose={() => setActionLogVisible(false)} />
      <ClearDataScreen visible={clearDataVisible} onClear={onClearData} onClose={() => setClearDataVisible(false)} />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  cancel: { fontSize: 16, color: c.textSecondary },
  save: { fontSize: 16, color: c.tintText, fontWeight: '600' },
  content: { padding: 16, gap: 8 },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  sectionLabel: { fontSize: 13, color: c.textSecondary, textTransform: 'uppercase', marginTop: 24 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
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
  keyDot: { fontSize: 8, color: '#3a9b5c' },
  input: {
    color: c.text,
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  radio: { fontSize: 18, color: c.tintText },
  optionText: { color: c.text, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
}));
