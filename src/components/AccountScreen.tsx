import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { accountErrorMessage, accountSession, isServerUnreachable, useAccountState } from '../account';
import { AccountApiError } from '../account/api';
import {
  appleSignInAvailable,
  googleSignInConfigured,
  SignInCancelled,
  signInWithApple,
  signInWithGoogle,
} from '../account/providers';
import { DEV_SIGN_IN_USERS, type AuthProvider, type DevSignInUser } from '../account/types';
import { creditsEnabled, devLoginEnabled, devLoginSecret } from '../config/features';
import { creditsText, refreshCredits, useCreditsState } from '../credits';
import { Icon } from '../ui/Icon';
import { t } from '../i18n';
import { darkPalette, makeStyles, usePalette } from '../ui/theme';
import { dialog } from './Dialog';

/**
 * Settings › Account (pro mode only; SettingsModal shows the row only when `accountsEnabled`).
 * Signed out: what the account is for and the sign-in buttons. Signed in: the account from `GET /me`, sign out,
 * sign out of all devices, delete account. Sign-in isn't part of onboarding.
 * Builds made against a local test server (`devLoginEnabled`) also show a test sign-in under the buttons, and
 * mark a test user's account as such.
 */
export function AccountScreen({ onOpenCredits }: { onOpenCredits?: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const state = useAccountState();
  const credits = useCreditsState();
  const session = accountSession();
  const [busy, setBusy] = useState<null | 'apple' | 'google' | DevSignInUser | 'signOut' | 'signOutAll' | 'delete'>(null);
  const [apple, setApple] = useState(false);
  /** A note under the account after `GET /me`: the server can't be reached, or the account is suspended. */
  const [notice, setNotice] = useState<string | null>(null);
  const google = googleSignInConfigured();
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
      if (!(e instanceof SignInCancelled)) dialog.alert(t('account.failedTitle'), accountErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const signIn = (provider: 'apple' | 'google') =>
    run(provider, async () => {
      if (provider === 'apple') await session.signInWithApple(await signInWithApple());
      else await session.signInWithGoogle(await signInWithGoogle());
      setNotice(null);
    });

  const signInAsTestUser = (user: DevSignInUser) =>
    run(user, async () => {
      if (!devLoginSecret) return;
      try {
        await session.signInAsTestUser(user, devLoginSecret);
      } catch (e) {
        // The server answers 404 when its test sign-in is off or the secret doesn't match.
        if (e instanceof AccountApiError && e.code === 'not_found') {
          dialog.alert(t('account.failedTitle'), t('account.test.notAvailable'));
          return;
        }
        throw e;
      }
      setNotice(null);
    });

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
        <Text style={styles.intro}>{t('account.intro')}</Text>
        <Text style={styles.hint}>{t('account.introLocal')}</Text>
        <View style={styles.buttons}>
          {apple && (
            <View style={busy && styles.dimmed} pointerEvents={busy ? 'none' : 'auto'}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={
                  palette === darkPalette
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={23}
                style={styles.appleButton}
                onPress={() => signIn('apple')}
              />
            </View>
          )}
          {google && (
            <Pressable
              onPress={() => signIn('google')}
              disabled={!!busy}
              style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.dimmed]}
              accessibilityRole="button"
            >
              {busy === 'google' ? (
                <ActivityIndicator color={palette.text} />
              ) : (
                <Text style={styles.buttonText}>{t('account.signInGoogle')}</Text>
              )}
            </Pressable>
          )}
          {busy === 'apple' && <ActivityIndicator color={palette.textSecondary} />}
          {!apple && !google && !devLoginEnabled && <Text style={styles.hint}>{t('account.noProviders')}</Text>}
        </View>
        {devLoginEnabled && (
          <View style={styles.testBox}>
            <Text style={styles.label}>{t('account.test.title')}</Text>
            <Text style={styles.hint}>{t('account.test.hint')}</Text>
            <View style={styles.testUsers}>
              {DEV_SIGN_IN_USERS.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => signInAsTestUser(u)}
                  disabled={!!busy}
                  style={({ pressed }) => [styles.button, styles.testUser, pressed && styles.pressed, busy && styles.dimmed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('account.test.signInAs', { user: u })}
                >
                  {busy === u ? (
                    <ActivityIndicator color={palette.text} />
                  ) : (
                    <Text style={styles.buttonText}>{u}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </>
    );
  }

  const { user } = state;
  const providers = user.providers.map((p) => t(PROVIDER_LABEL[p])).join(', ');
  const testUser = user.providers.includes('test');
  return (
    <>
      {user.status === 'suspended' && <Text style={[styles.notice, styles.noticeWarn]}>{t('account.suspended')}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}
      {testUser && <Text style={[styles.notice, styles.noticeWarn]}>{t('account.test.signedIn')}</Text>}
      <View style={styles.card}>
        <Text style={styles.label}>{t('account.signedInWith', { providers })}</Text>
        <Text style={styles.hint} selectable>
          {t('account.id', { id: user.id })}
        </Text>
      </View>
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

const PROVIDER_LABEL = {
  apple: 'account.providerApple',
  google: 'account.providerGoogle',
  test: 'account.providerTest',
} as const satisfies Record<AuthProvider, string>;

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
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  label: { color: c.text, fontSize: 15, fontWeight: '600' },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 4 },
  creditsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  notice: {
    fontSize: 14,
    lineHeight: 19,
    color: c.text,
    backgroundColor: c.sunken,
    borderRadius: 10,
    padding: 12,
  },
  noticeWarn: { color: c.danger },
  buttons: { gap: 10, marginTop: 12, marginBottom: 8 },
  appleButton: { height: 46, width: '100%' },
  button: {
    height: 46,
    borderRadius: 23,
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
  testBox: {
    gap: 6,
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.danger,
  },
  testUsers: { flexDirection: 'row', gap: 8, marginTop: 6 },
  testUser: { flex: 1 },
}));

