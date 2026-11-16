import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAccountState } from '../account';
import { creditsText, refreshCredits, useCreditsState } from '../credits';
import type { SetupEvent, SetupState } from '../credits/setupFlow';
import { t, type MessageKey } from '../i18n';
import { Icon, type IconName } from '../ui/Icon';
import { QutaiMark } from '../ui/QutaiMark';
import { makeStyles, usePalette } from '../ui/theme';
import { openBuyCredits } from './BuyCredits';
import { SignInOptions } from './SignInOptions';

const PROVIDER_LABEL = {
  apple: 'account.providerApple',
  google: 'account.providerGoogle',
  test: 'account.providerTest',
} as const;

const NOTICE: Record<NonNullable<Extract<SetupState, { screen: 'choose' }>['notice']>, MessageKey> = {
  declined: 'setup.notice.declined',
  signInCancelled: 'setup.notice.signInCancelled',
  signInFailed: 'setup.notice.signInFailed',
  signedOut: 'setup.notice.signedOut',
};

/**
 * Setup's AI step in pro mode (the state machine is src/credits/setupFlow.ts; Onboarding owns the state, the footer
 * button and the back arrow). Qutai Credits leads as the main path, "use my own AI provider key" is a separate,
 * quieter path to the same key fields as before (`ownKey` is rendered by Onboarding), and the choice can be left for
 * later. Builds without pro mode never show this: their AI step is unchanged.
 */
export function QutaiSetup({
  state,
  dispatch,
  onSkip,
}: {
  state: SetupState;
  dispatch: (event: SetupEvent) => void;
  /** "Decide later": on to the next step without choosing. */
  onSkip: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const account = useAccountState();
  const credits = useCreditsState();
  const signedIn = account.status === 'signedIn';

  // Losing the account on the account screen (signed out elsewhere, session ended) goes back to the choice.
  useEffect(() => {
    if (state.screen === 'account' && account.status === 'signedOut') dispatch({ type: 'accountLost' });
  }, [state.screen, account.status, dispatch]);
  useEffect(() => {
    if (state.screen === 'account' && signedIn) refreshCredits();
  }, [state.screen, signedIn]);

  if (state.screen === 'signIn') {
    return (
      <>
        <Text style={styles.title} accessibilityRole="header">
          {t('setup.signInTitle')}
        </Text>
        <Text style={styles.lead}>{t('setup.signInLead')}</Text>
        <SignInOptions
          onResult={(r) =>
            dispatch(
              r.kind === 'signedIn'
                ? { type: 'signedIn' }
                : r.kind === 'cancelled'
                  ? { type: 'signInCancelled' }
                  : { type: 'signInFailed', message: r.message },
            )
          }
        />
        <Text style={styles.hint}>{t('account.introLocal')}</Text>
        <Pressable onPress={() => dispatch({ type: 'signInCancelled' })} style={styles.textButton} accessibilityRole="button" hitSlop={6}>
          <Text style={styles.link}>{t('setup.otherWay')}</Text>
        </Pressable>
      </>
    );
  }

  if (state.screen === 'account') {
    const user = account.status === 'signedIn' ? account.user : null;
    const providers = user?.providers.map((p) => t(PROVIDER_LABEL[p])).join(', ');
    return (
      <>
        <Text style={styles.title} accessibilityRole="header">
          {t('setup.accountTitle')}
        </Text>
        <Text style={styles.lead}>{t('setup.accountLead')}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Icon name="person" size={20} color={palette.tintText} />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{providers ? t('account.signedInWith', { providers }) : '–'}</Text>
              {user && (
                <Text style={styles.hint} selectable>
                  {t('account.id', { id: user.id })}
                </Text>
              )}
            </View>
          </View>
          {user?.providers.includes('test') && <Text style={[styles.hint, styles.warn]}>{t('account.test.signedIn')}</Text>}
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>{t('credits.balanceTitle')}</Text>
          <View style={styles.row}>
            <Text style={styles.balance} accessibilityLiveRegion="polite">
              {credits.balance === null ? '–' : t('credits.amount', { credits: creditsText(credits.balance) })}
            </Text>
            {credits.balance === null && <ActivityIndicator color={palette.textSecondary} />}
          </View>
          {credits.balance !== null && credits.balance <= 0 && <Text style={styles.hint}>{t('setup.noCredits')}</Text>}
          <Pressable
            onPress={openBuyCredits}
            style={({ pressed }) => [styles.buyButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Icon name="wallet" size={18} color={palette.tintText} />
            <Text style={styles.buyText}>{t('buy.open')}</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{t('setup.accountLater')}</Text>
      </>
    );
  }

  // The choice (also while the disclosure is open).
  const notice = state.screen === 'choose' ? state.notice : undefined;
  return (
    <>
      <Text style={styles.title} accessibilityRole="header">
        {t('setup.title')}
      </Text>
      <Text style={styles.lead}>{t('setup.lead')}</Text>
      {notice && (
        <View style={styles.notice} accessible accessibilityLiveRegion="polite">
          <Icon name="info" size={18} color={palette.textSecondary} />
          <Text style={styles.noticeText}>
            {t(NOTICE[notice])}
            {state.screen === 'choose' && state.detail ? ` ${state.detail}` : ''}
          </Text>
        </View>
      )}
      <View style={[styles.card, styles.main]}>
        <View style={styles.row}>
          <QutaiMark size={36} />
          <View style={styles.flex}>
            <Text style={styles.mainTitle}>{t('credits.provider')}</Text>
            <Text style={styles.badge}>{t('setup.recommended')}</Text>
          </View>
        </View>
        <Text style={styles.body}>{t('setup.qutaiBody')}</Text>
        <Point icon="person" text={t('setup.qutaiAccount')} />
        <Point icon="wallet" text={t('setup.qutaiCredits')} />
        <Point icon="globe" text={t('credits.fields.route')} />
      </View>

      <Text style={styles.or}>{t('setup.or')}</Text>
      <Pressable
        onPress={() => dispatch({ type: 'ownKey' })}
        style={({ pressed }) => [styles.card, styles.ownKey, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityHint={t('setup.ownKeyBody')}
      >
        <Icon name="key" size={20} color={palette.text} />
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{t('setup.ownKey')}</Text>
          <Text style={styles.hint}>{t('setup.ownKeyBody')}</Text>
        </View>
        <Icon name="chevronRight" size={18} color={palette.textSecondary} />
      </Pressable>
      <Pressable onPress={onSkip} style={styles.textButton} accessibilityRole="button" hitSlop={6}>
        <Text style={styles.link}>{t('setup.later')}</Text>
      </Pressable>
      <Text style={styles.hint}>{t('setup.laterHint')}</Text>
    </>
  );
}

function Point({ icon, text }: { icon: IconName; text: string }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={styles.point}>
      <Icon name={icon} size={18} color={palette.tintText} />
      <Text style={[styles.pointText, styles.flex]}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  title: { color: c.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.4, marginTop: 12 },
  lead: { color: c.textSecondary, fontSize: 16, lineHeight: 23 },
  hint: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
  warn: { color: c.danger },
  label: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 16, gap: 10 },
  main: { borderWidth: 1.5, borderColor: c.tint },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mainTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
  badge: { color: c.tintText, fontSize: 13, fontWeight: '600' },
  body: { color: c.text, fontSize: 15, lineHeight: 21 },
  cardTitle: { color: c.text, fontSize: 16, fontWeight: '600' },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pointText: { color: c.text, fontSize: 14, lineHeight: 20 },
  or: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginVertical: 2 },
  ownKey: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textButton: { alignSelf: 'center', paddingVertical: 6 },
  link: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  notice: { flexDirection: 'row', gap: 10, backgroundColor: c.sunken, borderRadius: 12, padding: 12 },
  noticeText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
  balance: { color: c.text, fontSize: 26, fontWeight: '700' },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: c.tint,
    marginTop: 4,
  },
  buyText: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.8 },
}));
