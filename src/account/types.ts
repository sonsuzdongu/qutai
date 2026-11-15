/**
 * The shapes of Qutai's server API that the app uses (pro mode only).
 *
 * Mirrored by hand from the server repository, checked out at `backend/` as a git submodule:
 * `backend/packages/shared/src/auth.ts` and `backend/packages/shared/src/errors.ts`. They are copied rather than
 * imported because the app must build without the submodule: a plain clone, an EAS build (which doesn't fetch
 * submodules) and the open-source build never have it, and the app's typecheck excludes `backend/`. When the
 * server's shapes change, change them here too (`scripts/account-tests/` exercises them against a local server).
 */

export type AuthProvider = 'apple' | 'google';

export type UserStatus = 'active' | 'suspended';

export interface AppleSignInRequest {
  identityToken: string;
  /** The raw nonce; Apple got its SHA-256 (lowercase hex). */
  nonce: string;
  /** Random per install, 8–128 of [A-Za-z0-9_-]. */
  deviceId: string;
  authorizationCode?: string;
}

export interface GoogleSignInRequest {
  idToken: string;
  /** The raw nonce; Google got its SHA-256 (lowercase hex). */
  nonce: string;
  deviceId: string;
}

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

export interface Me {
  id: string;
  providers: AuthProvider[];
  status: UserStatus;
}

export interface SignInResponse extends TokenPair {
  user: Me;
  /** True when this sign-in created the account. */
  created: boolean;
}

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'account_suspended'
  | 'not_found'
  | 'method_not_allowed'
  | 'rate_limited'
  | 'not_implemented'
  | 'unavailable'
  | 'internal';

/** Every error answer from the server: `{ error: { code, message, requestId } }`. */
export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; requestId: string };
}
