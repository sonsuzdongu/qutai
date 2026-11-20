import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { accountErrorDetails, accountErrorMessage, accountSession, isServerUnreachable, useAccountState } from '../account';
import { AccountApiError } from '../account/api';
import { appleSignInAvailable, SignInCancelled, signInWithApple } from '../account/providers';
import { creditsEnabled } from '../config/features';
import { creditsText, refreshCredits, useCreditsState } from '../credits';
import { Icon } from '../ui/Icon';
import { t } from '../i18n';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
import { AddMethods, MethodsList } from './AccountMethods';
import { signedInWithText } from './accountLabels';
import { dialog } from './Dialog';
import { SignInOptions } from './SignInOptions';

/**
 * Settings › Account (pro mode only; SettingsModal shows the row only when `accountsEnabled`).
 * Signed out: what the account is for and the sign-in buttons. Signed in: the account from `GET /me`, sign out,
 * sign out of all devices, delete account. The sign-in buttons are SignInOptions (also in setup's Qutai step).
 * Builds made against a local test server (`devLoginEnabled`) also show a test sign-in under the buttons, and
 * mark a test user's account as such.
 */
export function AccountScreen({
  onOpenCredits,
  usesCredits = false,
}: {
  onOpenCredits?: () => void;
  /** Qutai Credits is the provider in Settings: signed out, the page says it needs the account. */
  usesCredits?: boolean;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const state = useAccountState();
  const credits = useCreditsState();
  const session = accountSession();
  const [busy, setBusy] = useState<null | 'signOut' | 'signOutAll' | 'delete'>(null);
  const [apple, setApple] = useState(false);
  /** A note under the account after `GET /me`: the server can't be reached, or the account is suspended. */
  const [notice, setNotice] = useState<string | null>(null);
  const signedIn = state.status === 'signedIn';

  useEffect(() => {
    appleSignInAvailable().then(setApple);
  }, []);

  // Fresh account details (and the credit balance) each time the page opens while signed in.
  useEffect(() => {
    if (!signedIn || !session) return;
    refreshCredits();
    let live = true;
    session
      .refreshUser()
      .then(() => live && setNotice(null))
      .catch((e) => {
        if (!live) return;
        if (isServerUnreachable(e)) setNotice(t('account.unreachableSignedIn'));
        else if (!(e instanceof AccountApiError && (e.code === 'account_suspended' || e.code === 'unauthorized'))) {
          setNotice(accountErrorMessage(e));
        }
      });
    return () => {
      live = false;
    };
  }, [signedIn, session]);

  if (!session) return null;

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await action();
    } catch (e) {
      if (!(e instanceof SignInCancelled)) {
        dialog.alert(t('account.failedTitle'), accountErrorMessage(e), undefined, accountErrorDetails(e));
      }
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    const ok = await dialog.confirm({
      title: t('account.signOutTitle'),
      message: t('account.signOutBody'),
      confirmText: t('account.signOut'),
    });
    if (ok) run('signOut', () => session.signOut());
  };

  const signOutEverywhere = async () => {
    const ok = await dialog.confirm({
      title: t('account.signOutAllTitle'),
      message: t('account.signOutAllBody'),
      confirmText: t('account.signOutAll'),
    });
    if (ok) run('signOutAll', () => session.signOutEverywhere());
  };

  const deleteAccount = async () => {
    const ok = await dialog.confirm({
      title: t('account.deleteTitle'),
      message: t('account.deleteBody'),
      confirmText: t('account.deleteConfirm'),
      destructive: true,
    });
    if (!ok) return;
    run('delete', async () => {
      // Apple asks apps to revoke its authorization on deletion; a fresh code from signing in with Apple again
      // lets the server do that even if its stored token is gone. It also confirms it's really the user.
      let appleCode: string | undefined;
      if (state.status === 'signedIn' && state.user.providers.includes('apple') && apple) {
        appleCode = (await signInWithApple()).authorizationCode;
      }
      await session.deleteAccount(appleCode);
      dialog.alert(t('account.deletedTitle'), t('account.deletedBody'));
    });
  };

  if (state.status === 'loading') {
    return <ActivityIndicator style={styles.loading} color={palette.textSecondary} />;
  }

  if (state.status === 'signedOut') {
    return (
      <>
        {state.reason === 'expired' && <Text style={[styles.notice, styles.noticeWarn]}>{t('account.expired')}</Text>}
        {creditsEnabled && usesCredits && <Text style={styles.notice}>{t('credits.signedOutNotice')}</Text>}
        <Text style={styles.intro}>{t('account.intro')}</Text>
        <Text style={styles.hint}>{t('account.introLocal')}</Text>
        <SignInOptions />
      </>
    );
  }

  const { user } = state;
  const testUser = user.providers.includes('test');
  return (
    <>
      {user.status === 'suspended' && <Text style={[styles.notice, styles.noticeWarn]}>{t('account.suspended')}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}
      {testUser && <Text style={[styles.notice, styles.noticeWarn]}>{t('account.test.signedIn')}</Text>}
      <View style={styles.card}>
        <Text style={styles.label}>{signedInWithText(user)}</Text>
        <MethodsList user={user} />
        <Text style={styles.hint} selectable>
          {t('account.id', { id: user.id })}
        </Text>
      </View>
      {user.status === 'active' && <AddMethods user={user} />}
      {creditsEnabled && onOpenCredits && (
        <Pressable
          onPress={onOpenCredits}
          style={({ pressed }) => [styles.card, styles.creditsRow, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Icon name="wallet" size={20} color={palette.tintText} />
          <View style={styles.flex}>
            <Text style={styles.label}>{t('credits.provider')}</Text>
            <Text style={styles.hint}>
              {credits.balance === null ? t('credits.balanceUnknown') : t('credits.balance', { credits: creditsText(credits.balance) })}
            </Text>
          </View>
          <Icon name="chevronRight" size={18} color={palette.textSecondary} />
        </Pressable>
      )}
      <Text style={styles.hint}>{t('account.introLocal')}</Text>
      <View style={styles.buttons}>
        <ActionButton label={t('account.signOut')} busy={busy === 'signOut'} disabled={!!busy} onPress={signOut} />
        <ActionButton
          label={t('account.signOutAll')}
          busy={busy === 'signOutAll'}
          disabled={!!busy}
          onPress={signOutEverywhere}
        />
        <ActionButton
          label={t('account.delete')}
          busy={busy === 'delete'}
          disabled={!!busy}
          danger
          onPress={deleteAccount}
        />
      </View>
      <Text style={styles.hint}>{t('account.deleteHint')}</Text>
    </>
  );
}

function ActionButton({
  label,
  busy,
  disabled,
  danger,
  onPress,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && !busy && styles.dimmed]}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
    >
      {busy ? (
        <ActivityIndicator color={danger ? palette.danger : palette.text} />
      ) : (
        <Text style={[styles.buttonText, danger && styles.danger]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  loading: { marginTop: 24 },
  intro: { color: c.text, fontSize: 15, lineHeight: 21 },
  hint: common(c).hint,
  label: { color: c.text, fontSize: 15, fontWeight: '600' },
  card: { ...common(c).card, padding: 14, gap: 4 },
  methods: { gap: 4, marginTop: 4, marginBottom: 2 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodText: { color: c.text, fontSize: 14, lineHeight: 19 },
  creditsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  notice: common(c).notice,
  noticeWarn: { color: c.danger },
  buttons: { gap: 10, marginTop: 12, marginBottom: 8 },
  button: {
    minHeight: 46,
    paddingVertical: 8,
    borderRadius: radii.button,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: c.text, fontSize: 16, fontWeight: '600' },
  danger: { color: c.danger },
  pressed: { backgroundColor: c.pressed },
  dimmed: { opacity: 0.5 },
}));

