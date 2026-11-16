/**
 * The shapes of Qutai's server API that the app uses (pro mode only).
 *
 * Mirrored by hand from the server repository, checked out at `backend/` as a git submodule:
 * `backend/packages/shared/src/auth.ts` and `backend/packages/shared/src/errors.ts`. They are copied rather than
 * imported because the app must build without the submodule: a plain clone, an EAS build (which doesn't fetch
 * submodules) and the open-source build never have it, and the app's typecheck excludes `backend/`. When the
 * server's shapes change, change them here too (`scripts/account-tests/` exercises them against a local server).
 */

/**
 * `test`: a test user from the test sign-in (`POST /auth/dev`, local test servers only). `email`: an address proved
 * with a code or the mail's link. The server may add providers later: the app shows unknown ones generically.
 */
export type AuthProvider = 'apple' | 'google' | 'test' | 'email';

export type UserStatus = 'active' | 'suspended';

export interface AppleSignInRequest {
  identityToken: string;
  /** The raw nonce; Apple got its SHA-256 (lowercase hex). */
  nonce: string;
  /** Random per install, 8–128 of [A-Za-z0-9_-]. */
  deviceId: string;
  authorizationCode?: string;
  /** The app's language (BCP 47) for the notice mail when this sign-in joins an existing account. */
  locale?: string;
}

export interface GoogleSignInRequest {
  idToken: string;
  /** The raw nonce; Google got its SHA-256 (lowercase hex). */
  nonce: string;
  deviceId: string;
  locale?: string;
}

/** `POST /auth/email/start`: one message with a 6-digit code and a link, sent to the address. */
export interface EmailStartRequest {
  email: string;
  deviceId: string;
  /** The message's language (BCP 47); English when the server has no such template. */
  locale?: string;
}

/** `202`, the same for every valid address. */
export interface EmailStartResponse {
  /** Seconds the code and link stay valid (600). */
  expiresIn: number;
  /** Seconds before the same device may ask again for the same address (30). */
  resendAfter: number;
  /** Digits in the code (6). */
  codeLength: number;
}

/** `POST /auth/email/verify`: exactly one of `code` or `linkToken`, with the address and device that asked. */
export interface EmailVerifyRequest {
  email: string;
  deviceId: string;
  code?: string;
  linkToken?: string;
  locale?: string;
}

/** `POST /auth/dev` (header `X-Dev-Sign-In-Secret`): local test servers only; off everywhere else. */
export interface DevSignInRequest {
  user: DevSignInUser;
  deviceId: string;
}

export const DEV_SIGN_IN_USERS = ['test-1', 'test-2', 'test-3'] as const;
export type DevSignInUser = (typeof DEV_SIGN_IN_USERS)[number];

export interface RefreshRequest {
  refreshToken: string;
}

export interface DeleteAccountRequest {
  appleAuthorizationCode?: string;
}

export interface TokenPair {
  accessToken: string;
  /** Seconds until the access token expires (900). */
  accessTokenExpiresIn: number;
  refreshToken: string;
  /** Unix milliseconds. Each refresh token works once. */
  refreshTokenExpiresAt: number;
}

/** One sign-in method of the account (`GET /me`); several of one provider are possible. */
export interface SignInMethod {
  provider: AuthProvider;
  /** Only for `email`: the normalised address. */
  email?: string;
  /** Unix ms. */
  linkedAt: number;
}

/**
 * What a sign-in did about joining accounts by email: `linked` added this method to an existing account;
 * `conflict` and `untrusted` kept accounts apart (nothing to tell the user beyond what the account shows).
 */
export type EmailLinkOutcome = 'linked' | 'conflict' | 'untrusted';

export interface Me {
  id: string;
  providers: AuthProvider[];
  /** Every sign-in method, oldest first. Missing in sessions stored before sign-in by email. */
  methods?: SignInMethod[];
  status: UserStatus;
}

export interface SignInResponse extends TokenPair {
  user: Me;
  /** True when this sign-in created the account. */
  created: boolean;
  emailLink?: EmailLinkOutcome;
}

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'account_suspended'
  | 'not_found'
  | 'method_not_allowed'
  | 'conflict'
  | 'rate_limited'
  | 'not_implemented'
  | 'unavailable'
  | 'internal';

/** Every error answer from the server: `{ error: { code, message, requestId, reason? } }`. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    /**
     * Sign-in routes only: which check refused the sign-in (401: a SignInRejectReason; 503: `not_configured` or
     * `keys_unavailable`). backend/README.md › Auth › Sign-in error reasons.
     */
    reason?: SignInRejectReason | 'not_configured' | 'keys_unavailable' | EmailSignInReason | AccountStateReason;
  };
}

/** Sign-in by email's refusals (backend/README.md › Auth › Sign-in by email). */
export type EmailSignInReason =
  | 'invalid_email'
  | 'invalid_code'
  | 'expired'
  | 'too_many_attempts'
  | 'wrong_device'
  | 'account_conflict'
  | 'too_soon'
  | 'address_limit'
  | 'device_limit'
  | 'ip_limit'
  | 'sender_not_configured'
  | 'sender_failed';

/** On every sign-in route: the account the sign-in leads to is suspended or being deleted. */
export type AccountStateReason = 'suspended' | 'deleted';

export type SignInRejectReason =
  | 'malformed'
  | 'bad_signature'
  | 'unknown_key'
  | 'wrong_issuer'
  | 'wrong_audience'
  | 'expired'
  | 'missing_claim'
  | 'nonce_mismatch'
  | 'nonce_reused'
  | 'invalid';
