import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, Text, View } from 'react-native';
import { accountErrorDetails, accountErrorMessage, accountSession, emailSignIn } from '../account';
import { AccountApiError } from '../account/api';
import {
  appleSignInAvailable,
  appleWebAuthorize,
  googleSignInConfigured,
  SignInCancelled,
  signInWithApple,
  signInWithGoogle,
} from '../account/providers';
import { creditsStore } from '../credits';
import { DEV_SIGN_IN_USERS, type DevSignInUser } from '../account/types';
import { devLoginEnabled, devLoginSecret } from '../config/features';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { darkPalette, googleButton, makeStyles, usePalette, radii, common } from '../ui/theme';
import { dialog } from './Dialog';
import { EmailSignIn } from './EmailSignIn';
import { WholeWordsText } from './WholeWordsText';

/** Google's "G" mark, as Google publishes it for its sign-in button (assets/google-g*.png, 20 pt). */
const GOOGLE_G = require('../../assets/google-g.png');

export type SignInResult =
  | { kind: 'signedIn' }
  | { kind: 'cancelled' }
  /** `details`: the technical line for "Details" (account/errorDetails.ts). */
  | { kind: 'failed'; message: string; details?: string };

/**
 * The sign-in buttons (pro mode): Apple where the phone offers it, Google when this build has its client id,
 * "Continue with email" (EmailSignIn: a code and a link by mail; it opens by itself while a code is waiting), and the
 * test sign-in in builds made for a local test server. Only what works is shown; with none, a sentence says sign-in
 * isn't set up in this build. Used by Settings › Account and setup's Qutai step.
 *
 * `onResult` gets every ending (setup goes back to its choice on a cancel or a failure); without it a failure shows a
 * dialog and a cancel does nothing, as in Settings.
 */
export function SignInOptions({ onResult }: { onResult?: (result: SignInResult) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const session = accountSession();
  const [busy, setBusy] = useState<null | 'apple' | 'google' | DevSignInUser>(null);
  const [apple, setApple] = useState(false);
  /** Android: Sign in with Apple through Apple's web flow, when the server offers it (`GET /config` › auth.appleWeb). */
  const [appleWeb, setAppleWeb] = useState(false);
  const google = googleSignInConfigured();
  const googleColors = palette === darkPalette ? googleButton.dark : googleButton.light;
  const flow = emailSignIn();
  const [email, setEmail] = useState(() => flow?.getState().status === 'pending');

  useEffect(() => {
    let live = true;
    appleSignInAvailable().then((ok) => live && setApple(ok));
    if (Platform.OS === 'android') {
      creditsStore
        .config()
        .then((config) => live && setAppleWeb(config.auth?.appleWeb === true))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, []);

  // A code still waiting (the app was closed while the user read the mail): straight back to it.
  useEffect(() => {
    if (!flow) return;
    let live = true;
    flow.load().then(() => live && flow.getState().status === 'pending' && setEmail(true));
    return () => {
      live = false;
    };
  }, [flow]);

  if (!session) return null;

  if (email) {
    return <EmailSignIn onSignedIn={() => onResult?.({ kind: 'signedIn' })} onBack={() => setEmail(false)} />;
  }

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    let result: SignInResult = { kind: 'signedIn' };
    try {
      await action();
    } catch (e) {
      result =
        e instanceof SignInCancelled
          ? { kind: 'cancelled' }
          : { kind: 'failed', message: messageFor(e), details: accountErrorDetails(e) };
    } finally {
      setBusy(null);
    }
    if (onResult) onResult(result);
    else if (result.kind === 'failed') dialog.alert(t('account.failedTitle'), result.message, undefined, result.details);
  };

  const signIn = (provider: 'apple' | 'google') =>
    run(provider, async () => {
      if (provider === 'apple' && Platform.OS !== 'ios') {
        await session.signInWithAppleWeb(await appleWebAuthorize((hash) => session.startAppleWeb(hash)));
      } else if (provider === 'apple') await session.signInWithApple(await signInWithApple());
      else await session.signInWithGoogle(await signInWithGoogle());
    });

  const signInAsTestUser = (user: DevSignInUser) =>
    run(user, async () => {
      if (!devLoginSecret) return;
      await session.signInAsTestUser(user, devLoginSecret);
    });

  return (
    <>
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
              cornerRadius={radii.button}
              style={styles.appleButton}
              onPress={() => signIn('apple')}
            />
          </View>
        )}
        {appleWeb && (
          <Pressable
            onPress={() => signIn('apple')}
            disabled={!!busy}
            style={({ pressed }) => [styles.button, styles.appleWeb, pressed && styles.pressed, busy && styles.dimmed]}
            accessibilityRole="button"
            accessibilityState={{ busy: busy === 'apple', disabled: !!busy }}
          >
            {busy === 'apple' ? (
              <ActivityIndicator color={palette.bg} />
            ) : (
              <Text style={[styles.buttonText, styles.appleWebText]}>{t('account.signInApple')}</Text>
            )}
          </Pressable>
        )}
        {google && (
          // Google's own button (branding guidelines): the "G" mark on the left, "Sign in with Google" in Google's
          // wording for each language, its light or dark colours with their outline (UI-56).
          <Pressable
            onPress={() => signIn('google')}
            disabled={!!busy}
            style={({ pressed }) => [
              styles.button,
              styles.googleButton,
              { backgroundColor: googleColors.fill, borderColor: googleColors.stroke },
              pressed && styles.googlePressed,
              busy && styles.dimmed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('account.signInGoogle')}
            accessibilityState={{ busy: busy === 'google', disabled: !!busy }}
          >
            {busy === 'google' ? (
              <ActivityIndicator color={googleColors.text} />
            ) : (
              <>
                <Image source={GOOGLE_G} style={styles.googleMark} accessible={false} />
                <WholeWordsText style={[styles.googleText, { color: googleColors.text }]}>{t('account.signInGoogle')}</WholeWordsText>
              </>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={() => setEmail(true)}
          disabled={!!busy}
          style={({ pressed }) => [styles.button, styles.iconButton, pressed && styles.pressed, busy && styles.dimmed]}
          accessibilityRole="button"
          accessibilityHint={t('account.email.buttonHint')}
          accessibilityState={{ disabled: !!busy }}
        >
          <Icon name="email" size={20} color={palette.text} />
          <WholeWordsText style={[styles.buttonText, styles.shrink]}>{t('account.email.continue')}</WholeWordsText>
        </Pressable>
        {busy === 'apple' && <ActivityIndicator color={palette.textSecondary} />}
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
                accessibilityState={{ busy: busy === u, disabled: !!busy }}
              >
                {busy === u ? <ActivityIndicator color={palette.text} /> : <Text style={styles.buttonText}>{u}</Text>}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

/** The server answers 404 when its test sign-in is off or the secret doesn't match. */
function messageFor(e: unknown): string {
  if (e instanceof AccountApiError && e.code === 'not_found') return t('account.test.notAvailable');
  return accountErrorMessage(e);
}

const useStyles = makeStyles((c) => ({
  hint: common(c).hint,
  label: { color: c.text, fontSize: 15, fontWeight: '600' },
  buttons: { gap: 10, marginTop: 12, marginBottom: 8 },
  appleButton: { height: 46, width: '100%' },
  // Apple's web button: black on a light screen, white on a dark one (the theme's text and background colours).
  appleWeb: { backgroundColor: c.text, borderColor: c.text },
  appleWebText: { color: c.bg },
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
  googleButton: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  googleMark: { width: 20, height: 20 },
  // Google asks for Roboto Medium: the system font's medium weight (Roboto itself on most Android phones).
  googleText: { fontSize: 16, fontWeight: '500', flexShrink: 1, textAlign: 'center' },
  googlePressed: { opacity: 0.85 },
  iconButton: { flexDirection: 'row', gap: 10, minHeight: 46, height: undefined, paddingHorizontal: 16, paddingVertical: 8 },
  shrink: { flexShrink: 1, textAlign: 'center' },
  pressed: { backgroundColor: c.pressed },
  dimmed: { opacity: 0.5 },
  testBox: {
    gap: 6,
    marginTop: 8,
    padding: 14,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.danger,
  },
  testUsers: { flexDirection: 'row', gap: 8, marginTop: 6 },
  testUser: { flex: 1 },
}));
