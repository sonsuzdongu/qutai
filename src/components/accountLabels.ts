import type { Me, SignInMethod } from '../account/types';
import { isPrivateRelayAddress } from '../account/methodRules';
import { getLocale, t, type MessageKey } from '../i18n';
import { formatList } from '../i18n/format';

/**
 * How the account's sign-in methods read (Settings › Account, setup's account card, the "method added" note).
 * Tolerates providers this build doesn't know (the server may add more): they read as "another sign-in".
 */
const PROVIDER_LABEL: Record<string, MessageKey> = {
  apple: 'account.providerApple',
  google: 'account.providerGoogle',
  email: 'account.providerEmail',
  test: 'account.providerTest',
};

export function providerLabel(provider: string): string {
  return t(Object.hasOwn(PROVIDER_LABEL, provider) ? PROVIDER_LABEL[provider] : 'account.providerOther');
}

/** The account's methods: `GET /me`'s `methods`, or (a session stored before sign-in by email) its `providers`. */
export function methodsOf(user: Me): SignInMethod[] {
  const methods = Array.isArray(user.methods)
    ? user.methods.filter((m) => m && typeof m.provider === 'string')
    : [];
  if (methods.length) return methods;
  return (Array.isArray(user.providers) ? user.providers : []).map((provider) => ({ provider, linkedAt: 0 }));
}

/**
 * One method as a line: "Email: name@example.com", "Google: name@gmail.com", "Apple: hidden email" (a Hide My Email
 * relay address), or the method's name alone when the server sent no address (an older server, or a token without one).
 */
export function methodLine(method: SignInMethod): string {
  const email = typeof method.email === 'string' ? method.email.trim() : '';
  if (method.provider === 'email' && email) return t('account.methodEmail', { email });
  if (!email || method.provider === 'test') return providerLabel(method.provider);
  const name = providerLabel(method.provider);
  if (method.provider === 'apple' && isPrivateRelayAddress(email)) return t('account.methodHiddenEmail', { method: name });
  return t('account.methodWithAddress', { method: name, email });
}

/** "Google and email" (distinct providers, no addresses): for "Signed in with …" and the "method added" note. */
export function providersText(user: Me): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const method of methodsOf(user)) {
    const label = providerLabel(method.provider);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return formatList(labels);
}

/**
 * "Signed in with Google and email", with a capital first letter: Turkish, Japanese and Korean put the method first,
 * and "email" is lowercase inside a sentence.
 */
export function signedInWithText(user: Me): string {
  const text = t('account.signedInWith', { providers: providersText(user) });
  return text.charAt(0).toLocaleUpperCase(getLocale()) + text.slice(1);
}
