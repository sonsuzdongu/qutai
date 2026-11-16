import { AccountApiError } from './api';
import type { EmailStartResponse, SignInResponse } from './types';

/**
 * Sign-in by email on the app's side (pro mode; the server's half is backend/README.md › Auth › Sign-in by email).
 * Pure code, no React Native imports, tested in scripts/account-tests/.
 *
 *   address ──start──▶ pending (code screen) ──code or the mail's link──▶ signed in
 *
 * - The pending address must survive the app going to the background while the user reads the mail, and the
 *   process being killed meanwhile: it is kept in memory and in storage (`PendingStorage`), and cleared on
 *   success, on cancel ("use another address", another way to sign in) and when it has expired. The code and the
 *   link's token are never stored.
 * - The link only works on the device that asked, with the same address: verifyLink() uses the pending address.
 *   With none here the link can't be used on this phone; the UI says so (the `wrong_device` wording).
 */

export type PendingEmailSignIn = {
  /** The address as the user typed it (trimmed). The server normalises it the same way both times. */
  email: string;
  /** Unix ms: the code and link stop working. */
  expiresAt: number;
  /** Unix ms: the earliest "send again". */
  resendAt: number;
  codeLength: number;
  /** The code can't be used any more (expired, too many tries, replaced): only "send a new code" helps. */
  codeDead?: boolean;
};

export interface PendingStorage {
  load(): Promise<unknown>;
  save(pending: PendingEmailSignIn): Promise<void>;
  clear(): Promise<void>;
}

/** What the flow needs from AccountSession (src/account/session.ts). */
export interface EmailSignInApi {
  startEmailSignIn(email: string): Promise<EmailStartResponse>;
  verifyEmailSignIn(email: string, proof: { code: string } | { linkToken: string }): Promise<SignInResponse>;
}

export type EmailSignInState =
  | { status: 'idle' }
  | ({ status: 'pending'; verifying: null | 'code' | 'link' } & PendingEmailSignIn);

export type EmailSignInEvent =
  /** `onScreen`: an email sign-in screen was open when the verification began (it leaves as the account appears). */
  | { type: 'signedIn'; via: 'code' | 'link'; response: SignInResponse; onScreen: boolean }
  /** A link from the mail couldn't sign in (the code screen, if open, shows it; otherwise a dialog). */
  | { type: 'linkFailed'; error: unknown };

/** A link opened on a phone with no sign-in waiting for it (killed and expired, cancelled, or another phone). */
export class NoPendingEmailSignIn extends Error {
  /** The technical line under "Details" (errorDetails.ts). */
  readonly detail = 'Qutai app: no email sign-in is waiting on this phone (no_pending)';
  constructor() {
    super('no_pending');
    this.name = 'NoPendingEmailSignIn';
  }
}

/** A qutai://sign-in/… link that isn't a well-formed sign-in link. */
export class MalformedSignInLink extends Error {
  readonly detail = 'Qutai app: the sign-in link is incomplete (malformed_link)';
  constructor() {
    super('malformed_link');
    this.name = 'MalformedSignInLink';
  }
}

const DEFAULT_CODE_LENGTH = 6;
/** Bounds on what the server may say, so a broken answer can't make the screen wait for days. */
const MAX_EXPIRES_S = 3600;
const MAX_RESEND_S = 3600;

/** A light check before asking the server (which decides): one @, something before it, a dotted domain after it. */
export function looksLikeEmail(text: string): boolean {
  const value = text.trim();
  if (value.length < 6 || value.length > 254 || /\s/.test(value)) return false;
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@')) return false;
  const domain = value.slice(at + 1);
  return /^[^.@]+(\.[^.@]+)+$/.test(domain) && !/^[0-9.]+$/.test(domain);
}

/** The digits of what the user typed or pasted ("123 456", "Code: 123456"), at most `length`. */
export function codeDigits(text: string, length = DEFAULT_CODE_LENGTH): string {
  return text.replace(/\D/g, '').slice(0, length);
}

/**
 * Whether `url` belongs to sign-in (`qutai://sign-in…`): such links are never opened as a page or searched, even
 * when malformed. Case-insensitive like the scheme and host.
 */
export function isSignInLink(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^qutai:\/\/sign-in(?:[/?#]|$)/i.test(url.trim());
}

const TOKEN = /^[A-Za-z0-9_-]{16,256}$/;

/** `qutai://sign-in/email?token=…` → the token; null for anything else (also for a sign-in link without a good token). */
export function parseEmailSignInLink(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || url.length > 2048) return null;
  const match = /^qutai:\/\/sign-in\/email\/?\?([^#]*)(#.*)?$/i.exec(url.trim());
  if (!match) return null;
  let token: string | null = null;
  for (const pair of match[1].split('&')) {
    if (!pair) continue;
    const at = pair.indexOf('=');
    const key = at < 0 ? pair : pair.slice(0, at);
    if (key !== 'token') continue; // a mail client's added parameters don't matter
    if (token !== null) return null;
    let value: string;
    try {
      value = decodeURIComponent(at < 0 ? '' : pair.slice(at + 1));
    } catch {
      return null;
    }
    token = value;
  }
  return token !== null && TOKEN.test(token) ? token : null;
}

function isPending(value: unknown): value is PendingEmailSignIn {
  const p = value as PendingEmailSignIn | null;
  return (
    !!p &&
    typeof p.email === 'string' &&
    p.email.length > 0 &&
    p.email.length <= 254 &&
    typeof p.expiresAt === 'number' &&
    typeof p.resendAt === 'number' &&
    typeof p.codeLength === 'number' &&
    p.codeLength >= 4 &&
    p.codeLength <= 10
  );
}

export class EmailSignInFlow {
  private state: EmailSignInState = { status: 'idle' };
  private listeners = new Set<(state: EmailSignInState) => void>();
  private eventListeners = new Set<(event: EmailSignInEvent) => void>();
  private loaded: Promise<void> | null = null;
  /** Link tokens already handled in this process (the same link delivered twice); memory only. */
  private seenTokens = new Set<string>();
  /** Bumped by every start / cancel, so a late answer for an earlier address is dropped. */
  private generation = 0;

  constructor(
    private readonly api: EmailSignInApi,
    private readonly storage: PendingStorage,
    private readonly now: () => number = Date.now,
  ) {}

  getState(): EmailSignInState {
    return this.state;
  }

  subscribe(listener: (state: EmailSignInState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onEvent(listener: (event: EmailSignInEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private screens = 0;

  /**
   * A screen showing the email sign-in is open (it reports a link's outcome itself, so no dialog is needed). Returns
   * the function to call when it closes.
   */
  showScreen(): () => void {
    this.screens++;
    let open = true;
    return () => {
      if (open) this.screens--;
      open = false;
    };
  }

  get screenShown(): boolean {
    return this.screens > 0;
  }

  /** Reads a pending sign-in left from before the app was killed; an expired one is dropped. Safe to call twice. */
  load(): Promise<void> {
    this.loaded ??= this.storage
      .load()
      .catch(() => null)
      .then((stored) => {
        if (this.state.status !== 'idle') return;
        if (isPending(stored) && stored.expiresAt > this.now()) {
          this.setState({ status: 'pending', verifying: null, ...pick(stored) });
        } else if (stored != null) {
          this.storage.clear().catch(() => {});
        }
      });
    return this.loaded;
  }

  /** Whether the pending code has run out of time (the screen then offers only "send a new code"). */
  expired(): boolean {
    return this.state.status === 'pending' && (this.state.codeDead === true || this.state.expiresAt <= this.now());
  }

  /** Asks the server to mail a code and a link to `email`. Rejects with the server's error (shown by the screen). */
  async start(email: string): Promise<void> {
    const address = email.trim();
    const generation = ++this.generation;
    const answer = await this.api.startEmailSignIn(address);
    if (generation !== this.generation) return;
    const now = this.now();
    const expiresIn = clampSeconds(answer?.expiresIn, 600, MAX_EXPIRES_S);
    const resendAfter = clampSeconds(answer?.resendAfter, 30, MAX_RESEND_S);
    const codeLength =
      typeof answer?.codeLength === 'number' && answer.codeLength >= 4 && answer.codeLength <= 10 ? answer.codeLength : DEFAULT_CODE_LENGTH;
    const pending: PendingEmailSignIn = {
      email: address,
      expiresAt: now + expiresIn * 1000,
      resendAt: now + resendAfter * 1000,
      codeLength,
    };
    this.setState({ status: 'pending', verifying: null, ...pending });
    await this.storage.save(pending).catch(() => {});
  }

  /** "Send again": a new message for the same address (the old code stops working). */
  async resend(): Promise<void> {
    if (this.state.status !== 'pending') throw new NoPendingEmailSignIn();
    await this.start(this.state.email);
  }

  async verifyCode(code: string): Promise<SignInResponse> {
    return this.verify('code', { code });
  }

  /**
   * A link from the mail (`qutai://sign-in/email?token=…`). Events tell the screens how it ended. Resolves with the
   * answer, or null when the link was ignored (the same link again, or a verification already running).
   */
  async verifyLink(token: string): Promise<SignInResponse | null> {
    if (this.seenTokens.has(token)) return null;
    this.seenTokens.add(token);
    const onScreen = this.screens > 0;
    await this.load();
    if (this.state.status !== 'pending') {
      this.emit({ type: 'linkFailed', error: new NoPendingEmailSignIn() });
      return null;
    }
    if (this.state.verifying) {
      this.seenTokens.delete(token);
      return null;
    }
    try {
      return await this.verify('link', { linkToken: token }, onScreen);
    } catch (error) {
      // No answer (offline, server down): opening the same link again may work, so it isn't remembered.
      if (!(error instanceof AccountApiError) || error.status === 0 || error.status >= 500) this.seenTokens.delete(token);
      this.emit({ type: 'linkFailed', error });
      return null;
    }
  }

  /** A sign-in link that can't be read: says so like a link that isn't ours. */
  reportMalformedLink(): void {
    this.emit({ type: 'linkFailed', error: new MalformedSignInLink() });
  }

  /** Forgets the pending address ("use another address", another way to sign in, signed in some other way). */
  cancel(): void {
    this.generation++;
    if (this.state.status === 'idle') return;
    this.setState({ status: 'idle' });
    this.storage.clear().catch(() => {});
  }

  // --- internals ---

  private async verify(
    via: 'code' | 'link',
    proof: { code: string } | { linkToken: string },
    onScreen = this.screens > 0,
  ): Promise<SignInResponse> {
    await this.load();
    const state = this.state;
    if (state.status !== 'pending') throw new NoPendingEmailSignIn();
    const generation = this.generation;
    this.setState({ ...state, verifying: via });
    let response: SignInResponse;
    try {
      response = await this.api.verifyEmailSignIn(state.email, proof);
    } catch (error) {
      if (generation === this.generation && this.state.status === 'pending') {
        const dead = error instanceof AccountApiError && (error.reason === 'expired' || error.reason === 'too_many_attempts');
        const next: PendingEmailSignIn = { ...pick(this.state), ...(dead ? { codeDead: true } : {}) };
        this.setState({ status: 'pending', verifying: null, ...next });
        if (dead) await this.storage.save(next).catch(() => {});
      }
      throw error;
    }
    // Signed in: the pending address has done its job.
    this.generation++;
    this.setState({ status: 'idle' });
    await this.storage.clear().catch(() => {});
    this.emit({ type: 'signedIn', via, response, onScreen });
    return response;
  }

  private setState(state: EmailSignInState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }

  private emit(event: EmailSignInEvent) {
    for (const listener of [...this.eventListeners]) {
      try {
        listener(event);
      } catch {
        // One screen's mistake must not stop the others.
      }
    }
  }
}

function pick(p: PendingEmailSignIn): PendingEmailSignIn {
  return {
    email: p.email,
    expiresAt: p.expiresAt,
    resendAt: p.resendAt,
    codeLength: p.codeLength,
    ...(p.codeDead ? { codeDead: true } : {}),
  };
}

function clampSeconds(value: unknown, fallback: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(Math.ceil(value), max) : fallback;
}

/** A wait in the largest whole unit that reads naturally (rounded up): 45 s, 2 min, 1 h. */
export function waitSpan(seconds: number): { unit: 'second' | 'minute' | 'hour'; count: number } {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return { unit: 'second', count: s };
  if (s < 3600) return { unit: 'minute', count: Math.ceil(s / 60) };
  return { unit: 'hour', count: Math.ceil(s / 3600) };
}

/** `m:ss` for the "send again" countdown. */
export function countdownText(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Which sentence (an `en.ts` key) an email sign-in failure gets, and how long to wait for the rate limits. Anything
 * not specific to email (offline, server down) returns null: accountErrorMessage() says it as for every sign-in.
 */
export type EmailErrorMessage = { key: EmailErrorKey; waitSeconds?: number };

export type EmailErrorKey =
  | 'account.email.error.invalidEmail'
  | 'account.email.error.invalidCode'
  | 'account.email.error.expired'
  | 'account.email.error.tooManyAttempts'
  | 'account.email.error.wrongDevice'
  | 'account.email.error.suspended'
  | 'account.email.error.deleted'
  | 'account.email.error.conflict'
  | 'account.email.error.tooSoon'
  | 'account.email.error.addressLimit'
  | 'account.email.error.deviceLimit'
  | 'account.email.error.ipLimit'
  | 'account.email.error.rateLimited'
  | 'account.email.error.notConfigured'
  | 'account.email.error.senderFailed'
  | 'account.email.error.badLink';

const REASON_KEY: Record<string, EmailErrorKey> = {
  invalid_email: 'account.email.error.invalidEmail',
  invalid_code: 'account.email.error.invalidCode',
  expired: 'account.email.error.expired',
  too_many_attempts: 'account.email.error.tooManyAttempts',
  wrong_device: 'account.email.error.wrongDevice',
  suspended: 'account.email.error.suspended',
  deleted: 'account.email.error.deleted',
  account_conflict: 'account.email.error.conflict',
  too_soon: 'account.email.error.tooSoon',
  address_limit: 'account.email.error.addressLimit',
  device_limit: 'account.email.error.deviceLimit',
  ip_limit: 'account.email.error.ipLimit',
  sender_not_configured: 'account.email.error.notConfigured',
  sender_failed: 'account.email.error.senderFailed',
};

const WAIT_REASONS = new Set(['too_soon', 'address_limit', 'device_limit', 'ip_limit']);

export function emailErrorMessage(error: unknown): EmailErrorMessage | null {
  if (error instanceof NoPendingEmailSignIn) return { key: 'account.email.error.wrongDevice' };
  if (error instanceof MalformedSignInLink) return { key: 'account.email.error.badLink' };
  if (!(error instanceof AccountApiError)) return null;
  const key = error.reason ? REASON_KEY[error.reason] : undefined;
  if (key) {
    return WAIT_REASONS.has(error.reason!) && error.retryAfter ? { key, waitSeconds: error.retryAfter } : { key };
  }
  // The shared per-IP auth limit answers 429 without a reason.
  if (error.code === 'rate_limited') {
    return error.retryAfter ? { key: 'account.email.error.rateLimited', waitSeconds: error.retryAfter } : null;
  }
  if (error.code === 'account_suspended') return { key: 'account.email.error.suspended' };
  return null;
}
