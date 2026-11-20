import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { accountErrorDetails, accountErrorMessage, emailSignIn, useEmailSignInState } from '../account';
import { codeDigits, countdownText, looksLikeEmail } from '../account/emailSignIn';
import { t } from '../i18n';
import { timeLabel } from '../i18n/format';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
import { ErrorDetails } from './ErrorDetails';
import { WholeWordsText } from './WholeWordsText';

/** The address typed last in this process, so "use another address" and coming back don't start from nothing. */
let lastAddress = '';

type Failure = { message: string; details?: string };

/**
 * Sign-in by email inside SignInOptions (Settings › Account and setup's sign-in step): the address, then the code
 * from the mail. The waiting address lives in src/account/emailSignIn.ts (it survives the app being killed while the
 * user reads the mail), so this screen opens on the code step when a sign-in is waiting. A link from the mail
 * (src/components/AccountLinks.tsx) finishes the same sign-in; this screen then reports it like a typed code.
 *
 * `onSignedIn`: the sign-in is done (by the code or the link). `onBack`: back to the other ways to sign in; the
 * waiting address is forgotten.
 */
export function EmailSignIn({ onSignedIn, onBack }: { onSignedIn: () => void; onBack: () => void }) {
  const flow = emailSignIn();
  const state = useEmailSignInState();
  const styles = useStyles();
  const palette = usePalette();
  const [address, setAddress] = useState(lastAddress);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  /** A short confirmation after "send again". */
  const [sentAgain, setSentAgain] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const codeInput = useRef<ComponentRef<typeof TextInput>>(null);
  const onSignedInRef = useRef(onSignedIn);
  useEffect(() => {
    onSignedInRef.current = onSignedIn;
  });

  // This screen says how a link ended; the root's dialog stays quiet meanwhile.
  useEffect(() => {
    if (!flow) return;
    const hide = flow.showScreen();
    const off = flow.onEvent((event) => {
      if (event.type === 'signedIn') onSignedInRef.current();
      else setFailure({ message: accountErrorMessage(event.error), details: accountErrorDetails(event.error) });
    });
    return () => {
      off();
      hide();
    };
  }, [flow]);

  const pending = state.status === 'pending' ? state : null;
  const expired = !!pending && (pending.codeDead === true || pending.expiresAt <= now);
  const resendIn = pending ? Math.max(0, Math.ceil((pending.resendAt - now) / 1000)) : 0;
  const verifying = !!pending?.verifying;

  // The code field gets the keyboard when the code step opens. Android keeps the address field's letter keyboard
  // when focus moves while it is up, so it is closed first and the number pad opens with the new field.
  const codeStep = pending ? pending.email : null;
  useEffect(() => {
    if (!codeStep) return;
    Keyboard.dismiss();
    const timer = setTimeout(
      () => {
        codeInput.current?.blur();
        codeInput.current?.focus();
      },
      Platform.OS === 'android' ? 250 : 50,
    );
    return () => clearTimeout(timer);
  }, [codeStep]);

  /**
   * After a refused code or a resend: the field is editable again on the next render, then it takes the keyboard back.
   * It may still count as focused with the keyboard gone, and focus() does nothing then: blur it first.
   */
  const refocusCode = () =>
    setTimeout(() => {
      codeInput.current?.blur();
      codeInput.current?.focus();
    }, 100);

  // The countdowns (send again, expiry) tick while the code step shows.
  useEffect(() => {
    if (!pending) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [pending]);

  if (!flow) return null;

  const send = async () => {
    if (sending) return;
    const value = address.trim();
    if (!looksLikeEmail(value)) {
      setAddressError(t('account.email.invalidAddress'));
      return;
    }
    lastAddress = value;
    setAddressError(null);
    setFailure(null);
    setSending(true);
    try {
      await flow.start(value);
      setCode('');
    } catch (e) {
      setFailure({ message: accountErrorMessage(e), details: accountErrorDetails(e) });
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    if (sending || !pending) return;
    setFailure(null);
    setSentAgain(false);
    setSending(true);
    try {
      await flow.resend();
      setCode('');
      setSentAgain(true);
      refocusCode();
    } catch (e) {
      setFailure({ message: accountErrorMessage(e), details: accountErrorDetails(e) });
    } finally {
      setSending(false);
    }
  };

  const submit = async (digits: string) => {
    if (!pending || pending.verifying) return;
    setFailure(null);
    setSentAgain(false);
    try {
      await flow.verifyCode(digits);
      // onSignedIn comes with the flow's event.
    } catch (e) {
      setFailure({ message: accountErrorMessage(e), details: accountErrorDetails(e) });
      setCode('');
      refocusCode();
    }
  };

  const onCodeChange = (text: string) => {
    if (!pending) return;
    const digits = codeDigits(text, pending.codeLength);
    setCode(digits);
    if (digits.length === pending.codeLength && !expired) void submit(digits);
  };

  const useAnotherAddress = () => {
    flow.cancel();
    setFailure(null);
    setSentAgain(false);
    setCode('');
  };

  const back = () => {
    flow.cancel();
    onBack();
  };

  const failureView = failure && (
    <View style={styles.error} accessible accessibilityLiveRegion="assertive" accessibilityRole="alert">
      <Icon name="info" size={18} color={palette.danger} />
      <Text style={styles.errorText}>{failure.message}</Text>
    </View>
  );

  // --- the address ---
  if (!pending) {
    return (
      <View style={styles.box}>
        <Text style={styles.title} accessibilityRole="header">
          {t('account.email.title')}
        </Text>
        <Text style={styles.hint}>{t('account.email.addressHint')}</Text>
        <TextInput
          value={address}
          onChangeText={(text) => {
            setAddress(text);
            if (addressError) setAddressError(null);
          }}
          onSubmitEditing={send}
          placeholder={t('account.email.addressPlaceholder')}
          placeholderTextColor={palette.textSecondary}
          style={[styles.input, addressError && styles.inputError]}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          inputMode="email"
          returnKeyType="send"
          editable={!sending}
          accessibilityLabel={t('account.email.addressLabel')}
          accessibilityHint={t('account.email.addressHint')}
        />
        {addressError && (
          <Text style={styles.fieldError} accessibilityLiveRegion="polite">
            {addressError}
          </Text>
        )}
        {failureView}
        {failure?.details ? <ErrorDetails details={failure.details} /> : null}
        <Pressable
          onPress={send}
          disabled={sending}
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed, sending && styles.dimmed]}
          accessibilityRole="button"
          accessibilityState={{ busy: sending, disabled: sending }}
        >
          {sending ? (
            <ActivityIndicator color={palette.onTint} />
          ) : (
            <WholeWordsText style={styles.primaryText}>{t('account.email.sendCode')}</WholeWordsText>
          )}
        </Pressable>
        <Pressable onPress={back} style={styles.textButton} accessibilityRole="button" hitSlop={6}>
          <WholeWordsText style={styles.link}>{t('account.email.otherWays')}</WholeWordsText>
        </Pressable>
      </View>
    );
  }

  // --- the code ---
  return (
    <View style={styles.box}>
      <Text style={styles.title} accessibilityRole="header">
        {t('account.email.codeTitle')}
      </Text>
      <View>
        <Text style={styles.body}>{t('account.email.codeSent', { count: pending.codeLength })}</Text>
        <Text style={[styles.body, styles.address]} selectable>
          {pending.email}
        </Text>
      </View>
      <Text style={styles.hint}>{t('account.email.codeOrLink')}</Text>
      <TextInput
        ref={codeInput}
        value={code}
        onChangeText={onCodeChange}
        style={[styles.input, styles.codeInput, failure && styles.inputError]}
        keyboardType="number-pad"
        inputMode="numeric"
        // iOS offers the code from Mail above the keyboard (iOS 17+); Android's autofill gets the one-time-code hint.
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoCorrect={false}
        maxLength={pending.codeLength + 12 /* room for a pasted "123 456" or "Code: 123456" */}
        editable={!verifying && !expired}
        placeholder={'0'.repeat(pending.codeLength)}
        placeholderTextColor={palette.textSecondary}
        accessibilityLabel={t('account.email.codeLabel', { count: pending.codeLength })}
        accessibilityState={{ busy: verifying, disabled: expired }}
      />
      {verifying && (
        <View style={styles.row} accessibilityLiveRegion="polite">
          <ActivityIndicator color={palette.textSecondary} />
          <Text style={styles.hint}>{t(pending.verifying === 'link' ? 'account.email.checkingLink' : 'account.email.checking')}</Text>
        </View>
      )}
      {failureView}
      {failure?.details ? <ErrorDetails details={failure.details} /> : null}
      {sentAgain && !failure && (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {t('account.email.sentAgain')}
        </Text>
      )}
      <Text style={[styles.hint, expired && styles.expired]} accessibilityLiveRegion="polite">
        {expired ? t('account.email.expiredNote') : t('account.email.expiresAt', { time: timeLabel(pending.expiresAt) })}
      </Text>
      <Pressable
        onPress={resend}
        disabled={sending || resendIn > 0 || verifying}
        style={({ pressed }) => [
          expired ? styles.primary : styles.secondary,
          pressed && (expired ? styles.primaryPressed : styles.pressed),
          (sending || resendIn > 0 || verifying) && styles.dimmed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ busy: sending, disabled: sending || resendIn > 0 || verifying }}
      >
        {sending ? (
          <ActivityIndicator color={expired ? palette.onTint : palette.text} />
        ) : (
          <WholeWordsText style={expired ? styles.primaryText : styles.secondaryText}>
            {resendIn > 0 ? t('account.email.resendIn', { time: countdownText(resendIn) }) : t(expired ? 'account.email.sendNew' : 'account.email.resend')}
          </WholeWordsText>
        )}
      </Pressable>
      <Pressable onPress={useAnotherAddress} style={styles.textButton} accessibilityRole="button" hitSlop={6}>
        <WholeWordsText style={styles.link}>{t('account.email.otherAddress')}</WholeWordsText>
      </Pressable>
      <Pressable onPress={back} style={styles.textButton} accessibilityRole="button" hitSlop={6}>
        <WholeWordsText style={styles.link}>{t('account.email.otherWays')}</WholeWordsText>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: { gap: 10, marginTop: 12, marginBottom: 8 },
  title: { color: c.text, fontSize: 17, fontWeight: '700' },
  body: { color: c.text, fontSize: 15, lineHeight: 21 },
  address: { fontWeight: '700' },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18, flexShrink: 1 },
  expired: { color: c.danger },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    color: c.text,
    minHeight: 46,
    borderRadius: radii.control,
    paddingHorizontal: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    fontSize: 16,
  },
  codeInput: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 8,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    minHeight: 56,
  },
  inputError: { borderColor: c.danger },
  fieldError: { color: c.danger, fontSize: 13, lineHeight: 18 },
  error: common(c).noticeRow,
  errorText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
  primary: {
    minHeight: 46,
    borderRadius: radii.button,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  primaryPressed: { opacity: 0.85 },
  primaryText: { color: c.onTint, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondary: {
    minHeight: 46,
    borderRadius: radii.button,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secondaryText: { color: c.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  pressed: { backgroundColor: c.pressed },
  dimmed: { opacity: 0.5 },
  textButton: { alignSelf: 'center', paddingVertical: 6 },
  link: { color: c.tintText, fontSize: 15, fontWeight: '600', textAlign: 'center' },
}));
