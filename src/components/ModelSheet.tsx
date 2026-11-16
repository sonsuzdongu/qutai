import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AiConfig, getProvider, isConfigured, modelLabel, PROVIDER_ORDER } from '../ai/providers';
import type { ProviderId } from '../ai/types';
import type { ModelChoice } from '../chat/Conversation';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { BottomSheet } from './BottomSheet';
import { ModelCatalogPicker, modelDetail, useCatalog } from './ModelCatalogPicker';
import { creditsChoiceName, currentTier, useCreditsState } from '../credits';
import { tierAbout, tierCostLine } from '../credits/tiers';
import { showTierDetails } from './CreditsFields';

type Props = {
  /** The conversation being changed; null: closed. */
  visible: boolean;
  settings: AiConfig & { provider: ProviderId };
  /** The conversation's choice (null: the default in Settings). */
  current: ModelChoice | null;
  onChoose: (choice: ModelChoice | null) => void;
  onOpenSettings: () => void;
  onClose: () => void;
};

/** The label under the panel's title: the conversation's choice when it can be used, otherwise the default. */
export function conversationModelInfo(
  settings: AiConfig & { provider: ProviderId },
  choice: ModelChoice | null,
): string {
  const use = choice && isConfigured(settings, choice.provider) ? choice : null;
  const provider = use?.provider ?? settings.provider;
  const model = use?.model ?? settings.models[provider];
  const line = `${getProvider(provider).label} · ${choiceLabel(provider, model)}`;
  return use ? `${line} · ${t('chat.modelThisChat')}` : line;
}

/** A provider's model by name; Qutai Credits: the tier the stored choice means now (or the model, without tiers). */
function choiceLabel(provider: ProviderId, model: string): string {
  return provider === 'qutai' ? creditsChoiceName(model) : modelLabel(provider, model);
}

/** Models offered for a provider: its own list plus the model set in Settings when it isn't on it. */
function modelsFor(settings: AiConfig, id: ProviderId): string[] {
  const provider = getProvider(id);
  const ids = provider.models.map((m) => m.id);
  // Qutai Credits: only what the server offers now.
  if (id === 'qutai') return ids;
  const configured = settings.models[id]?.trim();
  if (configured && !ids.includes(configured)) ids.push(configured);
  return ids;
}

/**
 * Provider and model for one conversation, from the providers that are set up. "Use my default" clears the choice;
 * the default in Settings never changes here. A switch applies to the next message (the history is rebuilt from text
 * and tool calls for the new model, as after any switch).
 */
export function ModelSheet({ visible, settings, current, onChoose, onOpenSettings, onClose }: Props) {
  const styles = useStyles();
  const catalog = useCatalog();
  // Qutai Credits' tiers come from the server's configuration: followed so the list fills in once it is read.
  const credits = useCreditsState();
  const [browsing, setBrowsing] = useState(false);
  const ready = PROVIDER_ORDER.filter((id) => isConfigured(settings, id));
  const selected = current && isConfigured(settings, current.provider) ? current : null;
  const choose = (choice: ModelChoice | null) => {
    onChoose(choice);
    onClose();
  };
  const defaultLine = `${getProvider(settings.provider).label} · ${choiceLabel(settings.provider, settings.models[settings.provider])}`;
  // A Qutai choice saved before tiers (a model) shows as the tier it maps to.
  const selectedModel =
    selected?.provider === 'qutai' ? (currentTier(selected.model)?.id ?? selected.model) : selected?.model;
  const tiers = !!credits.config?.tiers.length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      style={styles.sheet}
      contentStyle={styles.content}
      bottomPadding={16}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('modelSheet.title')}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{t('modelSheet.hint')}</Text>

      <Pressable
        style={styles.option}
        onPress={() => choose(null)}
        accessibilityRole="radio"
        accessibilityState={{ selected: !selected }}
      >
        <Radio selected={!selected} />
        <View style={styles.flex}>
          <Text style={styles.optionText}>{t('modelSheet.useDefault')}</Text>
          <Text style={styles.detail}>
            {isConfigured(settings, settings.provider) ? defaultLine : t('settings.noKeySummary')}
          </Text>
        </View>
      </Pressable>

      {ready.map((id) => {
        const provider = getProvider(id);
        return (
          <View key={id} style={styles.group}>
            <Text style={styles.label}>{provider.label}</Text>
            {modelsFor(settings, id).map((model) => {
              const on = selected?.provider === id && selectedModel === model;
              const tag = provider.models.find((m) => m.id === model)?.tag;
              const info = provider.catalog ? catalog?.models.find((m) => m.id === model) : undefined;
              const tier = id === 'qutai' && tiers ? credits.config!.tiers.find((x) => x.id === model) : undefined;
              const tierLines = tier ? [tierAbout(tier.id), tierCostLine(tier)].filter((x): x is string => !!x) : [];
              return (
                <Pressable
                  key={model}
                  style={styles.option}
                  onPress={() => choose({ provider: id, model })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Radio selected={on} />
                  <View style={styles.flex}>
                    <Text style={styles.optionText}>
                      {modelLabel(id, model)}
                      {tag ? ` (${t(`model.${tag}`)})` : ''}
                    </Text>
                    {info && <Text style={styles.detail}>{modelDetail(info)}</Text>}
                    {tierLines.map((line) => (
                      <Text key={line} style={styles.detail}>
                        {line}
                      </Text>
                    ))}
                  </View>
                </Pressable>
              );
            })}
            {id === 'qutai' && tiers && (
              <Pressable onPress={() => showTierDetails(credits.config!)} style={styles.browse} accessibilityRole="button">
                <Text style={styles.link}>{t('tier.details')}</Text>
              </Pressable>
            )}
            {/* A model from the catalogue that was chosen through the full list. */}
            {provider.catalog && selected?.provider === id && !modelsFor(settings, id).includes(selected.model) && (
              <View style={styles.option}>
                <Radio selected />
                <Text style={[styles.optionText, styles.flex]}>{modelLabel(id, selected.model)}</Text>
              </View>
            )}
            {provider.catalog && (
              <Pressable onPress={() => setBrowsing((b) => !b)} style={styles.browse} accessibilityRole="button">
                <Text style={styles.link}>{browsing ? t('settings.hideAllModels') : t('settings.allModels')}</Text>
              </Pressable>
            )}
            {provider.catalog && browsing && (
              <ModelCatalogPicker
                apiKey={settings.apiKeys[id]}
                selected={selected?.provider === id ? selected.model : ''}
                onSelect={(model) => choose({ provider: id, model })}
              />
            )}
          </View>
        );
      })}

      <Pressable
        onPress={() => {
          onClose();
          onOpenSettings();
        }}
        style={styles.browse}
        accessibilityRole="button"
      >
        <Text style={styles.link}>{t('modelSheet.moreProviders')}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { paddingTop: 14 },
  content: { paddingHorizontal: 20, gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: c.text },
  done: { fontSize: 16, fontWeight: '600', color: c.tintText },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  group: { gap: 2 },
  label: { color: c.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 12, textTransform: 'uppercase' },
  flex: { flex: 1 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  optionText: { color: c.text, fontSize: 15 },
  detail: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  browse: { paddingVertical: 10 },
  link: { color: c.tintText, fontWeight: '600', fontSize: 15 },
}));
