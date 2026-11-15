import { AccountApiError, type Api } from './api';
import type {
  AppleSignInRequest,
  DevSignInRequest,
  DevSignInUser,
  GoogleSignInRequest,
  Me,
  SignInResponse,
  TokenPair,
} from './types';

/**
 * The signed-in session with Qutai's server (pro mode only). Pure code, no React Native imports: storage and the
 * HTTP client are passed in, so `scripts/account-tests/` can run it in Node against a local server.
 *
 * Rules the server sets (backend/README.md › Auth):
 * - Access tokens live 15 minutes; refresh tokens 60 days and work once. A spent refresh token presented again
 *   revokes the device's whole session, so only one refresh runs at a time (`refreshing`), and the new pair is
 *   stored before anything uses it.
 * - `401 unauthorized` from the refresh route means the session is over (reused, revoked, expired, account
 *   deleted): the app forgets the tokens and shows the user as signed out.
 * - `403 account_suspended`: the tokens stay (sign-out and deletion still work); the user is shown as suspended.
 */

export type StoredSession = {
  accessToken: string;
  /** Unix ms. */
  accessExpiresAt: number;
  refreshToken: string;
  /** Unix ms. */
  refreshExpiresAt: number;
  user: Me;
};

export interface SessionStorage {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
  /** A random id kept per install (8–128 of [A-Za-z0-9_-]); created on first use. */
  deviceId(): Promise<string>;
}

/** Why the user is signed out, when the server ended the session rather than the user. */
export type SignedOutReason = 'expired';

export type AccountState =
  | { status: 'loading' }
  | { status: 'signedOut'; reason?: SignedOutReason }
  | { status: 'signedIn'; user: Me };

/** Refresh this long before the access token runs out, so a request doesn't arrive with an expired one. */
const EXPIRY_MARGIN_MS = 60_000;
/** Signing out shouldn't keep the user waiting: the local sign-out happens anyway. */
const SIGN_OUT_TIMEOUT_MS = 5_000;

export class AccountSession {
  private state: AccountState = { status: 'loading' };
  private session: StoredSession | null = null;
  private refreshing: Promise<StoredSession> | null = null;
  /** Bumped whenever the session is replaced or ended, so a late answer for an old one is dropped. */
  private generation = 0;
  private listeners = new Set<(state: AccountState) => void>();
  private loaded: Promise<void> | null = null;

  constructor(
    private readonly api: Api,
    private readonly storage: SessionStorage,
    private readonly now: () => number = Date.now,
  ) {}

  getState(): AccountState {
    return this.state;
  }

  subscribe(listener: (state: AccountState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Reads the stored session (no network). Safe to call more than once. */
  load(): Promise<void> {
    this.loaded ??= this.storage
      .load()
      .catch(() => null)
      .then((stored) => {
        if (this.state.status !== 'loading') return;
        this.session = stored && stored.refreshExpiresAt > this.now() ? stored : null;
        this.setState(this.session ? { status: 'signedIn', user: this.session.user } : { status: 'signedOut' });
      });
    return this.loaded;
  }

  async signInWithApple(request: Omit<AppleSignInRequest, 'deviceId'>): Promise<SignInResponse> {
    const deviceId = await this.storage.deviceId();
    const body: AppleSignInRequest = { ...request, deviceId };
    return this.start(await this.api.request<SignInResponse>({ method: 'POST', path: '/auth/apple', body }));
  }

  async signInWithGoogle(request: Omit<GoogleSignInRequest, 'deviceId'>): Promise<SignInResponse> {
    const deviceId = await this.storage.deviceId();
    const body: GoogleSignInRequest = { ...request, deviceId };
    return this.start(await this.api.request<SignInResponse>({ method: 'POST', path: '/auth/google', body }));
  }

  /**
   * Test sign-in as one of the server's fixed test users (`POST /auth/dev`), for builds made against a local test
   * server only: the UI offers it only when `devLoginEnabled` (src/config/features.ts). The session that comes
   * back is an ordinary one: refresh, sign-out and deletion run exactly as for Apple and Google.
   */
  async signInAsTestUser(user: DevSignInUser, secret: string): Promise<SignInResponse> {
    const deviceId = await this.storage.deviceId();
    const body: DevSignInRequest = { user, deviceId };
    return this.start(
      await this.api.request<SignInResponse>({
        method: 'POST',
        path: '/auth/dev',
        body,
        headers: { 'X-Dev-Sign-In-Secret': secret },
      }),
    );
  }

  /** The account as the server sees it now (`GET /me`); also updates the stored copy. */
  async refreshUser(): Promise<Me> {
    const user = await this.authed<Me>({ method: 'GET', path: '/me' });
    await this.updateUser(user);
    return user;
  }

  /** Ends this device's session. Always signs out locally, even when the server can't be reached. */
  async signOut(): Promise<void> {
    const session = this.session;
    this.end();
    if (!session) return;
    await this.api
      .request({ method: 'POST', path: '/auth/signout', body: { refreshToken: session.refreshToken }, timeoutMs: SIGN_OUT_TIMEOUT_MS })
      .catch(() => {});
  }

  /** Ends every session of the account, on every device. Rejects (still signed in) when the server can't be reached. */
  async signOutEverywhere(): Promise<void> {
    await this.authedEnding({ method: 'POST', path: '/auth/signout/all' });
  }

  /**
   * Deletes the account on the server, then signs out here. `appleAuthorizationCode`: a fresh code from Sign in
   * with Apple, so the server can revoke Apple's authorization even if its stored token is gone.
   */
  async deleteAccount(appleAuthorizationCode?: string): Promise<void> {
    await this.authedEnding({
      method: 'DELETE',
      path: '/account',
      body: appleAuthorizationCode ? { appleAuthorizationCode } : undefined,
    });
  }

  /** For tests and diagnostics only: whether a refresh is running. */
  get refreshInFlight(): boolean {
    return this.refreshing !== null;
  }

  // --- internals ---

  private setState(state: AccountState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }

  private async start(response: SignInResponse): Promise<SignInResponse> {
    const session = toStored(response, response.user, this.now());
    this.generation++;
    this.refreshing = null;
    this.session = session;
    await this.storage.save(session).catch(() => {});
    this.setState({ status: 'signedIn', user: session.user });
    return response;
  }

  /** Forgets the session here (memory and storage). */
  private end(reason?: SignedOutReason) {
    this.generation++;
    this.refreshing = null;
    this.session = null;
    this.storage.clear().catch(() => {});
    this.setState(reason ? { status: 'signedOut', reason } : { status: 'signedOut' });
  }

  private async updateUser(user: Me) {
    if (!this.session) return;
    this.session = { ...this.session, user };
    await this.storage.save(this.session).catch(() => {});
    this.setState({ status: 'signedIn', user });
  }

  private markSuspended() {
    if (this.session && this.session.user.status !== 'suspended') {
      this.updateUser({ ...this.session.user, status: 'suspended' }).catch(() => {});
    }
  }

  private requireSession(): StoredSession {
    if (!this.session) throw new AccountApiError('unauthorized', 401);
    return this.session;
  }

  /** One refresh at a time; everyone waiting gets the same new pair. */
  private refresh(): Promise<StoredSession> {
    if (!this.refreshing) {
      const run = this.runRefresh();
      this.refreshing = run;
      const clear = () => {
        if (this.refreshing === run) this.refreshing = null;
      };
      run.then(clear, clear);
    }
    return this.refreshing;
  }

  private async runRefresh(): Promise<StoredSession> {
    const session = this.requireSession();
    const generation = this.generation;
    let pair: TokenPair;
    try {
      pair = await this.api.request<TokenPair>({
        method: 'POST',
        path: '/auth/refresh',
        body: { refreshToken: session.refreshToken },
      });
    } catch (e) {
      if (generation === this.generation && e instanceof AccountApiError) {
        if (e.code === 'unauthorized') this.end('expired');
        else if (e.code === 'account_suspended') this.markSuspended();
      }
      throw e;
    }
    // Signed out (or in again) while this was on its way: the answer belongs to a session that is gone.
    if (generation !== this.generation) throw new AccountApiError('unauthorized', 401);
    const next = toStored(pair, session.user, this.now());
    this.session = next;
    // Stored before anyone uses it: after a restart the app must hold the new refresh token, not the spent one.
    await this.storage.save(next).catch(() => {});
    return next;
  }

  /** A valid access token, refreshing first when it is about to run out. */
  private async accessToken(): Promise<string> {
    if (this.refreshing) return (await this.refreshing).accessToken;
    const session = this.requireSession();
    if (session.accessExpiresAt - EXPIRY_MARGIN_MS > this.now()) return session.accessToken;
    return (await this.refresh()).accessToken;
  }

  /** A request with the access token; one refresh and retry when the server says the token is no longer good. */
  private async authed<T>(request: Parameters<Api['request']>[0]): Promise<T> {
    const token = await this.accessToken();
    try {
      return await this.api.request<T>({ ...request, accessToken: token });
    } catch (e) {
      if (!(e instanceof AccountApiError)) throw e;
      if (e.code === 'account_suspended') {
        this.markSuspended();
        throw e;
      }
      if (e.code !== 'unauthorized' || !this.session) throw e;
      // Someone else may have refreshed meanwhile; otherwise refresh now. A second 401 is final.
      const current = this.session.accessToken !== token ? this.session.accessToken : (await this.refresh()).accessToken;
      try {
        return await this.api.request<T>({ ...request, accessToken: current });
      } catch (again) {
        if (again instanceof AccountApiError && again.code === 'unauthorized') this.end('expired');
        if (again instanceof AccountApiError && again.code === 'account_suspended') this.markSuspended();
        throw again;
      }
    }
  }

  /** An authenticated request after which this device's session is over (sign out everywhere, delete). */
  private async authedEnding(request: Parameters<Api['request']>[0]): Promise<void> {
    try {
      await this.authed<null>(request);
    } catch (e) {
      // The session had already ended on the server: the outcome the user wanted for this device anyway.
      if (e instanceof AccountApiError && e.code === 'unauthorized' && request.path === '/auth/signout/all') {
        this.end();
        return;
      }
      throw e;
    }
    this.end();
  }
}

function toStored(pair: TokenPair, user: Me, now: number): StoredSession {
  return {
    accessToken: pair.accessToken,
    accessExpiresAt: now + pair.accessTokenExpiresIn * 1000,
    refreshToken: pair.refreshToken,
    refreshExpiresAt: pair.refreshTokenExpiresAt,
    user,
  };
}
