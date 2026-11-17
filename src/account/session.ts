import { AccountApiError, type Api } from './api';
import type {
  AppleSignInRequest,
  AppleWebStartResponse,
  MergePreview,
  MergeResponse,
  ProofPurpose,
  ProofResponse,
  DevSignInRequest,
  DevSignInUser,
  EmailStartRequest,
  EmailStartResponse,
  EmailVerifyRequest,
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

/** What Apple's web flow hands back to the app (the return link's flow id and handoff, and the kept verifier). */
export type AppleWebResult = { flow: string; handoff: string; verifier: string };

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
  private signInListeners = new Set<(response: SignInResponse) => void>();

  constructor(
    private readonly api: Api,
    private readonly storage: SessionStorage,
    private readonly now: () => number = Date.now,
    /**
     * The app's interface language (BCP 47), sent as `locale` on every sign-in: the server writes the sign-in
     * email and the notice mail ("a sign-in method was added") in it.
     */
    private readonly locale: () => string | undefined = () => undefined,
  ) {}

  /** Called after every successful sign-in (any method) with the server's answer (`created`, `emailLink`). */
  onSignIn(listener: (response: SignInResponse) => void): () => void {
    this.signInListeners.add(listener);
    return () => this.signInListeners.delete(listener);
  }

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
    const body: AppleSignInRequest = { ...request, deviceId, ...this.localeField() };
    return this.start(await this.api.request<SignInResponse>({ method: 'POST', path: '/auth/apple', body }));
  }

  async signInWithGoogle(request: Omit<GoogleSignInRequest, 'deviceId'>): Promise<SignInResponse> {
    const deviceId = await this.storage.deviceId();
    const body: GoogleSignInRequest = { ...request, deviceId, ...this.localeField() };
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

  /**
   * Sign-in by email, first half: the server mails a 6-digit code and a link to `email` (backend/README.md › Auth ›
   * Sign-in by email). The same answer for every valid address. The caller keeps the address (the code alone isn't
   * enough to finish) — src/account/emailSignIn.ts does that.
   */
  async startEmailSignIn(email: string): Promise<EmailStartResponse> {
    const deviceId = await this.storage.deviceId();
    const body: EmailStartRequest = { email, deviceId, ...this.localeField() };
    return this.api.request<EmailStartResponse>({ method: 'POST', path: '/auth/email/start', body });
  }

  /** Sign-in by email, second half: the code the user typed, or the token from the mail's link. */
  async verifyEmailSignIn(email: string, proof: { code: string } | { linkToken: string }): Promise<SignInResponse> {
    const deviceId = await this.storage.deviceId();
    const body: EmailVerifyRequest =
      'code' in proof
        ? { email, deviceId, code: proof.code, ...this.localeField() }
        : { email, deviceId, linkToken: proof.linkToken, ...this.localeField() };
    return this.start(await this.api.request<SignInResponse>({ method: 'POST', path: '/auth/email/verify', body }));
  }

  // --- Sign in with Apple on Android (the web flow; backend/README.md › Auth › Sign in with Apple on Android) ---

  /** Starts Apple's web authorization; `verifierHash` is the SHA-256 (hex) of a secret the caller keeps. */
  async startAppleWeb(verifierHash: string): Promise<AppleWebStartResponse> {
    const deviceId = await this.storage.deviceId();
    return this.api.request<AppleWebStartResponse>({ method: 'POST', path: '/auth/apple/web/start', body: { deviceId, verifierHash } });
  }

  /** Finishes Apple's web flow as a sign-in, with the flow id and handoff from the return link and the kept verifier. */
  async signInWithAppleWeb(result: AppleWebResult): Promise<SignInResponse> {
    const deviceId = await this.storage.deviceId();
    return this.start(
      await this.api.request<SignInResponse>({
        method: 'POST',
        path: '/auth/apple/web/finish',
        body: { ...result, deviceId, ...this.localeField() },
      }),
    );
  }

  // --- Sign-in methods while signed in (backend/README.md › Auth › Sign-in methods) ---

  /** Proves a Google account for `purpose` (add it, confirm it's you, or sign in to another account to combine it). */
  proveGoogle(token: { idToken: string; nonce: string }, purpose: ProofPurpose): Promise<ProofResponse> {
    return this.proof('/account/methods/google', { ...token, purpose });
  }

  proveApple(result: { identityToken: string; nonce: string; authorizationCode?: string }, purpose: ProofPurpose): Promise<ProofResponse> {
    return this.proof('/account/methods/apple', { ...result, purpose });
  }

  async proveAppleWeb(result: AppleWebResult, purpose: ProofPurpose): Promise<ProofResponse> {
    const deviceId = await this.storage.deviceId();
    return this.proof('/account/methods/apple/web', { ...result, deviceId, purpose });
  }

  /** Mails a confirm code (and link) to `email`; it works only for this signed-in device. */
  startEmailProof(email: string, purpose: ProofPurpose): Promise<EmailStartResponse> {
    return this.authed<EmailStartResponse>({
      method: 'POST',
      path: '/account/methods/email/start',
      body: { email, purpose, ...this.localeField() },
    });
  }

  verifyEmailProof(email: string, proof: { code: string } | { linkToken: string }, purpose: ProofPurpose): Promise<ProofResponse> {
    return this.proof('/account/methods/email/verify', { email, ...proof, purpose });
  }

  /** Removes one sign-in method (`Me.methods[].id`); the server wants a recent proof first (`reauth_required`). */
  async removeMethod(methodId: string, appleAuthorizationCode?: string): Promise<Me> {
    const { user } = await this.authed<{ user: Me }>({
      method: 'POST',
      path: '/account/methods/remove',
      body: { methodId, ...(appleAuthorizationCode ? { appleAuthorizationCode } : {}), ...this.localeField() },
    });
    await this.updateUser(user);
    return user;
  }

  /** What a merge with the proved account would combine. */
  previewMerge(proofId: string): Promise<MergePreview> {
    return this.authed<MergePreview>({ method: 'POST', path: '/account/merge/preview', body: { proofId } });
  }

  /** Merges the proved account into this one (safe to repeat until `done`). */
  async confirmMerge(proofId: string): Promise<MergeResponse> {
    const response = await this.authed<MergeResponse>({
      method: 'POST',
      path: '/account/merge',
      body: { proofId, ...this.localeField() },
    });
    await this.updateUser(response.user);
    return response;
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

  // --- for Qutai Credits' client (src/credits/client.ts), which talks to the same server with this session ---

  /** A valid access token (refreshed first when about to run out); rejects when signed out. */
  currentAccessToken(): Promise<string> {
    return this.accessToken();
  }

  /**
   * A new access token after the server refused `stale`: the one someone else already got, or a refresh (one at a
   * time, as everywhere). Rejects when the session is over.
   */
  async renewAccessToken(stale: string): Promise<string> {
    const session = this.requireSession();
    if (session.accessToken !== stale) return session.accessToken;
    return (await this.refresh()).accessToken;
  }

  /** The server refused this session's account as suspended. */
  noteSuspended(): void {
    this.markSuspended();
  }

  /** The server refused a freshly renewed token: the session is over on the server. */
  noteSessionEnded(): void {
    if (this.session) this.end('expired');
  }

  /** For tests and diagnostics only: whether a refresh is running. */
  get refreshInFlight(): boolean {
    return this.refreshing !== null;
  }

  // --- internals ---

  private async proof(path: string, body: Record<string, unknown>): Promise<ProofResponse> {
    const response = await this.authed<ProofResponse>({ method: 'POST', path, body: { ...body, ...this.localeField() } });
    await this.updateUser(response.user);
    return response;
  }

  private setState(state: AccountState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }

  private localeField(): { locale?: string } {
    let locale: string | undefined;
    try {
      locale = this.locale();
    } catch {
      locale = undefined;
    }
    return locale && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(locale) && locale.length <= 35 ? { locale } : {};
  }

  private async start(response: SignInResponse): Promise<SignInResponse> {
    const session = toStored(response, response.user, this.now());
    this.generation++;
    this.refreshing = null;
    this.session = session;
    await this.storage.save(session).catch(() => {});
    this.setState({ status: 'signedIn', user: session.user });
    for (const listener of this.signInListeners) {
      try {
        listener(response);
      } catch {
        // A listener's mistake must not undo the sign-in.
      }
    }
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
