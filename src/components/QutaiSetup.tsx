import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAccountState } from '../account';
import { creditsText, refreshCredits, useCreditsState } from '../credits';
import type { SetupEvent, SetupState } from '../credits/setupFlow';
import { t, type MessageKey } from '../i18n';
import { Icon, type IconName } from '../ui/Icon';
import { QutaiMark } from '../ui/QutaiMark';
import { makeStyles, usePalette } from '../ui/theme';
import { openBuyCredits } from './BuyCredits';
import { signedInWithText } from './accountLabels';
import { ErrorDetails } from './ErrorDetails';
import { SignInOptions } from './SignInOptions';

/** How far the system's larger text sizes grow the choice's headings and Qutai text; past it the step scrolls. */
const FIT = 1.4;

const NOTICE: Record<NonNullable<Extract<SetupState, { screen: 'choose' }>['notice']>, MessageKey> = {
  declined: 'setup.notice.declined',
  signInCancelled: 'setup.notice.signInCancelled',
  signInFailed: 'setup.notice.signInFailed',
  signedOut: 'setup.notice.signedOut',
};

/**
 * Setup's AI step in pro mode (the state machine is src/credits/setupFlow.ts; Onboarding owns the state, the footer
 * button and the back arrow). The choice is an accordion (`INTRO-28`): Qutai Credits, open at first, and "Use my own
 * AI provider key", whose section holds the same key fields as before; both headings show at first sight even on a
 * 360 x 640 dp phone with larger text. The choice can be left for later. Builds without pro mode never show this:
 * their AI step is the key fields alone, without accordion chrome.
 */
export function QutaiSetup({
  state,
  dispatch,
  toggle,
  onSkip,
  ownKeyFields,
  compact,
}: {
  state: SetupState;
  dispatch: (event: SetupEvent) => void;
  /** Opens one of the choice's two sections (`ownKey`, or `back` to Qutai Credits) in place, without a page change. */
  toggle: (event: Extract<SetupEvent, { type: 'ownKey' | 'back' }>) => void;
  /** "Decide later": on to the next step without choosing. */
  onSkip: () => void;
  /** The own key's provider and key fields, shown inside its open section. */
  ownKeyFields: ReactNode;
  /** A small screen (under 760 dp tall) or landscape: no lead, tighter headings, so both headings fit. */
  compact: boolean;
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
  // Signed in while the sign-in step shows, whichever way (a code, or the mail's link opened from another app).
  useEffect(() => {
    if (state.screen === 'signIn' && signedIn) dispatch({ type: 'signedIn' });
  }, [state.screen, signedIn, dispatch]);

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
                  : { type: 'signInFailed', message: r.message, details: r.details },
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
              <Text style={styles.cardTitle}>{user ? signedInWithText(user) : '–'}</Text>
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

  // The choice (also while the disclosure is open): an accordion of the two ways, both headings always on screen. Qutai
  // Credits is open at first; opening one closes the other. The own key's fields open inline (`ownKey` state).
  const notice = state.screen === 'choose' ? state.notice : undefined;
  const ownKeyOpen = state.screen === 'ownKey';
  return (
    <>
      <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header" maxFontSizeMultiplier={FIT}>
        {t('setup.title')}
      </Text>
      {!compact && (
        <Text style={styles.lead} maxFontSizeMultiplier={FIT}>
          {t('setup.lead')}
        </Text>
      )}
      {notice && (
        <View style={styles.notice} accessible accessibilityLiveRegion="polite">
          <Icon name="info" size={18} color={palette.textSecondary} />
          <Text style={styles.noticeText}>
            {t(NOTICE[notice])}
            {state.screen === 'choose' && state.detail ? ` ${state.detail}` : ''}
          </Text>
        </View>
      )}
      {state.screen === 'choose' && state.technical ? (
        <ErrorDetails details={state.technical} style={styles.noticeDetails} />
      ) : null}
      <View style={[styles.section, !ownKeyOpen && styles.sectionOpen]}>
        <Pressable
          onPress={() => ownKeyOpen && toggle({ type: 'back' })}
          style={({ pressed }) => [styles.heading, pressed && ownKeyOpen && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: !ownKeyOpen }}
        >
          <QutaiMark size={compact ? 28 : 32} />
          <View style={styles.flex}>
            <Text style={styles.mainTitle} maxFontSizeMultiplier={FIT}>
              {t('credits.provider')}
            </Text>
            <Text style={styles.badge} maxFontSizeMultiplier={FIT}>
              {t('setup.recommended')}
            </Text>
          </View>
          <Icon name={ownKeyOpen ? 'chevronDown' : 'chevronUp'} size={18} color={palette.textSecondary} />
        </Pressable>
        {!ownKeyOpen && (
          <View style={styles.panel}>
            <Text style={styles.body} maxFontSizeMultiplier={FIT}>
              {t('setup.qutaiBody')}
            </Text>
            <Point icon="person" text={t('setup.qutaiAccount')} />
            <Point icon="wallet" text={t('setup.qutaiCredits')} />
          </View>
        )}
      </View>

      <View style={[styles.section, ownKeyOpen && styles.sectionOpen]}>
        <Pressable
          onPress={() => !ownKeyOpen && toggle({ type: 'ownKey' })}
          style={({ pressed }) => [styles.heading, pressed && !ownKeyOpen && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: ownKeyOpen }}
        >
          <View style={[styles.keyIcon, compact && styles.keyIconCompact]}>
            <Icon name="key" size={18} color={palette.text} />
          </View>
          <Text style={[styles.cardTitle, styles.flex]} maxFontSizeMultiplier={FIT}>
            {t('setup.ownKey')}
          </Text>
          <Icon name={ownKeyOpen ? 'chevronUp' : 'chevronDown'} size={18} color={palette.textSecondary} />
        </Pressable>
        {ownKeyOpen && (
          <View style={styles.panel}>
            <Text style={styles.hint}>{t('setup.ownKeyBody')}</Text>
            {ownKeyFields}
          </View>
        )}
      </View>
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
      <Text style={[styles.pointText, styles.flex]} maxFontSizeMultiplier={FIT}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  title: { color: c.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.4, marginTop: 12 },
  titleCompact: { fontSize: 23, marginTop: 4 },
  lead: { color: c.textSecondary, fontSize: 16, lineHeight: 23 },
  hint: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
  warn: { color: c.danger },
  label: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mainTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
  badge: { color: c.tintText, fontSize: 13, fontWeight: '600' },
  body: { color: c.text, fontSize: 15, lineHeight: 21 },
  cardTitle: { color: c.text, fontSize: 16, fontWeight: '600' },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pointText: { color: c.text, fontSize: 14, lineHeight: 20 },
  section: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent' },
  sectionOpen: { borderColor: c.tint },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  panel: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  keyIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  keyIconCompact: { width: 28, height: 28 },
  textButton: { alignSelf: 'center', paddingVertical: 6 },
  link: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  notice: { flexDirection: 'row', gap: 10, backgroundColor: c.sunken, borderRadius: 12, padding: 12 },
  noticeText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
  noticeDetails: { marginLeft: 12, marginTop: -4 },
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
