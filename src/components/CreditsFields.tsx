import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAccountState } from '../account';
import { appVersion } from '../device/appVersion';
import { creditsModelName, creditsStore, creditsText, refreshCredits, setCreditsConsent, useCreditsConsent, useCreditsState } from '../credits';
import { compareVersions } from '../credits/client';
import { offeredModels } from '../credits/rules';
import type { AllowedModel } from '../credits/types';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { Radio } from '../ui/Radio';
import { makeStyles, usePalette } from '../ui/theme';
import { askCreditsDisclosure } from './CreditsDisclosure';
import { dialog } from './Dialog';

/** "Get credits": the purchase screen comes later; until then the app says so. */
export function showGetCredits() {
  dialog.alert(t('credits.get'), t('credits.getUnavailable'));
}

/** The base price of a model as "input / output credits per million tokens". */
function priceLine(m: AllowedModel): string | null {
  const base = m.prices.find((p) => p.aboveInputTokens === 0) ?? m.prices[0];
  if (!base) return null;
  return t('credits.modelPrice', { input: creditsText(base.inputPerMTok), output: creditsText(base.outputPerMTok) });
}

/**
 * Settings › Assistant (and setup's AI step) with "Qutai Credits" picked: no key, the account pays. Shows whether it
 * can be used (signed in, the disclosure accepted), the balance, where the data goes, and the models the server offers
 * with their credit price.
 */
export function CreditsFields({ model, onModel }: { model: string; onModel: (id: string) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const account = useAccountState();
  const consented = useCreditsConsent();
  const state = useCreditsState();
  const signedIn = account.status === 'signedIn';
  const models = offeredModels(state.config);

  useEffect(() => {
    refreshCredits();
  }, [signedIn]);

  // The model saved before isn't offered (any more): the first one the server offers is used.
  const selected = models.some((m) => m.model === model) ? model : (models[0]?.model ?? '');
  const tooOld = !!state.config?.minAppVersion && compareVersions(appVersion().version, state.config.minAppVersion) < 0;

  return (
    <View style={styles.root}>
      {!signedIn ? (
        <Text style={styles.notice}>{t('credits.fields.signIn')}</Text>
      ) : (
        <View style={styles.balanceRow}>
          <Icon name="wallet" size={18} color={palette.textSecondary} />
          <Text style={styles.balance}>
            {state.balance === null ? t('credits.balanceUnknown') : t('credits.balance', { credits: creditsText(state.balance) })}
          </Text>
          <Pressable onPress={showGetCredits} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{t('credits.get')}</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.hint}>{t('credits.fields.route')}</Text>
      {consented ? (
        <Pressable
          onPress={() =>
            dialog.alert(t('credits.fields.withdrawTitle'), t('credits.fields.withdrawBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('credits.fields.withdraw'), onPress: () => void setCreditsConsent(false) },
            ])
          }
          hitSlop={6}
          accessibilityRole="button"
        >
          <Text style={styles.link}>{t('credits.fields.withdraw')}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => void askCreditsDisclosure()} hitSlop={6} accessibilityRole="button">
          <Text style={styles.link}>{t('credits.fields.review')}</Text>
        </Pressable>
      )}

      {state.config?.maintenance.enabled && (
        <Text style={styles.notice}>
          {state.config.maintenance.message
            ? t('credits.error.maintenanceWith', { message: state.config.maintenance.message })
            : t('credits.error.maintenance')}
        </Text>
      )}
      {tooOld && <Text style={styles.notice}>{t('credits.error.upgrade')}</Text>}

      <Text style={styles.label}>{t('settings.model')}</Text>
      {!state.config && !state.configError && <ActivityIndicator style={styles.loading} />}
      {!state.config && state.configError && (
        <Pressable onPress={() => void creditsStore.config(0).catch(() => {})} accessibilityRole="button">
          <Text style={styles.notice}>
            {state.configError.message} <Text style={styles.link}>{t('credits.retry')}</Text>
          </Text>
        </Pressable>
      )}
      {state.config && models.length === 0 && <Text style={styles.notice}>{t('credits.noModels')}</Text>}
      {models.map((m) => {
        const price = priceLine(m);
        return (
          <Pressable
            key={m.model}
            style={styles.option}
            onPress={() => onModel(m.model)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === m.model }}
          >
            <Radio selected={selected === m.model} />
            <View style={styles.optionBody}>
              <Text style={styles.optionText}>{creditsModelName(m.model)}</Text>
              {price && <Text style={styles.detail}>{price}</Text>}
            </View>
          </Pressable>
        );
      })}
      {models.length > 0 && <Text style={styles.hint}>{t('credits.fields.priceHint')}</Text>}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { gap: 8, marginTop: 12 },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  notice: { fontSize: 14, color: c.text, lineHeight: 20 },
  link: { color: c.tintText, fontWeight: '600', fontSize: 14 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balance: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  optionText: { color: c.text, fontSize: 15 },
  optionBody: { flex: 1 },
  detail: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  loading: { alignSelf: 'flex-start', marginVertical: 8 },
}));
