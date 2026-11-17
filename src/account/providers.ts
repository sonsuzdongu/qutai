import * as AppleAuthentication from 'expo-apple-authentication';
import { requireOptionalNativeModule } from 'expo';
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';
import { Platform } from 'react-native';
import { features } from '../config/features';
import { providerFailureDetail } from './errorDetails';
import { APPLE_RETURN_URL, parseAppleReturn } from './appleWeb';
import { base64url, makeNonce } from './nonce';
import type { AppleWebResult } from './session';
import type { AppleWebStartResponse } from './types';

/**
 * Sign in with Apple (iOS) and Sign in with Google (Android and iOS) for pro-mode accounts. Each returns the
 * provider's identity token and the raw nonce for Qutai's server; nothing from the provider is stored.
 *
 * - Apple: expo-apple-authentication (the system sheet). Apple gets the SHA-256 of the nonce.
 * - Google on Android: the local module modules/qutai-auth (Credential Manager, "Sign in with Google" button
 *   flow, `setNonce`). The legacy Google Sign-In SDK is deprecated, and the free @react-native-google-signin
 *   module can't pass a nonce on Android.
 * - Apple on Android: Apple's web flow in a Custom Tab (expo-web-browser's auth session), run by Qutai's server, offered
 *   only when the server says it is set up (`GET /config` › auth.appleWeb). The app keeps a random verifier and gives
 *   the server only its hash; the return link carries a flow id and a one-time handoff (src/account/appleWeb.ts).
 * - Google on iOS: expo-auth-session in the system's authentication browser (ASWebAuthenticationSession) with
 *   the iOS OAuth client, PKCE and the nonce, then the code exchange at Google's token endpoint, which returns the
 *   ID token. iOS clients are public clients: no secret is involved.
 */

export class SignInCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SignInCancelled';
  }
}

/** The provider couldn't sign in: not set up in this build, unavailable on this phone, or failed. */
export class SignInFailed extends Error {
  constructor(
    readonly reason: 'notConfigured' | 'needsBuild' | 'noAccount' | 'failed',
    /** Technical line for "Details" (errorDetails.ts): the native error's code and scrubbed message. */
    readonly detail?: string,
  ) {
    super(reason);
    this.name = 'SignInFailed';
  }
}

export type AppleResult = { identityToken: string; nonce: string; authorizationCode?: string };
export type GoogleResult = { idToken: string; nonce: string };

const errorCode = (e: unknown) => (e as { code?: unknown } | null)?.code;
const errorMessage = (e: unknown) => (e as { message?: unknown } | null)?.message;

export function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

export function googleSignInConfigured(): boolean {
  if (Platform.OS === 'android') return !!features.googleWebClientId;
  if (Platform.OS === 'ios') return !!features.googleIosClientId;
  return false;
}

export async function signInWithApple(): Promise<AppleResult> {
  const nonce = makeNonce(getRandomBytes);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    // No name or email asked for: the account needs neither.
    credential = await AppleAuthentication.signInAsync({ nonce: nonce.hashed, requestedScopes: [] });
  } catch (e) {
    if (errorCode(e) === 'ERR_REQUEST_CANCELED') throw new SignInCancelled();
    throw new SignInFailed('failed', providerFailureDetail('Apple', errorCode(e), errorMessage(e)));
  }
  if (!credential.identityToken) throw new SignInFailed('failed', 'Apple: no identity token');
  return {
    identityToken: credential.identityToken,
    nonce: nonce.raw,
    authorizationCode: credential.authorizationCode ?? undefined,
  };
}

type QutaiAuthModule = { googleSignIn(serverClientId: string, nonce: string): Promise<{ idToken: string }> };

export async function signInWithGoogle(): Promise<GoogleResult> {
  if (!googleSignInConfigured()) throw new SignInFailed('notConfigured');
  const nonce = makeNonce(getRandomBytes);
  const idToken = Platform.OS === 'android' ? await googleAndroid(nonce.hashed) : await googleIos(nonce.hashed);
  return { idToken, nonce: nonce.raw };
}

async function googleAndroid(hashedNonce: string): Promise<string> {
  const native = requireOptionalNativeModule<QutaiAuthModule>('QutaiAuth');
  if (!native) throw new SignInFailed('needsBuild');
  try {
    return (await native.googleSignIn(features.googleWebClientId!, hashedNonce)).idToken;
  } catch (e) {
    // The native module's message names the Credential Manager exception and Google's own text, e.g.
    // "GetCredentialUnknownException: During get sign-in intent, failure response from one tap: 10: ..."
    // (10 = DEVELOPER_ERROR: package name / SHA-1 / client id mismatch; docs/google-sign-in.md).
    const code = errorCode(e);
    const detail = providerFailureDetail('Google', code, errorMessage(e));
    if (code === 'ERR_CANCELED') throw new SignInCancelled();
    if (code === 'ERR_NO_CREDENTIAL') throw new SignInFailed('noAccount', detail);
    throw new SignInFailed('failed', detail);
  }
}

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

/** "123-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.123-abc", the iOS client's redirect scheme. */
export function reversedClientId(clientId: string): string {
  return clientId.split('.').reverse().join('.');
}

async function googleIos(hashedNonce: string): Promise<string> {
  let AuthSession: typeof import('expo-auth-session');
  try {
    AuthSession = await import('expo-auth-session');
  } catch {
    throw new SignInFailed('needsBuild');
  }
  const clientId = features.googleIosClientId!;
  const redirectUri = `${reversedClientId(clientId)}:/oauth2redirect`;
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'email', 'profile'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { nonce: hashedNonce, prompt: 'select_account' },
  });
  let result: Awaited<ReturnType<typeof request.promptAsync>>;
  try {
    result = await request.promptAsync(GOOGLE_DISCOVERY);
  } catch (e) {
    throw new SignInFailed('failed', providerFailureDetail('Google', errorCode(e), errorMessage(e)));
  }
  if (result.type === 'cancel' || result.type === 'dismiss') throw new SignInCancelled();
  if (result.type !== 'success' || !result.params.code) {
    const error = result.type === 'error' ? result.params.error : undefined;
    throw new SignInFailed('failed', `Google: ${result.type}${error && /^[a-z_]{1,40}$/.test(error) ? ` (${error})` : ''}`);
  }
  try {
    const tokens = await AuthSession.exchangeCodeAsync(
      { clientId, code: result.params.code, redirectUri, extraParams: { code_verifier: request.codeVerifier ?? '' } },
      GOOGLE_DISCOVERY,
    );
    if (!tokens.idToken) throw new Error('no id token');
    return tokens.idToken;
  } catch (e) {
    throw new SignInFailed('failed', providerFailureDetail('Google token exchange', errorCode(e), errorMessage(e)));
  }
}

/**
 * Sign in with Apple on Android: `start` asks the server for Apple's authorization URL (given the verifier's hash), the
 * Custom Tab runs it, and the return link's flow and handoff come back with the verifier for the server's finish route
 * (a sign-in or a proof while signed in).
 */
export async function appleWebAuthorize(start: (verifierHash: string) => Promise<AppleWebStartResponse>): Promise<AppleWebResult> {
  let WebBrowser: typeof import('expo-web-browser');
  try {
    WebBrowser = await import('expo-web-browser');
  } catch {
    throw new SignInFailed('needsBuild');
  }
  const verifier = base64url(getRandomBytes(32));
  const verifierHash = (await digestStringAsync(CryptoDigestAlgorithm.SHA256, verifier)).toLowerCase();
  const started = await start(verifierHash);
  let result: Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>;
  try {
    result = await WebBrowser.openAuthSessionAsync(started.url, APPLE_RETURN_URL, { showInRecents: false });
  } catch (e) {
    throw new SignInFailed('failed', providerFailureDetail('Apple', errorCode(e), errorMessage(e)));
  }
  if (result.type !== 'success') throw new SignInCancelled();
  const back = parseAppleReturn(result.url);
  if (!back.ok) {
    if (back.error === 'cancelled') throw new SignInCancelled();
    throw new SignInFailed('failed', `Apple (web): ${back.error}`);
  }
  return { flow: back.flow, handoff: back.handoff, verifier };
}
