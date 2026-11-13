import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProvider, PROVIDER_ORDER } from '../ai/providers';
import type { ProviderId } from '../ai/types';
import { SEARCH_ENGINE_ORDER, SEARCH_ENGINES } from '../browser/search';
import { t } from '../i18n';
import type { SitePermissionStore } from '../storage/sitePermissions';
import { ActionLogScreen } from './ActionLogScreen';
import { MemoryScreen } from './MemoryScreen';
import { SitePermissionsScreen } from './SitePermissionsScreen';
import type { Settings } from '../storage/settings';

type Props = {
  visible: boolean;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
  sitePermissions: SitePermissionStore;
};

export function SettingsModal({ visible, settings, onSave, onClose, sitePermissions }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Mounted only while visible, so the draft always starts from the saved settings. */}
      {visible && (
        <SettingsForm settings={settings} onSave={onSave} onClose={onClose} sitePermissions={sitePermissions} />
      )}
    </Modal>
  );
}

function SettingsForm({ settings, onSave, onClose, sitePermissions }: Omit<Props, 'visible'>) {
  const [draft, setDraft] = useState(settings);
  const [memoryVisible, setMemoryVisible] = useState(false);
  const [sitesVisible, setSitesVisible] = useState(false);
  const [actionLogVisible, setActionLogVisible] = useState(false);
  const provider = getProvider(draft.provider);
  const model = draft.models[draft.provider];
  const isCustomModel = !provider.models.some((m) => m.id === model);

  const setApiKey = (value: string) => setDraft({ ...draft, apiKeys: { ...draft.apiKeys, [draft.provider]: value } });
  const setModel = (value: string) => setDraft({ ...draft, models: { ...draft.models, [draft.provider]: value } });

  const save = () => {
    const apiKeys = { ...draft.apiKeys };
    const models = { ...draft.models };
    PROVIDER_ORDER.forEach((id) => {
      apiKeys[id] = apiKeys[id].trim();
      models[id] = models[id].trim() || getProvider(id).defaultModel;
    });
    onSave({ ...draft, apiKeys, models });
  };

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
        <Text style={styles.label}>{t('settings.provider')}</Text>
        <View style={styles.segment}>
          {PROVIDER_ORDER.map((id: ProviderId) => {
            const selected = id === draft.provider;
            return (
              <Pressable
                key={id}
                onPress={() => setDraft({ ...draft, provider: id })}
                style={[styles.segmentButton, selected && styles.segmentSelected]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {getProvider(id).label.replace('Google ', '')}
                </Text>
                {!!draft.apiKeys[id] && <Text style={styles.keyDot}>●</Text>}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t('settings.apiKey', { provider: provider.label })}</Text>
        <TextInput
          key={draft.provider}
          style={styles.input}
          value={draft.apiKeys[draft.provider]}
          onChangeText={setApiKey}
          placeholder={provider.keyPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={styles.hint}>
          {t('settings.keyHint')}{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(provider.keyUrl)}>
            {t('settings.getKey')}
          </Text>
        </Text>

        <Text style={styles.label}>{t('settings.model')}</Text>
        {provider.models.map((m) => (
          <Pressable key={m.id} style={styles.option} onPress={() => setModel(m.id)}>
            <Text style={styles.radio}>{model === m.id ? '◉' : '○'}</Text>
            <Text style={styles.optionText}>{m.tag ? `${m.name} (${t(`model.${m.tag}`)})` : m.name}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.option} onPress={() => !isCustomModel && setModel('')}>
          <Text style={styles.radio}>{isCustomModel ? '◉' : '○'}</Text>
          <Text style={styles.optionText}>{t('settings.customModel')}</Text>
        </Pressable>
        {isCustomModel && (
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder={t('settings.customModelPlaceholder', { model: provider.defaultModel })}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        )}
        <Text style={styles.hint}>{t('settings.modelHint')}</Text>

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
          <Switch
            value={draft.searchSuggestions}
            onValueChange={(searchSuggestions) => setDraft({ ...draft, searchSuggestions })}
          />
        </View>

        <Text style={[styles.label, styles.sectionLabel]}>{t('settings.content')}</Text>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.blockAds')}</Text>
            <Text style={styles.hint}>{t('settings.blockAdsHint')}</Text>
          </View>
          <Switch value={draft.blockAds} onValueChange={(blockAds) => setDraft({ ...draft, blockAds })} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.hideCookieBanners')}</Text>
            <Text style={styles.hint}>{t('settings.hideCookieBannersHint')}</Text>
          </View>
          <Switch
            value={draft.hideCookieBanners}
            onValueChange={(hideCookieBanners) => setDraft({ ...draft, hideCookieBanners })}
          />
        </View>

        <Text style={[styles.label, styles.sectionLabel]}>{t('settings.assistant')}</Text>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.confirmActions')}</Text>
            <Text style={styles.hint}>{t('settings.confirmActionsHint')}</Text>
          </View>
          <Switch
            value={draft.confirmActions}
            onValueChange={(confirmActions) => setDraft({ ...draft, confirmActions })}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('settings.webSearch')}</Text>
            <Text style={styles.hint}>{t('settings.webSearchHint', { provider: provider.label })}</Text>
          </View>
          <Switch value={draft.webSearch} onValueChange={(webSearch) => setDraft({ ...draft, webSearch })} />
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
          <Switch
            value={draft.memoryEnabled}
            onValueChange={(memoryEnabled) => setDraft({ ...draft, memoryEnabled })}
          />
        </View>
        <Pressable onPress={() => setMemoryVisible(true)} style={styles.option} accessibilityRole="button">
          <Text style={[styles.optionText, styles.link]}>{t('settings.manageMemory')} ›</Text>
        </Pressable>
      </ScrollView>
      <MemoryScreen visible={memoryVisible} onClose={() => setMemoryVisible(false)} />
      <SitePermissionsScreen visible={sitesVisible} store={sitePermissions} onClose={() => setSitesVisible(false)} />
      <ActionLogScreen visible={actionLogVisible} onClose={() => setActionLogVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f5' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d6d3c9',
  },
  title: { fontSize: 17, fontWeight: '600' },
  cancel: { fontSize: 16, color: '#666' },
  save: { fontSize: 16, color: '#c96442', fontWeight: '600' },
  content: { padding: 16, gap: 8 },
  label: { fontSize: 15, fontWeight: '600', marginTop: 12 },
  sectionLabel: { fontSize: 13, color: '#888', textTransform: 'uppercase', marginTop: 24 },
  hint: { fontSize: 13, color: '#888', lineHeight: 18 },
  link: { color: '#c96442', fontWeight: '600' },
  segment: { flexDirection: 'row', backgroundColor: '#e8e6df', borderRadius: 10, padding: 3 },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentSelected: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14, color: '#555' },
  segmentTextSelected: { color: '#222', fontWeight: '700' },
  keyDot: { fontSize: 8, color: '#3a9b5c' },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d6d3c9',
    fontSize: 15,
  },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  radio: { fontSize: 18, color: '#c96442' },
  optionText: { fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
});
