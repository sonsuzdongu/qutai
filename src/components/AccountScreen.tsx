import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { accountErrorDetails, accountErrorMessage, accountSession, isServerUnreachable, useAccountState } from '../account';
import { AccountApiError } from '../account/api';
import { appleSignInAvailable, SignInCancelled, signInWithApple } from '../account/providers';
import { creditsEnabled } from '../config/features';
import { creditsText, refreshCredits, useCreditsState } from '../credits';
import { Icon } from '../ui/Icon';
import { t } from '../i18n';
import { GroupItem, GroupLink, SettingsSection } from '../ui/SettingsRows';
import { makeStyles, usePalette, common } from '../ui/theme';
import { isPrivateRelayAddress } from '../account/methodRules';
import { AddMethods, CombineAccountsRow, MethodsList } from './AccountMethods';
import { methodsOf, signedInWithText } from './accountLabels';
import { dialog } from './Dialog';
import { SignInOptions } from './SignInOptions';

/**
 * Settings › Account (pro mode only; SettingsModal shows the row only when `accountsEnabled`).
 * Signed out: what the account is for and the sign-in buttons. Signed in (UI-56), top to bottom: who is signed in
 * (from `GET /me`), Qutai Credits and its balance, the ways to sign in, then the rarely used and destructive actions:
 * combine accounts, sign out, sign out of all devices, delete account. The sign-in buttons are SignInOptions (also in setup's Qutai step).
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
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="person" size={30} color={palette.tintText} />
          </View>
          <Text style={styles.heroTitle} accessibilityRole="header">
            {t('account.signInHeading')}
          </Text>
          <Text style={styles.heroText}>{t('account.intro')}</Text>
        </View>
        <SignInOptions />
        <Text style={[styles.hint, styles.privacyNote]}>{t('account.introLocal')}</Text>
      </>
    );
  }

  const { user } = state;
  const testUser = user.providers.includes('test');
  // The address the account is best known by: the first method that has one (Hide My Email shows as Apple's).
  const primary = methodsOf(user).find((m) => typeof m.email === 'string' && m.email.trim() && !isPrivateRelayAddress(m.email));
  const busyMark = (kind: NonNullable<typeof busy>) =>
    busy === kind ? <ActivityIndicator color={palette.textSecondary} /> : undefined;
  return (
    <>
      {user.status === 'suspended' && <Text style={[styles.notice, styles.noticeWarn]}>{t('account.suspended')}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}
      {testUser && <Text style={[styles.notice, styles.noticeWarn]}>{t('account.test.signedIn')}</Text>}
      {user.mergeSuggested && <Text style={styles.notice}>{t('account.merge.suggested')}</Text>}
      {/* Who is signed in, first (UI-56). */}
      <View style={[styles.card, styles.identity]}>
        <View style={styles.avatar}>
          <Icon name="person" size={26} color={palette.tintText} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.identityTitle} selectable>
            {primary?.email?.trim() ?? signedInWithText(user)}
          </Text>
          {primary && <Text style={styles.hint}>{signedInWithText(user)}</Text>}
          <Text style={styles.idText} selectable>
            {t('account.id', { id: user.id })}
          </Text>
        </View>
      </View>
      {creditsEnabled && onOpenCredits && (
        <SettingsSection>
          <GroupLink
            icon="wallet"
            title={t('credits.provider')}
            value={credits.balance === null ? undefined : t('credits.balance', { credits: creditsText(credits.balance) })}
            summary={credits.balance === null ? t('credits.balanceUnknown') : undefined}
            onPress={onOpenCredits}
          />
        </SettingsSection>
      )}
      <SettingsSection title={t('account.methodsTitle')}>
        <GroupItem>
          <MethodsList user={user} />
        </GroupItem>
        {user.status === 'active' && (
          <GroupItem>
            <AddMethods user={user} />
          </GroupItem>
        )}
      </SettingsSection>
      <Text style={[styles.hint, styles.privacyNote]}>{t('account.introLocal')}</Text>
      {/* The rarely used and the destructive, last. */}
      <SettingsSection footer={t('account.deleteHint')}>
        {user.status === 'active' && <CombineAccountsRow disabled={!!busy} />}
        <GroupLink
          icon="signOut"
          title={t('account.signOut')}
          chevron={false}
          disabled={!!busy}
          right={busyMark('signOut')}
          onPress={signOut}
        />
        <GroupLink
          icon="devices"
          title={t('account.signOutAll')}
          chevron={false}
          disabled={!!busy}
          right={busyMark('signOutAll')}
          onPress={signOutEverywhere}
        />
        <GroupLink
          icon="trash"
          title={t('account.delete')}
          danger
          disabled={!!busy}
          right={busyMark('delete')}
          onPress={deleteAccount}
        />
      </SettingsSection>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  loading: { marginTop: 24 },
  hint: common(c).hint,
  card: { ...common(c).card, padding: 14 },
  flex: { flex: 1 },
  notice: common(c).notice,
  noticeWarn: { color: c.danger },
  hero: { alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 4, paddingHorizontal: 8 },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.sunken,
    marginBottom: 4,
  },
  heroTitle: { ...common(c).title, fontSize: 20, textAlign: 'center' },
  heroText: { color: c.textSecondary, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  privacyNote: { marginTop: 14, marginHorizontal: 4 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.sunken,
  },
  identityTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
  idText: { ...common(c).hint, fontSize: 12, marginTop: 2 },
}));

