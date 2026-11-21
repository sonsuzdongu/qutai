/**
 * The shapes of Qutai's server API for Qutai Credits (pro mode only): the relay, `GET /config` and `GET /credits`.
 *
 * Mirrored by hand, like `src/account/types.ts`, from the server repository checked out at `backend/`
 * (`packages/shared/src/relay.ts`, `config.ts`, `credits.ts`, `errors.ts`): the app must build without the
 * submodule. When the server's shapes change, change them here too; `scripts/credits-tests/` exercises them.
 *
 * Amounts are integer micro-credits (1 credit = 1 000 000).
 */

export const RELAY_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;
export type RelayProvider = (typeof RELAY_PROVIDERS)[number];

export function isRelayProvider(value: unknown): value is RelayProvider {
  return typeof value === 'string' && (RELAY_PROVIDERS as readonly string[]).includes(value);
}

/**
 * `POST /relay` body. Unknown fields are refused by the server. Two forms (backend/README.md › Relay › Request):
 * the tier form (`tier`, `provider` = the format `input` is built in, optional `route`; no `model`), used whenever the
 * server's `/config` lists tiers, and the older direct form (`provider` + `model`) for a server without them.
 */
export interface RelayRequest {
  provider: RelayProvider;
  /** Direct form only. */
  model?: string;
  /** Tier form: a `/config` › `tiers[].id`. */
  tier?: string;
  /** Tier form: `X-Qutai-Route` of this conversation's last answer on the same tier and provider, if any. */
  route?: string;
  /** SHA-256 (lowercase hex) of the agent profile JSON (`AGENT_PROFILE_ID`). */
  profile: string;
  /** 0-based step of the agent loop for this user message. */
  step: number;
  stream: boolean;
  options: { webSearch?: boolean; research?: boolean; memoryTools?: boolean };
  context: { memory?: string; customInstructions?: string };
  /** The conversation in the provider's own format (Anthropic `messages`, OpenAI / Gemini `input`). */
  input: unknown[];
  /** Only to continue an Anthropic `pause_turn`: the continuation the paused answer carried. */
  continuation?: string;
  /** The step's id, the same on every send of it: an identical re-send of a charged step is free (once). */
  stepKey?: string;
}

/**
 * What really served an answer, from its headers (they arrive before the body): `X-Qutai-Provider` (whose raw output
 * the answer is), `X-Qutai-Model`, and on the tier form `X-Qutai-Tier` and `X-Qutai-Route` (opaque, signed by the
 * server, sent back with the next request of the same conversation and tier).
 */
export interface RelayServed {
  provider: RelayProvider;
  model: string;
  tier?: string;
  route?: string;
}

/** A paused Anthropic answer's continuation (`event: qutai.paused`, or the `X-Qutai-Continuation` headers). */
export interface RelayPause {
  continuation: string;
  /** Unix ms. */
  expiresAt: number;
}

export type RelayOutcome = 'completed' | 'upstream_error' | 'upstream_timeout' | 'client_closed';

/** Last event of a streamed answer (`event: qutai.settlement`). */
export interface RelaySettlementEvent {
  type: 'qutai.settlement';
  charged: number;
  /** Null when the settlement couldn't be confirmed (the hold expires on its own). */
  balance: number | null;
  outcome: RelayOutcome;
}

/** Sent before the settlement when the provider's stream ended early (`event: qutai.error`). */
export interface RelayStreamErrorEvent {
  type: 'qutai.error';
  code: 'upstream_timeout' | 'upstream_error';
}

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  group: 'core' | 'memory';
}

export interface AgentProfile {
  version: 1;
  system: {
    base: string;
    webSearch: string;
    research: string;
    lastStep: string;
    /** Contains `{{text}}` where the server puts the user's custom instructions. */
    customInstructions: string;
  };
  tools: AgentTool[];
}

/** `GET /config`. */
export interface PublicConfig {
  packs: CreditPack[];
  models: AllowedModel[];
  /**
   * Credit-mode tiers in their display order (empty from a server without tiers: then the direct form and `models`).
   * Only enabled tiers whose model is allowed and priced are listed.
   */
  tiers: Tier[];
  /** Whether the server still takes the direct `{ provider, model }` form (`model_tiers.acceptDirectModels`). */
  directModels: boolean;
  /** maxRequestBytes, maxImages, maxSteps, maxResearchSteps, maxMemoryChars, maxCustomInstructionsChars. */
  limits: Record<string, number>;
  minAppVersion: string | null;
  maintenance: { enabled: boolean; message: string | null };
  /** `appleWeb`: Sign in with Apple through the web flow is set up (Android). Absent from older servers. */
  auth?: { appleWeb: boolean };
  /**
   * Server backup is available (backend README › Server backup): the largest file and how many are kept per account.
   * Absent when the server has no backup storage, and from older servers.
   */
  backups?: { maxBytes: number; keep: number };
}

/** `GET /config` › `tiers[]` (backend/README.md › Relay › Tiers). */
export interface Tier {
  /** Stable id; the app names the tier from it in its own texts. */
  id: string;
  order: number;
  default: boolean;
  /** The provider format a new conversation's input is built in. */
  format: RelayProvider;
  maxOutputTokens: number;
  webSearch: boolean;
  /** The tier's own limits (maxSteps, maxImages, …), already merged with the top-level ones by the server. */
  limits: Record<string, number>;
  /** Micro-credits of one reference step on the tier's current model: a hint, never a price. */
  approxCreditsPerStep: number | null;
  prices: CreditPriceTier[];
  /** Which model serves the tier right now (for a details view only; never choose anything by it). */
  servedBy: { provider: string; model: string } | null;
}

export interface CreditPack {
  store: 'apple' | 'google';
  productId: string;
  credits: number;
}

export interface AllowedModel {
  provider: string;
  model: string;
  maxOutputTokens: number;
  webSearch: boolean;
  prices: CreditPriceTier[];
}

/** Micro-credits per million tokens (`perSearch`: per search). */
export interface CreditPriceTier {
  aboveInputTokens: number;
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
  thinkingPerMTok: number;
  perSearch: number;
}

export type LedgerKind = 'purchase' | 'grant' | 'reserve' | 'settle' | 'refund' | 'revoke';

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  /** Signed micro-credits. */
  amount: number;
  /** Unix ms. */
  at: number;
}

export interface ActiveTask {
  reservationId: string;
  reserved: number;
  startedAt: number;
  expiresAt: number;
}

/** `GET /credits`: newest entries first. */
export interface CreditsResponse {
  balance: number;
  activeTask: ActiveTask | null;
  entries: LedgerEntry[];
}

/** The relay's error codes (`error.code`), plus `upstream` details for `upstream_rejected`. */
export type RelayErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'account_suspended'
  | 'rate_limited'
  | 'unavailable'
  | 'internal'
  | 'payload_too_large'
  | 'upgrade_required'
  | 'maintenance'
  | 'model_not_allowed'
  | 'step_limit'
  | 'profile_unknown'
  | 'insufficient_credits'
  | 'task_active'
  | 'upstream_rejected'
  | 'upstream_unavailable'
  | 'upstream_error'
  | 'upstream_timeout'
  | 'tier_unknown'
  | 'tier_unavailable'
  | 'tier_moved'
  | 'continuation_invalid';

export interface UpstreamError {
  status: number;
  type?: string;
  code?: string;
  message?: string;
}
