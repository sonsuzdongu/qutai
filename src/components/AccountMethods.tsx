import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { accountErrorDetails, accountErrorMessage, accountSession } from '../account';
import { AccountApiError } from '../account/api';
import { codeDigits, looksLikeEmail } from '../account/emailSignIn';
import { canRemove, mergeRetryDelayMs, methodsThatCanConfirm, setPendingEmailProof } from '../account/methodRules';
import {
  SignInCancelled,
  appleSignInAvailable,
  appleWebAuthorize,
  googleSignInConfigured,
  signInWithApple,
  signInWithGoogle,
} from '../account/providers';
import type { AccountSession } from '../account/session';
import type { Me, MergePreview, MergeSide, ProofPurpose, ProofResponse, SignInMethod } from '../account/types';
import { creditsEnabled } from '../config/features';
import { creditsStore, creditsText, refreshCredits } from '../credits';
import { t } from '../i18n';
import { formatList } from '../i18n/format';
import { Icon, type IconLine } from '../ui/Icon';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
import { methodLine, methodsOf, providerLabel, providersText } from './accountLabels';
import { dialog } from './Dialog';

/**
 * Settings › Account, signed in: the sign-in methods with a remove control each, "Add a sign-in method" and "Combine
 * with another account" (backend/README.md › Auth › Sign-in methods, Merging accounts). Every action here proves a
 * method exactly as signing in does (Google, Apple, or a code from the mail); the server decides, the app explains.
 */

type Kind = 'google' | 'apple' | 'email';

/** Which ways to prove a method this phone has: Google when configured, Apple natively (iOS) or on the web (Android, when the server offers it), email always. */
function useAvailableKinds(): Kind[] {
  const [apple, setApple] = useState(false);
  useEffect(() => {
    let live = true;
    if (Platform.OS === 'ios') appleSignInAvailable().then((ok) => live && setApple(ok));
    else if (Platform.OS === 'android') {
      creditsStore
        .config()
        .then((config) => live && setApple(config.auth?.appleWeb === true))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, []);
  const kinds: Kind[] = [];
  if (googleSignInConfigured()) kinds.push('google');
  if (apple) kinds.push('apple');
  kinds.push('email');
  return kinds;
}

const KIND_LABEL: Record<Kind, () => string> = {
  google: () => providerLabel('google'),
  apple: () => providerLabel('apple'),
  email: () => t('account.methods.kindEmail'),
};

class ProofCancelled extends Error {}

/** A code from the mail for `address` (or a tap on the mail's link while the code dialog is open). */
async function emailProof(session: AccountSession, purpose: ProofPurpose, preset?: string): Promise<ProofResponse> {
  const address =
    preset ??
    (await dialog.prompt({
      title: t(purpose === 'merge' ? 'account.merge.emailTitle' : purpose === 'reauth' ? 'account.methods.reauthTitle' : 'account.methods.emailTitle'),
      message: t('account.methods.emailBody'),
      label: t('account.email.addressLabel'),
      placeholder: t('account.email.addressPlaceholder'),
      kind: 'email',
      confirmText: t('account.methods.sendCode'),
    }));
  if (!address) throw new ProofCancelled();
  if (!looksLikeEmail(address)) throw new AccountApiError('bad_request', 400, null, 'invalid_email');
  const started = await session.startEmailProof(address, purpose);
  let problem: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const controller = new AbortController();
    let fromLink: Promise<ProofResponse> | null = null;
    setPendingEmailProof({
      email: address,
      take: (linkToken) => {
        fromLink = session.verifyEmailProof(address, { linkToken }, purpose);
        controller.abort();
      },
    });
    const answer = await dialog.show({
      title: t('account.email.codeTitle'),
      message: [t('account.methods.codeBody', { email: address }), problem].filter(Boolean).join('\n\n'),
      input: { label: t('account.email.codeLabel', { count: started.codeLength }), maxLength: 12, kind: 'code' },
      buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('account.methods.confirmCode') }],
      signal: controller.signal,
    });
    setPendingEmailProof(null);
    if (fromLink) return fromLink;
    if (answer.button !== 1) throw new ProofCancelled();
    try {
      return await session.verifyEmailProof(address, { code: codeDigits(answer.text, started.codeLength) }, purpose);
    } catch (e) {
      if (!(e instanceof AccountApiError && e.reason === 'invalid_code')) throw e;
      problem = accountErrorMessage(e);
    }
  }
  throw new ProofCancelled();
}

/** Proves one method of `kind` for `purpose`; `preset`: the address for an email re-check. */
async function proveWith(session: AccountSession, kind: Kind, purpose: ProofPurpose, preset?: string): Promise<ProofResponse> {
  if (kind === 'google') return session.proveGoogle(await signInWithGoogle(), purpose);
  if (kind === 'apple') {
    if (Platform.OS === 'ios') return session.proveApple(await signInWithApple(), purpose);
    return session.proveAppleWeb(await appleWebAuthorize((hash) => session.startAppleWeb(hash)), purpose);
  }
  return emailProof(session, purpose, preset);
}

/** One of `kinds`, picked in a dialog (straight away when there is only one); null when cancelled. */
async function chooseKind(title: string, message: string, kinds: Kind[]): Promise<Kind | null> {
  if (kinds.length === 1) return kinds[0];
  const answer = await dialog.show({
    title,
    message,
    choices: { label: t('account.methods.chooseLabel'), options: kinds.map((k) => KIND_LABEL[k]()) },
    buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('account.methods.continue') }],
  });
  return answer.button === 1 ? kinds[answer.choice] ?? null : null;
}

function sideLines(side: MergeSide, title: string): IconLine[] {
  const methods = formatList(side.methods.map((m) => (m.provider === 'email' && m.email ? m.email : providerLabel(m.provider))));
  const lines: IconLine[] = [{ icon: 'person', text: `${title}: ${methods}` }];
  if (creditsEnabled) {
    lines.push({
      icon: 'wallet',
      text: side.balance === null ? t('credits.balanceUnknown') : t('credits.balance', { credits: creditsText(side.balance) }),
    });
  }
  return lines;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Shows what will be combined, asks, and runs the merge (repeating while a step waits). */
async function runMerge(session: AccountSession, proofId: string): Promise<boolean> {
  const preview: MergePreview = await session.previewMerge(proofId);
  const answer = await dialog.show({
    title: t('account.merge.previewTitle'),
    lines: {
      spaced: true,
      lines: [...sideLines(preview.into, t('account.merge.thisAccount')), ...sideLines(preview.from, t('account.merge.otherAccount'))],
    },
    message: [
      t('account.merge.previewBody'),
      preview.from.taskRunning || preview.into.taskRunning ? t('account.merge.taskRunning') : null,
      t('account.merge.final'),
    ]
      .filter(Boolean)
      .join('\n\n'),
    buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('account.merge.confirm'), primary: true }],
  });
  if (answer.button !== 1) return false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await session.confirmMerge(proofId);
    if (result.status === 'done') {
      refreshCredits();
      dialog.alert(t('account.merge.doneTitle'), t('account.merge.doneBody', { providers: providersText(result.user) }));
      return true;
    }
    await wait(mergeRetryDelayMs(null));
  }
  dialog.alert(t('account.merge.runningTitle'), t('account.merge.runningBody'));
  return true;
}

function failed(e: unknown) {
  if (e instanceof SignInCancelled || e instanceof ProofCancelled) return;
  if (e instanceof AccountApiError) {
    const key =
      e.reason === 'no_account'
        ? 'account.methods.error.noAccount'
        : e.reason === 'not_your_method'
          ? 'account.methods.error.notYours'
          : e.reason === 'other_account_unavailable' || e.reason === 'merge_unavailable'
            ? 'account.methods.error.otherUnavailable'
            : e.reason === 'last_method'
              ? 'account.methods.error.lastMethod'
              : e.reason === 'unknown_proof'
                ? 'account.methods.error.proofExpired'
                : e.reason === 'invalid_email'
                  ? 'account.email.error.invalidEmail'
                  : null;
    if (key) {
      dialog.alert(t('account.failedTitle'), t(key), undefined, accountErrorDetails(e));
      return;
    }
  }
  dialog.alert(t('account.failedTitle'), accountErrorMessage(e), undefined, accountErrorDetails(e));
}

/** The methods card's list, with a remove control per method when there is more than one. */
export function MethodsList({ user }: { user: Me }) {
  const styles = useStyles();
  const palette = usePalette();
  const session = accountSession();
  const kinds = useAvailableKinds();
  const [busy, setBusy] = useState<string | null>(null);
  const methods = methodsOf(user);

  const remove = async (method: SignInMethod) => {
    if (!session || busy || !method.id) return;
    const ok = await dialog.confirm({
      title: t('account.methods.removeTitle'),
      message: t('account.methods.removeBody', { method: methodLine(method) }),
      confirmText: t('account.methods.remove'),
      destructive: true,
    });
    if (!ok) return;
    setBusy(method.id);
    try {
      // Removing Apple on iPhone: confirm with Apple itself first; its fresh code lets the server revoke Apple's
      // authorization, and it is the recent proof the server asks for.
      if (method.provider === 'apple' && Platform.OS === 'ios' && kinds.includes('apple')) {
        await proveWith(session, 'apple', 'reauth');
      }
      try {
        await session.removeMethod(method.id);
      } catch (e) {
        if (!(e instanceof AccountApiError && e.reason === 'reauth_required')) throw e;
        const candidates = methodsThatCanConfirm(methods, method).filter((m) => (kinds as string[]).includes(m.provider));
        if (candidates.length === 0) {
          dialog.alert(t('account.methods.reauthTitle'), t('account.methods.reauthNone'));
          return;
        }
        const choice = await chooseKind(
          t('account.methods.reauthTitle'),
          t('account.methods.reauthBody'),
          [...new Set(candidates.map((m) => m.provider as Kind))],
        );
        if (!choice) return;
        const preset = choice === 'email' ? candidates.find((m) => m.provider === 'email')?.email : undefined;
        await proveWith(session, choice, 'reauth', preset);
        await session.removeMethod(method.id);
      }
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  if (methods.length === 0) return null;
  return (
    <View style={styles.methods}>
      <Text style={styles.hint}>{t('account.methodsTitle')}</Text>
      {methods.map((m, i) => (
        <View key={m.id ?? `${m.provider}-${m.email ?? ''}-${i}`} style={styles.method}>
          <Icon name={m.provider === 'email' ? 'email' : 'person'} size={16} color={palette.textSecondary} />
          <Text style={[styles.methodText, styles.flex]} selectable>
            {methodLine(m)}
          </Text>
          {canRemove(methods, m) &&
            (busy === m.id ? (
              <ActivityIndicator color={palette.textSecondary} />
            ) : (
              <Pressable
                onPress={() => remove(m)}
                disabled={!!busy}
                hitSlop={8}
                style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t('account.methods.removeLabel', { method: methodLine(m) })}
              >
                <Icon name="close" size={18} color={palette.textSecondary} />
              </Pressable>
            ))}
        </View>
      ))}
    </View>
  );
}

/** "Add a sign-in method" and "Combine with another account", under the account card. */
export function AddMethods({ user }: { user: Me }) {
  const styles = useStyles();
  const palette = usePalette();
  const session = accountSession();
  const kinds = useAvailableKinds();
  const [busy, setBusy] = useState<null | Kind | 'merge'>(null);

  const offerMerge = async (proofId: string, kind: Kind) => {
    if (!session) return;
    const ok = await dialog.confirm({
      title: t('account.methods.otherAccountTitle'),
      message: t('account.methods.otherAccountBody', { method: KIND_LABEL[kind]() }),
      confirmText: t('account.merge.review'),
    });
    if (ok) await runMerge(session, proofId);
  };

  const add = async (kind: Kind) => {
    if (!session || busy) return;
    setBusy(kind);
    try {
      const result = await proveWith(session, kind, 'add');
      if (result.outcome === 'added') {
        dialog.alert(t('account.methods.addedTitle'), t('account.linkedBody', { providers: providersText(result.user) }));
      } else if (result.outcome === 'other_account' && result.merge) {
        await offerMerge(result.merge.proofId, kind);
      } else {
        dialog.alert(t('account.methods.alreadyTitle'), t('account.methods.alreadyBody'));
      }
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  const combine = async () => {
    if (!session || busy) return;
    const kind = await chooseKind(t('account.merge.title'), t('account.merge.chooseBody'), kinds);
    if (!kind) return;
    setBusy('merge');
    try {
      const result = await proveWith(session, kind, 'merge');
      if (result.outcome === 'other_account' && result.merge) await runMerge(session, result.merge.proofId);
      else dialog.alert(t('account.merge.title'), t('account.merge.sameAccount'));
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.section}>
      {user.mergeSuggested && <Text style={styles.notice}>{t('account.merge.suggested')}</Text>}
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('account.methods.addTitle')}
      </Text>
      <Text style={styles.hint}>{t('account.methods.addHint')}</Text>
      <View style={styles.row}>
        {kinds.map((kind) => (
          <Pressable
            key={kind}
            onPress={() => add(kind)}
            disabled={!!busy}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed, !!busy && busy !== kind && styles.dimmed]}
            accessibilityRole="button"
            accessibilityLabel={t('account.methods.addLabel', { method: KIND_LABEL[kind]() })}
            accessibilityState={{ busy: busy === kind, disabled: !!busy }}
          >
            {busy === kind ? (
              <ActivityIndicator color={palette.text} />
            ) : (
              <>
                <Icon name={kind === 'email' ? 'email' : 'newTab'} size={16} color={palette.tintText} />
                <Text style={styles.chipText}>{KIND_LABEL[kind]()}</Text>
              </>
            )}
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={combine}
        disabled={!!busy}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, !!busy && busy !== 'merge' && styles.dimmed]}
        accessibilityRole="button"
        accessibilityState={{ busy: busy === 'merge', disabled: !!busy }}
      >
        {busy === 'merge' ? <ActivityIndicator color={palette.text} /> : <Text style={styles.buttonText}>{t('account.merge.title')}</Text>}
      </Pressable>
      <Text style={styles.hint}>{t('account.merge.hint')}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  methods: { gap: 4, marginTop: 4, marginBottom: 2 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  methodText: { color: c.text, fontSize: 14, lineHeight: 19 },
  flex: { flex: 1 },
  hint: common(c).hint,
  remove: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 8, marginTop: 8 },
  sectionTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
  notice: common(c).notice,
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { color: c.text, fontSize: 15, fontWeight: '500' },
  button: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: radii.button,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: c.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  pressed: { backgroundColor: c.pressed },
  dimmed: { opacity: 0.5 },
}));
