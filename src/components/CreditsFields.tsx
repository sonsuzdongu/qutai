import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAccountState } from '../account';
import { appVersion } from '../device/appVersion';
import {
  creditsStore,
  creditsText,
  refreshCredits,
  setCreditsConsent,
  useCreditsConsent,
  useCreditsState,
} from '../credits';
import { compareVersions } from '../credits/client';
import { offeredModels } from '../credits/rules';
import { usesTiers } from '../credits/tiers';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette, radii } from '../ui/theme';
import { openBuyCredits } from './BuyCredits';
import { askCreditsDisclosure } from './CreditsDisclosure';
import { dialog } from './Dialog';

/**
 * Settings › Assistant (and setup's AI step) with "Qutai Credits" picked: no key, the account pays. Shows whether it
 * can be used (signed in, the disclosure accepted), the balance and where the data goes. There is no model or tier
 * to choose (CRED-39): the server's default tier serves every request, and a line says so.
 */
export function CreditsFields({
  onSignIn,
}: {
  /** Opens Settings › Account (shown signed out). */
  onSignIn?: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const account = useAccountState();
  const consented = useCreditsConsent();
  const state = useCreditsState();
  const signedIn = account.status === 'signedIn';
  const usable = usesTiers(state.config) || offeredModels(state.config).length > 0;

  useEffect(() => {
    refreshCredits();
  }, [signedIn]);

  const tooOld = !!state.config?.minAppVersion && compareVersions(appVersion().version, state.config.minAppVersion) < 0;

  return (
    <View style={styles.root}>
      {!signedIn ? (
        <>
          <Text style={styles.notice}>{t('credits.fields.signIn')}</Text>
          {onSignIn && (
            <Pressable onPress={onSignIn} style={({ pressed }) => [styles.signIn, pressed && styles.pressed]} accessibilityRole="button">
              <Icon name="person" size={18} color={palette.tintText} />
              <Text style={styles.link}>{t('credits.signIn')}</Text>
            </Pressable>
          )}
        </>
      ) : (
        <View style={styles.balanceRow}>
          <Icon name="wallet" size={18} color={palette.textSecondary} />
          <Text style={styles.balance}>
            {state.balance === null ? t('credits.balanceUnknown') : t('credits.balance', { credits: creditsText(state.balance) })}
          </Text>
          <Pressable onPress={openBuyCredits} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{t('buy.open')}</Text>
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

      {!state.config && !state.configError && <ActivityIndicator style={styles.loading} />}
      {!state.config && state.configError && (
        <Pressable onPress={() => void creditsStore.config(0).catch(() => {})} accessibilityRole="button">
          <Text style={styles.notice}>
            {state.configError.message} <Text style={styles.link}>{t('credits.retry')}</Text>
          </Text>
        </Pressable>
      )}
      {state.config && !usable && <Text style={styles.notice}>{t('credits.noModels')}</Text>}
      {/* No model or tier to pick (CRED-39): the server chooses, and may change it without an app update. */}
      <Text style={styles.hint}>{t('credits.fields.model')}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { gap: 8, marginTop: 12 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  notice: { fontSize: 14, color: c.text, lineHeight: 20 },
  link: { color: c.tintText, fontWeight: '600', fontSize: 14 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balance: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' },
  loading: { alignSelf: 'flex-start', marginVertical: 8 },
  signIn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: c.tint,
  },
  pressed: { opacity: 0.8 },
}));
