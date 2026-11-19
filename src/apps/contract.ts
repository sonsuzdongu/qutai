import { ASKED_PERMISSIONS, AVAILABLE_PERMISSIONS, CONTRACT_VERSION, type AppPermission } from './manifest';

/**
 * The bridge contract, version 1 (docs/mini-apps.md › The bridge contract): every call of every phase, the permission
 * it needs and the phase it arrives in, the wire format and the order of checks. Pure code, also runs in Node.
 */

export { CONTRACT_VERSION };

export type ErrorCode =
  | 'E_UNKNOWN_CALL'
  | 'E_NOT_AVAILABLE'
  | 'E_NOT_DECLARED'
  | 'E_DENIED'
  | 'E_BAD_ARGS'
  | 'E_NOT_FOUND'
  | 'E_TOO_LARGE'
  | 'E_QUOTA'
  | 'E_BUSY'
  | 'E_CANCELLED'
  | 'E_HOST_NOT_DECLARED'
  | 'E_OFFLINE'
  | 'E_INTERNAL';

export class BridgeError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const LIMITS = {
  quotaBytes: 5 * 1024 * 1024,
  valueBytes: 256 * 1024,
  messageBytes: 512 * 1024,
  batchOps: 100,
  inFlight: 32,
  toast: 120,
  title: 40,
  dialogText: 500,
  clipboardBytes: 100 * 1024,
} as const;

export const KEY = /^[A-Za-z0-9_.:-]{1,100}$/;
export const COLLECTION = /^[A-Za-z0-9_-]{1,64}$/;

/** 'implicit': no declaration needed. Otherwise the permission the manifest must declare. */
type Need = 'implicit' | AppPermission;

export type CallSpec = { need: Need; phase: 1 | 2 | 3 | 4 };

/** Every call of contract 1. Phase-1 calls are implemented in src/apps/bridge.ts; the rest answer E_NOT_AVAILABLE. */
export const CALLS: Record<string, CallSpec> = {
  'app.info': { need: 'implicit', phase: 1 },
  'app.permissions': { need: 'implicit', phase: 1 },
  'app.requestPermission': { need: 'implicit', phase: 1 },
  'app.close': { need: 'implicit', phase: 1 },
  'app.openLink': { need: 'links', phase: 3 },
  'app.addShortcut': { need: 'implicit', phase: 4 },
  'storage.get': { need: 'implicit', phase: 1 },
  'storage.set': { need: 'implicit', phase: 1 },
  'storage.remove': { need: 'implicit', phase: 1 },
  'storage.keys': { need: 'implicit', phase: 1 },
  'storage.getMany': { need: 'implicit', phase: 1 },
  'storage.setMany': { need: 'implicit', phase: 1 },
  'storage.usage': { need: 'implicit', phase: 1 },
  'storage.batch': { need: 'implicit', phase: 1 },
  'docs.add': { need: 'implicit', phase: 1 },
  'docs.get': { need: 'implicit', phase: 1 },
  'docs.put': { need: 'implicit', phase: 1 },
  'docs.update': { need: 'implicit', phase: 1 },
  'docs.delete': { need: 'implicit', phase: 1 },
  'docs.query': { need: 'implicit', phase: 1 },
  'docs.count': { need: 'implicit', phase: 1 },
  'docs.clear': { need: 'implicit', phase: 1 },
  'docs.collections': { need: 'implicit', phase: 1 },
  'ui.theme': { need: 'implicit', phase: 1 },
  'ui.insets': { need: 'implicit', phase: 1 },
  'ui.toast': { need: 'implicit', phase: 1 },
  'ui.alert': { need: 'implicit', phase: 1 },
  'ui.confirm': { need: 'implicit', phase: 1 },
  'ui.prompt': { need: 'implicit', phase: 1 },
  'ui.haptic': { need: 'implicit', phase: 1 },
  'ui.setTitle': { need: 'implicit', phase: 1 },
  'ui.setBackHandler': { need: 'implicit', phase: 1 },
  'clipboard.write': { need: 'clipboard-write', phase: 1 },
  'clipboard.read': { need: 'clipboard-read', phase: 1 },
  'share.text': { need: 'share', phase: 3 },
  'share.file': { need: 'share', phase: 3 },
  'files.pick': { need: 'files', phase: 3 },
  'files.save': { need: 'files', phase: 3 },
  'location.current': { need: 'location', phase: 3 },
  'location.watch': { need: 'location', phase: 3 },
  'location.stop': { need: 'location', phase: 3 },
  'notifications.schedule': { need: 'notifications', phase: 3 },
  'notifications.cancel': { need: 'notifications', phase: 3 },
  'notifications.list': { need: 'notifications', phase: 3 },
  'camera.takePhoto': { need: 'camera', phase: 3 },
  'photos.pick': { need: 'photos', phase: 3 },
  'assistant.ask': { need: 'assistant', phase: 3 },
  'network.fetch': { need: 'network', phase: 4 },
};

/** The phase this Qutai implements. */
export const IMPLEMENTED_PHASE = 1;

export const EVENTS = ['theme', 'insets', 'pause', 'resume', 'back'] as const;

export type BridgeRequest = { id: number; call: string; args: Record<string, unknown> };
export type BridgeAnswer =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: { code: ErrorCode; message: string } };

/** A message from the app, or null when it isn't a well-formed request (dropped and counted). */
export function parseBridgeRequest(raw: string): BridgeRequest | null {
  if (typeof raw !== 'string' || raw.length > LIMITS.messageBytes) return null;
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  if (m.qutai !== 1 || !Number.isInteger(m.id) || (m.id as number) < 0 || typeof m.call !== 'string' || m.call.length > 64) return null;
  const args = m.args === undefined ? {} : m.args;
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null;
  return { id: m.id as number, call: m.call, args: args as Record<string, unknown> };
}

export type Grant = 'granted' | 'denied';
export type Grants = Partial<Record<AppPermission, Grant>>;

/**
 * The checks before a call runs, in the contract's order: known → implemented → declared → granted. 'ask' when the
 * permission must be asked first (the bridge asks and checks again). Arguments are checked by the call itself.
 */
export function checkCall(
  call: string,
  declared: readonly string[],
  grants: Grants,
): { ok: true } | { ok: 'ask'; permission: AppPermission } | { ok: false; code: ErrorCode; message: string } {
  const spec = Object.prototype.hasOwnProperty.call(CALLS, call) ? CALLS[call] : undefined;
  if (!spec) return { ok: false, code: 'E_UNKNOWN_CALL', message: `There is no call named ${call} in contract ${CONTRACT_VERSION}.` };
  if (spec.phase > IMPLEMENTED_PHASE)
    return { ok: false, code: 'E_NOT_AVAILABLE', message: `${call} is not available in this version of Qutai.` };
  if (spec.need === 'implicit') return { ok: true };
  if (!declared.includes(spec.need))
    return { ok: false, code: 'E_NOT_DECLARED', message: `${call} needs the "${spec.need}" permission in the app's manifest.` };
  if (!AVAILABLE_PERMISSIONS.includes(spec.need))
    return { ok: false, code: 'E_NOT_AVAILABLE', message: `${call} is not available in this version of Qutai.` };
  const grant = grants[spec.need];
  if (grant === 'denied') return { ok: false, code: 'E_DENIED', message: `The user did not allow "${spec.need}" for this app.` };
  if (ASKED_PERMISSIONS.includes(spec.need) && grant !== 'granted') return { ok: 'ask', permission: spec.need };
  return { ok: true };
}

/** The state of each declared permission for app.permissions and the Permissions list. */
export function permissionStates(declared: readonly AppPermission[], grants: Grants): Record<string, Grant | 'ask'> {
  const out: Record<string, Grant | 'ask'> = {};
  for (const p of declared) out[p] = grants[p] ?? (ASKED_PERMISSIONS.includes(p) ? 'ask' : 'granted');
  return out;
}
